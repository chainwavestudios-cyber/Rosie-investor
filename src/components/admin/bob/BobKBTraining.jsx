/**
 * BobKBTraining.jsx — Upload MP3 recordings of real calls to auto-train the knowledge base.
 * Flow: Upload file → Transcribe (Whisper) → Extract Q&A pairs (LLM) → Review & save to KB.
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const DARK = '#0a0f1e';

export default function BobKBTraining({ kbCategory, systemLabel, systemColor, onEntriesAdded }) {
  const [uploading,  setUploading]  = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [extractedEntries, setExtractedEntries] = useState([]);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  const isProcessing = uploading || transcribing || extracting;

  const handleFile = async (file) => {
    if (!file) return;
    setError(''); setStatus(''); setTranscript(''); setExtractedEntries([]); setSelectedEntries(new Set());
    setUploading(true);
    setStatus('Uploading audio file…');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploading(false);
      setTranscribing(true);
      setStatus('Transcribing audio…');
      const transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      setTranscribing(false);
      setTranscript(typeof transcriptText === 'string' ? transcriptText : JSON.stringify(transcriptText));
      setExtracting(true);
      setStatus('Extracting Q&A pairs from transcript…');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a sales training assistant. Below is a transcript of a real ${systemLabel} sales call. Extract the most important Q&A pairs and knowledge entries that a sales trainee should know. Focus on:
- Common customer questions and the best answers given
- Objections raised and how they were handled
- Key program/product details mentioned
- Closing techniques used
- Important facts about the service/product

Return as a JSON object with an "entries" array, each with "question" and "answer" fields. Aim for 10-20 high-quality entries.

TRANSCRIPT:
${transcriptText}`,
        response_json_schema: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' }
                }
              }
            }
          }
        }
      });
      setExtracting(false);
      const entries = result?.entries || [];
      setExtractedEntries(entries);
      setSelectedEntries(new Set(entries.map((_, i) => i)));
      setStatus(`${entries.length} Q&A pairs extracted from the call.`);
    } catch (e) {
      setError('Failed to process audio: ' + (e?.message || String(e)));
      setUploading(false); setTranscribing(false); setExtracting(false);
    }
  };

  const toggleEntry = (i) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const saveSelected = async () => {
    setSaving(true); setError('');
    try {
      const toSave = extractedEntries.filter((_, i) => selectedEntries.has(i));
      for (const entry of toSave) {
        await base44.entities.KnowledgeBase.create({
          question: entry.question,
          answer: entry.answer,
          category: kbCategory,
        });
      }
      setSavedCount(toSave.length);
      setStatus(`${toSave.length} entries saved to knowledge base!`);
      setExtractedEntries([]); setSelectedEntries(new Set()); setTranscript('');
      if (onEntriesAdded) onEntriesAdded();
      setTimeout(() => setSavedCount(0), 3000);
    } catch (e) {
      setError('Save failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  return (
    <div style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${systemColor}33`, borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
      <div style={{ color:systemColor, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>🎙️ Train KB from Real Call Recordings</div>
      <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'16px' }}>
        Upload MP3 recordings of real {systemLabel} calls. The AI transcribes them and extracts Q&A pairs to fill the knowledge base automatically.
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg"
        style={{ display:'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value=''; }}
      />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={isProcessing}
        style={{
          background: isProcessing ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${systemColor},${systemColor}cc)`,
          color: isProcessing ? '#6b7280' : DARK,
          border: 'none', borderRadius: '4px', padding: '12px 24px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
          opacity: isProcessing ? 0.6 : 1,
        }}
      >
        {uploading ? '⏳ Uploading…' : transcribing ? '⏳ Transcribing…' : extracting ? '⏳ Extracting Q&A…' : '📁 Upload Call Recording (MP3)'}
      </button>

      {status && <div style={{ color:systemColor, fontSize:'12px', marginTop:'10px' }}>{status}</div>}
      {error && <div style={{ color:'#ef4444', fontSize:'12px', marginTop:'10px' }}>⚠ {error}</div>}

      {transcript && (
        <div style={{ marginTop:'16px' }}>
          <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>Transcript Preview</div>
          <div style={{
            background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px',
            padding:'12px', maxHeight:'150px', overflowY:'auto',
            fontSize:'11px', color:'#8a9ab8', lineHeight:1.6, whiteSpace:'pre-wrap'
          }}>
            {transcript.slice(0, 2000)}{transcript.length > 2000 ? '…' : ''}
          </div>
        </div>
      )}

      {extractedEntries.length > 0 && (
        <div style={{ marginTop:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
            <div style={{ color:systemColor, fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase' }}>
              Extracted Q&A Pairs ({extractedEntries.length})
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                onClick={() => setSelectedEntries(new Set(extractedEntries.map((_, i) => i)))}
                style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}
              >Select All</button>
              <button
                onClick={() => setSelectedEntries(new Set())}
                style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}
              >Clear</button>
            </div>
          </div>
          {extractedEntries.map((entry, i) => (
            <div
              key={i}
              style={{
                background: selectedEntries.has(i) ? `${systemColor}08` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedEntries.has(i) ? systemColor + '33' : 'rgba(255,255,255,0.07)'}`,
                borderRadius:'4px', padding:'12px', marginBottom:'8px', display:'flex', gap:'10px',
              }}
            >
              <input
                type="checkbox"
                checked={selectedEntries.has(i)}
                onChange={() => toggleEntry(i)}
                style={{ cursor:'pointer', accentColor:systemColor, marginTop:'3px' }}
              />
              <div style={{ flex:1 }}>
                <div style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold', marginBottom:'4px' }}>{entry.question}</div>
                <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5 }}>{entry.answer}</div>
              </div>
            </div>
          ))}
          <button
            onClick={saveSelected}
            disabled={saving || selectedEntries.size === 0}
            style={{
              marginTop:'8px',
              background: saving ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${systemColor},${systemColor}cc)`,
              color: saving ? '#6b7280' : DARK,
              border:'none', borderRadius:'4px', padding:'10px 24px',
              cursor: (saving || selectedEntries.size === 0) ? 'not-allowed' : 'pointer',
              fontSize:'12px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase',
              opacity: (saving || selectedEntries.size === 0) ? 0.5 : 1,
            }}
          >
            {saving ? '⏳ Saving…' : `💾 Save ${selectedEntries.size} Entries to KB`}
          </button>
          {savedCount > 0 && <span style={{ color:'#4ade80', fontSize:'12px', marginLeft:'10px' }}>✓ {savedCount} entries saved!</span>}
        </div>
      )}
    </div>
  );
}