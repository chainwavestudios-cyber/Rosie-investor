/**
 * FronterQAPopup.jsx — Floating, draggable, resizable live Q&A popup.
 * Tabs: Q&A (ask questions, get answers from KB + AI) | KB (manage entries).
 * Answers come from the FronterKnowledgeBase + the AI's general knowledge.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterQAPopup({ username, onClose }) {
  const [qaTab, setQaTab] = useState('qa');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [kbEntries, setKbEntries] = useState([]);
  const [kbSearch, setKbSearch] = useState('');
  const [showAddKb, setShowAddKb] = useState(false);
  const [kbForm, setKbForm] = useState({ question: '', answer: '', category: '' });
  const [pos, setPos] = useState({ x: 200, y: 80 });
  const [size, setSize] = useState({ w: 460, h: 560 });
  const dragRef = useRef(null);

  const loadKb = async () => {
    try {
      const all = await base44.entities.FronterKnowledgeBase.list('-created_date', 500);
      setKbEntries(all || []);
    } catch {}
  };

  useEffect(() => { loadKb(); }, []);

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

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true); setAnswer('');
    try {
      const kbContext = kbEntries.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a helpful sales assistant for a debt settlement fronter (caller). Answer the following question using the knowledge base below and your general knowledge. If the KB has a relevant answer, use it. Otherwise, provide a helpful answer from your general knowledge. Keep answers clear, concise, and actionable — the fronter may be on a live call.

KNOWLEDGE BASE:
${kbContext || '(empty — use general knowledge)'}

QUESTION: ${question}

Provide a clear, concise answer:`,
      });
      setAnswer(res || 'No answer generated.');
    } catch (e) { setAnswer('Error: ' + (e?.message || String(e))); }
    setAsking(false);
  };

  const addKbEntry = async () => {
    if (!kbForm.question.trim() || !kbForm.answer.trim()) return;
    try {
      await base44.entities.FronterKnowledgeBase.create({
        question: kbForm.question.trim(), answer: kbForm.answer.trim(), category: kbForm.category,
      });
      setKbForm({ question: '', answer: '', category: '' }); setShowAddKb(false); loadKb();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const deleteKb = async (id) => {
    if (!confirm('Delete this KB entry?')) return;
    await base44.entities.FronterKnowledgeBase.delete(id); loadKb();
  };

  const filteredKb = kbSearch.trim()
    ? kbEntries.filter(e => (e.question || '').toLowerCase().includes(kbSearch.toLowerCase()) || (e.answer || '').toLowerCase().includes(kbSearch.toLowerCase()))
    : kbEntries;

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <span style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>💬 Live Q&A</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', padding: 0, lineHeight: 1 }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={() => setQaTab('qa')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${qaTab === 'qa' ? BLUE : 'transparent'}`, color: qaTab === 'qa' ? BLUE : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: qaTab === 'qa' ? 'bold' : 'normal' }}>💬 Q&A</button>
        <button onClick={() => setQaTab('kb')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${qaTab === 'kb' ? GOLD : 'transparent'}`, color: qaTab === 'kb' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: qaTab === 'kb' ? 'bold' : 'normal' }}>📚 KB ({kbEntries.length})</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {qaTab === 'qa' && (
          <div>
            <label style={ls}>Ask a question</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginBottom: '10px' }} placeholder="e.g. How do I handle the 'send me info' objection?" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} />
            <button onClick={ask} disabled={asking || !question.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: asking || !question.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: asking || !question.trim() ? 0.5 : 1, marginBottom: '14px' }}>
              {asking ? '⏳ Thinking…' : '💬 Ask'}
            </button>
            {answer && (
              <div style={{ padding: '14px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px' }}>
                <div style={{ color: BLUE, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Answer</div>
                <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{answer}</div>
              </div>
            )}
            <div style={{ marginTop: '14px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', color: '#4a5568', fontSize: '11px' }}>
              💡 Answers come from the Fronter KB ({kbEntries.length} entries) + AI general knowledge. Add more KB entries in the KB tab for better answers.
            </div>
          </div>
        )}

        {qaTab === 'kb' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="Search KB…" style={inp} />
              <button onClick={() => setShowAddKb(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '0 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', fontFamily: 'Georgia, serif' }}>{showAddKb ? '− Cancel' : '+ Add'}</button>
            </div>

            {showAddKb && (
              <div style={{ marginBottom: '14px', padding: '14px', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px' }}>
                <div style={{ marginBottom: '8px' }}><label style={ls}>Question</label><input value={kbForm.question} onChange={e => setKbForm(p => ({ ...p, question: e.target.value }))} style={inp} /></div>
                <div style={{ marginBottom: '8px' }}><label style={ls}>Answer</label><textarea value={kbForm.answer} onChange={e => setKbForm(p => ({ ...p, answer: e.target.value }))} rows={4} style={{ ...inp, resize: 'vertical' }} /></div>
                <div style={{ marginBottom: '8px' }}><label style={ls}>Category (optional)</label><input value={kbForm.category} onChange={e => setKbForm(p => ({ ...p, category: e.target.value }))} style={inp} /></div>
                <button onClick={addKbEntry} disabled={!kbForm.question.trim() || !kbForm.answer.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (!kbForm.question.trim() || !kbForm.answer.trim()) ? 0.5 : 1 }}>✓ Save Entry</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredKb.length === 0 ? (
                <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No KB entries yet. Click "+ Add" to create one.</div>
              ) : (
                filteredKb.map(e => (
                  <div key={e.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', flex: 1 }}>{e.question}</div>
                      <button onClick={() => deleteKb(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, marginTop: '4px', whiteSpace: 'pre-wrap' }}>{e.answer}</div>
                    {e.category && <span style={{ display: 'inline-block', marginTop: '4px', padding: '1px 6px', borderRadius: '2px', background: 'rgba(96,165,250,0.12)', color: BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{e.category}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(320, startW + ev.clientX - startX), h: Math.max(300, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}