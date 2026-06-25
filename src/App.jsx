import React, { useEffect, useState } from 'react';
import { Activity, Database, FileWarning } from 'lucide-react';
import CMM from './pages/CMM.jsx';
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

export default function App() {
  const [tab, setTab] = useState(tabFromHash());

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
          Quality Management Hub
        </div>
        <nav className="shell-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`shell-tab ${tab === t.id ? 'is-active' : ''}`}
                onClick={() => go(t.id)}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="shell-body">
        {tab === 'cmm' && <CMM />}
        {tab === 'auto-mt' && (
          <iframe
            className="shell-frame"
            src="/auto-mt.html"
            title="Auto MT Dashboard"
          />
        )}
        {tab === 'supplier-ncr' && (
          <iframe
            className="shell-frame"
            src="/supplier-ncr/index.html"
            title="Supplier NCR Dashboard"
          />
        )}
      </main>
    </div>
  );
}
