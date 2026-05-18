/**
 * AdminChatWindow.jsx
 * Private chat between admin and steph — draggable, resizable, minimizable.
 * Supports: text, emoji, animated GIFs, file uploads, voice messages, lead tags, alerts, delete messages.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#060c18';
const CHAT_USERS = ['admin', 'steph'];

// Common emojis
const EMOJI_LIST = ['😀','😂','😍','🤔','👍','👎','🔥','💰','📞','✅','❌','⚡','🎯','💡','🚀','😎','🤝','💪','👀','🙏','😅','🤣','😊','🥳','😤','🤦','😴','💯','🎉','⚠️'];

// Tenor GIF search via public API (no key needed for limited usage)
async function searchGifs(query) {
  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPzkcFUIlzPPkDPY&limit=12&media_filter=gif`);
    const data = await res.json();
    return (data.results || []).map(r => ({
      id: r.id,
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
    })).filter(g => g.url);
  } catch { return []; }
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminChatWindow({ currentUsername, onOpenLeadCard, onOpenInvestorCard, onClose }) {
  const isAllowed = CHAT_USERS.includes(currentUsername);

  // Window state
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 400, y: window.innerHeight - 520 });
  const [size, setSize] = useState({ w: 380, h: 480 });
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagResults, setTagResults] = useState([]);
  const [tagLoading, setTagLoading] = useState(false);
  const scrollRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 200);
      setMessages((msgs || []).reverse());
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAllowed) return;
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [isAllowed, loadMessages]);

  useEffect(() => {
    if (scrollRef.current && !minimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, minimized]);

  // Drag
  const onDragStart = (e) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: Math.max(0, e.clientX - dragOffset.current.x), y: Math.max(0, e.clientY - dragOffset.current.y) });
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Resize
  const onResizeStart = (e) => { e.stopPropagation(); resizing.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }; };
  useEffect(() => {
    const onMove = (e) => {
      if (!resizing.current) return;
      const newW = Math.max(300, resizing.current.w + (e.clientX - resizing.current.x));
      const newH = Math.max(360, resizing.current.h + (e.clientY - resizing.current.y));
      setSize({ w: newW, h: newH });
    };
    const onUp = () => { resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const sendMessage = async (overrideContent, overrideType, extra = {}) => {
    const content = overrideContent ?? input.trim();
    const type = overrideType ?? 'text';
    if (!content && type === 'text') return;
    setSending(true);
    try {
      await base44.entities.AdminChat.create({
        sender: currentUsername,
        type,
        content: content || '',
        sentAt: new Date().toISOString(),
        ...extra,
      });
      setInput('');
      setShowEmoji(false);
      setShowGif(false);
      await loadMessages();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const sendAlert = async () => {
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      await base44.entities.AdminChat.create({
        sender: currentUsername,
        type: 'alert',
        content,
        isAlert: true,
        alertDismissedBy: '[]',
        sentAt: new Date().toISOString(),
      });
      setInput('');
      await loadMessages();
    } catch {}
    setSending(false);
  };

  const deleteMessage = async (id) => {
    try {
      await base44.entities.AdminChat.delete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  const clearAllChat = async () => {
    if (!window.confirm('Delete all chat history? This cannot be undone.')) return;
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 500);
      await Promise.all((msgs || []).map(m => base44.entities.AdminChat.delete(m.id)));
      setMessages([]);
    } catch {}
  };

  // GIF
  const handleGifSearch = async (q) => {
    setGifQuery(q);
    if (!q.trim()) { setGifs([]); return; }
    setGifLoading(true);
    const results = await searchGifs(q);
    setGifs(results);
    setGifLoading(false);
  };

  const sendGif = async (url) => {
    await sendMessage(url, 'gif', { fileUrl: url });
    setShowGif(false);
  };

  // File upload
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await sendMessage(file.name, 'file', { fileUrl: file_url, fileName: file.name, fileType: file.type });
    } catch {}
    setUploading(false);
    e.target.value = '';
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        setUploading(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          await sendMessage('🎙 Voice message', 'voice', { fileUrl: file_url, fileName: file.name, fileType: 'audio/webm' });
        } catch {}
        setUploading(false);
      };
      mediaRecorder.current.start();
      setRecording(true);
    } catch {}
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  // Tag lead/investor search
  const handleTagSearch = async (q) => {
    setTagSearch(q);
    if (!q.trim()) { setTagResults([]); return; }
    setTagLoading(true);
    try {
      const [leads, investors] = await Promise.all([
        base44.entities.Lead.list('-created_date', 50),
        base44.entities.InvestorUser.list('-created_date', 50),
      ]);
      const lq = q.toLowerCase();
      const matchedLeads = (leads || []).filter(l => `${l.firstName} ${l.lastName}`.toLowerCase().includes(lq)).slice(0, 5).map(l => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, type: 'lead' }));
      const matchedInvestors = (investors || []).filter(u => (u.name || '').toLowerCase().includes(lq)).slice(0, 5).map(u => ({ id: u.id, name: u.name, type: 'investor' }));
      setTagResults([...matchedLeads, ...matchedInvestors]);
    } catch {}
    setTagLoading(false);
  };

  const sendTaggedMessage = async (contact) => {
    const content = `@${contact.name}`;
    await sendMessage(content, 'text', { taggedLeadId: contact.id, taggedLeadName: contact.name, taggedLeadType: contact.type });
    setShowTagMenu(false);
    setTagSearch('');
    setTagResults([]);
  };

  const handleTaggedClick = (msg) => {
    if (!msg.taggedLeadId) return;
    if (msg.taggedLeadType === 'lead') onOpenLeadCard?.(msg.taggedLeadId);
    else onOpenInvestorCard?.(msg.taggedLeadId);
  };

  if (!isAllowed) return null;

  const otherUser = currentUsername === 'admin' ? 'steph' : 'admin';

  // Group messages by day
  const grouped = [];
  let lastDay = null;
  messages.forEach(msg => {
    const day = fmtDay(msg.sentAt);
    if (day !== lastDay) { grouped.push({ type: 'day', label: day }); lastDay = day; }
    grouped.push({ type: 'msg', msg });
  });

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: minimized ? 220 : size.w,
        height: minimized ? 40 : size.h,
        zIndex: 8000,
        background: '#0a1525',
        border: `1px solid rgba(184,147,58,0.4)`,
        borderRadius: '8px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        minWidth: minimized ? 0 : 300,
      }}
    >
      {/* Header / drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{
          background: 'linear-gradient(90deg, #0d1b2a, #121c2e)',
          borderBottom: minimized ? 'none' : '1px solid rgba(184,147,58,0.2)',
          padding: '0 10px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'grab',
          flexShrink: 0,
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
        <span style={{ color: GOLD, fontSize: '11px', letterSpacing: '1px', fontFamily: 'Georgia,serif', flex: 1 }}>
          💬 {currentUsername} ↔ {otherUser}
        </span>
        <button onClick={() => setMinimized(v => !v)}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px', padding: '0 4px', lineHeight: 1 }}>
          {minimized ? '▲' : '▼'}
        </button>
        <button onClick={clearAllChat}
          title="Clear all chat history"
          style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '11px', padding: '0 4px' }}>
          🗑
        </button>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>
          ×
        </button>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {grouped.map((item, i) => {
              if (item.type === 'day') return (
                <div key={`d-${i}`} style={{ textAlign: 'center', color: '#4a5568', fontSize: '10px', margin: '8px 0 4px', letterSpacing: '1px' }}>{item.label}</div>
              );
              const msg = item.msg;
              const isMe = msg.sender === currentUsername;
              return (
                <div key={msg.id} className="chat-msg-row" style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '3px', position: 'relative' }}>
                  <div style={{ maxWidth: '80%', position: 'relative' }}>
                    {/* Sender label */}
                    {!isMe && <div style={{ color: '#4a5568', fontSize: '9px', marginBottom: '2px', paddingLeft: '2px' }}>{msg.sender}</div>}

                    <div style={{
                      padding: msg.type === 'gif' ? '4px' : '7px 10px',
                      borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                      background: msg.isAlert ? 'rgba(239,68,68,0.15)' : isMe ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.06)',
                      border: msg.isAlert ? '1px solid rgba(239,68,68,0.4)' : `1px solid ${isMe ? 'rgba(184,147,58,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      fontSize: '13px',
                      color: '#e8e0d0',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}>
                      {msg.isAlert && <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', marginBottom: '3px', letterSpacing: '1px' }}>🚨 ALERT</div>}

                      {msg.type === 'text' && msg.taggedLeadId ? (
                        <span
                          onClick={() => handleTaggedClick(msg)}
                          style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                          title={`Open ${msg.taggedLeadType} card`}
                        >
                          @{msg.taggedLeadName}
                          <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '4px' }}>({msg.taggedLeadType})</span>
                        </span>
                      ) : msg.type === 'text' ? (
                        <span>{msg.content}</span>
                      ) : msg.type === 'gif' ? (
                        <img src={msg.fileUrl || msg.content} alt="gif" style={{ maxWidth: '200px', borderRadius: '6px', display: 'block' }} />
                      ) : msg.type === 'voice' ? (
                        <audio controls src={msg.fileUrl} style={{ maxWidth: '200px', height: '32px' }} />
                      ) : msg.type === 'file' ? (
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          📎 {msg.fileName || msg.content}
                        </a>
                      ) : msg.type === 'alert' ? (
                        <span>{msg.content}</span>
                      ) : <span>{msg.content}</span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                      <span style={{ color: '#2d3748', fontSize: '9px' }}>{fmtTime(msg.sentAt)}</span>
                      {/* Delete button — visible on hover via CSS class */}
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        title="Delete message"
                        style={{ background: 'none', border: 'none', color: '#2d3748', cursor: 'pointer', fontSize: '10px', padding: '0 2px', opacity: 0, transition: 'opacity 0.15s' }}
                        className="delete-btn"
                      >✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Emoji picker */}
          {showEmoji && (
            <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)', display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto', flexShrink: 0 }}>
              {EMOJI_LIST.map(e => (
                <button key={e} onClick={() => setInput(p => p + e)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '2px', lineHeight: 1 }}>
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* GIF picker */}
          {showGif && (
            <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
              <input
                value={gifQuery}
                onChange={e => handleGifSearch(e.target.value)}
                placeholder="Search GIFs…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px 8px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              />
              {gifLoading && <div style={{ color: '#6b7280', fontSize: '11px', textAlign: 'center', padding: '6px' }}>Searching…</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {gifs.map(g => (
                  <img key={g.id} src={g.preview} alt="gif" onClick={() => sendGif(g.url)}
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }} />
                ))}
              </div>
            </div>
          )}

          {/* Tag menu */}
          {showTagMenu && (
            <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
              <input
                value={tagSearch}
                onChange={e => handleTagSearch(e.target.value)}
                placeholder="Search leads or investors…"
                autoFocus
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px 8px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              />
              {tagLoading && <div style={{ color: '#6b7280', fontSize: '11px', padding: '5px' }}>Searching…</div>}
              {tagResults.map(c => (
                <div key={c.id} onClick={() => sendTaggedMessage(c)}
                  style={{ padding: '6px 8px', cursor: 'pointer', color: '#e8e0d0', fontSize: '12px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: '10px', color: c.type === 'lead' ? '#60a5fa' : '#a78bfa' }}>{c.type === 'lead' ? '🏷 Lead' : '💼 Investor'}</span>
                  {c.name}
                </div>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 10px', display: 'flex', gap: '5px', alignItems: 'flex-end', flexShrink: 0 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              <button onClick={() => { setShowEmoji(v => !v); setShowGif(false); setShowTagMenu(false); }}
                title="Emoji"
                style={{ background: showEmoji ? 'rgba(184,147,58,0.2)' : 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '3px', borderRadius: '4px', lineHeight: 1 }}>
                😊
              </button>
              <button onClick={() => { setShowGif(v => !v); setShowEmoji(false); setShowTagMenu(false); setGifQuery(''); setGifs([]); }}
                title="Send GIF"
                style={{ background: showGif ? 'rgba(184,147,58,0.2)' : 'none', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '3px 5px', borderRadius: '4px', color: '#60a5fa', fontWeight: 'bold' }}>
                GIF
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                disabled={uploading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '3px', color: '#8a9ab8' }}>
                {uploading ? '⏳' : '📎'}
              </button>
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                title="Hold to record voice"
                style={{ background: recording ? 'rgba(239,68,68,0.2)' : 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '3px', borderRadius: '4px', color: recording ? '#ef4444' : '#8a9ab8' }}>
                🎙
              </button>
              <button onClick={() => { setShowTagMenu(v => !v); setShowEmoji(false); setShowGif(false); }}
                title="Tag a lead"
                style={{ background: showTagMenu ? 'rgba(96,165,250,0.15)' : 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '3px', color: '#60a5fa' }}>
                @
              </button>
            </div>

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Message…"
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '7px 10px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia,serif' }}
            />

            <button onClick={() => sendMessage()}
              disabled={sending || !input.trim()}
              style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: (!input.trim() || sending) ? 0.4 : 1, flexShrink: 0 }}>
              ▶
            </button>

            <button onClick={sendAlert}
              disabled={sending || !input.trim()}
              title="Send as alert popup"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (!input.trim() || sending) ? 0.4 : 1, flexShrink: 0 }}>
              🚨
            </button>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            style={{ position: 'absolute', bottom: 0, right: 0, width: '14px', height: '14px', cursor: 'se-resize', background: 'rgba(184,147,58,0.3)', borderTopLeftRadius: '4px' }}
          />
        </>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" onChange={handleFile} style={{ display: 'none' }} />

      {/* CSS for hover delete button */}
      <style>{`
        .chat-msg-row:hover .delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}