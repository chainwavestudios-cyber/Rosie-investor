/**
 * CommonQAView.jsx — "Common Asked Questions" library for the Q&A panel.
 *
 * - starToCommon(question, answer, answers): saves a Q&A pair to the KnowledgeBase
 *   under kbName="Common Asked Questions" so it appears in this library.
 * - CommonQAView: lists the starred Q&A pairs (used as a tab inside Q&A).
 * - CommonQAPopOut: a standalone floating panel that shows CommonQAView solo.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
export const COMMON_KB_NAME = 'Common Asked Questions';

export async function starToCommon(question, answer, answers) {
  if (!question) return;
  const answersJson = Array.isArray(answers) && answers.length > 0 ? JSON.stringify(answers) : '';
  await base44.entities.KnowledgeBase.create({
    question,
    answer: answer || '',
    answersJson,
    category: 'debt_faq',
    source: 'starred_qa',
    kbName: COMMON_KB_NAME,
    tags: 'common',
  });
  window.dispatchEvent(new CustomEvent('debt_common_qa_updated'));
}

export function CommonQAView({ onPopOut }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.filter({ kbName: COMMON_KB_NAME }, '-created_date', 200);
      setItems(all || []);
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('debt_common_qa_updated', h);
    return () => window.removeEventListener('debt_common_qa_updated', h);
  }, [load]);

  const remove = async (id) => {
    if (!window.confirm('Remove this from Common Asked Questions?')) return;
    try { await base44.entities.KnowledgeBase.delete(id); } catch {}
    load();
  };

  const btn = { background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ padding: '5px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>⭐ Common Asked Questions ({items.length})</span>
        {onPopOut && <button onClick={onPopOut} title="Pop out as a standalone window" style={btn}>⬆ Pop Out</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading ? (
          <div style={{ color: '#6b7280', fontSize: '11px' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px' }}>
            No common questions yet.<br />Star ★ an answered question in the Current tab to add it here.
          </div>
        ) : items.map((it, i) => {
          const isOpen = expanded === it.id;
          let extra = [];
          try { extra = it.answersJson ? JSON.parse(it.answersJson) : []; } catch { extra = []; }
          return (
            <div key={it.id || i} style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: '5px', overflow: 'hidden' }}>
              <button onClick={() => setExpanded(isOpen ? null : it.id)} style={{ width: '100%', background: 'none', border: 'none', padding: '7px 10px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#f59e0b', fontSize: '11px', flexShrink: 0 }}>★</span>
                <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', flex: 1, lineHeight: 1.4 }}>{it.question}</span>
                <span style={{ color: '#6b7280', fontSize: '12px', flexShrink: 0 }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 10px 10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '8px' }}>{it.answer}</div>
                  {extra.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {extra.map((a, j) => (
                        <div key={j} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '4px', padding: '6px 10px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{typeof a === 'string' ? a : (a?.text || a?.answer || JSON.stringify(a))}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button onClick={() => remove(it.id)} style={{ ...btn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>✕ Remove</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CommonQAPopOut({ onClose }) {
  const [pos, setPos] = useState({ x: 80, y: 90 });
  const drag = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return;
      const nx = Math.max(0, Math.min(window.innerWidth - 720, dragStart.current.px + e.clientX - dragStart.current.mx));
      const ny = Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.py + e.clientY - dragStart.current.my));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { drag.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 720, height: 600, background: '#0d1b2a', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '8px', boxShadow: '0 12px 60px rgba(0,0,0,0.9)', zIndex: 20002, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <div onMouseDown={e => { if (e.target.closest('button')) return; drag.current = true; dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }; e.preventDefault(); }}
        style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, cursor: 'grab', userSelect: 'none' }}>
        <span style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', flex: 1 }}>⭐ Common Asked Questions — Solo</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>⬇ Pop In</button>
      </div>
      <CommonQAView />
    </div>
  );
}