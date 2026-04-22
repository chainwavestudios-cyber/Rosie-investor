import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

export default function RosieTab({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    loadLogs();
  }, [user.id]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.RosieChatLog.filter({ investorId: user.id });
      const sorted = all.sort((a, b) => new Date(a.timestamp || a.created_date) - new Date(b.timestamp || b.created_date));

      // Group by sessionId
      const sessionMap = {};
      sorted.forEach(msg => {
        const sid = msg.sessionId || 'default';
        if (!sessionMap[sid]) sessionMap[sid] = [];
        sessionMap[sid].push(msg);
      });

      const sessionList = Object.entries(sessionMap).map(([sid, msgs]) => ({
        sessionId: sid,
        messages: msgs,
        startTime: msgs[0]?.timestamp || msgs[0]?.created_date,
      })).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      setSessions(sessionList);
      setLogs(sorted);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading…</p>;

  if (logs.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤖</div>
      <div style={{ color: '#4a5568', fontSize: '14px' }}>This investor hasn't used the Rosie AI chatbot yet.</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Rosie AI Conversations</div>
          <div style={{ color: '#6b7280', fontSize: '12px' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''} · {logs.length} total messages</div>
        </div>
      </div>

      {sessions.map((session, si) => (
        <div key={session.sessionId} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', marginBottom: '16px', overflow: 'hidden' }}>
          {/* Session header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Session {sessions.length - si}
            </span>
            <span style={{ color: '#4a5568', fontSize: '11px' }}>
              {session.startTime ? new Date(session.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
            </span>
          </div>

          {/* Messages */}
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {session.messages.map((msg, mi) => {
              const isUser = msg.role === 'user';
              return (
                <div key={mi} style={{ display: 'flex', gap: '10px', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  {!isUser && (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#b8933a44,#b8933a22)', border: '1px solid #b8933a55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0, marginTop: '2px' }}>
                      🤖
                    </div>
                  )}
                  <div style={{
                    maxWidth: '75%',
                    background: isUser ? 'rgba(96,165,250,0.12)' : 'rgba(184,147,58,0.08)',
                    border: `1px solid ${isUser ? 'rgba(96,165,250,0.2)' : 'rgba(184,147,58,0.2)'}`,
                    borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '8px 12px',
                  }}>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '4px', textAlign: isUser ? 'right' : 'left' }}>
                      {isUser ? user.name : 'Rosie AI'} · {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                  {isUser && (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>
                      {(user.name || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}