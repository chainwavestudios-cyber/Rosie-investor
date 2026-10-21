/**
 * AssistantLineBroadcast.jsx — Manual broadcast of the assistant's line status to the
 * /fronter workspace, for when calls are placed on an outside dialpad the app cannot see.
 * Available, on a call (starts the live timer fronters see) or offline.
 */
import { useEffect, useState } from 'react';
import useAssistantLineStatus, { findAssistantLine } from '@/components/assistant/useAssistantLineStatus';

const DARK = '#0a0f1e';
const GOLD = '#10b981';
const AMBER = '#f59e0b';
const GREY = '#6b7280';

const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
const btn = (color, active) => ({
  background: active ? color : `${color}18`,
  border: `1px solid ${color}44`,
  color: active ? DARK : color,
  borderRadius: '4px',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 'bold',
  fontFamily: 'Georgia, serif',
  whiteSpace: 'nowrap',
});

export default function AssistantLineBroadcast({ username }) {
  const { markAvailable, markOnCall, markOffline } = useAssistantLineStatus(username);
  const [status, setStatus] = useState('available');
  const [seconds, setSeconds] = useState(null);

  // Pick up a call already being broadcast when the portal opens
  useEffect(() => {
    if (!username) return;
    findAssistantLine(username).then(row => {
      if (row?.status === 'on_call') {
        setStatus('on_call');
        setSeconds(row.callStartedAt ? Math.max(0, Math.floor((Date.now() - new Date(row.callStartedAt).getTime()) / 1000)) : 0);
      }
    }).catch(() => {});
  }, [username]);

  // Live call timer, same clock the fronters see
  useEffect(() => {
    if (status !== 'on_call') return;
    const tick = setInterval(() => setSeconds(s => (s ?? 0) + 1), 1000);
    return () => clearInterval(tick);
  }, [status]);

  const goAvailable = () => { setStatus('available'); setSeconds(null); markAvailable(); };
  const goOnCall = () => { setStatus('on_call'); setSeconds(0); markOnCall('', ''); };
  const goOffline = () => { setStatus('offline'); setSeconds(null); markOffline(); };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px' }}>
      <span style={{ color: GREY, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>My Line to Fronters</span>
      <button onClick={goAvailable} style={btn(GOLD, status === 'available')}>🟢 Available</button>
      <button onClick={goOnCall} style={btn(AMBER, status === 'on_call')}>📞 On a Call{status === 'on_call' && seconds !== null ? ` · ${fmt(seconds)}` : ''}</button>
      <button onClick={goOffline} style={btn(GREY, status === 'offline')}>⭕ Offline</button>
      <span style={{ color: '#8a9ab8', fontSize: '10px' }}>Shown live on every fronter's workspace.</span>
    </div>
  );
}