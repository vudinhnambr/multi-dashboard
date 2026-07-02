import axios from "axios";
import crypto from "crypto";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";

const MAX_REQ = 60; // đọc: 60 request / phút / IP
const WINDOW_MS = 60 * 1000;

// So sánh chuỗi timing-safe (chống timing attack; an toàn cả khi lệch độ dài).
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Google Sheets XLSX proxy — avoids browser CORS.
 * GET /api/sheets?id=SPREADSHEET_ID
 * Returns raw XLSX bytes; client parses with XLSX library.
 *
 * BẢO MẬT: chỉ proxy các spreadsheet nằm trong allowlist để tránh biến endpoint
 * thành open-proxy (ai cũng tải được mọi Google Sheet qua server của mình).
 * Allowlist lấy từ env SHEETS_ALLOWED_IDS (danh sách ID, phân tách bằng dấu phẩy),
 * cộng thêm ID mặc định của CMM.
 *
 * XÁC THỰC: endpoint yêu cầu header x-auth-key === env CMM_AUTH_KEY (mật khẩu tab CMM).
 * Chưa cấu hình CMM_AUTH_KEY → trả 500 (fail-closed, không mở dữ liệu).
 * Ping nhẹ cho màn đăng nhập: GET /api/sheets?auth=check (chỉ kiểm tra mật khẩu, không tải sheet).
 */
const DEFAULT_ALLOWED_IDS = [
  "11pT3Oi21Q5qmXZ6Jhn09ZR2q-G9C7EJj", // CMM: 1. Mass Product, Test Inspection (src/config.js + dynamicLoaders)
  "1R_eoCseRbx4VBdJ81O_-BHcWurswP_p8", // CMM: Combined ST Auto MT and CMM (dynamicLoaders)
  "1-L2ms12iaI3Ds95ap1URFuQ3O41FFqby", // CMM: PO Forecast 2026 Clean (dynamicLoaders)
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

  // Xác thực mật khẩu tab CMM.
  const expectedKey = process.env.CMM_AUTH_KEY;
  if (!expectedKey) {
    console.error("Missing CMM_AUTH_KEY env var");
    return res.status(500).json({ error: "Server not configured" });
  }
  const authKey = req.headers["x-auth-key"];
  if (!authKey || !safeEqual(authKey, expectedKey)) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Ping xác thực nhẹ cho màn đăng nhập — mật khẩu đúng thì trả OK ngay, không tải sheet.
  if (req.query.auth === "check") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true });
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
