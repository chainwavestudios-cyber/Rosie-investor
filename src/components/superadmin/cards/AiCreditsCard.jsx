/**
 * AiCreditsCard.jsx — Debt Call Coach system: what this app's AI actually spends,
 * per model and per call type, plus the Base44 workspace credit snapshot the
 * super admin keeps current (the workspace numbers are not readable from app code,
 * so they are entered here and stamped with the time they were taken).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import useSuperAdminConfig from '@/hooks/useSuperAdminConfig';
import { C, lbl, val, rowStyle, emptyStyle, chip, btn, inputStyle, bar, barFill, asArray } from '@/components/superadmin/kit';

export default function AiCreditsCard({ username }) {
  const { config, save } = useSuperAdminConfig();
  const [models, setModels] = useState([]);
  const [types, setTypes] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [byModel, byType] = await Promise.all([
        base44.entities.AICreditUsage.aggregate({ groupBy: 'model', sum: ['estimatedCredits', 'inputTokens', 'outputTokens'] }),
        base44.entities.AICreditUsage.aggregate({ groupBy: 'callType', sum: ['estimatedCredits'] }),
      ]);
      setModels(asArray(byModel?.rows).sort((a, b) => (b.sum_estimatedCredits || 0) - (a.sum_estimatedCredits || 0)));
      setTypes(asArray(byType?.rows).sort((a, b) => (b.sum_estimatedCredits || 0) - (a.sum_estimatedCredits || 0)));
    } catch { /* usage table unavailable */ }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const appCredits = useMemo(() => models.reduce((sum, r) => sum + (r.sum_estimatedCredits || 0), 0), [models]);
  const tokens = useMemo(() => models.reduce((sum, r) => sum + (r.sum_inputTokens || 0) + (r.sum_outputTokens || 0), 0), [models]);

  const startEdit = () => {
    setDraft({
      workspacePlan: config?.workspacePlan || '',
      messageCreditsLeft: config?.messageCreditsLeft ?? 0,
      messageCreditsTotal: config?.messageCreditsTotal ?? 0,
      integrationCreditsUsed: config?.integrationCreditsUsed ?? 0,
      integrationCreditsTotal: config?.integrationCreditsTotal ?? 0,
      creditsResetDate: config?.creditsResetDate || '',
    });
    setEditing(true);
  };

  const commit = async () => {
    setBusy(true);
    try {
      await save({ ...draft, snapshotAt: new Date().toISOString() }, username);
      setEditing(false);
    } finally { setBusy(false); }
  };

  const msgPct = config?.messageCreditsTotal ? ((config.messageCreditsLeft || 0) / config.messageCreditsTotal) * 100 : 0;
  const intPct = config?.integrationCreditsTotal ? ((config.integrationCreditsUsed || 0) / config.integrationCreditsTotal) * 100 : 0;

  const num = (key, label) => (
    <div key={key} style={{ marginBottom: '8px' }}>
      <label style={lbl}>{label}</label>
      <input style={inputStyle} value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div>
      {/* ── Workspace credits ── */}
      <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '10px 12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ color: C.ink, fontSize: '12px', fontWeight: 'bold' }}>Base44 workspace</span>
          <span style={chip(C.purple)}>{config?.workspacePlan || 'plan not set'}</span>
          <div style={{ flex: 1 }} />
          {!editing
            ? <button onClick={startEdit} style={btn(C.purple)}>Update snapshot</button>
            : <><button onClick={() => setEditing(false)} style={btn(C.muted)}>Cancel</button><button onClick={commit} disabled={busy} style={btn(C.fronter)}>{busy ? 'Saving…' : 'Save'}</button></>}
        </div>

        {!editing ? (
          <>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.muted }}>
                <span>Message credits left</span>
                <span style={{ color: C.ink, fontWeight: 'bold' }}>{config?.messageCreditsLeft ?? '—'} / {config?.messageCreditsTotal ?? '—'}</span>
              </div>
              <div style={bar(C.coach, msgPct)}><div style={barFill(C.coach, msgPct)} /></div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.muted }}>
                <span>Integration credits used</span>
                <span style={{ color: C.ink, fontWeight: 'bold' }}>{config?.integrationCreditsUsed ?? '—'} / {config?.integrationCreditsTotal ?? '—'}</span>
              </div>
              <div style={bar(C.warn, intPct)}><div style={barFill(C.warn, intPct)} /></div>
            </div>
            <div style={{ color: C.dim, fontSize: '10px', marginTop: '8px' }}>
              Resets {config?.creditsResetDate || '—'} · snapshot {config?.snapshotAt ? new Date(config.snapshotAt).toLocaleString() : 'never'}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {num('workspacePlan', 'Plan')}
            {num('creditsResetDate', 'Reset date (YYYY-MM-DD)')}
            {num('messageCreditsLeft', 'Message credits left')}
            {num('messageCreditsTotal', 'Message credits total')}
            {num('integrationCreditsUsed', 'Integration credits used')}
            {num('integrationCreditsTotal', 'Integration credits total')}
          </div>
        )}
      </div>

      {/* ── App AI spend ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '8px 10px' }}>
          <div style={lbl}>App AI credits spent</div>
          <div style={{ ...val, fontSize: '18px', color: C.fronter }}>{appCredits.toFixed(1)}</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '8px 10px' }}>
          <div style={lbl}>Tokens processed</div>
          <div style={{ ...val, fontSize: '18px', color: C.coach }}>{tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}</div>
        </div>
      </div>

      {models.length === 0 && <div style={emptyStyle}>No AI usage recorded yet.</div>}
      {models.slice(0, 4).map((m) => (
        <div key={m.model} style={rowStyle}>
          <span style={{ flex: 1, color: C.ink, fontSize: '11px', fontFamily: 'monospace' }}>{m.model || 'automatic'}</span>
          <span style={{ color: C.muted, fontSize: '10px' }}>{m.count} calls</span>
          <span style={chip(C.fronter)}>{(m.sum_estimatedCredits || 0).toFixed(1)} cr</span>
        </div>
      ))}
      {types.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ ...lbl, marginBottom: '6px' }}>Top AI call types</div>
          {types.slice(0, 6).map((t) => (
            <div key={t.callType} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.muted, padding: '3px 0' }}>
              <span>{t.callType}</span>
              <span style={{ color: C.ink }}>{(t.sum_estimatedCredits || 0).toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}