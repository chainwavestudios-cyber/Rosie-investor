/**
 * FronterQAPopup.jsx — Floating, draggable, resizable live Q&A popup for fronters.
 * Two-column layout: Q&A/KB on left, live transcript on right.
 * KB tab supports manual entries + document upload (txt, pdf, doc) + MP3 call upload.
 * Documents and MP3s are processed by AI to extract Q&A pairs into the KB.
 * Live transcript auto-polls the latest FronterCallTranscript for the fronter.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterQAPopup({ username, onClose, externalTranscript }) {
  const [qaTab, setQaTab] = useState('qa');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [kbEntries, setKbEntries] = useState([]);
  const [kbSearch, setKbSearch] = useState('');
  const [showAddKb, setShowAddKb] = useState(false);
  const [kbForm, setKbForm] = useState({ question: '', answer: '', category: '' });
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [editedAnswer, setEditedAnswer] = useState('');
  const [editingKbId, setEditingKbId] = useState(null);
  const [editKbForm, setEditKbForm] = useState({ question: '', answer: '', category: '' });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingMp3, setUploadingMp3] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [objections, setObjections] = useState([]);
  const [transcriptInfo, setTranscriptInfo] = useState(null);
  const [pos, setPos] = useState({ x: 120, y: 60 });
  const [size, setSize] = useState({ w: 720, h: 560 });
  const dragRef = useRef(null);
  const docFileRef = useRef(null);
  const mp3FileRef = useRef(null);
  const transcriptScrollRef = useRef(null);

  const loadKb = async () => {
    try {
      const all = await base44.entities.FronterKnowledgeBase.list('-created_date', 500);
      setKbEntries(all || []);
    } catch {}
  };

  const loadTranscript = async () => {
    if (externalTranscript || !username) return;
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const result = await base44.entities.FronterCallTranscript.filter(
        { fronterUsername: username, callDate: { $gte: todayStart.toISOString() } },
        '-callDate', 1
      );
      const records = Array.isArray(result) ? result : (result?.items || []);
      const latest = records[0];
      if (latest) {
        let lines = [];
        try { lines = JSON.parse(latest.transcriptJson || '[]'); } catch {}
        setLiveTranscript(lines);
        setTranscriptInfo({ leadName: latest.leadName, callDate: latest.callDate, lineCount: lines.length });
      } else {
        setLiveTranscript([]);
        setTranscriptInfo(null);
      }
    } catch {}
  };

  const loadObjections = async () => {
    try {
      const all = await base44.entities.Objection.filter({ enabled: true }, 'sortOrder', 100);
      setObjections(all || []);
    } catch {}
  };

  const detectObjections = (lines) => {
    const customerLines = (lines || []).filter(l => l.speaker !== 0);
    const detected = [];
    for (const line of customerLines) {
      const text = (line.text || '').toLowerCase().trim();
      for (const obj of objections) {
        let triggers = [];
        try { triggers = JSON.parse(obj.triggerPhrases || '[]'); } catch {}
        if (triggers.some(t => text.includes(t.toLowerCase()))) {
          if (!detected.find(d => d.id === obj.id)) detected.push({ ...obj, matchedText: line.text });
        }
      }
    }
    return detected;
  };

  // Use external transcript (from BOB trainer) if provided, otherwise poll DB
  useEffect(() => {
    if (!externalTranscript) return;
    const mapped = externalTranscript.map(l => ({ speaker: l.role === 'bob' ? 1 : 0, text: l.text }));
    setLiveTranscript(mapped);
    setTranscriptInfo({ leadName: 'BOB Training', callDate: new Date().toISOString(), lineCount: mapped.length });
  }, [externalTranscript]);

  useEffect(() => {
    loadKb();
    loadObjections();
    if (!externalTranscript) loadTranscript();
    const kbInterval = setInterval(loadKb, 10000);
    const transcriptInterval = externalTranscript ? null : setInterval(loadTranscript, 3000);
    return () => { clearInterval(kbInterval); if (transcriptInterval) clearInterval(transcriptInterval); };
  }, [username, externalTranscript]);

  // Auto-scroll transcript
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [liveTranscript.length]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => {
      if (!dragRef.current) return;
      setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const ask = async (overrideQuestion) => {
    const q = (overrideQuestion || question).trim();
    if (!q) return;
    setAsking(true); setAnswer('');
    try {
      const kbContext = kbEntries.map(e => {
        const alts = parseAlts(e);
        const altStr = alts.length > 0 ? `\n(Also matches: ${alts.join('; ')})` : '';
        return `Q: ${e.question}\nA: ${e.answer}${altStr}`;
      }).join('\n\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a helpful sales assistant for a debt settlement fronter (caller). Answer the following question using the knowledge base below and your general knowledge. If the KB has a relevant answer, use it. Otherwise, provide a helpful answer from your general knowledge. Keep answers clear, concise, and actionable — the fronter may be on a live call.

KNOWLEDGE BASE:
${kbContext || '(empty — use general knowledge)'}

QUESTION: ${q}

Provide a clear, concise answer:`,
      });
      setAnswer(res || 'No answer generated.');
      setEditedAnswer(res || 'No answer generated.');
      setEditingAnswer(false);
    } catch (e) { setAnswer('Error: ' + (e?.message || String(e))); }
    setAsking(false);
  };

  const addKbEntry = async () => {
    if (!kbForm.question.trim() || !kbForm.answer.trim()) return;
    try {
      await base44.entities.FronterKnowledgeBase.create({
        question: kbForm.question.trim(), answer: kbForm.answer.trim(), category: kbForm.category,
        sourceType: 'manual',
      });
      setKbForm({ question: '', answer: '', category: '' }); setShowAddKb(false); loadKb();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const deleteKb = async (id) => {
    if (!confirm('Delete this KB entry?')) return;
    await base44.entities.FronterKnowledgeBase.delete(id); loadKb();
  };

  const startEditKb = (e) => {
    setEditingKbId(e.id);
    setEditKbForm({ question: e.question || '', answer: e.answer || '', category: e.category || '' });
  };

  const saveEditKb = async (id) => {
    if (!editKbForm.question.trim() || !editKbForm.answer.trim()) return;
    try {
      await base44.entities.FronterKnowledgeBase.update(id, {
        question: editKbForm.question.trim(),
        answer: editKbForm.answer.trim(),
        category: editKbForm.category,
      });
      setEditingKbId(null); loadKb();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const saveAnswerToKb = async () => {
    if (!editedAnswer.trim()) return;
    try {
      await base44.entities.FronterKnowledgeBase.create({
        question: (question || 'Saved from Q&A').trim(),
        answer: editedAnswer.trim(),
        category: 'From Q&A',
        sourceType: 'manual',
      });
      setEditingAnswer(false);
      loadKb();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  // ── Document upload (txt, pdf, doc) → extract Q&A ──
  const handleDocUpload = async (file) => {
    if (!file) return;
    setUploadingDoc(true); setUploadStatus('');
    try {
      let text = '';
      const fileName = file.name;
      const ext = fileName.split('.').pop().toLowerCase();

      if (ext === 'txt') {
        text = await file.text();
      } else {
        setUploadStatus('Uploading document…');
        const upRes = await base44.integrations.Core.UploadPublicFile({ file });
        const fileUrl = upRes?.file_url;
        if (!fileUrl) throw new Error('Upload failed');
        setUploadStatus('Extracting text from document…');
        const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: fileUrl,
          json_schema: { type: 'object', properties: { fullText: { type: 'string' } } },
        });
        text = extractRes?.output?.fullText || extractRes?.output || '';
        if (typeof text !== 'string') text = JSON.stringify(text);
      }

      if (!text || text.trim().length < 10) throw new Error('Could not extract text from document');

      setUploadStatus('Extracting Q&A pairs with AI…');
      const qaRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a knowledge base builder for a debt settlement sales team. Extract question-and-answer pairs from the following document. Each Q&A pair should be a question a fronter might ask during a call, with a clear, concise answer from the document.

Return a JSON object with a "qaPairs" array, where each item has "question" and "answer" fields. Extract as many relevant Q&A pairs as possible (aim for 5-20). Focus on sales-relevant information: objection handling, program details, qualifying questions, company info, process steps, etc.

DOCUMENT CONTENT:
${text.slice(0, 15000)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            qaPairs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const pairs = qaRes?.qaPairs || [];
      if (pairs.length === 0) throw new Error('No Q&A pairs found in document');

      // Save all pairs to KB
      const records = pairs.map(p => ({
        question: p.question,
        answer: p.answer,
        category: 'From Document',
        sourceType: 'document',
        sourceFileName: fileName,
      }));
      await base44.entities.FronterKnowledgeBase.bulkCreate(records);
      setUploadStatus(`✓ Extracted ${pairs.length} Q&A pairs from "${fileName}"`);
      loadKb();
      setTimeout(() => setUploadStatus(''), 5000);
    } catch (e) {
      setUploadStatus('✗ Error: ' + (e?.message || String(e)));
      setTimeout(() => setUploadStatus(''), 8000);
    }
    setUploadingDoc(false);
  };

  // ── MP3 call upload → transcribe → extract Q&A ──
  const handleMp3Upload = async (file) => {
    if (!file) return;
    setUploadingMp3(true); setUploadStatus('');
    try {
      const fileName = file.name;
      setUploadStatus('Uploading MP3…');
      const upRes = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = upRes?.file_url;
      if (!fileUrl) throw new Error('Upload failed');

      setUploadStatus('Transcribing audio…');
      const transRes = await base44.integrations.Core.TranscribeAudio({ audio_url: fileUrl });
      const transcript = transRes || '';
      if (!transcript || transcript.trim().length < 10) throw new Error('Transcription failed');

      setUploadStatus('Extracting Q&A from transcript…');
      const qaRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a knowledge base builder for a debt settlement sales team. You are given a transcript of a real sales call. Extract question-and-answer pairs that would be useful for training other fronters. Focus on:
- Objection handling (what the customer asked/said and how the agent responded)
- Qualifying questions the agent asked
- Program explanations the agent gave
- Common customer concerns and the agent's responses

Return a JSON object with a "qaPairs" array, where each item has "question" and "answer" fields. The "question" should be the customer's question or concern, and the "answer" should be the agent's response. Extract 5-15 relevant pairs.

CALL TRANSCRIPT:
${transcript.slice(0, 15000)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            qaPairs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const pairs = qaRes?.qaPairs || [];
      if (pairs.length === 0) throw new Error('No Q&A pairs found in transcript');

      const records = pairs.map(p => ({
        question: p.question,
        answer: p.answer,
        category: 'From Call Recording',
        sourceType: 'mp3_call',
        sourceFileName: fileName,
      }));
      await base44.entities.FronterKnowledgeBase.bulkCreate(records);
      setUploadStatus(`✓ Extracted ${pairs.length} Q&A pairs from "${fileName}"`);
      loadKb();
      setTimeout(() => setUploadStatus(''), 5000);
    } catch (e) {
      setUploadStatus('✗ Error: ' + (e?.message || String(e)));
      setTimeout(() => setUploadStatus(''), 8000);
    }
    setUploadingMp3(false);
  };

  const parseAlts = (e) => { try { return JSON.parse(e.alternativeQuestions || '[]'); } catch { return []; } };

  // Detect questions/statements-as-questions from customer transcript lines
  const detectQuestions = (lines) => {
    const qWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'will', 'is', 'are', 'do', 'does', 'have', 'has', 'should', 'may', 'might', 'so'];
    const stmtPatterns = ["i'm not sure", "i was wondering", "i don't understand", "what do you mean", "can you explain", "tell me about", "how does it work", "i don't know", "not really sure", "what exactly", "i don't get", "confused about", "i have a question", "quick question", "how much", "how long"];
    return (lines || [])
      .filter(l => l.speaker !== 0)
      .filter(l => {
        const t = (l.text || '').toLowerCase().trim();
        if (t.endsWith('?')) return true;
        if (qWords.some(w => t.startsWith(w + ' '))) return true;
        if (stmtPatterns.some(p => t.includes(p))) return true;
        return false;
      });
  };

  // Match a question against KB entries (local string matching, no API call)
  const matchKb = (question) => {
    const q = (question || '').toLowerCase().trim();
    if (!q || kbEntries.length === 0) return null;
    let best = null, bestScore = 0;
    for (const e of kbEntries) {
      const eq = (e.question || '').toLowerCase();
      const alts = parseAlts(e).map(a => a.toLowerCase());
      let score = 0;
      if (eq === q) score = 100;
      else if (alts.some(a => a === q)) score = 90;
      else if (eq.includes(q) || q.includes(eq)) score = 70;
      else if (alts.some(a => a.includes(q) || q.includes(a))) score = 60;
      else {
        const qWords = q.split(/\s+/).filter(w => w.length > 3);
        const allKb = (eq + ' ' + alts.join(' ')).split(/\s+/);
        score = qWords.filter(w => allKb.includes(w)).length * 10;
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return bestScore >= 20 ? best : null;
  };

  const detectedQuestions = detectQuestions(liveTranscript);
  const detectedObjections = detectObjections(liveTranscript);

  const filteredKb = kbSearch.trim()
    ? kbEntries.filter(e => {
        const q = (e.question || '').toLowerCase();
        const a = (e.answer || '').toLowerCase();
        const alts = parseAlts(e).join(' ').toLowerCase();
        const s = kbSearch.toLowerCase();
        return q.includes(s) || a.includes(s) || alts.includes(s);
      })
    : kbEntries;

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <span style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>💬 Live Q&A</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', padding: 0, lineHeight: 1 }}>×</button>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left column: Q&A / KB */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)', minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <button onClick={() => setQaTab('qa')} style={{ padding: '7px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${qaTab === 'qa' ? BLUE : 'transparent'}`, color: qaTab === 'qa' ? BLUE : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: qaTab === 'qa' ? 'bold' : 'normal' }}>💬 Q&A</button>
            <button onClick={() => setQaTab('kb')} style={{ padding: '7px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${qaTab === 'kb' ? GOLD : 'transparent'}`, color: qaTab === 'kb' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: qaTab === 'kb' ? 'bold' : 'normal' }}>📚 KB ({kbEntries.length})</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            {qaTab === 'qa' && (
              <div>
                <label style={ls}>Ask a question (multi-line supported)</label>
                <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical', marginBottom: '8px' }} placeholder="e.g. How do I handle the 'send me info' objection?&#10;&#10;You can also paste multiple questions at once…" onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ask(); } }} />
                <button onClick={ask} disabled={asking || !question.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: asking || !question.trim() ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: asking || !question.trim() ? 0.5 : 1, marginBottom: '12px' }}>
                  {asking ? '⏳ Thinking…' : '💬 Ask (Ctrl+Enter)'}
                </button>
                {answer && (
                  <div style={{ padding: '12px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ color: BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Answer</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {editingAnswer ? (
                          <>
                            <button onClick={saveAnswerToKb} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>💾 Save to KB</button>
                            <button onClick={() => { setEditingAnswer(false); setEditedAnswer(answer); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px' }}>Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingAnswer(true); setEditedAnswer(answer); }} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>✎ Edit</button>
                        )}
                      </div>
                    </div>
                    {editingAnswer ? (
                      <textarea value={editedAnswer} onChange={e => setEditedAnswer(e.target.value)} rows={6} style={{ ...inp, resize: 'vertical', fontFamily: 'Georgia, serif' }} />
                    ) : (
                      <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{answer}</div>
                    )}
                  </div>
                )}
                {/* Live objections detected from transcript */}
                {detectedObjections.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ color: '#ef4444', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>⚠️ Live Objections ({detectedObjections.length})</div>
                    {detectedObjections.slice(-4).reverse().map((obj, i) => (
                      <div key={i} style={{ padding: '10px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', marginBottom: '6px' }}>
                        <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>"{obj.matchedText}"</div>
                        <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, borderLeft: '2px solid rgba(239,68,68,0.3)', paddingLeft: '8px', marginBottom: '4px' }}>{obj.responseText}</div>
                        {obj.mindset && <div style={{ color: '#8a9ab8', fontSize: '9px', fontStyle: 'italic' }}>Mindset: {obj.mindset}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Live questions detected from transcript */}
                {detectedQuestions.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>🎯 Live Questions from Transcript ({detectedQuestions.length})</div>
                    {detectedQuestions.slice(-5).reverse().map((q, i) => {
                      const match = matchKb(q.text);
                      return (
                        <div key={i} style={{ padding: '10px', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '4px', marginBottom: '6px' }}>
                          <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>"{q.text}"</div>
                          {match ? (
                            <>
                              <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, borderLeft: '2px solid rgba(16,185,129,0.3)', paddingLeft: '8px', marginBottom: '4px' }}>{match.answer}</div>
                              <button onClick={() => { setQaTab('kb'); startEditKb(match); }} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>✎ Edit Answer</button>
                            </>
                          ) : (
                            <button onClick={() => ask(q.text)} disabled={asking} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: asking ? 0.5 : 1 }}>{asking ? '⏳ Asking...' : 'Ask AI →'}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ marginTop: '12px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', color: '#4a5568', fontSize: '10px' }}>
                  💡 Answers from Fronter KB ({kbEntries.length} entries) + AI. Add KB entries via the KB tab.
                </div>
              </div>
            )}

            {qaTab === 'kb' && (
              <div>
                {/* Upload buttons */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <input ref={docFileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = ''; }} />
                  <input ref={mp3FileRef} type="file" accept=".mp3,audio/mpeg,audio/mp3" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMp3Upload(f); e.target.value = ''; }} />
                  <button onClick={() => docFileRef.current?.click()} disabled={uploadingDoc} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(96,165,250,0.08)', color: BLUE, border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '7px', cursor: uploadingDoc ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: uploadingDoc ? 0.6 : 1, fontFamily: 'Georgia, serif' }}>
                    {uploadingDoc ? '⏳ Processing…' : '📄 Upload Doc'}
                  </button>
                  <button onClick={() => mp3FileRef.current?.click()} disabled={uploadingMp3} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(167,139,250,0.08)', color: PURPLE, border: '1px solid rgba(167,139,250,0.25)', borderRadius: '4px', padding: '7px', cursor: uploadingMp3 ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: uploadingMp3 ? 0.6 : 1, fontFamily: 'Georgia, serif' }}>
                    {uploadingMp3 ? '⏳ Processing…' : '🎵 Upload MP3 Call'}
                  </button>
                </div>
                {uploadStatus && (
                  <div style={{ padding: '6px 10px', marginBottom: '8px', background: uploadStatus.startsWith('✓') ? 'rgba(16,185,129,0.08)' : uploadStatus.startsWith('✗') ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.06)', border: `1px solid ${uploadStatus.startsWith('✓') ? 'rgba(16,185,129,0.2)' : uploadStatus.startsWith('✗') ? 'rgba(239,68,68,0.2)' : 'rgba(96,165,250,0.2)'}`, borderRadius: '4px', color: uploadStatus.startsWith('✓') ? GOLD : uploadStatus.startsWith('✗') ? '#ef4444' : BLUE, fontSize: '10px', lineHeight: 1.4 }}>
                    {uploadStatus}
                  </div>
                )}
                <div style={{ color: '#4a5568', fontSize: '9px', marginBottom: '10px', lineHeight: 1.4 }}>
                  📄 Upload txt/pdf/doc to extract Q&A pairs. 🎵 Upload MP3 call recordings to transcribe and extract Q&A from real calls.
                </div>

                {/* Search + Add */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <input value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="Search KB…" style={inp} />
                  <button onClick={() => setShowAddKb(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '0 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap', fontFamily: 'Georgia, serif' }}>{showAddKb ? '−' : '+ Add'}</button>
                </div>

                {showAddKb && (
                  <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px' }}>
                    <div style={{ marginBottom: '6px' }}><label style={ls}>Question</label><input value={kbForm.question} onChange={e => setKbForm(p => ({ ...p, question: e.target.value }))} style={inp} /></div>
                    <div style={{ marginBottom: '6px' }}><label style={ls}>Answer</label><textarea value={kbForm.answer} onChange={e => setKbForm(p => ({ ...p, answer: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
                    <div style={{ marginBottom: '6px' }}><label style={ls}>Category (optional)</label><input value={kbForm.category} onChange={e => setKbForm(p => ({ ...p, category: e.target.value }))} style={inp} /></div>
                    <button onClick={addKbEntry} disabled={!kbForm.question.trim() || !kbForm.answer.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: (!kbForm.question.trim() || !kbForm.answer.trim()) ? 0.5 : 1 }}>✓ Save Entry</button>
                  </div>
                )}

                {/* KB entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {filteredKb.length === 0 ? (
                    <div style={{ color: '#4a5568', textAlign: 'center', padding: '24px 0', fontSize: '11px' }}>No KB entries yet. Add manually or upload documents/MP3s.</div>
                  ) : (
                    filteredKb.map(e => {
                      const alts = parseAlts(e);
                      const isEditing = editingKbId === e.id;
                      return (
                      <div key={e.id} style={{ padding: isEditing ? '12px' : '8px 10px', background: isEditing ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isEditing ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px' }}>
                        {isEditing ? (
                          <>
                            <div style={{ marginBottom: '6px' }}><label style={ls}>Question</label><input value={editKbForm.question} onChange={ev => setEditKbForm(p => ({ ...p, question: ev.target.value }))} style={inp} /></div>
                            <div style={{ marginBottom: '6px' }}><label style={ls}>Answer</label><textarea value={editKbForm.answer} onChange={ev => setEditKbForm(p => ({ ...p, answer: ev.target.value }))} rows={4} style={{ ...inp, resize: 'vertical' }} /></div>
                            <div style={{ marginBottom: '8px' }}><label style={ls}>Category</label><input value={editKbForm.category} onChange={ev => setEditKbForm(p => ({ ...p, category: ev.target.value }))} style={inp} /></div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => saveEditKb(e.id)} disabled={!editKbForm.question.trim() || !editKbForm.answer.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: (!editKbForm.question.trim() || !editKbForm.answer.trim()) ? 0.5 : 1 }}>✓ Save</button>
                              <button onClick={() => setEditingKbId(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                              <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', flex: 1 }}>{e.question}</div>
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button onClick={() => startEditKb(e)} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '10px' }}>✎</button>
                                <button onClick={() => deleteKb(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                              </div>
                            </div>
                            {alts.length > 0 && (
                              <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {alts.map((alt, i) => (
                                  <span key={i} style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#8a9ab8', fontSize: '9px', fontStyle: 'italic' }}>{alt}</span>
                                ))}
                              </div>
                            )}
                            <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, marginTop: '5px', whiteSpace: 'pre-wrap', borderLeft: '2px solid rgba(16,185,129,0.3)', paddingLeft: '8px' }}>{e.answer}</div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              {e.category && <span style={{ padding: '1px 5px', borderRadius: '2px', background: 'rgba(96,165,250,0.12)', color: BLUE, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>{e.category}</span>}
                              {e.sourceType === 'document' && <span style={{ padding: '1px 5px', borderRadius: '2px', background: 'rgba(96,165,250,0.12)', color: BLUE, fontSize: '8px' }}>📄 {e.sourceFileName || 'doc'}</span>}
                              {e.sourceType === 'mp3_call' && <span style={{ padding: '1px 5px', borderRadius: '2px', background: 'rgba(167,139,250,0.12)', color: PURPLE, fontSize: '8px' }}>🎵 {e.sourceFileName || 'mp3'}</span>}
                            </div>
                          </>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Live transcript */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>📝 Live Transcript</span>
            {liveTranscript.length > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />}
          </div>
          {transcriptInfo && (
            <div style={{ padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: BLUE, fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>
              👤 {transcriptInfo.leadName || 'Unknown'}
            </div>
          )}
          <div ref={transcriptScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {liveTranscript.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 10px', fontSize: '11px' }}>
                {transcriptInfo ? 'Waiting for speech…' : 'No active call. Transcript will appear here when a call starts.'}
              </div>
            ) : (
              liveTranscript.map((l, i) => {
                const isAgent = l.speaker === 0;
                return (
                  <div key={i} style={{ marginBottom: '5px', fontSize: '11px', lineHeight: 1.4 }}>
                    <span style={{ color: isAgent ? BLUE : GOLD, fontSize: '9px', fontWeight: 'bold', marginRight: '4px' }}>{isAgent ? 'Agent' : 'Cust'}</span>
                    <span style={{ color: '#c4cdd8' }}>{l.text}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(500, startW + ev.clientX - startX), h: Math.max(350, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}