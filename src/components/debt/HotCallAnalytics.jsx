/**
 * HotCallAnalytics.jsx — Dialer-facing analytics. Shows hot-call counts
 * (today / this week) alongside basic call stats: calls today, talk time,
 * connections, average call length, conversions to transfer, total calls
 * for the week. Hot-call counts come from HotCallAlert; call stats from
 * DebtCallTranscript.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }
function fmtDuration(sec) {
  const m = Math.floor(sec / 60); const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60); return `${h}h ${m % 60}m`;
}

export default function HotCallAnalytics() {
  const { user } = useDebtCoachAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user?.username) { setLoading(false); return; }
      try {
        const [calls, alerts, settingsRows] = await Promise.all([
          base44.entities.DebtCallTranscript.filter({ agentId: user.username }, '-callDate', 500),
          base44.entities.HotCallAlert.filter({ dialerUsername: user.username }, '-created_date', 500),
          base44.entities.HotCallSettings.list('-created_date', 10),
        ]);
        const now = new Date();
        const dayStart = startOfDay(now).getTime();
        const weekStart = startOfWeek(now).getTime();
        const inDay = (iso) => iso && new Date(iso).getTime() >= dayStart;
        const inWeek = (iso) => iso && new Date(iso).getTime() >= weekStart;

        const callsToday = (calls || []).filter(c => inDay(c.callDate || c.created_date));
        const callsWeek = (calls || []).filter(c => inWeek(c.callDate || c.created_date));
        const talkToday = callsToday.reduce((s, c) => s + (c.durationSeconds || 0), 0);
        const connectionsToday = callsToday.filter(c => (c.durationSeconds || 0) > 30).length;
        const avgLen = callsWeek.length ? Math.round(callsWeek.reduce((s, c) => s + (c.durationSeconds || 0), 0) / callsWeek.length) : 0;
        const conversionsWeek = callsWeek.filter(c => c.callMode === 'close').length;

        const hotAlerts = (alerts || []).filter(a => a.status === 'hot' || a.status === 'critical' || a.criticalAlert);
        const hotToday = hotAlerts.filter(a => inDay(a.created_date)).length;
        const hotWeek = hotAlerts.filter(a => inWeek(a.created_date)).length;

        const s = (settingsRows || [])[0];
        const trackerOn = !!(s && s.enabled);

        setStats({
          trackerOn,
          callsToday: callsToday.length,
          callsWeek: callsWeek.length,
          talkToday,
          connectionsToday,
          avgLen,
          conversionsWeek,
          hotToday,
          hotWeek,
        });
      } catch {}
      setLoading(false);
    })();
  }, [user?.username]);

  if (loading) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Loading your stats…</div>;
  if (!stats) return <div style={{ color: '#6b7280', fontSize: '13px' }}>No call data yet.</div>;

  return (
    <div>
      {!stats.trackerOn && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', color: '#f59e0b', fontSize: '12px' }}>
          ℹ️ Hot Call AI is currently off. Hot-call counts will stay at 0 until a manager enables it. Your call stats below are always available.
        </div>
      )}

      {/* Hot call highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard value={stats.hotToday} label="🔥 Hot Calls Today" color={RED} highlight />
        <StatCard value={stats.hotWeek} label="🔥 Hot Calls This Week" color={AMBER} highlight />
      </div>

      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📊 Call Activity</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <StatCard value={stats.callsToday} label="Calls Today" color={BLUE} />
        <StatCard value={fmtDuration(stats.talkToday)} label="Talk Time Today" color={PURPLE} />
        <StatCard value={stats.connectionsToday} label="Connections Today" color={GOLD} />
        <StatCard value={fmtDuration(stats.avgLen)} label="Avg Call Length (week)" color="#34d399" />
        <StatCard value={stats.conversionsWeek} label="Conversions to Transfer (week)" color="#f472b6" />
        <StatCard value={stats.callsWeek} label="Total Calls (week)" color="#8a9ab8" />
      </div>
    </div>
  );
}

function StatCard({ value, label, color, highlight }) {
  return (
    <div style={{
      background: '#0d1b2a',
      border: `1px solid ${color}${highlight ? '55' : '22'}`,
      borderRadius: '6px',
      padding: '16px 18px',
      boxShadow: highlight ? `0 0 16px ${color}22` : 'none',
    }}>
      <div style={{ color, fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}