/**
 * AppointmentReminders.jsx — Realtime popup reminders for the admin assistant.
 * Polls every 30s for upcoming DebtLead appointments and shows two types of
 * reminders:
 *   • 1-hour reminder  — fires ~55-65 min before the appointment (call + run Script 1)
 *   • 5-min reminder   — fires ~3-7 min before the appointment (call + run Script 2)
 * Dismissed reminders are tracked in localStorage so they don't reappear.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';

const STORAGE_KEY = 'apptRemindersShown';

export default function AppointmentReminders({ username, onDialLead }) {
  const [activeReminder, setActiveReminder] = useState(null);

  const getShown = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  };
  const markShown = (leadId, type) => {
    const shown = getShown();
    shown[`${leadId}_${type}`] = Date.now();
    // Clean entries older than 24h
    Object.keys(shown).forEach(k => { if (Date.now() - shown[k] > 86400000) delete shown[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shown));
  };

  const check = useCallback(async () => {
    try {
      const now = new Date();
      const in65min = new Date(now.getTime() + 65 * 60000);
      const page = await base44.entities.DebtLead.filter(
        { appointmentDate: { $gte: now.toISOString(), $lte: in65min.toISOString() }, deletedAt: { $exists: false } },
        { sort: 'appointmentDate', limit: 30, fields: ['firstName', 'lastName', 'appointmentDate', 'phone', 'email', 'appointmentConfirmed'] }
      );
      const leads = page?.items || page || [];
      const shown = getShown();

      for (const l of leads) {
        const apptTime = new Date(l.appointmentDate).getTime();
        const minsUntil = (apptTime - Date.now()) / 60000;

        // 1-hour reminder: 55-65 min before
        if (minsUntil <= 65 && minsUntil >= 50 && !shown[`${l.id}_1hr`]) {
          markShown(l.id, '1hr');
          setActiveReminder({ lead: l, type: '1hr', minsUntil: Math.round(minsUntil) });
          return;
        }
        // 5-min reminder: 3-7 min before
        if (minsUntil <= 7 && minsUntil >= 2 && !shown[`${l.id}_5min`]) {
          markShown(l.id, '5min');
          setActiveReminder({ lead: l, type: '5min', minsUntil: Math.round(minsUntil) });
          return;
        }
      }
    } catch (e) {
      console.error('AppointmentReminders check failed', e);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [check]);

  const dismiss = () => setActiveReminder(null);

  const callNow = () => {
    if (onDialLead) onDialLead(activeReminder.lead);
    dismiss();
  };

  if (!activeReminder) return null;
  const { lead, type, minsUntil } = activeReminder;
  const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
  const apptTime = new Date(lead.appointmentDate).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const is1hr = type === '1hr';

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 40000, maxWidth: '380px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ background: '#0d1b2a', border: `2px solid ${is1hr ? BLUE : GOLD}`, borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        {/* Header bar */}
        <div style={{ background: is1hr ? `linear-gradient(135deg,${BLUE},#3b82f6)` : `linear-gradient(135deg,${GOLD},#22c55e)`, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{is1hr ? '📞' : '🔔'}</span>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
              {is1hr ? '1-HOUR REMINDER CALL' : '5-MIN REMINDER — APPOINTMENT NOW'}
            </span>
          </div>
          <button onClick={dismiss} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '3px', width: 24, height: 24, cursor: 'pointer', fontSize: '14px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px' }}>
          <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold', marginBottom: '4px' }}>{fullName}</div>
          <div style={{ color: is1hr ? BLUE : GOLD, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
            ⏰ Appointment in ~{minsUntil} min · {apptTime}
          </div>
          <div style={{ color: BLUE, fontSize: '13px', marginBottom: '6px' }}>📞 {lead.phone || 'No phone'}</div>
          {lead.email && <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px' }}>✉️ {lead.email}</div>}

          {/* Script snippet */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px', marginBottom: '12px', color: '#e8e0d0', fontSize: '11px', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto' }}>
            {is1hr ? (
              <>
                <strong style={{ color: BLUE }}>Script 1 — 1-Hour Reminder:</strong>{'\n\n'}
                {lead.firstName}, this is Chris Bongiorno's assistant from Debt Advisors of America. I just wanted to remind you of your upcoming appointment with Chris Bongiorno in 1 hour. Did you get a chance to review the email he sent, and watch his welcome message?{'\n\n'}
                If yes: Great! I'll be calling back in one hour to connect you with Chris.{'\n'}
                If no: Would you like me to send that email again to you at {lead.email}?
              </>
            ) : (
              <>
                <strong style={{ color: GOLD }}>Script 2 — Connect & Transfer:</strong>{'\n\n'}
                Hello, this is Michie. I am calling in regards to your appointment in the next few min from the offices of Chris Bongiorno and Debt Advisors of America.{'\n\n'}
                I will go ahead and add you to his call queue, and he will answer shortly…
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={callNow} disabled={!lead.phone} style={{ flex: 1, background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: lead.phone ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: lead.phone ? 1 : 0.4 }}>
              📞 Call Now
            </button>
            <button onClick={dismiss} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', cursor: 'pointer', fontSize: '13px' }}>Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}