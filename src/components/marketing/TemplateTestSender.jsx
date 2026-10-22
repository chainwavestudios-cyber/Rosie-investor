/**
 * TemplateTestSender.jsx — Sends any saved email template to a test address so a
 * template can be checked before a campaign or a contact card uses it.
 *
 * Used by the Debt Call Coach Marketing tab (coach templates) and by the
 * command-center Marketing tab (fronter templates). A test send carries no
 * open/click tracking, so previewing a template never lights up a real contact
 * card's badges.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';

const SYSTEMS = {
  coach: { entity: 'DebtEmailTemplate', labelOf: (t) => t.name || '(untitled)' },
  fronter: { entity: 'FronterEmailTemplate', labelOf: (t) => t.label || '(untitled)' },
};

const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' };

export default function TemplateTestSender({ system = 'coach', username }) {
  const cfg = SYSTEMS[system] || SYSTEMS.coach;
  const storageKey = `template_test_to_${system}`;
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState(() => localStorage.getItem(storageKey) || '');
  const [busyId, setBusyId] = useState('');
  const [status, setStatus] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities[cfg.entity].list('sortOrder', 100);
      setTemplates(page?.items || page || []);
    } catch { setTemplates([]); }
    setLoading(false);
  }, [cfg.entity]);

  useEffect(() => { load(); }, [load]);

  const changeAddress = (value) => {
    setTo(value);
    localStorage.setItem(storageKey, value);
  };

  const sendTest = async (tpl) => {
    const address = to.trim();
    if (!address) {
      setStatus((s) => ({ ...s, [tpl.id]: { ok: false, text: 'Add a test address first.' } }));
      return;
    }
    setBusyId(tpl.id);
    setStatus((s) => ({ ...s, [tpl.id]: { ok: true, text: '⏳ Sending…' } }));
    try {
      const res = await base44.functions.invoke('sendTemplateTest', {
        system, templateId: tpl.id, to: address, sentBy: username,
      });
      const err = res?.data?.error || res?.error;
      if (err) throw new Error(err);
      setStatus((s) => ({ ...s, [tpl.id]: { ok: true, text: `✓ Sent to ${res?.data?.to || address}` } }));
    } catch (e) {
      setStatus((s) => ({ ...s, [tpl.id]: { ok: false, text: `✕ ${e?.message || String(e)}` } }));
    }
    setBusyId('');
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '18px' }}>
      <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🧪 Send a test email</div>
      <div style={{ color: '#8a9ab8', fontSize: '11px', margin: '4px 0 12px' }}>
        Pick any saved template and send it to yourself to see exactly how it arrives — test sends are never tracked, so no contact card is touched.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 340px)', marginBottom: '14px' }}>
        <div>
          <label style={ls}>Send every test to</label>
          <input value={to} onChange={(e) => changeAddress(e.target.value)} placeholder="you@example.com" style={inp} />
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', fontSize: '12px', padding: '14px 0' }}>Loading templates…</div>
      ) : templates.length === 0 ? (
        <div style={{ color: '#4a5568', fontSize: '12px', padding: '14px 0' }}>No saved templates yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((tpl) => {
            const row = status[tpl.id];
            return (
              <div key={tpl.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{cfg.labelOf(tpl)}</div>
                  <div style={{ color: '#6b7280', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.subject || '(no subject)'}</div>
                  {row && <div style={{ color: row.ok ? BLUE : RED, fontSize: '10px', marginTop: '3px' }}>{row.text}</div>}
                </div>
                <button
                  onClick={() => sendTest(tpl)}
                  disabled={busyId === tpl.id}
                  style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '7px 14px', cursor: busyId === tpl.id ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: busyId === tpl.id ? 0.6 : 1 }}
                >
                  {busyId === tpl.id ? '⏳ Sending…' : '🧪 Send test'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}