/**
 * FronterCredsEmailPopup.jsx — Popup to email company credentials to a lead.
 * Templates are database-backed (create/delete/edit). Supports inline image
 * embedding in the email body (multipart/related via cid: references).
 * Sends via connected Gmail. On send, marks credsSentAt and auto-graduates
 * prospects to lead status.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };

// Built-in defaults — seeded to the DB on first load, then fully editable/deletable
const DEFAULT_TEMPLATES = [
  {
    label: '🔑 Portal Access Credentials',
    subject: 'Your Portal Access Credentials',
    body: `<div style="font-family:Georgia,serif;font-size:14px;color:#333;">
<p>Hi {{firstName}},</p>
<p>Thank you for your interest. Here are your portal access credentials:</p>
<p><strong>Portal URL:</strong> https://rosieai-investorpage.base44.app/portal-login<br/>
<strong>Username:</strong> {{email}}</p>
<p>You will receive a separate email with your temporary password. Please log in and change your password upon first access.</p>
<p>Best regards,<br/>Rosie AI Team</p>
</div>`,
  },
  {
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
</div>`,
  },
  {
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
</div>`,
  },
  {
    label: '📨 Follow-Up — High Interest',
    subject: '{{firstName}}, ready to take the next step?',
    body: `<div style="font-family:Georgia,serif;font-size:14px;color:#333;">
<p>Hi {{firstName}},</p>
<p>I noticed you have been reviewing our resources, and I wanted to reach out personally. It looks like you are serious about taking control of your financial future, and I would love to help you get there.</p>
<p>I have a few questions about your situation and I think a quick 15-minute call would be the best way to see if we can help. We have helped thousands of people just like you reduce their debt and get back on track.</p>
<p>Check out what our clients are saying:<br/>
<a href="https://www.trustpilot.com/review/debtadvisorsofamerica.com">Read our Trustpilot Reviews</a><br/>
<a href="https://www.bbb.org/us/ca/san-diego/profile/debt-relief-services/debt-advisors-of-america-1126-1000064078">See our BBB Accreditation</a><br/>
<a href="https://www.debtadvisorsofamerica.com/">Visit Our Website</a></p>
<p>Are you available for a quick call today or tomorrow? Just reply to this email or give us a call and we will get you scheduled.</p>
<p>Best regards,<br/>Debt Advisors of America Team</p>
</div>`,
  },
];

function fillTemplate(text, lead, to) {
  const fillName = lead?.firstName || '';
  const fillEmail = lead?.email || to || '';
  return (text || '').replace(/{{firstName}}/g, fillName).replace(/{{email}}/g, fillEmail);
}

export default function FronterCredsEmailPopup({ lead, username, onClose, onSent }) {
  const [to, setTo] = useState(lead?.email || '');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [inlineImages, setInlineImages] = useState([]); // [{contentId, base64, mimeType}]
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ label: '', subject: '', body: '' });
  const [trackingEvents, setTrackingEvents] = useState([]);
  const [showTracking, setShowTracking] = useState(false);
  const imageInputRef = useRef(null);

  // Load templates from DB, seed defaults if empty
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const raw = await base44.entities.FronterEmailTemplate.list('sortOrder', 100);
      const all = Array.isArray(raw) ? raw : (raw?.items || []);
      if (all.length === 0) {
        // Seed defaults
        const seeded = await base44.entities.FronterEmailTemplate.bulkCreate(
          DEFAULT_TEMPLATES.map((t, i) => ({ ...t, sortOrder: i, isDefault: true }))
        );
        const seededArr = seeded?.records || seeded || [];
        setTemplates(Array.isArray(seededArr) ? seededArr : []);
      } else {
        setTemplates(all);
      }
    } catch (e) {
      // Fallback: use defaults in-memory
      setTemplates(DEFAULT_TEMPLATES.map((t, i) => ({ id: `default_${i}`, ...t, isDefault: true })));
    }
    setLoadingTemplates(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  // Load tracking events for this lead
  const loadTracking = async () => {
    if (!lead?.id) return;
    try {
      const events = await base44.entities.EmailTrackingEvent.filter({ leadId: lead.id }, '-trackedAt', 50);
      setTrackingEvents(Array.isArray(events) ? events : (events?.items || []));
    } catch { setTrackingEvents([]); }
  };

  useEffect(() => { loadTracking(); }, [lead?.id]);

  // Apply template when selection changes
  useEffect(() => {
    if (!selectedTemplateId || templates.length === 0) return;
    const t = templates.find(t => t.id === selectedTemplateId);
    if (t) {
      setSubject(fillTemplate(t.subject, lead, to));
      setBody(fillTemplate(t.body, lead, to));
      setInlineImages([]); // reset inline images on template switch
    }
  }, [selectedTemplateId, templates]);

  // Auto-select first template once loaded
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates]);

  // ── Inline image handling ──
  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB for inline embedding.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result; // data:image/png;base64,....
      const contentId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const mimeType = file.type || 'image/png';
      setInlineImages(prev => [...prev, { contentId, base64, mimeType }]);
      // Insert <img> at end of body
      const imgTag = `<img src="cid:${contentId}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;" />`;
      setBody(prev => (prev || '') + '\n' + imgTag);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset so same file can be picked again
  };

  const removeInlineImage = (contentId) => {
    setInlineImages(prev => prev.filter(i => i.contentId !== contentId));
    // Also strip the <img> tag from the body
    setBody(prev => (prev || '').replace(new RegExp(`<img[^>]*cid:${contentId}[^>]*>`, 'gi'), ''));
  };

  // Upload inline (cid:-referenced) images to public storage and replace
  // cid: references with permanent URLs so the template body is self-contained.
  const persistInlineImages = async (htmlBody) => {
    if (!inlineImages.length) return htmlBody;
    let result = htmlBody;
    for (const img of inlineImages) {
      try {
        const blob = await fetch(img.base64).then(r => r.blob());
        const ext = (img.mimeType || 'image/png').split('/')[1] || 'png';
        const file = new File([blob], `${img.contentId}.${ext}`, { type: img.mimeType });
        const res = await base44.integrations.Core.UploadPublicFile({ file });
        if (res?.file_url) {
          result = result.replace(new RegExp(`cid:${img.contentId}`, 'gi'), res.file_url);
        }
      } catch (e) { console.warn('Image upload failed:', e?.message || String(e)); }
    }
    return result;
  };

  // ── Template CRUD ──
  const createTemplate = async () => {
    if (!newTemplate.label.trim()) { alert('Template label is required.'); return; }
    try {
      const savedBody = await persistInlineImages(newTemplate.body.trim());
      const created = await base44.entities.FronterEmailTemplate.create({
        label: newTemplate.label.trim(),
        subject: newTemplate.subject.trim(),
        body: savedBody,
        sortOrder: templates.length,
        isDefault: false,
      });
      setTemplates(prev => [...prev, created]);
      setSelectedTemplateId(created.id);
      setNewTemplate({ label: '', subject: '', body: '' });
      setShowTemplateManager(false);
    } catch (e) { alert('Failed to create template: ' + (e?.message || String(e))); }
  };

  // Update the currently-selected template with the edited subject/body/images
  const [updating, setUpdating] = useState(false);
  const updateTemplate = async () => {
    if (!selectedTemplateId) { alert('Select a template to update.'); return; }
    const t = templates.find(x => x.id === selectedTemplateId);
    if (!t) return;
    if (!confirm(`Update template "${t.label}" with the current subject, body, and images?`)) return;
    setUpdating(true);
    try {
      const savedBody = await persistInlineImages(body.trim());
      await base44.entities.FronterEmailTemplate.update(selectedTemplateId, {
        subject: subject.trim(),
        body: savedBody,
      });
      setTemplates(prev => prev.map(x => x.id === selectedTemplateId ? { ...x, subject: subject.trim(), body: savedBody } : x));
      setBody(savedBody);
      setInlineImages([]);
      setStatus('template_saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) { alert('Failed to update template: ' + (e?.message || String(e))); }
    setUpdating(false);
  };

  const deleteTemplate = async (id) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`Delete template "${t.label}"? This cannot be undone.`)) return;
    try {
      await base44.entities.FronterEmailTemplate.delete(id);
      const remaining = templates.filter(x => x.id !== id);
      setTemplates(remaining);
      if (selectedTemplateId === id) {
        setSelectedTemplateId(remaining[0]?.id || '');
      }
    } catch (e) { alert('Failed to delete: ' + (e?.message || String(e))); }
  };

  // ── Send ──
  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setStatus('');
    try {
      const res = await base44.functions.invoke('sendGmailEmail', {
        to: to.trim(),
        subject: subject.trim(),
        html: body.trim(),
        leadId: lead?.id,
        sentBy: username,
        inlineImages: inlineImages.map(({ contentId, base64, mimeType }) => ({ contentId, base64, mimeType })),
      });
      if (res?.error) throw new Error(res.error);

      const now = new Date().toISOString();
      const templateLabel = templates.find(t => t.id === selectedTemplateId)?.label || selectedTemplateId;
      const updates = {
        credsSentAt: now,
        credsSentTemplate: templateLabel,
      };
      if (lead?.status === 'prospect') {
        updates.status = 'lead';
      }
      try {
        const log = JSON.parse(lead?.notesLogJson || '[]');
        log.push({ text: `🔑 Company credentials emailed to ${to.trim()} (${templateLabel})`, timestamp: now, author: username, type: 'creds' });
        updates.notesLogJson = JSON.stringify(log);
      } catch {}

      await base44.entities.FronterLead.update(lead.id, updates);

      setStatus('success');
      setTimeout(() => { onSent?.({ ...updates, email: to.trim() }); }, 1000);
    } catch (e) {
      setStatus('error: ' + (e?.message || String(e)));
    }
    setSending(false);
  };

  return (
    <FronterPopup title="🔑 Email Company Credentials" subtitle="Sends from connected Gmail · auto-graduates to lead" accent={BLUE} onClose={onClose} initialSize={{ w: 560, h: 640 }} minW={400} minH={320} zIndex={10060}>
      <div style={{ padding: '16px' }}>
          {/* Recipient */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Customer Email {lead?.email ? '(auto-filled from contact card)' : '(enter email)'}</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="customer@email.com" style={inp} />
          </div>

          {/* Template selector + manage button */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
              <label style={{ ...ls, marginBottom: 0 }}>Credential Template</label>
              <button onClick={() => setShowTemplateManager(p => !p)} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{showTemplateManager ? '✕ Close Manager' : '⚙ Manage Templates'}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} style={{ ...inp, flex: 1 }} disabled={loadingTemplates}>
                <option value="">{loadingTemplates ? 'Loading…' : '— Select a template —'}</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <button onClick={updateTemplate} disabled={!selectedTemplateId || updating} title="Save current subject, body, and inline images back to this template" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '3px', padding: '7px 12px', cursor: !selectedTemplateId || updating ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '6px', opacity: !selectedTemplateId || updating ? 0.5 : 1 }}>{updating ? '⏳' : '💾 Save to Template'}</button>
            </div>
          </div>

          {/* Template manager — create new / delete existing */}
          {showTemplateManager && (
            <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(96,165,250,0.05)', border: `1px solid ${BLUE}33`, borderRadius: '6px' }}>
              {/* Existing templates with delete buttons */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ ...ls, color: BLUE }}>Existing Templates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                  {templates.length === 0 && <span style={{ color: '#6b7280', fontSize: '11px' }}>No templates yet.</span>}
                  {templates.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#e8e0d0', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.label}</span>
                      <button onClick={() => deleteTemplate(t.id)} title="Delete template" style={{ background: 'rgba(239,68,68,0.12)', color: RED, border: `1px solid ${RED}33`, borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', marginLeft: '8px', flexShrink: 0 }}>🗑 Delete</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create new template */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                <div style={{ ...ls, color: BLUE, marginBottom: '6px' }}>+ Create New Template</div>
                <div style={{ marginBottom: '6px' }}><input value={newTemplate.label} onChange={e => setNewTemplate(p => ({ ...p, label: e.target.value }))} placeholder="Template label (e.g. 🔑 Password Reset)" style={inp} /></div>
                <div style={{ marginBottom: '6px' }}><input value={newTemplate.subject} onChange={e => setNewTemplate(p => ({ ...p, subject: e.target.value }))} placeholder="Default subject" style={inp} /></div>
                <div style={{ marginBottom: '6px' }}><textarea value={newTemplate.body} onChange={e => setNewTemplate(p => ({ ...p, body: e.target.value }))} rows={5} placeholder="Email body (HTML). Use {{firstName}} and {{email}} for merge fields." style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} /></div>
                <button onClick={createTemplate} disabled={!newTemplate.label.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '7px 18px', cursor: newTemplate.label.trim() ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', opacity: newTemplate.label.trim() ? 1 : 0.5 }}>+ Create Template</button>
              </div>
            </div>
          )}

          {/* Subject */}
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" style={inp} />
          </div>

          {/* Body + insert image button */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
              <label style={{ ...ls, marginBottom: 0 }}>Body (HTML — editable)</label>
              <button onClick={() => imageInputRef.current?.click()} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>🖼 Insert Image</button>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
          </div>

          {/* Inline images list */}
          {inlineImages.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Inline Images ({inlineImages.length})</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {inlineImages.map(img => (
                  <div key={img.contentId} style={{ position: 'relative', width: '60px', height: '60px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
                    <img src={img.base64} alt={img.contentId} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => removeInlineImage(img.contentId)} title="Remove image" style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: RED, border: 'none', borderRadius: '0 0 0 3px', cursor: 'pointer', fontSize: '12px', padding: '1px 5px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {body && (
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Preview</label>
              <div style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: body }} />
            </div>
          )}

          {/* Tracking status */}
          {lead?.id && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ ...ls, marginBottom: 0 }}>📊 Email Tracking</label>
                <button onClick={() => { setShowTracking(p => !p); if (!showTracking) loadTracking(); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>{showTracking ? '✕ Hide' : '↻ Show'} Tracking</button>
              </div>
              {showTracking && (
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                  {trackingEvents.length === 0 ? (
                    <span style={{ color: '#6b7280', fontSize: '11px' }}>No tracking events yet. Events appear here when the customer opens the email or clicks a link.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {trackingEvents.map((ev, i) => (
                        <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', fontSize: '11px' }}>
                          <span style={{ fontSize: '14px', flexShrink: 0 }}>{ev.eventType === 'open' ? '👁️' : '🖱️'}</span>
                          <span style={{ color: ev.eventType === 'open' ? GOLD : BLUE, fontWeight: 'bold', flexShrink: 0, textTransform: 'capitalize' }}>{ev.eventType}</span>
                          {ev.url && <span style={{ color: '#8a9ab8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ev.url}</span>}
                          <span style={{ color: '#6b7280', fontSize: '10px', flexShrink: 0, marginLeft: 'auto' }}>{new Date(ev.trackedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        {status === 'success' && <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>✓ Credentials sent! Lead graduated.</span>}
        {status === 'template_saved' && <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>✓ Template updated!</span>}
        {status.startsWith('error') && <span style={{ color: '#ef4444', fontSize: '11px' }}>{status}</span>}
        {!status && <span style={{ color: '#6b7280', fontSize: '10px' }}>Sending credentials auto-graduates prospect to lead</span>}
        <button onClick={send} disabled={sending || !to.trim() || !subject.trim() || !body.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '9px 24px', cursor: sending || !to.trim() || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: sending || !to.trim() || !subject.trim() || !body.trim() ? 0.5 : 1, marginLeft: 'auto' }}>
          {sending ? '⏳ Sending…' : '🔑 Send Credentials'}
        </button>
      </div>
    </FronterPopup>
  );
}