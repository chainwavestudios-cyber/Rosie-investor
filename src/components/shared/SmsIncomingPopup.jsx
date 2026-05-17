import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

/**
 * SmsIncomingPopup
 * Polls for new unread inbound SMS and shows a popup for each one.
 * Props:
 *   onOpenLead      — fn(leadId) to open lead contact card
 *   onOpenInvestor  — fn(investorId) to open investor contact card
 */
export default function SmsIncomingPopup({ onOpenLead, onOpenInvestor }) {
  const [notifications, setNotifications] = useState([]); // [{msg, dismissed}]
  const seenIds = useRef(new Set());
  const pollRef = useRef(null);

  useEffect(() => {
    checkForNew();
    pollRef.current = setInterval(checkForNew, 6000);
    return () => clearInterval(pollRef.current);
  }, []);

  const checkForNew = async () => {
    try {
      const msgs = await base44.entities.SmsMessage.filter({ direction: 'inbound', read: false }, '-sentAt', 20);
      const fresh = (msgs || []).filter(m => !seenIds.current.has(m.id));
      fresh.forEach(m => seenIds.current.add(m.id));
      if (fresh.length > 0) {
        setNotifications(prev => [
          ...prev,
          ...fresh.map(m => ({ id: m.id, msg: m, dismissed: false }))
        ]);
        // Auto-dismiss after 30s
        fresh.forEach(m => {
          setTimeout(() => dismiss(m.id), 30000);
        });
      }
    } catch {}
  };

  const dismiss = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Mark as read
    base44.entities.SmsMessage.update(id, { read: true }).catch(() => {});
  };

  const handleOpen = (n) => {
    dismiss(n.id);
    if (n.msg.leadId && onOpenLead) onOpenLead(n.msg.leadId);
    else if (n.msg.investorId && onOpenInvestor) onOpenInvestor(n.msg.investorId);
  };

  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px', zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px',
    }}>
      {notifications.map((n) => (
        <NotificationCard key={n.id} n={n} onOpen={handleOpen} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function NotificationCard({ n, onOpen, onDismiss }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const from = n.msg.contactName || n.msg.fromNumber || 'Unknown';
  const preview = (n.msg.body || '').slice(0, 120) + (n.msg.body?.length > 120 ? '…' : '');
  const hasLead = !!(n.msg.leadId || n.msg.investorId);

  return (
    <div style={{
      background: '#0d1b2a',
      border: '1px solid rgba(74,222,128,0.45)',
      borderRadius: '8px',
      padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      animation: 'smsSlideIn 0.3s ease-out',
      position: 'relative',
    }}>
      <style>{`
        @keyframes smsSlideIn {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes smsPulse {
          0%,100% { box-shadow: 0 0 0 rgba(74,222,128,0); }
          50%      { box-shadow: 0 0 18px rgba(74,222,128,0.3); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80',
            flexShrink: 0, animation: 'smsPulse 1.2s ease-in-out infinite',
            boxShadow: '0 0 8px #4ade80',
          }} />
          <div>
            <div style={{ color: '#4ade80', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              💬 Incoming SMS
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginTop: '1px' }}>{from}</div>
            <div style={{ color: '#4a5568', fontSize: '10px', fontFamily: 'monospace' }}>{n.msg.fromNumber}</div>
          </div>
        </div>
        <button onClick={() => onDismiss(n.id)}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>
          ×
        </button>
      </div>

      {/* Message preview */}
      {preview && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '6px', padding: '8px 10px', marginBottom: '10px',
          color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6,
        }}>
          {preview}
        </div>
      )}

      {/* Elapsed */}
      <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '0.5px', marginBottom: '10px' }}>
        {elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ago`}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {hasLead && (
          <button onClick={() => onOpen(n)}
            style={{
              flex: 1, background: 'linear-gradient(135deg,#4ade80,#22c55e)', color: '#0a0f1e',
              border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer',
              fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px',
            }}>
            📋 Open Contact
          </button>
        )}
        <button onClick={() => onDismiss(n.id)}
          style={{
            flex: hasLead ? 0 : 1, background: 'rgba(255,255,255,0.05)', color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 12px',
            cursor: 'pointer', fontSize: '11px',
          }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}