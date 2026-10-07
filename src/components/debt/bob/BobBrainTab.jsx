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
import BobBrainChat from './BobBrainChat';
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

  // ── MP3 upload: transcribe → save transcript → extract Q&A → cross-reference ──
  const handleMP3 = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB.`); return; }
    setMp3Uploading(true); setError(''); setStatus('Checking for duplicates…');
    try {
      const hash = await computeFileHash(file);
      const dup = await checkDuplicateHash(hash);
      if (dup.isDuplicate) { setError(`This recording was already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()}. Skipping.`); setMp3Uploading(false); setStatus(''); return; }

      setStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 3600 });

      setStatus('Transcribing audio…');
      let transcriptText = '';
      if (file.size > 25 * 1024 * 1024) {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: signed_url });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      } else {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: signed_url });
      }
      if (!transcriptText || transcriptText.length < 20) throw new Error('Transcription came back empty.');

      setStatus('Saving transcript to BOB\'s brain…');
      await base44.entities.BobTranscript.create({
        sourceName: file.name,
        sourceType: 'mp3',
        transcriptText,
        fileUri: file_uri,
        fileHash: hash,
        durationLabel: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        tags: `file_hash:${hash}`,
      });

      setStatus('Extracting Q&A from transcript…');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract the most important Q&A pairs — customer questions, objections, program details, debt tally questions, and closing techniques. Return as JSON: {"entries":[{"question":"...","answer":"..."}]}. Aim for 10-20 entries.\n\nTRANSCRIPT:\n${transcriptText}`,
        response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
      });
      const entries = (result?.entries || result?.data?.entries || []).map(e => ({ question: e.question, answer: e.answer }));

      setStatus('Cross-referencing for duplicate statements…');
      const { flagged, clean } = crossReferenceBatch(entries, debtKb());

      // Save the clean (non-duplicate) entries immediately
      for (const e of clean) {
        await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_call', kbName: 'Debt Settlement', source: file.name, tags: `file_hash:${hash}`, created_date: new Date().toISOString() });
      }

      if (flagged.length > 0) {
        setConflicts({ flagged, fileHash: hash, source: file.name });
        setStatus(`${clean.length} new entries saved. ${flagged.length} duplicate-like statements need your review.`);
      } else {
        setStatus(`✓ ${entries.length} entries extracted, ${clean.length} saved to BOB's brain. No duplicates found.`);
      }
      loadAll();
      onKBUpdated?.();
    } catch (e) {
      setError('MP3 processing failed: ' + (e?.message || String(e)));
    }
    setMp3Uploading(false);
    setTimeout(() => { if (!conflicts) setStatus(''); }, 5000);
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
          {/* MP3 upload */}
          <div style={{ background: 'rgba(244,114,182,0.05)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '6px', padding: '18px' }}>
            <div style={{ color: PINK, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>🎵 Upload Call Recording (MP3)</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '14px', lineHeight: 1.5 }}>
              The master place to feed BOB new calls. Each MP3 is <strong style={{ color: PINK }}>auto-transcribed and the transcript is saved to the brain</strong> — so BOB gets smarter with every upload. Q&A is then extracted and cross-referenced for duplicates.
            </div>
            <input ref={mp3Ref} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMP3(f); e.target.value = ''; }} />
            <button onClick={() => mp3Ref.current?.click()} disabled={mp3Uploading} style={{ background: mp3Uploading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f472b6,#ec4899)', color: mp3Uploading ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '11px 22px', cursor: mp3Uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {mp3Uploading ? '⏳ Processing…' : '🎵 Upload MP3 to Brain'}
            </button>
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
            <div style={{ color: PURPLE, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>💬 Chat with BOB</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>Ask what it knows, tell it what to forget, or teach it something new.</div>
          </div>
          <BobBrainChat kbEntries={kbEntries} transcripts={transcripts} onKBChanged={loadAll} />
        </div>
      </div>

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

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${color}33`, borderRadius: '6px', padding: '12px 18px', flex: 1 }}>
      <div style={{ color, fontSize: '22px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
    </div>
  );
}