// Inspection Notice — 2 tab con đọc Google Drive qua service account (như Shipment Check).
//   file=in  → Inspection Notice (sheet LIST)          : dùng chung DRIVE_NCR_FILE_ID
//   file=ncr → Confirmed NCR (sheet Quality Status HQ) : DRIVE_CONFIRMED_FILE_ID
// Gate 'inspection-notice' (Supabase). Env cần: GOOGLE_SERVICE_ACCOUNT_KEY_B64 (đã có cho Shipment Check).
import { downloadDriveFile } from "../lib/shipment/drive.js";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";
import { checkDashboardAccess } from "../lib/dashboardAuth.js";

const MAX_REQ = 60;
const WINDOW_MS = 60 * 1000;

function fileIdFor(which) {
  // 'ncr' → Confirmed NCR: biến DRIVE_CONFIRMED_FILE_ID (giống cách 3 file kia)
  // 'in'  → dùng chung file NCR-SR Tracking với Shipment Check: DRIVE_NCR_FILE_ID
  return which === "ncr"
    ? (process.env.DRIVE_CONFIRMED_FILE_ID || "")
    : (process.env.DRIVE_NCR_FILE_ID || "");
}

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Quá nhiều yêu cầu. Thử lại sau ít phút." });
  }

  const access = await checkDashboardAccess(req, "inspection-notice");
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.query.access === "check") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, role: access.role });
  }

  const which = req.query?.file === "ncr" ? "ncr" : "in";
  const fileId = fileIdFor(which);
  if (!fileId) {
    return res.status(500).json({ error: which === "in" ? "Thiếu DRIVE_NCR_FILE_ID" : "Thiếu DRIVE_CONFIRMED_FILE_ID" });
  }

  try {
    const buf = await downloadDriveFile(fileId); // service account, tự nhận Google Sheet/.xlsx
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(Buffer.from(buf));
  } catch (e) {
    console.error("inspection fetch error:", e);
    return res.status(500).json({ error: e.message });
  }
}
