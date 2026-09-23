/**
 * DebtBobKB.jsx — BOB's Brain: knowledge base upload panel for debt settlement.
 * Upload documents, MP3 call recordings, pasted transcripts, and websites.
 * All extracted Q&A feeds BOB's system prompt — making BOB smarter with every upload.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const DEBT_CATEGORIES = ['debt_kb', 'debt_faq', 'debt_agent', 'debt_customer', 'debt_doc', 'debt_web', 'debt_call'];

const UPLOAD_TABS = [
  { id: 'doc', label: '📄 Document', color: '#a78bfa' },
  { id: 'mp3', label: '🎵 MP3 Call', color: '#f472b6' },
  { id: 'txt', label: '📝 Transcript', color: '#60a5fa' },
  { id: 'web', label: '🌐 Website', color: '#34d399' },
];

export default function DebtBobKB({ onKBUpdated }) {
  const [uploadTab, setUploadTab] = useState('doc');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
      setEntries((all || []).filter(e => DEBT_CATEGORIES.includes(e.category)));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    await load();
    onKBUpdated?.();
  }, [load, onKBUpdated]);

  const del = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    await base44.entities.KnowledgeBase.delete(id);
    refresh();
  };

  // Stats by source type
  const stats = {
    total: entries.length,
    fromCalls: entries.filter(e => e.category === 'debt_call' || e.source?.includes('MP3') || e.source?.includes('Call')).length,
    fromDocs: entries.filter(e => e.category === 'debt_doc').length,
    fromWeb: entries.filter(e => e.category === 'debt_web').length,
    fromAgent: entries.filter(e => e.category === 'debt_agent' || e.category === 'debt_kb').length,
    fromCustomer: entries.filter(e => e.category === 'debt_customer' || e.category === 'debt_faq').length,
  };

  return (
    <div>
      {/* Stats bar — BOB's Brain size */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {[['🧠 Total', stats.total, GOLD], ['🎵 From Calls', stats.fromCalls, '#f472b6'], ['📄 From Docs', stats.fromDocs, '#a78bfa'], ['🌐 From Web', stats.fromWeb, '#34d399'], ['📝 Q&A', stats.fromAgent + stats.fromCustomer, '#60a5fa']].map(([label, count, color]) => (
          <div key={label} style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
            <div style={{ color: color, fontSize: '22px', fontWeight: 'bold' }}>{count}</div>
            <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Upload type selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {UPLOAD_TABS.map(t => (
          <button key={t.id} onClick={() => { setUploadTab(t.id); setStatus(''); setError(''); }}
            style={{ padding: '8px 16px', borderRadius: '4px', border: `1px solid ${uploadTab === t.id ? t.color + '66' : 'rgba(255,255,255,0.1)'}`, background: uploadTab === t.id ? `${t.color}15` : 'transparent', color: uploadTab === t.id ? t.color : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Upload panels */}
      {uploadTab === 'doc' && <DocUploader onStatus={setStatus} onError={setError} onDone={refresh} />}
      {uploadTab === 'mp3' && <MP3Uploader onStatus={setStatus} onError={setError} onDone={refresh} />}
      {uploadTab === 'txt' && <TranscriptUploader onStatus={setStatus} onError={setError} onDone={refresh} />}
      {uploadTab === 'web' && <WebScraper onStatus={setStatus} onError={setError} onDone={refresh} />}

      {(status || error) && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)', border: `1px solid ${error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '4px' }}>
          {status && <div style={{ color: GOLD, fontSize: '12px' }}>{status}</div>}
          {error && <div style={{ color: '#ef4444', fontSize: '12px' }}>⚠ {error}</div>}
        </div>
      )}

      {/* KB Entry List */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>BOB's Knowledge — {entries.length} Entries</div>
          <button onClick={refresh} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
        </div>
        {loading ? <div style={{ color: '#4a5568', padding: '30px 0', textAlign: 'center' }}>Loading…</div> :
         entries.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No entries yet. Upload calls, documents, or websites above to make BOB smarter.</div> :
         <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
           {entries.map(e => (
             <div key={e.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '12px', marginBottom: '6px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                 <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{e.question}</div>
                 <button onClick={() => del(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>Delete</button>
               </div>
               <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{(e.answer || '').slice(0, 200)}{(e.answer || '').length > 200 ? '…' : ''}</div>
               <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                 <span style={{ color: '#4a5568', fontSize: '9px' }}>{e.category}</span>
                 {e.source && <span style={{ color: '#4a5568', fontSize: '9px' }}>· {e.source}</span>}
               </div>
             </div>
           ))}
         </div>}
      </div>
    </div>
  );
}

// ─── Document Uploader ───────────────────────────────────────────────────────
function DocUploader({ onStatus, onError, onDone }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); onError('');
    onStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onStatus('Extracting knowledge from document…');
      const resp = await fetch(file_url);
      const blob = await resp.blob();
      const reader = new FileReader();
      const base64 = await new Promise(resolve => { reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
      const result = await base44.functions.invoke('kbExtractFile', { fileName: file.name, fileType: file.type, base64, kbName: 'Debt Settlement' });
      const extracted = result?.entries || result?.data?.entries || [];
      onStatus(`Saving ${extracted.length} entries to BOB's brain…`);
      for (const e of extracted) {
        await base44.entities.KnowledgeBase.create({
          question: e.question, answer: e.answer,
          category: e.category === 'raw_chunk' ? 'debt_doc' : 'debt_doc',
          source: file.name, kbName: 'Debt Settlement',
          tags: e.keywords || '', created_date: new Date().toISOString(),
        });
      }
      onStatus(`✓ ${extracted.length} entries extracted from ${file.name}! BOB is smarter.`);
      onDone();
      setTimeout(() => onStatus(''), 4000);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setUploading(false);
  };

  return (
    <div style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#a78bfa', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Upload Document</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>PDFs, program docs, compliance materials. AI extracts Q&A and facts to teach BOB.</div>
      <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        style={{ background: uploading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: uploading ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '12px 24px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {uploading ? '⏳ Processing…' : '📁 Upload Document (PDF/TXT)'}
      </button>
    </div>
  );
}

// ─── MP3 Call Recording Uploader ─────────────────────────────────────────────
function MP3Uploader({ onStatus, onError, onDone }) {
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const MAX_BYTES = 50 * 1024 * 1024;

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { onError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB.`); return; }
    setUploading(true); onError(''); setExtracted([]); setSelected(new Set());
    onStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
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
      onStatus('Extracting Q&A from call transcript…');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract the most important Q&A pairs — customer questions, objections, program details, debt tally questions, and closing techniques. Return as JSON: {"entries":[{"question":"...","answer":"..."}]}. Aim for 10-20 entries.\n\nTRANSCRIPT:\n${transcriptText}`,
        response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
      });
      const entries = result?.entries || [];
      setExtracted(entries);
      setSelected(new Set(entries.map((_, i) => i)));
      onStatus(`${entries.length} Q&A pairs extracted. Review and save to BOB's brain.`);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setUploading(false);
  };

  const saveSelected = async () => {
    setSaving(true);
    const toSave = extracted.filter((_, i) => selected.has(i));
    for (const e of toSave) {
      await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_call', kbName: 'Debt Settlement', source: 'MP3 Call Recording', created_date: new Date().toISOString() });
    }
    onStatus(`✓ ${toSave.length} entries saved to BOB's brain!`);
    setExtracted([]); setSelected(new Set());
    onDone();
    setSaving(false);
    setTimeout(() => onStatus(''), 4000);
  };

  return (
    <div style={{ background: 'rgba(244,114,182,0.05)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#f472b6', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Upload Call Recording</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>Upload MP3 recordings of real debt settlement calls (up to 50MB). AI transcribes and extracts Q&A to teach BOB what to say.</div>
      <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        style={{ background: uploading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f472b6,#ec4899)', color: uploading ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '12px 24px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {uploading ? '⏳ Processing…' : '🎵 Upload Call Recording (MP3)'}
      </button>
      {extracted.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ color: '#f472b6', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Extracted Q&A ({extracted.length})</div>
          {extracted.map((entry, i) => (
            <div key={i} style={{ background: selected.has(i) ? 'rgba(244,114,182,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selected.has(i) ? 'rgba(244,114,182,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px', marginBottom: '6px', display: 'flex', gap: '8px' }}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} style={{ cursor: 'pointer', accentColor: '#f472b6', marginTop: '3px' }} />
              <div><div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{entry.question}</div><div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{entry.answer}</div></div>
            </div>
          ))}
          <button onClick={saveSelected} disabled={saving || selected.size === 0}
            style={{ marginTop: '6px', background: 'linear-gradient(135deg,#f472b6,#ec4899)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>
            💾 Save {selected.size} Entries to BOB's Brain
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Transcript Paster ───────────────────────────────────────────────────────
function TranscriptUploader({ onStatus, onError, onDone }) {
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const extract = async () => {
    if (!text.trim()) return;
    setExtracting(true); onError(''); setExtracted([]);
    onStatus('Extracting Q&A from transcript…');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement sales training assistant. Below is a transcript of a real debt settlement call. Extract the most important Q&A pairs — customer questions, objections, program details, debt tally questions, and closing techniques. Return as JSON: {"entries":[{"question":"...","answer":"..."}]}. Aim for 10-20 entries.\n\nTRANSCRIPT:\n${text}`,
        response_json_schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } } } },
      });
      const entries = result?.entries || [];
      setExtracted(entries);
      setSelected(new Set(entries.map((_, i) => i)));
      onStatus(`${entries.length} Q&A pairs extracted. Review and save.`);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setExtracting(false);
  };

  const saveSelected = async () => {
    setSaving(true);
    const toSave = extracted.filter((_, i) => selected.has(i));
    for (const e of toSave) {
      await base44.entities.KnowledgeBase.create({ ...e, category: 'debt_call', kbName: 'Debt Settlement', source: 'Pasted Transcript', created_date: new Date().toISOString() });
    }
    onStatus(`✓ ${toSave.length} entries saved to BOB's brain!`);
    setExtracted([]); setSelected(new Set()); setText('');
    onDone();
    setSaving(false);
    setTimeout(() => onStatus(''), 4000);
  };

  return (
    <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#60a5fa', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Paste Call Transcript</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '12px' }}>Paste a text transcript of a real debt settlement call. AI extracts Q&A pairs to teach BOB.</div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="Paste call transcript here…" style={{ ...inp, resize: 'vertical', marginBottom: '12px' }} />
      <button onClick={extract} disabled={extracting || !text.trim()}
        style={{ background: extracting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: extracting ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: extracting ? 0.5 : 1 }}>
        {extracting ? '⏳ Extracting…' : '🔍 Extract Q&A'}
      </button>
      {extracted.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {extracted.map((entry, i) => (
            <div key={i} style={{ background: selected.has(i) ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selected.has(i) ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px', marginBottom: '6px', display: 'flex', gap: '8px' }}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} style={{ cursor: 'pointer', accentColor: '#60a5fa', marginTop: '3px' }} />
              <div><div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{entry.question}</div><div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{entry.answer}</div></div>
            </div>
          ))}
          <button onClick={saveSelected} disabled={saving || selected.size === 0}
            style={{ marginTop: '6px', background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>
            💾 Save {selected.size} Entries to BOB's Brain
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Website Scraper ─────────────────────────────────────────────────────────
function WebScraper({ onStatus, onError, onDone }) {
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);

  const scrape = async () => {
    if (!url.trim()) return;
    setScraping(true); onError('');
    onStatus('Scraping website…');
    try {
      const result = await base44.functions.invoke('kbScrapeUrl', { url: url.trim() });
      const entries = result?.entries || result?.data?.entries || [];
      onStatus(`Saving ${entries.length} entries to BOB's brain…`);
      for (const e of entries) {
        await base44.entities.KnowledgeBase.create({
          question: e.question, answer: e.answer,
          category: 'debt_web', source: url.trim(), kbName: 'Debt Settlement',
          created_date: new Date().toISOString(),
        });
      }
      onStatus(`✓ ${entries.length} entries saved from ${url}!`);
      setUrl('');
      onDone();
      setTimeout(() => onStatus(''), 4000);
    } catch (e) { onError('Failed: ' + (e?.message || String(e))); }
    setScraping(false);
  };

  return (
    <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: '#34d399', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Scrape Website</div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>Enter a URL — competitor sites, program info pages, debt settlement resources. AI extracts Q&A to teach BOB.</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/debt-settlement-program" style={{ ...inp, flex: 1 }} />
        <button onClick={scrape} disabled={scraping || !url.trim()}
          style={{ background: scraping ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#34d399,#10b981)', color: scraping ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '0 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {scraping ? '⏳ Scraping…' : '🌐 Scrape'}
        </button>
      </div>
    </div>
  );
}