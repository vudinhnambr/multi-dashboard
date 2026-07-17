// Trang tổng quan (màn hình TV) — tổng hợp kết quả Daily HÔM TRƯỚC của CMM + Auto MT.
// Bảo vệ bằng token bí mật (?key=OVERVIEW_TOKEN). Không cần đăng nhập.
// Env: OVERVIEW_TOKEN, AUTOMT_SUPABASE_URL, AUTOMT_SERVICE_KEY,
//      (tùy chọn) CMM_DAILY_FILE_ID, COMBINED_ST_FILE_ID.
import * as XLSX from "xlsx";
import { aggregateCmmDaily } from "../lib/cmmDaily.js";

const CMM_DAILY_ID = process.env.CMM_DAILY_FILE_ID || "1M0cBUpk77DWW3gAaXe9WnNMW6YPPVy1d";
const COMBINED_ST_ID = process.env.COMBINED_ST_FILE_ID || "1R_eoCseRbx4VBdJ81O_-BHcWurswP_p8";

function yesterdayVN() {
  const now = new Date(Date.now() + 7 * 3600 * 1000); // giờ VN
  now.setUTCDate(now.getUTCDate() - 1);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}
async function fetchSheet(id, sheet) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Drive HTTP ${r.status}`);
  const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: "buffer", cellDates: false });
  const ws = wb.Sheets[sheet] || wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}
const norm = (s) => String(s || "").trim().toLowerCase();
const typeField = (t) => {
  const x = norm(t);
  if (x === "outer") return "outer";
  if (x === "inner") return "inner";
  if (x === "inner 1" || x === "inner1") return "inner1";
  if (x === "inner 2" || x === "inner2") return "inner2";
  if (x === "single ring" || x === "single") return "single";
  return null;
};

export default async function handler(req, res) {
  if (!process.env.OVERVIEW_TOKEN || req.query.key !== process.env.OVERVIEW_TOKEN) {
    return res.status(401).json({ error: "Not authorized" });
  }
  const date = yesterdayVN();
  try {
    // ---- CMM ----
    const cmmRows = await fetchSheet(CMM_DAILY_ID, "CMM Daily");
    const cmm = aggregateCmmDaily(cmmRows, date);

    // ---- Auto MT std (per-ring) từ Combined ST ----
    const stRows = await fetchSheet(COMBINED_ST_ID, "Combined ST");
    const mtStd = {};
    for (let i = 3; i < stRows.length; i++) {
      const r = stRows[i]; if (!r || !r[1]) continue;
      mtStd[norm(r[1])] = {
        single: Number(r[3]) || 0, outer: Number(r[4]) || 0, inner: Number(r[5]) || 0,
        inner1: Number(r[6]) || 0, inner2: Number(r[7]) || 0,
      };
    }

    // ---- Auto MT records hôm trước (service key, bypass RLS) ----
    let mt = { qty: 0, people: 0, hours: 0, byPerson: [], byMachine: [] };
    const AURL = process.env.AUTOMT_SUPABASE_URL, AKEY = process.env.AUTOMT_SERVICE_KEY;
    if (AURL && AKEY) {
      const q = `${AURL}/rest/v1/production_records?record_date=eq.${date}&select=person,machine,part,type,qty`;
      const rr = await fetch(q, { headers: { apikey: AKEY, Authorization: `Bearer ${AKEY}`, Accept: "application/json" } });
      if (rr.ok) {
        const recs = await rr.json();
        const persons = new Set(), byP = {}, byM = {};
        let qty = 0, earnedMin = 0;
        for (const r of recs) {
          const q0 = Number(r.qty) || 0;
          qty += q0;
          if (r.person) { persons.add(r.person); byP[r.person] = (byP[r.person] || 0) + q0; }
          if (r.machine) byM[r.machine] = (byM[r.machine] || 0) + q0;
          const std = mtStd[norm(r.part)];
          const f = typeField(r.type);
          if (std && f && std[f]) earnedMin += q0 * std[f];
        }
        const top = (obj) => Object.entries(obj).map(([k, v]) => ({ name: k, qty: v })).sort((a, b) => b.qty - a.qty).slice(0, 8);
        mt = { qty, people: persons.size, hours: Math.round(earnedMin / 60 * 10) / 10, byPerson: top(byP), byMachine: top(byM) };
      }
    }

    res.setHeader("Cache-Control", "public, max-age=120");
    return res.status(200).json({ date, cmm, mt, refreshedAt: new Date().toISOString() });
  } catch (e) {
    console.error("overview error:", e);
    return res.status(500).json({ error: e.message });
  }
}
