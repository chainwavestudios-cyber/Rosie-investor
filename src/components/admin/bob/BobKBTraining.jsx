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
  const [generatedScript, setGeneratedScript] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptSaving, setScriptSaving] = useState(false);
  const [scriptSaved, setScriptSaved] = useState(false);
  const fileRef = useRef(null);

  const isProcessing = uploading || transcribing || extracting;

  const MAX_BYTES = 50 * 1024 * 1024; // 50MB
  const WHISPER_LIMIT = 25 * 1024 * 1024; // 25MB — TranscribeAudio integration limit

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB.`);
      return;
    }
    setError(''); setStatus(''); setTranscript(''); setExtractedEntries([]); setSelectedEntries(new Set());
    setGeneratedScript(''); setScriptName(''); setScriptSaved(false);
    setUploading(true);
    setStatus(`Uploading audio file (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploading(false);
      setTranscribing(true);
      setStatus('Transcribing audio…');
      let transcriptText;
      if (file.size > WHISPER_LIMIT) {
        // Files > 25MB use Deepgram batch API (supports up to 50MB+)
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: file_url });
        transcriptText = res?.data?.transcript || res?.transcript || '';
      } else {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      }
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
      setStatus(`${entries.length} Q&A pairs extracted. Generating agent script…`);
      // Generate agent script from transcript
      const scriptResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a sales script writer. Below is a transcript of a real ${systemLabel} sales call. Create a clean, actionable agent script that a sales rep can follow on future calls. Structure it as:

[OPENING]
- The opener/greeting used and how to introduce yourself

[QUALIFYING]
- Key qualifying questions to ask the prospect

[PITCH / PROGRAM OVERVIEW]
- How to explain the program/service based on what worked in the call

[OBJECTION HANDLING]
- Common objections from the call and the best responses

[DEBT TALLY / NEEDS ASSESSMENT]
- Questions to tally up the prospect's situation (debt amounts, income, employment, etc.)

[CLOSE]
- The closing approach and language that worked

Keep it practical and conversational. Use {{name}} as a placeholder for the prospect's first name. Base it on what actually worked in this real call transcript.

TRANSCRIPT:
${transcriptText}`,
      });
      const scriptText = typeof scriptResult === 'string' ? scriptResult : (scriptResult?.content?.[0]?.text || scriptResult?.text || '');
      setGeneratedScript(scriptText);
      setScriptName(`${systemLabel} — Agent Script (${new Date().toLocaleDateString()})`);
      setStatus(`${entries.length} Q&A pairs + agent script generated.`);
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

  const saveScript = async () => {
    if (!generatedScript.trim() || !scriptName.trim()) return;
    setScriptSaving(true); setError('');
    try {
      await base44.entities.GlobalScript.create({
        name: scriptName.trim(),
        content: generatedScript,
        scriptType: 'custom',
        color: '#e8e0d0',
        fontSize: 14,
        sortOrder: 0,
      });
      setScriptSaved(true);
      setStatus('Agent script saved! It will appear in BOB calls and real-time call scripts.');
      setTimeout(() => setScriptSaved(false), 4000);
    } catch (e) {
      setError('Script save failed: ' + (e?.message || String(e)));
    }
    setScriptSaving(false);
  };

  return (
    <div style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${systemColor}33`, borderRadius:'4px', padding:'20px', marginBottom:'20px' }}>
      <div style={{ color:systemColor, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>🎙️ Train KB from Real Call Recordings</div>
      <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'16px' }}>
        Upload MP3 recordings of real {systemLabel} calls (up to 50MB). The AI transcribes them, extracts Q&A pairs for the knowledge base, and generates an agent script that appears in BOB training calls and real-time call scripts.
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

      {generatedScript && (
        <div style={{ marginTop:'20px', borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:'16px' }}>
          <div style={{ color:systemColor, fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'10px' }}>
            📝 Generated Agent Script
          </div>
          <div style={{ color:'#6b7280', fontSize:'11px', marginBottom:'10px' }}>
            Edit the script below, then save it. Saved scripts appear in the Scripts tab during BOB training calls and real-time calls.
          </div>
          <div style={{ marginBottom:'10px' }}>
            <label style={{ display:'block', color:'#6b7280', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>Script Name</label>
            <input
              value={scriptName}
              onChange={e => setScriptName(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'8px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box' }}
            />
          </div>
          <textarea
            value={generatedScript}
            onChange={e => setGeneratedScript(e.target.value)}
            style={{
              width:'100%', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px',
              padding:'14px', color:'#e8e0d0', fontSize:'13px', lineHeight:1.7, outline:'none', resize:'vertical',
              fontFamily:'Georgia, serif', boxSizing:'border-box', minHeight:'200px',
            }}
          />
          <div style={{ marginTop:'10px', display:'flex', gap:'10px', alignItems:'center' }}>
            <button
              onClick={saveScript}
              disabled={scriptSaving || !generatedScript.trim() || !scriptName.trim()}
              style={{
                background: scriptSaving ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${systemColor},${systemColor}cc)`,
                color: scriptSaving ? '#6b7280' : DARK,
                border:'none', borderRadius:'4px', padding:'10px 24px',
                cursor: (scriptSaving || !generatedScript.trim() || !scriptName.trim()) ? 'not-allowed' : 'pointer',
                fontSize:'12px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase',
                opacity: (scriptSaving || !generatedScript.trim() || !scriptName.trim()) ? 0.5 : 1,
              }}
            >
              {scriptSaving ? '⏳ Saving…' : '💾 Save Script to Global Scripts'}
            </button>
            {scriptSaved && <span style={{ color:'#4ade80', fontSize:'12px' }}>✓ Script saved! Visible in BOB & live calls.</span>}
          </div>
        </div>
      )}
    </div>
  );
}