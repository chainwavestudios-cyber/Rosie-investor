/**
 * ConflictResolutionPopup.jsx — Shows duplicate-like statements found when
 * new Q&A is extracted. For each conflict, the trainer picks what's preferred:
 * "Use new" (replace), "Keep existing" (discard new), or "Keep both".
 * On Apply, calls onResolve with the chosen new entries to save.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';
const RED = '#ef4444';

export default function ConflictResolutionPopup({ conflicts, onResolve, onClose }) {
  // Each conflict: { newEntry, matches: [{existing, similarity}] }
  // decision per conflict index: 'new' | 'existing' | 'both'
  const [decisions, setDecisions] = useState({});

  if (!conflicts || conflicts.length === 0) return null;

  const setDecision = (i, d) => setDecisions(prev => ({ ...prev, [i]: d }));

  const apply = () => {
    const toSave = [];
    conflicts.forEach((c, i) => {
      const d = decisions[i] || 'new'; // default to new
      if (d === 'new' || d === 'both') toSave.push(c.newEntry);
    });
    onResolve(toSave);
  };

  const resolvedCount = Object.keys(decisions).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0a0f1e', border: `1px solid ${PURPLE}55`, borderRadius: '8px', maxWidth: '760px', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ color: PURPLE, fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>⚠ Duplicate Statements Found</div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{conflicts.length} new {conflicts.length === 1 ? 'entry is' : 'entries are'} similar to existing knowledge. Pick what BOB should keep.</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {conflicts.map((c, i) => {
            const decision = decisions[i];
            const bestMatch = c.matches[0];
            return (
              <div key={i} style={{ marginBottom: '16px', background: '#0d1b2a', border: `1px solid ${decision ? PURPLE + '55' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: 'rgba(167,139,250,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: PURPLE, fontSize: '11px', fontWeight: 'bold' }}>Conflict #{i + 1}</span>
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>{Math.round(bestMatch.similarity * 100)}% similar</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
                  {/* Existing */}
                  <div style={{ background: '#0d1b2a', padding: '12px' }}>
                    <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Existing (in brain)</div>
                    <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{bestMatch.existing.question}</div>
                    <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{(bestMatch.existing.answer || '').slice(0, 280)}</div>
                  </div>
                  {/* New */}
                  <div style={{ background: '#0d1b2a', padding: '12px' }}>
                    <div style={{ color: '#f472b6', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>New (from upload)</div>
                    <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{c.newEntry.question}</div>
                    <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{(c.newEntry.answer || '').slice(0, 280)}</div>
                  </div>
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => setDecision(i, 'new')} style={decisionBtn(decision === 'new', '#f472b6')}>↑ Use New</button>
                  <button onClick={() => setDecision(i, 'existing')} style={decisionBtn(decision === 'existing', GOLD)}>✓ Keep Existing</button>
                  <button onClick={() => setDecision(i, 'both')} style={decisionBtn(decision === 'both', '#60a5fa')}>＋ Keep Both</button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>{resolvedCount}/{conflicts.length} resolved</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
            <button onClick={apply} style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Apply Choices</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function decisionBtn(active, color) {
  return {
    background: active ? `${color}22` : 'rgba(255,255,255,0.03)',
    color: active ? color : '#8a9ab8',
    border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '4px',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
  };
}