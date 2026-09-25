/**
 * ObjectionsManager.jsx — Full objections management panel for BOB's Brain.
 * Manual entry, bulk AI paste, MP3/transcript extraction, and a live list.
 * All objections saved with category 'debt_objections' and kbName 'Debt Settlement'
 * so BOB loads them into his system prompt during training calls.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { computeFileHash, computeTextHash, checkDuplicateHash, checkDuplicateQuestion } from '@/lib/fileDedup';

const GOLD = '#10b981';
const ORANGE = '#fb923c';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function ObjectionsManager({ onStatus, onError, onDone }) {
  const [entries, setEntries] = useState([]);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // MP3 / transcript extraction state
  const [transcriptText, setTranscriptText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [extractSaving, setExtractSaving] = useState(false);
  const [textHash, setTextHash] = useState('');
  const fileRef = useRef(null);
  const MAX_BYTES = 50 * 1024 * 1024;

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.KnowledgeBase.filter({ category: 'debt_objections' }, '-created_date', 200);
      setEntries(all || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for KB updates
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('debt_kb_updated', handler);
    return () => window.removeEventListener('debt_kb_updated', handler);
  }, [load]);

  // ── Manual add ────────────────────────────────────────────────────────────
  const add = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true);
    try {
      const dup = await checkDuplicateQuestion(q.trim(), 'Debt Settlement');
      if (dup.isDuplicate) { onError('This objection already exists in BOB\'s brain. Skipping.'); setSaving(false); return; }
      await base44.entities.KnowledgeBase.create({
        question: q.trim(), answer: a.trim(),
        category: 'debt_objections', kbName: 'Debt Settlement',
        source: 'Manual', created_date: new Date().toISOString(),
      });
      setQ(''); setA('');
      onStatus('✓ Objection added to BOB\'s brain');
      await load(); onDone?.();
      window.dispatchEvent(new CustomEvent('debt_kb_updated'));
      setTimeout(() => onStatus(''), 3000);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this objection?')) return;
    await base44.entities.KnowledgeBase.delete(id);
    await load(); onDone?.();
    window.dispatchEvent(new CustomEvent('debt_kb_updated'));
  };

  // ── Bulk paste with AI parsing ────────────────────────────────────────────
  const bulkAdd = async () => {
    if (!bulkText.trim()) return;
    setBulkSaving(true); onStatus('Checking for duplicates…');
    try {
      const hash = await computeTextHash(bulkText);
      const dup = await checkDuplicateHash(hash);
      if (dup.isDuplicate) { onError(`This content was already uploaded on ${dup.firstUploadDate ? new Date(dup.firstUploadDate).toLocaleDateString() : 'earlier'} — ${dup.count} entries exist. Skipping.`); setBulkSaving(false); return; }
      onStatus('AI is parsing objections…');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement sales training assistant. Below is content about customer objections in debt settlement calls. Parse it into individual objection entries where the question is the objection text and the answer is the context (what triggered it, how to handle it). Return as JSON: {"entries":[{"question":"the objection text","answer":"context and how to handle it"}]}.\n\nCONTENT:\n${bulkText}`,
        response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
      });
      const parsed = result?.entries || [];
      for (const e of parsed) {
        await base44.entities.KnowledgeBase.create({
          question: e.question, answer: e.answer,
          category: 'debt_objections', kbName: 'Debt Settlement',
          source: 'Bulk Paste', tags: `file_hash:${hash}`, created_date: new Date().toISOString(),
        });
      }
      setBulkText('');
      onStatus(`✓ ${parsed.length} objections added to BOB's brain`);
      await load(); onDone?.();
      window.dispatchEvent(new CustomEvent('debt_kb_updated'));
      setTimeout(() => onStatus(''), 4000);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setBulkSaving(false);
  };

  // ── MP3 / transcript extraction ───────────────────────────────────────────
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
      let tText;
      if (file.size > 25 * 1024 * 1024) {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: file_url });
        tText = res?.transcript || res?.data?.transcript || '';
      } else {
        tText = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      }
      await extractObjections(tText);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setExtracting(false);
  };

  const handleTextExtract = async () => {
    if (!transcriptText.trim()) return;
    onStatus('Checking for duplicates…');
    const hash = await computeTextHash(transcriptText);
    const dup = await checkDuplicateHash(hash);
    if (dup.isDuplicate) { onError(`Already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); return; }
    setTextHash(hash);
    setExtracting(true); onError(''); setExtracted([]);
    onStatus('Extracting objections from transcript…');
    try {
      await extractObjections(transcriptText);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setExtracting(false);
  };

  const extractObjections = async (tText) => {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract ALL customer objections — concerns, hesitations, pushbacks, skepticism, and reasons to say no. For each objection, capture the exact objection text and the context (what triggered it). Return as JSON: {"entries":[{"question":"the objection text","answer":"context and what triggered it"}]}. Aim for 5-15 objections.\n\nTRANSCRIPT:\n${tText}`,
      response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
    });
    const e = result?.entries || [];
    setExtracted(e);
    setSelected(new Set(e.map((_, i) => i)));
    onStatus(`${e.length} objections extracted. Review and save.`);
  };

  const saveExtracted = async () => {
    setExtractSaving(true);
    const toSave = extracted.filter((_, i) => selected.has(i));
    for (const e of toSave) {
      await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_objections', kbName: 'Debt Settlement', source: 'Objection Extraction', tags: `file_hash:${textHash}`, created_date: new Date().toISOString() });
    }
    onStatus(`✓ ${toSave.length} objections saved to BOB's brain!`);
    setExtracted([]); setSelected(new Set()); setTranscriptText('');
    await load(); onDone?.();
    window.dispatchEvent(new CustomEvent('debt_kb_updated'));
    setExtractSaving(false);
    setTimeout(() => onStatus(''), 4000);
  };

  return (
    <div style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: ORANGE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>🚫 Objection Catalog</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px', lineHeight: 1.5 }}>Manage customer objections that BOB raises during training calls. Add manually, bulk paste, or extract from call recordings. BOB uses these based on the duck-cow slider (more objections = harder sell).</div>

      {/* Manual add */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px' }}><label style={ls}>Objection Text</label><input value={q} onChange={e => setQ(e.target.value)} placeholder="How much is this going to cost me?" style={inp} /></div>
        <div style={{ marginBottom: '8px' }}><label style={ls}>Context / How to Handle</label><textarea value={a} onChange={e => setA(e.target.value)} placeholder="Customer is worried about upfront fees. Agent should explain no upfront fees, success-based pricing..." style={{ ...inp, resize: 'vertical', minHeight: '60px' }} /></div>
        <button onClick={add} disabled={saving || !q.trim() || !a.trim()} style={{ background: 'linear-gradient(135deg,#fb923c,#f97316)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: (saving || !q.trim() || !a.trim()) ? 0.5 : 1 }}>{saving ? '⏳ Adding…' : '+ Add Objection'}</button>
      </div>

      {/* Bulk paste */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0', paddingTop: '16px' }}>
        <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Bulk Paste — AI will parse</div>
        <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={6} placeholder="Paste objection content here — AI will parse it into individual objections..." style={{ ...inp, resize: 'vertical', marginBottom: '8px', fontFamily: 'monospace', fontSize: '12px' }} />
        <button onClick={bulkAdd} disabled={bulkSaving || !bulkText.trim()} style={{ background: 'linear-gradient(135deg,#fb923c,#f97316)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: (bulkSaving || !bulkText.trim()) ? 0.5 : 1 }}>{bulkSaving ? '⏳ Parsing…' : '🔍 Parse & Add with AI'}</button>
      </div>

      {/* MP3 / transcript extraction */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0', paddingTop: '16px' }}>
        <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Extract from Call Recording or Transcript</div>
        <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMP3(f); e.target.value = ''; }} />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button onClick={() => fileRef.current?.click()} disabled={extracting} style={{ background: extracting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#fb923c,#f97316)', color: extracting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {extracting ? '⏳ Processing…' : '🎵 Upload MP3'}
          </button>
        </div>
        <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', margin: '4px 0 8px' }}>— or paste transcript —</div>
        <textarea value={transcriptText} onChange={e => setTranscriptText(e.target.value)} rows={4} placeholder="Paste call transcript here…" style={{ ...inp, resize: 'vertical', marginBottom: '8px' }} />
        <button onClick={handleTextExtract} disabled={extracting || !transcriptText.trim()} style={{ background: extracting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#fb923c,#f97316)', color: extracting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: extracting ? 0.5 : 1 }}>
          {extracting ? '⏳ Extracting…' : '🔍 Extract Objections'}
        </button>
        {extracted.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ color: ORANGE, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Extracted Objections ({extracted.length})</div>
            {extracted.map((entry, i) => (
              <div key={i} style={{ background: selected.has(i) ? 'rgba(251,146,60,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selected.has(i) ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px', marginBottom: '6px', display: 'flex', gap: '8px' }}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} style={{ cursor: 'pointer', accentColor: ORANGE, marginTop: '3px' }} />
                <div><div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>🚫 {entry.question}</div><div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{entry.answer}</div></div>
              </div>
            ))}
            <button onClick={saveExtracted} disabled={extractSaving || selected.size === 0} style={{ marginTop: '6px', background: 'linear-gradient(135deg,#fb923c,#f97316)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: extractSaving ? 0.5 : 1 }}>
              💾 Save {selected.size} Objections
            </button>
          </div>
        )}
      </div>

      {/* Existing objections list */}
      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
        <div style={{ color: ORANGE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Objections in BOB's Brain ({entries.length})</div>
        {entries.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No objections yet. Add some above — BOB will use them during training calls.</div> :
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {entries.map(e => (
              <div key={e.id} style={{ background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.12)', borderRadius: '4px', padding: '10px 12px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                  <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>🚫 {e.question}</div>
                  <button onClick={() => del(e.id)} style={{ background: 'none', border: 'none', color: '#ef444466', cursor: 'pointer', fontSize: '10px', flexShrink: 0 }}>Delete</button>
                </div>
                <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{e.answer}</div>
                {e.source && <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '4px' }}>{e.source}</div>}
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}