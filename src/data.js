import * as XLSX from 'xlsx';
import { dataUrl, SHEET_NAME, GSHEET_ID, USE_SAMPLE_FALLBACK } from './config';
import { sampleData } from './sampleData';

// ---- Date helpers --------------------------------------------------
// Excel lưu ngày dạng serial number (số ngày kể từ 1899-12-30).
// File gốc có cột Due Date trộn lẫn serial number và text ("W25").
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  // ISO string từ sample data
  if (typeof v === 'string') {
    const iso = /^\d{4}-\d{2}-\d{2}/.test(v);
    if (iso) {
      const d = new Date(v + (v.length === 10 ? 'T00:00:00' : ''));
      return isNaN(d) ? null : d;
    }
    // số dạng chuỗi -> serial
    const n = Number(v);
    if (Number.isFinite(n) && n > 20000 && n < 80000) {
      return new Date(EXCEL_EPOCH + n * 86400000);
    }
    return null; // text như "W25" không phải ngày
  }
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return new Date(EXCEL_EPOCH + v * 86400000);
    return null;
  }
  return null;
}

export function fmtDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function daysUntil(d, ref = new Date()) {
  if (!d) return null;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((a - b) / 86400000);
}

// ---- Normalization -------------------------------------------------
const num = (v) => {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function normalize(rows) {
  return rows
    .filter((r) => r && (r['Part Name'] || r['Category']))
    .map((r, i) => {
      const target = num(r['Qty Target']);
      const completed = num(r['Completed']);
      const balance = r['Balance'] != null ? num(r['Balance']) : Math.max(target - completed, 0);
      const progress =
        r['Progress %'] != null && r['Progress %'] !== ''
          ? num(r['Progress %'])
          : target > 0
          ? completed / target
          : 0;
      const dueDate = parseDate(r['Due Date']);
      const status = (r['Status'] || '').toString().trim() || 'Open';
      return {
        id: i,
        category: (r['Category'] || '—').toString().trim(),
        refNo: r['Ref No'] || null,
        dueDate,
        dueRaw: r['Due Date'] ?? null,
        planDate: parseDate(r['Plan Date']),
        actualDate: parseDate(r['Actual Date']),
        partName: (r['Part Name'] || '—').toString().trim(),
        target,
        stock: num(r['Stock']),
        completed,
        ringSN: r['Ring SN'] || null,
        features: r['CMM Features'] || null,
        comment: r['Comment'] || null,
        status,
        balance,
        progress: progress > 1 ? progress / 100 : progress, // chuẩn hoá 0..1
      };
    });
}

// ---- Metrics -------------------------------------------------------
export function computeMetrics(items) {
  const totTarget = items.reduce((s, x) => s + x.target, 0);
  const totCompleted = items.reduce((s, x) => s + x.completed, 0);
  const totBalance = items.reduce((s, x) => s + x.balance, 0);
  const completedJobs = items.filter((x) => x.status.toLowerCase() === 'completed').length;
  const openJobs = items.filter((x) => x.status.toLowerCase() !== 'completed').length;

  const overdue = items.filter((x) => {
    const d = daysUntil(x.dueDate);
    return d != null && d < 0 && x.status.toLowerCase() !== 'completed';
  });
  const dueSoon = items.filter((x) => {
    const d = daysUntil(x.dueDate);
    return d != null && d >= 0 && d <= 7 && x.status.toLowerCase() !== 'completed';
  });

  return {
    totalJobs: items.length,
    completedJobs,
    openJobs,
    totTarget,
    totCompleted,
    totBalance,
    overallProgress: totTarget > 0 ? totCompleted / totTarget : 0,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    overdue,
    dueSoon,
  };
}

export function groupBy(items, key) {
  const m = new Map();
  for (const it of items) {
    const k = it[key] || '—';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

// ---- Loading -------------------------------------------------------
export async function loadData() {
  const configured =
    GSHEET_ID && GSHEET_ID !== 'PASTE_YOUR_SHEET_ID_HERE';

  if (!configured || USE_SAMPLE_FALLBACK) {
    return { items: normalize(sampleData), source: 'sample' };
  }

  try {
    const res = await fetch(dataUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (!rows.length) throw new Error('Sheet rỗng');
    return { items: normalize(rows), source: 'sheets' };
  } catch (e) {
    // Fetch Google Sheets thất bại (thường do CORS hoặc quyền share).
    // Rơi về dữ liệu mẫu để dashboard vẫn hiển thị, kèm cảnh báo.
    return {
      items: normalize(sampleData),
      source: 'sample',
      warning: `Không đọc được Google Sheets (${e.message}). Đang hiển thị dữ liệu mẫu — xem mục CORS trong README.`,
    };
  }
}
