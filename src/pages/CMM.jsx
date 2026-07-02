import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, RefreshCw, Search, AlertTriangle,
  CheckCircle2, Package, Layers, ChevronRight, Ruler, MessageSquare,
  Clock, BarChart2, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, ComposedChart, ReferenceLine, Line, LabelList,
} from 'recharts';
import {
  loadData, computeMetrics, groupBy, fmtDate, daysUntil,
} from '../data';
import { cmmStdTimeData2026 } from '../cmmStdTimeData2026';
import { poCapacityData } from '../poCapacityData';
import { loadCmmWeeklyData, loadPoCapacityData, loadCmmStdTable } from '../dynamicLoaders';
import { useLang } from '../LangContext.jsx';
import '../dashboard.css';

const CAT_COLORS = { Shipment: 'var(--azure)', ITR: 'var(--violet)', default: 'var(--signal)' };
const catColor = (c) => CAT_COLORS[c] || CAT_COLORS.default;
const pct = (x) => `${Math.round(x * 100)}%`;

function SectionHead({ eyebrow, title }) {
  return (
    <div className="section-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <span className="rule" />
    </div>
  );
}

function CollapsibleSection({ eyebrow, title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const { t } = useLang();
  return (
    <div>
      <div className="section-head" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <span className="rule" />
        <button
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
          style={{
            marginLeft: 10, flexShrink: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--txt-mid)', borderRadius: 6, padding: '3px 10px',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex',
            alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          }}
        >
          {open ? t('btn.collapse') : t('btn.expand')}
        </button>
      </div>
      {open && children}
    </div>
  );
}

function ProgressRing({ value, size = 84, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grid-line)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--signal)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)' }} />
    </svg>
  );
}

function DueList({ rows, accent }) {
  const catColorOf = (c) => (c === 'Shipment' ? 'var(--azure)' : c === 'ITR' ? 'var(--violet)' : 'var(--signal)');
  return (
    <div className="due-list">
      {rows.slice().sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0)).map((r) => {
        const du = daysUntil(r.dueDate);
        return (
          <div className="due-row" key={r.id} style={{ '--accent': accent }}>
            <div className="d-when" style={{ color: accent }}>
              {Math.abs(du)}<small>{du < 0 ? 'NGAY TRE' : 'NGAY NUA'}</small>
            </div>
            <div className="d-body">
              <div className="d-name">
                <span className={`cat-tag cat-${r.category}`} style={{ marginRight: 8, color: catColorOf(r.category), borderColor: catColorOf(r.category) }}>
                  {r.category}
                </span>
                {r.partName}
              </div>
              <div className="d-meta">{fmtDate(r.dueDate)} · con {r.balance}/{r.target} · {r.status}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PART_COLORS = [
  'var(--azure)', 'var(--signal)', 'var(--violet)', 'var(--amber)',
  '#06b6d4', '#10b981', '#f43f5e', '#8b5cf6', '#f97316', '#64748b', '#84cc16',
];

function UtilBar({ pct: p }) {
  const over = p > 100;
  const color = over ? 'var(--rose)' : p > 80 ? 'var(--amber)' : 'var(--signal)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--grid-line)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span className="mono" style={{ fontSize: 11, color, minWidth: 42, textAlign: 'right', fontWeight: over ? 700 : 400 }}>
        {p}%{over ? ' !' : ''}
      </span>
    </div>
  );
}

const CMM_STD_TABLE = [
  { customer:'GEV',    part:'1.6 Hybrid Glass Pitch Bearing',  outer:180, itr:null, singleRing:null, inner:130, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:310 },
  { customer:'GEV',    part:'1.6 Hybrid Carbon Pitch Bearing', outer:180, itr:null, singleRing:null, inner:130, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:310 },
  { customer:'GEV',    part:'1.5 Pitch Bearing',               outer:180, itr:null, singleRing:null, inner:130, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:310 },
  { customer:'GEV',    part:'1.x-97 Pitch Bearing',            outer:230, itr:null, singleRing:null, inner:230, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:460 },
  { customer:'GEV',    part:'2.5-116 Pitch Bearing',           outer:180, itr:null, singleRing:null, inner:140, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:320 },
  { customer:'GEV',    part:'2.8-127 Pitch O-Bearing',         outer:130, itr:null, singleRing:null, inner:null, inner1:130, inner2:185, innerAsm:null, outerRGap:null, assembly:null, total:445 },
  { customer:'GEV',    part:'WT20 Pitch O-Bearing',            outer:150, itr:null, singleRing:null, inner:null, inner1:130, inner2:130, innerAsm:null, outerRGap:null, assembly:null, total:410 },
  { customer:'GEV',    part:'Sierra N1 Pitch Bearing',         outer:240, itr:null, singleRing:null, inner:290, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:530 },
  { customer:'GEV',    part:'Cypress Pitch Bearing',           outer:290, itr:null, singleRing:null, inner:240, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:530 },
  { customer:'GEV',    part:'2.x Yaw Bearing',                 outer:130, itr:null, singleRing:null, inner:180, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:310 },
  { customer:'GEV',    part:'Sierra N1 Yaw Bearing',           outer:240, itr:null, singleRing:null, inner:290, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:530 },
  { customer:'GEV',    part:'Cypress Yaw Bearing',             outer:240, itr:null, singleRing:null, inner:290, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:530 },
  { customer:'Vestas', part:'4MW Yaw Ring',                    outer:null, itr:null, singleRing:390,  inner:null, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:390 },
  { customer:'Vestas', part:'15MW Yaw Ring',                   outer:null, itr:null, singleRing:625,  inner:null, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:625 },
  { customer:'Vestas', part:'Rotor Lock Disc',                 outer:null, itr:null, singleRing:480,  inner:null, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:480 },
  { customer:'SGRE',   part:'SG129 MY20 Yaw Ring',             outer:null, itr:null, singleRing:300,  inner:null, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:300 },
  { customer:'SGRE',   part:'14MW Yaw Ring',                   outer:null, itr:null, singleRing:390,  inner:null, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:390 },
  { customer:'GEV',    part:'3.x-103 Pitch Bearing',           outer:240, itr:null, singleRing:null, inner:290, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:530 },
  { customer:'GEV',    part:'3.x-130 Pitch O-Bearing',         outer:240, itr:null, singleRing:null, inner:290, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:530 },
  { customer:'VESTAS', part:'V163 Blade Bearing',              outer:180, itr:null, singleRing:null, inner:null, inner1:250, inner2:240, innerAsm:null, outerRGap:null, assembly:null, total:670 },
  { customer:'GEV',    part:'1.x-91 Pitch Bearing',            outer:180, itr:null, singleRing:null, inner:130, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:310 },
  { customer:'SGRE',   part:'SG8.0-167 Yaw Ring',              outer:null, itr:null, singleRing:270,  inner:null, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:270 },
  { customer:'Vestas', part:'V172 Blade Bearing',              outer:180, itr:null, singleRing:null, inner:null, inner1:250, inner2:240, innerAsm:45,   outerRGap:45,   assembly:120,  total:880, highlight:'rose' },
  { customer:'ENERCON',part:'EP3 Pitch',                       outer:180, itr:null, singleRing:null, inner:null, inner1:250, inner2:240, innerAsm:45,   outerRGap:45,   assembly:120,  total:670 },
  { customer:'ENERCON',part:'EP5 Yaw',                         outer:180, itr:null, singleRing:null, inner:null, inner1:250, inner2:240, innerAsm:45,   outerRGap:45,   assembly:120,  total:670 },
  { customer:'ITR',    part:'ITR',                             outer:null, itr:120,  singleRing:null, inner:null, inner1:null, inner2:null, innerAsm:null, outerRGap:null, assembly:null, total:120 },
];

function StdTimeSection({ avail = 95 }) {
  const [show2026Chart, setShow2026Chart] = useState(true);
  const [show2026Table, setShow2026Table] = useState(false);
  const [selected2026FW, setSelected2026FW] = useState(null);
  const [showStdRef, setShowStdRef] = useState(false);
  const [liveWeeklyData, setLiveWeeklyData] = useState(null);
  const [liveStdTable, setLiveStdTable] = useState(null);
  const { t } = useLang();
  const effectiveCapStd = Math.round(CAP_WEEK_BASE * avail / 100 * 10) / 10;

  useEffect(() => {
    loadCmmWeeklyData().then(setLiveWeeklyData).catch(() => {});
    loadCmmStdTable().then(d => { if (d) setLiveStdTable(d); }).catch(() => {});
  }, []);

  const data2026 = liveWeeklyData || cmmStdTimeData2026;
  // Recompute utilization relative to effectiveCapStd (avail-adjusted capacity)
  const chartData2026 = React.useMemo(() => data2026.weeklySummary.map(w => ({
    ...w,
    utilization: Math.round(w.totalHours / effectiveCapStd * 100),
    overload: w.totalHours > effectiveCapStd,
  })), [data2026, effectiveCapStd]);
  const actualWeeks = data2026.weeklySummary.filter(w => w.source === 'CMM Daily Inspection');
  const actualHours = Math.round(actualWeeks.reduce((a, w) => a + w.totalHours, 0) * 10) / 10;
  const massHours = Math.round((data2026.grandTotalHours - actualHours) * 10) / 10;
  const peakWeek = data2026.weeklySummary.reduce((a, b) => b.totalHours > a.totalHours ? b : a, data2026.weeklySummary[0]);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi" style={{ '--accent': 'var(--azure)' }}>
          <div className="label"><Clock size={13} style={{ marginRight: 4 }} />Tong gio CMM (2026)</div>
          <div className="value">{data2026.grandTotalHours}<small> h</small></div>
          <div className="foot ok"><Package size={13} /> {data2026.fwRange} · {data2026.totalSets} measurements</div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--violet)' }}>
          <div className="label"><Activity size={13} style={{ marginRight: 4 }} />Thuc te (CMM Daily Inspection)</div>
          <div className="value">{actualHours}<small> h</small></div>
          <div className="foot ok"><TrendingUp size={13} /> FW21–FW26 · {actualWeeks.length} tuan</div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--azure)' }}>
          <div className="label"><BarChart2 size={13} style={{ marginRight: 4 }} />Mass Product (FW01–FW20)</div>
          <div className="value">{massHours}<small> h</small></div>
          <div className="foot ok"><Package size={13} /> Ke hoach / forecast</div>
        </div>
        <div className="kpi" style={{ '--accent': peakWeek?.overload ? 'var(--rose)' : 'var(--amber)' }}>
          <div className="label"><AlertTriangle size={13} style={{ marginRight: 4 }} />Peak week</div>
          <div className="value" style={{ fontSize: 20 }}>{peakWeek?.week}<small> · {peakWeek?.totalHours}h</small></div>
          <div className={`foot ${peakWeek?.overload ? 'alert' : 'ok'}`}>
            <TrendingUp size={13} /> {peakWeek?.utilization}% capacity · {data2026.overloadWeeks.length > 0 ? `${data2026.overloadWeeks.length} tuan overload` : 'Khong co overload'}
          </div>
        </div>
      </div>

      {/* 2026 Weekly Chart */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="panel-title" style={{ margin: 0 }}>Gio CMM theo tuan vs Capacity ({effectiveCapStd}h/tuan @ {avail}%) — 2026</div>
          <button
            onClick={() => setShow2026Chart(o => !o)}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--txt-mid)', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >
            {show2026Chart ? t('btn.collapse') : t('btn.expand')}
          </button>
        </div>
        {show2026Chart && <>
          <div className="panel-sub">
            <span style={{ color: 'var(--azure)' }}>■ Mass Product</span>&nbsp;
            <span style={{ color: 'var(--violet)' }}>■ CMM Daily Inspection</span>&nbsp;·&nbsp;
            <span style={{ color: 'var(--rose)' }}>— {effectiveCapStd}h/tuan ({avail}%)</span>&nbsp;·&nbsp;
            <span style={{ color: 'var(--amber)' }}>— % Utilization</span>&nbsp;·&nbsp;
            Tong: {data2026.grandTotalHours}h · {data2026.fwRange} 2026
            &nbsp;·&nbsp;<span style={{ color: 'var(--txt-low)', fontSize: 10 }}>Sync: CMM Daily Inspection _2026.xlsx</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={chartData2026}
              margin={{ top: 22, right: 44, left: -8, bottom: 0 }}
              onClick={e => {
                if (e?.activePayload?.[0]) {
                  const w = e.activePayload[0].payload.week;
                  setSelected2026FW(s => s === w ? null : w);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <XAxis dataKey="week" tick={{ fill: 'var(--txt-mid)', fontSize: 9 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0} angle={-45} textAnchor="end" height={40} />
              <YAxis yAxisId="left" tick={{ fill: 'var(--txt-low)', fontSize: 10 }} axisLine={false} tickLine={false} unit="h" domain={[0, 175]} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--amber)', fontSize: 9 }} axisLine={false} tickLine={false} unit="%" domain={[0, (() => { const maxU = Math.max(...(chartData2026.map(d => d.utilization||0))); return maxU > 100 ? Math.ceil(maxU/10)*10+10 : 110; })()]} />
              <Tooltip
                formatter={(v, name) => name === 'Utilization' ? [`${v}%`, 'Utilization'] : [`${v}h`, 'CMM Hours']}
                labelFormatter={(label, payload) => {
                  if (!payload || !payload[0]) return label;
                  return `${label} — ${payload[0].payload.source || ''} · click để xem chi tiết`;
                }}
              />
              <Bar yAxisId="left" dataKey="totalHours" name="CMM Hours" radius={[3, 3, 0, 0]} activeBar={false}>
                <LabelList dataKey="totalHours" position="top" formatter={v => v > 0 ? `${v}h` : ''} style={{ fontSize: 8, fill: 'var(--txt-mid)' }} />
                {chartData2026.map((d, i) => {
                  const src = d.source || '';
                  const isSelected = d.week === selected2026FW;
                  const fill = d.overload ? 'var(--rose)'
                    : src === 'CMM Daily Inspection' ? 'var(--violet)'
                    : 'var(--azure)';
                  return <Cell key={i} fill={fill} opacity={selected2026FW && !isSelected ? 0.35 : 1} stroke={isSelected ? 'var(--txt-hi)' : 'none'} strokeWidth={isSelected ? 2 : 0} />;
                })}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="utilization" name="Utilization"
                stroke="var(--amber)" strokeWidth={1.5} dot={{ r: 2, fill: 'var(--amber)' }} activeDot={{ r: 4 }} />
              <ReferenceLine yAxisId="left" y={effectiveCapStd} stroke="var(--rose)" strokeDasharray="5 3" strokeWidth={2}
                label={{ value: `${effectiveCapStd}h / ${avail}%`, fill: 'var(--rose)', fontSize: 10, position: 'insideTopRight' }} />
            </ComposedChart>
          </ResponsiveContainer>
          {/* Week drill-down */}
          {selected2026FW && (() => {
            const wk = data2026.weeklySummary.find(w => w.week === selected2026FW);
            if (!wk) return null;
            const srcColor = wk.source === 'CMM Daily Inspection' ? 'var(--violet)' : 'var(--azure)';
            return (
              <div style={{ margin: '10px 0 4px', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: `1px solid ${srcColor}`, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: srcColor }}>{wk.week}</span>
                  <span style={{ color: 'var(--txt-mid)' }}>{wk.source}</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{wk.totalHours}h</span>
                  <span style={{ color: 'var(--txt-low)', fontSize: 11 }}>{wk.utilization}% capacity</span>
                  <button onClick={() => setSelected2026FW(null)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', color: 'var(--txt-mid)', borderRadius: 4, padding: '1px 7px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--txt-low)' }}>
                      <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 500 }}>Part</th>
                      <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 500 }}>Steps / Sets</th>
                      <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 500 }}>CMM Hours</th>
                      <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 500 }}>% tuần</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(wk.byPart || []).map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '4px 6px', color: 'var(--txt-hi)' }}>{p.part}</td>
                        <td className="mono" style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--txt-mid)' }}>{p.sets}</td>
                        <td className="mono" style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>{p.hours}h</td>
                        <td style={{ textAlign: 'right', padding: '4px 6px' }}>
                          <span style={{ fontSize: 10, color: 'var(--txt-low)' }}>{Math.round(p.hours / wk.totalHours * 100)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
          {/* Table toggle */}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShow2026Table(o => !o)}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--txt-mid)', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              {show2026Table ? t('std.hide_table') : t('std.show_table')}
            </button>
          </div>
          {show2026Table && (
            <table className="itr" style={{ fontSize: 11, marginTop: 8 }}>
              <thead><tr>
                <th>{t('std.col_week')}</th><th>{t('std.col_source')}</th><th>{t('std.col_cmm_h')}</th><th style={{ minWidth: 160 }}>{t('std.col_util')}</th>
              </tr></thead>
              <tbody>
                {data2026.weeklySummary.map((w, i) => {
                  const src = w.source || '';
                  const srcColor = src === 'CMM Daily Inspection' ? 'var(--violet)' : 'var(--azure)';
                  return (
                    <tr key={i} style={{ background: w.overload ? 'rgba(244,63,94,0.07)' : undefined }}>
                      <td className="mono" style={{ fontWeight: 600, color: w.overload ? 'var(--rose)' : undefined }}>{w.week}</td>
                      <td><span className="mono" style={{ fontSize: 10, color: srcColor }}>● {src}</span></td>
                      <td className="mono" style={{ color: w.overload ? 'var(--rose)' : undefined, fontWeight: w.overload ? 700 : 400 }}>{w.totalHours}h</td>
                      <td><UtilBar pct={w.utilization} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>}
      </div>

      {/* CMM Standard Time Reference Table */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setShowStdRef(o => !o)}>
          <div className="panel-title" style={{ margin: 0 }}>CMM Standard Time — Reference Table</div>
          <div className="panel-sub" style={{ margin: 0 }}>Source: Combined standard time Auto MT and CMM.xlsx</div>
          <button style={{ marginLeft: 'auto', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--txt-mid)', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            {showStdRef ? t('btn.collapse') : t('btn.expand')}
          </button>
        </div>
        {showStdRef && (
          <div className="tbl-scroll" style={{ marginTop: 10 }}>
            <table className="itr" style={{ fontSize: 11, minWidth: 860 }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ textAlign: 'left', minWidth: 72 }}>Customer</th>
                  <th rowSpan={2} style={{ textAlign: 'left', minWidth: 200 }}>Part Name</th>
                  <th colSpan={9} style={{ textAlign: 'center', background: 'var(--teal)', color: '#fff' }}>CMM STANDARD TIME (min/ring or min/set)</th>
                  <th rowSpan={2} style={{ background: 'var(--azure)', color: '#fff', minWidth: 80 }}>CMM Total<br/>(min/set)</th>
                </tr>
                <tr>
                  {['Outer', 'ITR', 'Single Ring', 'Inner', 'Inner 1', 'Inner 2', 'Inner Asm', 'Outer R+Gap', 'Assembly'].map(h => (
                    <th key={h} style={{ background: 'rgba(20,184,166,0.15)', fontSize: 10, minWidth: 60 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(liveStdTable || CMM_STD_TABLE).map((r, i) => {
                  const rowBg = r.highlight === 'rose' ? 'rgba(244,63,94,0.12)'
                    : r.highlight === 'amber' ? 'rgba(245,158,11,0.12)'
                    : undefined;
                  return (
                    <tr key={i} style={{ background: rowBg }}>
                      <td style={{ color: 'var(--txt-low)', fontSize: 10 }}>{r.customer}</td>
                      <td style={{ fontWeight: 500 }}>{r.part}</td>
                      {[r.outer, r.itr, r.singleRing, r.inner, r.inner1, r.inner2, r.innerAsm, r.outerRGap, r.assembly].map((v, ci) => (
                        v != null
                          ? <td key={ci} className="mono" style={{ textAlign: 'center', fontWeight: 600, color: 'var(--txt-hi)' }}>{v}</td>
                          : <td key={ci} style={{ textAlign: 'center', color: 'var(--border-bright)', fontSize: 10 }}>—</td>
                      ))}
                      <td className="mono" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--azure)' }}>{r.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Daily CMM Planner ─────────────────────────────────────────────────────────
const PLANNER_PARTS = [
  { part: '2.8-127 Pitch O-Bearing',        stdMin: 445 },
  { part: 'WT20 Pitch O-Bearing',           stdMin: 410 },
  { part: '1.6 Hybrid Glass Pitch Bearing', stdMin: 310 },
  { part: '1.5 Pitch Bearing',              stdMin: 310 },
  { part: '1.x-97 Pitch Bearing',           stdMin: 460 },
  { part: '2.5-116 Pitch Bearing',          stdMin: 320 },
  { part: 'Sierra N1 Pitch Bearing',        stdMin: 530 },
  { part: 'Sierra N1 Yaw Bearing',          stdMin: 530 },
  { part: '2.x Yaw Bearing',               stdMin: 310 },
  { part: 'Cypress Pitch Bearing',          stdMin: 530 },
  { part: 'Cypress Yaw Bearing',            stdMin: 530 },
  { part: '4MW Yaw Ring',                   stdMin: 390 },
  { part: '15MW Yaw Ring',                  stdMin: 625 },
  { part: 'V172 Blade Bearing',             stdMin: 880 },
  { part: 'Rotor Lock Disc',               stdMin: 480 },
  { part: 'SG129 MY20 Yaw Ring',            stdMin: 300 },
  { part: '14MW Yaw Ring',                  stdMin: 390 },
  { part: 'D8 YAW RING',                   stdMin: 270 },
  { part: 'GEV - 1.X-91 Pitch',            stdMin: 310 },
  { part: 'GEV - 2.7-132 Pitch',           stdMin: 420 },
  // ── Vendor-prefix aliases ─────────────────────────────────────────────────
  { part: 'VESTAS 15MW Yaw Ring',          stdMin: 625 },
  { part: 'VESTAS 4MW Yaw Ring',           stdMin: 390 },
  { part: 'Vestas V172 Blade Bearing',     stdMin: 880 },
  { part: 'SG14 Yaw Ring',                stdMin: 390 },  // similar to 14MW Yaw Ring
  // ── V172 individual measurement steps (tracked separately in Tracking file) ─
  { part: 'V172 Outer',                   stdMin: 180 },
  { part: 'V172 Inner Lower',             stdMin: 250 },  // = Inner 1
  { part: 'V172 Inner Upper',             stdMin: 240 },  // = Inner 2
  { part: 'V172 Inner Assemply',          stdMin:  45 },
  { part: 'V172 Outer Radial + Gap',      stdMin:  45 },
  { part: 'V172 Assemply',               stdMin: 120 },
  // ── Sub-part measurements ─────────────────────────────────────────────────
  { part: '1.6 Hybrid Glass Pitch Bearing-Inner', stdMin: 130 },
  { part: 'WT19 Cypress Yaw Bearing - Inner',     stdMin: 290 },
  { part: '2.X-127 O-Bearing Pitch Inner Upper',  stdMin: 185 },
];

const CAP_SHIFT_MIN = 620;         // 620 min/ca (new standard)
const CAP_DAY_MIN   = CAP_SHIFT_MIN * 2; // 1240 min (2 ca/ngay)
const CAP_WEEK_BASE = Math.round(CAP_DAY_MIN * 7 / 60 * 10) / 10; // ~144.7h (100% avail)

// ─── PO Capacity Section ────────────────────────────────────────────────────
function POCapacitySection({ avail, setAvail }) {
  const [livePoData, setLivePoData] = React.useState(null);
  React.useEffect(() => {
    loadPoCapacityData().then(d => { if (d) setLivePoData(d); }).catch(() => {});
  }, []);
  const { capWeek, months: MONTHS_DEF, parts, tiered: TIERED = {} } = livePoData || poCapacityData;
  const [view, setView] = React.useState('monthly');
  const [selectedItem, setSelectedItem] = React.useState(null);
  // avail & setAvail now received as props
  const effectiveCapWeek = Math.round(CAP_WEEK_BASE * avail / 100 * 10) / 10;
  const { t } = useLang();

  // Per-part weekly hours: handles GEV sampling + V172 tiered rates (cumulative across year)
  const partWeeklyHours = React.useMemo(() => {
    return parts.map(p => {
      const tier = TIERED[p.model];
      const wh = Array(53).fill(0);
      let cumulative = 0;
      for (let i = 0; i < 53; i++) {
        const eff = p.sets[i] / p.sampling; // GEV: sets/30, others: sets/1
        if (!tier) {
          wh[i] = eff * p.std / 60;
        } else {
          const { threshold, stdFull, stdReduced } = tier;
          const atFull    = Math.max(0, Math.min(eff, threshold - cumulative));
          const atReduced = eff - atFull;
          wh[i] = (atFull * stdFull + atReduced * stdReduced) / 60;
          cumulative += eff;
        }
      }
      return wh;
    });
  }, [parts]);

  // compute weekly demand hours
  const weekly = React.useMemo(() => {
    const arr = Array(53).fill(0);
    partWeeklyHours.forEach(wh => { for (let i = 0; i < 53; i++) arr[i] += wh[i]; });
    return arr.map(h => Math.round(h * 10) / 10);
  }, [partWeeklyHours]);

  // compute monthly
  const monthly = React.useMemo(() =>
    MONTHS_DEF.map(([name, ws, we]) => {
      const h = weekly.slice(ws, we + 1).reduce((a, b) => a + b, 0);
      const capH = (we - ws + 1) * effectiveCapWeek;
      return { name, h: Math.round(h * 10) / 10, capH, weeks: we - ws + 1 };
    }), [weekly]);

  // per-part totals (sampling + tiered)
  const partTotals = React.useMemo(() =>
    parts.map((p, idx) => {
      const totalSets = p.sets.reduce((a, b) => a + b, 0);
      const effInspections = Math.ceil(totalSets / p.sampling);
      const totalH = Math.round(partWeeklyHours[idx].reduce((a, b) => a + b, 0) * 10) / 10;
      return { ...p, totalH, totalSets, effInspections, isTiered: !!TIERED[p.model] };
    }).filter(p => p.totalSets > 0).sort((a, b) => b.totalH - a.totalH), [parts, partWeeklyHours]);

  const totalH     = Math.round(weekly.reduce((a, b) => a + b, 0) * 10) / 10;
  const annualCap  = 53 * effectiveCapWeek;
  const overWeeks  = weekly.filter(h => h > effectiveCapWeek).length;
  const peakWeekH  = Math.max(...weekly);
  const peakWeekIdx = weekly.indexOf(peakWeekH);

  const overColor  = 'var(--rose)';
  const okColor    = 'var(--signal)';
  const barColor   = (h, cap) => h > cap ? overColor : okColor;

  // chip style helper
  const chipStyle = (active) => ({
    background: active ? 'var(--azure)' : 'var(--surface-2)',
    color: active ? '#0f172a' : 'var(--txt-mid)',
    border: '1px solid var(--border)',
    padding: '4px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
    fontWeight: active ? 700 : 400,
  });

  return (
    <div>
      {/* KPI row */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        {[
          { label: t('po.total_demand'),    val: totalH.toLocaleString() + 'h', sub: `${t('po.annual_cap')} ${annualCap.toLocaleString()}h`, color: 'var(--rose)' },
          { label: t('po.overload_factor'), val: (totalH / annualCap).toFixed(1) + '×', sub: t('po.demand_cap'), color: 'var(--rose)' },
          { label: t('po.over_weeks'), val: `${overWeeks}/53`, sub: `${Math.round(overWeeks/53*100)}% ${t('po.pct_time')}`, color: overWeeks > 30 ? 'var(--rose)' : 'var(--amber)' },
          { label: t('po.peak_week'), val: `W${peakWeekIdx + 1}`, sub: `${Math.round(peakWeekH).toLocaleString()}h (×${(peakWeekH/effectiveCapWeek).toFixed(1)} cap)`, color: 'var(--rose)' },
          { label: t('po.cap_week'), val: effectiveCapWeek + 'h', sub: `${avail}% avail · 620min/ca`, color: 'var(--azure)' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--accent': k.color }}>
            <div className="label">{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--txt-mid)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Availability input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--txt-mid)', fontWeight: 600 }}>⚙ Machine Availability:</span>
        <input type="range" min={50} max={100} step={1} value={avail} onChange={e => setAvail(+e.target.value)}
          style={{ width: 130, accentColor: 'var(--azure)', cursor: 'pointer' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--azure)', minWidth: 40 }}>{avail}%</span>
        <span style={{ fontSize: 11, color: 'var(--txt-low)' }}>
          → Cap/tuần: <strong style={{ color: 'var(--signal)' }}>{effectiveCapWeek}h</strong>
          &nbsp;<span style={{ color: 'var(--border)' }}>|</span>&nbsp;
          620 min × 2 ca × 7 ngày × {avail}%
        </span>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['monthly', t('po.by_month')],['weekly', t('po.by_week')],['parts', t('po.by_part')]].map(([v, lbl]) => (
          <button key={v} style={chipStyle(view === v)} onClick={() => { setView(v); setSelectedItem(null); }}>{lbl}</button>
        ))}
      </div>

      {/* Monthly view */}
      {view === 'monthly' && (() => {
        const selMonth = selectedItem?.type === 'month' ? selectedItem.name
          : selectedItem?.type === 'week-in-month' ? selectedItem.month : null;
        const monthDef = selMonth ? MONTHS_DEF.find(([n]) => n === selMonth) : null;
        // weeks drill-down for selected month
        const drillWeeks = monthDef ? Array.from({ length: monthDef[2] - monthDef[1] + 1 }, (_, k) => {
          const wi = monthDef[1] + k;
          return { label: `W${wi + 1}`, idx: wi, h: weekly[wi] };
        }) : [];
        // part drill-down for selected week within month
        const selWeekInMonth = selectedItem?.type === 'week-in-month' ? selectedItem.idx : null;
        const drillParts = selWeekInMonth !== null ? parts.map((p, pi) => ({
          model: p.model, customer: p.customer, sampling: p.sampling,
          sets: p.sets[selWeekInMonth],
          effSets: +(p.sets[selWeekInMonth] / p.sampling).toFixed(2),
          hours: +partWeeklyHours[pi][selWeekInMonth].toFixed(1),
        })).filter(p => p.sets > 0).sort((a, b) => b.hours - a.hours) : [];

        return (
          <div>
            <div style={{ fontSize: 11, color: 'var(--txt-mid)', marginBottom: 4 }}>
              {t('po.click_month')}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthly} margin={{ top: 22, right: 8, bottom: 4, left: 10 }}
                onClick={d => d?.activePayload && setSelectedItem(s =>
                  s?.name === d.activePayload[0].payload.name ? null : { type: 'month', name: d.activePayload[0].payload.name }
                )}>
                <XAxis dataKey="name" tick={{ fill: 'var(--txt-mid)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--txt-mid)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}kh` : v + 'h'} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n) => [Math.round(v).toLocaleString() + 'h', n]} />
                <ReferenceLine y={Math.round(effectiveCapWeek*4.33)} stroke="var(--azure)" strokeDasharray="4 3" strokeWidth={2} label={{ value: `Cap ${Math.round(effectiveCapWeek*4.33)}h`, fill: 'var(--azure)', fontSize: 10, position: 'insideTopRight' }} />
                <Bar dataKey="h" name="Demand" radius={[4,4,0,0]} style={{ cursor: 'pointer' }}>
                  {monthly.map((m, i) => <Cell key={i}
                    fill={barColor(m.h, m.capH)}
                    opacity={selMonth && selMonth !== m.name ? 0.4 : 1}
                  />)}
                  <LabelList dataKey="h" position="top" formatter={v => v > 0 ? (v >= 1000 ? `${(v/1000).toFixed(1)}kh` : Math.round(v) + 'h') : ''} style={{ fontSize: 10, fill: 'var(--txt-mid)', fontWeight: 600 }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>

            {/* Month drill-down: weeks as CHART */}
            {selMonth && (
              <div style={{ marginTop: 10, background: 'var(--surface-2)', border: '1px solid var(--azure)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: 'var(--azure)', fontSize: 13 }}>{t('po.month_drill', { m: selMonth })}</span>
                  <span style={{ fontSize: 11, color: 'var(--txt-mid)' }}>{t('po.click_week_sub')}</span>
                  <button onClick={() => setSelectedItem(null)}
                    style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', color: 'var(--txt-mid)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>

                {/* Week bar chart */}
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart
                    data={drillWeeks}
                    margin={{ top: 22, right: 8, bottom: 4, left: 10 }}
                    onClick={d => {
                      if (!d?.activePayload) return;
                      const wi = d.activePayload[0].payload.idx;
                      setSelectedItem(s => s?.idx === wi ? { type: 'month', name: selMonth } : { type: 'week-in-month', idx: wi, month: selMonth });
                    }}
                  >
                    <XAxis dataKey="label" tick={{ fill: 'var(--txt-mid)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--txt-low)', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v + 'h'} />
                    <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={v => [v.toFixed(1) + 'h', 'Demand']} />
                    <ReferenceLine y={effectiveCapWeek} stroke="var(--azure)" strokeDasharray="4 3" strokeWidth={2}
                      label={{ value: `${effectiveCapWeek}h`, fill: 'var(--azure)', fontSize: 10, position: 'insideTopRight' }} />
                    <Bar dataKey="h" radius={[4,4,0,0]} style={{ cursor: 'pointer' }}>
                      {drillWeeks.map((w, i) => (
                        <Cell key={i}
                          fill={selWeekInMonth === w.idx ? 'var(--amber)' : w.h > effectiveCapWeek ? overColor : okColor}
                          opacity={selWeekInMonth !== null && selWeekInMonth !== w.idx ? 0.45 : 1}
                        />
                      ))}
                      <LabelList dataKey="h" position="top" formatter={v => v > 0 ? Math.round(v) + 'h' : ''} style={{ fontSize: 10, fill: 'var(--txt-mid)', fontWeight: 600 }} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Week → part TABLE */}
                {selWeekInMonth !== null && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 12 }}>
                        🔩 W{selWeekInMonth + 1} — {weekly[selWeekInMonth].toFixed(1)}h / {effectiveCapWeek}h
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 8,
                        background: weekly[selWeekInMonth] > effectiveCapWeek ? 'rgba(248,113,113,.15)' : 'rgba(74,222,128,.12)',
                        color: weekly[selWeekInMonth] > effectiveCapWeek ? 'var(--rose)' : 'var(--signal)' }}>
                        {weekly[selWeekInMonth] > effectiveCapWeek ? 'OVERLOAD' : 'OK'}
                      </span>
                    </div>
                    {drillParts.length > 0 ? (
                      <table className="itr" style={{ fontSize: 12 }}>
                        <thead><tr>
                          <th>{t('po.col_customer')}</th><th>{t('po.col_model')}</th><th>{t('po.col_po_sets')}</th><th>{t('po.col_eff_sets')}</th><th>{t('po.col_cmm_h')}</th>
                          <th style={{ minWidth: 100 }}>{t('po.col_pct_week')}</th>
                        </tr></thead>
                        <tbody>
                          {drillParts.map((p, i) => {
                            const pct2 = weekly[selWeekInMonth] > 0 ? (p.hours / weekly[selWeekInMonth] * 100).toFixed(0) : 0;
                            return (
                              <tr key={i}>
                                <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
                                  background: p.sampling > 1 ? 'rgba(167,139,250,.15)' : 'rgba(56,189,248,.12)',
                                  color: p.sampling > 1 ? 'var(--violet)' : 'var(--azure)' }}>{p.customer}</span></td>
                                <td><b>{p.model}</b></td>
                                <td style={{ textAlign: 'center' }}>{p.sets}</td>
                                <td style={{ textAlign: 'center', color: p.sampling > 1 ? 'var(--amber)' : 'var(--txt)' }}>
                                  {p.effSets}{p.sampling > 1 && <span style={{ fontSize: 9, color: 'var(--txt-mid)' }}> (/30)</span>}
                                </td>
                                <td style={{ fontWeight: 700, color: 'var(--azure)' }}>{p.hours}h</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ flex: 1, height: 6, background: 'var(--grid-line)', borderRadius: 3 }}>
                                      <div style={{ width: `${pct2}%`, height: '100%', background: 'var(--amber)', borderRadius: 3 }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: 'var(--txt-mid)', minWidth: 28 }}>{pct2}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ color: 'var(--txt-mid)', fontSize: 12 }}>{t('po.no_plan')}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <table className="itr" style={{ marginTop: 12 }}>
              <thead><tr>
                <th>{t('po.col_month')}</th><th>{t('po.col_weeks')}</th><th>{t('po.col_demand')}</th><th>{t('po.col_cap')}</th>
                <th>{t('po.col_overload')}</th><th>{t('po.col_ratio')}</th><th>{t('po.col_status')}</th>
              </tr></thead>
              <tbody>
                {monthly.map(m => {
                  const over = Math.max(0, m.h - m.capH);
                  const ratio = (m.h / m.capH).toFixed(1);
                  const isOver = m.h > m.capH;
                  const isSel = selMonth === m.name;
                  return (
                    <tr key={m.name} style={{ cursor: 'pointer', background: isSel ? 'rgba(56,189,248,.08)' : undefined }}
                      onClick={() => setSelectedItem(s => s?.name === m.name ? null : { type: 'month', name: m.name })}>
                      <td><b style={{ color: isSel ? 'var(--azure)' : undefined }}>{m.name} {isSel ? '▶' : ''}</b></td>
                      <td style={{ textAlign: 'center' }}>{m.weeks}</td>
                      <td style={{ color: isOver ? 'var(--rose)' : 'var(--signal)', fontWeight: 700 }}>
                        {Math.round(m.h).toLocaleString()}h
                      </td>
                      <td style={{ color: 'var(--txt-mid)' }}>{m.capH.toLocaleString()}h</td>
                      <td style={{ color: over > 0 ? 'var(--rose)' : 'var(--txt-mid)' }}>
                        {over > 0 ? '+' + Math.round(over).toLocaleString() + 'h' : '—'}
                      </td>
                      <td style={{ color: isOver ? 'var(--rose)' : 'var(--signal)', fontWeight: 600 }}>{ratio}×</td>
                      <td>
                        <span style={{ background: isOver ? 'rgba(248,113,113,.15)' : 'rgba(74,222,128,.12)',
                          color: isOver ? 'var(--rose)' : 'var(--signal)',
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                          {isOver ? t('status.overload') : t('status.ok')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Weekly view */}
      {view === 'weekly' && (() => {
        const selIdx = selectedItem?.type === 'week' ? selectedItem.idx : null;
        const drillParts = selIdx !== null ? parts.map((p, pi) => ({
          model: p.model, customer: p.customer, sampling: p.sampling,
          sets: p.sets[selIdx],
          effSets: +(p.sets[selIdx] / p.sampling).toFixed(2),
          hours: +partWeeklyHours[pi][selIdx].toFixed(1),
        })).filter(p => p.sets > 0).sort((a, b) => b.hours - a.hours) : [];

        return (
          <div>
            <div style={{ fontSize: 11, color: 'var(--txt-mid)', marginBottom: 4 }}>
              {t('po.click_week')}
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={weekly.map((h, i) => ({ w: `W${i+1}`, h, idx: i }))}
                margin={{ top: 4, right: 8, bottom: 4, left: 10 }}
                onClick={d => {
                  if (!d?.activePayload) return;
                  const idx = d.activePayload[0].payload.idx;
                  setSelectedItem(s => s?.idx === idx ? null : { type: 'week', idx });
                }}>
                <XAxis dataKey="w" tick={{ fill: 'var(--txt-mid)', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: 'var(--txt-mid)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [Math.round(v).toLocaleString() + 'h', 'Demand']} />
                <ReferenceLine y={effectiveCapWeek} stroke="var(--azure)" strokeDasharray="4 3" strokeWidth={2}
                  label={{ value: `Cap ${effectiveCapWeek}h`, fill: 'var(--azure)', fontSize: 10, position: 'insideTopRight' }} />
                <Bar dataKey="h" radius={[3,3,0,0]} style={{ cursor: 'pointer' }}>
                  {weekly.map((h, i) => <Cell key={i}
                    fill={i === selIdx ? 'var(--amber)' : h > effectiveCapWeek ? overColor : okColor}
                    opacity={selIdx !== null && i !== selIdx ? 0.4 : 1}
                  />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>

            <div style={{ fontSize: 11, color: 'var(--txt-mid)', marginTop: 6 }}>
              <span style={{ color: overColor, fontWeight: 700 }}>■</span> {t('po.overload_weeks_legend', { n: overWeeks })} &nbsp;
              <span style={{ color: okColor, fontWeight: 700 }}>■</span> {t('po.ok_weeks_legend', { n: 53 - overWeeks })} &nbsp;
              <span style={{ color: 'var(--azure)' }}>— {t('po.cap_week')} {effectiveCapWeek}h</span>
              {selIdx !== null && <span style={{ color: 'var(--amber)', marginLeft: 12 }}>{t('po.selected_week', { n: selIdx + 1 })}</span>}
            </div>

            {/* Week drill-down: parts */}
            {selIdx !== null && (
              <div style={{ marginTop: 10, background: 'var(--bg3,var(--surface-2))', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 13 }}>
                    🔩 W{selIdx + 1} — {weekly[selIdx].toFixed(1)}h / {effectiveCapWeek}h cap
                    <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 8,
                      background: weekly[selIdx] > effectiveCapWeek ? 'rgba(248,113,113,.15)' : 'rgba(74,222,128,.12)',
                      color: weekly[selIdx] > effectiveCapWeek ? 'var(--rose)' : 'var(--signal)' }}>
                      {weekly[selIdx] > effectiveCapWeek ? t('status.overload') : t('status.ok')}
                    </span>
                  </span>
                  <button onClick={() => setSelectedItem(null)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', color: 'var(--txt-mid)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
                {drillParts.length > 0 ? (
                  <table className="itr" style={{ fontSize: 12 }}>
                    <thead><tr><th>{t('po.col_customer')}</th><th>{t('po.col_model')}</th><th>{t('po.col_po_sets')}</th><th>{t('po.col_eff_sets')}</th><th>{t('po.col_cmm_h')}</th><th>{t('po.col_pct')}</th></tr></thead>
                    <tbody>
                      {drillParts.map((p, i) => {
                        const pct2 = weekly[selIdx] > 0 ? (p.hours / weekly[selIdx] * 100).toFixed(0) : 0;
                        return (
                          <tr key={i}>
                            <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
                              background: p.sampling > 1 ? 'rgba(167,139,250,.15)' : 'rgba(56,189,248,.12)',
                              color: p.sampling > 1 ? 'var(--violet)' : 'var(--azure)' }}>{p.customer}</span></td>
                            <td><b>{p.model}</b></td>
                            <td style={{ textAlign: 'center' }}>{p.sets}</td>
                            <td style={{ textAlign: 'center', color: p.sampling > 1 ? 'var(--amber)' : 'var(--txt)' }}>
                              {p.effSets}{p.sampling > 1 && <span style={{ fontSize: 9, color: 'var(--txt-mid)' }}> (/30)</span>}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--azure)' }}>{p.hours}h</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 60, height: 5, background: 'var(--surface-2)', borderRadius: 3 }}>
                                  <div style={{ width: `${pct2}%`, height: '100%', background: 'var(--azure)', borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--txt-mid)' }}>{pct2}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ color: 'var(--txt-mid)', fontSize: 12 }}>{t('po.no_plan')}</div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Parts view */}
      {view === 'parts' && (
        <table className="itr">
          <thead><tr>
            <th>#</th><th>{t('po.col_customer')}</th><th>{t('po.col_model')}</th><th>{t('po.col_std')}</th>
            <th>{t('po.col_sampling')}</th><th>{t('po.col_po_sets')}</th><th>{t('po.col_eff_insp')}</th><th>{t('po.col_cmm_h')}</th><th>{t('po.col_pct')}</th>
          </tr></thead>
          <tbody>
            {partTotals.map((p, i) => {
              const pct2 = (p.totalH / totalH * 100).toFixed(1);
              const isGEV = p.sampling > 1;
              return (
                <tr key={p.model + i}>
                  <td style={{ color: 'var(--txt-mid)' }}>{i + 1}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, fontWeight: 600,
                      background: isGEV ? 'rgba(167,139,250,.15)' : 'rgba(56,189,248,.12)',
                      color: isGEV ? 'var(--violet)' : 'var(--azure)' }}>
                      {p.customer}
                    </span>
                  </td>
                  <td><b>{p.model}</b></td>
                  <td style={{ color: 'var(--azure)', textAlign: 'center' }}>
                    {p.isTiered
                      ? <span title="≤30 sets: 880min, set 31+: 440min">880→440<sup style={{fontSize:9,color:'var(--amber)'}}>*</sup></span>
                      : p.std}
                  </td>
                  <td style={{ textAlign: 'center', color: isGEV ? 'var(--amber)' : 'var(--txt-mid)', fontWeight: isGEV ? 700 : 400 }}>
                    {isGEV ? `1/${p.sampling}` : '1/1'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{p.totalSets.toLocaleString()}</td>
                  <td style={{ textAlign: 'center', color: isGEV ? 'var(--amber)' : 'var(--txt)' }}>
                    {p.effInspections.toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 700 }}>{p.totalH.toLocaleString()}h</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 80, height: 6, background: 'var(--surface-2)', borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(100, parseFloat(pct2) * 3)}%`, height: '100%',
                          background: 'var(--azure)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--txt-mid)' }}>{pct2}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DailyPlannerSection() {
  const { t } = useLang();
  const [sets, setSets]   = React.useState({});
  const [shifts, setShifts] = React.useState(2);

  const capMin  = shifts * 620;        // 620 min/ca
  const capHours = +(shifts * 620 / 60).toFixed(2);

  const rows = PLANNER_PARTS.map((p) => {
    const s   = Number(sets[p.part] || 0);
    const min = s * p.stdMin;
    return { ...p, planned: s, totalMin: min, totalHours: +(min / 60).toFixed(2) };
  }).filter((r) => r.planned > 0 || true);

  const totalMin   = rows.reduce((a, r) => a + r.totalMin, 0);
  const totalHours = +(totalMin / 60).toFixed(2);
  const util       = totalMin > 0 ? Math.round(totalMin / capMin * 100) : 0;
  const remaining  = +((capMin - totalMin) / 60).toFixed(2);
  const overload   = totalMin > capMin;

  function reset() { setSets({}); }

  const barColor = overload ? 'var(--rose)' : util > 80 ? 'var(--amber)' : 'var(--signal)';

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--txt-mid)', fontSize: 13 }}>{t('dp.shifts')}</span>
          {[1, 2].map((n) => (
            <button key={n} className={`chip ${shifts === n ? 'active' : ''}`}
              onClick={() => setShifts(n)}>
              {t('dp.shift_n', { n, h: +(n * 620 / 60).toFixed(1) })}
            </button>
          ))}
        </div>
        <button className="chip" style={{ marginLeft: 'auto', color: 'var(--rose)' }}
          onClick={reset}>{t('btn.reset')}</button>
      </div>

      {/* KPI summary */}
      <div className="kpi-grid" style={{ marginBottom: 12 }}>
        <div className="kpi" style={{ '--accent': barColor }}>
          <div className="label"><Clock size={13} style={{ marginRight: 4 }} />{t('dp.total_hours')}</div>
          <div className="value" style={{ color: overload ? 'var(--rose)' : undefined }}>
            {totalHours}<small>h</small>
          </div>
          <div className={`foot ${overload ? 'alert' : 'ok'}`}>
            <Activity size={13} /> {t('dp.capacity', { h: capHours, n: shifts })}
          </div>
        </div>
        <div className="kpi" style={{ '--accent': barColor }}>
          <div className="label"><BarChart2 size={13} style={{ marginRight: 4 }} />{t('dp.utilization')}</div>
          <div className="value" style={{ color: overload ? 'var(--rose)' : undefined }}>
            {util}<small>%</small>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 8, background: 'var(--grid-line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(util, 100)}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>
        <div className="kpi" style={{ '--accent': remaining < 0 ? 'var(--rose)' : 'var(--azure)' }}>
          <div className="label"><TrendingUp size={13} style={{ marginRight: 4 }} />
            {remaining >= 0 ? t('dp.remaining') : t('dp.overrun')}
          </div>
          <div className="value" style={{ color: remaining < 0 ? 'var(--rose)' : undefined }}>
            {Math.abs(remaining)}<small>h</small>
          </div>
          <div className={`foot ${remaining < 0 ? 'alert' : 'ok'}`}>
            {remaining >= 0
              ? <><CheckCircle2 size={13} /> {t('dp.can_add')}</>
              : <><AlertTriangle size={13} /> {t('dp.overload_by', { h: Math.abs(remaining) })}</>}
          </div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--violet)' }}>
          <div className="label"><Package size={13} style={{ marginRight: 4 }} />{t('dp.total_sets')}</div>
          <div className="value">{rows.reduce((a, r) => a + r.planned, 0)}</div>
          <div className="foot ok"><Layers size={13} /> {t('dp.part_types', { n: rows.filter((r) => r.planned > 0).length })}</div>
        </div>
      </div>

      {/* Planner table */}
      <div className="tbl-scroll">
        <table className="itr">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: 180 }}>{t('tbl.part')}</th>
              <th>{t('tbl.std_min').split('\n')[0]}<br />{t('tbl.std_min').split('\n')[1]}</th>
              <th>{t('tbl.std_h').split('\n')[0]}<br />{t('tbl.std_h').split('\n')[1]}</th>
              <th style={{ minWidth: 120 }}>{t('tbl.plan_sets').split('\n')[0]}<br /><span style={{ fontWeight: 400, fontSize: 10, color: 'var(--txt-low)' }}>{t('tbl.plan_sets').split('\n')[1]}</span></th>
              <th>{t('tbl.total_time')}</th>
              <th style={{ minWidth: 160 }}>{t('tbl.pct_cap', { h: capHours })}</th>
            </tr>
          </thead>
          <tbody>
            {PLANNER_PARTS.map((p, i) => {
              const s       = Number(sets[p.part] || 0);
              const rowMin  = s * p.stdMin;
              const rowH    = +(rowMin / 60).toFixed(2);
              const rowPct  = capMin > 0 ? Math.round(rowMin / capMin * 100) : 0;
              const rowOver = rowMin > capMin;
              const rowColor = rowOver ? 'var(--rose)' : rowPct > 80 ? 'var(--amber)' : 'var(--signal)';
              return (
                <tr key={i} style={{ background: rowOver ? 'rgba(244,63,94,0.07)' : undefined }}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PART_COLORS[i % PART_COLORS.length], flexShrink: 0 }} />
                    {p.part}
                  </td>
                  <td className="mono">{p.stdMin}</td>
                  <td className="mono">{(p.stdMin / 60).toFixed(2)}</td>
                  <td>
                    <input
                      type="number" min="0" max="99"
                      value={sets[p.part] || ''}
                      placeholder="0"
                      onChange={(e) => setSets((prev) => ({ ...prev, [p.part]: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))}
                      style={{
                        width: 72, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface-2)', color: 'var(--txt)', fontSize: 13,
                        fontFamily: 'var(--font-mono)', textAlign: 'center',
                        outline: s > 0 ? '2px solid var(--azure)' : 'none',
                      }}
                    />
                  </td>
                  <td className="mono" style={{ fontWeight: s > 0 ? 600 : 400, color: s > 0 ? (rowOver ? 'var(--rose)' : 'var(--txt)') : 'var(--txt-low)' }}>
                    {s > 0 ? `${rowH}h (${rowMin}min)` : '---'}
                  </td>
                  <td>
                    {s > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--grid-line)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(rowPct, 100)}%`, height: '100%', background: rowColor, borderRadius: 4 }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11, color: rowColor, minWidth: 38, textAlign: 'right' }}>
                          {rowPct}%
                        </span>
                      </div>
                    ) : <span style={{ color: 'var(--txt-low)', fontSize: 11 }}>---</span>}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr style={{ fontWeight: 700, background: overload ? 'rgba(244,63,94,0.12)' : 'var(--grid-line)', borderTop: '2px solid var(--border)' }}>
              <td><strong>{t('wp.grand_total')}</strong></td>
              <td /><td />
              <td className="mono"><strong>{rows.reduce((a, r) => a + r.planned, 0)} sets</strong></td>
              <td className="mono" style={{ color: overload ? 'var(--rose)' : undefined }}>
                <strong>{totalHours}h ({totalMin}min)</strong>
                {overload && <span style={{ marginLeft: 8, color: 'var(--rose)', fontSize: 11 }}>{t('status.overload')}</span>}
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 10, background: 'var(--grid-line)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ width: `${Math.min(util, 100)}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: barColor, minWidth: 44, fontWeight: 700 }}>
                    {util}%{overload ? ' !' : ''}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mono" style={{ marginTop: 8, color: 'var(--txt-low)', fontSize: 11 }}>
        {t('dp.capacity', { h: capHours, n: shifts })} · {t('wp.note')}
      </div>
    </div>
  );
}


// ── CMM Weekly Planner ────────────────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' }, { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

function WeeklyPlannerSection() {
  const { t } = useLang();
  const [sets, setSets]           = React.useState({});
  const [totalManual, setTotalManual] = React.useState({}); // part -> manual total sets override
  const [shifts, setShifts]       = React.useState(2);
  const [weekLabel, setWeekLabel] = React.useState('');

  const capDayMin  = shifts * 620;       // 620 min/ca
  const capWeekMin = capDayMin * 7;
  const capDayH    = +(shifts * 620 / 60).toFixed(2);

  const getVal = (part, day) => Number(sets[part + '||' + day] || 0);

  // when typing a day cell: clear manual total for that part
  const setVal = (part, day, v) => {
    setTotalManual(prev => { const n = { ...prev }; delete n[part]; return n; });
    setSets(prev => ({ ...prev, [part + '||' + day]: Math.max(0, Number(v) || 0) }));
  };

  // when typing total directly: clear all day values for that part, store manual total
  const setTotalVal = (part, v) => {
    const val = Math.max(0, Number(v) || 0);
    setTotalManual(prev => ({ ...prev, [part]: val }));
    setSets(prev => {
      const n = { ...prev };
      DAYS.forEach(d => delete n[part + '||' + d.key]);
      return n;
    });
  };

  // effective sets for a part (manual override wins over day sum)
  const partEffSets = (part) =>
    totalManual[part] !== undefined
      ? totalManual[part]
      : DAYS.reduce((s, d) => s + getVal(part, d.key), 0);

  const dayTotalMin  = (day)  => PLANNER_PARTS.reduce((s, p) => s + getVal(p.part, day) * p.stdMin, 0);
  const partTotalMin = (part) => partEffSets(part) * PLANNER_PARTS.find(p => p.part === part).stdMin;
  const weekTotalMin  = PLANNER_PARTS.reduce((s, p) => s + partTotalMin(p.part), 0);
  const weekTotalH    = +(weekTotalMin / 60).toFixed(2);
  const weekUtil      = weekTotalMin > 0 ? Math.round(weekTotalMin / capWeekMin * 100) : 0;
  const weekRemain    = +((capWeekMin - weekTotalMin) / 60).toFixed(2);
  const weekOverload  = weekTotalMin > capWeekMin;
  const weekTotalSets = PLANNER_PARTS.reduce((s, p) => s + partEffSets(p.part), 0);
  const weekBarColor  = weekOverload ? 'var(--rose)' : weekUtil > 80 ? 'var(--amber)' : 'var(--signal)';

  function reset() { setSets({}); setTotalManual({}); }

  const dayBarColor = (dMin) => dMin > capDayMin ? 'var(--rose)' : (dMin / capDayMin) > 0.8 ? 'var(--amber)' : 'var(--signal)';
  const dayStatusLabel = (dMin) => {
    if (dMin === 0) return null;
    const pct = dMin / capDayMin;
    if (pct > 1)   return { label: t('status.overload'), cls: 'alert' };
    if (pct > 0.85) return { label: t('status.warn'), cls: 'warn' };
    return { label: t('status.ok'), cls: 'ok' };
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--txt-mid)', fontSize: 13 }}>{t('wp.week')}</span>
          <input value={weekLabel} onChange={e => setWeekLabel(e.target.value)} placeholder="FW27"
            style={{ width: 72, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface-2)', color: 'var(--txt)', fontSize: 13, textAlign: 'center' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--txt-mid)', fontSize: 13 }}>{t('dp.shifts')}</span>
          {[1, 2].map(n => (
            <button key={n} className={`chip ${shifts === n ? 'active' : ''}`} onClick={() => setShifts(n)}>
              {t('dp.shift_n', { n, h: +(n * 620 / 60).toFixed(1) })}
            </button>
          ))}
        </div>
        <button className="chip" style={{ marginLeft: 'auto', color: 'var(--rose)' }} onClick={reset}>{t('btn.reset')}</button>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid" style={{ marginBottom: 12 }}>
        <div className="kpi" style={{ '--accent': weekBarColor }}>
          <div className="label"><Clock size={13} style={{ marginRight: 4 }} />{t('wp.total_week_h')}</div>
          <div className="value" style={{ color: weekOverload ? 'var(--rose)' : undefined }}>
            {weekTotalH}<small>h</small>
          </div>
          <div className={`foot ${weekOverload ? 'alert' : 'ok'}`}>
            <Activity size={13} /> {t('dp.capacity', { h: capDayH * 7, n: shifts })}
          </div>
        </div>
        <div className="kpi" style={{ '--accent': weekBarColor }}>
          <div className="label"><BarChart2 size={13} style={{ marginRight: 4 }} />{t('wp.util_week')}</div>
          <div className="value" style={{ color: weekOverload ? 'var(--rose)' : undefined }}>
            {weekUtil}<small>%</small>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 8, background: 'var(--grid-line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(weekUtil, 100)}%`, height: '100%', background: weekBarColor, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>
        <div className="kpi" style={{ '--accent': weekRemain < 0 ? 'var(--rose)' : 'var(--azure)' }}>
          <div className="label"><TrendingUp size={13} style={{ marginRight: 4 }} />
            {weekRemain >= 0 ? t('dp.remaining') : t('dp.overrun')}
          </div>
          <div className="value" style={{ color: weekRemain < 0 ? 'var(--rose)' : undefined }}>
            {Math.abs(weekRemain)}<small>h</small>
          </div>
          <div className={`foot ${weekRemain < 0 ? 'alert' : 'ok'}`}>
            {weekRemain >= 0
              ? <><CheckCircle2 size={13} /> {t('dp.can_add')}</>
              : <><AlertTriangle size={13} /> {t('dp.overload_by', { h: Math.abs(weekRemain) })}</>}
          </div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--violet)' }}>
          <div className="label"><Package size={13} style={{ marginRight: 4 }} />{t('wp.total_sets')}</div>
          <div className="value">{weekTotalSets}</div>
          <div className="foot ok">
            <Layers size={13} /> {t('dp.part_types', { n: PLANNER_PARTS.filter(p => DAYS.some(d => getVal(p.part, d.key) > 0)).length })}
          </div>
        </div>
      </div>

      {/* Weekly table */}
      <div className="tbl-scroll">
        <table className="itr" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: 190 }}>{t('tbl.part')}</th>
              <th style={{ minWidth: 60 }}>Std<br />(min)</th>
              {DAYS.map(d => (
                <th key={d.key} style={{ minWidth: 88 }}>{d.label}</th>
              ))}
              <th style={{ minWidth: 72 }}>{t('wp.total_col').split('\n')[0]}<br />{t('wp.total_col').split('\n')[1]}</th>
              <th style={{ minWidth: 80 }}>{t('wp.total_hours_col').split('\n')[0]}<br />{t('wp.total_hours_col').split('\n')[1]}</th>
              <th style={{ minWidth: 140 }}>{t('wp.week_cap_col', { h: capDayH * 7 }).replace('\n', '\n').split('\n')[0]}<br />{t('wp.week_cap_col', { h: capDayH * 7 }).split('\n')[1]}</th>
            </tr>
          </thead>
          <tbody>
            {PLANNER_PARTS.map((p, i) => {
              const ptSets  = partEffSets(p.part);
              const ptMin   = partTotalMin(p.part);
              const ptH     = +(ptMin / 60).toFixed(2);
              const ptPct   = capWeekMin > 0 ? Math.round(ptMin / capWeekMin * 100) : 0;
              const ptOver  = ptMin > capWeekMin;
              const ptColor = ptOver ? 'var(--rose)' : ptPct > 80 ? 'var(--amber)' : 'var(--signal)';
              const isManual = totalManual[p.part] !== undefined;
              return (
                <tr key={i} style={{ background: ptOver ? 'rgba(244,63,94,0.07)' : undefined }}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PART_COLORS[i % PART_COLORS.length], flexShrink: 0 }} />
                    {p.part}
                  </td>
                  <td className="mono" style={{ color: 'var(--txt-low)' }}>{p.stdMin}</td>
                  {DAYS.map(d => {
                    const v = getVal(p.part, d.key);
                    return (
                      <td key={d.key}>
                        <input type="number" min="0" max="99" value={v || ''}
                          placeholder="0"
                          disabled={isManual}
                          onChange={e => setVal(p.part, d.key, e.target.value)}
                          style={{
                            width: 64, padding: '4px 6px', borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: isManual ? 'var(--grid-line)' : 'var(--surface-2)',
                            color: isManual ? 'var(--txt-low)' : 'var(--txt)',
                            fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'center',
                            outline: v > 0 ? '2px solid var(--azure)' : 'none',
                            opacity: isManual ? 0.4 : 1,
                          }}
                        />
                      </td>
                    );
                  })}
                  {/* Total Sets — editable, auto-sum OR manual */}
                  <td>
                    <input type="number" min="0" max="9999"
                      value={ptSets || ''}
                      placeholder="0"
                      title={isManual ? 'Manual total (nha? vao day)' : 'Tu tinh tu cac ngay — nha? vao de override'}
                      onChange={e => setTotalVal(p.part, e.target.value)}
                      style={{
                        width: 68, padding: '4px 6px', borderRadius: 6,
                        border: isManual ? '2px solid var(--amber)' : '1px solid var(--border)',
                        background: isManual ? 'rgba(251,191,36,.08)' : 'var(--surface-2)',
                        color: isManual ? 'var(--amber)' : ptSets > 0 ? 'var(--txt)' : 'var(--txt-low)',
                        fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'center',
                        fontWeight: ptSets > 0 ? 700 : 400,
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td className="mono" style={{ fontWeight: ptH > 0 ? 600 : 400, color: ptOver ? 'var(--rose)' : ptH > 0 ? 'var(--txt)' : 'var(--txt-low)' }}>
                    {ptH > 0 ? ptH + 'h' : '---'}
                  </td>
                  <td>
                    {ptMin > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--grid-line)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(ptPct, 100)}%`, height: '100%', background: ptColor, borderRadius: 4 }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11, color: ptColor, minWidth: 36, textAlign: 'right' }}>{ptPct}%</span>
                      </div>
                    ) : <span style={{ color: 'var(--txt-low)', fontSize: 11 }}>---</span>}
                  </td>
                </tr>
              );
            })}

            {/* Daily totals row */}
            <tr style={{ fontWeight: 700, background: 'var(--grid-line)', borderTop: '2px solid var(--border)' }}>
              <td><strong>{t('wp.total_row')}</strong></td>
              <td />
              {DAYS.map(d => {
                const dMin = dayTotalMin(d.key);
                const dH   = +(dMin / 60).toFixed(2);
                const bc   = dayBarColor(dMin);
                const st   = dayStatusLabel(dMin);
                return (
                  <td key={d.key} className="mono" style={{ color: dMin > 0 ? bc : 'var(--txt-low)', fontWeight: 700 }}>
                    {dMin > 0 ? (
                      <div>
                        <div>{dH}h</div>
                        <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${Math.min(dMin / capDayMin * 100, 100)}%`, height: '100%', background: bc, borderRadius: 3 }} />
                        </div>
                      </div>
                    ) : '---'}
                  </td>
                );
              })}
              <td className="mono" style={{ color: weekTotalSets > 0 ? 'var(--txt)' : 'var(--txt-low)', fontWeight: 700 }}>
                {weekTotalSets > 0 ? weekTotalSets : '---'}
              </td>
              <td className="mono" style={{ color: weekOverload ? 'var(--rose)' : 'var(--txt)', fontWeight: 800 }}>
                {weekTotalH > 0 ? weekTotalH + 'h' : '---'}
              </td>
              <td>
                {weekTotalMin > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 10, background: 'var(--grid-line)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{ width: `${Math.min(weekUtil, 100)}%`, height: '100%', background: weekBarColor, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <span className="mono" style={{ fontSize: 12, color: weekBarColor, minWidth: 44, fontWeight: 700 }}>
                      {weekUtil}%{weekOverload ? ' !' : ''}
                    </span>
                  </div>
                ) : <span style={{ color: 'var(--txt-low)', fontSize: 11 }}>---</span>}
              </td>
            </tr>

            {/* % utilization per day */}
            <tr style={{ background: 'var(--surface-2)', fontSize: 11 }}>
              <td style={{ color: 'var(--txt-low)' }}>{t('wp.cap_day', { h: capDayH })}</td>
              <td />
              {DAYS.map(d => {
                const dMin = dayTotalMin(d.key);
                const pct  = dMin > 0 ? Math.round(dMin / capDayMin * 100) : 0;
                const bc   = dayBarColor(dMin);
                return (
                  <td key={d.key} className="mono" style={{ color: dMin > 0 ? bc : 'var(--txt-low)', fontWeight: 600, fontSize: 12 }}>
                    {dMin > 0 ? pct + '%' : '---'}
                  </td>
                );
              })}
              <td /><td />
              <td className="mono" style={{ color: weekBarColor, fontWeight: 700, fontSize: 12 }}>
                {weekTotalMin > 0 ? weekUtil + '%' : '---'}
              </td>
            </tr>

            {/* Status per day */}
            <tr style={{ background: 'var(--surface-2)' }}>
              <td style={{ color: 'var(--txt-low)', fontSize: 12 }}>{t('wp.status')}</td>
              <td />
              {DAYS.map(d => {
                const dMin = dayTotalMin(d.key);
                const st   = dayStatusLabel(dMin);
                return (
                  <td key={d.key}>
                    {st ? (
                      <span className={`foot ${st.cls}`} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                        {st.label}
                      </span>
                    ) : <span style={{ color: 'var(--txt-low)', fontSize: 10 }}>---</span>}
                  </td>
                );
              })}
              <td /><td />
              <td>
                {weekTotalMin > 0 ? (
                  <span className={`foot ${weekOverload ? 'alert' : weekUtil > 85 ? 'warn' : 'ok'}`}
                    style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                    {weekOverload ? t('status.overload') : weekUtil > 85 ? t('status.warn') : t('status.ok')}
                  </span>
                ) : <span style={{ color: 'var(--txt-low)', fontSize: 10 }}>---</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mono" style={{ marginTop: 8, color: 'var(--txt-low)', fontSize: 11 }}>
        {t('dp.capacity', { h: capDayH, n: shifts })} · {t('dp.capacity', { h: capDayH * 7, n: shifts })} · {t('wp.note')}
      </div>
    </div>
  );
}


export default function CMM() {
  const { t } = useLang();
  const [state, setState] = useState({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [dueFilter, setDueFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'category', dir: 1 });
  const [toggled, setToggled] = useState(() => new Set());
  const [showUnmatched, setShowUnmatched] = useState(false);

  const [avail, setAvail] = React.useState(95); // Machine Availability % (shared)

  function toggleExpand(id) {
    setToggled((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function isRowOpen(r, hasDetail) {
    if (!hasDetail) return false;
    const defaultOpen = r.status.toLowerCase() !== 'completed';
    return toggled.has(r.id) ? !defaultOpen : defaultOpen;
  }

  function scrollToTable() {
    setTimeout(() => {
      document.getElementById('records-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
  function applyCatFilter(c) { setCatFilter((p) => (p === c ? 'all' : c)); setDueFilter('all'); scrollToTable(); }
  function applyStatusFilter(s) { setStatusFilter((p) => (p === s ? 'all' : s)); setDueFilter('all'); scrollToTable(); }
  function applyDueFilter(d) { setDueFilter((p) => (p === d ? 'all' : d)); setStatusFilter('all'); scrollToTable(); }
  function clearFilters() { setCatFilter('all'); setStatusFilter('all'); setDueFilter('all'); setQuery(''); }

  async function fetchAll() {
    setState({ status: 'loading' });
    try {
      const { items, source, warning } = await loadData();
      setState({ status: 'ready', items, source, warning, loadedAt: new Date() });
    } catch (e) {
      setState({ status: 'error', message: e.message });
    }
  }
  useEffect(() => { fetchAll(); }, []);

  const items = state.items || [];
  const m = useMemo(() => computeMetrics(items), [items]);

  const catData = useMemo(() => {
    const g = groupBy(items, 'category');
    return [...g.entries()].map(([name, rows]) => ({
      name,
      target: rows.reduce((s, r) => s + r.target, 0),
      completed: rows.reduce((s, r) => s + r.completed, 0),
      count: rows.length,
    }));
  }, [items]);

  const statusData = useMemo(() => {
    const g = groupBy(items, 'status');
    return [...g.entries()].map(([name, rows]) => ({ name, value: rows.length }));
  }, [items]);

  const remainingLoad = useMemo(() => {
    // V172 Blade Bearing: std time per model step (not full set)
    const V172_MODEL_STD = {
      'inner 2': 240, 'inner 1': 250, 'outer': 180,
      'inner assemply': 45, 'outer radial + gap': 45, 'assemply': 120,
    };
    const stdMap = Object.fromEntries(PLANNER_PARTS.map(p => [p.part.toLowerCase(), p.stdMin]));
    let totalMin = 0, byPart = {};
    const unmatchedParts = {};
    items.forEach(r => {
      if (r.status.toLowerCase() === 'completed') return;
      const bal = r.balance || 0;
      if (bal <= 0) return;
      const key = r.partName?.toLowerCase() || '';
      // V172: use per-model std time
      if (key === 'v172 blade bearing' && r.model) {
        const modelStd = V172_MODEL_STD[r.model.toLowerCase()];
        if (modelStd) {
          const min = bal * modelStd;
          totalMin += min;
          const label = `V172 (${r.model})`;
          byPart[label] = (byPart[label] || 0) + min;
        } else {
          unmatchedParts[`V172 (${r.model})`] = (unmatchedParts[`V172 (${r.model})`] || 0) + 1;
        }
        return;
      }
      const std = stdMap[key];
      if (std) {
        const min = bal * std;
        totalMin += min;
        byPart[r.partName] = (byPart[r.partName] || 0) + min;
      } else {
        unmatchedParts[r.partName] = (unmatchedParts[r.partName] || 0) + 1;
      }
    });
    const totalH = Math.round(totalMin / 60 * 10) / 10;
    const totalDays = Math.round(totalH / 22 * 10) / 10;
    const totalWeeks = Math.round(totalH / 154 * 10) / 10;
    const top = Object.entries(byPart).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([p, m]) => ({ part: p, hours: Math.round(m / 60 * 10) / 10 }));
    const unmatchedList = Object.entries(unmatchedParts).map(([part, count]) => ({ part, count }));
    return { totalH, totalDays, totalWeeks, top, unmatchedList, unmatched: unmatchedList.length };
  }, [items]);

  const filtered = useMemo(() => {
    let r = items;
    if (catFilter !== 'all') r = r.filter((x) => x.category === catFilter);
    if (statusFilter !== 'all') r = r.filter((x) => x.status.toLowerCase() === statusFilter);
    if (dueFilter === 'overdue') {
      r = r.filter((x) => { const d = daysUntil(x.dueDate); return d != null && d < 0 && x.status.toLowerCase() !== 'completed'; });
    } else if (dueFilter === 'duesoon') {
      r = r.filter((x) => { const d = daysUntil(x.dueDate); return d != null && d >= 0 && d <= 7 && x.status.toLowerCase() !== 'completed'; });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((x) =>
        [x.partName, x.refNo, x.ringSN, x.features, x.comment]
          .filter(Boolean).some((f) => f.toString().toLowerCase().includes(q))
      );
    }
    const { key, dir } = sort;
    return [...r].sort((a, b) => {
      let av = a[key], bv = b[key];
      if (key === 'dueDate' || key === 'planDate') { av = av ? av.getTime() : Infinity; bv = bv ? bv.getTime() : Infinity; }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av == null) av = -Infinity;
      if (bv == null) bv = -Infinity;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [items, catFilter, statusFilter, dueFilter, query, sort]);

  const cats = useMemo(() => ['all', ...new Set(items.map((x) => x.category))], [items]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  }
  const arrow = (key) => (sort.key === key ? <span className="arrow">{sort.dir > 0 ? 'asc' : 'desc'}</span> : null);

  if (state.status === 'loading') {
    return (
      <div className="app"><div className="center-state"><div>
        <div className="spinner" />
        <div className="mono" style={{ color: 'var(--txt-mid)' }}>{t('misc.loading')}</div>
      </div></div></div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="app"><div className="center-state">
        <div className="err-box">
          <b>Khong tai duoc du lieu.</b><br />{state.message}
          <br /><br /><button className="refresh-btn" onClick={fetchAll}><RefreshCw size={13} /> Thu lai</button>
        </div>
      </div></div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-mark">
          <div className="brand-glyph"><Activity size={22} strokeWidth={2.2} /></div>
          <div className="brand-text">
            <h1>CMM Progress Dashboard</h1>
            <div className="sub">ITR · Inspection &amp; Shipment Tracking</div>
          </div>
        </div>
        <div className="topbar-meta">
          <span className={`src-pill ${state.source === 'sheets' ? 'drive' : 'sample'}`}>
            <span className="dot" />{state.source === 'sheets' ? 'Google Sheets' : t('misc.sample_data')}
          </span>
          <div style={{ marginTop: 6 }}>{t('misc.updated_at')} {state.loadedAt.toLocaleTimeString('vi-VN')}</div>
          <button className="refresh-btn" onClick={fetchAll}><RefreshCw size={13} /> {t('btn.reload')}</button>
        </div>
      </header>

      {state.warning && (
        <div className="warn-banner">
          <AlertTriangle size={15} />
          <span>{state.warning}</span>
        </div>
      )}

      <CollapsibleSection eyebrow={t('s01.eyebrow')} title={t('s01.title')} defaultOpen={false}>
        <DailyPlannerSection />
      </CollapsibleSection>

      <CollapsibleSection eyebrow={t('s01b.eyebrow')} title={t('s01b.title')} defaultOpen={false}>
        <WeeklyPlannerSection />
      </CollapsibleSection>

      <CollapsibleSection eyebrow={t('s02.eyebrow')} title={t('s02.title')} defaultOpen={true}>
        <StdTimeSection avail={avail} />
      </CollapsibleSection>

      <CollapsibleSection eyebrow={t('s02b.eyebrow')} title={t('s02b.title')}>
        <POCapacitySection avail={avail} setAvail={setAvail} />
      </CollapsibleSection>

      <SectionHead eyebrow={t('s03.eyebrow')} title={t('s03.title')} />
      <div className="kpi-grid">
        <div className="kpi" style={{ '--accent': 'var(--signal)' }}>
          <div className="label">{t('kpi.progress')}</div>
          <div className="ring-wrap">
            <ProgressRing value={m.overallProgress} />
            <div>
              <div className="ring-num">{pct(m.overallProgress)}</div>
              <div className="foot ok"><Package size={13} /> {m.totCompleted}/{m.totTarget} {t('kpi.completed')}</div>
            </div>
          </div>
        </div>
        <div className={`kpi clickable ${statusFilter === 'completed' ? 'active' : ''}`}
          style={{ '--accent': 'var(--signal)' }}
          onClick={() => applyStatusFilter('completed')}>
          <div className="label">{t('kpi.completed_lbl')}</div>
          <div className="value">{m.completedJobs}<small> / {m.totalJobs} job</small></div>
          <div className="foot ok"><CheckCircle2 size={13} /> {t('kpi.open_jobs', { n: m.openJobs })}</div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--amber)' }}>
          <div className="label">{t('kpi.balance')}</div>
          <div className="value">{m.totBalance}</div>
          <div className="foot warn"><Layers size={13} /> {t('kpi.balance_sub')}</div>
        </div>
        <div className={`kpi clickable ${dueFilter === 'overdue' ? 'active' : ''}`}
          style={{ '--accent': m.overdueCount ? 'var(--rose)' : 'var(--amber)' }}
          onClick={() => applyDueFilter('overdue')}>
          <div className="label">{t('kpi.due_warn')}</div>
          <div className="value">{m.overdueCount}<small> / {m.dueSoonCount} {t('kpi.due_soon_lbl')}</small></div>
          <div className={`foot ${m.overdueCount ? 'alert' : 'warn'}`}>
            <AlertTriangle size={13} /> {m.overdueCount ? t('kpi.jobs_overdue') : t('kpi.no_overdue')}
          </div>
        </div>
      </div>

      <SectionHead eyebrow={t('s04.eyebrow')} title={t('s04.title')} />
      <div className="charts-grid">
        {/* Volume by Category */}
        <div className="panel">
          <div className="panel-title">{t('chart.by_cat')}</div>
          <div className="panel-sub">{t('chart.by_cat_sub')}</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--txt-mid)', fontSize: 12, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--txt-low)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="target" name="Target" radius={[4, 4, 0, 0]} fill="var(--border-bright)" onClick={(d) => applyCatFilter(d.name)} style={{ cursor: 'pointer' }}>
                <LabelList dataKey="target" position="top" style={{ fontSize: 10, fill: 'var(--txt-low)' }} />
              </Bar>
              <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]} onClick={(d) => applyCatFilter(d.name)} style={{ cursor: 'pointer' }}>
                <LabelList dataKey="completed" position="top" style={{ fontSize: 10, fill: 'var(--txt-mid)' }} />
                {catData.map((d, i) => (
                  <Cell key={i} fill={catColor(d.name)} opacity={catFilter === 'all' || catFilter === d.name ? 1 : 0.35} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Category legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--txt-low)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--border-bright)' }} /> Target
            </span>
            {catData.map((d, i) => (
              <span key={d.name} className="legend-click" onClick={() => applyCatFilter(d.name)}
                style={{ fontSize: 10, color: 'var(--txt-low)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  opacity: catFilter === 'all' || catFilter === d.name ? 1 : 0.4 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: catColor(d.name) }} />
                {d.name} Completed
              </span>
            ))}
          </div>
        </div>

        {/* Job Status + CMM Remaining Hours */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Top: Pie + KPI side by side */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Pie */}
            <div style={{ flex: '0 0 180px' }}>
              <div className="panel-title" style={{ marginBottom: 2 }}>{t('chart.by_status')}</div>
              <div className="panel-sub" style={{ marginBottom: 4 }}>{t('chart.by_status_sub')}</div>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none"
                    onClick={(d) => applyStatusFilter(d.name.toLowerCase())} style={{ cursor: 'pointer' }}>
                    {statusData.map((d, i) => {
                      const on = statusFilter === 'all' || statusFilter === d.name.toLowerCase();
                      return <Cell key={i} fill={d.name.toLowerCase() === 'completed' ? 'var(--signal)' : 'var(--amber)'} opacity={on ? 1 : 0.35} />;
                    })}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: -4 }}>
                {statusData.map((d) => (
                  <span key={d.name} className="mono legend-click" onClick={() => applyStatusFilter(d.name.toLowerCase())}
                    style={{ fontSize: 11, color: 'var(--txt-mid)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <span className="dot" style={{ background: d.name.toLowerCase() === 'completed' ? 'var(--signal)' : 'var(--amber)' }} />
                    {d.name} <strong>{d.value}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* CMM Remaining Hours */}
            <div style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Clock size={13} style={{ color: 'var(--amber)' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt-mid)' }}>CMM Hours còn lại</span>
                <span style={{ fontSize: 10, color: 'var(--txt-low)' }}>(open jobs × std time)</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--amber)', lineHeight: 1, marginBottom: 4 }}>
                {remainingLoad.totalH}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--txt-mid)', marginLeft: 4 }}>h</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--txt-low)', marginBottom: 10 }}>
                ≈ <strong style={{ color: 'var(--txt-mid)' }}>{remainingLoad.totalDays} ngày</strong> (620 min/ca × 2 ca)&nbsp;·&nbsp;
                <strong style={{ color: 'var(--txt-mid)' }}>{remainingLoad.totalWeeks} tuần</strong> (154h/tuần)
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt-low)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Top parts (giờ còn lại)
                </div>
                {remainingLoad.top.map((p, i) => (
                  <div key={p.part} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--txt-low)', width: 12, textAlign: 'right' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.part}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>{p.hours}h</span>
                  </div>
                ))}
                {remainingLoad.unmatched > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <button onClick={() => setShowUnmatched(s => !s)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: 'var(--txt-low)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--rose)' }}>⚠</span>
                      <span style={{ textDecoration: 'underline dotted' }}>
                        + {remainingLoad.unmatched} part chưa có std time {showUnmatched ? '▲' : '▼'}
                      </span>
                    </button>
                    {showUnmatched && (
                      <div style={{ marginTop: 4, padding: '6px 8px', background: 'rgba(244,63,94,0.08)', borderRadius: 6, border: '1px solid rgba(244,63,94,0.2)' }}>
                        {remainingLoad.unmatchedList.map(({ part, count }) => (
                          <div key={part} style={{ fontSize: 10, color: 'var(--txt-mid)', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span>{part}</span>
                            <span className="mono" style={{ color: 'var(--txt-low)' }}>{count} job</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionHead eyebrow={t('s05.eyebrow')} title={t('s05.title')} />
      <div className="charts-grid">
        <div className="panel">
          <div className="panel-title clickable-title" style={{ color: 'var(--rose)' }} onClick={() => applyDueFilter('overdue')}>Qua han</div>
          <div className="panel-sub">{m.overdue.length} job · nhan de loc bang</div>
          {m.overdue.length === 0
            ? <div className="empty-note">Khong co job nao qua han.</div>
            : <DueList rows={m.overdue} accent="var(--rose)" />}
        </div>
        <div className="panel">
          <div className="panel-title clickable-title" style={{ color: 'var(--amber)' }} onClick={() => applyDueFilter('duesoon')}>Sap den han (7 ngay)</div>
          <div className="panel-sub">{m.dueSoon.length} job</div>
          {m.dueSoon.length === 0
            ? <div className="empty-note">Khong co job nao trong 7 ngay toi.</div>
            : <DueList rows={m.dueSoon} accent="var(--amber)" />}
        </div>
      </div>

      <SectionHead eyebrow={t('s06.eyebrow')} title={t('s06.title')} />
      <div id="records-table">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Search size={14} style={{ color: 'var(--txt-low)' }} />
          <input
            className="search-box"
            placeholder={t('misc.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {(catFilter !== 'all' || statusFilter !== 'all' || dueFilter !== 'all' || query) && (
            <button className="af-clear" onClick={clearFilters}>Xoa loc x</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div className="chips">
            {cats.map((c) => (
              <button key={c} className={`chip ${catFilter === c ? 'active' : ''}`}
                onClick={() => { setCatFilter(c); setDueFilter('all'); }}>
                {c === 'all' ? 'Tat ca category' : c}
              </button>
            ))}
          </div>
          <div className="chips">
            {['all', 'open', 'completed'].map((s) => (
              <button key={s} className={`chip ${statusFilter === s ? 'active' : ''}`}
                onClick={() => { setStatusFilter(s); setDueFilter('all'); }}>
                {s === 'all' ? 'Moi status' : s}
              </button>
            ))}
          </div>
        </div>

        <div className="tbl-scroll">
          <table className="itr">
            <thead>
              <tr>
                <th className="th-expand"></th>
                <th onClick={() => toggleSort('category')}>Cat {arrow('category')}</th>
                <th onClick={() => toggleSort('partName')}>Part Name {arrow('partName')}</th>
                <th onClick={() => toggleSort('refNo')}>Ref No {arrow('refNo')}</th>
                <th onClick={() => toggleSort('ringSN')}>Ring SN {arrow('ringSN')}</th>
                <th onClick={() => toggleSort('target')}>Target {arrow('target')}</th>
                <th onClick={() => toggleSort('completed')}>Done {arrow('completed')}</th>
                <th onClick={() => toggleSort('balance')}>Bal {arrow('balance')}</th>
                <th onClick={() => toggleSort('progress')}>Progress {arrow('progress')}</th>
                <th onClick={() => toggleSort('dueDate')}>Due Date {arrow('dueDate')}</th>
                <th onClick={() => toggleSort('status')}>Status {arrow('status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const du = daysUntil(r.dueDate);
                const isComplete = r.status.toLowerCase() === 'completed';
                const dueCls = !r.dueDate ? 'ok' : (du < 0 && !isComplete) ? 'overdue' : (du <= 7 && !isComplete) ? 'soon' : 'ok';
                const hasDetail = r.features || r.comment;
                const isExpanded = isRowOpen(r, hasDetail);
                const catCls = r.category ? r.category.split('/').join('-').replace(/\s+/g, '_') : '';
                return (
                  <React.Fragment key={r.id}>
                    <tr className={isComplete ? 'row-done' : ''}>
                      <td className="td-expand">
                        {hasDetail && (
                          <button className="expand-btn" onClick={() => toggleExpand(r.id)} title="Xem CMM Features & Comment">
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        )}
                      </td>
                      <td><span className={`badge cat-${catCls}`}>{r.category}</span></td>
                      <td style={{ fontWeight: 500 }}>{r.partName}</td>
                      <td className="mono">{r.refNo || '—'}</td>
                      <td className="mono">{r.ringSN || '—'}</td>
                      <td className="mono">{r.target}</td>
                      <td className="mono">{r.completed}</td>
                      <td className="mono" style={{ color: r.balance > 0 ? 'var(--amber)' : 'var(--signal)', fontWeight: 600 }}>{r.balance}</td>
                      <td><UtilBar pct={Math.round(r.progress * 100)} /></td>
                      <td className={`mono due-${dueCls}`}>
                        {r.dueDate ? (
                          <span>
                            {fmtDate(r.dueDate)}
                            {!isComplete && du != null && (
                              <><br /><span className={`due-badge ${dueCls}`}>
                                {du < 0 ? `${Math.abs(du)} ${t('kpi.days_ago')}` : `${du} ${t('kpi.days_left')}`}
                              </span></>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge status-${r.status.toLowerCase()}`}>{r.status}</span>
                      </td>
                    </tr>
                    {isExpanded && hasDetail && (
                      <tr className="row-detail">
                        <td colSpan={11}>
                          <div className="detail-inner">
                            {r.features && (
                              <div><strong>CMM Features:</strong> {r.features}</div>
                            )}
                            {r.comment && (
                              <div style={{ marginTop: r.features ? 4 : 0 }}><strong>Comment:</strong> {r.comment}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              </tbody>
            </table>
          </div>
          <div className="tbl-foot">
            <span className="mono" style={{ fontSize: 11, color: 'var(--txt-low)' }}>
              {t('tbl.showing', { n: filtered.length, total: items.length })}
            </span>
          </div>
        </div>

    </div>
  );
}
