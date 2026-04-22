import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getScoreColor } from '@/lib/engagementScore';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STAGES = [
  { id: 'reviewing', label: 'Reviewing Info',  color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)' },
  { id: 'read',      label: 'Read Info',        color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
  { id: 'callback',  label: 'Call Back',        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
  { id: 'preclose',  label: 'Pre-Close',        color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)' },
  { id: 'load',      label: 'Load',             color: GOLD,      bg: 'rgba(184,147,58,0.08)',  border: 'rgba(184,147,58,0.25)' },
];

const STAGE_KEY = 'prospect_pipeline_stages';

function loadStages() {
  try { return JSON.parse(localStorage.getItem(STAGE_KEY) || '{}'); } catch { return {}; }
}
function saveStages(map) {
  localStorage.setItem(STAGE_KEY, JSON.stringify(map));
}

// ── Star Rating ──────────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={e => { e.stopPropagation(); onChange(star === value ? 0 : star); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0',
            color: star <= (hover || value) ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            fontSize: '14px', lineHeight: 1,
          }}
        >★</button>
      ))}
    </div>
  );
}

// ── Score Badge ──────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const color = getScoreColor(score || 0);
  return (
    <div style={{
      width: '34px', height: '34px', borderRadius: '50%',
      border: `2px solid ${color}`,
      background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ color, fontSize: '11px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>
        {score || 0}
      </span>
    </div>
  );
}

// ── Pipeline Card ─────────────────────────────────────────────────────────
function PipelineCard({ user, stage, onDragStart, onOpenCard, onOpenDialer, onStarChange }) {
  const [dragging, setDragging] = useState(false);

  const dealValue = user.investmentAmount
    ? `$${Number(user.investmentAmount).toLocaleString()}`
    : null;

  return (
    <div
      draggable
      onDragStart={e => { setDragging(true); onDragStart(e); }}
      onDragEnd={() => setDragging(false)}
      style={{
        background: dragging ? 'rgba(0,0,0,0.4)' : '#0d1b2a',
        border: `1px solid ${stage.border}`,
        borderLeft: `3px solid ${stage.color}`,
        borderRadius: '4px',
        padding: '12px 12px 10px',
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        transition: 'all 0.1s',
        userSelect: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#0d1b2a'; }}
    >
      {/* Top row: name + score badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
        <div
          onClick={onOpenCard}
          style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', lineHeight: 1.3, flex: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = stage.color}
          onMouseLeave={e => e.currentTarget.style.color = '#e8e0d0'}
        >
          {user.name}
        </div>
        <ScoreBadge score={user.engagementScore || 0} />
      </div>

      {/* Company */}
      {user.company && (
        <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px', fontStyle: 'italic' }}>
          {user.company}
        </div>
      )}

      {/* Deal value */}
      {dealValue && (
        <div style={{ color: '#4ade80', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
          {dealValue}
        </div>
      )}

      {/* Phone */}
      {user.phone ? (
        <div
          onClick={e => { e.stopPropagation(); onOpenDialer(); }}
          style={{ color: '#60a5fa', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', marginBottom: '8px', display: 'inline-block' }}
          onMouseEnter={e => e.currentTarget.style.color = '#93c5fd'}
          onMouseLeave={e => e.currentTarget.style.color = '#60a5fa'}
        >
          📞 {user.phone}
        </div>
      ) : (
        <div style={{ color: '#4a5568', fontSize: '11px', marginBottom: '8px' }}>No phone</div>
      )}

      {/* Bottom row: stars */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <StarRating value={user.starRating || 0} onChange={onStarChange} />
      </div>
    </div>
  );
}

// ── Main Pipeline ─────────────────────────────────────────────────────────
export default function ProspectPipeline({ users, onOpenCard, onOpenDialer, onAddExisting, onRefresh }) {
  const [stageMap, setStageMap] = useState(loadStages);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Assign new prospects to 'reviewing' if they don't have a stage yet
  useEffect(() => {
    const map = loadStages();
    let changed = false;
    users.forEach(u => {
      if (!map[u.id]) { map[u.id] = 'reviewing'; changed = true; }
    });
    if (changed) { saveStages(map); setStageMap({ ...map }); }
  }, [users]);

  const moveTo = (userId, stageId) => {
    const map = { ...stageMap, [userId]: stageId };
    saveStages(map);
    setStageMap(map);
  };

  const handleDragStart = (e, userId) => {
    setDragId(userId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    if (dragId) moveTo(dragId, stageId);
    setDragId(null);
    setDragOver(null);
  };

  const usersInStage = (stageId) =>
    users.filter(u => (stageMap[u.id] || 'reviewing') === stageId);

  const handleStarChange = async (user, stars) => {
    try {
      await base44.entities.InvestorUser.update(user.id, { starRating: stars });
      onRefresh();
    } catch {}
  };

  const totalValue = users.reduce((sum, u) => sum + (Number(u.investmentAmount) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#e8e0d0', margin: '0 0 3px', fontSize: '18px', fontWeight: 'normal' }}>Potential Investors — Pipeline</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
            Drag cards between stages · {users.length} prospects · Pipeline value: <strong style={{ color: GOLD }}>${totalValue.toLocaleString()}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onAddExisting}
            style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            + Add Client
          </button>
          <button onClick={onRefresh}
            style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>
            ↻
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', alignItems: 'start' }}>
        {STAGES.map(stage => {
          const cards = usersInStage(stage.id);
          const isOver = dragOver === stage.id;
          const stageValue = cards.reduce((s, u) => s + (Number(u.investmentAmount) || 0), 0);
          return (
            <div key={stage.id}
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, stage.id)}
              style={{
                background: isOver ? stage.bg : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isOver ? stage.color : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '6px',
                minHeight: '800px',
                transition: 'all 0.15s',
              }}>

              {/* Stage header */}
              <div style={{ padding: '12px 12px 10px', borderBottom: `2px solid ${stage.color}44` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ color: stage.color, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>{stage.label}</span>
                  <span style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.border}`, borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 'bold' }}>{cards.length}</span>
                </div>
                {stageValue > 0 && (
                  <div style={{ color: '#4ade80', fontSize: '11px', fontWeight: 'bold' }}>
                    ${stageValue.toLocaleString()}
                  </div>
                )}
                {/* Stage value bar */}
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '6px' }}>
                  <div style={{ height: '100%', background: stage.color, borderRadius: '2px', width: `${Math.min(100, cards.length * 20)}%`, transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Cards */}
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cards.map(user => (
                  <PipelineCard
                    key={user.id}
                    user={user}
                    stage={stage}
                    onDragStart={e => handleDragStart(e, user.id)}
                    onOpenCard={() => onOpenCard(user)}
                    onOpenDialer={() => onOpenDialer(user)}
                    onStarChange={(stars) => handleStarChange(user, stars)}
                  />
                ))}
                {cards.length === 0 && (
                  <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '32px 8px', fontStyle: 'italic', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.06)', margin: '4px' }}>
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}