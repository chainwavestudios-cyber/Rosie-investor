/**
 * FronterHeadsUpPopup.jsx — Polls for active FronterHeadsUp alerts and shows
 * a TRANSFER popup with green pulsing LED edges for super admins on /fronter.
 * Popup shows: TRANSFER label, fronter name, lead name (clickable), LISTEN button,
 * and a close button. Plays a repeating beep tone until closed.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { logNotification } from '@/lib/notifyCenter';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';

// Silent — the transfer alert is recorded in the Notifications tab, no tone.
function recordTransferAlerts(alerts) {
  alerts.forEach((a) => logNotification({
    title: `Transfer from ${a.fronterUsername || 'a fronter'}`,
    body: a.leadName ? `Lead: ${a.leadName}` : 'A call is being transferred.',
    type: 'transfer',
    source: 'Fronter',
    linkPath: '/fronter',
  }));
}

export default function FronterHeadsUpPopup({ adminUsername, onListen, onOpenLead, onGrab }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [grabBusy, setGrabBusy] = useState({});
  const [grabMessage, setGrabMessage] = useState({});
  const prevIdsRef = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const active = await base44.entities.FronterHeadsUp.filter({ status: 'active' }, '-createdAt', 20);
      const newAlerts = (active || []).filter(a => !dismissed.has(a.id));
      // Play tone only for genuinely new alerts (not seen before)
      const currentIds = new Set(newAlerts.map(a => a.id));
      const fresh = newAlerts.filter(a => !prevIdsRef.current.has(a.id));
      if (fresh.length) recordTransferAlerts(fresh);
      prevIdsRef.current = currentIds;
      setAlerts(newAlerts);
    } catch {}
  }, [dismissed]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [load]);

  const closeAlert = async (alert) => {
    setDismissed(prev => new Set([...prev, alert.id]));
    setAlerts(prev => prev.filter(a => a.id !== alert.id));
    // Dismissing an AI transfer card must not cancel Chris's phone attempts
    // or destroy the live queue record used by the handoff callbacks.
    if (alert.routeType !== 'ai_agent') {
      try { await base44.entities.FronterHeadsUp.update(alert.id, { status: 'closed' }); } catch {}
    }
  };

  const grab = async (item) => {
    if (grabBusy[item.id]) return;
    setGrabBusy(prev => ({ ...prev, [item.id]: true }));
    try {
      const result = await onGrab?.(item);
      setGrabMessage(prev => ({ ...prev, [item.id]: result?.message || 'Answer the incoming call in your Fronter browser to join the prospect.' }));
    } catch (e) {
      setGrabMessage(prev => ({ ...prev, [item.id]: e?.message || 'Could not ring your browser handset.' }));
    } finally {
      setGrabBusy(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleListen = (alert) => {
    if (alert.conferenceName) {
      onListen?.(alert);
    } else {
      window.alert('No active conference is available for this call.');
    }
  };

  if (alerts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes transfer-led-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(16,185,129,0.6), 0 0 24px rgba(16,185,129,0.4), 0 0 48px rgba(16,185,129,0.2), 0 16px 64px rgba(0,0,0,0.7); }
          50% { box-shadow: 0 0 20px rgba(16,185,129,1), 0 0 48px rgba(16,185,129,0.7), 0 0 80px rgba(16,185,129,0.4), 0 16px 64px rgba(0,0,0,0.7); }
        }
        @keyframes transfer-border-blink {
          0%, 100% { border-color: rgba(16,185,129,0.5); }
          50% { border-color: #10b981; }
        }
        @keyframes transfer-led-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(16,185,129,1), 0 0 12px rgba(16,185,129,0.6); }
          50% { opacity: 0.3; box-shadow: 0 0 3px rgba(16,185,129,0.3); }
        }
      `}</style>
      {alerts.map(alert => (
        <div key={alert.id} style={{
          position: 'fixed', top: '20px', right: '20px', width: '360px', background: '#0d1b2a',
          border: '3px solid #10b981', borderRadius: '10px',
          animation: 'transfer-led-pulse 1s ease-in-out infinite, transfer-border-blink 0.8s ease-in-out infinite',
          zIndex: 10002,
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(16,185,129,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.08)', borderRadius: '7px 7px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', animation: 'transfer-led-dot 0.6s ease-in-out infinite' }} />
              <span style={{ color: '#10b981', fontSize: '18px', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase' }}>TRANSFER</span>
            </div>
            <button onClick={() => closeAlert(alert)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✕ Close</button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Transfer Source</div>
            <div style={{ color: AMBER, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>{alert.routeType === 'ai_agent' ? 'AI Agent → Chris Bongiorno' : alert.fronterUsername}</div>
            {alert.routeType === 'ai_agent' && <div style={{ color: '#a7bdd2', fontSize: '12px', marginBottom: '14px', lineHeight: 1.5 }}>
              <b style={{ color: '#e8e0d0' }}>{alert.routeState === 'calling_chris_primary' ? 'Calling your primary number' : alert.routeState === 'calling_chris_cell' ? 'Trying your cell phone' : alert.routeState === 'browser_ringing' ? 'Your browser is ringing' : alert.routeState === 'appointment_available' ? 'Both numbers unavailable · appointment option active' : alert.routeState === 'advisor_accepted' ? 'You accepted · connecting the calls' : 'Caller waiting in your queue'}</b>
              <div>Reported debt: {Number(alert.debtAmount) > 0 ? `$${Number(alert.debtAmount).toLocaleString('en-US')}` : 'Not yet confirmed'}</div>
            </div>}

            <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Lead</div>
            <button onClick={() => onOpenLead?.(alert.leadId)} style={{ display: 'block', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.33)', color: '#10b981', borderRadius: '4px', padding: '10px 12px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textAlign: 'left', marginBottom: '14px', width: '100%' }}>
              👤 {alert.leadName || 'Unknown Lead'}
              {alert.leadPhone && <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'normal', marginLeft: '8px' }}>· {alert.leadPhone}</span>}
            </button>

            <button
              onClick={() => handleListen(alert)}
              disabled={!alert.conferenceName}
              style={{ width: '100%', background: alert.conferenceName ? 'linear-gradient(135deg,#3b82f6,#60a5fa)' : 'rgba(255,255,255,0.05)', color: alert.conferenceName ? '#fff' : '#6b7280', border: '1px solid ' + (alert.conferenceName ? BLUE + '66' : 'rgba(255,255,255,0.1)'), borderRadius: '4px', padding: '10px', cursor: alert.conferenceName ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: alert.conferenceName ? 1 : 0.5, marginBottom: '8px' }}
            >
              🎧 {alert.conferenceName ? 'LISTEN TO CALL' : 'No Active Call to Listen'}
            </button>

            <button
              onClick={() => grab(alert)}
              disabled={!alert.conferenceName || !!grabBusy[alert.id]}
              style={{ width: '100%', background: alert.conferenceName ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(255,255,255,0.05)', color: alert.conferenceName ? '#0a0f1e' : '#6b7280', border: '1px solid ' + (alert.conferenceName ? GOLD + '66' : 'rgba(255,255,255,0.1)'), borderRadius: '4px', padding: '10px', cursor: alert.conferenceName ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: alert.conferenceName ? 1 : 0.5 }}
            >
              🤝 {grabBusy[alert.id] ? 'RINGING YOUR BROWSER…' : alert.conferenceName ? (alert.routeType === 'ai_agent' ? 'ANSWER IN BROWSER' : 'GRAB CALL') : 'No Call to Grab'}
            </button>

            {grabMessage[alert.id] && <div style={{ color: BLUE, fontSize: '11px', marginTop: '8px' }}>{grabMessage[alert.id]}</div>}
            <div style={{ color: '#4a5568', fontSize: '9px', textAlign: 'center', marginTop: '8px' }}>{new Date(alert.createdAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}</div>
          </div>
        </div>
      ))}
    </>
  );
}