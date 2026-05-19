import { useEffect, useState } from 'react';

/**
 * /request-access?email=...&name=...&lead_id=...
 * Linked from Mailjet marketing email button.
 * Auto-fires on load, shows a thank-you screen, notifies admins.
 */
export default function RequestAccess() {
  const params = new URLSearchParams(window.location.search);
  const email   = params.get('email')   || '';
  const name    = params.get('name')    || '';
  const leadId  = params.get('lead_id') || '';
  const firstName = name ? name.split(' ')[0] : '';

  const [status, setStatus] = useState('loading');
  const [phone, setPhone] = useState('');
  const [smsStatus, setSmsStatus] = useState(''); // '' | 'loading' | 'done' | 'error'

  useEffect(() => {
    setStatus('done');
    if (!email) return;
    fetch(`${window.location.origin}/api/functions/dataRoomAccessRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, leadId }),
    }).catch(() => {});
  }, []);

  const handleSmsOptIn = async () => {
    if (!phone.trim()) return;
    setSmsStatus('loading');
    try {
      await fetch(`${window.location.origin}/api/functions/smsOptIn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), firstName: firstName || name || 'Investor', email, leadId }),
      });
      setSmsStatus('done');
    } catch {
      setSmsStatus('error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080f1c', padding: '24px', fontFamily: 'Georgia, serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Brand header */}
      <div style={{ textAlign: 'center', color: '#b8933a', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '32px', opacity: 0.8 }}>
        Newport Beach Tech · Investor Relations
      </div>

      {status === 'loading' && (
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(184,147,58,0.2)', borderTop: '3px solid #b8933a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
          <div style={{ color: '#8a9ab8', fontSize: '14px' }}>Processing your request…</div>
        </div>
      )}

      {status === 'done' && (
        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '1100px', margin: '0 auto' }}>

          {/* Left column — confirmation + SMS */}
          <div style={{ flex: '0 0 420px', maxWidth: '420px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <h1 style={{ color: '#e8e0d0', fontSize: '26px', fontWeight: 'normal', marginBottom: '10px', lineHeight: 1.3 }}>
                Request Received
              </h1>
              <p style={{ color: '#8a9ab8', fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
                Thank you{firstName ? `, ${firstName}` : ''}! Our team has been notified of your interest in the NB Tech data room. You'll receive an email shortly with access instructions.
              </p>
              <div style={{ background: 'rgba(184,147,58,0.08)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '6px', padding: '14px 18px', color: '#b8933a', fontSize: '13px', lineHeight: 1.6 }}>
                📧 Confirmation noted for <strong>{email}</strong>
              </div>
            </div>

            {/* SMS Opt-In */}
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '10px', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <img
                  src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/9febafab0_Untitled313x313px.png"
                  alt="SMS Opt In"
                  style={{ width: '52px', height: '52px', objectFit: 'contain', flexShrink: 0 }}
                />
                <div>
                  <div style={{ color: '#4ade80', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px' }}>Stay in the Loop via Text</div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>Opt in to receive updates &amp; notifications via SMS</div>
                </div>
              </div>
              {smsStatus === 'done' ? (
                <div style={{ color: '#4ade80', fontSize: '14px', textAlign: 'center', padding: '10px 0' }}>✅ You're opted in! We'll text you at {phone}.</div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSmsOptIn()}
                    placeholder="(555) 555-5555"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '6px', padding: '11px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', fontFamily: 'Georgia, serif' }}
                  />
                  <button
                    onClick={handleSmsOptIn}
                    disabled={smsStatus === 'loading' || !phone.trim()}
                    style={{ background: 'linear-gradient(135deg,#4ade80,#22c55e)', color: '#000', border: 'none', borderRadius: '6px', padding: '11px 20px', cursor: phone.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', whiteSpace: 'nowrap', opacity: phone.trim() ? 1 : 0.5 }}>
                    {smsStatus === 'loading' ? '⏳' : 'Opt In'}
                  </button>
                </div>
              )}
              {smsStatus === 'error' && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>Something went wrong. Please try again.</div>}
              <p style={{ color: '#4a5568', fontSize: '10px', margin: '10px 0 0', lineHeight: 1.5 }}>
                By opting in you agree to receive SMS messages. Reply STOP at any time to unsubscribe. Msg &amp; data rates may apply.
              </p>
            </div>
          </div>

          {/* Right column — Calendly */}
          <div style={{ flex: '1 1 500px', minWidth: '320px' }}>
            <div style={{ color: '#b8933a', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'center' }}>
              📅 Schedule an Introduction Call
            </div>
            <iframe
              src="https://calendly.com/investors-rosieai/newport-beach-tech-pre-ipo-investor-introduction"
              width="100%"
              height="650"
              frameBorder="0"
              style={{ border: 'none', borderRadius: '10px', background: '#fff' }}
              title="Schedule a call"
            />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ color: '#e8e0d0', fontSize: '22px', fontWeight: 'normal', marginBottom: '10px' }}>Invalid Request</h1>
          <p style={{ color: '#8a9ab8', fontSize: '14px' }}>This link appears to be incomplete. Please use the link from your invitation email.</p>
        </div>
      )}
    </div>
  );
}