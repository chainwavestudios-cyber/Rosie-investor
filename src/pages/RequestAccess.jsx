import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

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

  useEffect(() => {
    setStatus('done'); // show thank-you immediately — no auth needed
    if (!email) return;
    base44.functions.invoke('dataRoomAccessRequest', { email, name, leadId }).catch(() => {});
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
            <div style={{ background: 'rgba(184,147,58,0.08)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '6px', padding: '16px 20px', color: '#b8933a', fontSize: '13px', lineHeight: 1.6 }}>
              📧 A confirmation has been noted for <strong>{email}</strong>
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