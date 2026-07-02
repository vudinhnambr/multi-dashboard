// Vercel Serverless Function — ghi production_records.
// Phase 2 / Bước 5: nhập liệu cho inspector/admin (form tay, copy-paste, upload Excel).
//
// Cơ chế phân quyền: function forward JWT của user + anon key xuống PostgREST.
// RLS policy "inspector admin insert" (with_check: get_my_role() ∈ {inspector, admin})
// tự gác cổng — viewer POST sẽ bị PostgREST trả 401/403. KHÔNG dùng service role key
// để tránh bypass RLS (giống mạch của api/data.js).
//
// Env vars cần: SUPABASE_URL, SUPABASE_ANON_KEY

import { isRateLimited, getClientIp } from '../lib/rateLimit.js'

// ===== Rate limiting theo IP — Upstash nếu có, fallback in-memory (xem lib/rateLimit.js) =====
const MAX_REQ = 30            // ghi ít hơn đọc: 30 request / phút
const WINDOW_MS = 60 * 1000

const MAX_ROWS = 1000        // trần số dòng / lần ghi, chống abuse

// Cột được phép ghi (whitelist). id / created_at / updated_at do DB tự sinh — không nhận từ client.
const ALLOWED = [
  'record_date', 'week', 'shift', 'person', 'machine', 'part',
  'type', 'qty', 'serial_no', 'result', 'indication', 're_inspection'
]
// Bắt buộc ở tầng nghiệp vụ (DB không ép vì mọi cột đều nullable/có default).
// Khớp đúng mức tối thiểu mà api/data.js validate phía client.
const REQUIRED_TEXT = ['person', 'machine', 'part']

// Date hợp lệ + round-trip (bắt được 2024-02-31).
function isValidIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === s
}

// Validate 1 row — trả mảng thông báo lỗi (rỗng = hợp lệ).
// Là nguồn quyết định: client validate trùng logic này nhưng server không tin client.
function validateRow(row) {
  const errors = []

  if (!isValidIsoDate(row.record_date)) {
    errors.push('record_date không hợp lệ (cần YYYY-MM-DD)')
  }
  if (!Number.isInteger(row.qty) || row.qty < 0) {
    errors.push('qty phải là số nguyên ≥ 0')
  }
  for (const f of REQUIRED_TEXT) {
    if (typeof row[f] !== 'string' || row[f].trim() === '') {
      errors.push(`${f} không được để trống`)
    }
  }
  if (row.week != null && (!Number.isInteger(row.week) || row.week < 0)) {
    errors.push('week phải là số nguyên ≥ 0')
  }
  if (row.re_inspection != null && (!Number.isInteger(row.re_inspection) || row.re_inspection < 0)) {
    errors.push('re_inspection phải là số nguyên ≥ 0')
  }
  return errors
}

// Chỉ giữ cột whitelist; '' ở cột text → null cho gọn DB; record_date giữ nguyên.
function sanitizeRow(row) {
  const out = {}
  for (const key of ALLOWED) {
    if (row[key] === undefined) continue
    let v = row[key]
    if (typeof v === 'string') v = v.trim()
    if (v === '' && key !== 'record_date') v = null
    out[key] = v
  }
  // re_inspection là NOT NULL (default 0): nếu null thì bỏ hẳn để DB tự điền default,
  // tránh lỗi null vào cột NOT NULL.
  if (out.re_inspection == null) delete out.re_inspection
  return out
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
  if (await isRateLimited(ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader('Retry-After', '60')
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  // JWT user
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  // Body — Vercel tự parse JSON; vẫn phòng trường hợp string.
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  const rows = body && Array.isArray(body.rows) ? body.rows : null
  if (!rows || rows.length === 0) {
    return res.status(400).json({ error: 'No rows to insert' })
  }
  if (rows.length > MAX_ROWS) {
    return res.status(413).json({ error: `Tối đa ${MAX_ROWS} dòng mỗi lần ghi` })
  }

  // Validate toàn bộ — all-or-nothing: chỉ cần 1 dòng sai là từ chối cả lô.
  const details = []
  rows.forEach((r, i) => {
    const errs = validateRow(r)
    if (errs.length) details.push({ row: i, errors: errs })
  })
  if (details.length) {
    return res.status(422).json({ error: 'Validation failed', details })
  }

  const payload = rows.map(sanitizeRow)

  try {
    // Forward JWT + anon key → PostgREST batch insert. RLS quyết định cho ghi hay không.
    const apiUrl = `${supabaseUrl}/rest/v1/production_records`

    const dbRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'   // không trả body, nhẹ
      },
      body: JSON.stringify(payload)
    })

    // Token hết hạn / không phải inspector|admin → RLS chặn
    if (dbRes.status === 401 || dbRes.status === 403) {
      return res.status(403).json({ error: 'Không có quyền ghi (chỉ inspector/admin) hoặc phiên đã hết hạn.' })
    }

    if (!dbRes.ok) {
      const errText = await dbRes.text()
      console.error('Supabase insert error:', dbRes.status, errText)
      return res.status(502).json({ error: 'Ghi dữ liệu thất bại' })
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ inserted: payload.length })
  } catch (err) {
    console.error('Database error:', err)
    return res.status(502).json({ error: 'Unable to write data to database' })
  }
}
