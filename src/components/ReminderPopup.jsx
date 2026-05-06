import { Phone, X } from 'lucide-react';

const GOLD = '#b8933a';

export default function ReminderPopup({ reminder, onDismiss, onOpenCard }) {
  if (!reminder) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: '#0d1b2a',
      border: `2px solid ${GOLD}`,
      borderRadius: '8px',
      padding: '20px',
      maxWidth: '320px',
      boxShadow: '0 20px 80px rgba(0,0,0,0.9)',
      zIndex: 9999,
      fontFamily: 'Georgia, serif',
      animation: 'slideIn 0.3s ease-out',
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(400px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Phone style={{ width: '18px', height: '18px', color: GOLD }} />
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Call Reminder
          </span>
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: 0 }}>
          ×
        </button>
      </div>

      <p style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px' }}>
        Call {reminder.firstName} {reminder.lastName}
      </p>

      <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 12px' }}>
        Built {new Date(reminder.createdAt || reminder.builtAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>

      <button
        onClick={onOpenCard}
        style={{
          width: '100%',
          background: `linear-gradient(135deg, ${GOLD}, #d4aa50)`,
          color: '#0a0f1e',
          border: 'none',
          borderRadius: '4px',
          padding: '10px',
          cursor: 'pointer',
          fontWeight: '700',
          fontSize: '12px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontFamily: 'Georgia, serif',
        }}>
        Open Card →
      </button>
    </div>
  );
}