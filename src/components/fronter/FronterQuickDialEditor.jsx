/**
 * FronterQuickDialEditor.jsx — the admin's master of the quick-dial buttons that sit
 * at the top of the portal. Each button is a number plus the tag shown on it.
 * Saves to the shared SuperAdminConfig record, so every user's buttons update live.
 */
import { useEffect, useState } from 'react';
import useSuperAdminConfig, { contactCardValues } from '@/hooks/useSuperAdminConfig';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const ROWS = [
  { numberKey: 'chrisOfficePhone', labelKey: 'chrisOfficeLabel', name: 'Office line' },
  { numberKey: 'chrisCellPhone', labelKey: 'chrisMobileLabel', name: 'Mobile line' },
];

export default function FronterQuickDialEditor({ username }) {
  const { config, loading, save } = useSuperAdminConfig();
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => { if (!dirty && config) setDraft(contactCardValues(config)); }, [config, dirty]);

  const set = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setDirty(true); };

  const commit = async () => {
    setBusy(true);
    try {
      await save({
        chrisOfficePhone: draft.chrisOfficePhone,
        chrisOfficeLabel: draft.chrisOfficeLabel,
        chrisCellPhone: draft.chrisCellPhone,
        chrisMobileLabel: draft.chrisMobileLabel,
      }, username);
      setDirty(false);
      setSavedAt(new Date());
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  if (loading || !draft) return <div style={{ color: '#4a5568', fontSize: '12px', padding: '10px 0' }}>Loading quick-dial numbers…</div>;

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '16px', marginBottom: '22px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📞 Quick-Dial Buttons — shown on top for every user</div>
        <div style={{ flex: 1 }} />
        {savedAt && <span style={{ color: GOLD, fontSize: '11px' }}>✓ Saved {savedAt.toLocaleTimeString()} — live for everyone</span>}
        {dirty && <span style={{ color: '#f59e0b', fontSize: '11px' }}>Unsaved changes</span>}
        <button onClick={commit} disabled={busy || !dirty} style={{ background: dirty ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(255,255,255,0.06)', color: dirty ? DARK : '#6b7280', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: dirty ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold' }}>{busy ? 'Saving…' : 'Save & push live'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {ROWS.map((row) => (
          <div key={row.numberKey}>
            <label style={ls}>{row.name} — number</label>
            <input value={draft[row.numberKey] || ''} onChange={(e) => set(row.numberKey, e.target.value)} style={inp} placeholder="+1XXXXXXXXXX" />
            <div style={{ height: '10px' }} />
            <label style={ls}>{row.name} — tag</label>
            <input value={draft[row.labelKey] || ''} onChange={(e) => set(row.labelKey, e.target.value)} style={inp} placeholder="Chris · Mobile" />
          </div>
        ))}
      </div>
    </div>
  );
}