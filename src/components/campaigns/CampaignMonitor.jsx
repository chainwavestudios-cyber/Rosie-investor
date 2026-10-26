/**
 * CampaignMonitor.jsx — step 6: the queue and its results.
 *
 * While the campaign is running this screen drives the queue itself, one batch
 * at a time, and stops the moment the campaign is paused, the daily limit is
 * reached or the sending window closes. Open and click counts come from the
 * tracker the emails themselves call.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, GOLD, MUTED, STATUS_TONE, Stat, BORDER } from './kit';
import CampaignRecipientsTable from './CampaignRecipientsTable';
import { downloadCsv } from '@/lib/csvCampaign';
import { fmt12Range } from '@/lib/time12';

const when = (value) => (value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

export default function CampaignMonitor({ campaignId, onBack, onChanged, embedded = false }) {
  const [campaign, setCampaign] = useState(null);
  const [events, setEvents] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [auto, setAuto] = useState(true);
  const [ticking, setTicking] = useState(false);
  const [last, setLast] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const inFlight = useRef(false);
  const intervalRef = useRef(60);

  const load = useCallback(async () => {
    const row = await base44.entities.EmailCampaignJob.get(campaignId).catch(() => null);
    setCampaign(row);
    intervalRef.current = Math.max(10, Number(row?.intervalSeconds || 60));
    if (row?.templateId) {
      // Every event these emails produced points at the template and the send ID.
      const page = await base44.entities.EmailTrackingEvent
        .filter({ templateId: row.templateId }, { sort: '-trackedAt', limit: 300 })
        .catch(() => null);
      const map = {};
      for (const event of page?.items || []) {
        const key = event.sendId || '';
        if (!key) continue;
        map[key] = map[key] || { opens: 0, clicks: 0, visited: false };
        if (event.eventType === 'open') map[key].opens += 1;
        if (event.eventType === 'click') map[key].clicks += 1;
        if (event.eventType === 'qualify_visit') map[key].visited = true;
      }
      setEvents(map);
    } else {
      setEvents({});
    }
    setRefreshKey((key) => key + 1);
    return row;
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const tick = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setTicking(true);
    try {
      const res = await base44.functions.invoke('emailCampaignSend', { mode: 'send', campaignId })
        .catch((e) => ({ data: { error: e?.response?.data?.error || e?.message || 'The queue could not run.' } }));
      const data = res?.data || res;
      setLast(data);
      setError(data?.error || '');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e?.message || 'The queue could not run.');
    }
    setTicking(false);
    inFlight.current = false;
  }, [campaignId, load, onChanged]);

  // The queue runs itself while this screen is open and the campaign is running.
  useEffect(() => {
    if (!auto || campaign?.status !== 'running') return undefined;
    let cancelled = false;
    let timer = null;
    const loop = async () => {
      if (cancelled) return;
      await tick();
      if (cancelled) return;
      timer = setTimeout(loop, intervalRef.current * 1000);
    };
    loop();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [auto, campaign?.id, campaign?.status, tick]);

  const setStatus = async (status) => {
    await base44.entities.EmailCampaignJob.update(campaignId, { status });
    await load();
    onChanged?.();
  };

  const exportResults = async () => {
    setExporting(true);
    const page = await base44.entities.EmailCampaignRecipient
      .filter({ campaignId }, { sort: 'created_date', limit: 1000 })
      .catch(() => null);
    const rows = (page?.items || []).map((row) => ({
      Email: row.email,
      FirstName: row.firstName,
      LastName: row.lastName,
      Phone: row.phone,
      Status: row.status,
      SentAt: row.sentAt || '',
      Subject: row.subject || '',
      Opens: row.openCount || 0,
      Clicks: (() => { try { return JSON.parse(row.clickedUrlsJson || '[]').length; } catch { return 0; } })(),
      InviteToken: row.inviteToken || '',
      Note: row.error || row.reason || '',
    }));
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    downloadCsv(`campaign-${(campaign?.name || 'results').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, csv);
    setExporting(false);
  };

  if (!campaign) return <div style={{ color: MUTED, fontSize: '12px', padding: '20px 0' }}>Loading results…</div>;

  const eligibility = Number(campaign.eligibleCount || 0) || Number(campaign.importedCount || 0);
  const pct = eligibility ? Math.min(100, Math.round((Number(campaign.sentCount || 0) / eligibility) * 100)) : 0;
  const tone = STATUS_TONE[campaign.status] || MUTED;
  const engagement = Object.values(events);
  const opens = engagement.reduce((acc, row) => acc + (row.opens ? 1 : 0), 0);
  const clicks = engagement.reduce((acc, row) => acc + (row.clicks ? 1 : 0), 0);
  const visits = engagement.filter((row) => row.visited).length;
  const running = campaign.status === 'running';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold' }}>{campaign.name}</div>
          <div style={{ color: MUTED, fontSize: '11px', marginTop: '3px' }}>
            {campaign.templateName ? `📧 ${campaign.templateName} · ` : ''}
            {campaign.approvedAt ? `approved by ${campaign.approvedBy || 'admin'} ${when(campaign.approvedAt)}` : 'not approved yet'}
          </div>
        </div>
        <span style={{ background: `${tone}22`, color: tone, border: `1px solid ${tone}55`, borderRadius: '3px', padding: '3px 9px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{campaign.status}</span>
        {running
          ? <Btn tone="ghost" onClick={() => setStatus('paused')}>⏸ Pause</Btn>
          : <Btn tone={campaign.status === 'paused' ? 'gold' : 'ghost'} onClick={() => setStatus('running')} disabled={campaign.status === 'completed' || campaign.status === 'cancelled'}>▶ Resume</Btn>}
        <Btn tone="ghost" onClick={() => tick()} disabled={ticking || !running}>{ticking ? 'Sending…' : '⚡ Run next batch'}</Btn>
        <Btn tone="ghost" onClick={exportResults} disabled={exporting}>{exporting ? 'Exporting…' : '⬇ Export results'}</Btn>
        {!['completed', 'cancelled'].includes(campaign.status) && <Btn tone="danger" onClick={() => setStatus('cancelled')}>✕ Cancel</Btn>}
        {embedded && <Btn tone="ghost" onClick={onBack}>Done</Btn>}
      </div>

      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${GOLD},#22c55e)` }} />
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Stat label="Sent" value={Number(campaign.sentCount || 0).toLocaleString()} color={GOLD} hint={`${pct}% of ${eligibility.toLocaleString()} eligible`} />
        <Stat label="Failed" value={Number(campaign.failedCount || 0)} color={Number(campaign.failedCount || 0) ? '#ef4444' : MUTED} />
        <Stat label="Opened" value={opens} color="#60a5fa" hint="from the tracker" />
        <Stat label="Clicked a link" value={clicks} color="#60a5fa" />
        <Stat label="Opened the invitation page" value={visits} color={GOLD} />
        <Stat label="Skipped" value={Number(campaign.skippedCount || 0)} color={MUTED} />
      </div>

      <Card
        title="Queue"
        hint={running
          ? `Running an email batch every ${intervalRef.current}s inside ${fmt12Range(campaign.windowStart, campaign.windowEnd)} ${campaign.timezone}, up to ${campaign.dailyLimit} a day.`
          : 'The queue is not running. Resume it to continue sending the remaining recipients.'}
        actions={
          <label style={{ display: 'flex', gap: '7px', alignItems: 'center', color: MUTED, fontSize: '11px', cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Run automatically while this screen is open
          </label>
        }
      >
        {error && <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '10px' }}>{error}</div>}
        {last?.reason && <div style={{ color: '#f59e0b', fontSize: '11px', marginBottom: '10px' }}>{last.reason}</div>}
        {last?.ok && (
          <div style={{ color: GOLD, fontSize: '11px', marginBottom: '10px' }}>
            Last batch: {last.sent} sent{last.failed ? `, ${last.failed} failed` : ''}{last.skipped ? `, ${last.skipped} skipped` : ''}{last.done ? ' — the queue is finished.' : ''}
          </div>
        )}
        {last?.errors?.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '9px 11px', marginBottom: '10px' }}>
            {last.errors.map((line, i) => <div key={i} style={{ color: '#ef4444', fontSize: '11px' }}>{line}</div>)}
          </div>
        )}
        {campaign.lastRunAt && <div style={{ color: DIM, fontSize: '10px', marginBottom: '10px' }}>Last queue run {when(campaign.lastRunAt)}{campaign.completedAt ? ` · finished ${when(campaign.completedAt)}` : ''}</div>}
      </Card>

      <Card title="Recipients" hint="Their own record is what the queue writes to — status, send ID, errors and engagement all live here.">
        <CampaignRecipientsTable campaignId={campaignId} refreshKey={refreshKey} engagement={events} />
        <div style={{ color: DIM, fontSize: '10px', marginTop: '10px', borderTop: `1px solid ${BORDER}`, paddingTop: '8px' }}>
          Opens and clicks are recorded by the tracker inside each email, against the recipient's own contact card, and also appear on that card's email history.
        </div>
      </Card>
    </div>
  );
}