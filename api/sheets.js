import axios from "axios";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";

const MAX_REQ = 60; // đọc: 60 request / phút / IP
const WINDOW_MS = 60 * 1000;

/**
 * Google Sheets XLSX proxy — avoids browser CORS.
 * GET /api/sheets?id=SPREADSHEET_ID
 * Returns raw XLSX bytes; client parses with XLSX library.
 *
 * BẢO MẬT: chỉ proxy các spreadsheet nằm trong allowlist để tránh biến endpoint
 * thành open-proxy (ai cũng tải được mọi Google Sheet qua server của mình).
 * Allowlist lấy từ env SHEETS_ALLOWED_IDS (danh sách ID, phân tách bằng dấu phẩy),
 * cộng thêm ID mặc định của CMM. CMM vẫn mở tự do — không cần đăng nhập.
 */
const DEFAULT_ALLOWED_IDS = [
  "11pT3Oi21Q5qmXZ6Jhn09ZR2q-G9C7EJj", // CMM: 4. ITR & Shipment (src/config.js)
];

function allowedIds() {
  const fromEnv = (process.env.SHEETS_ALLOWED_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_IDS, ...fromEnv]);
}

// ID Google Sheets hợp lệ: chữ, số, gạch ngang, gạch dưới (chặn path traversal / ký tự lạ).
const VALID_ID = /^[A-Za-z0-9_-]+$/;

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Try again shortly." });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing ?id= parameter" });

  if (typeof id !== "string" || !VALID_ID.test(id)) {
    return res.status(400).json({ error: "Invalid sheet id" });
  }

  if (!allowedIds().has(id)) {
    return res.status(403).json({ error: "This sheet id is not allowed" });
  }

  const url =
    "https://docs.google.com/spreadsheets/d/" + id + "/export?format=xlsx";

  let response;
  try {
    response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 10,
      validateStatus: () => true,          // never throw on HTTP status
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "Network error fetching sheet: " + err.message,
      id,
    });
  }

  const ct = response.headers["content-type"] || "";
  const httpStatus = response.status;

  // Google redirected to HTML login / confirmation page
  if (ct.includes("text/html")) {
    return res.status(403).json({
      error:
        "Google returned HTML (status " +
        httpStatus +
        "). File may require sign-in or is not shared publicly.",
      id,
      hint: "Share the file: Anyone with the link -> Viewer",
    });
  }

  if (httpStatus !== 200) {
    return res.status(502).json({
      error: "Google returned HTTP " + httpStatus + " for sheet " + id,
      contentType: ct,
    });
  }

  // Success — stream XLSX bytes to client
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Cache-Control", "public, max-age=300"); // 5-min cache
  const buf = Buffer.isBuffer(response.data)
    ? response.data
    : Buffer.from(new Uint8Array(response.data));
  return res.status(200).end(buf);
}
