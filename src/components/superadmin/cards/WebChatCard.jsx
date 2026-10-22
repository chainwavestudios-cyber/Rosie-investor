/**
 * WebChatCard.jsx — the live website chat console: one tab per visitor talking to the
 * homepage assistant right now, unread dots, and the takeover thread underneath.
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, ago, chip, emptyStyle } from '@/components/superadmin/kit';
import WebChatThread from '@/components/superadmin/cards/WebChatThread';

const POLL_MS = 5000;

export default function WebChatCard({ adminUserId, adminToken }) {
  const [sessions, setSessions] = useState([]);
  const [activeToken, setActiveToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seen = useRef({});

  const load = async () => {
    try {
      const res = await base44.functions.invoke('homeQualifyChat', {
        action: 'admin_overview',
        adminUserId,
        adminToken,
      });
      const data = res?.data || {};
      if (data.error) {
        setError(data.error);
        return;
      }
      const list = data.sessions || [];
      list.forEach((s) => {
        if (seen.current[s.sessionToken] === undefined) seen.current[s.sessionToken] = s.messageCount || 0;
      });
      setSessions(list);
      setActiveToken((prev) => (prev && list.some((s) => s.sessionToken === prev) ? prev : (list[0]?.sessionToken || '')));
      setError('');
    } catch {
      setError('Could not reach the website chat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [adminUserId, adminToken]);

  const openTab = (session) => {
    seen.current[session.sessionToken] = session.messageCount || 0;
    setActiveToken(session.sessionToken);
  };

  const unread = (session) => (session.messageCount || 0) > (seen.current[session.sessionToken] ?? 0);
  const active = sessions.find((s) => s.sessionToken === activeToken) || null;

  if (loading && sessions.length === 0) return <div style={emptyStyle}>Connecting to the website chat…</div>;

  return (
    <div>
      {error && <div style={{ color: C.warn, fontSize: '11px', marginBottom: '8px' }}>{error}</div>}

      {!loading && sessions.length === 0 && (
        <div style={emptyStyle}>
          No one is on the homepage chat right now. A tab opens here the moment a visitor starts talking to the bot.
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {sessions.map((session) => {
              const isActive = session.sessionToken === activeToken;
              const isHuman = session.status === 'human';
              return (
                <button
                  key={session.sessionToken}
                  type="button"
                  onClick={() => openTab(session)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                    background: isActive ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? `${C.fronter}66` : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? C.fronter : C.ink, borderRadius: '5px', padding: '6px 10px',
                    fontSize: '11px', fontWeight: isActive ? 'bold' : 'normal', cursor: 'pointer',
                  }}
                >
                  <span>{session.visitorLabel || 'Visitor'}</span>
                  <span style={chip(isHuman ? C.fronter : C.purple)}>{isHuman ? 'you' : 'bot'}</span>
                  {unread(session) && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.warn }} />}
                  <span style={{ color: C.dim, fontSize: '9px' }}>{ago(session.lastMessageAt)}</span>
                </button>
              );
            })}
          </div>

          {active && (
            <WebChatThread session={active} adminUserId={adminUserId} adminToken={adminToken} onChanged={load} />
          )}
        </>
      )}
    </div>
  );
}