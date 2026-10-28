/**
 * Reporting for Gmail messages sent from Debt Call Coach's saved Email templates.
 * Never reads or displays Fronter outreach.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const colors = { background: '#101829', border: '#273347', ink: '#e9edf5', muted: '#91a0b9', accent: '#10b981' };
const date = (value) => value ? new Date(value).toLocaleString() : '—';
const metric = (label, count, note) => <div key={label} style={{ flex: '1 1 150px', padding: 14, borderRadius: 8, border: '1px solid ' + colors.border, background: colors.background }}>
  <div style={{ color: colors.muted, fontSize: 11 }}>{label}</div>
  <div style={{ color: colors.ink, fontSize: 26, fontWeight: 700 }}>{count ?? 0}</div>
  {note && <div style={{ color: colors.muted, fontSize: 10 }}>{note}</div>}
</div>;
const cell = { padding: '9px 10px', borderBottom: '1px solid ' + colors.border, fontSize: 12, color: colors.ink, verticalAlign: 'top' };
const header = { ...cell, color: colors.muted, fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap' };

export default function DebtGmailEngagement({ view = 'report' }) {
  const { sessionUserId, sessionToken, isAdmin } = useDebtCoachAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const refresh = useCallback(async () => {
    if (!sessionUserId || !sessionToken || !isAdmin) return;
    setLoading(true);
    try {
      const result = await base44.functions.invoke('debtCoachGmailReport', { sessionUserId, sessionToken, days, view });
      if (result.data?.error) throw new Error(result.data.error);
      setData(result.data);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Could not load Gmail engagement');
    } finally {
      setLoading(false);
    }
  }, [sessionUserId, sessionToken, days, view, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!isAdmin) return <div style={{ padding: 20, color: colors.muted }}>Email reporting is restricted to Debt Call Coach administrators.</div>;

  const filter = (r) => [r.contactName, r.contactEmail, r.templateName, r.subject, r.name, r.email].join(' ').toLowerCase().includes(search.toLowerCase());
  const messages = (data?.timeline || []).filter(filter);
  const old = (data?.legacyHistory || []).filter(filter);
  const history = [
    ...messages.map((m) => ({ ...m, openedAt: m.firstOpenAt, clickedAt: m.events?.find((e) => e.type === 'click')?.at || null, legacyOpens: m.opens, legacyClicks: m.clicks, provenance: 'Gmail send record' })),
    ...old.map((m) => ({ ...m, contactName: m.name, contactEmail: m.email, legacyOpens: m.openedAt ? 'Recorded' : '—', legacyClicks: m.clickedAt ? 'Recorded' : '—', provenance: 'Legacy Gmail log' })),
  ].sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));

  return <div style={{ marginTop: 12, color: colors.ink }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      <div>
        <strong style={{ fontSize: 16 }}>{view === 'old' ? 'OLD Follow-Up Report' : 'Gmail Email Engagement'}</strong>
        <div style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>Only Gmail sends using templates saved in Debt Call Coach → Emails. No Fronter or SMTPfast outreach.</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[7, 30, 90, 180].map((d) => <button key={d} onClick={() => setDays(d)} style={{ border: '1px solid ' + colors.border, background: d === days ? '#0c6647' : colors.background, color: colors.ink, borderRadius: 5, padding: '6px 9px', cursor: 'pointer' }}>{d}d</button>)}
        <button onClick={refresh} disabled={loading} style={{ border: '1px solid ' + colors.border, background: colors.background, color: colors.accent, borderRadius: 5, padding: '6px 12px', cursor: 'pointer' }}>{loading ? 'Loading...' : 'Refresh'}</button>
      </div>
    </div>

    {error && <div role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</div>}
    {data?.truncated && Object.values(data.truncated).some(Boolean) && <div style={{ color: '#fcd34d', fontSize: 12, marginBottom: 12 }}>This report has reached a historical query limit. Narrow the date range before treating the counts as complete.</div>}
    <div style={{ color: colors.muted, fontSize: 11, marginBottom: 14 }}>
      Open pixels can be fetched by privacy proxies or automated scanners. Non-proxy opens are still not proof of reading. Only distinct links and qualification actions raise email intent substantially.
    </div>
    {view === 'report' && data && <>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 18 }}>
        {metric('Gmail emails sent', data.summary.emailsSent, 'Unique send records')}
        {metric('Failed Gmail attempts', data.summary.failedAttempts, 'Not counted as sent')}
        {metric('Recipients', data.summary.distinctRecipients)}
        {metric('Non-proxy opens', data.summary.withNonProxyOpens, 'Unique sends, not people')}
        {metric('Clicked', data.summary.withClicks, 'Unique sends')}
        {metric('Proxy-only opens', data.summary.proxyOnlyOpens, 'Not used as buying intent')}
        {metric('High email intent', data.summary.highIntent, 'Distinct contacts; not deal probability')}
      </div>
      <h3 style={{ fontSize: 13, margin: '16px 0 8px' }}>Template effectiveness</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Email template', 'Sent', 'Non-proxy opened', 'Clicked', 'Proxy-only', 'Last sent'].map((x) => <th key={x} style={header}>{x}</th>)}</tr></thead>
          <tbody>{data.templates.map((t) => <tr key={t.templateId}><td style={cell}>{t.name}</td><td style={cell}>{t.sent}</td><td style={cell}>{t.opened}</td><td style={cell}>{t.clicked}</td><td style={cell}>{t.proxyOnly}</td><td style={cell}>{date(t.lastSentAt)}</td></tr>)}</tbody>
        </table>
      </div>
    </>}
    <h3 style={{ fontSize: 13, margin: '18px 0 9px' }}>{view === 'old' ? 'Preserved Gmail send and follow-up history' : 'Who received each email and what happened'}</h3>
    <input aria-label="Search email history" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contact, email or template..." style={{ width: '100%', maxWidth: 360, boxSizing: 'border-box', background: colors.background, color: colors.ink, border: '1px solid ' + colors.border, borderRadius: 6, padding: 9, marginBottom: 10 }} />
    <div style={{ maxHeight: 600, overflow: 'auto' }}>
      <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse' }}>
        <thead><tr>{['Sent', 'Contact', 'Template', 'Status', 'Opens', 'Clicks', 'Email intent', 'Details'].map((x) => <th key={x} style={header}>{x}</th>)}</tr></thead>
        <tbody>{(view === 'old' ? history : messages).map((x) => <tr key={x.id}>
          <td style={cell}>{date(x.sentAt)}</td>
          <td style={cell}><strong>{x.contactName || 'Unknown'}</strong><div style={{ fontSize: 10, color: colors.muted }}>{x.contactEmail}</div></td>
          <td style={cell}>{x.templateName}</td><td style={cell}>{x.status}</td>
          <td style={cell}>{view === 'old' ? x.legacyOpens : x.nonProxyOpens + ' non-proxy / ' + x.proxyOpens + ' proxy'}</td>
          <td style={cell}>{view === 'old' ? x.legacyClicks : x.distinctLinks}</td>
          <td style={cell}>{view === 'old' ? x.provenance : x.intentScore + '/100 · ' + x.tier}</td>
          <td style={cell}><button onClick={() => setSelected(selected?.id === x.id ? null : x)} style={{ cursor: 'pointer', color: colors.accent, background: 'transparent', border: 'none' }}>{selected?.id === x.id ? 'Close' : 'View'}</button></td>
        </tr>)}</tbody>
      </table>
      {data && !(view === 'old' ? history.length : messages.length) && <div style={{ padding: 16, color: colors.muted }}>No matching Gmail template emails in this period.</div>}
    </div>
    {selected && <section style={{ marginTop: 14, padding: 15, background: colors.background, border: '1px solid ' + colors.border, borderRadius: 8 }}>
      <strong>{selected.templateName}</strong>
      <div style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>To: {selected.contactName || selected.name || selected.contactEmail || selected.email}</div>
      <div style={{ color: colors.muted, fontSize: 12 }}>Subject: {selected.subject}</div>
      <div style={{ color: colors.muted, fontSize: 12 }}>Sent: {date(selected.sentAt)} · Send ID: {selected.sendId || 'Legacy / unavailable'}</div>
      {view === 'old' ? <div style={{ marginTop: 10, fontSize: 12 }}>First recorded open: {date(selected.openedAt)} · Recorded click: {date(selected.clickedAt)}</div> : <>
        <div style={{ marginTop: 8, fontSize: 12 }}>Email intent: {selected.intentScore}/100. {selected.reasons.join('; ') || 'No verified intent signals.'}</div>
        {(selected.events || []).map((e) => <div key={e.id} style={{ borderTop: '1px solid ' + colors.border, marginTop: 7, paddingTop: 7, fontSize: 11 }}>{date(e.at)} · {e.type}{e.url ? ' · ' + e.url : ''} · {e.quality === 'proxy_or_automated' ? 'Proxy/automated' : 'Unverified non-proxy'}</div>)}
      </>}
    </section>}
    {data?.generatedAt && <div style={{ color: colors.muted, fontSize: 10, marginTop: 13 }}>Updated {date(data.generatedAt)} · Read-only report</div>}
  </div>;
}
