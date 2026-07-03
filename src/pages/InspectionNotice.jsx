import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { getAccessToken } from "../cmmSupabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, ReferenceLine, LabelList,
  ComposedChart, Line,
} from "recharts";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const TOKEN_KEY     = "ncr_jwt";
const SHEET_IN      = "LIST";
const SHEET_NCR     = "Quality Status (HQ)";
const HEADER_ROW_IN = 4;

// ── TOKEN HELPERS ─────────────────────────────────────────────────────────────
const getToken   = () => sessionStorage.getItem(TOKEN_KEY);
const saveToken  = t  => sessionStorage.setItem(TOKEN_KEY, t);
const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

function tokenExpired(token) {
  try {
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
    return p.exp ? Date.now() / 1000 > p.exp : false;
  } catch { return true; }
}
async function apiAuth(password) {
  const r = await fetch("/api/auth", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Incorrect password.");
  saveToken(d.token);
}
async function apiFetch(file) {
  const token = await getAccessToken();
  const r = await fetch(`/api/inspection?file=${file}`, {
    headers:{ Authorization:`Bearer ${token}` },
  });
  if (r.status === 401 || r.status === 403) throw new Error("SESSION_EXPIRED");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.arrayBuffer();
}

// ── DESIGN TOKENS — unified across both tabs ──────────────────────────────────
const C = {
  // neutrals
  navy:    "#0f172a",
  navyMid: "#1e293b",
  bg:      "#f1f5f9",
  surface: "#ffffff",
  border:  "#e2e8f0",
  muted:   "#94a3b8",
  text:    "#0f172a",
  sub:     "#64748b",
  rowAlt:  "#f8fafc",
  // accents
  blue:    "#3b82f6",
  teal:    "#14b8a6",
  green:   "#22c55e",
  amber:   "#f59e0b",
  red:     "#ef4444",
  purple:  "#a855f7",
  indigo:  "#6366f1",
  sky:     "#38bdf8",
  cyan:    "#06b6d4",
  pink:    "#ec4899",
  slate:   "#94a3b8",
  ok:      "#16a34a",
  warn:    "#dc2626",
};

// KPI gradient pairs [from, to]
const G = {
  blue:    ["#2563eb","#3b82f6"],
  red:     ["#dc2626","#ef4444"],
  amber:   ["#d97706","#f59e0b"],
  green:   ["#16a34a","#22c55e"],
  teal:    ["#0d9488","#14b8a6"],
  purple:  ["#7c3aed","#a855f7"],
  cyan:    ["#0891b2","#06b6d4"],
  indigo:  ["#4338ca","#6366f1"],
  pink:    ["#db2777","#ec4899"],
  orange:  ["#ea580c","#f97316"],
};

const BAR_PALETTE = [C.blue,C.teal,C.green,C.amber,C.purple,C.red,C.indigo,C.sky];
const RESULT_COLOR_MAP = {
  "NCR Closed":C.green,"Concession":C.teal,"Disposal":C.red,
  "Repair":C.blue,"Rework":C.purple,"Holding":C.amber,
  "Waiting":C.amber,"Special Request":C.slate,
};
const rColor = v => {
  if (!v) return C.slate;
  const h = Object.entries(RESULT_COLOR_MAP).find(([k])=>v.includes(k));
  return h ? h[1] : C.slate;
};

// ── PARSERS ───────────────────────────────────────────────────────────────────
const sv  = (r,k) => (r[k]??'').toString().trim();
const uniq = (arr,k) => [...new Set(arr.map(r=>sv(r,k)).filter(Boolean))].sort();
const num = v => {
  if (v==null||v===''||v==='-') return 0;
  const n = parseFloat(String(v).replace(/[%,\s]/g,''));
  return isNaN(n) ? 0 : n;
};
const toFixed = (v, d=2) => {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(d);
};
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const excelDate = s => {
  if (!s||isNaN(Number(s))) return String(s??'');
  const d = new Date(Math.round((Number(s)-25569)*86400*1000));
  return `${MN[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
};
function countBy(arr,key) {
  const m={};
  arr.forEach(r=>{ const x=sv(r,key)||'—'; m[x]=(m[x]||0)+1; });
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}
function parseIN(buf) {
  const wb = XLSX.read(buf,{type:'array',cellDates:true});
  if (!wb.SheetNames.includes(SHEET_IN)) throw new Error(`Sheet "${SHEET_IN}" not found.`);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_IN],{header:1,defval:null});

  // Use fixed column index map to avoid duplicate header name overwrites
  // Sheet has 3 cols named "Issue No." (cols 2, 7, 9) — must map by position
  const COL = {
    1:'No.',2:'Issue No.',3:'Issue Date',4:'Check Space',
    5:'Ring SN',6:"S/N & Ass'y No",
    7:'NCR Issue No.',8:'NCR Issue Date',
    9:'SR Issue No.',10:'SR Issue Date',
    11:'HQ',12:'Year',13:'Month',14:'Week',
    15:'Facility Accuracy',16:'Process',17:'Facility',18:'Supplier',
    19:'Product name',20:'Main Category #1',21:'Main Category #2',
    22:'Sub category',23:'Defect description',24:'Processing Results',
    25:'CSB or Supplier',26:'Scrap',27:'Main Cause#1',
    28:'Middle Cause#2',29:'Sub Cause',30:'Closing Date',
    31:'QA Incharge',32:'Remark',33:'Status',
  };

  // Filter by Ring SN (col 5) — col 1 (No.) is blank for sub-rows sharing same Issue No.
  return raw.slice(HEADER_ROW_IN+1).filter(r=>r[5]!=null)
    .map(r=>{ const o={}; Object.entries(COL).forEach(([i,k])=>{ o[k]=r[+i]??null; }); return o; });
}
function parseNCR(buf) {
  const wb = XLSX.read(buf,{type:'array'});
  if (!wb.SheetNames.includes(SHEET_NCR))
    throw new Error(`Sheet "${SHEET_NCR}" not found. Available: ${wb.SheetNames.join(', ')}`);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NCR],{header:1,defval:null});
  let ncrRow=-1;
  for(let i=0;i<Math.min(raw.length,40);i++){
    if(String(raw[i]?.[0]??'').trim()==='NCR Rate'){ncrRow=i;break;}
  }
  if(ncrRow===-1) throw new Error("Cannot locate 'NCR Rate' row in sheet.");
  const hr=raw[ncrRow], ir=raw[ncrRow+1], nr=raw[ncrRow+2], dr=raw[ncrRow+3], cr=raw[ncrRow+4];
  const mLabels=[]; for(let c=2;c<=13;c++){const v=hr[c]; mLabels.push(typeof v==='number'&&v>40000?excelDate(v):String(v??''));}
  const wLabels=[]; for(let c=15;c<=19;c++) wLabels.push(String(hr[c]??`FW${c-14+15}`));
  let target=0.0015, cumDef=0;
  for(let i=0;i<Math.min(raw.length,15);i++){
    const a=String(raw[i]?.[0]??'').trim().toLowerCase();
    if(a.includes('y2026 target')&&i<5){const v=raw[i+1]?.[0]??raw[i+2]?.[0]; if(v!=null) target=num(v);}
    if(a.includes('cumulative')&&a.includes('defect rate')){const v=raw[i+1]?.[0]??raw[i+2]?.[0]; if(v!=null) cumDef=num(v);}
  }
  if(!cumDef) cumDef=num(cr?.[14]);
  const targetPct=target*100, cumDefPct=cumDef*100;
  const allM=[{label:'2025',col:1},...mLabels.map((label,i)=>({label,col:i+2}))];
  const monthly=allM.map(({label,col})=>({
    month:label, input:num(ir?.[col]), ncr:num(nr?.[col]),
    defect: num(ir?.[col])>0 ? parseFloat((num(dr?.[col])*100).toFixed(4)) : null,
    cumulative: num(ir?.[col])>0 ? parseFloat((num(cr?.[col])*100).toFixed(4)) : null,
  }));
  const weekly=wLabels.map((label,i)=>({
    week:label, input:num(ir?.[15+i]), ncr:num(nr?.[15+i]),
    defect:parseFloat((num(dr?.[15+i])*100).toFixed(4)),
  }));
  const PROCS=["Turning","Boring","Gear Cutting","Induction","Drilling","Hard Turning","Assembly","Coating","Total"];
  const processRows=[];
  for(let i=ncrRow+6;i<Math.min(raw.length,ncrRow+30);i++){
    const a=String(raw[i]?.[0]??'').trim();
    if(!PROCS.includes(a)) continue;
    processRows.push({process:a,ncr2025:num(raw[i]?.[1]),months:mLabels.map((_,mi)=>num(raw[i]?.[mi+2])),total:num(raw[i]?.[14]),weeks:wLabels.map((_,wi)=>num(raw[i]?.[15+wi])),weekTotal:num(raw[i]?.[20]),isTotal:a==='Total'});
    if(a==='Total') break;
  }
  return {targetPct,cumDefPct,totalInput:num(ir?.[14]),totalNcr:num(nr?.[14]),monthly,weekly,mLabels,wLabels,processRows};
}

// ── useWidth ──────────────────────────────────────────────────────────────────
function useWidth() {
  const [w,setW]=useState(typeof window!=='undefined'?window.innerWidth:1200);
  useEffect(()=>{
    const fn=()=>setW(window.innerWidth);
    window.addEventListener('resize',fn);
    return()=>window.removeEventListener('resize',fn);
  },[]);
  return w;
}

// ── SHARED UI COMPONENTS ──────────────────────────────────────────────────────
function Spin({color=C.blue,size=32}) {
  return <div style={{width:size,height:size,border:`3px solid rgba(0,0,0,.08)`,borderTopColor:color,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>;
}

// Unified KPI card — flat design, color accent bar on top
// grad = [color1, color2] for gradient card; accent = single color for flat card
function KpiCard({label,value,sub,grad}) {
  return (
    <div style={{
      background:`linear-gradient(135deg,${grad[0]},${grad[1]})`,
      borderRadius:14,padding:'16px 18px',flex:1,minWidth:130,
      color:'#fff',boxShadow:`0 10px 28px -14px ${grad[0]}88`,
      position:'relative',overflow:'hidden',
    }}>
      <div style={{position:'absolute',top:-28,right:-28,width:90,height:90,
                   background:'rgba(255,255,255,.15)',borderRadius:'50%'}}/>
      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',
                   opacity:.9,marginBottom:8,position:'relative'}}>{label}</div>
      <div style={{fontSize:30,fontWeight:800,lineHeight:1,position:'relative',letterSpacing:'-.02em'}}>{value}</div>
      {sub&&<div style={{fontSize:11,opacity:.85,marginTop:6,position:'relative'}}>{sub}</div>}
    </div>
  );
}

// Unified chart card
function Card({title,children,style={}}) {
  return (
    <div style={{background:C.surface,borderRadius:12,padding:'16px',border:`1px solid ${C.border}`,...style}}>
      <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',
                   letterSpacing:'.6px',marginBottom:12,paddingBottom:10,
                   borderBottom:`1px solid ${C.border}`}}>{title}</div>
      {children}
    </div>
  );
}

function Sel({label,opts,value,onChange}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <span style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600}}>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{padding:'8px 10px',border:`1px solid ${C.border}`,borderRadius:8,
                fontSize:12,background:C.surface,color:'#334155',outline:'none',cursor:'pointer'}}>
        <option value=''>All</option>
        {opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// Badge for Processing Results
const BADGE_MAP = {
  'NCR Closed':[C.green,'#fff'],'Concession':[C.teal,'#fff'],'Disposal':[C.red,'#fff'],
  'Repair':[C.blue,'#fff'],'Rework':[C.purple,'#fff'],'Holding':[C.amber,'#fff'],
  'Waiting':[C.amber,'#fff'],'Special Request':[C.slate,'#fff'],
};
function Badge({v}) {
  if(!v) return <span style={{color:C.muted}}>—</span>;
  const hit=Object.entries(BADGE_MAP).find(([k])=>v.includes(k));
  const [bg,color]=hit?hit[1]:['#e2e8f0','#475569'];
  return <span style={{background:bg,color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{v}</span>;
}

// Unified bar tooltip
function BarTip({active,payload,label}) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.navy,borderRadius:8,padding:'8px 12px',fontSize:12,
                 color:'#f8fafc',boxShadow:'0 4px 16px rgba(0,0,0,.25)'}}>
      <div style={{color:C.muted,fontSize:11,marginBottom:2}}>{label}</div>
      <div style={{fontWeight:700,fontSize:15}}>{payload[0].value}</div>
    </div>
  );
}

// Unified area/line tooltip
function LineTip({active,payload,label}) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.navy,borderRadius:8,padding:'10px 14px',fontSize:12,
                 color:'#f8fafc',boxShadow:'0 4px 16px rgba(0,0,0,.25)'}}>
      <div style={{fontWeight:700,marginBottom:6,color:C.muted,fontSize:11}}>{label}</div>
      {payload.map(p=>(
        <div key={p.name} style={{display:'flex',alignItems:'center',gap:7,marginTop:3}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:p.color,display:'inline-block'}}/>
          <span style={{color:'#cbd5e1'}}>{p.name}:</span>
          <strong>{p.value!=null ? toFixed(p.value,3)+'%' : '—'}</strong>
        </div>
      ))}
    </div>
  );
}

// Custom dot with value label on area chart
function DotWithLabel(props) {
  const {cx,cy,stroke,dataKey,payload} = props;
  if (!cx||!cy) return <g/>;
  // Read the actual value from the data payload using the dataKey
  const raw = payload?.[dataKey];
  const n = typeof raw==='number' ? raw : parseFloat(raw);
  if (isNaN(n)||raw==null) return <circle cx={cx} cy={cy} r={2} fill={stroke} opacity={0.2}/>;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={stroke} stroke="#fff" strokeWidth={1.5}/>
      <text x={cx} y={cy-10} textAnchor="middle" fill={stroke} fontSize={9} fontWeight={700}>
        {n.toFixed(2)}%
      </text>
    </g>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({onSuccess}) {
  const [pw,setPw]=useState(''); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await apiAuth(pw); onSuccess(); }
    catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div style={{minHeight:'100vh',
      background:'radial-gradient(ellipse 120% 80% at 60% -10%, #1a2f5e 0%, #0b1220 55%, #0f1f3a 100%)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:400,textAlign:'center'}}>
        {/* Icon */}
        <div style={{width:72,height:72,borderRadius:20,margin:'0 auto 20px',
          background:'linear-gradient(135deg,#4338ca,#06b6d4)',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:'0 16px 40px -12px rgba(67,56,202,.7)',fontSize:34}}>🔒</div>
        {/* Title */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',
                     color:'#06b6d4',marginBottom:8}}>Inspection Notice & Nonconformance Monitoring</div>
        <h1 style={{color:'#f8fafc',fontSize:24,fontWeight:800,margin:'0 0 6px',letterSpacing:'-.03em',lineHeight:1.2}}>
          Quality Management<br/>Dashboard
        </h1>
        <p style={{color:'#475569',fontSize:13,margin:'0 0 28px'}}>Enter the access password to continue</p>
        {/* Card */}
        <div style={{background:'rgba(255,255,255,.05)',backdropFilter:'blur(20px)',
                     borderRadius:20,padding:'28px 28px 24px',
                     border:'1px solid rgba(255,255,255,.1)',
                     boxShadow:'0 32px 64px rgba(0,0,0,.5)'}}>
          <form onSubmit={submit}>
            <input type='password' placeholder='Password' value={pw}
              onChange={e=>setPw(e.target.value)} autoFocus
              style={{width:'100%',padding:'13px 16px',borderRadius:12,marginBottom:12,boxSizing:'border-box',
                      border:`1.5px solid ${err?'rgba(239,68,68,.5)':'rgba(255,255,255,.1)'}`,
                      background:'rgba(255,255,255,.07)',color:'#f8fafc',fontSize:14,outline:'none',
                      letterSpacing:'.05em'}}/>
            {err&&(
            <div style={{
              background: err.includes('Too many') ? 'rgba(239,68,68,.2)' : 'rgba(239,68,68,.12)',
              border: `1px solid ${err.includes('Too many') ? 'rgba(239,68,68,.5)' : 'rgba(239,68,68,.25)'}`,
              borderRadius:10,padding:'10px 14px',marginBottom:12,
              color:'#fca5a5',fontSize:12,textAlign:'left',lineHeight:1.5,
            }}>
              {err.includes('Too many') ? '🔒 ' : '⚠ '}{err}
            </div>
          )}
            <button type='submit' disabled={busy||!pw||!!(err&&err.includes('Too many'))}
              style={{width:'100%',padding:14,borderRadius:12,border:'none',fontSize:15,fontWeight:700,
                      background:busy||!pw?'rgba(255,255,255,.07)':'linear-gradient(135deg,#4338ca,#06b6d4)',
                      color:busy||!pw?'#334155':'#fff',cursor:busy||!pw?'not-allowed':'pointer',
                      boxShadow:busy||!pw?'none':'0 10px 28px -8px rgba(67,56,202,.65)',
                      transition:'all .2s',letterSpacing:'.01em'}}>
              {busy
                ? <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <Spin color="#fff" size={16}/> Verifying…
                  </span>
                : 'Unlock →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── INSPECTION NOTICE TAB ─────────────────────────────────────────────────────
function InspectionTab({onExpired,cachedData,onDataLoaded}) {
  const width=useWidth(); const isMobile=width<640; const isTablet=width<960;
  const [rows,setRows]           = useState(cachedData||[]);
  const [loading,setLoading]     = useState(!cachedData);
  const [error,setError]         = useState(null);
  const [updatedAt,setUpdatedAt] = useState(null);
  const [showF,setShowF]         = useState(false);
  const [filters,setFilters]     = useState({year:'',month:'',week:'',process:'',nonconf:'',sub:'',product:'',result:'',supplier:''});
  const yearDefaulted            = useRef(false); // chỉ set năm mặc định một lần
  const setF=(k,x)=>setFilters(f=>({...f,[k]:x}));
  const activeCount=Object.values(filters).filter(Boolean).length;

  const fetchData=useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const buf=await apiFetch('in');
      const parsed=parseIN(buf);
      setRows(parsed);
      onDataLoaded('in',parsed);
      setUpdatedAt(new Date().toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}));
    } catch(e){
      if(e.message==='SESSION_EXPIRED') onExpired();
      else setError(e.message);
    } finally { setLoading(false); }
  },[onExpired,onDataLoaded]);

  useEffect(()=>{ if(!cachedData) fetchData(); },[fetchData,cachedData]);

  const opts=useMemo(()=>({
    year:uniq(rows,'Year').filter(y=>+y>=2023),
    month:[...new Set(rows.map(r=>sv(r,'Month')).filter(Boolean))].sort((a,b)=>+a-+b),
    process:uniq(rows,'Process'),
    nonconf:uniq(rows,'Main Category #1'),result:uniq(rows,'Processing Results'),
    supplier:uniq(rows,'CSB or Supplier'),
  }),[rows]);

  // Mặc định chọn năm MỚI NHẤT có trong dữ liệu (tự nhảy sang 2027… khi có data),
  // chỉ set một lần và chỉ khi người dùng chưa tự chọn năm.
  useEffect(()=>{
    if(yearDefaulted.current) return;
    if(opts.year.length===0) return;
    const latest=opts.year.map(Number).filter(n=>!isNaN(n)).sort((a,b)=>b-a)[0];
    if(latest){ setF('year',String(latest)); yearDefaulted.current=true; }
  },[opts.year]);

  const data=useMemo(()=>rows.filter(r=>{
    if(filters.year     &&sv(r,'Year')              !==filters.year)     return false;
    if(filters.month    &&sv(r,'Month')             !==filters.month)    return false;
    if(filters.process  &&sv(r,'Process')           !==filters.process)  return false;
    if(filters.nonconf  &&sv(r,'Main Category #1')  !==filters.nonconf)  return false;
    if(filters.sub      &&sv(r,'Sub category')      !==filters.sub)      return false;
    if(filters.product  &&sv(r,'Product name').slice(0,20)+'…'!==filters.product&&sv(r,'Product name')!==filters.product) return false;
    if(filters.week     &&sv(r,'Week')              !==filters.week)     return false;
    if(filters.result   &&sv(r,'Processing Results')!==filters.result)   return false;
    if(filters.supplier &&sv(r,'CSB or Supplier')   !==filters.supplier) return false;
    return true;
  }),[rows,filters]);

  const MNAMES=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_NUM=Object.fromEntries(MNAMES.slice(1).map((m,i)=>[m,String(i+1)]));

  // For month chart: filter all except month (so all months show)
  const dataNoMonth=useMemo(()=>rows.filter(r=>{
    if(filters.year     &&sv(r,'Year')              !==filters.year)     return false;
    if(filters.process  &&sv(r,'Process')           !==filters.process)  return false;
    if(filters.nonconf  &&sv(r,'Main Category #1')  !==filters.nonconf)  return false;
    if(filters.sub      &&sv(r,'Sub category')      !==filters.sub)      return false;
    if(filters.product  &&sv(r,'Product name').slice(0,20)+'…'!==filters.product&&sv(r,'Product name')!==filters.product) return false;
    if(filters.week     &&sv(r,'Week')              !==filters.week)     return false;
    if(filters.result   &&sv(r,'Processing Results')!==filters.result)   return false;
    if(filters.supplier &&sv(r,'CSB or Supplier')   !==filters.supplier) return false;
    return true;
  }),[rows,filters.year,filters.process,filters.nonconf,filters.sub,filters.product,filters.result,filters.supplier]);

  // For year chart: filter all except year (so all years show)
  const dataNoYear=useMemo(()=>rows.filter(r=>{
    if(filters.month    &&sv(r,'Month')             !==filters.month)    return false;
    if(filters.process  &&sv(r,'Process')           !==filters.process)  return false;
    if(filters.nonconf  &&sv(r,'Main Category #1')  !==filters.nonconf)  return false;
    if(filters.sub      &&sv(r,'Sub category')      !==filters.sub)      return false;
    if(filters.product  &&sv(r,'Product name').slice(0,20)+'…'!==filters.product&&sv(r,'Product name')!==filters.product) return false;
    if(filters.week     &&sv(r,'Week')              !==filters.week)     return false;
    if(filters.result   &&sv(r,'Processing Results')!==filters.result)   return false;
    if(filters.supplier &&sv(r,'CSB or Supplier')   !==filters.supplier) return false;
    return true;
  }),[rows,filters.month,filters.process,filters.nonconf,filters.sub,filters.product,filters.result,filters.supplier]);

  // For week chart: filter all except week (so all weeks show)
  const dataNoWeek=useMemo(()=>rows.filter(r=>{
    if(filters.year     &&sv(r,'Year')              !==filters.year)     return false;
    if(filters.month    &&sv(r,'Month')             !==filters.month)    return false;
    if(filters.process  &&sv(r,'Process')           !==filters.process)  return false;
    if(filters.nonconf  &&sv(r,'Main Category #1')  !==filters.nonconf)  return false;
    if(filters.sub      &&sv(r,'Sub category')      !==filters.sub)      return false;
    if(filters.product  &&sv(r,'Product name').slice(0,20)+'…'!==filters.product&&sv(r,'Product name')!==filters.product) return false;
    if(filters.result   &&sv(r,'Processing Results')!==filters.result)   return false;
    if(filters.supplier &&sv(r,'CSB or Supplier')   !==filters.supplier) return false;
    return true;
  }),[rows,filters.year,filters.month,filters.process,filters.nonconf,filters.sub,filters.product,filters.result,filters.supplier]);

  const agg=useMemo(()=>{
    // Helper: count unique Ring SN grouped by a key field
    function countUniqRing(arr, keyFn) {
      const m={};
      arr.forEach(r=>{ const k=keyFn(r); const ring=sv(r,'Ring SN'); if(!k||!ring) return; if(!m[k]) m[k]=new Set(); m[k].add(ring); });
      return Object.entries(m).map(([name,s])=>([name,s.size])).sort((a,b)=>b[1]-a[1]);
    }

    // Month — unique Ring SN per month
    const bm={}; dataNoMonth.forEach(r=>{ const m=r['Month']; const ring=sv(r,'Ring SN'); if(m==null||!ring) return; const k=MNAMES[+m]||'M'+m; if(!bm[k]) bm[k]=new Set(); bm[k].add(ring); });
    const monthData=MNAMES.filter(Boolean).filter(k=>bm[k]).map(k=>({name:k,v:bm[k].size}));

    // Year — unique Ring SN per year
    const by={}; dataNoYear.forEach(r=>{ const y=sv(r,'Year'); const ring=sv(r,'Ring SN'); if(!y||!ring) return; if(!by[y]) by[y]=new Set(); by[y].add(ring); });
    const yearData=Object.entries(by).sort((a,b)=>a[0]-b[0]).filter(([name])=>+name>=2023).map(([name,v])=>({name,v:v.size}));

    // Helper: top N by unique Ring SN, truncate label
    const topRing=(key,n,ml=18)=>countUniqRing(data,r=>sv(r,key)).slice(0,n)
      .map(([name,v])=>({name:name.length>ml?name.slice(0,ml)+'…':name,v}));

    return {
      monthData, yearData,
      resultData:  countUniqRing(data,r=>sv(r,'Processing Results')).slice(0,8).map(([name,v])=>({name,v})),
      processData: topRing('Process',8),
      nonconfData: topRing('Main Category #1',6),
      subData:     topRing('Sub category',8),
      productData: topRing('Product name',8,32),
      weeklyData:  (()=>{
        // Group unique Ring SN by year+week (ignore week filter so all 5 weeks show)
        const wk={};
        dataNoWeek.forEach(r=>{
          const y=sv(r,'Year'), w=sv(r,'Week'), ring=sv(r,'Ring SN');
          if(!y||!w||!ring) return;
          const key=`${y}-${String(w).padStart(2,'0')}`;
          if(!wk[key]) wk[key]=new Set();
          wk[key].add(ring);
        });
        const sorted=Object.entries(wk).sort((a,b)=>a[0].localeCompare(b[0]));
        const last5=sorted.slice(-5);
        return last5.map(([key,s])=>({ name:`Week ${+key.split('-')[1]}`, week:String(+key.split('-')[1]), v:s.size }));
      })(),
    };
  },[data,dataNoMonth,dataNoYear,dataNoWeek]);

  const kpis=useMemo(()=>{
    const uniqRings=(fn)=>new Set(data.filter(fn).map(r=>sv(r,'Ring SN')).filter(Boolean)).size;
    return {
      defectiveRings: new Set(data.map(r=>sv(r,'Ring SN')).filter(Boolean)).size,
      reports:        new Set(data.map(r=>sv(r,'Issue No.')).filter(Boolean)).size,
      disposal:   uniqRings(r=>sv(r,'Processing Results').includes('Disposal')),
      waiting:    uniqRings(r=>sv(r,'Status').includes('Waiting')),
      closed:     uniqRings(r=>sv(r,'Processing Results').includes('Closed')),
      concession: uniqRings(r=>sv(r,'Processing Results').includes('Concession')),
      repair:     uniqRings(r=>{ const x=sv(r,'Processing Results'); return x.includes('Repair')||x.includes('Rework'); }),
    };
  },[data]);

  const gap=isMobile?10:14; const p=isMobile?12:20;

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:320,gap:12}}><Spin color={C.blue}/><span style={{color:C.muted,fontSize:13}}>Loading Inspection Notice…</span></div>;
  if(error)   return <div style={{textAlign:'center',padding:48}}><div style={{fontSize:36,marginBottom:12}}>⚠️</div><p style={{color:C.warn,marginBottom:12,fontSize:14}}>{error}</p><button onClick={fetchData} style={{padding:'8px 20px',background:C.blue,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600}}>Retry</button></div>;

  return (
    <div style={{padding:`${gap}px ${p}px 32px`,maxWidth:1440,margin:'0 auto'}}>

      {/* Filter bar */}
      <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,marginBottom:gap}}>
        <div style={{padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setShowF(o=>!o)}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13,fontWeight:600,color:'#334155'}}>Filters</span>
            {activeCount>0&&<span style={{background:C.blue,color:'#fff',borderRadius:10,padding:'1px 8px',fontSize:11,fontWeight:700}}>{activeCount}</span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {activeCount>0&&<button onClick={e=>{e.stopPropagation();setFilters({year:'',month:'',week:'',process:'',nonconf:'',sub:'',product:'',result:'',supplier:''}); }} style={{padding:'3px 9px',background:C.bg,color:C.sub,border:'none',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>Clear</button>}
            <span style={{color:C.muted,display:'inline-block',transform:showF?'rotate(180deg)':'',transition:'transform .2s'}}>▾</span>
          </div>
        </div>
        {showF&&<div style={{padding:`0 16px 14px`,display:'grid',gridTemplateColumns:`repeat(${isMobile?2:isTablet?3:6},1fr)`,gap:10}}>
          <Sel label="Year"           opts={opts.year}     value={filters.year}     onChange={x=>setF('year',x)}/>
          <Sel label="Month"          opts={opts.month}    value={filters.month}    onChange={x=>setF('month',x)}/>
          <Sel label="Process"        opts={opts.process}  value={filters.process}  onChange={x=>setF('process',x)}/>
          <Sel label="Nonconformance" opts={opts.nonconf}  value={filters.nonconf}  onChange={x=>setF('nonconf',x)}/>
          <Sel label="Result"         opts={opts.result}   value={filters.result}   onChange={x=>setF('result',x)}/>
          <Sel label="CSB/Supplier"   opts={opts.supplier} value={filters.supplier} onChange={x=>setF('supplier',x)}/>
        </div>}
      </div>

      {/* KPIs — 7 cards */}
      <div style={{display:'grid',gridTemplateColumns:`repeat(${isMobile?2:isTablet?4:7},1fr)`,gap,marginBottom:gap}}>
        <KpiCard label="Defective Rings"  value={kpis.defectiveRings} sub="unique Ring SN"        grad={G.blue}/>
        <KpiCard label="No. of Reports"   value={kpis.reports}        sub="unique Issue No."      grad={G.cyan}/>
        <KpiCard label="Disposal"         value={kpis.disposal}       sub="Processing result"     grad={G.red}/>
        <KpiCard label="Pending"          value={kpis.waiting}        sub="Waiting approval"      grad={G.amber}/>
        <KpiCard label="IN Closed"        value={kpis.closed}         sub="Processing result"     grad={G.green}/>
        <KpiCard label="Concession"       value={kpis.concession}     sub="Processing result"     grad={G.teal}/>
        <KpiCard label="Repair/Rework"    value={kpis.repair}         sub="Processing result"     grad={G.purple}/>
      </div>

      {/* Last Five Weeks — moved to top */}
      {agg.weeklyData.length>0 && (()=>{
        const completed=agg.weeklyData.slice(0,-1);
        const avg=completed.length?Math.round(completed.reduce((s,d)=>s+d.v,0)/completed.length):0;
        const wData=agg.weeklyData.map(d=>({...d, avg}));
        return (
          <Card title={`Last Five Weeks${filters.week?` — Week ${filters.week}`:''}`} style={{marginBottom:gap}}>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={wData} margin={{top:28,right:12,left:-18,bottom:0}}
                onClick={e=>{ if(e?.activePayload?.[0]?.payload?.week){ const w=e.activePayload[0].payload.week; setF('week', filters.week===w?'':w); }}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip content={<BarTip/>} cursor={{fill:'rgba(34,197,94,.08)'}}/>
                <Legend iconType="circle" wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="v" name="Defective Rings" radius={[4,4,0,0]} barSize={48} cursor="pointer">
                  {wData.map((entry)=>(
                    <Cell key={entry.name}
                      fill={filters.week===entry.week?C.indigo:C.green}
                      opacity={filters.week&&filters.week!==entry.week?0.4:1}/>
                  ))}
                  <LabelList dataKey="v" position="top" style={{fontSize:11,fill:C.text,fontWeight:700}}/>
                </Bar>
                <Line type="monotone" dataKey="avg" name={`Avg (${completed.length} completed weeks)`}
                  stroke={C.amber} strokeWidth={3} dot={false} activeDot={false} isAnimationActive={false}>
                  <LabelList dataKey="avg" position="top"
                    content={(p)=>{ if(p.index!==wData.length-1) return null; return <text x={p.x} y={p.y-8} fill={C.amber} fontSize={11} fontWeight={700} textAnchor="end">Avg {avg}</text>; }}/>
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
            {filters.week&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:C.indigo,fontWeight:600,cursor:'pointer'}} onClick={()=>setF('week','')}>✕ Clear week filter</div>}
          </Card>
        );
      })()}

      {/* Row 1 */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':isTablet?'1fr 1fr':'1.5fr .8fr 1fr',gap,marginBottom:gap}}>
        <Card title={`Inspection Notice by Month${filters.month?` — ${MNAMES[+filters.month]}`:''}`}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={agg.monthData} margin={{top:20,right:4,left:-22,bottom:0}}
              onClick={e=>{ if(e?.activeLabel) { const mn=MONTH_NUM[e.activeLabel]; setF('month', filters.month===mn?'':mn); }}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:C.muted,angle:-35,textAnchor:'end',dy:2}} axisLine={false} tickLine={false} interval={0} height={40}/>
              <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<BarTip/>} cursor={{fill:'rgba(59,130,246,.08)'}}/>
              <Bar dataKey="v" radius={[4,4,0,0]} cursor="pointer">
                {agg.monthData.map((entry)=>(
                  <Cell key={entry.name}
                    fill={filters.month===MONTH_NUM[entry.name] ? C.indigo : C.blue}
                    opacity={filters.month&&filters.month!==MONTH_NUM[entry.name]?0.4:1}/>
                ))}
                <LabelList dataKey="v" position="top" style={{fontSize:9,fill:C.sub,fontWeight:600}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {filters.month&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:C.indigo,fontWeight:600,cursor:'pointer'}} onClick={()=>setF('month','')}>✕ Clear month filter</div>}
        </Card>
        <Card title={`Inspection Notice by Year${filters.year?` — ${filters.year}`:''}`}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={agg.yearData} margin={{top:20,right:4,left:-22,bottom:0}}
              onClick={e=>{ if(e?.activeLabel) setF('year', filters.year===e.activeLabel?'':e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<BarTip/>} cursor={{fill:'rgba(99,102,241,.08)'}}/>
              <Bar dataKey="v" radius={[4,4,0,0]} cursor="pointer">
                {agg.yearData.map((entry,i)=>(
                  <Cell key={entry.name}
                    fill={filters.year===entry.name ? C.indigo : BAR_PALETTE[i%BAR_PALETTE.length]}
                    opacity={filters.year&&filters.year!==entry.name?0.4:1}/>
                ))}
                <LabelList dataKey="v" position="top" style={{fontSize:10,fill:C.sub,fontWeight:600}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {filters.year&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:C.indigo,fontWeight:600,cursor:'pointer'}} onClick={()=>setF('year','')}>✕ Clear year filter</div>}
        </Card>
        <Card title="Processing Results">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={agg.resultData} dataKey="v" nameKey="name"
                cx="45%" cy="46%" outerRadius={70} innerRadius={36} paddingAngle={2}
                label={({cx,cy,midAngle,innerRadius,outerRadius,value,percent})=>{
                  if(percent<0.04) return null;
                  const RADIAN=Math.PI/180;
                  const r=innerRadius+(outerRadius-innerRadius)*0.5;
                  const x=cx+r*Math.cos(-midAngle*RADIAN);
                  const y=cy+r*Math.sin(-midAngle*RADIAN);
                  return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>{value}</text>;
                }}
                labelLine={false}>
                {agg.resultData.map((e,i)=><Cell key={i} fill={rColor(e.name)}/>)}
              </Pie>
              <Legend iconSize={8} iconType="circle" formatter={x=><span style={{fontSize:10,color:C.sub}}>{x}</span>}/>
              <Tooltip content={<BarTip/>}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 2 */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':isTablet?'1fr 1fr':'1fr 1fr 1fr',gap,marginBottom:gap}}>
        <Card title={`By Process${filters.process?` — ${filters.process}`:''}`}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={agg.processData} margin={{top:20,right:4,left:-22,bottom:10}}
              onClick={e=>{ if(e?.activeLabel) setF('process', filters.process===e.activeLabel?'':e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:C.muted,angle:-35,textAnchor:'end',dy:4}} axisLine={false} tickLine={false} interval={0} height={50}/>
              <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<BarTip/>} cursor={{fill:'rgba(59,130,246,.08)'}}/>
              <Bar dataKey="v" radius={[4,4,0,0]} cursor="pointer">
                {agg.processData.map((entry,i)=>(
                  <Cell key={entry.name}
                    fill={filters.process===entry.name?C.indigo:BAR_PALETTE[i%BAR_PALETTE.length]}
                    opacity={filters.process&&filters.process!==entry.name?0.4:1}/>
                ))}
                <LabelList dataKey="v" position="top" style={{fontSize:10,fill:C.sub,fontWeight:600}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {filters.process&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:C.indigo,fontWeight:600,cursor:'pointer'}} onClick={()=>setF('process','')}>✕ Clear</div>}
        </Card>
        <Card title={`Nonconformance Type${filters.nonconf?` — ${filters.nonconf}`:''}`}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={agg.nonconfData} margin={{top:20,right:4,left:-22,bottom:10}}
              onClick={e=>{ if(e?.activeLabel) setF('nonconf', filters.nonconf===e.activeLabel?'':e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:C.muted,angle:-35,textAnchor:'end',dy:4}} axisLine={false} tickLine={false} interval={0} height={50}/>
              <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<BarTip/>} cursor={{fill:'rgba(59,130,246,.08)'}}/>
              <Bar dataKey="v" radius={[4,4,0,0]} cursor="pointer">
                {agg.nonconfData.map((entry,i)=>(
                  <Cell key={entry.name}
                    fill={filters.nonconf===entry.name?C.indigo:BAR_PALETTE[i%BAR_PALETTE.length]}
                    opacity={filters.nonconf&&filters.nonconf!==entry.name?0.4:1}/>
                ))}
                <LabelList dataKey="v" position="top" style={{fontSize:10,fill:C.sub,fontWeight:600}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {filters.nonconf&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:C.indigo,fontWeight:600,cursor:'pointer'}} onClick={()=>setF('nonconf','')}>✕ Clear</div>}
        </Card>
        <Card title={`Top Sub Categories${filters.sub?` — ${filters.sub}`:''}`}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={agg.subData} layout="vertical" margin={{top:4,right:30,left:4,bottom:0}}
              onClick={e=>{ if(e?.activeLabel) setF('sub', filters.sub===e.activeLabel?'':e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:C.sub}} width={95} axisLine={false} tickLine={false}/>
              <Tooltip content={<BarTip/>} cursor={{fill:'rgba(99,102,241,.08)'}}/>
              <Bar dataKey="v" radius={[0,4,4,0]} cursor="pointer">
                {agg.subData.map((entry)=>(
                  <Cell key={entry.name}
                    fill={filters.sub===entry.name?C.blue:C.indigo}
                    opacity={filters.sub&&filters.sub!==entry.name?0.4:1}/>
                ))}
                <LabelList dataKey="v" position="right" style={{fontSize:10,fill:C.sub,fontWeight:600}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {filters.sub&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:C.indigo,fontWeight:600,cursor:'pointer'}} onClick={()=>setF('sub','')}>✕ Clear</div>}
        </Card>
      </div>

      {/* Row 3 */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap}}>
        <Card title={`Top Products by NCR Count${filters.product?` — ${filters.product.replace('…','')}...`:''}`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={agg.productData} layout="vertical" margin={{top:4,right:40,left:4,bottom:0}}
              onClick={e=>{ if(e?.activeLabel) setF('product', filters.product===e.activeLabel?'':e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:C.sub}} width={isMobile?150:200} axisLine={false} tickLine={false}/>
              <Tooltip content={<BarTip/>} cursor={{fill:'rgba(56,189,248,.08)'}}/>
              <Bar dataKey="v" radius={[0,4,4,0]} cursor="pointer">
                {agg.productData.map((entry)=>(
                  <Cell key={entry.name}
                    fill={filters.product===entry.name?C.indigo:C.sky}
                    opacity={filters.product&&filters.product!==entry.name?0.4:1}/>
                ))}
                <LabelList dataKey="v" position="right" style={{fontSize:10,fill:C.sub,fontWeight:600}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {filters.product&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:C.indigo,fontWeight:600,cursor:'pointer'}} onClick={()=>setF('product','')}>✕ Clear</div>}
        </Card>
        <Card title="Result Summary">
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>{['Result','#','%'].map((h,i)=>(
              <th key={h} style={{textAlign:i===0?'left':'right',color:C.muted,fontWeight:600,fontSize:10,
                                   textTransform:'uppercase',letterSpacing:'.4px',paddingBottom:8,
                                   borderBottom:`1px solid ${C.border}`}}>{h}</th>
            ))}</tr></thead>
            <tbody>{agg.resultData.map(({name,v:n})=>(
              <tr key={name}>
                <td style={{padding:'7px 0',borderBottom:`1px solid ${C.rowAlt}`}}><Badge v={name}/></td>
                <td style={{textAlign:'right',fontWeight:700,color:C.text,padding:'7px 0',borderBottom:`1px solid ${C.rowAlt}`}}>{n}</td>
                <td style={{textAlign:'right',color:C.muted,padding:'7px 0',borderBottom:`1px solid ${C.rowAlt}`}}>
                  {kpis.defectiveRings?toFixed(n/kpis.defectiveRings*100,0)+'%':'—'}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <div style={{textAlign:'center',marginTop:gap,fontSize:11,color:C.muted}}>
        Inspection Notice · {SHEET_IN} sheet · Updated {updatedAt}
      </div>
    </div>
  );
}

// ── CONFIRMED NCR TAB ─────────────────────────────────────────────────────────
function ConfirmedNcrTab({onExpired,cachedData,onDataLoaded}) {
  const width=useWidth(); const isMobile=width<640;
  const [data,setData]           = useState(cachedData||null);
  const [loading,setLoading]     = useState(!cachedData);
  const [error,setError]         = useState(null);
  const [updatedAt,setUpdatedAt] = useState(null);
  const [tab,setTab]             = useState('monthly');

  const fetchData=useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const buf=await apiFetch('ncr');
      const parsed=parseNCR(buf);
      setData(parsed);
      onDataLoaded('ncr',parsed);
      setUpdatedAt(new Date().toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}));
    } catch(e){
      if(e.message==='SESSION_EXPIRED') onExpired();
      else setError(e.message);
    } finally { setLoading(false); }
  },[onExpired,onDataLoaded]);

  useEffect(()=>{ if(!cachedData) fetchData(); },[fetchData,cachedData]);

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:320,gap:12}}><Spin color={C.indigo}/><span style={{color:C.muted,fontSize:13}}>Loading Confirmed NCR data…</span></div>;
  if(error)   return <div style={{textAlign:'center',padding:48}}><div style={{fontSize:36,marginBottom:12}}>⚠️</div><p style={{color:C.warn,marginBottom:12,fontSize:14}}>{error}</p><button onClick={fetchData} style={{padding:'8px 20px',background:C.indigo,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600}}>Retry</button></div>;

  const {targetPct,cumDefPct,totalInput,totalNcr,monthly,weekly,mLabels,wLabels,processRows}=data;
  const isOver=cumDefPct>targetPct;
  const ratio=targetPct>0?Math.min((cumDefPct/targetPct)*100,100):0;
  const wIn=weekly.reduce((s,w)=>s+w.input,0);
  const wNcr=weekly.reduce((s,w)=>s+w.ncr,0);
  const chartM=monthly.map(d=>({name:d.month,'Defect Rate(%)':d.defect,'Cumulative(%)':d.cumulative}));
  const chartW=weekly.map(d=>({name:d.week,'Defect Rate(%)':d.defect}));
  const p=isMobile?12:20;
  const gap=isMobile?10:14;
  const thS=(e={})=>({background:'transparent',color:'#fff',padding:'9px 10px',fontSize:11,fontWeight:700,textAlign:'center',whiteSpace:'nowrap',...e});

  return (
    <div style={{padding:`${gap}px ${p}px 32px`,maxWidth:1440,margin:'0 auto'}}>

      {/* KPIs — same flat style as Inspection Notice */}
      <div style={{display:'grid',gridTemplateColumns:`repeat(${isMobile?2:5},1fr)`,gap,marginBottom:gap}}>
        <KpiCard label="Cumulative Defect Rate" value={toFixed(cumDefPct,3)+'%'} sub={`Target ${toFixed(targetPct,3)}%`} grad={isOver?G.red:G.green}/>
        <KpiCard label="YTD Input Qty"    value={totalInput.toLocaleString()} sub="ea · YTD"                            grad={G.cyan}/>
        <KpiCard label="YTD NCR"          value={totalNcr}                     sub="ea · YTD"                            grad={G.indigo}/>
        <KpiCard label="Input (5W)"       value={wIn.toLocaleString()}         sub={`${wLabels[0]}–${wLabels[wLabels.length-1]}`} grad={G.purple}/>
        <KpiCard label="NCR (5W)"         value={wNcr}                         sub={`${wLabels[0]}–${wLabels[wLabels.length-1]}`} grad={G.amber}/>
      </div>

      {/* Progress bar */}
      <Card title="Cumulative Defect Rate vs Y2026 Target" style={{marginBottom:gap}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:12,color:C.sub}}>{isOver?'⚠ Above target — corrective action needed':'✓ On track'}</span>
          <span style={{fontSize:13,fontWeight:700,color:isOver?C.warn:C.ok}}>{toFixed(cumDefPct,3)}% / {toFixed(targetPct,3)}%</span>
        </div>
        <div style={{height:10,borderRadius:6,background:C.bg,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${ratio}%`,borderRadius:6,transition:'width 1s ease',
                       background:isOver?`linear-gradient(90deg,${C.amber},${C.red})`:`linear-gradient(90deg,${C.teal},${C.green})`}}/>
        </div>
        <div style={{fontSize:11,color:C.muted,marginTop:6}}>
          {isOver?`${toFixed(cumDefPct-targetPct,3)} pts above target`:`${toFixed(targetPct-cumDefPct,3)} pts below target`}
        </div>
      </Card>

      {/* Charts — monthly + weekly */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap,marginBottom:gap}}>

        <Card title="NCR by Month — Defect Rate & Cumulative">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartM} margin={{top:20,right:14,left:-12,bottom:0}}>
              <defs>
                <linearGradient id="gDef" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.25}/>
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.pink} stopOpacity={0.2}/>
                  <stop offset="100%" stopColor={C.pink} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>v+'%'} tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} domain={[0,'auto']}/>
              <Tooltip content={<LineTip/>}/>
              <Legend iconType="circle" wrapperStyle={{fontSize:11,paddingTop:6}}/>
              <ReferenceLine y={targetPct} stroke={C.amber} strokeDasharray="5 4"
                label={{value:`Target ${toFixed(targetPct,2)}%`,fontSize:9,fill:C.amber,position:'insideTopRight'}}/>
              <Area type="monotone" dataKey="Defect Rate(%)" stroke={C.blue} strokeWidth={2} fill="url(#gDef)"
                dot={<DotWithLabel stroke={C.blue}/>} activeDot={{r:5}} connectNulls={false}/>
              <Area type="monotone" dataKey="Cumulative(%)" stroke={C.pink} strokeWidth={2} fill="url(#gCum)"
                strokeDasharray="6 3" dot={<DotWithLabel stroke={C.pink}/>} activeDot={{r:5}} connectNulls={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="NCR by Week — Last 5 Weeks">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartW} margin={{top:20,right:14,left:-12,bottom:0}}>
              <defs>
                <linearGradient id="gWk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.cyan} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={C.cyan} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>v+'%'} tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} domain={[0,'auto']}/>
              <Tooltip content={<LineTip/>}/>
              <ReferenceLine y={targetPct} stroke={C.amber} strokeDasharray="5 4"/>
              <Area type="monotone" dataKey="Defect Rate(%)" stroke={C.cyan} strokeWidth={2} fill="url(#gWk)"
                dot={<DotWithLabel stroke={C.cyan}/>} activeDot={{r:5}}/>
            </AreaChart>
          </ResponsiveContainer>

          {/* Weekly mini table */}
          <div style={{marginTop:12,overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontSize:11}}>
              <thead><tr style={{background:`linear-gradient(90deg,${C.navy},#16335c)`}}>
                <th style={thS({textAlign:'left',borderTopLeftRadius:8,borderBottomLeftRadius:8})}></th>
                {wLabels.map(w=><th key={w} style={thS()}>{w}</th>)}
                <th style={thS({borderTopRightRadius:8,borderBottomRightRadius:8})}>Total</th>
              </tr></thead>
              <tbody>{[
                {label:'Input',vals:weekly.map(w=>w.input),total:wIn,  fmt:v=>v.toLocaleString()},
                {label:'NCR',  vals:weekly.map(w=>w.ncr),  total:wNcr, fmt:v=>v},
                {label:'Rate', vals:weekly.map(w=>w.defect),total:null,fmt:v=>toFixed(v,2)+'%'},
              ].map((row,i)=>(
                <tr key={row.label} style={{background:i%2===0?C.surface:C.rowAlt}}>
                  <td style={{padding:'6px 8px',fontWeight:700,color:C.navy}}>{row.label}</td>
                  {row.vals.map((v,j)=>(
                    <td key={j} style={{textAlign:'center',padding:'6px',
                      color:row.label==='Rate'&&v>targetPct?C.warn:C.text,
                      fontWeight:row.label==='Rate'&&v>targetPct?700:400}}>{row.fmt(v)}</td>
                  ))}
                  <td style={{textAlign:'center',padding:'6px',fontWeight:700,color:C.indigo}}>
                    {row.total!=null?row.total.toLocaleString():'—'}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Monthly rate table */}
      <Card title="NCR Rate Summary — Monthly" style={{marginBottom:gap,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontSize:11}}>
          <thead><tr style={{background:`linear-gradient(90deg,${C.navy},#16335c)`}}>
            <th style={thS({textAlign:'left',minWidth:120,borderTopLeftRadius:8,borderBottomLeftRadius:8})}>Metric</th>
            <th style={thS()}>2025</th>
            {mLabels.map(m=><th key={m} style={thS()}>{m}</th>)}
            <th style={thS({borderTopRightRadius:8,borderBottomRightRadius:8})}>Total Y26</th>
          </tr></thead>
          <tbody>{[
            {label:'Input (ea)',vals:monthly.map(m=>m.input),     total:totalInput,fmt:v=>v!=null?v.toLocaleString():'—',color:false},
            {label:'NCR (ea)', vals:monthly.map(m=>m.ncr),       total:totalNcr,  fmt:v=>v!=null?v:'—',                color:false},
            {label:'Defect(%)',vals:monthly.map(m=>m.defect),     total:null,      fmt:v=>v!=null?toFixed(v,2)+'%':'—',color:true},
            {label:'Cumul.(%) ',vals:monthly.map(m=>m.cumulative),total:cumDefPct, fmt:v=>v!=null?toFixed(v,2)+'%':'—',color:true},
          ].map((row,i)=>(
            <tr key={row.label} style={{background:i%2===0?C.surface:C.rowAlt}}>
              <td style={{padding:'7px 10px',fontWeight:700,color:C.navy}}>{row.label}</td>
              {row.vals.map((v,j)=>(
                <td key={j} style={{textAlign:'center',padding:'7px 8px',
                  color:row.color&&v!=null?(v>targetPct?C.warn:C.ok):C.text,
                  fontWeight:row.color&&v!=null&&v>targetPct?700:400}}>{row.fmt(v)}</td>
              ))}
              <td style={{textAlign:'center',padding:'7px 8px',fontWeight:800,
                color:row.color&&row.total!=null?(row.total>targetPct?C.warn:C.ok):C.indigo}}>
                {row.total!=null?(row.color?toFixed(row.total,2)+'%':row.total.toLocaleString()):'—'}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {/* Process table */}
      <Card title="NCR by Process" style={{overflowX:'auto'}}>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
          <div style={{display:'flex',gap:4,background:C.bg,padding:3,borderRadius:8}}>
            {[['monthly','Monthly'],['weekly','Weekly (5W)']].map(([t,lbl])=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:'5px 14px',fontSize:11,fontWeight:700,
                borderRadius:6,border:'none',cursor:'pointer',transition:'all .15s',
                background:tab===t?C.navy:'transparent',
                color:tab===t?'#fff':C.muted}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontSize:11}}>
          <thead><tr style={{background:`linear-gradient(90deg,${C.navy},#16335c)`}}>
            <th style={thS({textAlign:'left',minWidth:110,borderTopLeftRadius:8,borderBottomLeftRadius:8})}>Process</th>
            {tab==='monthly'?(<><th style={thS()}>2025</th>{mLabels.map(m=><th key={m} style={thS()}>{m}</th>)}<th style={thS({borderTopRightRadius:8,borderBottomRightRadius:8})}>Total Y26</th></>)
             :(<>{wLabels.map(w=><th key={w} style={thS()}>{w}</th>)}<th style={thS({borderTopRightRadius:8,borderBottomRightRadius:8})}>Total</th></>)}
          </tr></thead>
          <tbody>{processRows.map((row,i)=>{
            const vals=tab==='monthly'?[row.ncr2025,...row.months,row.total]:[...row.weeks,row.weekTotal];
            return (
              <tr key={row.process} style={{background:row.isTotal?`linear-gradient(90deg,${C.navy},#16335c)`:i%2===0?C.surface:C.rowAlt}}>
                <td style={{padding:'7px 10px',fontWeight:row.isTotal?800:600,color:row.isTotal?'#fff':C.navy}}>{row.process}</td>
                {vals.map((v,j)=>(
                  <td key={j} style={{textAlign:'center',padding:'7px 8px',
                    color:row.isTotal?(v>0?C.amber:'#9db4d4'):v>0?C.warn:'#cbd5e1',
                    fontWeight:v>0?700:400}}>{v}</td>
                ))}
              </tr>
            );
          })}</tbody>
        </table>
      </Card>

      <div style={{textAlign:'center',marginTop:gap,fontSize:11,color:C.muted}}>
        Confirmed NCR · {SHEET_NCR} · Updated {updatedAt}
      </div>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function InspectionNotice() {
  const width=useWidth(); const isMobile=width<640;
  const [activeTab,setActiveTab] = useState('in');
  // Cache fetched data so switching tabs doesn't re-fetch
  const cache = useRef({in:null, ncr:null});
  const handleDataLoaded=useCallback((key,data)=>{ cache.current[key]=data; },[]);
  // Hết phiên (token Supabase hết hạn / mất quyền) → tải lại để cổng đăng nhập kiểm tra lại
  function handleExpired() { try { location.reload(); } catch { /* ignore */ } }

  return (
    <div style={{minHeight:'100%',background:C.bg,fontFamily:"'Inter','Segoe UI',sans-serif",fontSize:13,color:C.text}}>
      {/* CHỈ khai báo keyframes — KHÔNG dùng '*{}' reset toàn cục (sẽ phá layout hub) */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Tab bar (2 tab con) */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:`0 ${isMobile?12:24}px`}}>
        <div style={{display:'flex'}}>
          {[['in','\uD83D\uDCCB Inspection Notice'],['ncr','\uD83D\uDCCA Confirmed NCR']].map(([t,lbl])=>(
            <button key={t} onClick={()=>setActiveTab(t)}
              style={{padding:'13px 20px',fontSize:13,fontWeight:600,border:'none',cursor:'pointer',
                      background:'transparent',
                      borderBottom:`2px solid ${activeTab===t?C.blue:'transparent'}`,
                      color:activeTab===t?C.blue:C.sub,
                      marginBottom:-1,transition:'color .15s,border-color .15s',whiteSpace:'nowrap'}}>
              {isMobile?lbl.split(' ').slice(1).join(' '):lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Keep both tabs mounted — avoids re-fetch on tab switch */}
      <div style={{display:activeTab==='in'?'block':'none'}}>
        <InspectionTab onExpired={handleExpired} cachedData={cache.current.in} onDataLoaded={handleDataLoaded}/>
      </div>
      <div style={{display:activeTab==='ncr'?'block':'none'}}>
        <ConfirmedNcrTab onExpired={handleExpired} cachedData={cache.current.ncr} onDataLoaded={handleDataLoaded}/>
      </div>
    </div>
  );
}
