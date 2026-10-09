/**
 * BobBrainTab.jsx — The master knowledge engine for BOB.
 *  - Upload MP3s → auto-transcribes AND saves the transcript to the brain
 *    (BobTranscript entity), so every uploaded call makes BOB smarter.
 *  - Paste transcripts → same treatment.
 *  - Extracted Q&A is cross-referenced against the existing KB for duplicate-like
 *    statements; a popup lets the trainer pick what's preferred.
 *  - Chat with BOB about what it knows / what it should forget.
 *  - Recent transcripts list (view / delete).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { computeFileHash, computeTextHash, checkDuplicateHash } from '@/lib/fileDedup';
import { crossReferenceBatch } from './bobBrainUtils';
import BobBrainScanner from './BobBrainScanner';
import ConflictResolutionPopup from './ConflictResolutionPopup';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';
const PINK = '#f472b6';
const DARK = '#0a0f1e';
const RED = '#ef4444';

const DEBT_KB_CATEGORIES = ['debt_call', 'debt_faq', 'debt_customer', 'debt_kb', 'debt_objections', 'debt_hotpoints', 'debt_disqualify', 'debt_doc', 'debt_open_scenario', 'debt_close_scenario'];

export default function BobBrainTab({ onKBUpdated }) {
  const [transcripts, setTranscripts] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [mp3Uploading, setMp3Uploading] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pastedName, setPastedName] = useState('');
  const [pasting, setPasting] = useState(false);
  const [conflicts, setConflicts] = useState(null); // { flagged, clean, fileHash, source } | null
  const [viewingTranscript, setViewingTranscript] = useState(null);
  const mp3Ref = useRef(null);
  const MAX_BYTES = 50 * 1024 * 1024;
  const [mp3QueueProgress, setMp3QueueProgress] = useState(null); // { current, total, currentName }
  const [duplicateGroups, setDuplicateGroups] = useState(null);
  const [searchingDuplicates, setSearchingDuplicates] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [ts, kb] = await Promise.all([
        base44.entities.BobTranscript.list('-created_date', 100),
        base44.entities.KnowledgeBase.list('-created_date', 500),
      ]);
      setTranscripts(ts || []);
      setKbEntries(kb || []);
    } catch (e) { setError('Failed to load brain: ' + (e?.message || String(e))); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const debtKb = () => kbEntries.filter(e => e.kbName === 'Debt Settlement' || DEBT_KB_CATEGORIES.includes(e.category));

  // ── MP3 batch upload: queue up to 30 files, process 1 at a time ──
  const handleMP3Batch = async (files) => {
    const fileArr = Array.from(files).slice(0, 30);
    if (fileArr.length === 0) return;
    setMp3Uploading(true); setError('');
    const allFlagged = [];
    let saved = 0, skipped = 0;
    for (let i = 0; i < fileArr.length; i++) {
      setMp3QueueProgress({ current: i + 1, total: fileArr.length, currentName: fileArr[i].name });
      const res = await processSingleMP3(fileArr[i]);
      if (res?.flagged?.length > 0) allFlagged.push(...res.flagged);
      if (res?.skipped) skipped++; else saved += res?.savedCount || 0;
    }
    setMp3QueueProgress(null);
    setMp3Uploading(false);
    if (allFlagged.length > 0) {
      setConflicts({ flagged: allFlagged, fileHash: 'batch', source: `Batch of ${fileArr.length} files` });
      setStatus(`✓ Batch complete: ${saved} entries saved, ${skipped} duplicates skipped, ${allFlagged.length} duplicate-like statements need review.`);
    } else {
      setStatus(`✓ Batch complete: ${fileArr.length} files processed, ${saved} entries saved, ${skipped} duplicates skipped.`);
    }
    loadAll();
    onKBUpdated?.();
    setTimeout(() => { if (!conflicts) setStatus(''); }, 5000);
  };

  // Process a single MP3 — returns { flagged, savedCount, skipped }
  const processSingleMP3 = async (file) => {
    if (file.size > MAX_BYTES) { setError(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — max 50MB. Skipping.`); return { skipped: true }; }
    try {
      setStatus(`Checking ${file.name} for duplicates…`);
      const hash = await computeFileHash(file);
      const dup = await checkDuplicateHash(hash);
      if (dup.isDuplicate) { setStatus(`⚠ ${file.name} already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); return { skipped: true }; }

      setStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 3600 });

      setStatus(`Transcribing ${file.name}…`);
      let transcriptText = '';
      if (file.size > 25 * 1024 * 1024) {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: signed_url });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      } else {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: signed_url });
      }
      if (!transcriptText || transcriptText.length < 20) throw new Error('Transcription came back empty.');

      setStatus(`Saving ${file.name} transcript to brain…`);
      await base44.entities.BobTranscript.create({
        sourceName: file.name, sourceType: 'mp3', transcriptText, fileUri: file_uri, fileHash: hash,
        durationLabel: `${(file.size / 1024 / 1024).toFixed(1)}MB`, tags: `file_hash:${hash}`,
      });

      setStatus(`Extracting Q&A from ${file.name}…`);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract the most important Q&A pairs — customer questions, objections, program details, debt tally questions, and closing techniques. Return as JSON: {"entries":[{"question":"...","answer":"..."}]}. Aim for 10-20 entries.\n\nTRANSCRIPT:\n${transcriptText}`,
        response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
      });
      const entries = (result?.entries || result?.data?.entries || []).map(e => ({ question: e.question, answer: e.answer }));

      setStatus(`Cross-referencing ${file.name}…`);
      const { flagged, clean } = crossReferenceBatch(entries, debtKb());
      for (const e of clean) {
        await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_call', kbName: 'Debt Settlement', source: file.name, tags: `file_hash:${hash}`, created_date: new Date().toISOString() });
      }
      setStatus(`✓ ${file.name}: ${entries.length} extracted, ${clean.length} saved${flagged.length > 0 ? `, ${flagged.length} flagged` : ''}.`);
      loadAll();
      return { flagged, savedCount: clean.length };
    } catch (e) {
      setError(`${file.name} failed: ${e?.message || String(e)}`);
      return { flagged: [], savedCount: 0 };
    }
  };

  // ── Duplicates search: find KB entries with similar questions ──
  const findDuplicates = async () => {
    setSearchingDuplicates(true); setError('');
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
      const groups = [];
      const used = new Set();
      for (let i = 0; i < all.length; i++) {
        if (used.has(all[i].id)) continue;
        const group = [all[i]];
        for (let j = i + 1; j < all.length; j++) {
          if (used.has(all[j].id)) continue;
          if (textSimilarity(all[i].question || '', all[j].question || '') > 0.65) {
            group.push(all[j]); used.add(all[j].id);
          }
        }
        if (group.length > 1) { used.add(all[i].id); groups.push(group); }
      }
      setDuplicateGroups(groups);
      if (groups.length === 0) setStatus('✓ No duplicate entries found in the knowledge base.');
    } catch (e) { setError('Duplicate search failed: ' + (e?.message || String(e))); }
    setSearchingDuplicates(false);
  };

  const deleteDuplicateEntry = async (id) => {
    try {
      await base44.entities.KnowledgeBase.delete(id);
      setDuplicateGroups(prev => prev.map(g => g.filter(e => e.id !== id)).filter(g => g.length > 1));
      loadAll();
    } catch (e) { setError('Delete failed: ' + (e?.message || String(e))); }
  };

  // ── Paste transcript: save → extract Q&A → cross-reference ──
  const handlePaste = async () => {
    const text = pastedText.trim();
    if (!text || pasting) return;
    setPasting(true); setError(''); setStatus('Checking for duplicates…');
    try {
      const hash = await computeTextHash(text);
      const dup = await checkDuplicateHash(hash);
      if (dup.isDuplicate) { setError(`This transcript was already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); setPasting(false); setStatus(''); return; }

      const name = pastedName.trim() || `Pasted transcript ${new Date().toLocaleDateString()}`;
      setStatus('Saving transcript to BOB\'s brain…');
      await base44.entities.BobTranscript.create({
        sourceName: name,
        sourceType: 'pasted',
        transcriptText: text,
        fileHash: hash,
        tags: `file_hash:${hash}`,
      });

      setStatus('Extracting Q&A from transcript…');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract the most important Q&A pairs — customer questions, objections, program details, debt tally questions, and closing techniques. Return as JSON: {"entries":[{"question":"...","answer":"..."}]}. Aim for 10-20 entries.\n\nTRANSCRIPT:\n${text}`,
        response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
      });
      const entries = (result?.entries || result?.data?.entries || []).map(e => ({ question: e.question, answer: e.answer }));

      setStatus('Cross-referencing for duplicate statements…');
      const { flagged, clean } = crossReferenceBatch(entries, debtKb());
      for (const e of clean) {
        await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_call', kbName: 'Debt Settlement', source: name, tags: `file_hash:${hash}`, created_date: new Date().toISOString() });
      }
      if (flagged.length > 0) {
        setConflicts({ flagged, fileHash: hash, source: name });
        setStatus(`${clean.length} new entries saved. ${flagged.length} duplicate-like statements need your review.`);
      } else {
        setStatus(`✓ ${entries.length} entries extracted, ${clean.length} saved. No duplicates found.`);
      }
      setPastedText(''); setPastedName('');
      loadAll();
      onKBUpdated?.();
    } catch (e) {
      setError('Transcript processing failed: ' + (e?.message || String(e)));
    }
    setPasting(false);
    setTimeout(() => { if (!conflicts) setStatus(''); }, 5000);
  };

  // ── Resolve conflicts: save the chosen new entries ──
  const resolveConflicts = async (toSave) => {
    if (!conflicts) return;
    try {
      for (const e of toSave) {
        await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_call', kbName: 'Debt Settlement', source: conflicts.source, tags: `file_hash:${conflicts.fileHash}`, created_date: new Date().toISOString() });
      }
      setStatus(`✓ ${toSave.length} entries saved after conflict resolution.`);
      setConflicts(null);
      loadAll();
      onKBUpdated?.();
    } catch (e) { setError('Save failed: ' + (e?.message || String(e))); }
    setTimeout(() => setStatus(''), 4000);
  };

  const deleteTranscript = async (t) => {
    if (!confirm(`Delete transcript "${t.sourceName}"? This removes it from BOB's brain.`)) return;
    try {
      await base44.entities.BobTranscript.delete(t.id);
      loadAll();
    } catch (e) { setError('Delete failed: ' + (e?.message || String(e))); }
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <StatBox label="Transcripts in Brain" value={transcripts.length} color={PURPLE} />
        <StatBox label="KB Entries" value={kbEntries.length} color={GOLD} />
        <StatBox label="Debt KB Entries" value={debtKb().length} color={PINK} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
        {/* Left: Upload + Paste */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* MP3 upload — batch up to 30, queued 1 at a time */}
          <div style={{ background: 'rgba(244,114,182,0.05)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '6px', padding: '18px' }}>
            <div style={{ color: PINK, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>🎵 Upload Call Recordings (MP3)</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '14px', lineHeight: 1.5 }}>
              The master place to feed BOB new calls. Select <strong style={{ color: PINK }}>up to 30 MP3s at once</strong> — they're queued and processed one at a time (transcribe → save → extract Q&A → cross-reference). Each upload is stored **privately** — no public URL, so access follows your app's permissions.
            </div>
            <input ref={mp3Ref} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files?.length > 0) handleMP3Batch(e.target.files); e.target.value = ''; }} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => mp3Ref.current?.click()} disabled={mp3Uploading} style={{ background: mp3Uploading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f472b6,#ec4899)', color: mp3Uploading ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '11px 22px', cursor: mp3Uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {mp3Uploading ? '⏳ Processing…' : '🎵 Upload MP3s to Brain'}
              </button>
              <button onClick={findDuplicates} disabled={searchingDuplicates || mp3Uploading} style={{ background: searchingDuplicates ? 'rgba(255,255,255,0.05)' : 'rgba(167,139,250,0.15)', color: searchingDuplicates ? '#6b7280' : PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: '4px', padding: '11px 18px', cursor: searchingDuplicates || mp3Uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {searchingDuplicates ? '⏳ Searching…' : '🔍 Find Duplicates'}
              </button>
            </div>
            {/* Queue progress */}
            {mp3QueueProgress && (
              <div style={{ marginTop: '12px', background: 'rgba(244,114,182,0.08)', border: `1px solid ${PINK}33`, borderRadius: '4px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: PINK, fontSize: '11px', fontWeight: 'bold' }}>Processing {mp3QueueProgress.current}/{mp3QueueProgress.total}</span>
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>{mp3QueueProgress.currentName}</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(mp3QueueProgress.current / mp3QueueProgress.total) * 100}%`, background: PINK, borderRadius: '2px', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Paste transcript */}
          <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '18px' }}>
            <div style={{ color: '#60a5fa', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>📝 Paste Transcript</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px' }}>Paste a call transcript. It's saved to the brain and Q&A is extracted + cross-referenced.</div>
            <input value={pastedName} onChange={e => setPastedName(e.target.value)} placeholder="Label (optional) e.g. Closer call — John 10/7" style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', marginBottom: '8px', fontFamily: 'Georgia, serif' }} />
            <textarea value={pastedText} onChange={e => setPastedText(e.target.value)} placeholder="Paste the full transcript here…" rows={5} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'Georgia, serif' }} />
            <button onClick={handlePaste} disabled={pasting || !pastedText.trim()} style={{ marginTop: '8px', background: pasting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: pasting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '9px 20px', cursor: pasting || !pastedText.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: pasting || !pastedText.trim() ? 0.5 : 1 }}>
              {pasting ? '⏳ Processing…' : '📝 Save Transcript to Brain'}
            </button>
          </div>

          {/* Status / error */}
          {status && <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: `1px solid ${GOLD}33`, borderRadius: '4px', color: GOLD, fontSize: '12px' }}>{status}</div>}
          {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: RED, fontSize: '12px' }}>⚠ {error}</div>}

          {/* Recent transcripts */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ color: PURPLE, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>📼 Saved Transcripts ({transcripts.length})</div>
            {loading ? <div style={{ color: '#6b7280', fontSize: '12px' }}>Loading…</div> : transcripts.length === 0 ? (
              <div style={{ color: '#4a5568', fontSize: '12px' }}>No transcripts saved yet. Upload an MP3 or paste one above.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                {transcripts.map(t => (
                  <div key={t.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sourceType === 'mp3' ? '🎵 ' : '📝 '}{t.sourceName}</div>
                      <div style={{ color: '#6b7280', fontSize: '10px' }}>{(t.transcriptText || '').length.toLocaleString()} chars · {t.extractedQaCount || 0} Q&A{t.durationLabel ? ` · ${t.durationLabel}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => setViewingTranscript(t)} style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>View</button>
                      <button onClick={() => deleteTranscript(t)} style={{ background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat with BOB */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ color: PURPLE, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🧠 BOB Scanner & KB Builder</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>Instruct BOB to scan all calls for a topic, catalog the references, enhance the language, and push to the KB.</div>
          </div>
          <BobBrainScanner kbEntries={kbEntries} transcripts={transcripts} onKBChanged={loadAll} />
        </div>
      </div>

      {/* Duplicates search results */}
      {duplicateGroups && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setDuplicateGroups(null)}>
          <div style={{ background: '#0d1b2a', border: `1px solid ${PURPLE}44`, borderRadius: '8px', maxWidth: '750px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: PURPLE, fontSize: '13px', fontWeight: 'bold' }}>🔍 Duplicate KB Entries</div>
                <div style={{ color: '#6b7280', fontSize: '10px' }}>{duplicateGroups.length} groups of similar questions found. Delete the duplicates you don't need.</div>
              </div>
              <button onClick={() => setDuplicateGroups(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
              {duplicateGroups.length === 0 ? (
                <div style={{ color: GOLD, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>✓ No duplicates found!</div>
              ) : duplicateGroups.map((group, gi) => (
                <div key={gi} style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ color: PURPLE, fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Group {gi + 1} — {group.length} similar entries</div>
                  {group.map(e => (
                    <div key={e.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{e.question}</div>
                        <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>{(e.answer || '').slice(0, 120)}{e.answer?.length > 120 ? '…' : ''}</div>
                        <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>{e.category} · {e.source || 'unknown'}</div>
                      </div>
                      <button onClick={() => deleteDuplicateEntry(e.id)} style={{ background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', flexShrink: 0 }}>🗑 Delete</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conflict resolution popup */}
      {conflicts && (
        <ConflictResolutionPopup
          conflicts={conflicts.flagged}
          onResolve={resolveConflicts}
          onClose={() => { setConflicts(null); setStatus(''); }}
        />
      )}

      {/* Transcript viewer */}
      {viewingTranscript && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setViewingTranscript(null)}>
          <div style={{ background: '#0d1b2a', border: `1px solid ${PURPLE}44`, borderRadius: '8px', maxWidth: '700px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: PURPLE, fontSize: '13px', fontWeight: 'bold' }}>{viewingTranscript.sourceType === 'mp3' ? '🎵 ' : '📝 '}{viewingTranscript.sourceName}</div>
              <button onClick={() => setViewingTranscript(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
              {viewingTranscript.transcriptText || 'No transcript text.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Jaccard similarity over significant words — used to group duplicate KB questions.
function textSimilarity(a, b) {
  const aw = new Set((a || '').toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const bw = new Set((b || '').toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (aw.size === 0 || bw.size === 0) return 0;
  const intersection = [...aw].filter(w => bw.has(w)).length;
  const union = new Set([...aw, ...bw]).size;
  return intersection / union;
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${color}33`, borderRadius: '6px', padding: '12px 18px', flex: 1 }}>
      <div style={{ color, fontSize: '22px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
    </div>
  );
}