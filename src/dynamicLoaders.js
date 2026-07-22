/**
 * Dynamic loaders for Google Sheets data sources.
 * Each function fetches an XLSX export and returns data in the same format
 * as the static JS fallback files, so components can use them interchangeably.
 *
 * Sheet IDs (must be shared "Anyone with link → Viewer"):
 *   1. Mass Product, Test Inspection : 1M0cBUpk77DWW3gAaXe9WnNMW6YPPVy1d
 *     └─ sheet "CMM Daily"           → CMM Daily Inspection data
 *     └─ sheet "4. ITR & Shipment"   → ITR data
 *   Combined ST Auto MT and CMM      : 1R_eoCseRbx4VBdJ81O_-BHcWurswP_p8
 *   PO Forecast 2026 Clean           : 1-L2ms12iaI3Ds95ap1URFuQ3O41FFqby
 */

import * as XLSX from 'xlsx';
import { cmmStdTimeData2026 } from './cmmStdTimeData2026';
import { getAccessToken } from './cmmSupabase';

// ─── Sheet IDs ───────────────────────────────────────────────────────────────
const MASS_PRODUCT_ID     = '1M0cBUpk77DWW3gAaXe9WnNMW6YPPVy1d'; // 1. Mass Product, Test Inspection
const COMBINED_ST_ID      = '1R_eoCseRbx4VBdJ81O_-BHcWurswP_p8'; // Combined standard time Auto MT and CMM
const PO_FORECAST_ID      = '1-L2ms12iaI3Ds95ap1URFuQ3O41FFqby'; // PO_Forecast_2026_Clean

async function fetchXlsx(id) {
  // Route through /api/sheets proxy to avoid CORS when fetching from browser
  const url = '/api/sheets?id=' + id;
  // Gửi kèm token phiên Supabase (server kiểm tra quyền dashboard 'cmm').
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' fetching sheet ' + id);
  const buf = await res.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

// ISO week → 'FW01' … 'FW53'
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `FW${String(wk).padStart(2, '0')}`;
}

// ─── CMM Standard Times (min) per step per part ──────────────────────────────
// Sheet1 of CMM Daily Inspection:
//   col4=ITR-step, col5=Single Ring, col6=Outer, col7=Inner,
//   col8=Inner 1,  col9=Inner 2,    col10=Inner Assembly,
//   col11=Outer Radial+Gap,         col12=Assembly
//
// Rule: a ring SN in that cell means that step was performed.
// itr=null means no ITR measurement step for that part → skip col4.
const STEP_STD = {
  // col  → [partNameLower → minutes] or falsy = skip
  // Defined per-column for fast lookup
};

// Part → step times (0-based column index)
const PART_COL_STD = {
  'v172 blade bearing': { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  'v163 blade bearing': { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  'ep3 pitch':          { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  'ep5 yaw':            { 6:180, 8:250, 9:240, 10:45, 11:45, 12:120 },
  '1.6 hybrid glass pitch bearing':  { 6:180, 7:130 },
  '1.6 hybrid carbon pitch bearing': { 6:180, 7:130 },
  '1.5 pitch bearing':        { 6:180, 7:130 },
  '1.x-91 pitch bearing':     { 6:180, 7:130 },
  '1.x-97 pitch bearing':     { 6:230, 7:230 },
  '2.5-116 pitch bearing':    { 6:180, 7:140 },
  '3.x-103 pitch bearing':    { 6:240, 7:290 },
  '3.x-130 pitch o-bearing':  { 6:240, 7:290 },
  '2.8-127 pitch o-bearing':  { 4:445, 6:130, 8:130, 9:185 },
  'wt20 pitch o-bearing':     { 6:150, 8:130, 9:130 },
  'sierra n1 pitch bearing':  { 4:530, 6:240, 7:290 },
  'cypress pitch bearing':    { 6:290, 7:240 },
  'wt19 cypress pitch bearing': { 6:290, 7:240 },
  '2.x yaw bearing':          { 6:130, 7:180 },
  'sierra n1 yaw bearing':    { 4:530, 6:240, 7:290 },
  'cypress yaw bearing':      { 6:240, 7:290 },
  '4mw yaw ring':        { 5:390 },
  '15mw yaw ring':       { 5:625 },
  'rotor lock disc':     { 5:480 },
  'sg129 my20 yaw ring': { 5:300 },
  '14mw yaw ring':       { 5:390 },
  'sg8.0-167 yaw ring':  { 5:270 },
};

// Normalize part name: trim + lowercase (for lookup)
function normPart(name) {
  return String(name || '').trim().toLowerCase();
}

// Canonical display name (Title Case from our known set)
const CANON_NAME = {};
Object.keys(PART_COL_STD).forEach(k => {
  // Build a lookup from lowercase → title case equivalent
  CANON_NAME[k] = k.replace(/\b\w/g, c => c.toUpperCase());
});
// Override with exact display names used in the rest of the app
const DISPLAY_NAME = {
  'v172 blade bearing':   'V172 Blade Bearing',
  'v163 blade bearing':   'V163 Blade Bearing',
  'ep3 pitch':            'EP3 Pitch',
  'ep5 yaw':              'EP5 Yaw',
  '2.8-127 pitch o-bearing': '2.8-127 Pitch O-Bearing',
  '15mw yaw ring':        '15MW Yaw Ring',
  '14mw yaw ring':        '14MW Yaw Ring',
  '4mw yaw ring':         '4MW Yaw Ring',
  'sg129 my20 yaw ring':  'SG129 MY20 Yaw Ring',
  'sg8.0-167 yaw ring':   'SG8.0-167 Yaw Ring',
  '2.x yaw bearing':      '2.x Yaw Bearing',
  '1.x-97 pitch bearing': '1.x-97 Pitch Bearing',
  '1.x-91 pitch bearing': '1.x-91 Pitch Bearing',
  '1.5 pitch bearing':    '1.5 Pitch Bearing',
  '2.5-116 pitch bearing':'2.5-116 Pitch Bearing',
  '3.x-103 pitch bearing':'3.x-103 Pitch Bearing',
  '3.x-130 pitch o-bearing':'3.x-130 Pitch O-Bearing',
  'wt20 pitch o-bearing': 'WT20 Pitch O-Bearing',
  'sierra n1 pitch bearing':'Sierra N1 Pitch Bearing',
  'sierra n1 yaw bearing': 'Sierra N1 Yaw Bearing',
  'cypress pitch bearing':       'Cypress Pitch Bearing',
  'wt19 cypress pitch bearing': 'WT19 Cypress Pitch Bearing',
  'cypress yaw bearing':   'Cypress Yaw Bearing',
  'rotor lock disc':       'Rotor Lock Disc',
  '1.6 hybrid glass pitch bearing':  '1.6 Hybrid Glass Pitch Bearing',
  '1.6 hybrid carbon pitch bearing': '1.6 Hybrid Carbon Pitch Bearing',
};

function getDisplayName(raw) {
  const k = normPart(raw);
  return DISPLAY_NAME[k] || String(raw).trim();
}

// ─── Load CMM Weekly Data from "CMM Daily" sheet ─────────────────────────────
// New format (1. Mass Product file): one row per step
//   col0=Date, col1=Type, col2=DueDate, col3=PartName, col4=StepName, col5=RingSN
// StepName → old col index for PART_COL_STD lookup:
const STEP_TO_COL = {
  'itr': 4, 'single ring': 5, 'single': 5,
  'outer': 6,
  'inner': 7,
  'inner 1': 8, 'inner1': 8,
  'inner 2': 9, 'inner2': 9,
  'inner assembly': 10, 'innerassembly': 10, 'inner asm': 10,
  'outer radial+gap': 11, 'outer radial gap': 11, 'outer radial + gap': 11, 'outerrgap': 11,
  'assembly': 12,
};

// Nhãn hiển thị cho từng cột bước đo (dùng cho breakdown theo model)
const COL_LABEL = {
  4: 'ITR', 5: 'Single Ring', 6: 'Outer', 7: 'Inner',
  8: 'Inner 1', 9: 'Inner 2', 10: 'Inner Assembly',
  11: 'Outer Radial + Gap', 12: 'Assembly',
};

export async function loadCmmWeeklyData() {
  const wb = await fetchXlsx(MASS_PRODUCT_ID);
  // Sheet 'CMM Daily' in 1. Mass Product, Test Inspection
  const ws = wb.Sheets['CMM Daily'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const CAPACITY = 154;
  const weekMap = {};
  const weekDayMap = {}; // fw → { 'YYYY-MM-DD': { min, count, reCheck, itr } }
  let maxDate = null; // ngày cuối cùng ở cột A "CMM Date"

  // Tìm cột "Re-Check Time" theo TÊN TIÊU ĐỀ (không cố định vị trí) — nằm ở đâu cũng bắt đúng.
  const header0 = rows[0] || [];
  let reCheckCol = -1;
  for (let i = 0; i < header0.length; i++) {
    const h = String(header0[i] || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (h.includes('re-check') || h.includes('re check') || h.includes('recheck')) { reCheckCol = i; break; }
  }

  // Standard time ĐỘNG từ 'Combined ST' (cập nhật file nguồn là đổi theo). Fallback bảng cứng nếu thiếu.
  let dynStd = {};
  try {
    const tbl = await loadCmmStdTable();
    if (tbl && tbl.length) {
      tbl.forEach(r => {
        const k = normPart(r.part); if (!k) return;
        const m = {};
        const put = (c, v) => { const n = Number(v); if (n > 0) m[c] = n; };
        put(4, r.itr); put(5, r.singleRing); put(6, r.outer); put(7, r.inner);
        put(8, r.inner1); put(9, r.inner2); put(10, r.innerAsm); put(11, r.outerRGap); put(12, r.assembly);
        if (Object.keys(m).length) dynStd[k] = m;
      });
    }
  } catch (e) { /* Combined ST lỗi → dùng bảng cứng */ }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // col0 = Date
    let date = row[0];
    if (typeof date === 'number') {
      date = new Date(Date.UTC(1899, 11, 30) + date * 86400000);
    } else if (typeof date === 'string') {
      date = new Date(date);
    }
    if (!(date instanceof Date) || isNaN(date)) continue;
    if (date.getFullYear() !== 2026) continue;
    if (!maxDate || date > maxDate) maxDate = date; // theo dõi ngày lớn nhất

    // col3 = Part Name, col4 = Step name, col5 = Ring SN
    const rawPart = row[3];
    if (!rawPart) continue;

    const ringSN = row[5];
    if (ringSN == null || ringSN === '') continue; // no SN = step not done

    // Cột B "Shipment & 1/30 & ITR": nếu là "ITR" → thời gian linh động (Inspection & Test Request)
    const shipType = String(row[1] || '').trim().toUpperCase();
    const isITR = shipType === 'ITR';

    const stepName = String(row[4] || '').trim().toLowerCase();
    const col = STEP_TO_COL[stepName];
    const key = normPart(rawPart);
    const stepStd = dynStd[key];   // BẮT BUỘC lấy std từ Combined ST (không dùng bảng cứng)
    const baseStd = (col !== undefined && stepStd && stepStd[col]) ? stepStd[col] : 0;

    // "Re-Check Time" (cột tìm theo tên tiêu đề)
    const rcRaw = reCheckCol >= 0 ? Number(row[reCheckCol]) : NaN;
    const reCheck = Number.isFinite(rcRaw) && rcRaw > 0 ? rcRaw : 0;

    let rowMin, stepLabel;
    if (isITR) {
      // ITR: KHÔNG dùng standard time, thời gian = Re-Check Time (linh động)
      if (reCheck <= 0) continue;                 // ITR không ghi giờ → bỏ
      rowMin = reCheck;
      const modelTxt = (col !== undefined && COL_LABEL[col]) ? COL_LABEL[col] : String(row[4] || '').trim();
      stepLabel = 'ITR' + (modelTxt ? ' - ' + modelTxt : '');
    } else {
      if (baseStd <= 0) continue;                 // không map được standard time → bỏ
      rowMin = baseStd + reCheck;                 // std + re-check
      stepLabel = COL_LABEL[col] || stepName;
    }

    const fw = isoWeek(date);
    const displayPart = getDisplayName(rawPart);

    // Gom theo NGÀY trong tuần (dùng cho drill-down từng ngày)
    const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!weekDayMap[fw]) weekDayMap[fw] = {};
    if (!weekDayMap[fw][dStr]) weekDayMap[fw][dStr] = { min: 0, count: 0, reCheck: 0, itr: 0, parts: {} };
    const dayB = weekDayMap[fw][dStr];
    dayB.min += rowMin; dayB.count += 1;
    if (isITR) dayB.itr += rowMin; else dayB.reCheck += reCheck;
    if (!dayB.parts[displayPart]) dayB.parts[displayPart] = { min: 0, count: 0, reCheck: 0, itr: 0, steps: {} };
    const dp = dayB.parts[displayPart];
    dp.min += rowMin; dp.count += 1;
    if (isITR) dp.itr += rowMin; else dp.reCheck += reCheck;
    if (!dp.steps[stepLabel]) dp.steps[stepLabel] = { count: 0, min: 0, reCheck: 0, itr: false };
    const dps = dp.steps[stepLabel];
    dps.count += 1; dps.min += rowMin;
    if (isITR) dps.itr = true; else dps.reCheck += reCheck;

    if (!weekMap[fw]) weekMap[fw] = {};
    if (!weekMap[fw][displayPart]) weekMap[fw][displayPart] = { min: 0, count: 0, reCheck: 0, itr: 0, steps: {} };
    const bucket = weekMap[fw][displayPart];
    bucket.min += rowMin;
    bucket.count += 1;
    if (isITR) bucket.itr += rowMin; else bucket.reCheck += reCheck;
    if (!bucket.steps[stepLabel]) bucket.steps[stepLabel] = { count: 0, min: 0, reCheck: 0, itr: false };
    const st = bucket.steps[stepLabel];
    st.count += 1;
    st.min += rowMin;
    if (isITR) st.itr = true; else st.reCheck += reCheck;
  }

  // Build weeklySummary entries for actual weeks (source = 'CMM Daily Inspection')
  const actualEntries = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, byPartMap]) => {
      const byPart = Object.entries(byPartMap)
        .filter(([, v]) => v.min > 0)
        .sort(([, a], [, b]) => b.min - a.min)
        .map(([part, v]) => ({
          part,
          sets: v.count,   // số ring/bước đã đo thực tế trong tuần
          hours: Math.round(v.min / 60 * 10) / 10,   // gồm cả re-check / ITR
          reCheckMin: Math.round(v.reCheck || 0),    // tổng phút re-check thêm
          itrMin: Math.round(v.itr || 0),            // tổng phút ITR (linh động)
          std_min: null,
          byStep: Object.entries(v.steps || {})
            .sort(([, a], [, b]) => b.min - a.min)
            .map(([step, s]) => ({ step, count: s.count, hours: Math.round(s.min / 60 * 10) / 10, reCheckMin: Math.round(s.reCheck || 0), itr: !!s.itr })),
        }));
      const totalHours = Math.round(byPart.reduce((s, p) => s + p.hours, 0) * 10) / 10;
      const totalSets  = byPart.reduce((s, p) => s + p.sets, 0);
      const byDay = Object.entries(weekDayMap[week] || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          hours: Math.round(v.min / 60 * 10) / 10,
          sets: v.count,
          reCheckMin: Math.round(v.reCheck || 0),
          itrMin: Math.round(v.itr || 0),
          parts: Object.entries(v.parts || {})
            .sort(([, a], [, b]) => b.min - a.min)
            .map(([part, pv]) => ({
              part,
              hours: Math.round(pv.min / 60 * 10) / 10,
              sets: pv.count,
              reCheckMin: Math.round(pv.reCheck || 0),
              itrMin: Math.round(pv.itr || 0),
              byStep: Object.entries(pv.steps || {})
                .sort(([, a], [, b]) => b.min - a.min)
                .map(([step, s]) => ({ step, count: s.count, hours: Math.round(s.min / 60 * 10) / 10, reCheckMin: Math.round(s.reCheck || 0), itr: !!s.itr })),
            })),
        }));
      return {
        week,
        totalHours,
        totalSets,
        capacity: CAPACITY,
        utilization: Math.round(totalHours / CAPACITY * 1000) / 10,
        overload: totalHours > CAPACITY,
        source: 'CMM Daily Inspection',
        byPart,
        byDay,
      };
    });

  // Static FW01–FW20 (Mass Product forecast) from local file
  const staticMass = (cmmStdTimeData2026.weeklySummary || [])
    .filter(w => w.source === 'Mass Product');

  const allWeeks = [...staticMass, ...actualEntries];
  const grandTotalHours = Math.round(
    allWeeks.reduce((s, w) => s + w.totalHours, 0) * 10,
  ) / 10;
  const totalSets    = allWeeks.reduce((s, w) => s + w.totalSets, 0);
  const overloadWeeks = allWeeks.filter(w => w.overload).map(w => w.week);
  const lastFW = actualEntries.length
    ? actualEntries[actualEntries.length - 1].week
    : (staticMass.length ? staticMass[staticMass.length - 1].week : 'FW01');

  const today = new Date().toLocaleDateString('vi-VN');
  return {
    capacityWeek: CAPACITY,
    weeklySummary: allWeeks,
    overloadWeeks,
    grandTotalHours,
    totalSets,
    fwRange: `FW01–${lastFW}`,
    year: 2026,
    dataDate: maxDate
      ? `${String(maxDate.getDate()).padStart(2, '0')}/${String(maxDate.getMonth() + 1).padStart(2, '0')}/${maxDate.getFullYear()}`
      : null,
    lastSynced: `Google Sheets · 1. Mass Product (CMM Daily) · ${today} · đến FW${lastFW.replace('FW','')}`,
  };
}

// ─── Load CMM Standard Time Table from Combined Standard Time ────────────────
// Combined ST sheet, row 3 = col headers, rows 4+ = data
// CMM cols (0-based): 9=Outer,10=ITR,11=SingleRing,12=Inner,13=Inner1,
//                     14=Inner2,15=InnerAsm,16=OuterRGap,17=Assembly,18=CMM Total
export async function loadCmmStdTable() {
  const wb = await fetchXlsx(COMBINED_ST_ID);
  const ws = wb.Sheets['Combined ST'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const result = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0] || !r[1]) continue;
    const customer = String(r[0]).trim();
    const part     = String(r[1]).trim();
    if (!customer || !part) continue;

    result.push({
      customer,
      part,
      outer:     r[9]  ?? null,
      itr:       r[10] ?? null,
      singleRing:r[11] ?? null,
      inner:     r[12] ?? null,
      inner1:    r[13] ?? null,
      inner2:    r[14] ?? null,
      innerAsm:  r[15] ?? null,
      outerRGap: r[16] ?? null,
      assembly:  r[17] ?? null,
      total:     r[18] ?? null,
      highlight: part.toLowerCase().includes('v172') ? 'rose' : undefined,
    });
  }
  return result.length ? result : null; // null = use static fallback
}

// ─── Load PO Capacity Data from PO Forecast 2026 ─────────────────────────────
// Sheet 'PO + Forecast 2026':
//   row 1 = title, row 2 = month headers (col4=JAN…), row 3 = week labels (W1…W53)
//   rows 4+ = data (col0=Sr,col1=Customer,col2=Model,col3=PartNo,col4-col56=weekly sets)

const TIERED_DEFS = {
  'V172 Blade Bearing': { threshold: 30, stdFull: 880, stdReduced: 440 },
};

// Part name → CMM std time (min/set)  — used when loading PO sheet
const PO_PART_STD = {
  '1.6 Hybrid Glass Pitch Bearing':   310,
  '1.6 Hybrid Carbon Pitch Bearing':  310,
  '1.5 Pitch Bearing':                310,
  '1.x-97 Pitch Bearing':             460,
  '1.x-91 Pitch Bearing':             310,
  '2.5-116 Pitch Bearing':            320,
  '3.x-103 Pitch Bearing':            530,
  '2.8-127 Pitch O-Bearing':          445,
  '3.x-130 Pitch O-Bearing':          530,
  'WT20 Pitch O-Bearing':             410,
  'Sierra N1 Pitch Bearing':          530,
  'Cypress Pitch Bearing':            530,
  '2.x Yaw Bearing':                  310,
  'Sierra N1 Yaw Bearing':            530,
  'Cypress Yaw Bearing':              530,
  'V172 Blade Bearing':               880,
  'V163 Blade Bearing':               670,
  '4MW Yaw Ring':                     390,
  '15MW Yaw Ring':                    625,
  'Rotor Lock Disc':                  480,
  'SG129 MY20 Yaw Ring':              300,
  '14MW Yaw Ring':                    390,
  'SG8.0-167 Yaw Ring':               270,
  'EP3 Pitch':                        880,
  'EP5 Yaw':                          880,
};

export async function loadPoCapacityData() {
  const wb = await fetchXlsx(PO_FORECAST_ID);
  const ws = wb.Sheets['PO + Forecast 2026'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Row 2 (index 1) has month labels; row 3 (index 2) has W1-W53 labels
  // Data starts at row 4 (index 3), sets at cols 4-56 (W1-W53)
  const parts = [];

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const customer = r[1];
    const model    = r[2];
    if (!customer || !model || typeof customer !== 'string' || typeof model !== 'string') continue;
    if (model.trim() === 'Model') continue;

    const modelTrim  = model.trim();
    const custTrim   = customer.trim();
    const std        = PO_PART_STD[modelTrim] || 0;
    const sampling   = custTrim.toUpperCase() === 'GEV' ? 30 : 1;

    const sets = [];
    for (let w = 0; w < 53; w++) {
      const v = r[4 + w];
      sets.push(typeof v === 'number' ? v : 0);
    }

    parts.push({ model: modelTrim, customer: custTrim, std, sampling, sets });
  }

  if (!parts.length) return null; // use static fallback

  return {
    capWeek:  154,
    capMonth: 660,
    months: [
      ['JAN', 0, 4], ['FEB', 5, 8],  ['MAR', 9, 12],  ['APR', 13, 17],
      ['MAY', 18, 21],['JUN', 22, 25],['JUL', 26, 30], ['AUG', 31, 34],
      ['SEP', 35, 38],['OCT', 39, 43],['NOV', 44, 47], ['DEC', 48, 52],
    ],
    tiered: TIERED_DEFS,
    parts,
  };
}
