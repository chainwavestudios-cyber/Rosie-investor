/**
 * ReschedulePage — Public customer-facing page for rebooking a missed
 * appointment. Reached from the "we missed you" email. Shows 6 time slots
 * (3 today, 3 tomorrow) + a custom-time form. On selection, calls the
 * bookReschedule backend function which creates a calendar event and
 * sends a confirmation email.
 *
 * URL params:
 *   leadId  — required
 *   token   — required (security)
 *   slot    — slot index (0-5) → immediately book that slot
 *   custom  — "1" → jump to custom time form
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const PRIMARY = '#0ea5e9';
const DARK = '#0d1117';
const MUTED = '#6b7280';

export default function ReschedulePage() {
  const [lead, setLead] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('leadId');
  const token = urlParams.get('token');
  const slotParam = urlParams.get('slot');
  const customParam = urlParams.get('custom');

  const loadLead = useCallback(async () => {
    if (!leadId || !token) { setError('Missing booking link information. Please use the link from your email.'); setLoading(false); return; }
    try {
      const leadData = await base44.entities.DebtLead.get(leadId);
      setLead(leadData);
      try { setSlots(JSON.parse(leadData.rescheduleSlotsJson || '[]')); } catch { setSlots([]); }
      if (leadData.rescheduleBookedAt) {
        setBooked({ appointmentDate: leadData.appointmentDate, alreadyBooked: true });
      }
    } catch (e) {
      setError('Could not load your booking information. Please check your email link.');
    }
    setLoading(false);
  }, [leadId, token]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  // Auto-book if slot=N is in the URL
  useEffect(() => {
    if (slotParam != null && lead && !booked && !booking) {
      doBook({ slotIndex: Number(slotParam) });
    }
  }, [slotParam, lead, booked, booking]);

  // Show custom form if custom=1
  useEffect(() => {
    if (customParam === '1') setShowCustom(true);
  }, [customParam]);

  const doBook = async (params) => {
    if (!leadId || !token) return;
    setBooking(true);
    setError('');
    try {
      const res = await base44.functions.invoke('bookReschedule', { leadId, token, ...params });
      const data = res?.data || res;
      if (data?.error) {
        if (data.error === 'already_booked') {
          setBooked({ appointmentDate: data.appointmentDate, alreadyBooked: true });
        } else {
          setError(data.error);
        }
      } else if (data?.success) {
        setBooked({ appointmentDate: data.appointmentDate, appointmentLabel: data.appointmentLabel });
      } else {
        setError('Could not book your appointment. Please try again or call (619) 353-0919.');
      }
    } catch (e) {
      setError('Could not book your appointment. Please try again or call (619) 353-0919.');
    }
    setBooking(false);
  };

  const handleCustomSubmit = () => {
    if (!customDate || !customTime) { setError('Please pick a date and time.'); return; }
    const iso = new Date(`${customDate}T${customTime}`).toISOString();
    const now = Date.now();
    if (new Date(iso).getTime() <= now) { setError('Please pick a future date and time.'); return; }
    doBook({ customISO: iso });
  };

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', fontFamily: "'DM Sans', Arial, Helvetica, sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: PRIMARY, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: MUTED, fontSize: '15px' }}>Loading your booking page…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Booked confirmation ──
  if (booked) {
    const apptLabel = booked.appointmentLabel || (booked.appointmentDate ? new Date(booked.appointmentDate).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', fontFamily: "'DM Sans', Arial, Helvetica, sans-serif", padding: '20px' }}>
        <div style={{ maxWidth: 520, background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{booked.alreadyBooked ? '📅' : '✅'}</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, color: DARK, margin: '0 0 12px' }}>
            {booked.alreadyBooked ? 'Already Rescheduled' : 'You\'re All Set!'}
          </h1>
          <p style={{ fontSize: 16, color: DARK, lineHeight: 1.6, margin: '0 0 8px' }}>
            {booked.alreadyBooked
              ? 'Your call has already been rescheduled to:'
              : 'Your call has been rescheduled to:'}
          </p>
          <p style={{ fontSize: 20, fontWeight: 'bold', color: PRIMARY, margin: '8px 0 24px' }}>
            {apptLabel} ET
          </p>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, margin: '0 0 24px' }}>
            A confirmation email is on its way. If you need to change the time again, just reply to that email or call (619) 353-0919.
          </p>
        </div>
      </div>
    );
  }

  // ── Error (no lead) ──
  if (!lead && error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', fontFamily: "'DM Sans', Arial, Helvetica, sans-serif", padding: '20px' }}>
        <div style={{ maxWidth: 520, background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>😕</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, color: DARK, margin: '0 0 12px' }}>Booking Link Not Found</h1>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: '0 0 24px' }}>{error}</p>
          <p style={{ fontSize: 14, color: DARK }}>Call us at <strong>(619) 353-0919</strong> and we'll get you scheduled.</p>
        </div>
      </div>
    );
  }

  // ── Slot selection ──
  const todaySlots = slots.map((s, i) => ({ ...s, idx: i })).filter(s => s.dayLabel === 'Today');
  const tomorrowSlots = slots.map((s, i) => ({ ...s, idx: i })).filter(s => s.dayLabel === 'Tomorrow');

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5', fontFamily: "'DM Sans', Arial, Helvetica, sans-serif", padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: 12, padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginTop: 40 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, color: DARK, margin: '0 0 8px' }}>
          Reschedule Your Call
        </h1>
        <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: '0 0 28px' }}>
          Hi {lead?.firstName || 'there'}, sorry we missed connecting. Pick a time below that works for you — all times are Eastern.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {booking && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: PRIMARY, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: MUTED, fontSize: 14 }}>Booking your appointment…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!booking && (
          <>
            {/* Today slots */}
            {todaySlots.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 'bold', color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Today</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {todaySlots.map(s => (
                    <button
                      key={s.idx}
                      onClick={() => doBook({ slotIndex: s.idx })}
                      style={{
                        background: PRIMARY, color: '#000', border: 'none', borderRadius: 8,
                        padding: '12px 20px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
                        fontFamily: "'DM Sans', Arial, sans-serif",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tomorrow slots */}
            {tomorrowSlots.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 'bold', color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Tomorrow</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {tomorrowSlots.map(s => (
                    <button
                      key={s.idx}
                      onClick={() => doBook({ slotIndex: s.idx })}
                      style={{
                        background: PRIMARY, color: '#000', border: 'none', borderRadius: 8,
                        padding: '12px 20px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
                        fontFamily: "'DM Sans', Arial, sans-serif",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom time */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, marginTop: 8 }}>
              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  style={{
                    background: 'transparent', color: PRIMARY, border: `1px solid ${PRIMARY}`,
                    borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 'bold',
                    cursor: 'pointer', fontFamily: "'DM Sans', Arial, sans-serif", width: '100%',
                  }}
                >
                  Or request a specific time
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 'bold', color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Request a Specific Time</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: 12 }}>
                    <label style={{ flex: 1, minWidth: 140 }}>
                      <span style={{ display: 'block', fontSize: 12, color: MUTED, marginBottom: 4 }}>Date</span>
                      <input
                        type="date"
                        value={customDate}
                        onChange={e => setCustomDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, fontFamily: "'DM Sans', Arial, sans-serif", boxSizing: 'border-box' }}
                      />
                    </label>
                    <label style={{ flex: 1, minWidth: 140 }}>
                      <span style={{ display: 'block', fontSize: 12, color: MUTED, marginBottom: 4 }}>Time</span>
                      <input
                        type="time"
                        value={customTime}
                        onChange={e => setCustomTime(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, fontFamily: "'DM Sans', Arial, sans-serif", boxSizing: 'border-box' }}
                      />
                    </label>
                  </div>
                  <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>All times are Eastern. We'll confirm via email.</p>
                  <button
                    onClick={handleCustomSubmit}
                    disabled={!customDate || !customTime}
                    style={{
                      background: PRIMARY, color: '#000', border: 'none', borderRadius: 8,
                      padding: '12px 24px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
                      fontFamily: "'DM Sans', Arial, sans-serif",
                      opacity: (!customDate || !customTime) ? 0.5 : 1,
                    }}
                  >
                    Book This Time
                  </button>
                </div>
              )}
            </div>

            <p style={{ fontSize: 13, color: MUTED, marginTop: 28, textAlign: 'center' }}>
              Need help? Call <strong style={{ color: DARK }}>(619) 353-0919</strong>
            </p>
          </>
        )}
      </div>
    </div>
  );
}