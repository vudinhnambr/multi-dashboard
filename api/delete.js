// Vercel Serverless Function — xóa production_records theo id (admin only).
//
// Cơ chế: forward JWT user + anon key → PostgREST. RLS policy "admin delete"
// (using: get_my_role() = 'admin') gác cổng — non-admin gọi sẽ xóa 0 dòng vì USING
// loại hết, KHÔNG báo lỗi nhưng cũng KHÔNG xóa được gì. KHÔNG dùng service role key.
//
// Env vars cần: SUPABASE_URL, SUPABASE_ANON_KEY

const MAX_REQ = 30
const WINDOW_MS = 60 * 1000
const hits = new Map()

const MAX_IDS = 100   // trần số id mỗi lần xóa

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) {
    return fwd.split(',')[0].trim()
  }
  return req.headers['x-real-ip'] || 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { count: 1, start: now })
    return false
  }
  rec.count += 1
  return rec.count > MAX_REQ
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env var')
    return res.status(500).json({ error: 'Server not configured' })
  }

  const ip = getClientIp(req)
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '60')
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  const ids = body && Array.isArray(body.ids) ? body.ids : null
  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: 'No ids to delete' })
  }
  if (ids.length > MAX_IDS) {
    return res.status(413).json({ error: `Tối đa ${MAX_IDS} dòng mỗi lần xóa` })
  }
  // Chỉ chấp nhận id là số nguyên dương — chặn injection vào query string.
  if (!ids.every(id => Number.isInteger(id) && id > 0)) {
    return res.status(400).json({ error: 'ids phải là số nguyên dương' })
  }

  try {
    // DELETE ... WHERE id IN (...). RLS quyết định row nào thực sự bị xóa.
    const idList = ids.join(',')
    const apiUrl = `${supabaseUrl}/rest/v1/production_records?id=in.(${idList})`

    const dbRes = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Prefer': 'return=representation'   // trả các dòng đã xóa để đếm
      }
    })

    if (dbRes.status === 401 || dbRes.status === 403) {
      return res.status(403).json({ error: 'Không có quyền xóa (chỉ admin) hoặc phiên đã hết hạn.' })
    }

    if (!dbRes.ok) {
      const errText = await dbRes.text()
      console.error('Supabase delete error:', dbRes.status, errText)
      return res.status(502).json({ error: 'Xóa dữ liệu thất bại' })
    }

    const deletedRows = await dbRes.json().catch(() => [])
    const deleted = Array.isArray(deletedRows) ? deletedRows.length : 0

    res.setHeader('Cache-Control', 'no-store')
    // deleted = 0 với non-admin (RLS loại hết) — frontend phân biệt được để báo đúng.
    return res.status(200).json({ deleted })
  } catch (err) {
    console.error('Database error:', err)
    return res.status(502).json({ error: 'Unable to delete data from database' })
  }
}
