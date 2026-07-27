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
let userRole = "";   // role của người đăng nhập (từ dashboard_access, khóa 'shipment-check')
const isAdmin = () => userRole === "admin";

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
    if (res.ok) { try { const j = await res.json(); userRole = j.role || ""; } catch { userRole = ""; } showApp(); return true; }
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
  // Lịch sử kiểm tra chỉ admin thấy
  const hist = document.querySelector(".history-card");
  if (hist) hist.style.display = isAdmin() ? "block" : "none";
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
    const json = await fetch("/api/check?parts=1", { headers: { Authorization: "Bearer " + token } }).then((r) => r.json());
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
    logCheck(text, json);   // ghi nhật ký: ai + thời điểm + S/N + kết quả
  } catch (e) {
    err.textContent = e.message; err.style.display = "block";
    lastData = null; $("results").innerHTML = "";
  } finally { btn.disabled = false; btn.textContent = STR.checkButton; }
}

// ---- Nhật ký kiểm tra (ai + thời điểm + S/N + kết quả) ----
function summarizeResults(json) {
  const rs = (json && json.results) || [];
  // Chỉ 1 S/N: nêu rõ kết quả, không lặp lại số S/N (đã có ở cột S/N tra)
  if (rs.length === 1) {
    const r = rs[0];
    if (!r.found) return "Không thấy";
    return r.overallOk === false ? "CHƯA OK" : "OK";
  }
  const okList = rs.filter(r => r.overallOk === true);
  const badList = rs.filter(r => r.overallOk === false);
  const notFound = rs.filter(r => !r.found);
  const nf = notFound.length;
  let s = `${rs.length} S/N: ${okList.length} OK, ${badList.length} CHƯA OK`;
  if (badList.length) s += ` (${badList.map(r => r.assySn).join(", ")})`;
  if (nf) s += `, ${nf} không thấy: ${notFound.map(r => r.assySn).join(", ")}`;
  return s;
}
async function logCheck(query, json) {
  try {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    await sb.from("shipment_check_log").insert({
      user_id: session.user.id,
      user_email: session.user.email,
      query: String(query).slice(0, 2000),
      result: summarizeResults(json).slice(0, 1500),
    });
  } catch { /* lỗi ghi log không chặn tra cứu */ }
}
// Tô đỏ đậm phần "N CHƯA OK" / "N không thấy" khi N>0. Trả { html, hasIssue }.
function fmtResult(text) {
  if (!text) return { html: "", hasIssue: false };
  let hasIssue = false;
  // Trường hợp 1 S/N: chỉ có chữ "CHƯA OK" / "Không thấy" (không kèm số) → tô đỏ cả dòng
  const t = String(text).trim();
  if (/^(CHƯA OK|Không thấy)$/i.test(t)) return { html: `<b class="hist-red">${esc(t)}</b>`, hasIssue: true };
  let html = esc(text)
    .replace(/(\d+)\s*CHƯA OK/g, (m, n) => { if (Number(n) > 0) { hasIssue = true; return `<b class="hist-red">${m}</b>`; } return m; })
    .replace(/(\d+)\s*không thấy/g, (m, n) => { if (Number(n) > 0) { hasIssue = true; return `<b class="hist-red">${m}</b>`; } return m; });
  return { html, hasIssue };
}

// Hiển thị gọn khi 1 S/N (kể cả lượt cũ đã lưu dạng dài): OK / CHƯA OK / Không thấy
function displayResult(query, result) {
  const sns = String(query || "").split(/\n/).map(s => s.trim()).filter(Boolean);
  const res = String(result || "").trim();
  if (sns.length !== 1) return res;
  if (/^(OK|CHƯA OK|Không thấy)$/i.test(res)) return res;
  const c = numCounts(res);
  if (c.nf > 0) return "Không thấy";
  if (c.bad > 0) return "CHƯA OK";
  return "OK";
}
async function loadHistory(term) {
  const box = $("scHistory");
  box.innerHTML = '<div class="hist-empty">Đang tải...</div>';
  try {
    const sb = await getSupabase();
    let q = sb.from("shipment_check_log")
      .select("checked_at, user_email, query, result")
      .order("checked_at", { ascending: false })
      .limit(200);
    const t = (term || "").trim();
    let scope;
    if (t) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        q = q.gte("checked_at", t + "T00:00:00+07:00").lte("checked_at", t + "T23:59:59+07:00");
        scope = `Ngày ${t}`;
      } else {
        const safe = t.replace(/[,%()*]/g, " ").trim();
        q = q.or(`user_email.ilike.%${safe}%,query.ilike.%${safe}%,result.ilike.%${safe}%`);
        scope = `Tìm: "${t}"`;
      }
    } else {
      // Mặc định: chỉ lịch sử HÔM NAY (giờ VN +07:00) để list không quá dài
      const now = new Date();
      const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      q = q.gte("checked_at", d + "T00:00:00+07:00").lte("checked_at", d + "T23:59:59+07:00");
      scope = `Hôm nay (${d})`;
    }
    const { data, error } = await q;
    if (error) throw error;
    const cap = `<div class="hist-scope">${esc(scope)} · ${(data || []).length} lượt</div>`;
    if (!data || !data.length) { box.innerHTML = cap + '<div class="hist-empty">Không có lượt kiểm tra.</div>'; return; }
    box.innerHTML = cap + '<table class="hist"><thead><tr>'
      + '<th>Thời điểm</th><th>Người</th><th>S/N tra</th><th>Kết quả</th></tr></thead><tbody>'
      + data.map(r => {
          const bad = fmtResult(displayResult(r.query, r.result));
          return `<tr class="${bad.hasIssue ? 'hist-bad' : ''}">
            <td class="ht-time">${esc(new Date(r.checked_at).toLocaleString("vi-VN"))}</td>
            <td class="ht-user">${esc(r.user_email || "")}</td>
            <td class="ht-sn">${(r.query || "").split("\n").map(s => esc(s.trim())).filter(Boolean).join("<br>")}</td>
            <td class="ht-res">${bad.html}</td></tr>`;
        }).join("")
      + "</tbody></table>";
  } catch (e) {
    box.innerHTML = '<div class="hist-empty">Không tải được lịch sử: ' + esc(e.message) + "</div>";
  }
}

// ---- Phân tích lịch sử (admin) ----
function anaStart(period) {
  const nowVN = new Date(Date.now() + 7 * 3600e3);
  let start;
  if (period === "week") { const dow = (nowVN.getUTCDay() + 6) % 7; start = new Date(nowVN); start.setUTCDate(nowVN.getUTCDate() - dow); }
  else if (period === "month") { start = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), 1)); }
  else { const n = Number(period) || 7; start = new Date(nowVN); start.setUTCDate(nowVN.getUTCDate() - (n - 1)); }
  const y = start.getUTCFullYear(), m = String(start.getUTCMonth() + 1).padStart(2, "0"), d = String(start.getUTCDate()).padStart(2, "0");
  const labels = { week: "Tuần này", month: "Tháng này", "7": "7 ngày qua", "30": "30 ngày qua" };
  return { startISO: `${y}-${m}-${d}T00:00:00+07:00`, label: `${labels[period] || period} (từ ${y}-${m}-${d})` };
}
function anaList(title, arr) {
  return `<div class="ana-block"><h4>${title}</h4>${arr.length ? arr.map(([k, v]) => `<div class="ana-row"><span>${esc(k)}</span><b>${v}</b></div>`).join("") : '<div class="ana-row muted">—</div>'}</div>`;
}
const pct = (n, t) => t > 0 ? (Math.round(n / t * 1000) / 10) + "%" : "0%";
// Tách S/N theo kết quả từ 1 lượt (best-effort; lượt cũ thiếu list thì suy theo số đếm)
function classifyRow(query, result) {
  const sns = String(query || "").split(/\n/).map(s => s.trim()).filter(Boolean);
  const res = String(result || "").trim();
  const out = { ok: [], bad: [], nf: [] };
  const one = sns.length === 1 ? sns[0] : null;
  if (/^OK$/i.test(res)) { if (one) out.ok.push(one); return out; }
  if (/^CHƯA OK$/i.test(res)) { if (one) out.bad.push(one); return out; }
  if (/^Không thấy$/i.test(res)) { if (one) out.nf.push(one); return out; }
  const badM = res.match(/CHƯA OK\s*\(([^)]*)\)/i); out.bad = badM ? badM[1].split(",").map(s => s.trim()).filter(Boolean) : [];
  const nfM = res.match(/không thấy:\s*(.+)$/i); out.nf = nfM ? nfM[1].split(",").map(s => s.trim()).filter(Boolean) : [];
  const bset = new Set(out.bad), nset = new Set(out.nf);
  sns.forEach(sn => { if (!bset.has(sn) && !nset.has(sn)) out.ok.push(sn); });
  return out;
}
function numCounts(result) {
  const res = String(result || "").trim();
  if (/^OK$/i.test(res)) return { ok: 1, bad: 0, nf: 0 };
  if (/^CHƯA OK$/i.test(res)) return { ok: 0, bad: 1, nf: 0 };
  if (/^Không thấy$/i.test(res)) return { ok: 0, bad: 0, nf: 1 };
  const mo = res.match(/:\s*(\d+)\s*OK/), mb = res.match(/(\d+)\s*CHƯA OK/), mn = res.match(/(\d+)\s*không thấy/i);
  return { ok: mo ? +mo[1] : 0, bad: mb ? +mb[1] : 0, nf: mn ? +mn[1] : 0 };
}
const DOW_VN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
// Số tuần ISO (FW) từ 1 Date (theo UTC)
function isoWeekNum(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil((((x - ys) / 86400000) + 1) / 7);
}
const fmtDM = (dt) => `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
let anaRows = [], anaLabel = "";
async function loadAnalysis() {
  const box = $("scAnalysis"); box.innerHTML = '<div class="hist-empty">Đang tải...</div>';
  const period = $("scAnaPeriod").value;
  const { startISO, label } = anaStart(period);
  anaLabel = label;
  try {
    // Đảm bảo danh sách part (mã assembly) đã nạp — nếu không, mọi S/N sẽ dồn vào "Khác".
    if (!parts || !parts.length) { try { await loadParts(); } catch (_) {} }
    const sb = await getSupabase();
    const { data, error } = await sb.from("shipment_check_log")
      .select("checked_at, user_email, query, result")
      .gte("checked_at", startISO).order("checked_at", { ascending: false }).limit(5000);
    if (error) throw error;
    const rows = data || []; anaRows = rows;
    // Nhận diện TÊN part: S/N bắt đầu bằng mã assembly nào thì lấy tên part đó (khớp dài nhất).
    const partsUp = (parts || []).map(p => ({ code: String(p.code || "").trim().toUpperCase(), label: p.label }))
      .filter(p => p.code).sort((a, b) => b.code.length - a.code.length);
    const partOf = (sn) => {
      const s = String(sn || "").trim().toUpperCase();
      for (const p of partsUp) { if (s.startsWith(p.code)) return p.label; }
      return null; // không khớp part nào (vd S/N test lẻ) → không tính vào bảng Part
    };

    let ok = 0, bad = 0, nf = 0;
    const byUser = {}, byHour = {}, byDow = {}, byWeek = {};
    const byPartTot = {}, byPartBad = {}, byPartNf = {}, bySN = {}, nfSNs = {};
    let morning = 0, afternoon = 0;
    rows.forEach(r => {
      const c = numCounts(r.result); ok += c.ok; bad += c.bad; nf += c.nf;
      const u = r.user_email || "—"; byUser[u] = (byUser[u] || 0) + 1;
      const dVN = new Date(new Date(r.checked_at).getTime() + 7 * 3600e3);
      const h = dVN.getUTCHours(); byHour[h] = (byHour[h] || 0) + 1;
      (h < 12 ? morning++ : afternoon++);
      byDow[dVN.getUTCDay()] = (byDow[dVN.getUTCDay()] || 0) + 1;
      // tuần (thứ Hai) theo VN
      const mon = new Date(dVN); mon.setUTCDate(dVN.getUTCDate() - ((dVN.getUTCDay() + 6) % 7));
      const wk = mon.toISOString().slice(0, 10);
      const w = byWeek[wk] || (byWeek[wk] = { key: mon.getTime(), mon: new Date(mon), luot: 0, ok: 0, bad: 0, nf: 0 });
      w.luot++; w.ok += c.ok; w.bad += c.bad; w.nf += c.nf;
      // theo part + S/N
      const cl = classifyRow(r.query, r.result);
      const snLines = String(r.query || "").split(/\n/).map(s => s.trim()).filter(Boolean);
      snLines.forEach(sn => {
        const lbl = partOf(sn); if (lbl) byPartTot[lbl] = (byPartTot[lbl] || 0) + 1;
        bySN[sn] = (bySN[sn] || 0) + 1;
      });
      // Nếu mọi S/N trong lượt cùng 1 part -> dùng quy số đếm khi kết quả cũ không liệt kê từng S/N.
      const distinctParts = new Set(snLines.map(partOf));
      const singlePart = (distinctParts.size === 1 && !distinctParts.has(null)) ? [...distinctParts][0] : null;
      // CHƯA OK: ưu tiên danh sách S/N chính xác; nếu kết quả cũ thiếu danh sách thì quy theo số đếm (khi cùng 1 part).
      if (c.bad > 0) {
        if (cl.bad.length === c.bad) {
          cl.bad.forEach(sn => { const lbl = partOf(sn); if (lbl) byPartBad[lbl] = (byPartBad[lbl] || 0) + 1; });
        } else if (singlePart) {
          byPartBad[singlePart] = (byPartBad[singlePart] || 0) + c.bad;
        }
      }
      // Không thấy: tương tự
      if (c.nf > 0) {
        if (cl.nf.length === c.nf) {
          cl.nf.forEach(sn => { const lbl = partOf(sn); if (lbl) byPartNf[lbl] = (byPartNf[lbl] || 0) + 1; nfSNs[sn] = (nfSNs[sn] || 0) + 1; });
        } else if (singlePart) {
          byPartNf[singlePart] = (byPartNf[singlePart] || 0) + c.nf;
        }
      }
    });
    const totalSN = ok + bad + nf;
    const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
    const hourTop = top(byHour, 3).map(([h, c]) => `${String(h).padStart(2, "0")}h (${c})`).join(" · ");

    // (2) Xu hướng theo tuần
    const weeks = Object.values(byWeek).sort((a, b) => a.key - b.key);
    const maxBadPct = Math.max(1, ...weeks.map(w => { const t = w.ok + w.bad + w.nf; return t ? w.bad / t * 100 : 0; }));
    const weekRows = weeks.map(w => {
      const t = w.ok + w.bad + w.nf, bp = t ? w.bad / t * 100 : 0;
      const sun = new Date(w.mon.getTime() + 6 * 86400e3);
      const lbl = `FW${isoWeekNum(w.mon)} (${fmtDM(w.mon)}~${fmtDM(sun)})`;
      return `<tr><td>${lbl}</td><td>${w.luot}</td><td>${t}</td><td>${w.ok}</td><td class="c-bad">${w.bad}</td><td>${w.nf}</td>
        <td><div class="ana-bar"><i style="width:${(bp / maxBadPct * 100).toFixed(0)}%"></i></div><span>${pct(w.bad, t)}</span></td></tr>`; }).join("");

    // (3) Part tỷ lệ Chưa OK cao nhất (ưu tiên tỷ lệ, min 3 S/N)
    const partRank = Object.keys(byPartTot).map(p => ({ p, tot: byPartTot[p], bad: byPartBad[p] || 0 }))
      .filter(x => x.tot >= 1).sort((a, b) => (b.bad / b.tot) - (a.bad / a.tot) || b.bad - a.bad).slice(0, 8);
    // Dòng "Khác / Chưa xác định": phần chênh so với KPI (S/N test lẻ, gõ thiếu mã, hoặc part ngoài top 8)
    // -> để cột S/N và Chưa OK cộng lại khớp đúng tổng KPI.
    const shownTot = partRank.reduce((s, x) => s + x.tot, 0);
    const shownBad = partRank.reduce((s, x) => s + x.bad, 0);
    const otherTot = Math.max(0, totalSN - shownTot);
    const otherBad = Math.max(0, bad - shownBad);
    const partRankAll = partRank.slice();
    if (otherTot > 0 || otherBad > 0) partRankAll.push({ p: "Khác / Chưa xác định", tot: otherTot, bad: otherBad, other: true });
    const partBadRows = partRankAll.map(x => `<tr${x.other ? ' class="muted"' : ""}><td>${esc(x.p)}</td><td>${x.tot}</td><td class="c-bad">${x.bad}</td><td>${pct(x.bad, x.tot)}</td></tr>`).join("");

    // (4) Không thấy theo part + top S/N
    const nfPartRows = top(byPartNf, 6).map(([p, c]) => `<div class="ana-row"><span>${esc(p)}</span><b>${c}</b></div>`).join("") || '<div class="ana-row muted">—</div>';
    const nfSnTop = top(nfSNs, 8).map(([s, c]) => `<div class="ana-row"><span>${esc(s)}</span><b>${c > 1 ? c + "×" : ""}</b></div>`).join("") || '<div class="ana-row muted">—</div>';

    // (5) S/N kiểm nhiều lần
    const repeated = Object.entries(bySN).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const repRows = repeated.length ? repeated.map(([s, c]) => `<div class="ana-row"><span>${esc(s)}</span><b>${c}×</b></div>`).join("") : '<div class="ana-row muted">Không có S/N nào kiểm ≥2 lần</div>';

    // (6) Phân bố theo thứ + ca
    const dowRows = [1,2,3,4,5,6,0].map(d => `<div class="ana-row"><span>${DOW_VN[d]}</span><b>${byDow[d] || 0}</b></div>`).join("");

    // Lưu số liệu để xuất báo cáo PDF
    window.__ANA = {
      label, luot: rows.length, totalSN, ok, bad, nf,
      weeks: weeks.map(w => { const t = w.ok + w.bad + w.nf; const sun = new Date(w.mon.getTime() + 6 * 86400e3);
        return { lbl: `FW${isoWeekNum(w.mon)} (${fmtDM(w.mon)}~${fmtDM(sun)})`, luot: w.luot, t, ok: w.ok, bad: w.bad, nf: w.nf, bp: t ? Math.round(w.bad / t * 1000) / 10 : 0 }; }),
      partRank: partRankAll, users: top(byUser, 10), partsTop: top(byPartTot, 10), nfParts: top(byPartNf, 10),
      dow: [1, 2, 3, 4, 5, 6, 0].map(d => [DOW_VN[d], byDow[d] || 0]),
      morning, afternoon, hourTop,
    };
    box.innerHTML = `<div class="hist-scope" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span>${esc(label)} · ${rows.length} lượt · ${totalSN} S/N</span>
        <span style="display:flex;gap:8px"><button type="button" id="scAnaPdf" class="ana-export">🖨 Xuất PDF</button><button type="button" id="scAnaExport" class="ana-export" style="background:var(--surface);color:var(--text)">⬇ Excel</button></span></div>
      <div class="ana-kpis">
        <div class="ana-kpi"><div class="n">${rows.length}</div><div class="l">Lượt kiểm</div></div>
        <div class="ana-kpi"><div class="n">${totalSN}</div><div class="l">Tổng S/N</div></div>
        <div class="ana-kpi ok"><div class="n">${ok}</div><div class="l">OK · ${pct(ok, totalSN)}</div></div>
        <div class="ana-kpi bad"><div class="n">${bad}</div><div class="l">CHƯA OK · ${pct(bad, totalSN)}</div></div>
        <div class="ana-kpi nf"><div class="n">${nf}</div><div class="l">Không thấy · ${pct(nf, totalSN)}</div></div>
      </div>
      <div class="ana-block"><h4>Xu hướng theo tuần (Thứ Hai)</h4>
        <table class="ana-tbl"><thead><tr><th>Tuần</th><th>Lượt</th><th>S/N</th><th>OK</th><th>Chưa OK</th><th>Ko thấy</th><th>% Chưa OK</th></tr></thead>
        <tbody>${weekRows || '<tr><td colspan="7" class="muted">—</td></tr>'}</tbody></table></div>
      <div class="ana-block"><h4>Part có tỷ lệ Chưa OK cao</h4>
        <table class="ana-tbl"><thead><tr><th>Part</th><th>S/N</th><th>Chưa OK</th><th>%</th></tr></thead>
        <tbody>${partBadRows || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table></div>
      <div class="ana-cols">
        ${anaList("Người kiểm nhiều nhất", top(byUser, 6))}
        ${anaList("Part kiểm nhiều nhất (số S/N)", top(byPartTot, 6))}
        <div class="ana-block"><h4>Không thấy — theo Part</h4>${nfPartRows}</div>
        <div class="ana-block"><h4>Không thấy — S/N</h4>${nfSnTop}</div>
        <div class="ana-block"><h4>S/N kiểm nhiều lần (≥2)</h4>${repRows}</div>
        <div class="ana-block"><h4>Phân bố theo thứ</h4>${dowRows}
          <div class="ana-row" style="border-top:2px solid var(--border)"><span>Ca sáng / chiều</span><b>${morning} / ${afternoon}</b></div>
          <div class="ana-row"><span>Giờ cao điểm</span><b>${hourTop || "—"}</b></div></div>
      </div>`;
    const ex = $("scAnaExport"); if (ex) ex.addEventListener("click", exportAnalysis);
    const pf = $("scAnaPdf"); if (pf) pf.addEventListener("click", exportShipmentPdf);
  } catch (e) {
    box.innerHTML = '<div class="hist-empty">Không tải được: ' + esc(e.message) + "</div>";
  }
}
// (9) Xuất Excel: các lượt trong kỳ (Thời điểm, Người, S/N, Kết quả)
function exportAnalysis() {
  const e = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const head = "<tr><th>Thời điểm</th><th>Người</th><th>S/N tra</th><th>Kết quả</th></tr>";
  const body = (anaRows || []).map(r => `<tr><td>${e(new Date(r.checked_at).toLocaleString("vi-VN"))}</td><td>${e(r.user_email || "")}</td><td>${e(String(r.query || "").replace(/\n/g, " | "))}</td><td>${e(r.result || "")}</td></tr>`).join("");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><h3>Shipment Check — ${e(anaLabel)}</h3><table border="1">${head}${body}</table></body></html>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "ShipmentCheck_" + (anaLabel.match(/\d{4}-\d{2}-\d{2}/) || ["export"])[0] + ".xls";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Xuất báo cáo KPI dạng PDF (mở cửa sổ báo cáo có định dạng -> in / lưu PDF)
function exportShipmentPdf() {
  const A = window.__ANA;
  if (!A) { alert("Chưa có dữ liệu phân tích. Hãy mở 📊 Phân tích lịch sử trước."); return; }
  const e = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const P = (n, t) => t > 0 ? (Math.round(n / t * 1000) / 10) + "%" : "0%";
  const kpi = (n, l, cls) => `<div class="k ${cls || ""}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const weekRows = A.weeks.map(w => `<tr><td>${e(w.lbl)}</td><td>${w.luot}</td><td>${w.t}</td><td>${w.ok}</td><td class="bad">${w.bad}</td><td>${w.nf}</td><td>${w.bp}%</td></tr>`).join("");
  const partRows = A.partRank.map(x => `<tr><td>${e(x.p)}</td><td>${x.tot}</td><td class="bad">${x.bad}</td><td>${P(x.bad, x.tot)}</td></tr>`).join("");
  const list = (title, arr) => `<div class="blk"><h3>${title}</h3><table>${(arr && arr.length ? arr : []).map(([k, v]) => `<tr><td>${e(k)}</td><td class="r">${v}</td></tr>`).join("") || "<tr><td>—</td><td></td></tr>"}</table></div>`;
  const dowRows = A.dow.map(([d, c]) => `<tr><td>${e(d)}</td><td class="r">${c}</td></tr>`).join("");
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Shipment Check — Báo cáo phân tích</title>
  <style>
   *{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
   body{margin:24px;color:#16181d}
   h1{font-size:20px;margin:0 0 2px}.sub{color:#6b7280;font-size:13px;margin-bottom:16px}
   .kpis{display:flex;gap:10px;margin-bottom:16px}
   .k{flex:1;border:1px solid #e4e7ee;border-radius:8px;padding:10px 8px;text-align:center}
   .k .n{font-size:22px;font-weight:800;line-height:1.1}.k .l{font-size:11px;color:#6b7280;margin-top:3px}
   .k.ok .n{color:#157347}.k.bad .n{color:#c0342b}.k.nf .n{color:#b45309}
   h2{font-size:15px;margin:16px 0 6px;border-bottom:2px solid #e4e7ee;padding-bottom:3px}
   table{width:100%;border-collapse:collapse;font-size:12px}
   th,td{border:1px solid #e4e7ee;padding:5px 7px;text-align:center}
   th{background:#f4f6fb;color:#374151}td:first-child,th:first-child{text-align:left}
   td.bad{color:#c0342b;font-weight:700}.r{text-align:right}
   .cols{display:flex;gap:12px}.blk{flex:1}.blk h3{font-size:12px;margin:8px 0 4px;color:#374151}
   @media print{@page{size:A4;margin:12mm}body{margin:0}}
  </style></head><body onload="setTimeout(function(){window.print()},250)">
   <h1>Shipment Check — Báo cáo phân tích</h1>
   <div class="sub">${e(A.label)} · Xuất: ${e(new Date().toLocaleString("vi-VN"))}</div>
   <div class="kpis">
     ${kpi(A.luot, "Lượt kiểm")}${kpi(A.totalSN, "Tổng S/N")}
     ${kpi(A.ok + " (" + P(A.ok, A.totalSN) + ")", "OK", "ok")}
     ${kpi(A.bad + " (" + P(A.bad, A.totalSN) + ")", "CHƯA OK", "bad")}
     ${kpi(A.nf + " (" + P(A.nf, A.totalSN) + ")", "Không thấy", "nf")}
   </div>
   <h2>Xu hướng theo tuần</h2>
   <table><thead><tr><th>Tuần</th><th>Lượt</th><th>S/N</th><th>OK</th><th>Chưa OK</th><th>Ko thấy</th><th>% Chưa OK</th></tr></thead><tbody>${weekRows || '<tr><td colspan="7">—</td></tr>'}</tbody></table>
   <h2>Part có tỷ lệ Chưa OK cao</h2>
   <table><thead><tr><th>Part</th><th>S/N</th><th>Chưa OK</th><th>%</th></tr></thead><tbody>${partRows || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
   <h2>Chi tiết</h2>
   <div class="cols">
     ${list("Người kiểm nhiều nhất", A.users)}
     ${list("Part kiểm nhiều (số S/N)", A.partsTop)}
     ${list("Không thấy — theo Part", A.nfParts)}
   </div>
   <div class="cols" style="margin-top:12px">
     <div class="blk"><h3>Phân bố theo thứ</h3><table>${dowRows}</table></div>
     <div class="blk"><h3>Ca / Giờ</h3><table><tr><td>Ca sáng / chiều</td><td class="r">${A.morning} / ${A.afternoon}</td></tr><tr><td>Giờ cao điểm</td><td class="r">${e(A.hourTop || "—")}</td></tr></table></div>
   </div>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Trình duyệt chặn cửa sổ. Hãy cho phép pop-up rồi thử lại."); return; }
  w.document.open(); w.document.write(html); w.document.close();
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
          (isAdmin() ? `<div>${esc(STR.defectDescription)}${esc(rec.defectDescription ?? "-")}</div>` : "") +
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
  $("scHistoryBtn").addEventListener("click", () => {
    const wrap = $("scHistoryWrap");
    if (wrap.style.display === "none" || !wrap.style.display) { wrap.style.display = "block"; loadHistory(); }
    else wrap.style.display = "none";
  });
  $("scHistSearchBtn").addEventListener("click", () => loadHistory($("scHistSearch").value));
  $("scHistSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") loadHistory($("scHistSearch").value); });
  $("scHistClearBtn").addEventListener("click", () => { $("scHistSearch").value = ""; const d = $("scHistDate"); if (d) d.value = ""; loadHistory(); });
  { const d = $("scHistDate"); if (d) d.addEventListener("change", () => { $("scHistSearch").value = ""; loadHistory(d.value); }); }
  { const ab = $("scAnalysisBtn"); if (ab) ab.addEventListener("click", () => {
      const w = $("scAnalysisWrap");
      if (w.style.display === "none" || !w.style.display) { w.style.display = "block"; loadAnalysis(); }
      else w.style.display = "none";
    }); }
  { const ap = $("scAnaPeriod"); if (ap) ap.addEventListener("change", loadAnalysis); }
  try { const sb = await getSupabase(); const { data: { session } } = await sb.auth.getSession(); if (session) await enterIfAllowed(); } catch { /* ignore */ }
});
