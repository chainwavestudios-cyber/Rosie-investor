import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const CYAN = '#22d3ee';

const fmtAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const hrs = diff / 3600000;
  if (hrs < 0) return `${fmtAgo(iso)}`;
  if (hrs < 24) return `in ${Math.round(hrs)}h`;
  return `in ${Math.round(hrs / 24)}d`;
};

export default function AlertCenter({ onOpenLead }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 3600000);
      const in24hAgo = new Date(now.getTime() - 24 * 3600000);

      const [
        appts, opens, audioPlays, bbbClicks, trustClicks, resched,
        hotCalls, headsUp,
      ] = await Promise.all([
        base44.entities.DebtLead.filter({ appointmentDate: { $gte: now.toISOString(), $lte: in48h.toISOString() }, appointmentConfirmed: { $ne: true }, deletedAt: { $exists: false } }, { sort: 'appointmentDate', limit: 30, fields: ['firstName', 'lastName', 'appointmentDate', 'appointmentEventId', 'phone', 'email'] }),
        base44.entities.DebtLead.filter({ apptEmailOpenedAt: { $gte: in24hAgo.toISOString() }, deletedAt: { $exists: false } }, { sort: '-apptEmailOpenedAt', limit: 20, fields: ['firstName', 'lastName', 'apptEmailOpenedAt', 'appointmentDate'] }),
        base44.entities.DebtLead.filter({ personalMessageAudioPlayedAt: { $gte: in24hAgo.toISOString() }, deletedAt: { $exists: false } }, { sort: '-personalMessageAudioPlayedAt', limit: 20, fields: ['firstName', 'lastName', 'personalMessageAudioPlayedAt'] }),
        base44.entities.DebtLead.filter({ apptBbbClickedAt: { $gte: in24hAgo.toISOString() }, deletedAt: { $exists: false } }, { sort: '-apptBbbClickedAt', limit: 20, fields: ['firstName', 'lastName', 'apptBbbClickedAt'] }),
        base44.entities.DebtLead.filter({ apptTrustpilotClickedAt: { $gte: in24hAgo.toISOString() }, deletedAt: { $exists: false } }, { sort: '-apptTrustpilotClickedAt', limit: 20, fields: ['firstName', 'lastName', 'apptTrustpilotClickedAt'] }),
        base44.entities.DebtLead.filter({ appointmentChangeRequested: true, deletedAt: { $exists: false } }, { sort: '-appointmentChangeRequestedAt', limit: 20, fields: ['firstName', 'lastName', 'appointmentChangeRequestedAt', 'appointmentDate'] }),
        base44.entities.HotCallAlert.filter({ status: 'active' }, { sort: '-created_date', limit: 20 }),
        base44.entities.FronterHeadsUp.filter({ status: 'active' }, { sort: '-created_date', limit: 20 }),
      ]);

      const mk = (type, color, icon, title, sub, leadId, leadName, ts, extra) => ({ type, color, icon, title, sub, leadId, leadName, ts, extra });

      const list = [];
      (appts.items || appts).forEach(l => list.push(mk('appointment', BLUE, '📅', `Appointment: ${l.firstName} ${l.lastName}`, `${fmtWhen(l.appointmentDate)} · ${new Date(l.appointmentDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — needs confirming`, l.id, `${l.firstName} ${l.lastName}`, l.appointmentDate, { phone: l.phone, email: l.email })));
      (resched.items || resched).forEach(l => list.push(mk('reschedule', AMBER, '🔄', `Reschedule requested: ${l.firstName} ${l.lastName}`, `Appt was ${new Date(l.appointmentDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, l.id, `${l.firstName} ${l.lastName}`, l.appointmentChangeRequestedAt)));
      (audioPlays.items || audioPlays).forEach(l => list.push(mk('audio', PURPLE, '🎧', `Audio message watched: ${l.firstName} ${l.lastName}`, `Personal message playback completed ${fmtAgo(l.personalMessageAudioPlayedAt)}`, l.id, `${l.firstName} ${l.lastName}`, l.personalMessageAudioPlayedAt)));
      (opens.items || opens).forEach(l => list.push(mk('email_open', CYAN, '✉️', `Email opened: ${l.firstName} ${l.lastName}`, `Reminder email opened ${fmtAgo(l.apptEmailOpenedAt)}`, l.id, `${l.firstName} ${l.lastName}`, l.apptEmailOpenedAt)));
      (bbbClicks.items || bbbClicks).forEach(l => list.push(mk('bbb', GOLD, '⭐', `BBB link clicked: ${l.firstName} ${l.lastName}`, `Clicked ${fmtAgo(l.apptBbbClickedAt)}`, l.id, `${l.firstName} ${l.lastName}`, l.apptBbbClickedAt)));
      (trustClicks.items || trustClicks).forEach(l => list.push(mk('trustpilot', GOLD, '⭐', `Trustpilot clicked: ${l.firstName} ${l.lastName}`, `Clicked ${fmtAgo(l.apptTrustpilotClickedAt)}`, l.id, `${l.firstName} ${l.lastName}`, l.apptTrustpilotClickedAt)));
      (hotCalls.items || hotCalls).forEach(a => list.push(mk('hotcall', RED, '🔥', `Hot call alert: ${a.leadName || a.fronterUsername || 'Unknown'}`, `${a.reason || a.alertType || 'High-intent call in progress'}`, a.leadId, a.leadName, a.created_date, { fronter: a.fronterUsername, conference: a.conferenceName })));
      (headsUp.items || headsUp).forEach(h => list.push(mk('headsup', AMBER, '🔔', `Fronter heads-up: ${h.leadName}`, `From ${h.fronterUsername} · ${h.leadPhone || ''}`, h.leadId, h.leadName, h.createdAt, { fronter: h.fronterUsername, conference: h.conferenceName })));

      list.sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime());
      setAlerts(list);
    } catch (e) {
      console.error('AlertCenter load failed', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, [load]);

  const types = [
    { id: 'all', label: 'All' },
    { id: 'appointment', label: '📅 Appointments' },
    { id: 'reschedule', label: '🔄 Reschedule' },
    { id: 'audio', label: '🎧 Audio Watched' },
    { id: 'email_open', label: '✉️ Email Opens' },
    { id: 'bbb', label: '⭐ Reviews' },
    { id: 'hotcall', label: '🔥 Hot Calls' },
    { id: 'headsup', label: '🔔 Heads-Up' },
  ];
  const shown = filter === 'all' ? alerts : alerts.filter(a => a.type === filter || (filter === 'bbb' && (a.type === 'bbb' || a.type === 'trustpilot')));

  const counts = {};
  alerts.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>🔔 Alert Center</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>Real-time signals: appointments, email opens, audio plays, review clicks, hot calls & fronter heads-up. Auto-refreshes every 60s.</div>
        </div>
        <button onClick={load} style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {types.map(t => {
          const c = t.id === 'all' ? alerts.length : t.id === 'bbb' ? (counts.bbb || 0) + (counts.trustpilot || 0) : (counts[t.id] || 0);
          const active = filter === t.id;
          return (
            <button key={t.id} onClick={() => setFilter(t.id)} style={{ background: active ? `${GOLD}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? GOLD + '55' : 'rgba(255,255,255,0.1)'}`, color: active ? GOLD : '#8a9ab8', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: active ? 'bold' : 'normal' }}>
              {t.label} {c > 0 && <span style={{ marginLeft: '4px', background: active ? GOLD : 'rgba(255,255,255,0.1)', color: active ? DARK : '#e8e0d0', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>{c}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading alerts…</div>
      ) : shown.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>🎉 No alerts in this category right now.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shown.map((a, i) => (
            <div key={i} onClick={() => onOpenLead?.(a)} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${a.color}33`, borderLeft: `3px solid ${a.color}`, borderRadius: '4px', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
              <div style={{ fontSize: '20px' }}>{a.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{a.title}</div>
                <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '2px' }}>{a.sub}</div>
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px', whiteSpace: 'nowrap' }}>{a.ts ? fmtAgo(a.ts) : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}