let rawData = [];
let supplierChart, yearChart, monthChart, statusChart, partChart, phenomenonChart;

let selectedSupplier = "", selectedYear = "", selectedMonth = "";
let selectedPart = "", selectedPhenomenon = "", selectedStatus = "";

const ACTIVE_SUPPLIERS = ["WUXI PAIKE", "SINHOM", "TAESANG"];
const MASTER_PASSWORD = "CSBearing";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const chartColor = "rgba(77,159,255,0.75)";
const chartBorder = "#4d9fff";
const chartColorHover = "rgba(77,159,255,0.95)";

const columnAliases = {
  ncrNo: ["NCR No.", "NCR No", "NCR Number"],
  supplier: ["Supplier", "Vendor", "Nhà cung cấp"],
  year: ["NCR NCR Year", "NCR Year", "Year"],
  month: ["NCR Month", "Month"],
  quantity: ["Quantity", "Qty", "Số lượng"],
  part: ["Part", "Part Name"],
  phenomenon: ["Phenomenon", "Defect"],
  replacement: ["Replacement Status", "Status"],
  closeDate: ["NCR Close date", "Close Date"], // Cột L của bạn
  status: ["NCR Status", "Status"]
};

let columns = {};

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  if (sessionStorage.getItem("isLoggedIn") === "true") showDashboard();
  loginBtn.addEventListener("click", checkLogin);
  document.getElementById("passInput").addEventListener("keydown", (e) => { if (e.key === "Enter") checkLogin(); });
  document.getElementById("supplierFilter").addEventListener("change", e => { selectedSupplier = e.target.value; renderDashboard(); });
  document.getElementById("yearFilter").addEventListener("change", e => { selectedYear = e.target.value; renderDashboard(); });
  document.getElementById("resetButton").addEventListener("click", resetFilters);
  document.getElementById("exportPdfBtn").addEventListener("click", exportPDF);
});

function checkLogin() {
  const input = document.getElementById("passInput").value;
  if (input === MASTER_PASSWORD) {
    sessionStorage.setItem("isLoggedIn", "true");
    sessionStorage.setItem("authKey", input);
    showDashboard();
  } else { document.getElementById("loginError").style.display = "block"; }
}

function showDashboard() {
  document.getElementById("loginGate").style.display = "none";
  document.getElementById("mainDashboard").style.display = "flex";
  loadData();
  // Live clock
  function tick() {
    const el = document.getElementById("headerTime");
    if (el) el.innerHTML = new Date().toLocaleString("vi-VN", { weekday:"short", year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  }
  tick(); setInterval(tick, 1000);
}

async function loadData() {
  setStatus("Đang tải dữ liệu...");
  try {
    const response = await fetch("/api/ncr", { headers: { "x-auth-key": sessionStorage.getItem("authKey") } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    rawData = payload.rows || [];
    columns = detectColumns(rawData);
    populateFilters();
    renderDashboard();
    setStatus(`${payload.rowCount.toLocaleString()} dòng | Cập nhật: ${formatRefreshTime(payload.refreshedAt)}`);
  } catch (error) { setStatus(error.message); }
}

// --- LOGIC ĐẾM OPEN NCR CHUẨN THEO FILE EXCEL CỦA BẠN ---
function countOpenNcr(data) {
  return data.filter(row => {
    const val = valueOf(row, columns.closeDate);
    
    // 1. Nếu ô TRỐNG (Blanks) -> Tính là OPEN
    if (val === undefined || val === null || String(val).trim() === "") {
      return true;
    }

    const text = String(val).toLowerCase().trim();

    // 2. Nếu chứa chữ "open" hoặc "waiting" (đang chờ duyệt) -> Tính là OPEN
    if (text.includes("open") || text.includes("waiting")) {
      return true;
    }

    // 3. Nếu chứa chữ "close" -> Tính là CLOSED (Không đếm)
    if (text.includes("close")) {
      return false;
    }

    // 4. Nếu là định dạng NGÀY THÁNG hoặc SỐ NĂM (Ví dụ: 2025, 2026) -> Tính là CLOSED (Không đếm)
    if (val instanceof Date) return false;
    if (!isNaN(val) && Number(val) > 1900) return false;

    // Mặc định nếu không rơi vào các trường hợp Close bên trên thì coi như vẫn Open
    return true;
  }).length;
}

function getFilteredData() {
  return rawData.filter(row => {
    const s = normalizeSupplier(valueOf(row, columns.supplier));
    const y = toYear(valueOf(row, columns.year));
    const m = toMonth(valueOf(row, columns.month));
    const p = String(valueOf(row, columns.part) || "");
    const ph = String(valueOf(row, columns.phenomenon) || "");
    const st = String(valueOf(row, columns.replacement) || "");

    let matchS = !selectedSupplier ? true : (selectedSupplier === "active_suppliers" ? ACTIVE_SUPPLIERS.includes(s) : s === selectedSupplier);
    let matchY = !selectedYear || y === selectedYear;
    let matchM = !selectedMonth || m === selectedMonth;
    let matchPart = !selectedPart || p === selectedPart;
    let matchPhen = !selectedPhenomenon || ph === selectedPhenomenon;
    let matchStat = !selectedStatus || st === selectedStatus;

    return matchS && matchY && matchM && matchPart && matchPhen && matchStat;
  });
}

function renderDashboard() {
  const data = getFilteredData();
  updateKPI(data);
  buildCharts(data);
}

function updateKPI(data) {
  setText("totalNcr", distinct(data.map(r => valueOf(r, columns.ncrNo)).filter(Boolean)).length.toLocaleString());
  setText("totalQty", data.reduce((t, r) => t + toNumber(valueOf(r, columns.quantity)), 0).toLocaleString());
  setText("totalSupplier", distinct(data.map(r => normalizeSupplier(valueOf(r, columns.supplier))).filter(Boolean)).length);
  setText("totalPart", distinct(data.map(r => valueOf(r, columns.part)).filter(Boolean)).length);
  setText("openNcr", countOpenNcr(data).toLocaleString());
}

function resetFilters() {
  selectedSupplier = ""; selectedYear = ""; selectedMonth = "";
  selectedPart = ""; selectedPhenomenon = ""; selectedStatus = "";
  document.getElementById("supplierFilter").value = "";
  document.getElementById("yearFilter").value = "";
  renderDashboard();
}

// --- BIỂU ĐỒ ---
function buildCharts(data) {
  buildSupplierChart(data); buildYearChart(data); buildMonthChart(data);
  buildStatusChart(data); buildPartChart(data); buildPhenomenonChart(data);
}

function buildSupplierChart(data) {
  supplierChart?.destroy();
  const entries = groupCount(data, columns.supplier, v => normalizeSupplier(v)).sort((a,b)=>b.value-a.value).slice(0,12);
  supplierChart = createBarChart("supplierChart", entries, "Supplier", false, els => {
    if(!els.length) return;
    selectedSupplier = entries[els[0].index].label;
    document.getElementById("supplierFilter").value = selectedSupplier;
    renderDashboard();
  });
}

function buildYearChart(data) {
  yearChart?.destroy();
  const entries = groupCount(data, columns.year, toYear).sort((a,b)=>a.label-b.label);
  yearChart = createBarChart("yearChart", entries, "Year", false, els => {
    if(!els.length) return;
    selectedYear = entries[els[0].index].label;
    document.getElementById("yearFilter").value = selectedYear;
    renderDashboard();
  });
}

function buildMonthChart(data) {
  monthChart?.destroy();
  const counts = Object.fromEntries(MONTHS.map(m => [m, 0]));
  data.forEach(r => { const m = toMonth(valueOf(r, columns.month)); if(m in counts) counts[m]++; });
  monthChart = createBarChart("monthChart", MONTHS.map(m => ({ label: m, value: counts[m] })), "Month", false, els => {
    if(!els.length) return;
    const val = MONTHS[els[0].index];
    selectedMonth = (selectedMonth === val) ? "" : val;
    renderDashboard();
  });
}

function buildPartChart(data) {
  partChart?.destroy();
  const entries = groupCount(data, columns.part).sort((a,b)=>b.value-a.value).slice(0,10);
  partChart = createBarChart("partChart", entries, "Top Parts", true, els => {
    if(!els.length) return;
    const val = entries[els[0].index].label;
    selectedPart = (selectedPart === val) ? "" : val;
    renderDashboard();
  });
}

function buildPhenomenonChart(data) {
  phenomenonChart?.destroy();
  const entries = groupCount(data, columns.phenomenon).sort((a,b)=>b.value-a.value).slice(0,10);
  phenomenonChart = createBarChart("phenomenonChart", entries, "Phenomenon", true, els => {
    if(!els.length) return;
    const val = entries[els[0].index].label;
    selectedPhenomenon = (selectedPhenomenon === val) ? "" : val;
    renderDashboard();
  });
}

function buildStatusChart(data) {
  statusChart?.destroy();
  const entries = groupCount(data, columns.replacement).sort((a,b)=>b.value-a.value);
  statusChart = createBarChart("statusChart", entries, "Status", false, els => {
    if(!els.length) return;
    const val = entries[els[0].index].label;
    selectedStatus = (selectedStatus === val) ? "" : val;
    renderDashboard();
  });
}

function createBarChart(id, entries, title, horizontal = false, onSelect = null) {
  return new Chart(document.getElementById(id), {
    type: "bar",
    data: {
      labels: entries.map(e => e.label),
      datasets: [{
        label: title,
        data: entries.map(e => e.value),
        backgroundColor: entries.map(() => "rgba(77,159,255,0.65)"),
        borderColor: entries.map(() => "#4d9fff"),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 52,
        hoverBackgroundColor: "rgba(77,159,255,0.95)",
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: horizontal ? "y" : "x",
      onClick: (e, els) => onSelect?.(els),
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: "#0c1f3d",
        borderColor: "#2a4f8a",
        borderWidth: 1,
        titleColor: "#9fb5dd",
        bodyColor: "#e8f0ff",
        padding: 10,
      }},
      scales: {
        x: {
          ticks: { color: "#6b8ab5", font: { size: 11 } },
          grid: { color: "rgba(255,255,255,.04)" },
          border: { color: "rgba(255,255,255,.08)" }
        },
        y: {
          grace: "15%",
          ticks: { color: "#6b8ab5", font: { size: 11 } },
          grid: { color: "rgba(255,255,255,.04)" },
          border: { color: "rgba(255,255,255,.08)" }
        }
      }
    },
    plugins: [valueLabelPlugin]
  });
}

const valueLabelPlugin = {
  id: "valueLabel",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      const v = chart.data.datasets[0].data[i];
      if (!v) return;
      const isH = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.fillStyle = "#9fb5dd";
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = isH ? 'left' : 'center';
      ctx.fillText(v, isH ? bar.x + 6 : bar.x, isH ? bar.y + 4 : bar.y - 8);
      ctx.restore();
    });
  }
};

function detectColumns(rows) {
  const headers = Object.keys(rows[0] || {});
  return Object.fromEntries(Object.entries(columnAliases).map(([key, aliases]) => {
      const found = headers.find(h => aliases.some(a => normalizeText(h) === normalizeText(a))) || 
                    headers.find(h => aliases.some(a => normalizeText(h).includes(normalizeText(a))));
      return [key, found || ""];
  }));
}

function populateFilters() {
  const supplierSelect = document.getElementById("supplierFilter");
  const allSuppliers = distinct(rawData.map(row => normalizeSupplier(valueOf(row, columns.supplier))).filter(Boolean)).sort();
  supplierSelect.innerHTML = `<option value="">All Suppliers</option>`;
  const activeOpt = document.createElement("option");
  activeOpt.value = "active_suppliers";
  activeOpt.textContent = "⭐ Active Suppliers (Top 3)";
  activeOpt.style.color = "#4ea1ff"; activeOpt.style.fontWeight = "bold";
  supplierSelect.appendChild(activeOpt);
  allSuppliers.forEach(v => {
    const o = document.createElement("option"); o.value = v; o.textContent = v; supplierSelect.appendChild(o);
  });
  fillSelect(document.getElementById("yearFilter"), "All Years", distinct(rawData.map(row => toYear(valueOf(row, columns.year))).filter(Boolean)).sort((a,b)=>a-b));
}

function fillSelect(select, allLabel, values) {
  select.innerHTML = `<option value="">${allLabel}</option>`;
  values.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; select.appendChild(o); });
}

function groupCount(data, col, trans = v => v) {
  if(!col) return [];
  const counts = new Map();
  data.forEach(r => { const l = trans(valueOf(r, col)) || "Unknown"; counts.set(l, (counts.get(l) || 0) + 1); });
  return [...counts.entries()].map(([label, value]) => ({ label: String(label), value }));
}

function valueOf(row, col) { return col ? row[col] : ""; }
function toYear(v) { const m = String(v||"").match(/\b(20\d{2})\b/); return m ? m[1] : ""; }
function toMonth(v) { 
    const n = Number(v); if(n >= 1 && n <= 12) return MONTHS[n-1];
    return MONTHS.find(m => normalizeText(v).startsWith(m.toLowerCase())) || "";
}
function toNumber(v) { 
    if(!v) return 0;
    const n = Number(String(v).replace(/,/g, "")); 
    return isFinite(n) ? n : 0; 
}
function normalizeSupplier(v) { return String(v||"").trim().toUpperCase(); }
function normalizeText(v) { 
    return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); 
}
function distinct(vals) { return [...new Set(vals.map(v => String(v).trim()).filter(Boolean))]; }
function setText(id, v) { document.getElementById(id).textContent = v; }
function setStatus(m) { document.getElementById("dataStatus").textContent = m; }
function formatRefreshTime(v) { return v ? new Date(v).toLocaleString() : ""; }

// ===================== EXPORT PDF =====================
async function exportPDF() {
  const btn = document.getElementById("exportPdfBtn");
  btn.textContent = "⏳ Đang xuất...";
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const data = getFilteredData();
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, margin = 10;
    let y = margin;

    // ── Palette ──
    const dark     = [3, 10, 28];
    const darkMid  = [6, 18, 44];
    const panel    = [9, 24, 58];
    const panelAlt = [12, 30, 68];
    const lineCol  = [30, 60, 110];
    const white    = [235, 242, 255];
    const muted    = [110, 145, 200];
    const blue     = [77, 159, 255];
    const cyan     = [0, 200, 255];
    const green    = [0, 220, 150];
    const orange   = [255, 140, 50];
    const red      = [255, 80, 90];
    const purple   = [160, 100, 255];

    const kpiAccents = [blue, cyan, green, purple, orange];
    const chartAccents = [blue, cyan, green, purple, orange, red];

    function sf(size, style = "normal", color = white) {
      pdf.setFontSize(size); pdf.setFont("helvetica", style); pdf.setTextColor(...color);
    }
    function hline(yy, x1 = 0, x2 = W, color = lineCol, lw = 0.2) {
      pdf.setDrawColor(...color); pdf.setLineWidth(lw); pdf.line(x1, yy, x2, yy);
    }

    // ── Full background ──
    pdf.setFillColor(...dark);
    pdf.rect(0, 0, W, H, "F");

    // ── Top accent bar ──
    const grad = [[77,159,255],[0,200,255],[0,220,150]];
    const segW = W / grad.length;
    grad.forEach((c, i) => {
      pdf.setFillColor(...c);
      pdf.rect(i * segW, 0, segW + 1, 1.5, "F");
    });

    // ── Header block ──
    pdf.setFillColor(...darkMid);
    pdf.rect(0, 1.5, W, 20, "F");

    // Logo box
    pdf.setFillColor(...blue);
    pdf.roundedRect(margin, 4, 16, 12, 2, 2, "F");
    sf(9, "bold", dark); pdf.text("NCR", margin + 2.5, 12);

    // Title
    sf(14, "bold", white); pdf.text("SUPPLIER PERFORMANCE", margin + 20, 10);
    sf(8, "normal", [100, 160, 230]); pdf.text("NCR Analytics Report", margin + 20, 16);

    // Right side: filter info box
    const filterLabel = [
      selectedSupplier ? `Supplier: ${selectedSupplier}` : "All Suppliers",
      selectedYear ? `Year: ${selectedYear}` : "All Years",
      selectedMonth ? `Month: ${selectedMonth}` : ""
    ].filter(Boolean).join("  ·  ");
    const dateStr = new Date().toLocaleString("vi-VN");

    pdf.setFillColor(...panel);
    pdf.roundedRect(W - 110, 4, 100, 13, 2, 2, "F");
    sf(7, "normal", muted); pdf.text("FILTER", W - 107, 9);
    sf(7, "bold", [160, 200, 255]); pdf.text(filterLabel, W - 107, 13.5);
    sf(6.5, "normal", muted); pdf.text(`Exported: ${dateStr}`, W - 107, 17.5);

    hline(21.5, 0, W, lineCol, 0.3);
    y = 26;

    // ── KPI Cards ──
    const kpis = [
      { label: "Total NCR",  val: document.getElementById("totalNcr").textContent,      symbol: "NCR", sub: "Reports" },
      { label: "Total Qty",  val: document.getElementById("totalQty").textContent,       symbol: "QTY", sub: "Defect units" },
      { label: "Suppliers",  val: document.getElementById("totalSupplier").textContent,  symbol: "SUP", sub: "Active" },
      { label: "Parts",      val: document.getElementById("totalPart").textContent,       symbol: "PRT", sub: "Affected" },
      { label: "Open NCR",   val: document.getElementById("openNcr").textContent,        symbol: "OPN", sub: "Pending" },
    ];
    const cardW = (W - margin * 2 - 4 * 3) / 5;
    kpis.forEach((k, i) => {
      const x = margin + i * (cardW + 3);
      const acc = kpiAccents[i];

      // Card bg + border
      pdf.setFillColor(...panel); pdf.setDrawColor(...lineCol);
      pdf.roundedRect(x, y, cardW, 24, 2, 2, "FD");

      // Top accent line
      pdf.setFillColor(...acc);
      pdf.roundedRect(x, y, cardW, 1.5, 1, 1, "F");

      // Icon badge (circle + 3-letter code)
      pdf.setFillColor(Math.min(acc[0]*0.25+5,60), Math.min(acc[1]*0.25+12,50), Math.min(acc[2]*0.25+35,80));
      pdf.circle(x + cardW - 10, y + 9, 6, "F");
      sf(5.5, "bold", acc);
      pdf.text(k.symbol, x + cardW - 13, y + 10.5);

      // Label
      sf(7, "normal", muted); pdf.text(k.label.toUpperCase(), x + 4, y + 7);
      // Value
      sf(16, "bold", white); pdf.text(k.val, x + 4, y + 18);
      // Sub label
      sf(6.5, "normal", acc); pdf.text(k.sub, x + 4, y + 22.5);
    });
    y += 30;

    // ── Charts ──
    const chartIds    = ["supplierChart","yearChart","monthChart","partChart","phenomenonChart","statusChart"];
    const chartTitles = ["Supplier NCR Ranking","NCR by Year","NCR by Month","Top Parts","Phenomenon","Replacement Status"];
    const chartSymbols = ["SUP","YR","MON","PRT","PHE","STS"];
    const chartH = 52, gap = 5;
    const chartW2 = (W - margin * 2 - gap) / 2;
    let col = 0, cy = y;

    for (let i = 0; i < chartIds.length; i++) {
      const canvas = document.getElementById(chartIds[i]);
      if (!canvas) continue;
      const cx = margin + col * (chartW2 + gap);
      const acc = chartAccents[i];

      // Card bg
      pdf.setFillColor(...panel); pdf.setDrawColor(...lineCol);
      pdf.roundedRect(cx, cy, chartW2, chartH + 10, 2, 2, "FD");

      // Left accent bar
      pdf.setFillColor(...acc);
      pdf.roundedRect(cx, cy, 2, chartH + 10, 1, 1, "F");

      // Title row bg
      pdf.setFillColor(darkMid[0], darkMid[1], darkMid[2]);
      pdf.rect(cx + 2, cy, chartW2 - 2, 9, "F");

      // Icon badge + Title
      pdf.setFillColor(Math.min(acc[0]*0.2+5,50), Math.min(acc[1]*0.2+10,45), Math.min(acc[2]*0.2+30,70));
      pdf.roundedRect(cx + 4, cy + 2, 10, 5, 1, 1, "F");
      sf(4.5, "bold", acc); pdf.text(chartSymbols[i], cx + 5, cy + 5.8);
      sf(7.5, "bold", white); pdf.text(chartTitles[i], cx + 16, cy + 6.5);

      // Subtle divider under title
      hline(cy + 9, cx + 2, cx + chartW2, lineCol, 0.2);

      // Chart image
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", cx + 3, cy + 10, chartW2 - 5, chartH - 1);

      col++;
      if (col >= 2) {
        col = 0;
        cy += chartH + 14;
        if (cy + chartH + 14 > H - 6 && i < chartIds.length - 1) {
          pdf.addPage();
          pdf.setFillColor(...dark); pdf.rect(0, 0, W, H, "F");
          pdf.setFillColor(...darkMid); pdf.rect(0, 0, W, 6, "F");
          grad.forEach((c, gi) => { pdf.setFillColor(...c); pdf.rect(gi * segW, 0, segW + 1, 1.5, "F"); });
          cy = 10;
        }
      }
    }

    // ── Footer ──
    const lastPage = pdf.getNumberOfPages();
    for (let p = 1; p <= lastPage; p++) {
      pdf.setPage(p);
      hline(H - 8, 0, W, lineCol, 0.3);
      pdf.setFillColor(...darkMid); pdf.rect(0, H - 8, W, 8, "F");
      sf(6.5, "normal", muted);
      pdf.text("CSBearing · Supplier NCR Dashboard", margin, H - 3);
      pdf.text(`Page ${p} / ${lastPage}`, W / 2, H - 3, { align: "center" });
      pdf.text(dateStr, W - margin, H - 3, { align: "right" });
    }

    // ── Save ──
    const ts = new Date().toISOString().slice(0, 10);
    pdf.save(`NCR_Report_${ts}.pdf`);

  } catch (err) {
    alert("Xuất PDF thất bại: " + err.message);
    console.error(err);
  } finally {
    btn.textContent = "⬇ Export PDF";
    btn.disabled = false;
  }
}
