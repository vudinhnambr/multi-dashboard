// Shipment Check — tra trạng thái NCR của các ring trong 1 bearing set.
// Xác thực Supabase + quyền dashboard 'shipment-check'. Dữ liệu đọc từ Google Drive (service account).
import { getLookups } from "../lib/shipment/data.js";
import { checkBearingSet } from "../lib/shipment/lookup.js";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";
import { checkDashboardAccess } from "../lib/dashboardAuth.js";

const MAX_REQ = 60;
const WINDOW_MS = 60 * 1000;

function parseSnList(raw) {
  if (!raw) return [];
  return String(raw).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Quá nhiều yêu cầu. Thử lại sau ít phút." });
  }

  const access = await checkDashboardAccess(req, "shipment-check");
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.query.access === "check") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, role: access.role });
  }

  try {
    const raw = req.method === "POST" ? req.body?.sn : req.query.sn;
    const refresh = req.query.refresh === "1" || req.body?.refresh === true;
    const snList = parseSnList(raw);
    if (snList.length === 0) {
      return res.status(400).json({ error: "Missing 'sn' (bearing set S/N, one or more)." });
    }
    const { ringLookup, ncrLookup, timestamp } = await getLookups({ forceRefresh: refresh });
    const results = snList.map((assySn) => checkBearingSet(assySn, ringLookup, ncrLookup));
    // Defect Description chỉ admin xem — non-admin: lược bỏ ngay tại server (không gửi xuống browser)
    if (access.role !== "admin") {
      for (const r of results) for (const ring of (r.rings || [])) for (const rec of (ring.records || [])) delete rec.defectDescription;
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ dataAsOf: new Date(timestamp).toISOString(), results });
  } catch (err) {
    console.error("shipment check error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
