import React, { useEffect, useState, Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#ff6b79', fontFamily: 'monospace', background: '#090e14', minHeight: '100vh' }}>
          <h2>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.stack || String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Activity, Database, FileWarning } from 'lucide-react';
import CMM from './pages/CMM.jsx';
import { LangProvider, useLang } from './LangContext.jsx';
import './app-shell.css';

// Dashboard nhúng iframe đều là file tĩnh trong /public.
const TABS = [
  { id: 'cmm', label: 'CMM Dashboard', icon: Activity },
  { id: 'auto-mt', label: 'Auto MT Dashboard', icon: Database },
  { id: 'supplier-ncr', label: 'Supplier NCR', icon: FileWarning },
];

// Lấy tab từ hash (#cmm / #auto-mt / #supplier-ncr). Mặc định cmm.
function tabFromHash() {
  const h = (window.location.hash || '').replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'cmm';
}

// Cổng đăng nhập cho tab CMM. Mật khẩu kiểm tra ở server (/api/sheets, env CMM_AUTH_KEY).
// Không hardcode mật khẩu ở client; chỉ lưu key đã nhập vào sessionStorage để gửi kèm các request.
function CmmGate({ children }) {
  const [authed, setAuthed] = useState(() => {
    try { return !!sessionStorage.getItem('cmm_auth_key'); } catch { return false; }
  });
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  if (authed) return children;

  const submit = async () => {
    if (!pw) { setErr(true); return; }
    setBusy(true); setErr(false);
    try {
      const res = await fetch('/api/sheets?auth=check', { headers: { 'x-auth-key': pw } });
      if (res.ok) {
        sessionStorage.setItem('cmm_auth_key', pw);
        setAuthed(true);
      } else {
        setErr(true);
      }
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 340, background: 'var(--surface, #111827)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 28 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#e5e7eb' }}>CMM Dashboard</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#94a3b8' }}>Nhập mật khẩu để truy cập</p>
        <input
          type="password"
          value={pw}
          autoFocus
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Mật khẩu"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.04)', color: '#e5e7eb', fontSize: 14, outline: 'none' }}
        />
        {err && <div style={{ marginTop: 10, color: '#f87171', fontSize: 12 }}>Mật khẩu không đúng.</div>}
        <button
          onClick={submit}
          disabled={busy}
          style={{ width: '100%', marginTop: 16, padding: '10px 12px', borderRadius: 8, border: 'none', background: busy ? '#334155' : '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer' }}
        >
          {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
      </div>
    </div>
  );
}

function AppInner() {
  const [tab, setTab] = useState(tabFromHash());
  const { lang, setLang, t } = useLang();

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id) => {
    window.location.hash = id;
    setTab(id);
  };

  return (
    <div className="shell">
      <header className="shell-nav">
        <div className="shell-brand">
          <span className="shell-dot" />
          {t('app.brand')}
        </div>
        <nav className="shell-tabs">
          {TABS.map((tb) => {
            const Icon = tb.icon;
            return (
              <button
                key={tb.id}
                className={`shell-tab ${tab === tb.id ? 'is-active' : ''}`}
                onClick={() => go(tb.id)}
              >
                <Icon size={16} />
                {t(`tab.${tb.id}`)}
              </button>
            );
          })}
        </nav>

        {/* Language toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: 3, gap: 2 }}>
          {['vi', 'en'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 12, letterSpacing: '.04em',
              background: lang === l ? '#38bdf8' : 'transparent',
              color: lang === l ? '#0f172a' : '#94a3b8',
              transition: 'all .2s',
            }}>
               {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="shell-body">
        {tab === 'cmm' && <CmmGate><CMM /></CmmGate>}
        {tab === 'auto-mt' && (
          <iframe className="shell-frame" src="/auto-mt.html" title="Auto MT Dashboard" />
        )}
        {tab === 'supplier-ncr' && (
          <iframe className="shell-frame" src="/supplier-ncr/index.html" title="Supplier NCR Dashboard" />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <AppInner />
      </LangProvider>
    </ErrorBoundary>
  );
}
