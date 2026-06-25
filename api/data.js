// Vercel Serverless Function — đọc production_records.
// Phase 2 / Bước 4: xác thực bằng Supabase Auth (JWT user) thay cho password chung.
// Cơ chế phân quyền: function forward JWT của user + anon key xuống PostgREST,
// PostgREST áp RLS policy theo role trong bảng profiles (admin / inspector / viewer).
// Env vars cần: SUPABASE_URL, SUPABASE_ANON_KEY
// (KHÔNG còn dùng DASHBOARD_PASSWORD và SUPABASE_SERVICE_ROLE_KEY cho endpoint này)

// ===== Rate limiting nhẹ theo IP (chống abuse, không còn để chặn brute-force password) =====
const MAX_REQ = 60            // tối đa 60 request mỗi cửa sổ
const WINDOW_MS = 60 * 1000   // cửa sổ 1 phút
const hits = new Map()

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

  // Rate limit
  const ip = getClientIp(req)
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '60')
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  // Lấy JWT user từ header Authorization: Bearer <token>
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    // Forward JWT của user + anon key → PostgREST đánh giá RLS theo role
    const apiUrl = `${supabaseUrl}/rest/v1/production_records?select=*&order=record_date.asc`

    const dbRes = await fetch(apiUrl, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Range-Unit': 'items',
        'Range': '0-99999'        // lấy tối đa 100k dòng/lần, vượt trần mặc định 1000
      }
    })

    // Token hết hạn / không hợp lệ / bị RLS chặn
    if (dbRes.status === 401 || dbRes.status === 403) {
      return res.status(401).json({ error: 'Session expired or not allowed' })
    }

    if (!dbRes.ok) {
      const errText = await dbRes.text()
      console.error('Supabase query error:', dbRes.status, errText)
      return res.status(502).json({ error: 'Database query failed' })
    }

    const rows = await dbRes.json()

    // Map tên cột DB sang tên cột frontend đang dùng
    const data = rows.map(r => ({
      Date: r.record_date,
      Week: r.week,
      Shift: r.shift || '',
      Person: r.person || '',
      Machine: r.machine || '',
      Part: r.part || '',
      Type: r.type || '',
      Qty: r.qty || 0,
      'Serial No': r.serial_no || '',
      Result: r.result,
      Indication: r.indication,
      'Re-Inspection': r.re_inspection || 0
    }))

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ data })
  } catch (err) {
    console.error('Database error:', err)
    return res.status(502).json({ error: 'Unable to fetch data from database' })
  }
}
