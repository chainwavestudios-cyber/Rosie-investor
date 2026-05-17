import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const OUR_NUMBER = '+19495963970';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * SmsTab — reusable SMS conversation component
 * Props:
 *   toPhone      — contact's phone number
 *   toName       — contact's display name
 *   leadId       — string | null
 *   investorId   — string | null
 *   sentBy       — current admin identifier
 */
export default function SmsTab({ toPhone, toName, leadId, investorId, sentBy = 'admin' }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]); // [{name, url, mime}]
  const [uploadingFile, setUploadingFile] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadMessages();
    // Poll every 8 seconds for new inbound messages
    pollRef.current = setInterval(loadMessages, 8000);
    return () => clearInterval(pollRef.current);
  }, [leadId, investorId, toPhone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      let msgs = [];
      if (leadId) {
        msgs = await base44.entities.SmsMessage.filter({ leadId }).catch(() => []);
      } else if (investorId) {
        msgs = await base44.entities.SmsMessage.filter({ investorId }).catch(() => []);
      } else if (toPhone) {
        // Fallback: match by phone
        const norm = toPhone.replace(/\D/g, '').slice(-10);
        const all = await base44.entities.SmsMessage.list('-sentAt', 200).catch(() => []);
        msgs = all.filter(m => {
          const from = (m.fromNumber || '').replace(/\D/g, '').slice(-10);
          const to   = (m.toNumber   || '').replace(/\D/g, '').slice(-10);
          return from === norm || to === norm;
        });
      }
      msgs.sort((a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0));
      setMessages(msgs);
      // Mark inbound unread as read
      const unread = msgs.filter(m => m.direction === 'inbound' && !m.read);
      await Promise.all(unread.map(m => base44.entities.SmsMessage.update(m.id, { read: true }).catch(() => {})));
    } catch {}
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFile(true);
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setMediaFiles(prev => [...prev, { name: file.name, url: file_url, mime: file.type }]);
      } catch {}
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!body.trim() && mediaFiles.length === 0) return;
    if (!toPhone) { setSendMsg('⚠️ No phone number available.'); return; }
    setSending(true); setSendMsg('');
    try {
      await base44.functions.invoke('sendSms', {
        to: toPhone,
        body: body.trim(),
        mediaUrls: mediaFiles.map(f => f.url),
        leadId: leadId || null,
        investorId: investorId || null,
        contactName: toName || null,
      });
      setBody('');
      setMediaFiles([]);
      await loadMessages();
    } catch (e) {
      setSendMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSending(false);
  };

  const inp = { flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '6px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif', resize: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px' }}>
      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: '32px' }}>Loading…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>💬</div>
            <div>No messages yet.</div>
            <div style={{ fontSize: '11px', marginTop: '6px', color: '#374151' }}>Messages will appear here when sent or received.</div>
          </div>
        )}
        {messages.map((msg) => {
          const isOutbound = msg.direction === 'outbound';
          const mediaList = (() => { try { return JSON.parse(msg.mediaUrls || '[]'); } catch { return []; } })();
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOutbound ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%',
                background: isOutbound ? `linear-gradient(135deg,${GOLD}33,${GOLD}1a)` : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isOutbound ? `${GOLD}55` : 'rgba(255,255,255,0.1)'}`,
                borderRadius: isOutbound ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '9px 14px',
              }}>
                {msg.body && (
                  <div style={{ color: '#e8e0d0', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                )}
                {mediaList.map((url, i) => (
                  <div key={i} style={{ marginTop: '6px' }}>
                    {/image/i.test(url) || /\.(jpg|jpeg|png|gif|webp)/i.test(url) ? (
                      <img src={url} alt="attachment" style={{ maxWidth: '200px', borderRadius: '6px', display: 'block' }} />
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#60a5fa', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📎 Attachment
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px' }}>
                {isOutbound && msg.sentBy && <span style={{ color: '#4a5568', fontSize: '9px' }}>{msg.sentBy}</span>}
                <span style={{ color: '#4a5568', fontSize: '9px' }}>{fmtTime(msg.sentAt)}</span>
                {isOutbound && (
                  <span style={{ fontSize: '9px', color: msg.status === 'delivered' ? '#4ade80' : msg.status === 'failed' ? '#ef4444' : '#6b7280' }}>
                    {msg.status === 'delivered' ? '✓✓' : msg.status === 'sent' ? '✓' : msg.status === 'failed' ? '✗' : '⏳'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Attached files preview */}
      {mediaFiles.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {mediaFiles.map((f, i) => (
            <div key={i} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '4px 10px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: '#60a5fa' }}>
              📎 {f.name}
              <button onClick={() => setMediaFiles(prev => prev.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Compose bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        {!toPhone && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 12px', color: '#ef4444', fontSize: '12px' }}>
            ⚠️ No phone number on file for this contact.
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${toName || toPhone || ''}…`}
            rows={2}
            style={inp}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
            <input ref={fileRef} type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploadingFile}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', cursor: 'pointer', color: '#8a9ab8', fontSize: '13px' }}
              title="Attach file">
              {uploadingFile ? '⏳' : '📎'}
            </button>
            <button onClick={handleSend} disabled={sending || (!body.trim() && mediaFiles.length === 0) || !toPhone}
              style={{
                background: (sending || (!body.trim() && mediaFiles.length === 0) || !toPhone) ? 'rgba(184,147,58,0.2)' : `linear-gradient(135deg,${GOLD},#d4aa50)`,
                color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap'
              }}>
              {sending ? '⏳' : '▶'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#4a5568', fontSize: '10px' }}>
            From: <span style={{ color: GOLD, fontFamily: 'monospace' }}>{OUR_NUMBER}</span> · Press Enter to send, Shift+Enter for new line
          </div>
          {sendMsg && <div style={{ color: sendMsg.startsWith('⚠️') || sendMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize: '11px' }}>{sendMsg}</div>}
        </div>
      </div>
    </div>
  );
}