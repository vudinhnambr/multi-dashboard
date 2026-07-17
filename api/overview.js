// Trang tổng quan (màn hình TV) — tổng hợp kết quả Daily HÔM TRƯỚC của CMM + Auto MT.
// Bảo vệ bằng token bí mật (?key=OVERVIEW_TOKEN). Không cần đăng nhập.
// Env: OVERVIEW_TOKEN, AUTOMT_SUPABASE_URL, AUTOMT_SERVICE_KEY,
//      (tùy chọn) CMM_DAILY_FILE_ID, COMBINED_ST_FILE_ID.
import * as XLSX from "xlsx";
import { aggregateCmmDaily, aggregateCmmWeekly } from "../lib/cmmDaily.js";

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
    // CMM theo tuần: 5 tuần gần nhất + Avg 4 tuần đã xong
    const cmmWk = aggregateCmmWeekly(cmmRows);
    const cmmLast5 = cmmWk.slice(-5);
    cmm.weekly = cmmLast5.map(w => ({ week: w.week, qty: w.hours }));
    const cmmDone = cmmLast5.slice(0, Math.max(0, cmmLast5.length - 1));
    cmm.weeklyAvg = cmmDone.length ? Math.round(cmmDone.reduce((s, w) => s + w.qty, 0) / cmmDone.length * 10) / 10 : 0;

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

    // ---- Auto MT: ~6 tuần gần nhất (service key, bypass RLS) → hôm trước + theo tuần ----
    let mt = { qty: 0, people: 0, hours: 0, byMachine: [], byPersonDay: [], weekly: [], weeklyAvg: 0 };
    const AURL = process.env.AUTOMT_SUPABASE_URL || process.env.SUPABASE_URL;
    const AKEY = process.env.AUTOMT_SERVICE_KEY;
    const STD_MIN_DAY = 620; // phút chuẩn/người/ngày để tính Efficiency
    if (AURL && AKEY) {
      const cutoff = (() => { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 45); return d.toISOString().slice(0, 10); })();
      const q = `${AURL}/rest/v1/production_records?record_date=gte.${cutoff}&select=record_date,week,person,machine,part,type,qty`;
      const rr = await fetch(q, { headers: { apikey: AKEY, Authorization: `Bearer ${AKEY}`, Accept: "application/json", "Range-Unit": "items", Range: "0-99999" } });
      if (rr.ok) {
        const recs = await rr.json();
        const earnedOf = (r) => { const std = mtStd[norm(r.part)]; const f = typeField(r.type); return (std && f && std[f]) ? (Number(r.qty) || 0) * std[f] : 0; };
        // Hôm trước
        const persons = new Set(), byM = {}, byPQty = {}, byPEarn = {};
        let qty = 0, earnedMin = 0;
        for (const r of recs.filter(r => r.record_date === date)) {
          const q0 = Number(r.qty) || 0; qty += q0; earnedMin += earnedOf(r);
          if (r.person) { persons.add(r.person); byPQty[r.person] = (byPQty[r.person] || 0) + q0; byPEarn[r.person] = (byPEarn[r.person] || 0) + earnedOf(r); }
          if (r.machine) byM[r.machine] = (byM[r.machine] || 0) + q0;
        }
        const byPersonDay = Object.keys(byPQty)
          .map(p => ({ name: p, qty: byPQty[p], eff: Math.round(byPEarn[p] / STD_MIN_DAY * 1000) / 10 }))
          .sort((a, b) => b.qty - a.qty).slice(0, 12);
        const byMachine = Object.entries(byM).map(([k, v]) => ({ name: k, qty: v })).sort((a, b) => b.qty - a.qty).slice(0, 8);
        // Theo tuần (output = tổng qty), 5 tuần gần nhất + Avg 4 tuần đã xong
        const byWeek = {};
        for (const r of recs) { const w = Number(r.week); if (!w) continue; byWeek[w] = (byWeek[w] || 0) + (Number(r.qty) || 0); }
        const last5 = Object.keys(byWeek).map(Number).sort((a, b) => a - b).slice(-5);
        const weekly = last5.map(w => ({ week: `Week ${w}`, qty: byWeek[w] }));
        const completed = last5.slice(0, Math.max(0, last5.length - 1));
        const weeklyAvg = completed.length ? Math.round(completed.reduce((s, w) => s + byWeek[w], 0) / completed.length) : 0;
        mt = { qty, people: persons.size, hours: Math.round(earnedMin / 60 * 10) / 10, byMachine, byPersonDay, weekly, weeklyAvg };
      }
    }

    res.setHeader("Cache-Control", "public, max-age=120");
    return res.status(200).json({ date, cmm, mt, refreshedAt: new Date().toISOString() });
  } catch (e) {
    console.error("overview error:", e);
    return res.status(500).json({ error: e.message });
  }
}
