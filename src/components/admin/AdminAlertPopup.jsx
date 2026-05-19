/**
 * AdminAlertPopup.jsx
 * Shows a centered, animated popup when an alert message arrives from the other user.
 * Options: Close (dismiss) or Go to Chat (opens chat window).
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const CHAT_USERS = ['admin', 'steph'];

export default function AdminAlertPopup({ currentUsername, onOpenChat }) {
  const [alerts, setAlerts] = useState([]);
  const seenIds = useRef(new Set());
  const pollRef = useRef(null);

  const checkAlerts = async () => {
    if (!CHAT_USERS.includes(currentUsername)) return;
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 20);
      const pending = (msgs || []).filter(m => {
        if (!m.isAlert) return false;
        if (m.sender === currentUsername) return false; // don't alert yourself
        if (seenIds.current.has(m.id)) return false;
        // Check if this user already dismissed it
        let dismissed = [];
        try { dismissed = JSON.parse(m.alertDismissedBy || '[]'); } catch {}
        return !dismissed.includes(currentUsername);
      });
      if (pending.length > 0) {
        setAlerts(prev => {
          const newOnes = pending.filter(m => !prev.find(p => p.id === m.id));
          return [...prev, ...newOnes];
        });
      }
    } catch {}
  };

  useEffect(() => {
    if (!CHAT_USERS.includes(currentUsername)) return;
    checkAlerts();
    pollRef.current = setInterval(checkAlerts, 30000);
    return () => clearInterval(pollRef.current);
  }, [currentUsername]);

  const dismiss = async (alert) => {
    seenIds.current.add(alert.id);
    setAlerts(prev => prev.filter(a => a.id !== alert.id));
    // Mark dismissed in DB
    try {
      let dismissed = [];
      try { dismissed = JSON.parse(alert.alertDismissedBy || '[]'); } catch {}
      if (!dismissed.includes(currentUsername)) {
        dismissed.push(currentUsername);
        await base44.entities.AdminChat.update(alert.id, { alertDismissedBy: JSON.stringify(dismissed) });
      }
    } catch {}
  };

  const goToChat = async (alert) => {
    await dismiss(alert);
    onOpenChat?.();
  };

  if (!alerts.length) return null;

  // Show only the first unread alert
  const alert = alerts[0];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9990,
      background: 'rgba(0,0,0,0.65)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4), 0 32px 80px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 0 12px rgba(239,68,68,0), 0 32px 80px rgba(0,0,0,0.8); }
        }
      `}</style>
      <div style={{
        background: 'linear-gradient(135deg, #0d1b2a, #111d2c)',
        border: '2px solid rgba(239,68,68,0.6)',
        borderRadius: '12px',
        padding: '32px 36px',
        maxWidth: '440px',
        width: '90%',
        textAlign: 'center',
        animation: 'slideUp 0.25s ease, alertPulse 2s ease-in-out infinite',
      }}>
        {/* Alert icon */}
        <div style={{ fontSize: '48px', marginBottom: '12px', lineHeight: 1 }}>🚨</div>

        {/* From */}
        <div style={{ color: '#ef4444', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
          Alert from {alert.sender}
        </div>

        {/* Content */}
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '8px',
          padding: '16px 20px',
          color: '#e8e0d0',
          fontSize: '15px',
          lineHeight: 1.6,
          marginBottom: '24px',
          fontFamily: 'Georgia, serif',
        }}>
          {alert.content}
        </div>

        {/* Time */}
        <div style={{ color: '#4a5568', fontSize: '11px', marginBottom: '20px' }}>
          {alert.sentAt ? new Date(alert.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => goToChat(alert)}
            style={{
              background: 'linear-gradient(135deg,#b8933a,#d4aa50)',
              color: '#0a0f1e',
              border: 'none',
              borderRadius: '6px',
              padding: '11px 28px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            💬 Go to Chat
          </button>
          <button
            onClick={() => dismiss(alert)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#8a9ab8',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              padding: '11px 28px',
              cursor: 'pointer',
              fontSize: '12px',
              letterSpacing: '0.5px',
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}