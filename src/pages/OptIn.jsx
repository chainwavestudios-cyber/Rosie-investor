import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function OptIn() {
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { setError('You must agree to receive messages to continue.'); return; }
    if (!phone.trim() || !firstName.trim()) { setError('Please fill in all fields.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await base44.functions.invoke('sendSms', {
        toNumber: phone.trim(),
        body: `NB Tech Acquisitions: Hi ${firstName}! You are now opted-in to receive investment updates and communications from us. Msg & data rates may apply. Msg frequency varies. For help, reply HELP. To opt-out, reply STOP.`,
        fromNumber: null,
      });
      setSubmitted(true);
    } catch (err) {
      setError('There was an issue submitting your opt-in. Please try again or text START to our number.');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Georgia, serif' }}>
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', maxWidth: '480px', width: '100%', padding: '40px 36px' }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#b8933a', letterSpacing: '1px', marginBottom: '6px' }}>NB Tech Acquisitions</div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>SMS Investor Updates — Opt-In</div>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#1a1a2e', fontSize: '22px', fontWeight: 'bold', margin: '0 0 10px' }}>You're opted in!</h2>
            <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: 1.7 }}>
              You'll receive a confirmation text shortly. You can reply <strong>STOP</strong> at any time to unsubscribe, or <strong>HELP</strong> for assistance.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 style={{ color: '#1a1a2e', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>Receive SMS Updates</h2>
            <p style={{ color: '#4b5563', fontSize: '13px', lineHeight: 1.7, margin: '0 0 24px' }}>
              Opt in to receive investment updates, announcements, and important communications from NB Tech Acquisitions via text message. Message &amp; data rates may apply.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Your first name"
                required
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 14px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', color: '#1a1a2e' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mobile Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                required
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 14px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', color: '#1a1a2e' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{ marginTop: '3px', flexShrink: 0, width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="agree" style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.6, cursor: 'pointer' }}>
                I agree to receive recurring automated text messages from NB Tech Acquisitions at the phone number provided. Msg &amp; data rates may apply. Msg frequency varies. Reply <strong>HELP</strong> for help or <strong>STOP</strong> to cancel at any time. See our <a href="/terms" style={{ color: '#b8933a' }}>Terms &amp; Conditions</a> and <a href="/privacy" style={{ color: '#b8933a' }}>Privacy Policy</a>.
              </label>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', background: submitting ? '#d1d5db' : 'linear-gradient(135deg, #b8933a, #d4aa50)', color: submitting ? '#9ca3af' : '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.5px' }}
            >
              {submitting ? 'Submitting…' : 'Opt In to SMS Updates'}
            </button>

            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '11px', marginTop: '16px', lineHeight: 1.6 }}>
              You can also opt in by texting <strong>START</strong> to our number.<br />
              NB Tech Acquisitions · investors.rosieai.tech
            </p>
          </form>
        )}
      </div>
    </div>
  );
}