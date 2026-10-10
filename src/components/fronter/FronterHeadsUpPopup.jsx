/**
 * FronterHeadsUpPopup.jsx — Polls for active FronterHeadsUp alerts and shows
 * a popup with an audio tone for super admins on the /fronter page.
 * Popup shows: lead name (clickable to open contact card), LISTEN TO CALL button,
 * and a close button. Plays a repeating beep tone until closed.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';

function playAlertTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    playBeep(880, 0, 0.15);
    playBeep(880, 0.25, 0.15);
    playBeep(880, 0.5, 0.15);
  } catch (e) { console.warn('Audio tone failed:', e); }
}

export default function FronterHeadsUpPopup({ adminUsername, onListen, onOpenLead }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const prevCountRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const active = await base44.entities.FronterHeadsUp.filter({ status: 'active' }, '-createdAt', 20);
      const newAlerts = (active || []).filter(a => !dismissed.has(a.id));
      if (newAlerts.length > prevCountRef.current) {
        playAlertTone();
      }
      prevCountRef.current = newAlerts.length;
      setAlerts(newAlerts);
    } catch {}
  }, [dismissed]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const closeAlert = async (alert) => {
    setDismissed(prev => new Set([...prev, alert.id]));
    setAlerts(prev => prev.filter(a => a.id !== alert.id));
    try { await base44.entities.FronterHeadsUp.update(alert.id, { status: 'closed' }); } catch {}
  };

  const handleListen = (alert) => {
    if (alert.conferenceName) {
      onListen?.(alert);
    } else {
      alert('No active conference for this fronter. The fronter needs to be on a merged call.');
    }
  };

  if (alerts.length === 0) return null;

  return (
    <>
      {alerts.map(alert => (
        <div key={alert.id} style={{ position: 'fixed', top: '20px', right: '20px', width: '340px', background: '#0d1b2a', border: '2px solid ' + RED, borderRadius: '10px', boxShadow: '0 16px 64px rgba(239,68,68,0.4)', zIndex: 10002, animation: 'pulse 1s infinite' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + RED + '33', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: RED + '12', borderRadius: '10px 10px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🚨</span>
              <span style={{ color: RED, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Heads Up!</span>
            </div>
            <button onClick={() => closeAlert(alert)} style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid ' + RED + '44', color: RED, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✕ Close</button>
          </div>

          <div style={{ padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>From Fronter</div>
            <div style={{ color: AMBER, fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>{alert.fronterUsername}</div>

            <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Lead</div>
            <button onClick={() => onOpenLead?.(alert.leadId)} style={{ display: 'block', background: GOLD + '12', border: '1px solid ' + GOLD + '33', color: GOLD, borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textAlign: 'left', marginBottom: '12px', width: '100%' }}>
              👤 {alert.leadName || 'Unknown Lead'}
              {alert.leadPhone && <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'normal', marginLeft: '8px' }}>· {alert.leadPhone}</span>}
            </button>

            <button
              onClick={() => handleListen(alert)}
              disabled={!alert.conferenceName}
              style={{ width: '100%', background: alert.conferenceName ? 'linear-gradient(135deg,#3b82f6,#60a5fa)' : 'rgba(255,255,255,0.05)', color: alert.conferenceName ? '#fff' : '#6b7280', border: '1px solid ' + (alert.conferenceName ? BLUE + '66' : 'rgba(255,255,255,0.1)'), borderRadius: '4px', padding: '10px', cursor: alert.conferenceName ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: alert.conferenceName ? 1 : 0.5 }}
            >
              🎧 {alert.conferenceName ? 'LISTEN TO CALL' : 'No Active Call to Listen'}
            </button>

            <div style={{ color: '#4a5568', fontSize: '9px', textAlign: 'center', marginTop: '8px' }}>{new Date(alert.createdAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}</div>
          </div>
        </div>
      ))}
    </>
  );
}