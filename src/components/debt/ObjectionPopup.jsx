/**
 * ObjectionPopup — blocking modal shown during a live call when a high-priority
 * objection is detected. Shows the customer's words, the objection mindset/goal,
 * and EVERY available response as a selectable option the agent can read verbatim:
 *   • Option 1: the Objection Engine's crafted response
 *   • Option 2+: any matching KB answers from recorded calls (if they differ)
 * The agent picks whichever they prefer and reads it back exactly.
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
      objection.kbOptions.forEach((kb, i) => {
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onDismiss}>
      <div onClick={e => e.stopPropagation()} style={{ background: DARK, border: `2px solid ${GOLD}`, borderRadius: '10px', maxWidth: '680px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 80px rgba(0,0,0,0.9)' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${GOLD}10` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <div>
              <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>OBJECTION DETECTED</div>
              <div style={{ color: '#e8e0d0', fontSize: '14px' }}>{objection.title}</div>
            </div>
          </div>
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '26px', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        {/* Customer said */}
        {objection.lineText && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(239,68,68,0.06)' }}>
            <div style={{ color: RED, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>🗣️ Customer said</div>
            <div style={{ color: '#c4cdd8', fontSize: '13px', fontStyle: 'italic' }}>"{objection.lineText}"</div>
          </div>
        )}

        {/* Mindset + Goal (only for the engine option) */}
        {selected === 0 && (objection.mindset || objection.goal) && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '20px', fontSize: '11px', flexWrap: 'wrap' }}>
            {objection.mindset && <div style={{ flex: 1, minWidth: '200px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Mindset: </span><span style={{ color: '#c4cdd8' }}>{objection.mindset}</span></div>}
            {objection.goal && <div style={{ flex: 1, minWidth: '200px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Goal: </span><span style={{ color: '#c4cdd8' }}>{objection.goal}</span></div>}
          </div>
        )}

        {/* Option selector — only if more than one option */}
        {options.length > 1 && (
          <div style={{ padding: '10px 20px 0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {options.map((opt, i) => (
              <button key={i} onClick={() => { setSelected(i); setCopied(false); }} style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${selected === i ? opt.color + '66' : 'rgba(255,255,255,0.1)'}`, background: selected === i ? `${opt.color}18` : 'transparent', color: selected === i ? opt.color : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Response — the main content (read verbatim) */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ color: current.color, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>💬 Read this response {options.length > 1 ? `(${selected + 1}/${options.length})` : ''}</div>
            <button onClick={copy} style={{ background: `${current.color}18`, color: current.color, border: `1px solid ${current.color}44`, borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{copied ? '✓ Copied' : '📋 Copy'}</button>
          </div>
          <div style={{ color: '#e8e0d0', fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '16px', border: `1px solid ${current.color}22` }}>
            {current?.text}
          </div>
          {current?.source && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px' }}>Source: {current.source}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onDismiss} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '10px 28px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Got it ✓</button>
        </div>
      </div>
    </div>
  );
}