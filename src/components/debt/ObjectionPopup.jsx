/**
 * ObjectionPopup — non-blocking floating card shown during a live call when a
 * high-priority objection is detected. Sits in the bottom-right corner so the
 * agent can still see their script, transcript, and call panels. Does NOT take
 * over the screen. Shows the customer's words, the objection mindset/goal,
 * and every available response as a selectable option the agent can read
 * verbatim, then dismiss with the X or "Got it" button.
 */
import { useState, useMemo } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const PURPLE = '#a78bfa';

export default function ObjectionPopup({ objection, onDismiss }) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);

  // Build the list of answer options: engine response first, then KB answers.
  const options = useMemo(() => {
    if (!objection) return [];
    const list = [{ label: '🛡️ Objection Engine', text: objection.responseText, color: GOLD, mindset: objection.mindset, goal: objection.goal }];
    if (Array.isArray(objection.kbOptions)) {
      objection.kbOptions.forEach((kb) => {
        list.push({ label: `📖 KB: ${kb.question || 'Recorded Call'}`, text: kb.answer, color: PURPLE, source: kb.source });
      });
    }
    return list;
  }, [objection]);

  if (!objection) return null;

  const current = options[selected] || options[0];

  const copy = () => {
    navigator.clipboard?.writeText(current?.text || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 10001, width: '440px', maxWidth: 'calc(100vw - 32px)', maxHeight: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.7)', pointerEvents: 'auto' }}>
      <div style={{ background: DARK, border: `2px solid ${GOLD}`, borderRadius: '10px', display: 'flex', flexDirection: 'column', maxHeight: '78vh', overflow: 'hidden' }}>
        {/* Header — drag-free, close button always clickable */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${GOLD}10`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>🛡️</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>OBJECTION DETECTED</div>
              <div style={{ color: '#e8e0d0', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{objection.title}</div>
            </div>
          </div>
          <button onClick={onDismiss} title="Close (does not take over the screen)" style={{ background: 'rgba(239,68,68,0.15)', border: `1px solid rgba(239,68,68,0.3)`, color: '#ef4444', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '4px', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Customer said */}
          {objection.lineText && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(239,68,68,0.06)' }}>
              <div style={{ color: RED, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>🗣️ Customer said</div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', fontStyle: 'italic' }}>"{objection.lineText}"</div>
            </div>
          )}

          {/* Mindset + Goal (only for the engine option) */}
          {selected === 0 && (objection.mindset || objection.goal) && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '16px', fontSize: '10px', flexWrap: 'wrap' }}>
              {objection.mindset && <div style={{ flex: 1, minWidth: '160px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Mindset: </span><span style={{ color: '#c4cdd8' }}>{objection.mindset}</span></div>}
              {objection.goal && <div style={{ flex: 1, minWidth: '160px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Goal: </span><span style={{ color: '#c4cdd8' }}>{objection.goal}</span></div>}
            </div>
          )}

          {/* Option selector — only if more than one option */}
          {options.length > 1 && (
            <div style={{ padding: '8px 16px 0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {options.map((opt, i) => (
                <button key={i} onClick={() => { setSelected(i); setCopied(false); }} style={{ padding: '5px 10px', borderRadius: '4px', border: `1px solid ${selected === i ? opt.color + '66' : 'rgba(255,255,255,0.1)'}`, background: selected === i ? `${opt.color}18` : 'transparent', color: selected === i ? opt.color : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Response — the main content (read verbatim) */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ color: current.color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>💬 Read this {options.length > 1 ? `(${selected + 1}/${options.length})` : ''}</div>
              <button onClick={copy} style={{ background: `${current.color}18`, color: current.color, border: `1px solid ${current.color}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{copied ? '✓ Copied' : '📋 Copy'}</button>
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '12px', border: `1px solid ${current.color}22` }}>
              {current?.text}
            </div>
            {current?.source && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '5px' }}>Source: {current.source}</div>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onDismiss} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '8px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Got it ✓</button>
        </div>
      </div>
    </div>
  );
}