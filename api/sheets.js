import axios from "axios";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";
import { checkDashboardAccess } from "../lib/dashboardAuth.js";
import { memo } from "../lib/memoCache.js";

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
 * cộng thêm ID mặc định của CMM.
 *
 * XÁC THỰC: Supabase Auth. Client gửi Authorization: Bearer <access_token>.
 * Server kiểm tra quyền vào dashboard 'cmm' qua bảng dashboard_access (lib/dashboardAuth.js,
 * dùng env AUTH_SUPABASE_URL / AUTH_SUPABASE_ANON_KEY). Chưa cấu hình env → 500 (fail-closed).
 * Ping nhẹ cho màn đăng nhập: GET /api/sheets?access=check (chỉ xác thực + kiểm quyền, không tải sheet).
 */
const DEFAULT_ALLOWED_IDS = [
  "1M0cBUpk77DWW3gAaXe9WnNMW6YPPVy1d", // CMM: 1. Mass Product, Test Inspection (src/config.js + dynamicLoaders)
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

  // Xác thực Supabase + kiểm tra quyền vào dashboard 'cmm'.
  const access = await checkDashboardAccess(req, "cmm");
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  // Ping nhẹ cho màn đăng nhập: đã xác thực + có quyền → OK ngay, không tải sheet.
  if (req.query.access === "check") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, role: access.role });
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

  // Cache buffer 10 phút (chỉ cache khi tải thành công) → không tải lại file lớn từ Drive mỗi lần.
  let buf;
  try {
    buf = await memo("sheetbuf:" + id, 10 * 60 * 1000, async () => {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxRedirects: 10,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        },
      });
      const ct = response.headers["content-type"] || "";
      if (ct.includes("text/html")) throw Object.assign(new Error("html"), { kind: "HTML" });
      if (response.status !== 200) throw Object.assign(new Error("http"), { kind: "HTTP", status: response.status, ct });
      return Buffer.isBuffer(response.data) ? response.data : Buffer.from(new Uint8Array(response.data));
    });
  } catch (err) {
    if (err.kind === "HTML") return res.status(403).json({ error: "Google returned HTML. File may require sign-in or is not shared publicly.", id, hint: "Share the file: Anyone with the link -> Viewer" });
    if (err.kind === "HTTP") return res.status(502).json({ error: "Google returned HTTP " + err.status + " for sheet " + id, contentType: err.ct });
    return res.status(500).json({ error: "Network error fetching sheet: " + err.message, id });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Cache-Control", "public, max-age=600"); // 10-min cache trình duyệt
  return res.status(200).end(buf);
}
