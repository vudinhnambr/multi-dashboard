// Inspector Skill Evaluation — lưu trạng thái dùng chung (thay cho localStorage per-browser).
// Xác thực Supabase + quyền dashboard 'inspector-eval' (bảng dashboard_access ở project auth chung).
// Dữ liệu lưu trong bảng key-value `inspector_eval(k text pk, v jsonb, updated_at)` ở project dữ liệu
// (SUPABASE_URL), ghi bằng service key (AUTOMT_SERVICE_KEY) — bypass RLS, chỉ chạy phía server.
//
// GET  /api/inspector-eval            → { qsl_config:…, qsl_custom:…, qsl_months:… }
// GET  /api/inspector-eval?access=check → { ok, role }  (dùng cho cổng đăng nhập)
// POST /api/inspector-eval  { k, v }  → upsert 1 khóa   (viewer không được ghi)
import { checkDashboardAccess } from "../lib/dashboardAuth.js";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";

const DB_URL = process.env.SUPABASE_URL;               // project dữ liệu (Auto MT)
const SERVICE = process.env.AUTOMT_SERVICE_KEY;        // service role — chỉ server
const TABLE = "inspector_eval";
const MAX_REQ = 90, WINDOW_MS = 60 * 1000;

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited("ie:" + ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Quá nhiều yêu cầu. Thử lại sau ít phút." });
  }

  const access = await checkDashboardAccess(req, "inspector-eval");
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.query.access === "check") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, role: access.role });
  }

  if (!DB_URL || !SERVICE) {
    return res.status(500).json({ error: "Storage chưa cấu hình (SUPABASE_URL / AUTOMT_SERVICE_KEY)." });
  }
  const base = `${DB_URL}/rest/v1/${TABLE}`;
  const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

  try {
    if (req.method === "GET") {
      const r = await fetch(`${base}?select=k,v`, { headers: H });
      if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("read " + r.status + " " + t); }
      const rows = await r.json();
      const out = {};
      for (const row of rows) out[row.k] = row.v;
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(out);
    }

    if (req.method === "POST") {
      // Chỉ role được phép mới ghi (viewer chỉ xem)
      if (access.role === "viewer") {
        return res.status(403).json({ error: "Chỉ xem — tài khoản này không có quyền chỉnh sửa." });
      }
      const k = req.body?.k;
      const v = req.body?.v;
      if (!k || typeof k !== "string") return res.status(400).json({ error: "Thiếu 'k'." });
      const row = { k, v: v ?? null, updated_at: new Date().toISOString() };
      const up = await fetch(`${base}?on_conflict=k`, {
        method: "POST",
        headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row),
      });
      if (!up.ok) { const t = await up.text().catch(() => ""); throw new Error("write " + up.status + " " + t); }
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("inspector-eval error:", err);
    return res.status(500).json({ error: "Lỗi lưu trữ: " + (err.message || "unknown") });
  }
}
