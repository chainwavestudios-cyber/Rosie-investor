import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

export default function CustomEmailTab({ toEmail, toName, leadId, investorId, sentBy, onSent }) {
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSend = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      setMsg({ ok: false, text: 'Subject and body are required.' });
      return;
    }

    setSending(true);
    setMsg(null);

    try {
      const result = await base44.functions.invoke('sendCustomEmail', {
        leadId: leadId || null,
        investorId: investorId || null,
        toEmail,
        toName,
        subject,
        bodyHtml,
        bodyText: bodyText || bodyHtml.replace(/<[^>]+>/g, ''),
        sentBy,
      });

      setMsg({ ok: true, text: '✓ Email sent successfully!' });
      setSubject('');
      setBodyHtml('');
      setBodyText('');

      if (onSent) onSent();
    } catch (e) {
      setMsg({ ok: false, text: `Error: ${e.message}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 0, marginBottom: '16px' }}>
          Compose Custom Email
        </h3>

        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '12px 14px' }}>
          <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>To</div>
          <div style={{ color: '#e8e0d0', fontSize: '13px' }}>{toName} &lt;{toEmail}&gt;</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '2px',
              padding: '10px 14px',
              color: '#e8e0d0',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            HTML Body
          </label>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="Email HTML content (or plain text)"
            rows="10"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '2px',
              padding: '10px 14px',
              color: '#e8e0d0',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Plain Text Body (optional)
          </label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Plain text fallback (auto-stripped from HTML if blank)"
            rows="4"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '2px',
              padding: '10px 14px',
              color: '#e8e0d0',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
        </div>

        {msg && (
          <div
            style={{
              background: msg.ok ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '2px',
              padding: '10px 14px',
              color: msg.ok ? '#4ade80' : '#ff8a8a',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {msg.text}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            background: `linear-gradient(135deg, ${GOLD}, #d4aa50)`,
            color: '#0a0f1e',
            border: 'none',
            borderRadius: '2px',
            padding: '12px 32px',
            cursor: sending ? 'not-allowed' : 'pointer',
            fontWeight: '700',
            fontSize: '12px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? 'Sending…' : '📧 Send Email'}
        </button>
      </div>
    </div>
  );
}