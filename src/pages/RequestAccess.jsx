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

  const [status, setStatus] = useState('loading'); // loading | done | error
  const [phone, setPhone] = useState('');
  const [smsStatus, setSmsStatus] = useState(''); // '' | 'loading' | 'done' | 'error'

  useEffect(() => {
    setStatus('done'); // show thank-you immediately — no auth needed
    if (!email) return;
    // Use plain fetch — no auth token needed since this is a public page
    fetch(`${window.location.origin}/api/functions/dataRoomAccessRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, leadId }),
    }).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#080f1c', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>

        {/* Logo / brand */}
        <div style={{ color: '#b8933a', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '40px', opacity: 0.8 }}>
          Rosie AI · Investor Relations
        </div>

        {status === 'loading' && (
          <div>
            <div style={{ width: '36px', height: '36px', border: '3px solid rgba(184,147,58,0.2)', borderTop: '3px solid #b8933a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <div style={{ color: '#8a9ab8', fontSize: '14px' }}>Processing your request…</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {status === 'done' && (
          <div>
            <div style={{ fontSize: '56px', marginBottom: '20px' }}>✅</div>
            <h1 style={{ color: '#e8e0d0', fontSize: '26px', fontWeight: 'normal', marginBottom: '12px', lineHeight: 1.3 }}>
              Request Received
            </h1>
            <p style={{ color: '#8a9ab8', fontSize: '15px', lineHeight: 1.7, marginBottom: '32px' }}>
              Thank you{name ? `, ${name.split(' ')[0]}` : ''}! Our team has been notified of your interest in accessing the data room.
              We'll be in touch shortly to verify your accreditation and grant access.
            </p>
            <div style={{ background: 'rgba(184,147,58,0.08)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '6px', padding: '16px 20px', color: '#b8933a', fontSize: '13px', lineHeight: 1.6, marginBottom: '28px' }}>
              📧 A confirmation has been noted for <strong>{email}</strong>
            </div>

            {/* SMS Opt-In */}
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '20px 24px', textAlign: 'left' }}>
              <div style={{ color: '#4ade80', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>💬 Text Message Updates</div>
              <p style={{ color: '#8a9ab8', fontSize: '13px', lineHeight: 1.6, margin: '0 0 14px' }}>
                Opt in to receive important updates and notifications via SMS.
              </p>
              {smsStatus === 'done' ? (
                <div style={{ color: '#4ade80', fontSize: '14px', textAlign: 'center', padding: '8px 0' }}>✅ You're opted in! We'll send updates to {phone}.</div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', fontFamily: 'Georgia, serif' }}
                  />
                  <button
                    onClick={async () => {
                      if (!phone.trim()) return;
                      setSmsStatus('loading');
                      try {
                        await fetch(`${window.location.origin}/api/functions/smsOptIn`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone: phone.trim(), name, email, leadId, source: 'request_access' }),
                        });
                        setSmsStatus('done');
                      } catch {
                        setSmsStatus('error');
                      }
                    }}
                    disabled={smsStatus === 'loading' || !phone.trim()}
                    style={{ background: 'linear-gradient(135deg,#4ade80,#22c55e)', color: '#000', border: 'none', borderRadius: '4px', padding: '10px 18px', cursor: phone.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', whiteSpace: 'nowrap', opacity: phone.trim() ? 1 : 0.5 }}>
                    {smsStatus === 'loading' ? '⏳' : 'Opt In'}
                  </button>
                </div>
              )}
              {smsStatus === 'error' && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>Something went wrong. Please try again.</div>}
              <p style={{ color: '#4a5568', fontSize: '10px', margin: '10px 0 0', lineHeight: 1.5 }}>
                By opting in you agree to receive SMS messages. Reply STOP at any time to unsubscribe.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ color: '#e8e0d0', fontSize: '22px', fontWeight: 'normal', marginBottom: '10px' }}>Invalid Request</h1>
            <p style={{ color: '#8a9ab8', fontSize: '14px' }}>This link appears to be incomplete. Please use the link from your invitation email, or contact us directly.</p>
          </div>
        )}

      </div>
    </div>
  );
}