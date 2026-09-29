import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import DialerContactCard from './DialerContactCard';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function DialersTab({ managerUsername }) {
  const [dialers, setDialers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedDialer, setSelectedDialer] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [allUsers, allSessions] = await Promise.all([
        base44.entities.DebtCoachUser.list('-created_date', 500),
        base44.entities.DialerSession.list('-loginAt', 500),
      ]);
      setDialers((allUsers || []).filter(u => u.role === 'dialer' && u.isActive));
      setSessions(allSessions || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const getSessionForDialer = (username) => {
    return sessions.find(s => s.username === username && (s.status === 'logged_in' || s.status === 'on_call'));
  };

  const onlineCount = dialers.filter(d => getSessionForDialer(d.username)).length;
  const onCallCount = dialers.filter(d => getSessionForDialer(d.username)?.status === 'on_call').length;

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px 20px', flex: '0 0 auto' }}>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>{dialers.length}</div>
          <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Dialers</div>
        </div>
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '14px 20px', flex: '0 0 auto' }}>
          <div style={{ color: '#60a5fa', fontSize: '20px', fontWeight: 'bold' }}>{onlineCount}</div>
          <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Online Now</div>
        </div>
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '14px 20px', flex: '0 0 auto' }}>
          <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: 'bold' }}>{onCallCount}</div>
          <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>On a Call</div>
        </div>
      </div>

      {/* Dialer list */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedDialer ? '320px 1fr' : '1fr', gap: '16px', alignItems: 'start' }}>
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>👥 All Dialers</div>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0' }}>Loading…</div> :
             dialers.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No dialers found.</div> :
             dialers.map(d => {
               const session = getSessionForDialer(d.username);
               const isOnline = !!session;
               const isOnCall = session?.status === 'on_call';
               return (
                 <button key={d.id} onClick={() => setSelectedDialer(d)} style={{ width: '100%', background: selectedDialer?.id === d.id ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnCall ? '#ef4444' : isOnline ? '#4ade80' : '#4a5568', flexShrink: 0, animation: isOnCall ? 'pulse 1s infinite' : 'none' }} />
                   <div style={{ flex: 1 }}>
                     <div style={{ color: selectedDialer?.id === d.id ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: 'bold' }}>{d.username}</div>
                     <div style={{ color: '#6b7280', fontSize: '10px' }}>
                       {isOnCall ? '🔴 On a call' : isOnline ? '🟢 Online' : '⚫ Offline'}
                       {isOnCall && session?.currentCallLeadName && ` — ${session.currentCallLeadName}`}
                     </div>
                   </div>
                   {isOnCall && <span style={{ color: '#ef4444', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>LIVE</span>}
                 </button>
               );
             })}
          </div>
        </div>

        {selectedDialer && (
          <DialerContactCard
            dialer={selectedDialer}
            session={getSessionForDialer(selectedDialer.username)}
            managerUsername={managerUsername}
            onRefresh={load}
            onClose={() => setSelectedDialer(null)}
          />
        )}
      </div>
    </div>
  );
}