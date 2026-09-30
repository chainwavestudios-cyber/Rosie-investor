/**
 * HotCallSettingsPanel.jsx — Manager/super-manager/admin control for the
 * Hot Call AI tool. Enable it for all dialers or pick specific usernames.
 * Stored as a single HotCallSettings record.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

export default function HotCallSettingsPanel({ managerUsername }) {
  const [settings, setSettings] = useState(null);
  const [dialers, setDialers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [rows, users] = await Promise.all([
        base44.entities.HotCallSettings.list('-created_date', 10),
        base44.entities.DebtCoachUser.list('-created_date', 500),
      ]);
      setSettings((rows || [])[0] || null);
      setDialers((users || []).filter(u => u.role === 'dialer' && u.isActive));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cur = settings || { enabled: false, applyToAll: true, enabledUsernamesJson: '[]' };
  const selectedNames = (() => { try { return JSON.parse(cur.enabledUsernamesJson || '[]'); } catch { return []; } })();

  const save = async (patch) => {
    setSaving(true);
    setMsg('');
    try {
      if (settings?.id) {
        await base44.entities.HotCallSettings.update(settings.id, {
          ...patch,
          enabledBy: managerUsername,
          enabledAt: new Date().toISOString(),
        });
        setSettings(prev => ({ ...prev, ...patch }));
      } else {
        const created = await base44.entities.HotCallSettings.create({
          enabled: patch.enabled ?? cur.enabled,
          applyToAll: patch.applyToAll ?? cur.applyToAll,
          enabledUsernamesJson: patch.enabledUsernamesJson ?? cur.enabledUsernamesJson,
          enabledBy: managerUsername,
          enabledAt: new Date().toISOString(),
        });
        setSettings(created);
      }
      setMsg('✓ Saved');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg('Save failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  const toggleUser = (name) => {
    const set = new Set(selectedNames);
    if (set.has(name)) set.delete(name); else set.add(name);
    save({ enabledUsernamesJson: JSON.stringify([...set]) });
  };

  if (loading) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading…</div>;

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '16px', padding: '18px 20px', background: '#0d1b2a', border: `1px solid ${GOLD}22`, borderRadius: '6px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>🔥 Hot Call AI — Turbo Intent Engine</div>
        <p style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.6, margin: '0 0 16px' }}>
          Monitors every live call for genuine buying interest. Once a call is clearly not hot, it stops spending AI credits.
          When a hot call is established, the manager portal gets a popup — and if the agent is underperforming, a critical
          alert is sent so you can barge in or take over.
        </p>

        {/* Master enable */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>Enable Hot Call AI</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>Master switch for the turbo intent engine</div>
          </div>
          <Toggle on={cur.enabled} onClick={() => save({ enabled: !cur.enabled })} disabled={saving} />
        </div>

        {cur.enabled && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>Apply to all dialers</div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>Monitor every active dialer</div>
              </div>
              <Toggle on={cur.applyToAll} onClick={() => save({ applyToAll: !cur.applyToAll })} disabled={saving} />
            </div>

            {!cur.applyToAll && (
              <div style={{ padding: '12px 0' }}>
                <label style={ls}>Select specific dialers</label>
                {dialers.length === 0 ? (
                  <div style={{ color: '#4a5568', fontSize: '12px' }}>No active dialers found.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
                    {dialers.map(d => {
                      const on = selectedNames.includes(d.username);
                      return (
                        <button key={d.id} onClick={() => toggleUser(d.username)} disabled={saving} style={{
                          padding: '8px 12px', borderRadius: '4px', textAlign: 'left', cursor: 'pointer',
                          border: `1px solid ${on ? GOLD + '55' : 'rgba(255,255,255,0.1)'}`,
                          background: on ? `${GOLD}14` : 'rgba(255,255,255,0.02)',
                          color: on ? GOLD : '#8a9ab8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                          <span style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1px solid ${on ? GOLD : 'rgba(255,255,255,0.3)'}`, background: on ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0f1e', fontSize: '10px', fontWeight: 'bold' }}>{on ? '✓' : ''}</span>
                          {d.username}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>
            {cur.enabled ? (cur.applyToAll ? 'Monitoring all dialers' : `${selectedNames.length} dialer${selectedNames.length !== 1 ? 's' : ''} selected`) : 'Disabled'}
            {cur.enabledBy && ` · last updated by ${cur.enabledBy}`}
          </span>
          {msg && <span style={{ color: msg.startsWith('✓') ? GOLD : '#ef4444', fontSize: '11px' }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '44px', height: '24px', borderRadius: '12px',
      background: on ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(255,255,255,0.1)',
      border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{ position: 'absolute', top: '2px', left: on ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#0a0f1e', transition: 'left 0.2s' }} />
    </button>
  );
}