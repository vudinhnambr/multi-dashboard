// Shipment Check — danh sách Part cho dropdown. Gate 'shipment-check'.
import { getLookups } from "../lib/shipment/data.js";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";
import { checkDashboardAccess } from "../lib/dashboardAuth.js";

const MAX_REQ = 60;
const WINDOW_MS = 60 * 1000;

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Quá nhiều yêu cầu. Thử lại sau ít phút." });
  }

  const access = await checkDashboardAccess(req, "shipment-check");
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  try {
    const refresh = req.query.refresh === "1";
    const { parts, timestamp } = await getLookups({ forceRefresh: refresh });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ dataAsOf: new Date(timestamp).toISOString(), parts: parts || [] });
  } catch (err) {
    console.error("shipment parts error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
