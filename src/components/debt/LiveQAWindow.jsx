/**
 * LiveQAWindow.jsx — the floating "Live Q&A Only" window used during a live call.
 * Shows every question the live Q&A engine has answered, newest first, in the
 * operator's own saved position and size.
 *
 * It is also the live call's Q&A intake: a question from a transcript 💡 line or
 * from 🎤 Agent Question arrives here as `pendingQuestion` and is handed to the
 * call's own Q&A engine (`onAsk`), so it is answered and listed even though the
 * docked assistant panel is not on screen.
 */
import { useEffect, useRef } from 'react';

const GOLD = '#10b981';

export default function LiveQAWindow({ panel, qaItems, pendingQuestion, onAsk }) {
  const items = qaItems || [];
  const askedRef = useRef(null);

  useEffect(() => {
    if (!pendingQuestion?.question || !onAsk) return;
    if (askedRef.current === pendingQuestion.ts) return;
    askedRef.current = pendingQuestion.ts;
    onAsk(pendingQuestion.question);
  }, [pendingQuestion?.ts]);

  return (
    <div style={{ ...panel.floatingStyle, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
      <div onMouseDown={panel.onDragStart} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>❓ Live Q&A Only</span>
        <button onClick={panel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬇ Pop In</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12, color: '#d5dce7' }}>
        {items.length === 0 && <div style={{ color: '#8a9ab8', fontSize: 12 }}>Waiting for a customer question…</div>}
        {items.slice().reverse().map((item, index) => (
          <div key={item.id || item.ts || index} style={{ marginBottom: 12, padding: 12, border: '1px solid rgba(245,158,11,.2)', borderRadius: 7, background: '#10202d' }}>
            <div style={{ fontSize: 12, color: '#f0c57b', fontWeight: 700 }}>{item.question || 'Question detected'}</div>
            {item.reallyAsking && <div style={{ fontSize: 11, color: '#b9c8d6', marginTop: 5 }}>Interpreted: {item.reallyAsking}</div>}
            <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: 8 }}>{item.loading ? 'Finding approved answer…' : item.answer || 'No verified answer available'}</div>
            <div style={{ fontSize: 10, color: '#8494a6', marginTop: 5 }}>{item.source === 'kb_direct' ? 'Verified KB' : item.source || 'Live Q&A'}</div>
          </div>
        ))}
      </div>
      {panel.resizeHandles}
    </div>
  );
}