// Rate limiting dùng chung cho các serverless function.
//
// Vấn đề: bộ đếm trong RAM (Map) KHÔNG hiệu quả trên Vercel vì mỗi lần gọi có thể
// là một instance khác, bộ đếm không chia sẻ giữa các instance.
//
// Giải pháp: nếu có Upstash Redis (env UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
// thì đếm tập trung trên Redis (chính xác, xuyên instance). Nếu CHƯA cấu hình,
// tự động fallback về bản in-memory như cũ — không vỡ gì, chỉ là bảo vệ yếu hơn.
//
// Cách bật đúng: tạo một Upstash Redis (hoặc Vercel KV) → copy REST URL + TOKEN
// vào Environment Variables trên Vercel → redeploy. Không cần đổi code.

const memory = new Map();

function memoryLimited(key, max, windowMs) {
  const now = Date.now();
  const rec = memory.get(key);
  if (!rec || now - rec.start > windowMs) {
    memory.set(key, { count: 1, start: now });
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}

// Upstash REST: INCR key; nếu là lần đầu thì đặt TTL (PEXPIRE ... NX).
// Trả về true nếu vượt ngưỡng. Ném lỗi nếu Upstash trục trặc → caller fallback.
async function upstashLimited(key, max, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, String(windowMs), "NX"],
    ]),
  });

  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = await res.json();
  // data = [{ result: <count> }, { result: 0|1 }]
  const count = Array.isArray(data) ? Number(data[0]?.result) : NaN;
  if (!Number.isFinite(count)) throw new Error("Upstash bad response");
  return count > max;
}

/**
 * @param {string} key   Khóa định danh (thường là IP). Đã được tự thêm tiền tố "rl:".
 * @param {{max:number, windowMs:number}} opts
 * @returns {Promise<boolean>} true nếu bị giới hạn (đã vượt ngưỡng).
 */
export async function isRateLimited(key, { max, windowMs }) {
  const fullKey = `rl:${key}`;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashLimited(fullKey, max, windowMs);
    } catch (err) {
      // Upstash lỗi → không chặn oan, rơi về bản in-memory.
      console.error("Rate limit (Upstash) error, fallback to memory:", err.message);
    }
  }
  return memoryLimited(fullKey, max, windowMs);
}

export function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) {
    return fwd.split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || "unknown";
}
