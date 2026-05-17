import { useState, useEffect } from 'react';

const REMINDERS_KEY = 'call_reminders';

export function useReminders() {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem(REMINDERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dueReminder, setDueReminder] = useState(null);

  // Save reminders to localStorage
  useEffect(() => {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }, [reminders]);

  // Check for due reminders every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const due = reminders.find(r => r.dueAt <= now && !r.fired);
      if (due) {
        setDueReminder(due);
        // Mark as fired so it doesn't pop up again
        setReminders(prev => prev.map(r => r.id === due.id ? { ...r, fired: true } : r));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [reminders]);

  const setReminder = (contact, minutesFromNow) => {
    const dueAt = Date.now() + minutesFromNow * 60 * 1000;
    const id = `${contact.id}-${Date.now()}`;
    setReminders(prev => [...prev, {
      id,
      firstName: contact.firstName || contact.name?.split(' ')[0] || '',
      lastName: contact.lastName || contact.name?.split(' ').slice(1).join(' ') || '',
      contactId: contact.id,
      type: contact.type || 'lead', // 'lead' or 'investor'
      leadType: contact.leadType || '',
      dueAt,
      fired: false,
    }]);
  };

  const dismissReminder = () => {
    setDueReminder(null);
  };

  const clearReminder = (id) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  return {
    reminders,
    dueReminder,
    setReminder,
    dismissReminder,
    clearReminder,
  };
}