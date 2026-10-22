/**
 * FronterDirectMessagePopup.jsx — One-time popup an admin sends to a single
 * fronter. Polls FronterPopupMessage for active messages addressed to this
 * username, shows them on screen, and closes each one when acknowledged.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function FronterDirectMessagePopup({ username }) {
  const [messages, setMessages] = useState([]);

  const load = useCallback(async () => {
    if (!username) return;
    try {
      const res = await base44.entities.FronterPopupMessage.filter(
        { recipientUsername: username, status: 'active' },
        { sort: '-sentAt', limit: 5 }
      );
      setMessages(Array.isArray(res) ? res : res?.items || []);
    } catch (e) { /* keep the last known popups on a failed poll */ }
  }, [username]);

  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [load]);

  const dismiss = async (message) => {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    try {
      await base44.entities.FronterPopupMessage.update(message.id, { status: 'closed', closedAt: new Date().toISOString() });
    } catch (e) { /* the next poll re-shows it if the save failed */ }
  };

  if (!messages.length) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,8,18,0.72)', padding: '18px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#0d1b2a', border: '2px solid #10b981', borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>🔔 Message From Admin</span>
          <span style={{ color: '#6b7280', fontSize: '10px' }}>
            {messages[0].sentAt ? new Date(messages[0].sentAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) : ''}
          </span>
        </div>
        {messages.map((message) => (
          <div key={message.id} style={{ padding: '18px 16px' }}>
            <div style={{ color: '#e8e0d0', fontSize: '17px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{message.message}</div>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '10px' }}>Sent by {message.sentBy || 'admin'}</div>
            <button onClick={() => dismiss(message)} style={{ marginTop: '16px', width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: '1px solid rgba(16,185,129,0.6)', borderRadius: '4px', padding: '11px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Got it</button>
          </div>
        ))}
      </div>
    </div>
  );
}