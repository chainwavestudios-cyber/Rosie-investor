/**
 * FronterMeetingScheduler.jsx — Popup for scheduling a meeting from a call transcript.
 * Scans transcript for date/time, generates meeting notes, checks calendar conflicts,
 * saves to Google Calendar, and optionally sets up customer email reminders.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const TZ_LABELS = {
  'America/New_York': 'Eastern Time',
  'America/Chicago': 'Central Time',
  'America/Denver': 'Mountain Time',
  'America/Phoenix': 'Mountain Time',
  'America/Los_Angeles': 'Pacific Time',
};

export default function FronterMeetingScheduler({ lead, username, disposition, onClose, onScheduled }) {
  const [scanning, setScanning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [customerReminder, setCustomerReminder] = useState(false);
  const [customerTimezone, setCustomerTimezone] = useState('America/New_York');
  const [scheduled, setScheduled] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);

  // Load latest transcript for the lead
  useEffect(() => {
    const loadTranscript = async () => {
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const result = await base44.entities.FronterCallTranscript.filter(
          { leadId: lead.id, callDate: { $gte: todayStart.toISOString() } },
          '-callDate', 1
        );
        const records = Array.isArray(result) ? result : (result?.items || []);
        const latest = records[0];
        if (latest) {
          try { setTranscript(JSON.parse(latest.transcriptJson || '[]')); } catch {}
        }
      } catch {}
      setTranscriptLoaded(true);
    };
    loadTranscript();
  }, [lead.id]);

  // Auto-scan transcript when loaded
  useEffect(() => {
    if (!transcriptLoaded || scanning) return;
    if (transcript.length > 0) {
      scanTranscript();
    } else {
      // No transcript — pre-fill with tomorrow 10am
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      // Format as ET date/time
      const etDate = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const etTime = tomorrow.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
      setMeetingDate(etDate);
      setMeetingTime(etTime);
    }
  }, [transcriptLoaded, transcript]);

  const scanTranscript = async () => {
    if (transcript.length === 0) return;
    setScanning(true); setError('');
    try {
      const res = await base44.functions.invoke('scheduleFronterMeeting', {
        action: 'scan',
        transcript,
        leadAddress: lead.address,
      });
      const data = res?.data || res;
      if (data.hasMeeting && data.startISO) {
        setScanResult(data);
        setCustomerTimezone(data.customerTimezone || 'America/New_York');
        // Parse ISO into date and time for the input fields (in ET)
        const dt = new Date(data.startISO);
        const etDate = dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const etTime = dt.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
        setMeetingDate(etDate);
        setMeetingTime(etTime);
        setMeetingNotes(data.meetingNotes || '');
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        const etDate = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const etTime = tomorrow.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
        setMeetingDate(etDate);
        setMeetingTime(etTime);
      }
    } catch (e) { setError('Scan failed: ' + (e?.message || String(e))); }
    setScanning(false);
  };

  const handleSchedule = async () => {
    if (!meetingDate || !meetingTime) { setError('Please select a date and time.'); return; }
    setScheduling(true); setError('');
    try {
      const startDateTime = `${meetingDate}T${meetingTime}`;
      const res = await base44.functions.invoke('scheduleFronterMeeting', {
        action: 'schedule',
        startDateTime,
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadPhone: lead.phone,
        leadEmail: lead.email,
        leadAddress: lead.address,
        fronterUsername: username,
        meetingNotes,
        customerReminder,
      });
      const data = res?.data || res;
      if (data.scheduled) {
        setScheduled(data);
        // Update lead disposition
        try {
          const updates = { status: 'lead', lastCallResult: disposition, lastCalledAt: new Date().toISOString() };
          await base44.entities.FronterLead.update(lead.id, updates);
        } catch {}
        onScheduled?.(data);
      } else {
        setError(data.error || 'Failed to schedule meeting');
      }
    } catch (e) { setError('Schedule failed: ' + (e?.message || String(e))); }
    setScheduling(false);
  };

  const tzLabel = TZ_LABELS[customerTimezone] || 'Eastern Time';

  return (
    <FronterPopup title="📅 Schedule Meeting" subtitle={`${lead.firstName} ${lead.lastName} · Disposition: ${disposition === 'appointment' ? 'Requests Meeting' : 'Interested'}`} accent={GOLD} onClose={onClose} initialSize={{ w: 500, h: 580 }} minW={380} minH={360} zIndex={10060}>
      <div style={{ padding: '18px' }}>
          {scanning && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: BLUE, fontSize: '13px' }}>
              <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid rgba(96,165,250,0.2)', borderTop: `3px solid ${BLUE}`, borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '10px' }} />
              <div>Scanning transcript for meeting time...</div>
            </div>
          )}

          {!scanning && scheduled && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
              <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Meeting Scheduled!</div>
              {scheduled.wasRescheduled && (
                <div style={{ color: AMBER, fontSize: '11px', marginBottom: '8px' }}>⚠ Moved 30 min forward due to calendar conflict</div>
              )}
              <div style={{ color: '#e8e0d0', fontSize: '13px', marginBottom: '4px' }}>📅 {scheduled.resolvedTimeET}</div>
              <div style={{ color: BLUE, fontSize: '12px', marginBottom: '4px' }}>📍 {scheduled.resolvedTimeCustomerTz} ({tzLabel})</div>
              {scheduled.htmlLink && (
                <a href={scheduled.htmlLink} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontSize: '11px', textDecoration: 'underline' }}>View in Google Calendar →</a>
              )}
              {customerReminder && (
                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', color: GOLD, fontSize: '11px' }}>
                  ✓ Customer reminders enabled — email will be sent the night before at 8pm {tzLabel} and 1 hour before the meeting
                </div>
              )}
              <button onClick={onClose} style={{ marginTop: '16px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 28px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Done</button>
            </div>
          )}

          {!scanning && !scheduled && (
            <div>
              {scanResult && !scanResult.hasMeeting && (
                <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', color: '#f59e0b', fontSize: '11px', marginBottom: '12px' }}>
                  ⚠ No specific meeting time found in transcript. Please set the date and time manually.
                </div>
              )}
              {scanResult && scanResult.hasMeeting && (
                <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', color: GOLD, fontSize: '11px', marginBottom: '12px' }}>
                  ✓ Found in transcript: {scanResult.timeLabel}
                </div>
              )}

              {/* Date and Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={ls}>Meeting Date (ET)</label>
                  <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={ls}>Meeting Time (ET)</label>
                  <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} style={inp} />
                </div>
              </div>

              {/* Customer timezone indicator */}
              <div style={{ padding: '8px 12px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: BLUE, fontSize: '11px' }}>📍</span>
                <span style={{ color: '#8a9ab8', fontSize: '11px' }}>Customer Timezone: <span style={{ color: BLUE, fontWeight: 'bold' }}>{tzLabel}</span></span>
                {!lead.address && <span style={{ color: '#6b7280', fontSize: '10px', fontStyle: 'italic' }}>(no address — defaulted to Eastern)</span>}
              </div>

              {/* Meeting Notes */}
              <div style={{ marginBottom: '12px' }}>
                <label style={ls}>Meeting Notes (auto-generated from transcript)</label>
                <textarea value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} rows={5} style={{ ...inp, resize: 'vertical' }} placeholder="Meeting notes will be auto-generated from the call transcript..." />
              </div>

              {/* Customer Reminder */}
              <div style={{ marginBottom: '16px', padding: '12px', background: customerReminder ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${customerReminder ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', cursor: 'pointer', onClick: () => setCustomerReminder(!customerReminder) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '4px', border: `2px solid ${customerReminder ? GOLD : '#4a5568'}`, background: customerReminder ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {customerReminder && <span style={{ color: DARK, fontSize: '11px', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ color: customerReminder ? GOLD : '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>📧 Customer Reminder</div>
                    <div style={{ color: '#8a9ab8', fontSize: '10px', marginTop: '2px' }}>Send email the night before at 8pm {tzLabel} and 1 hour before the meeting</div>
                  </div>
                </div>
                {customerReminder && !lead.email && (
                  <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3px', color: RED, fontSize: '10px' }}>
                    ⚠ No email address on file — add an email to the contact card to send reminders
                  </div>
                )}
              </div>

              {error && (
                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: RED, fontSize: '11px', marginBottom: '12px' }}>{error}</div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 20px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <button onClick={handleSchedule} disabled={scheduling || !meetingDate || !meetingTime} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 28px', cursor: scheduling ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: scheduling || !meetingDate || !meetingTime ? 0.5 : 1 }}>
                  {scheduling ? '⏳ Scheduling...' : '📅 Schedule Meeting'}
                </button>
              </div>
            </div>
          )}
      </div>
    </FronterPopup>
  );
}