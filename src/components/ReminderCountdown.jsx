import { useEffect, useState } from 'react';
import { useReminders } from '@/hooks/useReminders';

export default function ReminderCountdown({ contactId }) {
  const { reminders } = useReminders();
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const reminder = reminders.find(r => r.contactId === contactId);
    if (!reminder) {
      setTimeLeft(null);
      return;
    }

    const updateTime = () => {
      const now = Date.now();
      const remaining = Math.max(0, reminder.dueTime - now);
      
      if (remaining === 0) {
        setTimeLeft(null);
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [reminders, contactId]);

  if (!timeLeft) return null;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      background: 'rgba(74,222,128,0.12)',
      color: '#4ade80',
      border: '1px solid rgba(74,222,128,0.3)',
      borderRadius: '3px',
      padding: '3px 8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      fontWeight: '700',
      whiteSpace: 'nowrap',
    }}>
      ⏱ {timeLeft}
    </span>
  );
}