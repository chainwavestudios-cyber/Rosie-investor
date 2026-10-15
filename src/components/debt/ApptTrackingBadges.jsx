/**
 * ApptTrackingBadges.jsx — Shows email tracking badges on the contact card.
 * Badges: Email Opened | BBB | Trustpilot | Company Website | 1hr Reminder
 * Each badge lights up when the corresponding tracking event is detected.
 * Also shows appointment confirm/change status.
 */
import { useState, useEffect } from 'react';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

export default function ApptTrackingBadges({ lead }) {
  const [now, setNow] = useState(Date.now());

  // Tick every 30s so badges update in real-time
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const badges = [
    {
      label: 'Email Opened',
      icon: '✉️',
      active: !!lead.apptEmailOpenedAt,
      timestamp: lead.apptEmailOpenedAt,
      color: BLUE,
    },
    {
      label: 'BBB',
      icon: '🏛️',
      active: !!lead.apptBbbClickedAt,
      timestamp: lead.apptBbbClickedAt,
      color: GOLD,
    },
    {
      label: 'Trustpilot',
      icon: '⭐',
      active: !!lead.apptTrustpilotClickedAt,
      timestamp: lead.apptTrustpilotClickedAt,
      color: GOLD,
    },
    {
      label: 'Company Website',
      icon: '🌐',
      active: !!lead.apptWebsiteClickedAt,
      timestamp: lead.apptWebsiteClickedAt,
      color: GOLD,
    },
    {
      label: '1hr Reminder',
      icon: '⏰',
      active: !!lead.apptHourReminderOpenedAt,
      timestamp: lead.apptHourReminderOpenedAt,
      color: PURPLE,
    },
  ];

  // Count how many of the 3 credential URLs were clicked
  const credentialClicks = [lead.apptBbbClickedAt, lead.apptTrustpilotClickedAt, lead.apptWebsiteClickedAt].filter(Boolean).length;
  const showFireHighlight = lead.apptEmailOpenedAt && credentialClicks >= 2;

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {badges.map(b => (
        <div
          key={b.label}
          title={b.active && b.timestamp ? `${b.label} — ${new Date(b.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : b.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '9px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            border: `1px solid ${b.active ? b.color + '66' : 'rgba(255,255,255,0.08)'}`,
            background: b.active ? `${b.color}18` : 'transparent',
            color: b.active ? b.color : '#4a5568',
            transition: 'all 0.3s',
            boxShadow: b.active ? `0 0 6px ${b.color}44` : 'none',
          }}
        >
          <span style={{ fontSize: '11px' }}>{b.icon}</span>
          <span>{b.label}</span>
          {b.active && <span style={{ fontSize: '8px' }}>✓</span>}
        </div>
      ))}
      {showFireHighlight && (
        <div style={{
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '9px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          background: 'rgba(239,68,68,0.15)',
          color: RED,
          border: '1px solid rgba(239,68,68,0.4)',
          animation: 'pulse 1s infinite',
        }}>
          🔥 Hot — 2/3 Links Clicked
        </div>
      )}
      {lead.appointmentConfirmed && (
        <div style={{
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '9px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          background: 'rgba(16,185,129,0.15)',
          color: GOLD,
          border: `1px solid ${GOLD}44`,
        }}>
          ✅ Confirmed
        </div>
      )}
      {lead.appointmentChangeRequested && (
        <div style={{
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '9px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          background: 'rgba(245,158,11,0.15)',
          color: AMBER,
          border: `1px solid ${AMBER}44`,
        }}>
          🔄 Change Requested
        </div>
      )}
    </div>
  );
}