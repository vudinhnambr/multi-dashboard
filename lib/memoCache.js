// Cache in-memory theo TTL cho serverless function (giữ khi instance còn "ấm").
// Giảm số lần tải + parse file Excel lớn → tiết kiệm CPU & băng thông Vercel.
const store = new Map();

export async function memo(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && (Date.now() - hit.t) < ttlMs) return hit.v;
  const v = await fn();
  store.set(key, { t: Date.now(), v });
  return v;
}
