// Auto MT Standard Time — đọc từ file Combined ST (sheet 'Combined ST', cột Auto MT),
// trả JSON để tab Auto MT nạp thay bảng std hardcode. Chỉ là số liệu tham chiếu.
// Cột (0-based) trong 'Combined ST': 1=Part Name, 3=Single ring, 4=Outer, 5=Inner, 6=Inner 1, 7=Inner 2.
import * as XLSX from "xlsx";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";

const COMBINED_ST_ID = process.env.COMBINED_ST_FILE_ID || "1R_eoCseRbx4VBdJ81O_-BHcWurswP_p8";
const MAX_REQ = 30;
const WINDOW_MS = 60 * 1000;

const num = (v) => (v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests." });
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${COMBINED_ST_ID}/export?format=xlsx`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(502).json({ error: `Google Drive HTTP ${r.status}` });

    const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: "buffer" });
    const ws = wb.Sheets["Combined ST"] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const standard = [];
    for (let i = 3; i < rows.length; i++) {   // header ở dòng index 2, data từ 3
      const row = rows[i];
      if (!row) continue;
      const model = row[1] ? String(row[1]).trim() : "";
      if (!model) continue;
      const singleRing = num(row[3]);
      const outer = num(row[4]);
      const inner = num(row[5]);
      const inner1 = num(row[6]);
      const inner2 = num(row[7]);
      // Bỏ dòng không có std Auto MT nào (vd ITR)
      if (singleRing == null && outer == null && inner == null && inner1 == null && inner2 == null) continue;
      standard.push({ model, outer, inner, inner1, inner2, singleRing });
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({ standard, refreshedAt: new Date().toISOString() });
  } catch (e) {
    console.error("mt-standard error:", e);
    return res.status(500).json({ error: e.message });
  }
}
