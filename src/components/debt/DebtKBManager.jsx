/**
 * DebtKBManager.jsx — Extensive debt settlement knowledge base manager.
 * Separates: Agent Scripts | Customer Q&A | Documents | Websites | MP3 Call Recordings.
 * Uses kbExtractFile (docs), kbScrapeUrl (websites), transcribeAudioLarge (MP3s).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const KB_SECTIONS = [
  { id: 'agent', label: '🎙️ Agent Scripts', category: 'debt_agent', color: '#60a5fa', desc: 'Openers, talking points, rebuttals, and closing scripts for the agent.' },
  { id: 'customer', label: '👤 Customer Q&A', category: 'debt_customer', color: '#f59e0b', desc: 'Common customer questions with pre-written answers for instant Q&A lookup.' },
  { id: 'docs', label: '📄 Documents', category: 'debt_doc', color: '#a78bfa', desc: 'Upload PDFs, program docs, compliance materials. AI extracts Q&A + raw chunks.' },
  { id: 'web', label: '🌐 Websites', category: 'debt_web', color: '#34d399', desc: 'Scrape competitor sites, program info pages, debt settlement resources.' },
  { id: 'mp3', label: '🎵 MP3 Call Recordings', category: 'debt_call', color: '#f472b6', desc: 'Upload real call recordings. AI transcribes and extracts Q&A + generates scripts.' },
];

export default function DebtKBManager() {
  const [section, setSection] = useState('agent');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.entities.KnowledgeBase.list('-created_date', 500)
      .then(all => {
        const cat = KB_SECTIONS.find(s => s.id === section).category;
        setEntries((all || []).filter(e => e.category === cat || (cat === 'debt_customer' && (e.category === 'debt_kb' || e.category === 'debt_faq'))));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [section]);

  const loadEntries = useCallback(async () => {
    const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
    const cat = KB_SECTIONS.find(s => s.id === section).category;
    setEntries((all || []).filter(e => e.category === cat || (cat === 'debt_customer' && (e.category === 'debt_kb' || e.category === 'debt_faq'))));
  }, [section]);

  const refresh = useCallback(async () => {
    await loadEntries();
    window.dispatchEvent(new CustomEvent('debt_kb_updated'));
  }, [loadEntries]);

  // Listen for KB updates from BOB's Brain — shared learning
  useEffect(() => {
    const handler = () => loadEntries();
    window.addEventListener('debt_kb_updated', handler);
    return () => window.removeEventListener('debt_kb_updated', handler);
  }, [loadEntries]);

  return (
    <div>
      {/* BOB shared learning banner */}
      <div style={{ marginBottom: '16px', padding: '10px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>🤖</span>
        <div>
          <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold' }}>BOB uses this knowledge</div>
          <div style={{ color: '#6b7280', fontSize: '10px' }}>Every entry here — scripts, Q&A, docs, calls, websites — feeds BOB's brain in the Training tab. BOB gets smarter with every upload.</div>
        </div>
      </div>

      {/* Section selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {KB_SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{ padding: '12px 18px', borderRadius: '6px', border: `2px solid ${section === s.id ? s.color : s.color + '33'}`, background: section === s.id ? `${s.color}15` : 'rgba(0,0,0,0.2)', color: section === s.id ? s.color : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', textAlign: 'left' }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'agent' && <AgentScriptEditor category={KB_SECTIONS[0].category} onSaved={refresh} />}
      {section === 'customer' && <CustomerQAEditor category={KB_SECTIONS[1].category} onSaved={refresh} />}
      {section === 'docs' && <DocUploader category={KB_SECTIONS[2].category} onSaved={refresh} />}
      {section === 'web' && <WebScraper category={KB_SECTIONS[3].category} onSaved={refresh} />}
      {section === 'mp3' && <MP3Uploader category={KB_SECTIONS[4].category} onSaved={refresh} />}

      {/* Entry list */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {KB_SECTIONS.find(s => s.id === section).label} — {entries.length} Entries
          </div>
          <button onClick={refresh} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
        </div>
        {loading ? (
          <div style={{ color: '#4a5568', padding: '30px 0', textAlign: 'center' }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No entries yet. Add content above.</div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {entries.map(e => (
              <div key={e.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '14px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{e.question}</div>
                  <button onClick={async () => { await base44.entities.KnowledgeBase.delete(e.id); refresh(); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                </div>
                <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{e.answer?.slice(0, 300)}{e.answer?.length > 300 ? '…' : ''}</div>
                {e.source && <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>Source: {e.source}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Script Editor ──────────────────────────────────────────────────────
function AgentScriptEditor({ category, onSaved }) {
  const [form, setForm] = useState({ question: '', answer: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    setSaving(true);
    await base44.entities.KnowledgeBase.create({ ...form, category, kbName: 'Debt Settlement', created_date: new Date().toISOString() });
    setForm({ question: '', answer: '' });
    onSaved();
    setSaving(false);
  };

  return (
    <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#60a5fa', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Add Agent Script / Talking Point</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>Openers, rebuttals, qualifying questions, closing language. These power the Coach tool during live calls.</div>
      <div style={{ marginBottom: '10px' }}><label style={ls}>Title / Topic</label><input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="e.g. Opener — Transferred Call Greeting" style={inp} /></div>
      <div style={{ marginBottom: '10px' }}><label style={ls}>Script Content</label><textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} rows={5} style={{ ...inp, resize: 'vertical' }} /></div>
      <button onClick={save} disabled={saving || !form.question.trim() || !form.answer.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>+ Add Script</button>
    </div>
  );
}

// ─── Customer Q&A Editor ─────────────────────────────────────────────────────
function CustomerQAEditor({ category, onSaved }) {
  const [form, setForm] = useState({ question: '', answer: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    setSaving(true);
    await base44.entities.KnowledgeBase.create({ ...form, category, kbName: 'Debt Settlement', created_date: new Date().toISOString() });
    setForm({ question: '', answer: '' });
    onSaved();
    setSaving(false);
  };

  return (
    <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Add Customer Q&A</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>Common questions customers ask about debt settlement. These power the live Q&A tool for instant answers.</div>
      <div style={{ marginBottom: '10px' }}><label style={ls}>Customer Question</label><input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="e.g. How does this affect my credit score?" style={inp} /></div>
      <div style={{ marginBottom: '10px' }}><label style={ls}>Answer</label><textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} rows={4} style={{ ...inp, resize: 'vertical' }} /></div>
      <button onClick={save} disabled={saving || !form.question.trim() || !form.answer.trim()} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>+ Add Q&A</button>
    </div>
  );
}

// ─── Document Uploader ───────────────────────────────────────────────────────
function DocUploader({ category, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setError(''); setStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
    try {
      // Upload to public storage
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setStatus('Extracting knowledge from document (this may take a minute)…');
      // Fetch as base64 for kbExtractFile
      const resp = await fetch(file_url);
      const blob = await resp.blob();
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => { reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
      const result = await base44.functions.invoke('kbExtractFile', {
        fileName: file.name,
        fileType: file.type,
        base64,
        kbName: 'Debt Settlement',
      });
      const entries = result?.entries || result?.data?.entries || [];
      setStatus(`Extracted ${entries.length} entries. Saving to KB…`);
      // Save entries with debt category
      for (const e of entries) {
        await base44.entities.KnowledgeBase.create({
          question: e.question,
          answer: e.answer,
          category: e.category === 'raw_chunk' ? 'raw_chunk' : category,
          source: file.name,
          kbName: 'Debt Settlement',
          tags: e.keywords || '',
          created_date: new Date().toISOString(),
        });
      }
      setStatus(`✓ ${entries.length} entries extracted and saved from ${file.name}!`);
      onSaved();
      setTimeout(() => setStatus(''), 5000);
    } catch (e) {
      setError('Failed: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  return (
    <div style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#a78bfa', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Upload Document</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>PDFs, program docs, compliance materials. AI runs a 3-pass extraction: exhaustive Q&A, atomic facts, and raw text chunks for full-text search.</div>
      <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: uploading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: uploading ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '12px 24px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {uploading ? '⏳ Processing…' : '📁 Upload Document (PDF/TXT)'}
      </button>
      {status && <div style={{ color: '#a78bfa', fontSize: '12px', marginTop: '10px' }}>{status}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '10px' }}>⚠ {error}</div>}
    </div>
  );
}

// ─── Website Scraper ──────────────────────────────────────────────────────────
function WebScraper({ category, onSaved }) {
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const scrape = async () => {
    if (!url.trim()) return;
    setScraping(true); setError(''); setStatus('Scraping website…');
    try {
      const result = await base44.functions.invoke('kbScrapeUrl', { url: url.trim() });
      const entries = result?.entries || result?.data?.entries || [];
      setStatus(`Extracted ${entries.length} entries. Saving to KB…`);
      for (const e of entries) {
        await base44.entities.KnowledgeBase.create({
          question: e.question,
          answer: e.answer,
          category: e.category === 'raw_document' ? 'raw_document' : category,
          source: url.trim(),
          kbName: 'Debt Settlement',
          created_date: new Date().toISOString(),
        });
      }
      setStatus(`✓ ${entries.length} entries saved from ${url}!`);
      setUrl('');
      onSaved();
      setTimeout(() => setStatus(''), 5000);
    } catch (e) {
      setError('Failed: ' + (e?.message || String(e)));
    }
    setScraping(false);
  };

  return (
    <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#34d399', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Scrape Website</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>Enter a URL — competitor sites, program info pages, debt settlement resources. AI extracts Q&A pairs and stores raw text.</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/debt-settlement-program" style={{ ...inp, flex: 1 }} />
        <button onClick={scrape} disabled={scraping || !url.trim()} style={{ background: scraping ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#34d399,#10b981)', color: scraping ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '0 20px', cursor: scraping ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {scraping ? '⏳ Scraping…' : '🌐 Scrape'}
        </button>
      </div>
      {status && <div style={{ color: '#34d399', fontSize: '12px', marginTop: '10px' }}>{status}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '10px' }}>⚠ {error}</div>}
    </div>
  );
}

// ─── MP3 Call Recording Uploader ──────────────────────────────────────────────
function MP3Uploader({ category, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [extractedEntries, setExtractedEntries] = useState([]);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const MAX_BYTES = 50 * 1024 * 1024;

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB.`); return; }
    setUploading(true); setError(''); setTranscript(''); setExtractedEntries([]); setSelectedEntries(new Set());
    setStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setStatus('Transcribing audio…');
      let transcriptText;
      if (file.size > 25 * 1024 * 1024) {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: file_url });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      } else {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      }
      setTranscript(typeof transcriptText === 'string' ? transcriptText : JSON.stringify(transcriptText));
      setStatus('Extracting Q&A from transcript…');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract the most important Q&A pairs — customer questions, objections, program details, debt tally questions, and closing techniques. Return as JSON: {"entries":[{"question":"...","answer":"..."}]}. Aim for 10-20 entries.\n\nTRANSCRIPT:\n${transcriptText}`,
        response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
      });
      const entries = result?.entries || [];
      setExtractedEntries(entries);
      setSelectedEntries(new Set(entries.map((_, i) => i)));
      setStatus(`${entries.length} Q&A pairs extracted. Extracting closer pitches…`);

      // Extract closer pitches — file name (without extension) = closer name
      const closerName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim();
      try {
        const pitchResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a sales pitch analyst. Below is a transcript of a real debt settlement call by a closer named "${closerName}". Extract the distinct pitches and techniques used, organized by type. For each, capture the actual language and approach the closer used.

Return JSON with a "pitches" array, each having: title (short label), content (the actual pitch language/approach), pitchType (one of: opener, discovery, pitch, rebuttal, closer, full_call).

Look for:
- OPENER: How they greet and transition from the transfer
- DISCOVERY: Questions they ask to qualify the prospect
- PITCH: How they explain the program and its benefits
- REBUTTAL: How they handle specific objections (bankruptcy, cost, credit impact, "think about it")
- CLOSER: The closing language and enrollment process

Aim for 3-8 distinct pitches. Base them on what the closer ACTUALLY said in the transcript.

TRANSCRIPT:
${transcriptText}`,
          response_json_schema: {
            type: 'object',
            properties: {
              pitches: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                    pitchType: { type: 'string' },
                  },
                },
              },
            },
          },
        });
        const pitches = pitchResult?.pitches || [];
        for (const p of pitches) {
          await base44.entities.CloserPitch.create({
            closerName,
            title: p.title || 'Untitled',
            content: p.content || '',
            pitchType: ['opener', 'discovery', 'pitch', 'rebuttal', 'closer', 'full_call'].includes(p.pitchType) ? p.pitchType : 'pitch',
            source: file.name,
            tags: 'mp3-extracted',
          });
        }
        setStatus(`${entries.length} Q&A pairs + ${pitches.length} closer pitches extracted for "${closerName}". Review Q&A below.`);
      } catch (e) {
        setStatus(`${entries.length} Q&A pairs extracted. Pitch extraction failed: ${e?.message || e}.`);
      }
    } catch (e) {
      setError('Failed: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  const saveSelected = async () => {
    setSaving(true);
    const toSave = extractedEntries.filter((_, i) => selectedEntries.has(i));
    for (const e of toSave) {
      await base44.entities.KnowledgeBase.create({ ...e, category, kbName: 'Debt Settlement', source: 'MP3 Call Recording', created_date: new Date().toISOString() });
    }
    setStatus(`✓ ${toSave.length} entries saved!`);
    setExtractedEntries([]); setSelectedEntries(new Set()); setTranscript('');
    onSaved();
    setSaving(false);
    setTimeout(() => setStatus(''), 4000);
  };

  return (
    <div style={{ background: 'rgba(244,114,182,0.05)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#f472b6', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Upload Call Recording</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>Upload MP3 recordings of real debt settlement calls (up to 50MB). AI transcribes and extracts Q&A pairs for the knowledge base.</div>
      <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: uploading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f472b6,#ec4899)', color: uploading ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '12px 24px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {uploading ? '⏳ Processing…' : '🎵 Upload Call Recording (MP3)'}
      </button>
      {status && <div style={{ color: '#f472b6', fontSize: '12px', marginTop: '10px' }}>{status}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '10px' }}>⚠ {error}</div>}
      {transcript && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Transcript Preview</div>
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '10px', maxHeight: '120px', overflowY: 'auto', fontSize: '11px', color: '#8a9ab8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{transcript.slice(0, 1500)}{transcript.length > 1500 ? '…' : ''}</div>
        </div>
      )}
      {extractedEntries.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ color: '#f472b6', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Extracted Q&A ({extractedEntries.length})</div>
          {extractedEntries.map((entry, i) => (
            <div key={i} style={{ background: selectedEntries.has(i) ? 'rgba(244,114,182,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedEntries.has(i) ? 'rgba(244,114,182,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px', marginBottom: '6px', display: 'flex', gap: '8px' }}>
              <input type="checkbox" checked={selectedEntries.has(i)} onChange={() => setSelectedEntries(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} style={{ cursor: 'pointer', accentColor: '#f472b6', marginTop: '3px' }} />
              <div><div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{entry.question}</div><div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5 }}>{entry.answer}</div></div>
            </div>
          ))}
          <button onClick={saveSelected} disabled={saving || selectedEntries.size === 0} style={{ marginTop: '6px', background: 'linear-gradient(135deg,#f472b6,#ec4899)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>💾 Save {selectedEntries.size} Entries</button>
        </div>
      )}
    </div>
  );
}