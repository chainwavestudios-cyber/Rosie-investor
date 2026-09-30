/**
 * AppointmentPreviewModal.jsx — Shows parsed appointment info from the
 * auto-scheduler with a customer email field and Approve/Dismiss buttons.
 *
 * - Approve → creates the Google Calendar event WITH the customer email
 *   as an attendee (they get a calendar invite / reminder email).
 * - Dismiss → auto-books the event WITHOUT the email (fallback).
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function AppointmentPreviewModal({ preview, lead, agentName, onDone }) {
  const [email, setEmail] = useState(lead?.email || '');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!preview) return null;

  const createEvent = async (withEmail) => {
    setCreating(true); setError('');
    try {
      const leadName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim();
      const res = await base44.functions.invoke('autoScheduleAppointment', {
        action: 'create',
        startISO: preview.startISO,
        leadId: lead?.id,
        leadName,
        agentName: agentName || '',
        summary: preview.summary,
        attendeeEmail: withEmail && email.trim() ? email.trim() : null,
      });
      const data = res?.data || res;
      if (data?.scheduled) {
        setResult({ success: true, htmlLink: data.htmlLink, resolvedTime: data.resolvedTime, wasRescheduled: data.wasRescheduled, withEmail: withEmail && !!email.trim() });
      } else {
        setError(data?.error || 'Failed to create calendar event');
      }
    } catch (e) { setError('Failed: ' + (e?.message || String(e))); }
    setCreating(false);
  };

  const handleApprove = () => createEvent(true);
  const handleDismiss = () => createEvent(false);

  const handleClose = () => {
    if (result?.success) { onDone?.(result); }
    else { onDone?.(null); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }}>
        {result?.success ? (
          // ── Success state ────────────────────────────────────────────────
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Calendar Event Created!</div>
            <div style={{ color: '#c4cdd8', fontSize: '13px', marginBottom: '8px' }}>{result.resolvedTime}</div>
            {result.wasRescheduled && <div style={{ color: '#f59e0b', fontSize: '11px', marginBottom: '8px' }}>⚠ Time adjusted due to calendar conflict</div>}
            {result.withEmail ? (
              <div style={{ color: BLUE, fontSize: '12px', marginBottom: '8px' }}>✉ Calendar invite sent to {email}</div>
            ) : (
              <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '8px' }}>No email invite sent</div>
            )}
            {result.htmlLink && (
              <a href={result.htmlLink} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: '16px', color: BLUE, fontSize: '12px', textDecoration: 'underline' }}>🔗 View in Google Calendar ↗</a>
            )}
            <div>
              <button onClick={handleClose} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Done</button>
            </div>
          </div>
        ) : (
          // ── Preview form ─────────────────────────────────────────────────
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>📅 Schedule Follow-Up</div>
              <button onClick={() => onDone?.(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: '0 4px' }}>×</button>
            </div>

            <div style={{ background: 'rgba(16,185,129,0.06)', border: `1px solid ${GOLD}33`, borderRadius: '4px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ ...ls, display: 'inline', marginRight: '8px' }}>Customer:</span>
                <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{lead?.firstName} {lead?.lastName}</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ ...ls, display: 'inline', marginRight: '8px' }}>Requested:</span>
                <span style={{ color: '#c4cdd8', fontSize: '12px' }}>{preview.requestedTime}</span>
              </div>
              <div style={{ marginBottom: preview.wasRescheduled ? '8px' : '0' }}>
                <span style={{ ...ls, display: 'inline', marginRight: '8px' }}>Scheduled:</span>
                <span style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>{preview.resolvedTime}</span>
              </div>
              {preview.wasRescheduled && (
                <div style={{ color: '#f59e0b', fontSize: '11px', marginTop: '4px' }}>⚠ Adjusted due to calendar conflict</div>
              )}
              {preview.summary && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ ...ls, display: 'inline', marginRight: '8px' }}>Agenda:</span>
                  <span style={{ color: '#c4cdd8', fontSize: '12px' }}>{preview.summary}</span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={ls}>✉ Customer Email (for calendar invite)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@email.com" style={inp} />
              <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>If provided, the customer gets a Google Calendar invite so they know you're calling.</div>
            </div>

            {error && <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: RED, fontSize: '12px' }}>⚠ {error}</div>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleApprove} disabled={creating} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: creating ? 0.5 : 1 }}>
                {creating ? '⏳ Creating…' : '✓ Approve & Schedule'}
              </button>
              <button onClick={handleDismiss} disabled={creating} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '12px 16px', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: creating ? 0.5 : 1 }} title="Auto-book without email invite">
                {creating ? '⏳' : 'Skip Email'}
              </button>
            </div>
            <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>If you close this without choosing, the event auto-books at call end.</div>
          </>
        )}
      </div>
    </div>
  );
}