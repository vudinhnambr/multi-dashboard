// Tổng hợp CMM Daily theo MỘT ngày (dùng cho trang Overview server-side).
// LƯU Ý: giữ đồng bộ std maps với src/dynamicLoaders.js.
const STEP_TO_COL = {
  'itr': 4, 'single ring': 5, 'single': 5, 'outer': 6, 'inner': 7,
  'inner 1': 8, 'inner1': 8, 'inner 2': 9, 'inner2': 9,
  'inner assembly': 10, 'innerassembly': 10, 'inner asm': 10,
  'outer radial+gap': 11, 'outer radial gap': 11, 'outer radial + gap': 11, 'outerrgap': 11,
  'assembly': 12,
};
const COL_LABEL = { 4: 'ITR', 5: 'Single Ring', 6: 'Outer', 7: 'Inner', 8: 'Inner 1', 9: 'Inner 2', 10: 'Inner Assembly', 11: 'Outer Radial + Gap', 12: 'Assembly' };
const PART_COL_STD = {
  'v172 blade bearing': { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  'v163 blade bearing': { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  'ep3 pitch': { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  'ep5 yaw': { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  '1.6 hybrid glass pitch bearing': { 6:180, 7:130 },
  '1.6 hybrid carbon pitch bearing': { 6:180, 7:130 },
  '1.5 pitch bearing': { 6:180, 7:130 },
  '1.x-91 pitch bearing': { 6:180, 7:130 },
  '1.x-97 pitch bearing': { 6:230, 7:230 },
  '2.5-116 pitch bearing': { 6:180, 7:140 },
  '3.x-103 pitch bearing': { 6:240, 7:290 },
  '3.x-130 pitch o-bearing': { 6:240, 7:290 },
  '2.8-127 pitch o-bearing': { 4:445, 6:130, 8:130, 9:185 },
  'wt20 pitch o-bearing': { 6:150, 8:130, 9:130 },
  'sierra n1 pitch bearing': { 4:530, 6:240, 7:290 },
  'cypress pitch bearing': { 6:290, 7:240 },
  'wt19 cypress pitch bearing': { 6:290, 7:240 },
  '2.x yaw bearing': { 6:130, 7:180 },
  'sierra n1 yaw bearing': { 4:530, 6:240, 7:290 },
  'cypress yaw bearing': { 6:240, 7:290 },
  '4mw yaw ring': { 5:390 }, '15mw yaw ring': { 5:625 }, 'rotor lock disc': { 5:480 },
  'sg129 my20 yaw ring': { 5:300 }, '14mw yaw ring': { 5:390 }, 'sg8.0-167 yaw ring': { 5:270 },
};
const DISPLAY_NAME = {
  'v172 blade bearing':'V172 Blade Bearing','v163 blade bearing':'V163 Blade Bearing','ep3 pitch':'EP3 Pitch','ep5 yaw':'EP5 Yaw',
  '2.8-127 pitch o-bearing':'2.8-127 Pitch O-Bearing','15mw yaw ring':'15MW Yaw Ring','14mw yaw ring':'14MW Yaw Ring','4mw yaw ring':'4MW Yaw Ring',
  'sg129 my20 yaw ring':'SG129 MY20 Yaw Ring','sg8.0-167 yaw ring':'SG8.0-167 Yaw Ring','2.x yaw bearing':'2.x Yaw Bearing',
  '1.x-97 pitch bearing':'1.x-97 Pitch Bearing','1.x-91 pitch bearing':'1.x-91 Pitch Bearing','1.5 pitch bearing':'1.5 Pitch Bearing',
  '2.5-116 pitch bearing':'2.5-116 Pitch Bearing','3.x-103 pitch bearing':'3.x-103 Pitch Bearing','3.x-130 pitch o-bearing':'3.x-130 Pitch O-Bearing',
  'wt20 pitch o-bearing':'WT20 Pitch O-Bearing','sierra n1 pitch bearing':'Sierra N1 Pitch Bearing','sierra n1 yaw bearing':'Sierra N1 Yaw Bearing',
  'cypress pitch bearing':'Cypress Pitch Bearing','wt19 cypress pitch bearing':'WT19 Cypress Pitch Bearing','cypress yaw bearing':'Cypress Yaw Bearing',
  'rotor lock disc':'Rotor Lock Disc','1.6 hybrid glass pitch bearing':'1.6 Hybrid Glass Pitch Bearing','1.6 hybrid carbon pitch bearing':'1.6 Hybrid Carbon Pitch Bearing',
};
const normPart = (n) => String(n || '').trim().toLowerCase();
const getDisplayName = (raw) => DISPLAY_NAME[normPart(raw)] || String(raw).trim();

function rowDateStr(v) {
  let d;
  if (typeof v === 'number') d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  else if (typeof v === 'string') d = new Date(v);
  else return null;
  if (isNaN(d)) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// rows = sheet_to_json(header:1). Trả tổng hợp CMM cho ngày dateStr (YYYY-MM-DD).
export function aggregateCmmDaily(rows, dateStr) {
  const header = rows[0] || [];
  let reCheckCol = -1;
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i] || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (h.includes('re-check') || h.includes('re check') || h.includes('recheck')) { reCheckCol = i; break; }
  }
  const byPart = {};
  let totalMin = 0, count = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    if (rowDateStr(r[0]) !== dateStr) continue;
    const rawPart = r[3]; if (!rawPart) continue;
    if (r[5] == null || r[5] === '') continue;
    const isITR = String(r[1] || '').trim().toUpperCase() === 'ITR';
    const col = STEP_TO_COL[String(r[4] || '').trim().toLowerCase()];
    const stepStd = PART_COL_STD[normPart(rawPart)];
    const baseStd = (col !== undefined && stepStd && stepStd[col]) ? stepStd[col] : 0;
    const rc = reCheckCol >= 0 ? Number(r[reCheckCol]) : NaN;
    const reCheck = Number.isFinite(rc) && rc > 0 ? rc : 0;
    let rowMin;
    if (isITR) { if (reCheck <= 0) continue; rowMin = reCheck; }
    else { if (baseStd <= 0) continue; rowMin = baseStd + reCheck; }
    const part = getDisplayName(rawPart);
    byPart[part] = (byPart[part] || 0) + rowMin;
    totalMin += rowMin; count += 1;
  }
  const parts = Object.entries(byPart)
    .map(([part, m]) => ({ part, hours: Math.round(m / 60 * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours);
  return { hours: Math.round(totalMin / 60 * 10) / 10, count, parts };
}
