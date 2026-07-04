// Auto MT Capacity — gộp PO Forecast (số set/tuần) + Combined ST (MT Total min/set).
// Trả JSON để tab Auto MT vẽ "PO + Forecast 2026 vs Auto MT Capacity".
// Demand Auto MT = số set × MT Total (kiểm 100%, không lấy mẫu).
import * as XLSX from "xlsx";
import { isRateLimited, getClientIp } from "../lib/rateLimit.js";

const PO_FORECAST_ID  = process.env.PO_FORECAST_FILE_ID || "1-L2ms12iaI3Ds95ap1URFuQ3O41FFqby";
const COMBINED_ST_ID  = process.env.COMBINED_ST_FILE_ID || "1R_eoCseRbx4VBdJ81O_-BHcWurswP_p8";
const MAX_REQ = 30;
const WINDOW_MS = 60 * 1000;

async function fetchSheet(id, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Drive HTTP ${r.status} (${id})`);
  const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: "buffer" });
  const ws = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

const num = (v) => (typeof v === "number" ? v : (v == null || v === "" || Number.isNaN(Number(v)) ? 0 : Number(v)));

export default async function handler(req, res) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip, { max: MAX_REQ, windowMs: WINDOW_MS })) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests." });
  }

  try {
    // MT Total (min/set) theo model — cột 8 sheet 'Combined ST'
    const stRows = await fetchSheet(COMBINED_ST_ID, "Combined ST");
    const mtStd = {};
    for (let i = 3; i < stRows.length; i++) {
      const r = stRows[i]; if (!r || !r[1]) continue;
      const model = String(r[1]).trim();
      const total = num(r[8]); // MT Total (min/set)
      if (model && total > 0) mtStd[model] = total;
    }

    // PO Forecast — số set/tuần theo model (cols 4..56 = W1..W53)
    const poRows = await fetchSheet(PO_FORECAST_ID, "PO + Forecast 2026");
    const parts = [];
    for (let i = 3; i < poRows.length; i++) {
      const r = poRows[i]; if (!r) continue;
      const customer = r[1], model = r[2];
      if (!customer || !model || typeof model !== "string") continue;
      if (model.trim() === "Model") continue;
      const modelTrim = model.trim();
      const std = mtStd[modelTrim] || 0;   // MT Total min/set; 0 = part không thuộc Auto MT
      const sets = [];
      for (let w = 0; w < 53; w++) sets.push(num(r[4 + w]));
      parts.push({ model: modelTrim, customer: String(customer).trim(), mtStd: std, sets });
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({
      parts,
      months: [
        ["JAN", 0, 4], ["FEB", 5, 8], ["MAR", 9, 12], ["APR", 13, 17],
        ["MAY", 18, 21], ["JUN", 22, 25], ["JUL", 26, 30], ["AUG", 31, 34],
        ["SEP", 35, 38], ["OCT", 39, 43], ["NOV", 44, 47], ["DEC", 48, 52],
      ],
      refreshedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("mt-capacity error:", e);
    return res.status(500).json({ error: e.message });
  }
}
