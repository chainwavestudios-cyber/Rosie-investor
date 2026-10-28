/**
 * Reporting for Gmail messages sent from Debt Call Coach's saved Email templates.
 * Never reads or displays Fronter outreach.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { composeGmailIntelligence } from '@/lib/coachGmailIntelligence';
import { aggregateMilestones, compareEngagementPeople, engagementPriority } from '@/lib/coachGmailMilestones';
import DebtGmailCompactRows, { CompactAudioProgress, CompactSignal, CompactMilestone } from './DebtGmailCompactRows';
import EngagementContactCard from '@/components/engagement/EngagementContactCard';

const colors = { background: '#101829', border: '#273347', ink: '#e9edf5', muted: '#91a0b9', accent: '#10b981' };
const date = (value) => value ? new Date(value).toLocaleString() : '—';
const destinationLabel = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('bbb.org')) return 'Better Business Bureau';
    if (host.endsWith('trustpilot.com')) return 'Trustpilot';
    if (host.endsWith('debtadvisorsofamerica.com')) return 'Debt Advisors of America';
    if ((host.endsWith('debtsolutions.cc') || host.endsWith('base44.app')) && new URL(url).pathname === '/welcome') return 'Personal welcome message';
    return host.replace(/^www\./, '');
  } catch { return 'Tracked link'; }
};
const metric = (label, count, note) => <div key={label} style={{ flex: '1 1 150px', padding: 14, borderRadius: 8, border: '1px solid ' + colors.border, background: colors.background }}>
  <div style={{ color: colors.muted, fontSize: 11 }}>{label}</div>
  <div style={{ color: colors.ink, fontSize: 26, fontWeight: 700 }}>{count ?? 0}</div>
  {note && <div style={{ color: colors.muted, fontSize: 10 }}>{note}</div>}
</div>;
const cell = { padding: '9px 10px', borderBottom: '1px solid ' + colors.border, fontSize: 12, color: colors.ink, verticalAlign: 'top' };
const header = { ...cell, color: colors.muted, fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap' };

export default function DebtGmailEngagement({ view = 'report' }) {
  const { sessionUserId, sessionToken, isAdmin, user } = useDebtCoachAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [card, setCard] = useState(null);

  const refresh = useCallback(async () => {
    if (!sessionUserId || !sessionToken || !isAdmin) return;
    setLoading(true);
    try {
      const result = await base44.functions.invoke('sendDebtEmail', { action: 'gmailReport', sessionUserId, sessionToken, days, view });
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
  const people = composeGmailIntelligence(data).leads.filter((p) => [p.name,p.email,p.lastTemplate].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b) => compareEngagementPeople(a,b));
  const personById = new Map(people.map(p => [String(p.leadId||p.id),p]));
  const messages = (data?.timeline || []).filter(filter).map((send) => ({
    ...send, ...aggregateMilestones([send]), score:send.intentScore || 0,
    hotLead:send.tier === 'high',
  })).sort((a,b) => {
    const leadA = personById.get(String(a.contactId||''));
    const leadB = personById.get(String(b.contactId||''));
    return engagementPriority(leadB||b)-engagementPriority(leadA||a)
      || Number(leadB?.score||b.score)-Number(leadA?.score||a.score)
      || new Date(b.sentAt||0)-new Date(a.sentAt||0);
  });
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
      Open pixels may be fetched automatically. Gmail links passing through Base44 are counted as tracked redirects (not confirmed human browsing); known bot signatures are excluded. Recorded playback and calendar actions are measured separately.
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
        {metric('Audio started', data.summary.audioStarted, 'Unique sends with player starts')}
        {metric('Audio completed', data.summary.audioCompleted, 'At least one completed playback')}
        {metric('Calendar opened', data.summary.calendarOpened, 'Not confirmed appointments')}
        {metric('Company site clicked', data.summary.companyWebsiteClicked, 'Links opened from welcome page')}
        {metric('Gold listeners', people.filter(p=>p.goldListener).length, 'Full estimated audio playback')}
        {metric('All links + audio', people.filter(p=>p.allLinksAndAudio).length, 'Audio plus three external links')}
        {metric('Elite journey', people.filter(p=>p.eliteJourney).length, 'All links, audio and calendar')}
      </div>
      <h3 style={{ fontSize: 13, margin: '16px 0 8px' }}>Template effectiveness</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Email template', 'Sent', 'Non-proxy opened', 'Clicked', 'Proxy-only', 'Last sent'].map((x) => <th key={x} style={header}>{x}</th>)}</tr></thead>
          <tbody>{data.templates.map((t) => <tr key={t.templateId}><td style={cell}>{t.name}</td><td style={cell}>{t.sent}</td><td style={cell}>{t.opened}</td><td style={cell}>{t.clicked}</td><td style={cell}>{t.proxyOnly}</td><td style={cell}>{date(t.lastSentAt)}</td></tr>)}</tbody>
        </table>
      </div>
    </>}
    <h3 style={{ fontSize: 14, margin: '18px 0 9px' }}>{view === 'old' ? 'Preserved Gmail send and follow-up history' : 'Full Gmail engagement lists · highest-priority first'}</h3>
    <input aria-label="Search email history" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contact, email or template..." style={{ width: '100%', maxWidth: 360, boxSizing: 'border-box', background: colors.background, color: colors.ink, border: '1px solid ' + colors.border, borderRadius: 6, padding: 9, marginBottom: 10 }} />
    {view === 'report' && data && <>
      <p style={{fontSize:11,color:colors.muted,margin:'8px 0 10px'}}>All emailed people, ranked by milestone and hot-lead engagement. Each row has their audio bar, all four checkmarks, badge and score.</p>
      <DebtGmailCompactRows title="Full Gmail recipient engagement list" people={people} onOpen={p=>setCard({leadId:p.leadId,source:'coach',name:p.name})}/>
      <h3 style={{fontSize:13,margin:'22px 0 9px',color:'#d7ba82'}}>Individual Gmail sends · detailed records</h3>
    </>}
    <div style={{ maxHeight: 600, overflow: 'auto' }}>
      <table style={{ width: '100%', minWidth: view==='old'?850:1450, borderCollapse: 'collapse' }}>
        <thead><tr>{(view==='old' ? ['Sent','Contact','Template','Status','Opens','Clicks','Audio','Calendar','Website','Email intent','Details'] : ['Sent','Contact','Template','Status','Opens','Clicks','Audio progress','BBB','Trustpilot','Company site','Calendar','Milestone','Email intent','Details']).map((x) => <th key={x} style={header}>{x}</th>)}</tr></thead>
        <tbody>{(view === 'old' ? history : messages).map((x) => <tr key={x.id}>
          <td style={cell}>{date(x.sentAt)}</td>
          <td style={cell}><strong>{x.contactName || 'Unknown'}</strong><div style={{ fontSize: 10, color: colors.muted }}>{x.contactEmail}</div></td>
          <td style={cell}>{x.templateName}</td><td style={cell}>{x.status}</td>
          <td style={cell}>{view === 'old' ? x.legacyOpens : x.nonProxyOpens + ' non-proxy / ' + x.proxyOpens + ' proxy'}</td>
          <td style={cell}>{view === 'old' ? x.legacyClicks : x.distinctLinks}</td>
          <td style={cell}>{view === 'old' ? '—' : <CompactAudioProgress name={x.contactName||x.contactEmail||'Contact'} percent={x.percent} gold={x.goldListener} estimated={x.estimated}/>}</td>
          {view === 'old' ? <><td style={cell}>—</td><td style={cell}>—</td></> : <>
            <td style={cell}><CompactSignal checked={x.flags?.bbb} label="BBB" description="Tracked BBB redirect"/></td>
            <td style={cell}><CompactSignal checked={x.flags?.trustpilot} label="Review" description="Tracked Trustpilot redirect"/></td>
            <td style={cell}><CompactSignal checked={x.flags?.company} label="Site" description="Tracked company website redirect"/></td>
            <td style={cell}><CompactSignal checked={x.flags?.calendar} label="Open" description="Calendar opened, not booked"/></td>
            <td style={cell}><CompactMilestone person={x}/></td>
          </>}
          <td style={cell}>{view === 'old' ? x.provenance : <strong style={{color:x.intentScore>=60?'#e9bf77':'#75ddb9'}}>{x.intentScore}/100 · {x.tier}</strong>}</td>
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
        <div style={{ marginTop: 9, fontSize: 12 }}>Personal audio: {selected.audioPlays || 0} play(s), {selected.audioBestPercent || 0}% estimated played {selected.audioCompleted ? selected.audioCompletionEstimated ? '· Full playback estimated' : '· Completion event recorded' : ''} · Calendar: {selected.calendarOpened ? 'Opened' : 'Not opened'} {selected.calendarExternalClicks ? '· External click(s): ' + selected.calendarExternalClicks : ''} · Company site from welcome page: {selected.websiteClicked ? 'Clicked' : 'Not recorded'}</div>
        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700 }}>Recorded email link destinations ({selected.clickedDestinations?.length || 0})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {(selected.clickedDestinations || []).map((url) => <span key={url} style={{ padding: '6px 9px', fontSize: 11, border: '1px solid #326e62', borderRadius: 6, color: '#9fe6cd', background: '#102c2b' }}>{destinationLabel(url)}</span>)}
          {!selected.clickedDestinations?.length && <span style={{ color: colors.muted, fontSize: 11 }}>No tracked redirects</span>}
        </div>
        <div style={{ color: colors.muted, fontSize: 11, marginTop: 7 }}>A redirect records that a tracked link was followed; it does not prove the destination finished loading or that a person read it.</div>
        {(selected.events || []).map((e) => <div key={e.id} style={{ borderTop: '1px solid ' + colors.border, marginTop: 7, paddingTop: 7, fontSize: 11 }}>{date(e.at)} · {e.type}{e.url ? ' · ' + e.url : ''} · {e.quality === 'proxy_or_automated' ? 'Proxy/automated' : e.quality === 'unverified_relay_click' ? 'Base44 relay click · unverified visitor' : 'Unverified non-proxy'}</div>)}
      </>}
    </section>}
    {data?.generatedAt && <div style={{ color: colors.muted, fontSize: 10, marginTop: 13 }}>Updated {date(data.generatedAt)} · Read-only report</div>}
    <EngagementContactCard target={card} username={user?.username} onClose={()=>setCard(null)}/>
  </div>;
}
