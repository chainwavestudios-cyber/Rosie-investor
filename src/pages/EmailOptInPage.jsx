/**
 * EmailOptInPage — public email opt-in form (no login).
 * Single opt-in: the visitor ticks a consent box that names the subscription
 * topic, and the submission itself is the recorded consent — the contact goes
 * straight onto the Debt Solutions email list.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const BLUE = '#0ea5e9';
const INK = '#0d1117';
const MUTED = '#4b5563';
const BORDER = '#e5e7eb';

const CONSENT_TEXT = 'I agree to receive email updates and communications from Debt Solutions, and I understand I can withdraw my consent at any time.';

const field = { width: '100%', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 14px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', color: INK, background: '#fff' };
const label = { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };

export default function EmailOptInPage() {
  const [stage, setStage] = useState('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joinedEmail, setJoinedEmail] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (!agreed) { setError('Please tick the consent box to continue.'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('emailOptIn', {
        action: 'subscribe',
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        consent: true,
      });
      if (res?.data?.error) { setError(res.data.error); setBusy(false); return; }
      setJoinedEmail(email.trim().toLowerCase());
      setStage('subscribed');
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    }
    setBusy(false);
  };

  const shell = (children) => (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: '24px', border: `1px solid ${BORDER}`, boxShadow: '0 10px 40px rgba(0,0,0,0.07)', maxWidth: '520px', width: '100%', overflow: 'hidden' }}>
        <div style={{ background: BLUE, padding: '20px 32px' }}>
          <div style={{ color: INK, fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>Debt Solutions</div>
        </div>
        <div style={{ padding: '32px' }}>{children}</div>
      </div>
    </div>
  );

  if (stage === 'subscribed') {
    return shell(
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: '44px', marginBottom: '14px' }}>✅</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK, fontSize: '24px', margin: '0 0 10px' }}>You're subscribed</h1>
        <p style={{ color: MUTED, fontSize: '14px', lineHeight: 1.7, margin: 0 }}>
          {joinedEmail ? <><strong>{joinedEmail}</strong> is on our email list. </> : 'Your email is on our list. '}
          You'll receive our updates, and you can unsubscribe at any time using the link in any email.
        </p>
      </div>
    );
  }

  return shell(
    <>
      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: INK, fontSize: '26px', margin: '0 0 8px' }}>Get our email updates</h1>
      <p style={{ color: MUTED, fontSize: '14px', lineHeight: 1.7, margin: '0 0 24px' }}>
        Enter your details to join our email list and start receiving updates and important communications from Debt Solutions.
      </p>

      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={label}>First Name</label>
            <input style={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
          </div>
          <div>
            <label style={label}>Last Name</label>
            <input style={field} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={label}>Email Address *</label>
          <input type="email" required style={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: BLUE, cursor: 'pointer' }} />
          <span style={{ color: MUTED, fontSize: '12px', lineHeight: 1.6 }}>{CONSENT_TEXT}</span>
        </label>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>
        )}

        <button type="submit" disabled={busy} style={{ width: '100%', background: BLUE, color: INK, border: 'none', borderRadius: '24px', padding: '14px', fontSize: '15px', fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}>
          {busy ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>

      <p style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.6, marginTop: '18px', marginBottom: 0 }}>
        Submitting this form adds you to our email list. You can unsubscribe at any time.
      </p>
    </>
  );
}