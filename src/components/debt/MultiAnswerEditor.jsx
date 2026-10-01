/**
 * MultiAnswerEditor.jsx — Editable list of answers for a KB entry.
 * Lets you add, edit, remove, and reorder multiple answers.
 * The first answer is the "primary" answer (mirrored to the legacy `answer` field on save).
 */
import { useState } from 'react';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export function parseAnswers(answersJson, fallbackAnswer) {
  if (answersJson) {
    try {
      const arr = JSON.parse(answersJson);
      if (Array.isArray(arr)) {
        const valid = arr.filter(a => typeof a === 'string' && a.trim());
        if (valid.length > 0) return valid;
      }
    } catch {}
  }
  return fallbackAnswer && String(fallbackAnswer).trim() ? [String(fallbackAnswer)] : [];
}

export function serializeAnswers(arr) {
  return JSON.stringify(arr.filter(a => typeof a === 'string' && a.trim()));
}

export default function MultiAnswerEditor({ answers, onChange, accentColor = GOLD, label = 'Answers', placeholder = 'Type an answer…', rows = 4, starredIndex = 0, onStarChange }) {
  const [list, setList] = useState(answers && answers.length > 0 ? answers : ['']);
  const color = accentColor;

  const update = (i, val) => {
    const next = [...list];
    next[i] = val;
    setList(next);
    onChange(next);
  };

  const add = () => {
    const next = [...list, ''];
    setList(next);
    onChange(next);
  };

  const remove = (i) => {
    if (list.length <= 1) {
      setList(['']);
      onChange(['']);
      return;
    }
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    onChange(next);
  };

  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...list];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setList(next);
    onChange(next);
  };

  const moveDown = (i) => {
    if (i === list.length - 1) return;
    const next = [...list];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    setList(next);
    onChange(next);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label style={{ ...ls, marginBottom: 0 }}>{label} ({list.length})</label>
        <button onClick={add} type="button" style={{ background: `${color}18`, color, border: `1px solid ${color}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>+ Add Answer</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {list.map((ans, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}22`, borderRadius: '4px', padding: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: i === starredIndex ? '#fbbf24' : i === 0 ? color : '#6b7280', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {i === starredIndex ? '⭐ Starred for Q&A' : i === 0 ? '★ Primary Answer' : `Answer ${i + 1}`}
              </span>
              <div style={{ display: 'flex', gap: '3px' }}>
                {onStarChange && (
                  <button onClick={() => onStarChange(i)} type="button" title={i === starredIndex ? 'Unstar' : 'Star for Q&A priority'} style={{ background: i === starredIndex ? 'rgba(251,191,36,0.15)' : 'none', border: 'none', color: i === starredIndex ? '#fbbf24' : '#6b7280', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>{i === starredIndex ? '⭐' : '☆'}</button>
                )}
                <button onClick={() => moveUp(i)} disabled={i === 0} type="button" title="Move up" style={{ background: 'none', border: 'none', color: i === 0 ? '#4a5568' : '#8a9ab8', cursor: i === 0 ? 'default' : 'pointer', fontSize: '12px', padding: '0 4px' }}>↑</button>
                <button onClick={() => moveDown(i)} disabled={i === list.length - 1} type="button" title="Move down" style={{ background: 'none', border: 'none', color: i === list.length - 1 ? '#4a5568' : '#8a9ab8', cursor: i === list.length - 1 ? 'default' : 'pointer', fontSize: '12px', padding: '0 4px' }}>↓</button>
                <button onClick={() => remove(i)} type="button" title="Remove" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: '0 4px' }}>✕</button>
              </div>
            </div>
            <textarea
              value={ans}
              onChange={e => update(i, e.target.value)}
              rows={rows}
              placeholder={placeholder}
              style={{ ...inp, resize: 'vertical' }}
            />
          </div>
        ))}
      </div>
      {list.length > 1 && (
        <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '10px', fontStyle: 'italic' }}>
          💡 All {list.length} answers are returned to the agent when this question is matched. The primary answer is used for backward compatibility.
        </div>
      )}
    </div>
  );
}