/**
 * EasternTimeReminder.jsx — One-time login reminder popup telling users
 * that all communication times are in Eastern Time. Dismissible, and
 * remembered per-user in localStorage so it only shows once.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

export default function EasternTimeReminder({ username }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(`et_reminder_${username}`) === 'done'; } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(`et_reminder_${username}`, 'done'); } catch {}
    setDismissed(true);
  };

  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 55000, maxWidth: '420px', width: '90%' }}>
      <div style={{ background: '#0d1b2a', border: `2px solid ${BLUE}55`, borderRadius: '12px', padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', textAlign: 'center' }}>
        <span style={{ fontSize: '36px' }}>🕐</span>
        <div style={{ color: BLUE, fontSize: '16px', fontWeight: 'bold', marginTop: '8px', letterSpacing: '1px' }}>All Times Are Eastern</div>
        <div style={{ color: '#8a9ab8', fontSize: '13px', marginTop: '10px', lineHeight: 1.6 }}>
          When communicating with the team, scheduling calls, or referencing any time — <strong style={{ color: '#e8e0d0' }}>always use Eastern Time (ET)</strong>. Your dashboard shows both Eastern and your local time to help you convert.
        </div>
        <button onClick={dismiss} style={{ marginTop: '20px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '10px 32px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
          Got it ✓
        </button>
      </div>
    </div>
  );
}