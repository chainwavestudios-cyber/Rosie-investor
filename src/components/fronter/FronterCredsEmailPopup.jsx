/**
 * FronterCredsEmailPopup.jsx — Popup to email company credentials to a lead.
 * Auto-populates the customer's email, offers credential templates, and sends
 * via the connected Gmail account. On send, marks credsSentAt on the lead and
 * auto-graduates prospects to lead status.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };

const CREDS_TEMPLATES = [
  {
    id: 'portal_access',
    label: '🔑 Portal Access Credentials',
    subject: 'Your Portal Access Credentials',
    body: `<div style="font-family:Georgia,serif;font-size:14px;color:#333;">
<p>Hi {{firstName}},</p>
<p>Thank you for your interest. Here are your portal access credentials:</p>
<p><strong>Portal URL:</strong> https://rosieai-investorpage.base44.app/portal-login<br/>
<strong>Username:</strong> {{email}}</p>
<p>You will receive a separate email with your temporary password. Please log in and change your password upon first access.</p>
<p>Best regards,<br/>Rosie AI Team</p>
</div>`
  },
  {
    id: 'account_setup',
    label: '📋 Account Setup Instructions',
    subject: 'Account Setup Instructions',
    body: `<div style="font-family:Georgia,serif;font-size:14px;color:#333;">
<p>Hi {{firstName}},</p>
<p>Welcome to Rosie AI. Here are your account setup instructions:</p>
<p>1. Visit our portal at https://rosieai-investorpage.base44.app/portal-login<br/>
2. Enter your email: {{email}}<br/>
3. Follow the prompts to set up your account</p>
<p>If you have any questions, please do not hesitate to reach out.</p>
<p>Best regards,<br/>Rosie AI Team</p>
</div>`
  },
  {
    id: 'welcome_login',
    label: '👋 Welcome & Login Info',
    subject: 'Welcome to Rosie AI — Your Login Information',
    body: `<div style="font-family:Georgia,serif;font-size:14px;color:#333;">
<p>Hi {{firstName}},</p>
<p>Welcome to the Rosie AI family! We are excited to have you on board.</p>
<p><strong>Your Login Information:</strong><br/>
Portal: https://rosieai-investorpage.base44.app/portal-login<br/>
Email: {{email}}</p>
<p>You will receive a separate email with your temporary password. Please log in and complete your profile at your earliest convenience.</p>
<p>Best regards,<br/>Rosie AI Team</p>
</div>`
  },
  {
    id: 'custom',
    label: '✏️ Custom Credentials',
    subject: '',
    body: ''
  },
];

export default function FronterCredsEmailPopup({ lead, username, onClose, onSent }) {
  const [to, setTo] = useState(lead?.email || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('portal_access');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  // Apply template on mount and when template changes
  useEffect(() => {
    const t = CREDS_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (t) {
      const fillName = (lead?.firstName || '');
      const fillEmail = (lead?.email || to || '');
      setSubject(t.subject.replace(/{{firstName}}/g, fillName).replace(/{{email}}/g, fillEmail));
      setBody(t.body.replace(/{{firstName}}/g, fillName).replace(/{{email}}/g, fillEmail));
    }
  }, [selectedTemplateId]);

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setStatus('');
    try {
      // 1. Send the email via Gmail
      const res = await base44.functions.invoke('sendGmailEmail', {
        to: to.trim(),
        subject: subject.trim(),
        html: body.trim(),
        leadId: lead?.id,
        sentBy: username,
      });
      if (res?.error) throw new Error(res.error);

      // 2. Update the lead: mark creds sent + auto-graduate prospect to lead
      const now = new Date().toISOString();
      const templateLabel = CREDS_TEMPLATES.find(t => t.id === selectedTemplateId)?.label || selectedTemplateId;
      const updates = {
        credsSentAt: now,
        credsSentTemplate: templateLabel,
      };
      // Auto-graduate prospect to lead
      if (lead?.status === 'prospect') {
        updates.status = 'lead';
      }
      // Add a note to the notes log
      try {
        const log = JSON.parse(lead?.notesLogJson || '[]');
        log.push({ text: `🔑 Company credentials emailed to ${to.trim()} (${templateLabel})`, timestamp: now, author: username, type: 'creds' });
        updates.notesLogJson = JSON.stringify(log);
      } catch {}

      await base44.entities.FronterLead.update(lead.id, updates);

      setStatus('success');
      setTimeout(() => {
        onSent?.({ ...updates, email: to.trim() });
      }, 1000);
    } catch (e) {
      setStatus('error: ' + (e?.message || String(e)));
    }
    setSending(false);
  };

  return (
    <FronterPopup title="🔑 Email Company Credentials" subtitle="Sends from connected Gmail · auto-graduates to lead" accent={BLUE} onClose={onClose} initialSize={{ w: 540, h: 600 }} minW={400} minH={320} zIndex={10060}>
      <div style={{ padding: '16px' }}>
          {/* Recipient */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Customer Email {lead?.email ? '(auto-filled from contact card)' : '(enter email)'}</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="customer@email.com" style={inp} />
          </div>

          {/* Template selector */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Credential Template</label>
            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} style={inp}>
              {CREDS_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" style={inp} />
          </div>

          {/* Body */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Body (HTML — editable)</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
          </div>

          {/* Preview */}
          {body && (
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Preview</label>
              <div style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: body }} />
            </div>
          )}
        </div>

      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        {status === 'success' && <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>✓ Credentials sent! Lead graduated.</span>}
        {status.startsWith('error') && <span style={{ color: '#ef4444', fontSize: '11px' }}>{status}</span>}
        {!status && <span style={{ color: '#6b7280', fontSize: '10px' }}>Sending credentials auto-graduates prospect to lead</span>}
        <button onClick={send} disabled={sending || !to.trim() || !subject.trim() || !body.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '9px 24px', cursor: sending || !to.trim() || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: sending || !to.trim() || !subject.trim() || !body.trim() ? 0.5 : 1, marginLeft: 'auto' }}>
          {sending ? '⏳ Sending…' : '🔑 Send Credentials'}
        </button>
      </div>
    </FronterPopup>
  );
}