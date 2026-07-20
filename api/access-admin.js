// Quản trị quyền dashboard (chỉ admin). Đọc/ghi bảng dashboard_access ở project dashboards-auth.
// Gate: người gọi phải có dòng dashboard_access(dashboard='admin').
// Cần env: AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY (đã có) + AUTH_SERVICE_KEY (service_role của dashboards-auth).
import { checkDashboardAccess } from "../lib/dashboardAuth.js";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";

const AUTH_URL = process.env.AUTH_SUPABASE_URL;
const SERVICE = process.env.AUTH_SERVICE_KEY;
// Các dashboard được quản lý (5 tab đăng nhập chung) + 'admin' (cấp quyền quản trị)
const MANAGED = ["cmm", "supplier-ncr", "shipment-check", "inspection-notice", "inspector-eval", "admin"];
const MAX_REQ = 60, WINDOW_MS = 60 * 1000;

function svcHeaders(extra) {
  return { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(extra || {}) };
}

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited("aa:" + ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Quá nhiều yêu cầu. Thử lại sau ít phút." });
  }

  const access = await checkDashboardAccess(req, "admin");
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  if (req.query.access === "check") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, role: access.role });
  }

  if (!AUTH_URL || !SERVICE) {
    return res.status(500).json({ error: "Chưa cấu hình AUTH_SERVICE_KEY." });
  }

  try {
    if (req.method === "GET") {
      // Danh sách tài khoản (GoTrue admin API)
      const ur = await fetch(`${AUTH_URL}/auth/v1/admin/users?per_page=1000&page=1`, { headers: svcHeaders() });
      if (!ur.ok) { const t = await ur.text().catch(() => ""); throw new Error("users " + ur.status + " " + t); }
      const uj = await ur.json();
      const users = Array.isArray(uj) ? uj : (uj.users || []);
      // Toàn bộ dòng dashboard_access
      const ar = await fetch(`${AUTH_URL}/rest/v1/dashboard_access?select=user_id,dashboard,role`, { headers: svcHeaders() });
      if (!ar.ok) { const t = await ar.text().catch(() => ""); throw new Error("access " + ar.status + " " + t); }
      const rows = await ar.json();
      const byUser = {};
      for (const r of rows) { (byUser[r.user_id] = byUser[r.user_id] || {})[r.dashboard] = r.role || "viewer"; }
      const out = users.map(u => ({ id: u.id, email: u.email || "", access: byUser[u.id] || {} }))
        .sort((a, b) => a.email.localeCompare(b.email));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ dashboards: MANAGED, users: out });
    }

    if (req.method === "POST") {
      const { user_id, dashboard } = req.body || {};
      let role = (req.body && req.body.role) || "viewer";
      const enabled = !!(req.body && req.body.enabled);
      if (!user_id || !MANAGED.includes(dashboard)) return res.status(400).json({ error: "Tham số không hợp lệ." });
      if (dashboard === "admin") role = "admin";
      const base = `${AUTH_URL}/rest/v1/dashboard_access`;
      const q = `?user_id=eq.${encodeURIComponent(user_id)}&dashboard=eq.${encodeURIComponent(dashboard)}`;
      // Luôn xóa dòng cũ trước (tránh phụ thuộc unique constraint), rồi thêm lại nếu bật
      const del = await fetch(base + q, { method: "DELETE", headers: svcHeaders({ Prefer: "return=minimal" }) });
      if (!del.ok) { const t = await del.text().catch(() => ""); throw new Error("del " + del.status + " " + t); }
      if (enabled) {
        const ins = await fetch(base, { method: "POST", headers: svcHeaders({ Prefer: "return=minimal" }), body: JSON.stringify({ user_id, dashboard, role }) });
        if (!ins.ok) { const t = await ins.text().catch(() => ""); throw new Error("ins " + ins.status + " " + t); }
      }
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("access-admin error:", err);
    return res.status(500).json({ error: "Lỗi: " + (err.message || "unknown") });
  }
}
