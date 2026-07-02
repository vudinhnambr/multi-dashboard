// Client Supabase dùng chung cho tab CMM (đăng nhập + lấy token phiên).
// Cấu hình lấy từ /api/auth-config (đọc AUTH_SUPABASE_URL / AUTH_SUPABASE_ANON_KEY
// trên server) → không hardcode URL/key trong bundle.
//
// Singleton: mọi nơi (CmmGate, data.js, dynamicLoaders.js) dùng chung 1 client,
// nên phiên đăng nhập nhất quán.

let _clientPromise = null;

async function createSupabase() {
  const cfg = await fetch('/api/auth-config').then((r) => {
    if (!r.ok) throw new Error('auth-config ' + r.status);
    return r.json();
  });
  const mod = await import(/* @vite-ignore */ 'https://esm.sh/@supabase/supabase-js@2');
  return mod.createClient(cfg.url, cfg.anonKey);
}

export function getSupabase() {
  if (!_clientPromise) _clientPromise = createSupabase();
  return _clientPromise;
}

// Token phiên hiện tại (rỗng nếu chưa đăng nhập). Dùng cho header Authorization.
export async function getAccessToken() {
  try {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || '';
  } catch {
    return '';
  }
}
