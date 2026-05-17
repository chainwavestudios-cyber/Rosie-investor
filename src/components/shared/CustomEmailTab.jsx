import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fmtDateTime } from '@/lib/fmtDate.js';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STATUS_COLOR = {
  sent: '#60a5fa', delivered: '#4ade80', opened: '#4ade80',
  clicked: '#f59e0b', bounced: '#ef4444', spam: '#ef4444',
};
const STATUS_ICON = {
  sent: '📤', delivered: '✉️', opened: '📬', clicked: '🔗', bounced: '⚠️', spam: '🚫',
};

const SENDER_OPTIONS = [
  { email: 'investors@rosieai.tech',   name: 'Rosie AI Investors',         label: 'investors@rosieai.tech' },
  { email: 'irnightowl@nbtecha.com',   name: 'NightOwl IR',                label: 'irnightowl@nbtecha.com' },
];

const TEMPLATES = [
  { id: 'blank', label: '— Blank —' },
  { id: 'nb_tech_dataroom', label: '💡 NB Tech Data Room' },
];

const NB_TECH_SUBJECT = 'Newport Beach Tech & NightOwl Pre IPO';
const NB_TECH_BODY = (firstname, dataroomUrl) =>
`Hi ${firstname},

Welcome! We excited to share access to our NB Tech Acquisitions Corp. dataroom with you.

This has all the details on the upcoming IPO in our pitch deck!

You can access it here:

[Access the Data Room](${dataroomUrl || 'https://investor-portal.nbtechacquisitions.com/dataroom/17a3be5d-75db-4c92-b74b-8fad6ed79c0d'})

Let us know if you have any questions!

Best Regards,
Stephanie
Investor Relations
1-949-596-3970`;

const fmtDT = (iso) => fmtDateTime(iso);

/**
 * CustomEmailTab
 * Props:
 *   toEmail      — recipient email
 *   toName       — recipient name
 *   leadId       — string | null
 *   investorId   — string | null
 *   sentBy       — current admin username
 *   onSent       — optional callback after send
 */
export default function CustomEmailTab({ toEmail, toName, leadId, investorId, sentBy = 'admin', onSent }) {
  const [subject,       setSubject]       = useState('');
  const [body,          setBody]          = useState('');
  const [sending,       setSending]       = useState(false);
  const [sendMsg,       setSendMsg]       = useState('');
  const [logs,          setLogs]          = useState([]);
  const [loadingLogs,   setLoadingLogs]   = useState(true);
  const [view,          setView]          = useState('compose');
  const [selectedSender, setSelectedSender] = useState(SENDER_OPTIONS[0]);
  const [template,      setTemplate]      = useState('blank');
  const [dataroomUrl,   setDataroomUrl]   = useState('');
  const [attachments,   setAttachments]   = useState([]); // [{name, base64, mime}]
  const [uploadingFile, setUploadingFile] = useState(false);
  const bodyRef    = useRef(null);
  const fileRef    = useRef(null);

  const firstName = toName?.split(' ')[0] || 'there';

  useEffect(() => { loadLogs(); }, [leadId, investorId]);

  // Re-render NB Tech body when dataroomUrl changes
  useEffect(() => {
    if (template === 'nb_tech_dataroom') {
      setBody(NB_TECH_BODY(firstName, dataroomUrl));
    }
  }, [dataroomUrl, template]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      let results = [];
      if (leadId)      results = await base44.entities.EmailLog.filter({ leadId }).catch(() => []);
      else if (investorId) results = await base44.entities.EmailLog.filter({ investorId }).catch(() => []);
      setLogs((results || []).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
    } catch {}
    setLoadingLogs(false);
  };

  const applyTemplate = (id) => {
    setTemplate(id);
    if (id === 'nb_tech_dataroom') {
      setSelectedSender(SENDER_OPTIONS[1]); // irnightowl
      setSubject(NB_TECH_SUBJECT);
      setBody(NB_TECH_BODY(firstName, dataroomUrl));
    } else {
      setSubject('');
      setBody('');
    }
  };

  const insertTag = (tag) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const newBody = body.slice(0, start) + tag + body.slice(end);
    setBody(newBody);
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + tag.length; el.focus(); }, 0);
  };

  const wrapSelection = (before, after) => {
    const el = bodyRef.current;
    if (!el) return;
    const start    = el.selectionStart;
    const end      = el.selectionEnd;
    const selected = body.slice(start, end);
    const newBody  = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      el.selectionStart = start + before.length;
      el.selectionEnd   = start + before.length + selected.length;
      el.focus();
    }, 0);
  };

  // Convert plain text with markdown-like formatting to HTML
  const buildHtml = (text, fromEmail) => {
    if (!text) return '';
    const lines = text.split('\n');
    const htmlLines = lines.map(line => {
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Tracked link — wrap in redirect for click tracking via Mailjet
      line = line.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" style="color:#b8933a;">$1</a>');
      return line;
    });
    const paras = htmlLines.join('\n').split('\n\n').map(p =>
      `<p style="margin:0 0 12px;line-height:1.6;">${p.replace(/\n/g, '<br>')}</p>`
    );
    const footerDomain = fromEmail?.includes('nbtecha') ? 'nbtechacquisitions.com' : 'investors.rosieai.tech';
    const footerLink   = fromEmail?.includes('nbtecha') ? 'https://investor-portal.nbtechacquisitions.com' : 'https://investors.rosieai.tech';
    return `
      <div style="font-family:Georgia,serif;font-size:15px;color:#1a1a1a;max-width:600px;margin:0 auto;padding:32px 24px;">
        ${paras.join('')}
        <hr style="margin:28px 0;border:none;border-top:1px solid #e0d6c8;">
        <p style="font-size:12px;color:#888;margin:0;">
          <a href="${footerLink}" style="color:#b8933a;">${footerDomain}</a>
        </p>
      </div>`;
  };

  const handleAttachFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFile(true);
    for (const file of files) {
      const reader = new FileReader();
      await new Promise(resolve => {
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          setAttachments(prev => [...prev, { name: file.name, base64, mime: file.type }]);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const removeAttachment = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setSendMsg('⚠️ Subject and message body are required.'); return; }
    if (!toEmail) { setSendMsg('⚠️ No email address on file for this contact.'); return; }
    setSending(true); setSendMsg('');
    try {
      await base44.functions.invoke('sendCustomEmail', {
        leadId:      leadId     || null,
        investorId:  investorId || null,
        toEmail,
        toName:      toName || '',
        subject:     subject.trim(),
        bodyHtml:    buildHtml(body, selectedSender.email),
        bodyText:    body,
        sentBy,
        fromEmail:   selectedSender.email,
        fromName:    selectedSender.name,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setSendMsg(`✅ Email sent to ${toEmail} via ${selectedSender.email}`);
      setSubject('');
      setBody('');
      setAttachments([]);
      setTemplate('blank');
      setDataroomUrl('');
      await loadLogs();
      onSent && onSent();
      setTimeout(() => setSendMsg(''), 6000);
    } catch (e) {
      setSendMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSending(false);
  };

  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '4px', padding: '9px 12px', color: '#e8e0d0', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif',
  };

  const ToolBtn = ({ label, onClick, title }) => (
    <button onClick={onClick} title={title}
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', color: '#c4cdd8', fontSize: '11px', fontFamily: 'monospace' }}>
      {label}
    </button>
  );

  return (
    <div style={{ fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '16px', flexShrink: 0 }}>
        {[['compose', '✏️ Compose'], ['sent', `📬 Sent (${logs.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{ background: 'none', border: 'none', borderBottom: view === id ? `2px solid ${GOLD}` : '2px solid transparent', color: view === id ? GOLD : '#6b7280', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── COMPOSE ── */}
      {view === 'compose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Template selector */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>Template</div>
            <select value={template} onChange={e => applyTemplate(e.target.value)}
              style={{ ...inp, cursor: 'pointer', colorScheme: 'dark' }}>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* From sender */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>From</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {SENDER_OPTIONS.map(s => (
                <button key={s.email} onClick={() => setSelectedSender(s)}
                  style={{
                    background: selectedSender.email === s.email ? 'rgba(184,147,58,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedSender.email === s.email ? 'rgba(184,147,58,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedSender.email === s.email ? GOLD : '#6b7280',
                    borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px',
                    fontFamily: 'monospace', fontWeight: selectedSender.email === s.email ? 'bold' : 'normal',
                  }}>
                  {s.email}
                </button>
              ))}
            </div>
          </div>

          {/* To */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>To</div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '9px 12px', color: toEmail ? '#e8e0d0' : '#4a5568', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>✉️</span>
              {toEmail ? <span>{toName ? `${toName} <${toEmail}>` : toEmail}</span> : <span style={{ color: '#ef4444' }}>⚠️ No email address on file</span>}
            </div>
          </div>

          {/* Subject */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>Subject</div>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter subject line…" style={inp} spellCheck />
          </div>

          {/* NB Tech Data Room URL field */}
          {template === 'nb_tech_dataroom' && (
            <div>
              <div style={{ color: '#818cf8', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>💡 Data Room URL (auto-populates in email)</div>
              <input
                value={dataroomUrl}
                onChange={e => setDataroomUrl(e.target.value)}
                placeholder="Paste the unique data room URL here…"
                style={{ ...inp, borderColor: 'rgba(129,140,248,0.4)', background: 'rgba(99,102,241,0.06)' }}
                spellCheck={false}
              />
              <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>Leave blank to use the default data room URL.</div>
            </div>
          )}

          {/* Formatting toolbar */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <ToolBtn label="B" title="Bold — wrap selection with **text**" onClick={() => wrapSelection('**', '**')} />
            <ToolBtn label="I" title="Italic — wrap selection with *text*" onClick={() => wrapSelection('*', '*')} />
            <ToolBtn label="Link" title="Insert link — [text](url)" onClick={() => insertTag('[link text](https://)')} />
            <ToolBtn label="¶" title="New paragraph" onClick={() => insertTag('\n\n')} />
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <ToolBtn label="{{firstname}}" title="Insert first name" onClick={() => insertTag(firstName)} />
            <ToolBtn label="Site Link" title="Insert investor site link" onClick={() => insertTag('[View Investment Details](https://investors.rosieai.tech)')} />
          </div>

          {/* Body */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>Message</div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={`Hi ${firstName},\n\n`}
              rows={12}
              spellCheck
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6, minHeight: '220px' }}
            />
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>
              Tip: use **bold**, *italic*, and [link](url) for formatting. Spell check is enabled. Links are tracked automatically.
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Attachments</div>
            <input ref={fileRef} type="file" multiple onChange={handleAttachFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploadingFile}
              style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', fontSize: '11px' }}>
              {uploadingFile ? '⏳ Reading…' : '📎 Add Attachment'}
            </button>
            {attachments.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {attachments.map((a, i) => (
                  <div key={i} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#60a5fa' }}>
                    📎 {a.name}
                    <button onClick={() => removeAttachment(i)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send button */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingTop: '4px' }}>
            <button
              onClick={handleSend}
              disabled={sending || !toEmail || !subject.trim() || !body.trim()}
              style={{
                background: (sending || !toEmail || !subject.trim() || !body.trim())
                  ? 'rgba(184,147,58,0.2)'
                  : 'linear-gradient(135deg,#b8933a,#d4aa50)',
                color: DARK, border: 'none', borderRadius: '4px',
                padding: '11px 28px', cursor: (sending || !toEmail) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase',
              }}>
              {sending ? '⏳ Sending…' : '✉️ Send Email'}
            </button>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              via <span style={{ color: GOLD, fontFamily: 'monospace' }}>{selectedSender.email}</span>
            </div>
          </div>

          {sendMsg && (
            <div style={{
              background: sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '4px', padding: '10px 14px',
              color: sendMsg.startsWith('✅') ? '#4ade80' : '#ef4444', fontSize: '13px',
            }}>
              {sendMsg}
            </div>
          )}
        </div>
      )}

      {/* ── SENT ── */}
      {view === 'sent' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingLogs && <div style={{ color: '#6b7280', textAlign: 'center', padding: '32px' }}>Loading…</div>}
          {!loadingLogs && logs.length === 0 && (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>✉️</div>
              No emails sent yet.
            </div>
          )}
          {logs.map((log, i) => {
            const sc = STATUS_COLOR[log.status] || '#8a9ab8';
            const si = STATUS_ICON[log.status]  || '✉️';
            return (
              <div key={log.id || i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '12px 14px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{si}</span>
                    <span style={{ color: sc, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{log.status}</span>
                    {log.subject && <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject}</span>}
                    {log.fromEmail && <span style={{ background: 'rgba(184,147,58,0.1)', color: GOLD, fontSize: '9px', padding: '1px 6px', borderRadius: '3px', fontFamily: 'monospace', flexShrink: 0 }}>{log.fromEmail}</span>}
                    {log.isCustomEmail && <span style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, fontSize: '9px', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>Custom</span>}
                    {log.isIntroEmail  && <span style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', fontSize: '9px', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>Intro</span>}
                    {log.templateId && log.templateId !== 'custom' && <span style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', fontSize: '9px', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>Template #{log.templateId}</span>}
                  </div>
                  <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0, marginLeft: '8px' }}>{fmtDT(log.sentAt)}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {log.sentBy    && <span style={{ color: '#6b7280', fontSize: '10px' }}>by {log.sentBy}</span>}
                  {log.openedAt  && <span style={{ color: '#4ade80', fontSize: '10px' }}>📬 Opened {fmtDT(log.openedAt)}</span>}
                  {log.clickedAt && <span style={{ color: '#f59e0b', fontSize: '10px' }}>🔗 Clicked {fmtDT(log.clickedAt)}</span>}
                  {log.clickedUrl && <span style={{ color: '#60a5fa', fontSize: '10px', wordBreak: 'break-all' }}>↗ {log.clickedUrl.slice(0, 60)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}