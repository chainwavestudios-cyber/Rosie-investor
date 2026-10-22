/**
 * RateDropMailersTab.jsx — Rate Drop mailer campaigns.
 *
 * Pick a Mailjet template ID, a fronter, up to 50 of that fronter's prospect
 * contact cards, and how the sends should be spread (all at once, in bursts, or
 * a daily quota inside an 8am–8pm window). Each prospect's stored digital
 * mailer is injected into the Mailjet template — never attached — by the
 * 5-minute engine tick.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { computeSendTimes, toLocalIso } from '@/lib/rateDropSchedule';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const MAX_LEADS = 50;

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '4px', padding: '7px 9px', color: '#e8e0d0', fontSize: '12px', fontFamily: 'Georgia, serif',
};
const labelStyle = { color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' };
const btn = (bg, color) => ({ background: bg, color, border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' });

const MODES = [
  { id: 'all_at_once', label: 'All at once' },
  { id: 'stagger', label: 'Staggered bursts' },
  { id: 'repetitive', label: 'Repetitive daily' },
];

export default function RateDropMailersTab({ username }) {
  const [fronters, setFronters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [openCampaign, setOpenCampaign] = useState(null);
  const [sends, setSends] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    subject: 'Debt Solutions Rate Drop Engine: Official Notice of Eligibility',
    fronterUsername: '',
    leadIds: [],
    scheduleMode: 'all_at_once',
    startAt: toLocalIso(new Date(Date.now() + 5 * 60000)),
    batchSize: 2,
    intervalMinutes: 5,
    dailyLimit: 50,
    windowStart: '08:00',
    windowEnd: '20:00',
  });

  const load = useCallback(async () => {
    try {
      const [users, camps] = await Promise.all([
        base44.entities.DebtCoachUser.list('-created_date', 500).catch(() => []),
        base44.entities.RateDropCampaign.list('-created_date', 50).catch(() => []),
      ]);
      setFronters((users || []).filter(u => (u.role === 'fronter' || u.role === 'super_admin') && u.isActive));
      setCampaigns(camps?.items || camps || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!form.fronterUsername) { setProspects([]); return; }
    base44.entities.FronterLead
      .filter({ assignedTo: form.fronterUsername, status: 'prospect' }, { sort: '-created_date', limit: 200 })
      .then(page => setProspects((page?.items || page || []).filter(l => (l.email || '').trim())))
      .catch(() => setProspects([]));
  }, [form.fronterUsername]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleLead = (id) => setForm(prev => {
    const has = prev.leadIds.includes(id);
    if (!has && prev.leadIds.length >= MAX_LEADS) return prev;
    return { ...prev, leadIds: has ? prev.leadIds.filter(x => x !== id) : [...prev.leadIds, id] };
  });

  const preview_schedule = computeSendTimes({
    mode: form.scheduleMode,
    startAt: form.startAt,
    count: form.leadIds.length || 1,
    batchSize: form.batchSize,
    intervalMinutes: form.intervalMinutes,
    dailyLimit: form.dailyLimit,
    windowStart: form.windowStart,
    windowEnd: form.windowEnd,
  });

  const create = async () => {
    if (!form.name.trim()) { setMsg('Give the campaign a name.'); return; }
    if (!form.subject.trim()) { setMsg('Enter the subject line this notice goes out under.'); return; }
    if (!form.leadIds.length) { setMsg('Select at least one prospect.'); return; }
    setBusy('create'); setMsg('');
    try {
      const ids = form.leadIds.slice(0, MAX_LEADS);
      // Make sure every selected card has its mailer on file before scheduling.
      await base44.functions.invoke('rateDropGenerateMailer', { action: 'generate', leadIds: ids });

      const times = computeSendTimes({
        mode: form.scheduleMode,
        startAt: form.startAt,
        count: ids.length,
        batchSize: form.batchSize,
        intervalMinutes: form.intervalMinutes,
        dailyLimit: form.dailyLimit,
        windowStart: form.windowStart,
        windowEnd: form.windowEnd,
      });

      const campaign = await base44.entities.RateDropCampaign.create({
        name: form.name.trim(),
        subject: form.subject.trim(),
        fronterUsername: form.fronterUsername,
        leadIdsJson: JSON.stringify(ids),
        scheduleMode: form.scheduleMode,
        startAt: new Date(form.startAt).toISOString(),
        batchSize: Number(form.batchSize) || 1,
        intervalMinutes: Math.max(5, Number(form.intervalMinutes) || 5),
        dailyLimit: Number(form.dailyLimit) || 50,
        windowStart: form.windowStart,
        windowEnd: form.windowEnd,
        timezone: 'America/New_York',
        status: 'running',
        totalSends: ids.length,
        createdBy: username || 'admin',
      });

      const rows = ids.map((leadId, i) => {
        const lead = prospects.find(p => p.id === leadId) || {};
        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          leadId,
          leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
          email: lead.email || '',
          noticeId: lead.noticeId || '',
          sendAt: (times[i] || new Date()).toISOString(),
          status: 'pending',
        };
      });
      await base44.entities.RateDropSend.bulkCreate(rows);

      setMsg(`Campaign created — ${rows.length} mailers scheduled${times[0] ? `, first at ${times[0].toLocaleString()}` : ''}. The engine sends them on its 5-minute tick.`);
      setForm(prev => ({ ...prev, name: '', leadIds: [] }));
      await load();
    } catch (e) {
      setMsg('Could not create the campaign: ' + (e?.message || 'unknown error'));
    }
    setBusy('');
  };

  const setStatus = async (campaign, status) => {
    setBusy(campaign.id);
    try {
      await base44.entities.RateDropCampaign.update(campaign.id, { status });
      if (status === 'cancelled') {
        await base44.entities.RateDropSend.updateMany(
          { campaignId: campaign.id, status: 'pending' },
          { $set: { status: 'skipped', error: 'Campaign cancelled' } }
        );
      }
      await load();
    } catch (e) {
      setMsg('Could not update the campaign: ' + (e?.message || 'unknown error'));
    }
    setBusy('');
  };

  const openSends = async (campaign) => {
    if (openCampaign === campaign.id) { setOpenCampaign(null); return; }
    setOpenCampaign(campaign.id);
    const page = await base44.entities.RateDropSend.filter({ campaignId: campaign.id }, { sort: 'sendAt', limit: 100 }).catch(() => []);
    setSends(page?.items || page || []);
  };

  const allSelected = prospects.length > 0 && form.leadIds.length >= Math.min(MAX_LEADS, prospects.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {msg && <div style={{ color: '#8a9ab8', fontSize: '11px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '8px 10px' }}>{msg}</div>}

      {/* ── New campaign ── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>New Rate Drop Campaign</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '10px' }}>
          <div>
            <div style={labelStyle}>Campaign Name</div>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="October Rate Drop — Riverside" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Email Subject</div>
            <input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Debt Solutions Rate Drop Engine: Official Notice of Eligibility" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Fronter</div>
            <select value={form.fronterUsername} onChange={e => { set('fronterUsername', e.target.value); set('leadIds', []); }} style={inputStyle}>
              <option value="">— select a fronter —</option>
              {fronters.map(f => <option key={f.username} value={f.username}>{f.firstName} {f.lastName} ({f.username})</option>)}
            </select>
          </div>
        </div>

        <div style={{ color: '#6b7280', fontSize: '10px' }}>
          The notice itself is built by the Rate Drop Engine and sent as the email body, so nothing has to be assembled in a template anywhere. This subject line is what lands in the prospect's inbox, and the notice goes out from your outreach sending domain — never from the connected Google account.
        </div>

        {/* Prospects */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={labelStyle}>Prospect Contact Cards — {form.leadIds.length}/{MAX_LEADS} selected</div>
            <button
              onClick={() => set('leadIds', allSelected ? [] : prospects.slice(0, MAX_LEADS).map(p => p.id))}
              disabled={!prospects.length}
              style={{ background: 'transparent', color: PURPLE, border: 'none', cursor: 'pointer', fontSize: '10px' }}
            >
              {allSelected ? 'clear all' : `select first ${Math.min(MAX_LEADS, prospects.length)}`}
            </button>
          </div>
          <div style={{ maxHeight: '190px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '6px' }}>
            {!form.fronterUsername && <div style={{ color: '#4b5563', fontSize: '11px', padding: '6px' }}>Select a fronter to list their prospects.</div>}
            {form.fronterUsername && !prospects.length && <div style={{ color: '#4b5563', fontSize: '11px', padding: '6px' }}>No prospects with an email assigned to this fronter yet.</div>}
            {prospects.map(l => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '11px', color: '#e8e0d0', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.leadIds.includes(l.id)} onChange={() => toggleLead(l.id)} />
                <span>{l.leadNumber || '—'} · {l.firstName} {l.lastName}</span>
                <span style={{ color: '#6b7280' }}>{l.noticeId || ''}</span>
                <span style={{ color: BLUE, marginLeft: 'auto' }}>{l.email}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '10px' }}>
          <div>
            <div style={labelStyle}>Send Mode</div>
            <select value={form.scheduleMode} onChange={e => set('scheduleMode', e.target.value)} style={inputStyle}>
              {MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Start (Eastern)</div>
            <input type="datetime-local" value={form.startAt} onChange={e => set('startAt', e.target.value)} style={inputStyle} />
          </div>
          {form.scheduleMode === 'stagger' && (
            <>
              <div>
                <div style={labelStyle}>Emails per Burst</div>
                <input type="number" min="1" value={form.batchSize} onChange={e => set('batchSize', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Minutes Between Bursts</div>
                <input type="number" min="5" value={form.intervalMinutes} onChange={e => set('intervalMinutes', e.target.value)} style={inputStyle} />
              </div>
            </>
          )}
          {form.scheduleMode === 'repetitive' && (
            <>
              <div>
                <div style={labelStyle}>Emails Per Day</div>
                <input type="number" min="1" value={form.dailyLimit} onChange={e => set('dailyLimit', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Minutes Between Sends</div>
                <input type="number" min="5" value={form.intervalMinutes} onChange={e => set('intervalMinutes', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Daily Window Start</div>
                <input type="time" value={form.windowStart} onChange={e => set('windowStart', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Daily Window End</div>
                <input type="time" value={form.windowEnd} onChange={e => set('windowEnd', e.target.value)} style={inputStyle} />
              </div>
            </>
          )}
        </div>

        <div style={{ color: '#6b7280', fontSize: '10px' }}>
          {form.scheduleMode === 'all_at_once' && `All ${form.leadIds.length} selected mailers go out on the next engine tick after the start time.`}
          {form.scheduleMode === 'stagger' && `${form.batchSize} every ${Math.max(5, Number(form.intervalMinutes) || 5)} minutes — first batch ${preview_schedule[0]?.toLocaleString() || '—'}.`}
          {form.scheduleMode === 'repetitive' && `${form.dailyLimit}/day, one every ${Math.max(5, Number(form.intervalMinutes) || 5)} min, ${form.windowStart}–${form.windowEnd} ET — first ${preview_schedule[0]?.toLocaleString() || '—'}, day two starts ${preview_schedule[Number(form.dailyLimit)]?.toLocaleString() || 'n/a'}.`}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={create} disabled={!!busy} style={btn(`linear-gradient(135deg,${GOLD},#22c55e)`, DARK)}>
            {busy === 'create' ? 'Scheduling…' : '＋ Create Campaign'}
          </button>
        </div>
      </div>

      {/* ── Campaigns ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>Campaigns</div>
        {!campaigns.length && <div style={{ color: '#4b5563', fontSize: '11px' }}>No campaigns yet.</div>}
        {campaigns.map(c => {
          const total = c.totalSends || 0;
          const done = (c.sentCount || 0) + (c.failedCount || 0) + (c.skippedCount || 0);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const statusColor = c.status === 'running' ? GOLD : c.status === 'paused' ? '#f59e0b' : c.status === 'completed' ? BLUE : '#6b7280';
          return (
            <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{c.name}</div>
                  <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>
                    {c.fronterUsername || '—'} · {c.scheduleMode?.replace('_', ' ')} · {total} mailers · <span style={{ color: statusColor, textTransform: 'uppercase' }}>{c.status}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ color: '#8a9ab8', fontSize: '10px' }}>{c.sentCount || 0} sent{c.failedCount ? ` · ${c.failedCount} failed` : ''}{c.skippedCount ? ` · ${c.skippedCount} skipped` : ''}</span>
                  {c.status === 'running' && <button onClick={() => setStatus(c, 'paused')} disabled={busy === c.id} style={btn('rgba(245,158,11,0.15)', '#f59e0b')}>⏸ Pause</button>}
                  {c.status === 'paused' && <button onClick={() => setStatus(c, 'running')} disabled={busy === c.id} style={btn(`${GOLD}22`, GOLD)}>▶ Resume</button>}
                  {(c.status === 'running' || c.status === 'paused') && <button onClick={() => setStatus(c, 'cancelled')} disabled={busy === c.id} style={btn('rgba(239,68,68,0.15)', '#f87171')}>✕ Cancel</button>}
                  <button onClick={() => openSends(c)} style={btn('rgba(255,255,255,0.06)', '#8a9ab8')}>{openCampaign === c.id ? 'Hide schedule' : 'View schedule'}</button>
                </div>
              </div>
              <div style={{ marginTop: '8px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${GOLD},${BLUE})` }} />
              </div>

              {openCampaign === c.id && (
                <div style={{ marginTop: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '10px', color: '#e8e0d0', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                        <th style={{ padding: '4px 6px' }}>Send At</th><th style={{ padding: '4px 6px' }}>Prospect</th>
                        <th style={{ padding: '4px 6px' }}>Notice ID</th><th style={{ padding: '4px 6px' }}>Email</th>
                        <th style={{ padding: '4px 6px' }}>Status</th><th style={{ padding: '4px 6px' }}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sends.map(s => (
                        <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{s.sendAt ? new Date(s.sendAt).toLocaleString() : '—'}</td>
                          <td style={{ padding: '4px 6px' }}>{s.leadName || '—'}</td>
                          <td style={{ padding: '4px 6px' }}>{s.noticeId || '—'}</td>
                          <td style={{ padding: '4px 6px', color: BLUE }}>{s.email || '—'}</td>
                          <td style={{ padding: '4px 6px', color: s.status === 'sent' ? GOLD : s.status === 'failed' ? '#f87171' : s.status === 'skipped' ? '#f59e0b' : '#8a9ab8' }}>{s.status}</td>
                          <td style={{ padding: '4px 6px', color: '#6b7280', maxWidth: '220px' }}>{s.error || (s.sentAt ? new Date(s.sentAt).toLocaleTimeString() : '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}