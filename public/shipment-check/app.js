// NCR Ring Check (Shipment Check) — bản tĩnh cho hub. Đăng nhập Supabase + tra cứu qua /api.
const STRINGS = {
  vi: {
    appName: "NCR Ring Check",
    title: "Kiểm tra NCR ring lẻ trước khi xuất hàng",
    subtitle: "Nhập S/N của Bearing Set (đọc từ Tag Name), mỗi số một dòng. Hoặc tick chọn Part bên trái, rồi chỉ cần gõ 6-8 số cuối của S/N - không cần nhớ mã dài.",
    partPanelTitle: "Chọn Part",
    partLoading: "Đang tải...",
    partLoadError: "Không tải được danh sách Part: ",
    snPlaceholder: "VN-GEE-P280027B-262239\nVN-GEE-P3X00545-262503",
    checkButton: "Kiểm tra",
    checking: "Đang kiểm tra...",
    refreshButton: "Làm mới dữ liệu & kiểm tra",
    resetButton: "Xóa / Nhập lại",
    dataAsOf: "Dữ liệu lúc: ",
    missingSn: "Chưa nhập S/N nào - gõ vào ô bên dưới (có thể chọn Part trước để gõ ít số hơn).",
    unknownError: "Lỗi không xác định",
    foundLabelPrefix: "Bearing Set S/N: ",
    statusOk: "OK - CÓ THỂ XUẤT",
    statusBad: "CHƯA OK",
    statusNotFound: "KHÔNG TÌM THẤY",
    statusUnknown: "?",
    resolvedNote: "Đã tự khớp với: ",
    notFoundText: 'Không tìm thấy S/N này trong file "Check SN ring from SN bearing set". Kiểm tra lại số đọc từ tag.',
    ambiguousText: (n) => `Nhập thiếu quá nên trùng ${n} bearing set khác nhau - bấm chọn đúng số, hoặc nhập đầy đủ hơn:`,
    okNoIssue: "OK (không có non-conformity)",
    okClosedSingle: "OK (Closed / Use as Is)",
    okClosedMulti: (n) => `OK - cả ${n} notice đều Closed/Use as Is`,
    needReview: (open, total) => `CẦN XEM XÉT - ${open}/${total} notice chưa Closed`,
    noticeTitle: (i, n) => `Notice ${i}/${n}: `,
    recordOk: "OK (Closed / Use as Is)",
    recordReview: "CẦN XEM XÉT (chưa Closed)",
    recordUnknown: "Không rõ trạng thái",
    issueNo: "Issue No.: ",
    productName: "Tên sản phẩm: ",
    defectDescription: "Mô tả lỗi: ",
    processingResults: "Kết quả xử lý: ",
    closingDate: "Ngày đóng: ",
  },
  en: {
    appName: "NCR Ring Check",
    title: "Check ring NCR status before shipment",
    subtitle: "Enter the Bearing Set S/N (from the Tag Name), one per line. Or tick a Part on the left, then just type the last 6-8 digits of the S/N - no need to remember the full code.",
    partPanelTitle: "Select Part",
    partLoading: "Loading...",
    partLoadError: "Could not load Part list: ",
    snPlaceholder: "VN-GEE-P280027B-262239\nVN-GEE-P3X00545-262503",
    checkButton: "Check",
    checking: "Checking...",
    refreshButton: "Refresh data & check",
    resetButton: "Clear / Reset",
    dataAsOf: "Data as of: ",
    missingSn: "No S/N entered - type into the box below (you can tick a Part first to type fewer digits).",
    unknownError: "Unknown error",
    foundLabelPrefix: "Bearing Set S/N: ",
    statusOk: "OK - READY TO SHIP",
    statusBad: "NOT OK",
    statusNotFound: "NOT FOUND",
    statusUnknown: "?",
    resolvedNote: "Auto-matched to: ",
    notFoundText: 'This S/N was not found in "Check SN ring from SN bearing set". Double-check the number read from the tag.',
    ambiguousText: (n) => `Too short - matches ${n} different bearing sets. Click to pick the right one, or type a longer S/N:`,
    okNoIssue: "OK (no non-conformity)",
    okClosedSingle: "OK (Closed / Use as Is)",
    okClosedMulti: (n) => `OK - all ${n} notices are Closed/Use as Is`,
    needReview: (open, total) => `NEEDS REVIEW - ${open}/${total} notice(s) not Closed`,
    noticeTitle: (i, n) => `Notice ${i}/${n}: `,
    recordOk: "OK (Closed / Use as Is)",
    recordReview: "NEEDS REVIEW (not Closed)",
    recordUnknown: "Status unknown",
    issueNo: "Issue No.: ",
    productName: "Product name: ",
    defectDescription: "Defect description: ",
    processingResults: "Processing Results: ",
    closingDate: "Closing Date: ",
  },
};

let lang = "vi";
let STR = STRINGS.vi;
let parts = [];
let selectedPart = "";
let lastData = null;

const $ = (id) => document.getElementById(id);
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- Supabase auth (dùng project quyền chung qua /api/auth-config) ----
let _sbPromise = null;
function getSupabase() {
  if (!_sbPromise) {
    _sbPromise = (async () => {
      const cfg = await fetch("/api/auth-config").then((r) => r.json());
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      return mod.createClient(cfg.url, cfg.anonKey);
    })();
  }
  return _sbPromise;
}
async function getAccessToken() {
  try {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || "";
  } catch { return ""; }
}

async function enterIfAllowed() {
  const err = $("loginError");
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/check?access=check", { headers: { Authorization: "Bearer " + token } });
    if (res.ok) { showApp(); return true; }
    if (res.status === 403) { err.textContent = "Tài khoản chưa được cấp quyền vào Shipment Check."; err.style.display = "block"; }
  } catch { /* ignore */ }
  return false;
}

async function checkLogin() {
  const btn = $("loginBtn");
  const email = $("emailInput").value.trim();
  const password = $("passInput").value;
  const err = $("loginError");
  if (!email || !password) { err.textContent = "Nhập email và mật khẩu."; err.style.display = "block"; return; }
  btn.disabled = true; err.style.display = "none";
  try {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { err.textContent = "Sai email hoặc mật khẩu."; err.style.display = "block"; return; }
    await enterIfAllowed();
  } catch {
    err.textContent = "Lỗi đăng nhập, thử lại."; err.style.display = "block";
  } finally { btn.disabled = false; }
}

async function logout() {
  try { const sb = await getSupabase(); await sb.auth.signOut(); } catch { /* ignore */ }
  location.reload();
}

function showApp() {
  $("loginGate").style.display = "none";
  $("app").style.display = "block";
  applyLang();
  loadParts();
}

function applyLang() {
  STR = STRINGS[lang];
  $("appName").textContent = STR.appName;
  $("title").textContent = STR.title;
  document.title = STR.title;
  $("subtitle").textContent = STR.subtitle;
  $("partPanelTitle").textContent = STR.partPanelTitle;
  $("snText").placeholder = STR.snPlaceholder;
  $("checkBtn").textContent = STR.checkButton;
  $("refreshBtn").textContent = STR.refreshButton;
  $("resetBtn").textContent = STR.resetButton;
  $("langVi").classList.toggle("active", lang === "vi");
  $("langEn").classList.toggle("active", lang === "en");
  renderParts();
  if (lastData) renderResults(lastData);
}

async function loadParts() {
  try {
    const token = await getAccessToken();
    const json = await fetch("/api/parts", { headers: { Authorization: "Bearer " + token } }).then((r) => r.json());
    if (json.error) throw new Error(json.error);
    parts = json.parts || [];
    $("partsError").style.display = "none";
    renderParts();
  } catch (e) {
    $("partsError").textContent = STR.partLoadError + e.message;
    $("partsError").style.display = "block";
  }
}

function renderParts() {
  const box = $("partList");
  if (parts.length === 0) { box.innerHTML = '<div class="part-list-empty">' + esc(STR.partLoading) + "</div>"; return; }
  box.innerHTML = parts.map((p) =>
    `<label class="part-list-item"><input type="radio" name="part-picker" value="${esc(p.code)}" ${selectedPart === p.code ? "checked" : ""}/><span>${esc(p.label)}${p.client ? " (" + esc(p.client) + ")" : ""}</span></label>`
  ).join("");
  box.querySelectorAll("input[name=part-picker]").forEach((inp) => {
    inp.addEventListener("change", () => { selectedPart = selectedPart === inp.value ? "" : inp.value; renderParts(); });
  });
}

function isBareFragment(v) { return !v.includes("*") && !v.includes("-") && v.length <= 10; }
function buildQueryText() {
  let lines = $("snText").value.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (selectedPart) lines = lines.map((l) => (isBareFragment(l) ? `${selectedPart}*${l}` : l));
  const text = lines.join("\n");
  $("snText").value = text;
  return text;
}

async function runCheck(refresh) {
  const text = buildQueryText();
  const err = $("error");
  if (!text) { err.textContent = STR.missingSn; err.style.display = "block"; return; }
  const btn = $("checkBtn");
  btn.disabled = true; err.style.display = "none"; btn.textContent = STR.checking;
  try {
    const token = await getAccessToken();
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ sn: text, refresh }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || STR.unknownError);
    lastData = json;
    renderResults(json);
  } catch (e) {
    err.textContent = e.message; err.style.display = "block";
    lastData = null; $("results").innerHTML = "";
  } finally { btn.disabled = false; btn.textContent = STR.checkButton; }
}

function isBadStatus(s) { return s === "OPEN_REVIEW" || s === "UNKNOWN"; }
function headerHi(ok) { return ok === true ? " header-ok" : ok === false ? " header-bad" : ""; }
function badgeHtml(ok, found) {
  if (!found) return `<span class="badge unknown">${esc(STR.statusNotFound)}</span>`;
  if (ok === true) return `<span class="badge ok">${esc(STR.statusOk)}</span>`;
  if (ok === false) return `<span class="badge bad">${esc(STR.statusBad)}</span>`;
  return `<span class="badge unknown">${esc(STR.statusUnknown)}</span>`;
}
function recordMark(s) { return s === "CLOSED" ? STR.recordOk : s === "OPEN_REVIEW" ? STR.recordReview : STR.recordUnknown; }
function ringSummary(ring) {
  const total = ring.records?.length || 0;
  if (ring.status === "NO_RECORD") return STR.okNoIssue;
  if (ring.status === "CLOSED") return total > 1 ? STR.okClosedMulti(total) : STR.okClosedSingle;
  const open = (ring.records || []).filter((r) => r.status !== "CLOSED").length;
  return STR.needReview(open, total);
}

function renderResults(data) {
  if (data?.dataAsOf) {
    const loc = lang === "vi" ? "vi-VN" : "en-US";
    $("dataAsOf").textContent = STR.dataAsOf + new Date(data.dataAsOf).toLocaleString(loc);
    $("dataAsOf").style.display = "inline";
  }
  const cards = (data.results || []).map((r) => {
    let inner = `<div class="card-header${headerHi(r.overallOk)}"><span>${esc(STR.foundLabelPrefix)}${esc(r.assySn)}</span>${badgeHtml(r.overallOk, r.found)}</div>`;
    if (r.resolvedAssySn) inner += `<div class="resolved-note">${esc(STR.resolvedNote)}<strong>${esc(r.resolvedAssySn)}</strong></div>`;
    if (!r.found && !r.ambiguous) inner += `<div class="not-found">${esc(STR.notFoundText)}</div>`;
    if (r.ambiguous) {
      inner += `<div class="ambiguous"><div>${esc(STR.ambiguousText(r.candidates.length))}</div><ul>` +
        r.candidates.map((c) => `<li><button class="candidate" data-c="${esc(c)}">${esc(c)}</button></li>`).join("") + `</ul></div>`;
    }
    (r.rings || []).forEach((ring) => {
      inner += `<div class="ring-row${isBadStatus(ring.status) ? " ring-row-bad" : ""}"><div class="ring-top"><span>${isBadStatus(ring.status) ? '<span class="warn-icon">!</span>' : ""}[${esc(ring.label)}] ${esc(ring.ringSn)}</span><span>${esc(ringSummary(ring))}</span></div>`;
      (ring.records || []).forEach((rec, i) => {
        inner += `<div class="ring-detail${rec.status !== "CLOSED" ? " ring-detail-bad" : ""}"><div class="ring-detail-title">${esc(STR.noticeTitle(i + 1, ring.records.length))}${esc(recordMark(rec.status))}</div>` +
          `<div>${esc(STR.issueNo)}${esc(rec.issueNo ?? "-")}</div>` +
          `<div>${esc(STR.productName)}${esc(rec.productName ?? "-")}</div>` +
          `<div>${esc(STR.defectDescription)}${esc(rec.defectDescription ?? "-")}</div>` +
          `<div>${esc(STR.processingResults)}${esc(rec.processingResults ?? "-")}</div>` +
          `<div>${esc(STR.closingDate)}${rec.closingDate ? esc(rec.closingDate) : "-"}</div></div>`;
      });
      inner += `</div>`;
    });
    return `<div class="card">${inner}</div>`;
  }).join("");
  $("results").innerHTML = cards;
  $("results").querySelectorAll("button.candidate").forEach((b) => b.addEventListener("click", () => { $("snText").value = b.dataset.c; }));
}

document.addEventListener("DOMContentLoaded", async () => {
  $("loginBtn").addEventListener("click", checkLogin);
  $("passInput").addEventListener("keydown", (e) => { if (e.key === "Enter") checkLogin(); });
  $("emailInput").addEventListener("keydown", (e) => { if (e.key === "Enter") checkLogin(); });
  $("logoutBtn").addEventListener("click", logout);
  $("langVi").addEventListener("click", () => { lang = "vi"; applyLang(); });
  $("langEn").addEventListener("click", () => { lang = "en"; applyLang(); });
  $("checkBtn").addEventListener("click", () => runCheck(false));
  $("refreshBtn").addEventListener("click", () => runCheck(true));
  $("resetBtn").addEventListener("click", () => { $("snText").value = ""; $("results").innerHTML = ""; $("error").style.display = "none"; lastData = null; });
  try { const sb = await getSupabase(); const { data: { session } } = await sb.auth.getSession(); if (session) await enterIfAllowed(); } catch { /* ignore */ }
});
