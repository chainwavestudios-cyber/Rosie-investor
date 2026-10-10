/**
 * CandidateNotesBox.jsx — Notes box with a 6-star rating (supports decimals like 1.2).
 * Star rating is in the top-right corner. Best score is 6 stars.
 */
import { useState, useRef } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', resize: 'vertical' };

const MAX_STARS = 6;

export default function CandidateNotesBox({ rating, notes, onRatingChange, onNotesChange }) {
  const [hoverRating, setHoverRating] = useState(0);
  const [editingRating, setEditingRating] = useState(false);
  const [ratingInput, setRatingInput] = useState(String(rating || 0));
  const starRefs = useRef([]);

  const displayRating = hoverRating || rating || 0;

  // Calculate fill percentage for each star (0-1)
  const getStarFill = (starIndex) => {
    const r = displayRating;
    if (r >= starIndex) return 1;
    if (r >= starIndex - 1) return r - (starIndex - 1);
    return 0;
  };

  const handleStarClick = (starIndex, e) => {
    const star = starRefs.current[starIndex - 1];
    if (!star) { onRatingChange(starIndex); return; }
    const rect = star.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = clickX / rect.width;
    // If clicked on right half of star, round up; left half, round down; allow .1 precision
    const value = starIndex - 1 + Math.round(fraction * 10) / 10;
    onRatingChange(Math.min(MAX_STARS, Math.max(0, Math.round(value * 10) / 10)));
  };

  const handleStarMove = (starIndex, e) => {
    const star = starRefs.current[starIndex - 1];
    if (!star) { setHoverRating(starIndex); return; }
    const rect = star.getBoundingClientRect();
    const moveX = e.clientX - rect.left;
    const fraction = moveX / rect.width;
    const value = starIndex - 1 + Math.round(fraction * 10) / 10;
    setHoverRating(Math.min(MAX_STARS, Math.max(0, Math.round(value * 10) / 10)));
  };

  const commitRatingInput = () => {
    const v = parseFloat(ratingInput);
    if (!isNaN(v)) onRatingChange(Math.min(MAX_STARS, Math.max(0, Math.round(v * 10) / 10)));
    else setRatingInput(String(rating || 0));
    setEditingRating(false);
  };

  return (
    <div style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px', position: 'relative' }}>
      {/* Header row with label + star rating */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
        <label style={{ display: 'block', color: BLUE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>✍️ Candidate Notes</label>
        {/* Star rating — top right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#6b7280', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Rate Candidate</span>
          <div style={{ display: 'flex', gap: '2px' }} onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                ref={el => starRefs.current[i - 1] = el}
                onClick={(e) => handleStarClick(i, e)}
                onMouseMove={(e) => handleStarMove(i, e)}
                style={{ cursor: 'pointer', fontSize: '18px', lineHeight: 1, userSelect: 'none', position: 'relative', width: '20px', textAlign: 'center' }}
                title={`${i} star${i > 1 ? 's' : ''}`}
              >
                <Star fill={getStarFill(i)} />
              </div>
            ))}
          </div>
          {editingRating ? (
            <input
              type="number"
              step="0.1"
              min="0"
              max={MAX_STARS}
              value={ratingInput}
              onChange={e => setRatingInput(e.target.value)}
              onBlur={commitRatingInput}
              onKeyDown={e => { if (e.key === 'Enter') commitRatingInput(); }}
              autoFocus
              style={{ width: '50px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '2px 4px', color: '#e8e0d0', fontSize: '12px', textAlign: 'center' }}
            />
          ) : (
            <button
              onClick={() => { setRatingInput(String(rating || 0)); setEditingRating(true); }}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '2px 6px', color: GOLD, fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', minWidth: '36px', textAlign: 'center' }}
              title="Click to type an exact rating"
            >
              {(rating || 0).toFixed(1)}
            </button>
          )}
          <span style={{ color: '#6b7280', fontSize: '9px' }}>/ {MAX_STARS}</span>
        </div>
      </div>
      {/* Notes textarea */}
      <textarea
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        rows={3}
        style={inp}
        placeholder="Notes about the candidate so far — where they're from, travel history, first impressions, communication skills…"
      />
    </div>
  );
}

function Star({ fill }) {
  // fill is 0 to 1 — render a partially filled star using a gradient overlay
  const pct = Math.round(fill * 100);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {/* Empty star (gray) */}
      <span style={{ color: 'rgba(255,255,255,0.15)' }}>★</span>
      {/* Filled star (gold) clipped to fill percentage */}
      {pct > 0 && (
        <span style={{
          position: 'absolute', left: 0, top: 0, overflow: 'hidden',
          width: `${pct}%`, color: GOLD, pointerEvents: 'none',
        }}>★</span>
      )}
    </span>
  );
}