/**
 * GmailTemplateSender.jsx — Small dialog to send an email from the connected
 * Gmail account. Pick a recipient, choose/edit a template, and send.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };

const QUICK_TEMPLATES = [
  { label: '✉️ Intro Email', subject: 'Introduction to Rosie AI', body: '<div style="font-family:Georgia,serif;font-size:14px;color:#333;">\n<p>Hi {{firstName}},</p>\n<p>I wanted to reach out and introduce you to Rosie AI. We help investors explore unique opportunities in the private credit and distressed debt space.</p>\n<p>Would you be open to a brief call this week to learn more?</p>\n<p>Best regards,<br/>Chris</p>\n</div>' },
  { label: '🔄 Follow-up', subject: 'Following up on our conversation', body: '<div style="font-family:Georgia,serif;font-size:14px;color:#333;">\n<p>Hi {{firstName}},</p>\n<p>I wanted to follow up on our recent conversation. Have you had a chance to review the materials I sent over?</p>\n<p>Happy to answer any questions you might have.</p>\n<p>Best regards,<br/>Chris</p>\n</div>' },
  { label: '📅 Meeting Reminder', subject: 'Reminder: Upcoming meeting', body: '<div style="font-family:Georgia,serif;font-size:14px;color:#333;">\n<p>Hi {{firstName}},</p>\n<p>This is a quick reminder about our upcoming meeting. Looking forward to speaking with you.</p>\n<p>Best regards,<br/>Chris</p>\n</div>' },
  { label: '📝 Blank', subject: '', body: '' },
];

export default function GmailTemplateSender({ defaultRecipient = '', leadId, leadFirstName = '', sentBy = 'admin', onClose }) {
  const [to, setTo] = useState(defaultRecipient || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [pos, setPos] = useState({ x: 200, y: 100 });
  const dragRef = useRef(null);

  useEffect(() => {
    base44.entities.EmailCampaign.list('-created_date', 50)
      .then(campaigns => setCampaigns(campaigns || []))
      .catch(() => {});
  }, []);

  const applyQuickTemplate = (t) => {
    setSubject(t.subject.replace(/{{firstName}}/g, leadFirstName || ''));
    setBody(t.body.replace(/{{firstName}}/g, leadFirstName || ''));
  };

  const applyCampaign = (c) => {
    if (!c) { setSubject(''); return; }
    setSubject(c.name || c.templateLabel || '');
  };

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setStatus('');
    try {
      const res = await base44.functions.invoke('sendGmailEmail', {
        to: to.trim(),
        subject: subject.trim(),
        html: body.trim(),
        leadId,
        sentBy,
      });
      if (res?.error) throw new Error(res.error);
      setStatus('success');
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setStatus('error: ' + (e?.message || String(e)));
    }
    setSending(false);
  };

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }} onClick={onClose} />
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 500, maxHeight: '80vh', background: '#0d1b2a', border: `1px solid ${BLUE}55`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
        <div onMouseDown={onDragStart} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(96,165,250,0.08), transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📧</span>
            <div>
              <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>Send via Gmail</div>
              <div style={{ color: BLUE, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>One-press template send</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* Recipient */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>To (Recipient Email)</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@email.com" style={inp} />
          </div>

          {/* Quick templates */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Quick Templates</label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {QUICK_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => applyQuickTemplate(t)} style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: BLUE, cursor: 'pointer', fontSize: '11px' }}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Saved campaigns */}
          {campaigns.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Saved Campaign (fills subject)</label>
              <select value="" onChange={e => applyCampaign(campaigns.find(c => c.id === e.target.value))} style={inp}>
                <option value="">— Select a campaign —</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name} {c.templateLabel ? `(${c.templateLabel})` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Subject */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" style={inp} />
          </div>

          {/* Body */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Body (HTML)</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="<p>Your email content…</p>" style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
          </div>

          {/* Preview */}
          {body && (
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Preview</label>
              <div style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: body }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          {status === 'success' && <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>✓ Sent via Gmail!</span>}
          {status.startsWith('error') && <span style={{ color: '#ef4444', fontSize: '11px' }}>{status}</span>}
          {(!status || (status !== 'success' && !status.startsWith('error'))) && <span style={{ color: '#6b7280', fontSize: '10px' }}>Sends from your connected Gmail account</span>}
          <button onClick={send} disabled={sending || !to.trim() || !subject.trim() || !body.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '9px 24px', cursor: sending || !to.trim() || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: sending || !to.trim() || !subject.trim() || !body.trim() ? 0.5 : 1 }}>
            {sending ? '⏳ Sending…' : '📧 Send via Gmail'}
          </button>
        </div>
      </div>
    </>
  );
}