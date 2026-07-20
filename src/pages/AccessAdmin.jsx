import React, { useEffect, useState } from 'react';
import { getAccessToken } from '../cmmSupabase';

const LABELS = {
  'cmm': 'CMM',
  'supplier-ncr': 'Supplier NCR',
  'shipment-check': 'Shipment Check',
  'inspection-notice': 'Inspection Notice',
  'inspector-eval': 'Inspector Skill',
  'admin': 'Admin (trang này)',
};

const thL = { textAlign: 'left', padding: '8px 10px', color: '#94a3b8', position: 'sticky', left: 0, background: '#0b1220', zIndex: 1 };
const thC = { textAlign: 'center', padding: '8px 10px', color: '#94a3b8', whiteSpace: 'nowrap' };
const tdL = { padding: '8px 10px', fontWeight: 600, position: 'sticky', left: 0, background: '#0b1220', whiteSpace: 'nowrap' };
const tdC = { textAlign: 'center', padding: '6px 10px' };

export default function AccessAdmin() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');

  async function load() {
    setErr('');
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/access-admin', { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
      setData(await r.json());
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(user, dash, enabled, role) {
    const key = user.id + '|' + dash;
    setBusy(key);
    setData(d => {
      const users = d.users.map(x => (x.id === user.id ? { ...x, access: { ...x.access } } : x));
      const t = users.find(x => x.id === user.id);
      if (enabled) t.access[dash] = role; else delete t.access[dash];
      return { ...d, users };
    });
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/access-admin', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, dashboard: dash, role, enabled }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
    } catch (e) { alert('Lỗi lưu: ' + e.message); load(); }
    finally { setBusy(''); }
  }

  if (err) return <div style={{ padding: 20, color: '#f87171' }}>Lỗi: {err}</div>;
  if (!data) return <div style={{ padding: 20, color: '#94a3b8' }}>Đang tải…</div>;

  const dashboards = data.dashboards || [];
  const users = (data.users || []).filter(u => u.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ padding: '16px 20px', color: '#e2e8f0', fontFamily: 'Segoe UI,system-ui,Arial,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Quản trị quyền dashboard</h2>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm email…"
          style={{ background: '#0e1626', border: '1px solid #1e293b', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', minWidth: 220 }} />
      </div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 0 }}>
        Tick để cấp quyền vào dashboard. Role <b>viewer</b> = chỉ xem; <b>admin</b> = thêm quyền quản trị trong dashboard đó.
        Cột <b>Admin (trang này)</b> = cho phép người đó vào trang quản trị quyền. Tổng: {data.users.length} tài khoản.
      </p>
      <div style={{ overflow: 'auto', border: '1px solid #1e293b', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0e1626' }}>
              <th style={thL}>Email</th>
              {dashboards.map(d => <th key={d} style={thC}>{LABELS[d] || d}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid #1e293b' }}>
                <td style={tdL}>{u.email}</td>
                {dashboards.map(d => {
                  const on = d in u.access;
                  const role = u.access[d] || 'viewer';
                  const key = u.id + '|' + d;
                  return (
                    <td key={d} style={tdC}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: busy === key ? 0.5 : 1 }}>
                        <input type="checkbox" checked={on} disabled={busy === key}
                          onChange={e => toggle(u, d, e.target.checked, d === 'admin' ? 'admin' : role)} />
                        {on && d !== 'admin' && (
                          <select value={role} disabled={busy === key}
                            onChange={e => toggle(u, d, true, e.target.value)}
                            style={{ background: '#0e1626', border: '1px solid #1e293b', color: '#cbd5e1', borderRadius: 6, fontSize: 11, padding: '1px 4px' }}>
                            <option value="viewer">viewer</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
