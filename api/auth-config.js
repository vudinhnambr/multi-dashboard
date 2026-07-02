// Trả về cấu hình Supabase công khai cho frontend khởi tạo client.
// Chỉ lộ URL + anon (publishable) key — đều là giá trị CÔNG KHAI, an toàn.
// Nhờ vậy client không cần hardcode; chỉ cần đặt biến môi trường trên Vercel.
export default function handler(req, res) {
  const url = process.env.AUTH_SUPABASE_URL || "";
  const anonKey = process.env.AUTH_SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) {
    return res.status(500).json({ error: "Auth not configured" });
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({ url, anonKey });
}
