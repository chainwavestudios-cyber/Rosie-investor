/**
 * FronterNotesSection.jsx — Tall notes box with file upload and audio recording,
 * plus the timestamped notes log (Eastern Time).
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import FronterNoteAttachment from './FronterNoteAttachment';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const smallBtn = (active) => ({ background: active ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: active ? '#ef4444' : '#c4cdd8', border: `1px solid ${active ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' });

function fmtET(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function FronterNotesSection({ notesLog, username, onAdd, inputStyle }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef(null);
  const recorderRef = useRef(null);

  const upload = async (file, kind) => {
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setAttachment({ fileUri: file_uri, fileName: file.name, kind });
    } catch (e) { alert('Upload failed: ' + (e?.message || String(e))); }
    setUploading(false);
  };

  const toggleRecording = async () => {
    if (recording) { recorderRef.current?.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      setRecording(false);
      const blob = new Blob(chunks, { type: 'audio/webm' });
      upload(new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' }), 'audio');
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const add = () => {
    if (!text.trim() && !attachment) return;
    onAdd({ text: text.trim(), timestamp: new Date().toISOString(), author: username, type: 'note', ...(attachment ? { attachment } : {}) });
    setText(''); setAttachment(null);
  };

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>Notes (Eastern Time)</div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Type call notes here…" style={{ ...inputStyle, resize: 'vertical', minHeight: '130px', lineHeight: 1.5 }} />
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: '6px 0 10px', flexWrap: 'wrap' }}>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, 'file'); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading || recording} style={smallBtn(false)}>📎 Upload File</button>
        <button onClick={toggleRecording} disabled={uploading} style={smallBtn(recording)}>{recording ? '⏹ Stop Recording' : '🎙 Record Audio'}</button>
        {uploading && <span style={{ color: '#8a9ab8', fontSize: '11px' }}>⏳ Uploading…</span>}
        {attachment && !uploading && (
          <span style={{ color: BLUE, fontSize: '11px' }}>
            {attachment.kind === 'audio' ? '🎙' : '📎'} {attachment.fileName}
            <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginLeft: '4px' }}>×</button>
          </span>
        )}
        <button onClick={add} disabled={(!text.trim() && !attachment) || uploading} style={{ marginLeft: 'auto', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (text.trim() || attachment) ? 1 : 0.5 }}>Add Note</button>
      </div>
      <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {notesLog.length === 0 ? (
          <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '16px' }}>No notes yet.</div>
        ) : [...notesLog].reverse().map((n, i) => (
          <div key={i} style={{ padding: '8px 12px', background: n.type === 'dial' ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${n.type === 'dial' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '4px', borderLeft: `3px solid ${n.type === 'dial' ? BLUE : 'rgba(255,255,255,0.15)'}` }}>
            {n.text && <div style={{ color: n.type === 'dial' ? BLUE : '#c4cdd8', fontSize: '12px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{n.text}</div>}
            {n.attachment && <FronterNoteAttachment attachment={n.attachment} />}
            <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '3px' }}>{fmtET(n.timestamp)} · {n.author || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}