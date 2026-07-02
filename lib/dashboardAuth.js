// Xác thực người dùng qua Supabase Auth + kiểm tra quyền vào MỘT dashboard cụ thể.
//
// Dùng project Supabase "quyền chung" (env AUTH_SUPABASE_URL / AUTH_SUPABASE_ANON_KEY).
// Cơ chế: forward JWT của user + anon key xuống PostgREST, đọc bảng dashboard_access.
// RLS "read own access" đảm bảo user chỉ thấy dòng của chính mình → có dòng cho
// dashboard tương ứng = được vào. Không có dòng = 403. JWT sai/hết hạn = 401.
//
// Trả về: { ok:true, role } hoặc { ok:false, status, error }.
export async function checkDashboardAccess(req, dashboard) {
  const url = process.env.AUTH_SUPABASE_URL;
  const anonKey = process.env.AUTH_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("Missing AUTH_SUPABASE_URL or AUTH_SUPABASE_ANON_KEY");
    return { ok: false, status: 500, error: "Auth not configured" };
  }

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Not authenticated" };

  try {
    const q =
      `${url}/rest/v1/dashboard_access` +
      `?select=dashboard,role&dashboard=eq.${encodeURIComponent(dashboard)}`;
    const r = await fetch(q, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (r.status === 401 || r.status === 403) {
      return { ok: false, status: 401, error: "Session expired or invalid" };
    }
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("dashboard_access query failed:", r.status, t);
      return { ok: false, status: 502, error: "Auth check failed" };
    }

    const rows = await r.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return { ok: true, role: rows[0].role || "viewer" };
    }
    return { ok: false, status: 403, error: "Tài khoản chưa được cấp quyền vào dashboard này." };
  } catch (err) {
    console.error("dashboard_access error:", err);
    return { ok: false, status: 502, error: "Auth check error" };
  }
}
