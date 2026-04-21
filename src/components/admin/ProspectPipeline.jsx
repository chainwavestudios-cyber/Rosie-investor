import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STAGES = [
  { id: 'reviewing',  label: 'Reviewing Info',   color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)' },
  { id: 'read',       label: 'Read Info',         color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
  { id: 'callback',   label: 'Call Back',         color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
  { id: 'preclose',   label: 'Pre-Close',         color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)' },
  { id: 'load',       label: 'Load',              color: GOLD,      bg: 'rgba(184,147,58,0.08)',  border: 'rgba(184,147,58,0.25)' },
];

const STAGE_KEY = 'prospect_pipeline_stages';

function loadStages() {
  try { return JSON.parse(localStorage.getItem(STAGE_KEY) || '{}'); } catch { return {}; }
}
function saveStages(map) {
  localStorage.setItem(STAGE_KEY, JSON.stringify(map));
}

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#e8e0d0', margin: '0 0 3px', fontSize: '18px', fontWeight: 'normal' }}>Potential Investors — Pipeline</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>Drag cards between stages. Click name to open contact, click number to dial.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onAddExisting}
            style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            + Add to Load Stage
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
          return (
            <div key={stage.id}
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, stage.id)}
              style={{
                background: isOver ? stage.bg : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isOver ? stage.color : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '4px',
                minHeight: '200px',
                transition: 'all 0.15s',
              }}>
              {/* Stage header */}
              <div style={{ padding: '10px 12px', borderBottom: `2px solid ${stage.color}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: stage.color, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>{stage.label}</span>
                <span style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.border}`, borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 'bold' }}>{cards.length}</span>
              </div>

              {/* Cards */}
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {cards.map(user => (
                  <PipelineCard
                    key={user.id}
                    user={user}
                    stage={stage}
                    onDragStart={e => handleDragStart(e, user.id)}
                    onOpenCard={() => onOpenCard(user)}
                    onOpenDialer={() => onOpenDialer(user)}
                  />
                ))}
                {cards.length === 0 && (
                  <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px 8px', fontStyle: 'italic' }}>
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

function PipelineCard({ user, stage, onDragStart, onOpenCard, onOpenDialer }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => { setDragging(true); onDragStart(e); }}
      onDragEnd={() => setDragging(false)}
      style={{
        background: dragging ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${stage.border}`,
        borderLeft: `3px solid ${stage.color}`,
        borderRadius: '3px',
        padding: '8px 10px',
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        transition: 'all 0.1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
      onMouseLeave={e => e.currentTarget.style.background = dragging ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.04)'}
    >
      {/* Name */}
      <div
        onClick={onOpenCard}
        style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onMouseEnter={e => e.currentTarget.style.color = stage.color}
        onMouseLeave={e => e.currentTarget.style.color = '#e8e0d0'}
      >
        {user.name}
      </div>

      {/* Phone */}
      {user.phone ? (
        <div
          onClick={e => { e.stopPropagation(); onOpenDialer(); }}
          style={{ color: '#4ade80', fontSize: '10px', fontFamily: 'monospace', cursor: 'pointer', marginBottom: '4px' }}
          onMouseEnter={e => e.currentTarget.style.color = '#86efac'}
          onMouseLeave={e => e.currentTarget.style.color = '#4ade80'}
        >
          📞 {user.phone}
        </div>
      ) : (
        <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '4px' }}>No phone</div>
      )}

      {/* Last called */}
      {user.lastCalledAt && (
        <div style={{ color: '#6b7280', fontSize: '9px', letterSpacing: '0.5px' }}>
          Called: {fmt(user.lastCalledAt)}
        </div>
      )}
    </div>
  );
}