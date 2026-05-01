import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STATUS_COLOR = {
  sent:      '#60a5fa',
  delivered: '#4ade80',
  opened:    '#4ade80',
  clicked:   '#f59e0b',
  bounced:   '#ef4444',
  spam:      '#ef4444',
};
const STATUS_ICON = {
  sent: '📤', delivered: '✉️', opened: '📬', clicked: '🔗', bounced: '⚠️', spam: '🚫',
};

function fmtDT(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' });
}

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
  const [subject,  setSubject]  = useState('');
  const [body,     setBody]     = useState('');
  const [sending,  setSending]  = useState(false);
  const [sendMsg,  setSendMsg]  = useState('');
  const [logs,     setLogs]     = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [view,     setView]     = useState('compose'); // 'compose' | 'sent'
  const bodyRef = useRef(null);

  useEffect(() => { loadLogs(); }, [leadId, investorId]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      let results = [];
      if (leadId) {
        results = await base44.entities.EmailLog.filter({ leadId }).catch(() => []);
      } else if (investorId) {
        results = await base44.entities.EmailLog.filter({ investorId }).catch(() => []);
      }
      setLogs((results || []).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
    } catch {}
    setLoadingLogs(false);
  };

  const insertTag = (tag) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const newBody = body.slice(0, start) + tag + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + tag.length;
      el.focus();
    }, 0);
  };

  const wrapSelection = (before, after) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const selected = body.slice(start, end);
    const newBody = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      el.selectionStart = start + before.length;
      el.selectionEnd   = start + before.length + selected.length;
      el.focus();
    }, 0);
  };

  // Convert plain text with basic markdown-like formatting to HTML
  const buildHtml = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    const htmlLines = lines.map(line => {
      // Bold: **text**
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic: *text*
      line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Link: [text](url)
      line = line.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" style="color:#b8933a;">$1</a>');
      return line;
    });
    // Wrap paragraphs
    const paras = htmlLines.join('\n').split('\n\n').map(p =>
      `<p style="margin:0 0 12px;line-height:1.6;">${p.replace(/\n/g, '<br>')}</p>`
    );
    return `
      <div style="font-family:Georgia,serif;font-size:15px;color:#1a1a1a;max-width:600px;margin:0 auto;padding:32px 24px;">
        ${paras.join('')}
        <hr style="margin:28px 0;border:none;border-top:1px solid #e0d6c8;">
        <p style="font-size:12px;color:#888;margin:0;">
          Rosie AI LLC · <a href="https://investors.rosieai.tech" style="color:#b8933a;">investors.rosieai.tech</a>
        </p>
      </div>`;
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setSendMsg('⚠️ Subject and message body are required.');
      return;
    }
    if (!toEmail) {
      setSendMsg('⚠️ No email address on file for this contact.');
      return;
    }
    setSending(true); setSendMsg('');
    try {
      await base44.functions.invoke('sendCustomEmail', {
        leadId:     leadId     || null,
        investorId: investorId || null,
        toEmail,
        toName:     toName || '',
        subject:    subject.trim(),
        bodyHtml:   buildHtml(body),
        bodyText:   body,
        sentBy,
      });
      setSendMsg(`✅ Email sent to ${toEmail}`);
      setSubject('');
      setBody('');
      await loadLogs();
      onSent && onSent();
      setTimeout(() => setSendMsg(''), 5000);
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

          {/* To (read-only) */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>To</div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '9px 12px', color: toEmail ? '#e8e0d0' : '#4a5568', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>✉️</span>
              {toEmail ? (
                <span>{toName ? `${toName} <${toEmail}>` : toEmail}</span>
              ) : (
                <span style={{ color: '#ef4444' }}>⚠️ No email address on file</span>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>Subject</div>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Enter subject line…"
              style={inp}
            />
          </div>

          {/* Formatting toolbar */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <ToolBtn label="B" title="Bold — wrap selection with **text**" onClick={() => wrapSelection('**', '**')} />
            <ToolBtn label="I" title="Italic — wrap selection with *text*" onClick={() => wrapSelection('*', '*')} />
            <ToolBtn label="Link" title="Insert link — [text](url)" onClick={() => insertTag('[link text](https://)')} />
            <ToolBtn label="¶" title="New paragraph (blank line)" onClick={() => insertTag('\n\n')} />
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <ToolBtn label="{{firstname}}" title="Insert first name variable" onClick={() => insertTag(`${toName?.split(' ')[0] || 'there'}`)} />
            <ToolBtn label="Site Link" title="Insert investor site link" onClick={() => insertTag('[View Investment Details](https://investors.rosieai.tech)')} />
          </div>

          {/* Body */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>Message</div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={`Hi ${toName?.split(' ')[0] || 'there'},\n\n`}
              rows={10}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6, minHeight: '200px' }}
            />
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>
              Tip: use **bold**, *italic*, and [link](url) for formatting. A footer with your contact info is added automatically.
            </div>
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
              Sending as: <span style={{ color: GOLD }}>{sentBy}</span>
            </div>
          </div>

          {sendMsg && (
            <div style={{
              background: sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '4px', padding: '10px 14px',
              color: sendMsg.startsWith('✅') ? '#4ade80' : '#ef4444',
              fontSize: '13px',
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
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{si}</span>
                    <span style={{ color: sc, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{log.status}</span>
                    {log.subject && (
                      <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.subject}
                      </span>
                    )}
                    {log.templateId && log.templateId !== 'custom' && (
                      <span style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', fontSize: '9px', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>
                        Template #{log.templateId}
                      </span>
                    )}
                    {log.isCustomEmail && (
                      <span style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, fontSize: '9px', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>
                        Custom
                      </span>
                    )}
                    {log.isIntroEmail && (
                      <span style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', fontSize: '9px', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>
                        Intro
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0, marginLeft: '8px' }}>{fmtDT(log.sentAt)}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {log.sentBy && <span style={{ color: '#6b7280', fontSize: '10px' }}>by {log.sentBy}</span>}
                  {log.openedAt  && <span style={{ color: '#4ade80', fontSize: '10px' }}>📬 Opened {fmtDT(log.openedAt)}</span>}
                  {log.clickedAt && <span style={{ color: '#f59e0b', fontSize: '10px' }}>🔗 Clicked {fmtDT(log.clickedAt)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}