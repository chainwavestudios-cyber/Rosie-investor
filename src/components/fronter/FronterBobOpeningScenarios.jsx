/**
 * FronterBobOpeningScenarios.jsx — Real call openings from uploaded calls & KB.
 * Loads FronterCallTranscript entries (real calls) and FronterKnowledgeBase
 * entries (Q&A from uploaded calls/documents) and lets the user pick one as
 * BOB's opening scenario.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

export default function FronterBobOpeningScenarios({ onApply, onClose }) {
  const [tab, setTab] = useState('calls');
  const [calls, setCalls] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState({ x: 120, y: 80 });
  const [size, setSize] = useState({ w: 440, h: 560 });
  const dragRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.FronterCallTranscript.list('-created_date', 20),
      base44.entities.FronterKnowledgeBase.list('-created_date', 50),
    ]).then(([callData, kbData]) => {
      const callArr = Array.isArray(callData) ? callData : (callData?.items || []);
      const kbArr = Array.isArray(kbData) ? kbData : (kbData?.items || []);
      const parsed = callArr.map(c => {
        let lines = [];
        try { lines = JSON.parse(c.transcriptJson || '[]'); } catch {}
        const customerLines = lines.filter(l => l.speaker === 'customer' || l.speaker === 'lead' || l.speaker === 'them').slice(0, 3);
        return { ...c, openingLines: customerLines, firstLine: customerLines[0]?.text || '' };
      }).filter(c => c.firstLine);
      setCalls(parsed);
      setKbEntries(kbArr);
    }).catch(() => {});
    setLoading(false);
  }, []);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const applyCall = (c) => {
    onApply({
      customerName: c.leadName?.split(' ')[0] || 'Bob',
      customerAddress: '',
      debtAmount: '',
      creditors: '',
      monthlyIncome: '',
      monthsBehind: '',
      hardship: '',
      openingLine: c.firstLine,
    });
  };

  const applyKB = (e) => {
    onApply({
      customerName: 'Bob',
      customerAddress: '',
      debtAmount: '',
      creditors: '',
      monthlyIncome: '',
      monthsBehind: '',
      hardship: '',
      openingLine: e.question,
    });
  };

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `1px solid ${BLUE}55`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <div onMouseDown={onDragStart} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(96,165,250,0.08), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📞</span>
          <div>
            <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>Real Call Openings</div>
            <div style={{ color: BLUE, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>From uploaded calls & KB</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={() => setTab('calls')} style={{ flex: 1, padding: '8px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === 'calls' ? BLUE : 'transparent'}`, color: tab === 'calls' ? BLUE : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📞 Real Calls ({calls.length})</button>
        <button onClick={() => setTab('kb')} style={{ flex: 1, padding: '8px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === 'kb' ? PURPLE : 'transparent'}`, color: tab === 'kb' ? PURPLE : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📚 KB Openings ({kbEntries.length})</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
        ) : tab === 'calls' ? (
          calls.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 20px', fontSize: '13px' }}>No call transcripts yet. Record calls from the Leads tab to populate real openings.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {calls.map(c => (
                <div key={c.id} onClick={() => applyCall(c)} style={{ padding: '10px 12px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(96,165,250,0.06)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{c.leadName || 'Unknown'}</span>
                    <span style={{ color: '#6b7280', fontSize: '9px' }}>{new Date(c.callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div style={{ color: BLUE, fontSize: '11px', fontStyle: 'italic', lineHeight: 1.4 }}>"{c.firstLine}"</div>
                  {c.openingLines.length > 1 && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>"{c.openingLines[1]?.text?.slice(0, 80)}…"</div>}
                  <div style={{ color: GOLD, fontSize: '9px', marginTop: '6px', fontWeight: 'bold' }}>→ Use this opening</div>
                </div>
              ))}
            </div>
          )
        ) : (
          kbEntries.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 20px', fontSize: '13px' }}>No KB entries yet. Upload calls and documents to the KB to populate openings.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {kbEntries.map(e => (
                <div key={e.id} onClick={() => applyKB(e)} style={{ padding: '10px 12px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(167,139,250,0.12)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'rgba(167,139,250,0.06)'}>
                  <div style={{ color: PURPLE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{e.sourceType === 'mp3_call' ? '🎙 From Call' : e.sourceType === 'document' ? '📄 Document' : '✍ Manual'}</div>
                  <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.4 }}>"{e.question}"</div>
                  {e.answer && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>A: {e.answer.slice(0, 100)}…</div>}
                  <div style={{ color: GOLD, fontSize: '9px', marginTop: '6px', fontWeight: 'bold' }}>→ Use as opening</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div onMouseDown={(e) => { e.stopPropagation(); const sX = e.clientX, sY = e.clientY, sW = size.w, sH = size.h; const onM = (ev) => setSize({ w: Math.max(340, sW + ev.clientX - sX), h: Math.max(350, sH + ev.clientY - sY) }); const onU = () => { document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); }; document.addEventListener('mousemove', onM); document.addEventListener('mouseup', onU); }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}