import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import analytics from '@/lib/analytics';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

const EVENT_TYPES = {
  login:    { icon: '🔐', color: '#60a5fa', label: 'Portal Login' },
  offering: { icon: '📄', color: '#f59e0b', label: 'Read Offering' },
  sub_agreement: { icon: '✍️', color: '#4ade80', label: 'Viewed Sub Agreement' },
  questionnaire: { icon: '📋', color: '#a78bfa', label: 'Viewed Questionnaire' },
  rosie:    { icon: '🤖', color: '#f472b6', label: 'Used Rosie AI' },
  download: { icon: '📥', color: '#34d399', label: 'Downloaded Doc' },
};

export default function RecentInvestorEvents({ onOpenUserCard, filter = 'all' }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const [sessions, rosieLogs] = await Promise.all([
        analytics.getAllSessions(),
        base44.entities.RosieChatLog.list('-created_date', 50).catch(() => []),
      ]);

      const evts = [];

      // Deduplicate sessions by sessionId before processing
      const seenSessionIds = new Set();
      const dedupedSessions = sessions.filter(s => {
        const key = s.sessionId || s.id;
        if (!key || seenSessionIds.has(key)) return false;
        seenSessionIds.add(key);
        return true;
      });

      // Portal logins and page views from sessions
      dedupedSessions.forEach(sess => {
        if (!sess.startTime) return;

        // Login event — one per session only
        evts.push({
          type: 'login',
          name: sess.userName || sess.userEmail || sess.username,
          email: sess.userEmail,
          username: sess.username,
          time: sess.startTime,
          detail: null,
          investorId: sess.investorId || null,
        });

        // Page views
        (sess.pages || []).forEach(page => {
          const p = (page.path || '').toLowerCase();
          let type = null;
          if (p.includes('offering') || p.includes('home')) type = 'offering';
          else if (p.includes('subscription') || p.includes('sub')) type = 'sub_agreement';
          else if (p.includes('questionnaire') || p.includes('question')) type = 'questionnaire';
          if (type) {
            evts.push({
              type,
              name: sess.userName || sess.userEmail || sess.username,
              email: sess.userEmail,
              username: sess.username,
              time: page.timestamp || sess.startTime,
              detail: page.path,
              investorId: sess.investorId || null,
            });
          }
        });

        // Downloads
        (sess.downloads || []).forEach(dl => {
          evts.push({
            type: 'download',
            name: sess.userName || sess.userEmail || sess.username,
            email: sess.userEmail,
            username: sess.username,
            time: dl.timestamp || sess.startTime,
            detail: dl.fileName,
            investorId: sess.investorId || null,
          });
        });
      });

      // Rosie AI chats
      rosieLogs.forEach(log => {
        evts.push({
          type: 'rosie',
          name: log.investorName || log.investorEmail || 'Unknown',
          email: log.investorEmail,
          username: null,
          time: log.createdAt || log.created_date,
          detail: log.firstMessage ? log.firstMessage.slice(0, 60) + '…' : null,
          investorId: log.investorId || null,
        });
      });

      // Sort by time desc, take top 50
      evts.sort((a, b) => new Date(b.time) - new Date(a.time));
      setEvents(evts.slice(0, 50));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>⚡ Recent Investor Activity</span>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>{events.length} events</span>
      </div>

      {loading && <div style={{ color: '#6b7280', fontSize: '12px', padding: '16px', textAlign: 'center' }}>Loading…</div>}
      {!loading && events.length === 0 && (
        <div style={{ color: '#4a5568', fontSize: '11px', padding: '20px', textAlign: 'center' }}>No investor activity yet</div>
      )}

      {/* Event rows */}
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {events.filter(evt => filter === 'all' || evt.type === filter).map((evt, i) => {
          const et = EVENT_TYPES[evt.type] || EVENT_TYPES.login;
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 140px 160px',
              gap: '0 12px',
              alignItems: 'center',
              padding: '7px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              transition: 'background 0.1s',
              cursor: evt.investorId ? 'pointer' : 'default',
            }}
              onClick={() => evt.investorId && onOpenUserCard(evt.investorId)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Icon */}
              <span style={{ fontSize: '14px', textAlign: 'center' }}>{et.icon}</span>

              {/* Name + detail */}
              <div style={{ overflow: 'hidden' }}>
                <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', marginRight: '6px' }}>{evt.name}</span>
                <span style={{ color: et.color, fontSize: '11px' }}>{et.label}</span>
                {evt.detail && <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {evt.detail}</span>}
              </div>

              {/* Email */}
              <div style={{ color: '#4a5568', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {evt.email || evt.username || '—'}
              </div>

              {/* Time */}
              <div style={{ color: '#6b7280', fontSize: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {fmt(evt.time)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}