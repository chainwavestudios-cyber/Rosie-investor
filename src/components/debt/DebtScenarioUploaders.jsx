/**
 * DebtScenarioUploaders.jsx — Upload panels for Objections, Open Scenario, and Close Scenario.
 * These give BOB a roadmap for how open and close calls should flow, plus a catalog of
 * real customer objections that BOB uses based on the duck-cow slider position.
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { computeFileHash, computeTextHash, checkDuplicateHash } from '@/lib/fileDedup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

// ─── Objection Uploader ──────────────────────────────────────────────────────
export function ObjectionUploader({ onStatus, onError, onDone }) {
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [textHash, setTextHash] = useState('');
  const fileRef = useRef(null);
  const MAX_BYTES = 50 * 1024 * 1024;

  const handleMP3 = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { onError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB.`); return; }
    onStatus('Checking for duplicates…');
    const hash = await computeFileHash(file);
    const dup = await checkDuplicateHash(hash);
    if (dup.isDuplicate) { onError(`Already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); return; }
    setTextHash(hash);
    setExtracting(true); onError(''); setExtracted([]);
    onStatus(`Uploading ${file.name}…`);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onStatus('Transcribing audio…');
      let transcriptText;
      if (file.size > 25 * 1024 * 1024) {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: file_url });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      } else {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      }
      await extractObjections(transcriptText, 'MP3 Call Recording');
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setExtracting(false);
  };

  const handleText = async () => {
    if (!text.trim()) return;
    onStatus('Checking for duplicates…');
    const hash = await computeTextHash(text);
    const dup = await checkDuplicateHash(hash);
    if (dup.isDuplicate) { onError(`Already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); return; }
    setTextHash(hash);
    setExtracting(true); onError(''); setExtracted([]);
    onStatus('Extracting objections from transcript…');
    try {
      await extractObjections(text, 'Pasted Transcript');
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setExtracting(false);
  };

  const extractObjections = async (transcriptText, source) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract ALL customer objections — concerns, hesitations, pushbacks, skepticism, and reasons to say no. For each objection, capture the exact objection text and the context (what triggered it). Return as JSON: {"entries":[{"question":"the objection text","answer":"context and what triggered it"}]}. Aim for 5-15 objections.\n\nTRANSCRIPT:\n${transcriptText}`,
      response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
    });
    const entries = result?.entries || [];
    setExtracted(entries);
    setSelected(new Set(entries.map((_, i) => i)));
    onStatus(`${entries.length} objections extracted. Review and save.`);
  };

  const saveSelected = async () => {
    setSaving(true);
    const toSave = extracted.filter((_, i) => selected.has(i));
    for (const e of toSave) {
      await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_objections', kbName: 'Debt Settlement', source: 'Objection Extraction', tags: `file_hash:${textHash}`, created_date: new Date().toISOString() });
    }
    onStatus(`✓ ${toSave.length} objections saved to BOB's brain!`);
    setExtracted([]); setSelected(new Set()); setText('');
    onDone();
    setSaving(false);
    setTimeout(() => onStatus(''), 4000);
  };

  return (
    <div style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#fb923c', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>🚫 Objection Catalog</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>Upload call recordings or paste transcripts. AI extracts customer objections — BOB uses these during calls based on the duck-cow slider (more objections = harder sell).</div>
      <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMP3(f); e.target.value = ''; }} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={() => fileRef.current?.click()} disabled={extracting} style={{ background: extracting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#fb923c,#f97316)', color: extracting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {extracting ? '⏳ Processing…' : '🎵 Upload MP3'}
        </button>
      </div>
      <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', margin: '4px 0 8px' }}>— or paste transcript —</div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Paste call transcript here…" style={{ ...inp, resize: 'vertical', marginBottom: '12px' }} />
      <button onClick={handleText} disabled={extracting || !text.trim()} style={{ background: extracting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#fb923c,#f97316)', color: extracting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: extracting ? 0.5 : 1 }}>
        {extracting ? '⏳ Extracting…' : '🔍 Extract Objections'}
      </button>
      {extracted.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ color: '#fb923c', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Extracted Objections ({extracted.length})</div>
          {extracted.map((entry, i) => (
            <div key={i} style={{ background: selected.has(i) ? 'rgba(251,146,60,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selected.has(i) ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px', marginBottom: '6px', display: 'flex', gap: '8px' }}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} style={{ cursor: 'pointer', accentColor: '#fb923c', marginTop: '3px' }} />
              <div><div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>🚫 {entry.question}</div><div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{entry.answer}</div></div>
            </div>
          ))}
          <button onClick={saveSelected} disabled={saving || selected.size === 0} style={{ marginTop: '6px', background: 'linear-gradient(135deg,#fb923c,#f97316)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>
            💾 Save {selected.size} Objections
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Scenario Uploader (Open or Close) ───────────────────────────────────────
export function ScenarioUploader({ mode, onStatus, onError, onDone }) {
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [textHash, setTextHash] = useState('');
  const fileRef = useRef(null);
  const MAX_BYTES = 50 * 1024 * 1024;

  const category = mode === 'open' ? 'debt_open_scenario' : 'debt_close_scenario';
  const color = mode === 'open' ? '#60a5fa' : '#a78bfa';
  const label = mode === 'open' ? '📞 Open Scenario' : '🎯 Close Scenario';
  const desc = mode === 'open'
    ? 'Upload recordings or transcripts of OPENING calls (opener → transfer → closer). AI extracts the call flow roadmap so BOB knows how an open call should go.'
    : 'Upload recordings or transcripts of CLOSING calls (follow-up calls where customer already knows the program). AI extracts the call flow roadmap so BOB knows how a close call should go.';

  const handleMP3 = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { onError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB.`); return; }
    onStatus('Checking for duplicates…');
    const hash = await computeFileHash(file);
    const dup = await checkDuplicateHash(hash);
    if (dup.isDuplicate) { onError(`Already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); return; }
    setTextHash(hash);
    setExtracting(true); onError(''); setExtracted([]);
    onStatus(`Uploading ${file.name}…`);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onStatus('Transcribing audio…');
      let transcriptText;
      if (file.size > 25 * 1024 * 1024) {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: file_url });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      } else {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      }
      await extractScenario(transcriptText);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setExtracting(false);
  };

  const handleText = async () => {
    if (!text.trim()) return;
    onStatus('Checking for duplicates…');
    const hash = await computeTextHash(text);
    const dup = await checkDuplicateHash(hash);
    if (dup.isDuplicate) { onError(`Already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); return; }
    setTextHash(hash);
    setExtracting(true); onError(''); setExtracted([]);
    onStatus('Extracting call flow from transcript…');
    try {
      await extractScenario(text);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setExtracting(false);
  };

  const extractScenario = async (transcriptText) => {
    const modeDesc = mode === 'open'
      ? 'an OPENING call where an opener takes an incoming call from a customer in debt, gathers their info, and transfers to a closer'
      : 'a CLOSING call where the customer already went through the opening and a transfer agent connects them to a debt specialist closer to finalize the program';
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a debt settlement sales training assistant. Below is a transcript of ${modeDesc}. Extract the call flow roadmap — the key steps and stages of the call, what the agent does at each step, and what the customer response should be. Return as JSON: {"entries":[{"question":"Step N: [step name]","answer":"What happens at this step and what the agent should do"}]}. Aim for 5-12 steps.\n\nTRANSCRIPT:\n${transcriptText}`,
      response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
    });
    const entries = result?.entries || [];
    setExtracted(entries);
    setSelected(new Set(entries.map((_, i) => i)));
    onStatus(`${entries.length} call flow steps extracted. Review and save.`);
  };

  const saveSelected = async () => {
    setSaving(true);
    const toSave = extracted.filter((_, i) => selected.has(i));
    for (const e of toSave) {
      await base44.entities.KnowledgeBase.create({ ...e, category, kbName: 'Debt Settlement', source: `${mode === 'open' ? 'Open' : 'Close'} Scenario Upload`, tags: `file_hash:${textHash}`, created_date: new Date().toISOString() });
    }
    onStatus(`✓ ${toSave.length} scenario steps saved!`);
    setExtracted([]); setSelected(new Set()); setText('');
    onDone();
    setSaving(false);
    setTimeout(() => onStatus(''), 4000);
  };

  return (
    <div style={{ background: `${color}0d`, border: `1px solid ${color}33`, borderRadius: '6px', padding: '20px' }}>
      <div style={{ color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>{desc}</div>
      <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMP3(f); e.target.value = ''; }} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={() => fileRef.current?.click()} disabled={extracting} style={{ background: extracting ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${color},${color}cc)`, color: extracting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {extracting ? '⏳ Processing…' : '🎵 Upload MP3/TXT'}
        </button>
      </div>
      <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', margin: '4px 0 8px' }}>— or paste transcript —</div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Paste call transcript here…" style={{ ...inp, resize: 'vertical', marginBottom: '12px' }} />
      <button onClick={handleText} disabled={extracting || !text.trim()} style={{ background: extracting ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${color},${color}cc)`, color: extracting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: extracting ? 0.5 : 1 }}>
        {extracting ? '⏳ Extracting…' : '🔍 Extract Call Flow'}
      </button>
      {extracted.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ color, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Call Flow Steps ({extracted.length})</div>
          {extracted.map((entry, i) => (
            <div key={i} style={{ background: selected.has(i) ? `${color}14` : 'rgba(255,255,255,0.02)', border: `1px solid ${selected.has(i) ? color + '4d' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px', marginBottom: '6px', display: 'flex', gap: '8px' }}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} style={{ cursor: 'pointer', accentColor: color, marginTop: '3px' }} />
              <div><div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{entry.question}</div><div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{entry.answer}</div></div>
            </div>
          ))}
          <button onClick={saveSelected} disabled={saving || selected.size === 0} style={{ marginTop: '6px', background: `linear-gradient(135deg,${color},${color}cc)`, color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>
            💾 Save {selected.size} Steps
          </button>
        </div>
      )}
    </div>
  );
}