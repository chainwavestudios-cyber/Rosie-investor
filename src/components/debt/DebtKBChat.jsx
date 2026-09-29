/**
 * DebtKBChat.jsx — AI chat interface for ingesting knowledge into the debt KB.
 * Send text, images, or audio — the AI analyzes the content, determines the best
 * KB category and structure, and saves the entries automatically.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const CAT_COLORS = {
  debt_agent: '#60a5fa',
  debt_customer: '#f59e0b',
  debt_hotpoints: '#fb923c',
  debt_doc: '#a78bfa',
  debt_faq: '#34d399',
  debt_kb: '#6b7280',
};
const CAT_LABELS = {
  debt_agent: 'Agent Script',
  debt_customer: 'Customer Q&A',
  debt_hotpoints: 'Hotpoint',
  debt_doc: 'Document',
  debt_faq: 'FAQ',
  debt_kb: 'General KB',
};

export default function DebtKBChat() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "👋 Hi! I'm your AI knowledge-base assistant. Send me text, paste scripts, upload images (screenshots, docs photos), or audio (call recordings) — I'll analyze the content and figure out the best way to store it in your debt settlement KB. What do you want to add today?", entries: [] },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // { file, url, type, preview }
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const mediaRecRef = useRef(null);
  const recordChunksRef = useRef([]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|oga|webm|flac)$/i.test(file.name);
    if (!isImage && !isAudio) {
      alert('Please upload an image or audio file.');
      return;
    }
    // Upload to public storage so the backend can fetch it
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const preview = isImage ? file_url : null;
      setPendingFile({ file, url: file_url, type: isImage ? 'image' : 'audio', preview });
    } catch (e) {
      alert('Upload failed: ' + (e?.message || String(e)));
    }
  }, []);

  // ── Audio recording (mic) ──────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setRecordedBlob(audioFile);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecRef.current = recorder;
      setRecording(true);
    } catch (e) {
      alert('Microphone access denied: ' + (e?.message || String(e)));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    setRecording(false);
  }, []);

  // When recording finishes, auto-attach as pending file
  useEffect(() => {
    if (recordedBlob) handleFileSelect(recordedBlob);
  }, [recordedBlob, handleFileSelect]);

  const send = useCallback(async () => {
    if ((!input.trim() && !pendingFile) || busy) return;
    const userMsg = { role: 'user', text: input.trim() || (pendingFile ? `(Uploaded ${pendingFile.type})` : ''), file: pendingFile };
    setMessages(prev => [...prev, userMsg]);
    const messageText = input.trim();
    const file = pendingFile;
    setInput('');
    setPendingFile(null);
    setBusy(true);

    // Add a placeholder AI message
    setMessages(prev => [...prev, { role: 'ai', text: '', loading: true, entries: [] }]);

    try {
      const res = await base44.functions.invoke('kbChatIngest', {
        message: messageText,
        fileUrl: file?.url || null,
        fileType: file?.type || null,
        fileName: file?.file?.name || null,
      });
      const aiResponse = res?.response || res?.data?.response || 'Done.';
      const entries = res?.entries || res?.data?.entries || [];
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'ai', text: aiResponse, entries, loading: false };
        return next;
      });
      // Notify other KB views that content was added
      window.dispatchEvent(new CustomEvent('debt_kb_updated'));
    } catch (e) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'ai', text: '⚠️ Something went wrong: ' + (e?.message || String(e)), entries: [], loading: false };
        return next;
      });
    }
    setBusy(false);
  }, [input, pendingFile, busy]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const removePendingFile = () => setPendingFile(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', alignItems: 'start' }}>
      {/* Chat panel */}
      <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}33`, borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '70vh' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <div>
            <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>AI Knowledge Ingestion Chat</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>Send text, images, or audio — AI decides the best way to store it</div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: '14px', display: 'flex', gap: '10px', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'ai' && <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${GOLD}22`, border: `1px solid ${GOLD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}>🤖</div>}
              <div style={{ maxWidth: '80%' }}>
                {/* User message with file preview */}
                {m.role === 'user' && m.file && (
                  <div style={{ marginBottom: '6px' }}>
                    {m.file.type === 'image' && m.file.preview && (
                      <img src={m.file.preview} alt="upload" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                    )}
                    {m.file.type === 'audio' && (
                      <div style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.3)', borderRadius: '4px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>🎵</span>
                        <span style={{ color: '#f472b6', fontSize: '11px' }}>{m.file.file?.name || 'Audio file'}</span>
                      </div>
                    )}
                  </div>
                )}
                <div style={{
                  background: m.role === 'user' ? `${GOLD}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${m.role === 'user' ? `${GOLD}44` : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '10px 14px',
                  color: '#e8e0d0',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.loading ? <span style={{ color: '#6b7280' }}>⏳ Analyzing content and extracting knowledge…</span> : m.text}
                </div>
                {/* Saved entries */}
                {m.entries && m.entries.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>✓ Saved {m.entries.length} entr{m.entries.length === 1 ? 'y' : 'ies'}</div>
                    {m.entries.map((e, j) => {
                      const color = CAT_COLORS[e.category] || '#6b7280';
                      return (
                        <div key={j} style={{ background: `${color}08`, border: `1px solid ${color}33`, borderRadius: '4px', padding: '8px 10px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ padding: '1px 6px', borderRadius: '2px', background: `${color}22`, color, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{CAT_LABELS[e.category] || e.category}</span>
                            {e.tags && <span style={{ color: '#6b7280', fontSize: '9px' }}>· {e.tags}</span>}
                          </div>
                          <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{e.question}</div>
                          <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, marginTop: '2px' }}>{e.answer?.slice(0, 200)}{e.answer?.length > 200 ? '…' : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {m.role === 'user' && <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>👤</div>}
            </div>
          ))}
        </div>

        {/* Pending file preview */}
        {pendingFile && (
          <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {pendingFile.type === 'image' && pendingFile.preview && (
              <img src={pendingFile.preview} alt="pending" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
            )}
            {pendingFile.type === 'audio' && <span style={{ fontSize: '20px' }}>🎵</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#c4cdd8', fontSize: '11px', fontWeight: 'bold' }}>{pendingFile.file?.name || 'Recording'}</div>
              <div style={{ color: '#6b7280', fontSize: '10px' }}>{pendingFile.type} ready to send</div>
            </div>
            <button onClick={removePendingFile} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        )}

        {/* Input bar */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
          {/* Attach buttons */}
          <input ref={fileRef} type="file" accept="image/*,audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} title="Attach image or audio file" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', cursor: busy ? 'not-allowed' : 'pointer', color: '#8a9ab8', fontSize: '16px' }}>📎</button>
          {/* Mic record button */}
          <button onClick={recording ? stopRecording : startRecording} disabled={busy} title={recording ? 'Stop recording' : 'Record audio'} style={{ background: recording ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${recording ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '8px 10px', cursor: busy ? 'not-allowed' : 'pointer', color: recording ? '#ef4444' : '#8a9ab8', fontSize: '16px' }}>
            {recording ? '⏺' : '🎤'}
          </button>
          {/* Text input */}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="Type or paste content to add to the KB… (Shift+Enter for new line)"
            rows={1}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', resize: 'none', minHeight: '36px', maxHeight: '120px', fontFamily: 'Georgia, serif' }}
          />
          {/* Send */}
          <button onClick={send} disabled={busy || (!input.trim() && !pendingFile)} style={{ background: busy ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${GOLD},#22c55e)`, color: busy ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: busy ? 0.5 : 1 }}>
            {busy ? '⏳' : 'Send'}
          </button>
        </div>
      </div>

      {/* Side panel — tips */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>💡 How to use</div>
        <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.7 }}>
          <div style={{ marginBottom: '10px' }}><strong style={{ color: '#e8e0d0' }}>Text:</strong> Paste scripts, objection handlers, training notes, or Q&A — the AI structures and categorizes them.</div>
          <div style={{ marginBottom: '10px' }}><strong style={{ color: '#e8e0d0' }}>Images:</strong> Upload screenshots of docs, photos of program materials, or slides — the AI reads them with vision.</div>
          <div style={{ marginBottom: '10px' }}><strong style={{ color: '#e8e0d0' }}>Audio:</strong> Upload call recordings or record live from your mic — the AI transcribes and extracts Q&A and scripts.</div>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color: '#6b7280', fontSize: '10px', lineHeight: 1.6 }}>
            The AI picks the right category automatically:<br />
            <span style={{ color: '#60a5fa' }}>●</span> Agent Scripts<br />
            <span style={{ color: '#f59e0b' }}>●</span> Customer Q&A<br />
            <span style={{ color: '#fb923c' }}>●</span> Coaching Hotpoints<br />
            <span style={{ color: '#a78bfa' }}>●</span> Documents<br />
            <span style={{ color: '#34d399' }}>●</span> FAQ
          </div>
        </div>
      </div>
    </div>
  );
}