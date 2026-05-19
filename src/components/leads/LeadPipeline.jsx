import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { usePortalAuth } from '@/lib/PortalAuthContext';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STAGE_COLORS = [
  { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)' },
  { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
  { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)' },
  { color: GOLD,      bg: 'rgba(184,147,58,0.08)',  border: 'rgba(184,147,58,0.25)' },
];

const DEFAULT_STAGES = [
  { id: 'reviewing', label: 'Reviewing Info' },
  { id: 'read',      label: 'Read Info' },
  { id: 'callback',  label: 'Call Back' },
  { id: 'preclose',  label: 'Pre-Close' },
  { id: 'load',      label: 'Load' },
];

const STAGES_KEY = 'lead_pipeline_stages_v1';

function loadStages() {
  try {
    const stored = localStorage.getItem(STAGES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_STAGES;
}

function saveStages(stages) {
  localStorage.setItem(STAGES_KEY, JSON.stringify(stages));
}

function StarRating({ value = 0, onChange }) {
  const [hover, setHover] = useState(null);

  const handleClick = (e, star) => {
    e.stopPropagation();
    const clickX = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const isLeft = clickX < e.currentTarget.offsetWidth / 2;
    const newVal = isLeft ? star - 0.5 : star;
    onChange(newVal === value ? 0 : newVal);
  };

  const displayVal = hover !== null ? hover : value;

  return (
    <div style={{ display: 'flex', gap: '1px' }} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map(star => {
        const full = displayVal >= star;
        const half = !full && displayVal >= star - 0.5;
        return (
          <div key={star} style={{ position: 'relative', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
            onMouseMove={e => {
              const isLeft = e.clientX - e.currentTarget.getBoundingClientRect().left < 8;
              setHover(isLeft ? star - 0.5 : star);
            }}
            onClick={e => handleClick(e, star)}>
            <span style={{ position: 'absolute', inset: 0, color: 'rgba(255,255,255,0.15)', fontSize: '15px', lineHeight: '16px', userSelect: 'none' }}>★</span>
            {(full || half) && (
              <span style={{ position: 'absolute', inset: 0, fontSize: '15px', lineHeight: '16px', userSelect: 'none', color: '#f59e0b', clipPath: full ? 'none' : 'inset(0 50% 0 0)' }}>★</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function fmtDur(s) {
  if (!s) return null;
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function LeadPipelineCard({ lead, stage, onDragStart, onOpenCard, hasApptToday, apptTime, onStarChange }) {
  const [dragging, setDragging] = useState(false);
  const [starVal, setStarVal] = useState(lead.starRating || 0);

  return (
    <div draggable
      onDragStart={e => { setDragging(true); onDragStart(e); }}
      onDragEnd={() => setDragging(false)}
      onClick={onOpenCard}
      style={{
        background: dragging ? 'rgba(0,0,0,0.4)' : hasApptToday ? 'rgba(245,158,11,0.06)' : '#0d1b2a',
        border: hasApptToday ? `1px solid rgba(245,158,11,0.35)` : `1px solid ${stage.border}`,
        borderLeft: `3px solid ${hasApptToday ? '#f59e0b' : stage.color}`,
        borderRadius: '4px',
        padding: '10px 10px 8px',
        cursor: 'pointer',
        opacity: dragging ? 0.4 : 1,
        transition: 'all 0.1s',
        userSelect: 'none',
        boxShadow: hasApptToday ? '0 2px 12px rgba(245,158,11,0.15)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = hasApptToday ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = hasApptToday ? 'rgba(245,158,11,0.06)' : '#0d1b2a'; }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
        <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
          {lead.firstName} {lead.lastName}
          {lead.leadType === 'nb_tech' && (
            <span style={{ marginLeft: '5px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '3px', padding: '0px 4px', fontSize: '8px', fontWeight: 'bold', verticalAlign: 'middle' }}>NB</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {hasApptToday && <span style={{ fontSize: '14px', animation: 'calPulse 1.4s ease-in-out infinite', display: 'inline-block' }}>📅</span>}
          {lead.engagementScore > 0 && (
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: `2px solid ${GOLD}`, background: `rgba(184,147,58,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: GOLD, fontSize: '9px', fontWeight: 'bold' }}>{lead.engagementScore}</span>
            </div>
          )}
        </div>
      </div>

      {lead.email && <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</div>}
      {lead.phone && <div style={{ color: '#60a5fa', fontSize: '10px', fontFamily: 'monospace', marginBottom: '4px' }}>📞 {lead.phone}</div>}

      {lead.lastCalledAt ? (
        <span style={{ color: '#6b7280', fontSize: '9px', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px', display: 'inline-block', marginBottom: '6px' }}>
          📞 {fmtDate(lead.lastCalledAt)}
          {lead.lastCallDurationSeconds ? ` · ⏱ ${fmtDur(lead.lastCallDurationSeconds)}` : ''}
        </span>
      ) : (
        <div style={{ color: '#4a5568', fontSize: '9px', marginBottom: '6px' }}>Never called</div>
      )}

      <div onClick={e => e.stopPropagation()} style={{ marginTop: '2px', marginBottom: hasApptToday ? '6px' : '0' }}>
        <StarRating value={starVal} onChange={val => { setStarVal(val); onStarChange(val); }} />
      </div>

      {hasApptToday && apptTime && (
        <div style={{ marginTop: '6px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '3px', padding: '4px 7px', display: 'flex', alignItems: 'center', gap: '5px', animation: 'apptPulse 2s ease-in-out infinite' }}>
          <span style={{ fontSize: '11px' }}>📅</span>
          <span style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }}>Appointment {apptTime}</span>
        </div>
      )}
    </div>
  );
}

function StageHeader({ stage, onRename, onDelete, canDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(stage.label);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => { if (val.trim()) onRename(val.trim()); setEditing(false); };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      {editing ? (
        <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(stage.label); setEditing(false); } }}
          style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: `1px solid ${stage.color}`, borderRadius: '3px', padding: '2px 6px', color: stage.color, fontSize: '10px', outline: 'none', fontFamily: 'Georgia, serif', letterSpacing: '1px', textTransform: 'uppercase' }}
        />
      ) : (
        <span onClick={() => setEditing(true)} title="Click to rename"
          style={{ color: stage.color, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold', cursor: 'text', flex: 1 }}>
          {stage.label}
        </span>
      )}
      {canDelete && (
        <button onClick={onDelete} title="Remove stage"
          style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

// ── Per-user sub-pipeline selector ─────────────────────────────────────────
// pipelineType: 'prospect' | 'nb_tech'
function PipelineTypeSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {[['prospect', '🚀 Prospect Pipeline'], ['nb_tech', '💡 NB Tech Pipeline']].map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          style={{
            background: value === id ? (id === 'nb_tech' ? 'rgba(99,102,241,0.2)' : 'rgba(167,139,250,0.15)') : 'rgba(255,255,255,0.04)',
            border: `1px solid ${value === id ? (id === 'nb_tech' ? 'rgba(99,102,241,0.5)' : 'rgba(167,139,250,0.4)') : 'rgba(255,255,255,0.1)'}`,
            color: value === id ? (id === 'nb_tech' ? '#818cf8' : '#a78bfa') : '#6b7280',
            borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '11px',
            fontWeight: value === id ? 'bold' : 'normal',
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function LeadPipeline({ onOpenLead, mockLeads = null }) {
  const { portalUser } = usePortalAuth();
  const currentUsername = portalUser?.username || 'admin';
  const otherUsername = currentUsername === 'steph' ? 'admin' : 'steph';

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [todayApptLeadIds, setTodayApptLeadIds] = useState(new Set());
  const [apptTimeMap, setApptTimeMap] = useState({});
  const [stages, setStages] = useState(loadStages);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  // 'mine' | 'other' — which user's pipeline we're looking at
  const [pipelineView, setPipelineView] = useState('mine');
  // Per-user sub-pipeline type: keyed by username
  const [pipelineTypes, setPipelineTypes] = useState({ [currentUsername]: 'prospect', [otherUsername]: 'prospect' });

  useEffect(() => {
    if (mockLeads) {
      setLeads(mockLeads);
      setLoading(false);
      return;
    }
    loadData();
    // No auto-poll — data loaded on mount and manual refresh only
    // no interval to clear
  }, [mockLeads]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allLeads, appts, histories] = await Promise.all([
        base44.entities.Lead.list('-created_date', 2000),
        base44.entities.Appointment.filter({ status: 'scheduled' }),
        base44.entities.LeadHistory.list('-created_date', 100).catch(() => []),
      ]);

      // Filter: only non-migrated, non-converted, and either prospect status OR nb_tech leadType
      const merged = (allLeads || []).filter(l =>
        !l.migratedToPortal && 
        !l.convertedToInvestorUserId &&
        (l.status === 'prospect' || l.leadType === 'nb_tech')
      );

      // Attach last call duration
      const callsByLead = {};
      histories.filter(h => h.type === 'call' && h.callDurationSeconds > 0).forEach(h => {
        if (!callsByLead[h.leadId] || new Date(h.created_date) > new Date(callsByLead[h.leadId].created_date)) {
          callsByLead[h.leadId] = h;
        }
      });
      const enriched = merged.map(l => ({ ...l, lastCallDurationSeconds: callsByLead[l.id]?.callDurationSeconds || null }));

      // Ensure pipeline stage
      const needsStage = enriched.filter(l => !l.leadPipelineStage);
      if (needsStage.length > 0) {
        await Promise.all(needsStage.map(l => base44.entities.Lead.update(l.id, { leadPipelineStage: 'reviewing' }).catch(() => {})));
        enriched.forEach(l => { if (!l.leadPipelineStage) l.leadPipelineStage = 'reviewing'; });
      }

      setLeads(enriched);

      const today = new Date().toDateString();
      const todayAppts = appts.filter(a => a.scheduledAt && new Date(a.scheduledAt).toDateString() === today);
      const ids = new Set(todayAppts.map(a => a.investorId));
      const timeMap = {};
      todayAppts.forEach(a => { timeMap[a.investorId] = new Date(a.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); });
      enriched.forEach(l => {
        if (l.callbackAt && new Date(l.callbackAt).toDateString() === today) {
          ids.add(l.id);
          if (!timeMap[l.id]) timeMap[l.id] = new Date(l.callbackAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
      });
      setTodayApptLeadIds(ids);
      setApptTimeMap(timeMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const moveTo = async (leadId, stageId) => {
    await base44.entities.Lead.update(leadId, { leadPipelineStage: stageId }).catch(() => {});
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, leadPipelineStage: stageId } : l));
  };

  const handleStarChange = async (leadId, val) => {
    await base44.entities.Lead.update(leadId, { starRating: val }).catch(() => {});
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, starRating: val } : l));
  };

  const handleDragStart = (e, leadId) => { setDragId(leadId); e.dataTransfer.effectAllowed = 'move'; };
  const handleDrop = (e, stageId) => { e.preventDefault(); if (dragId) moveTo(dragId, stageId); setDragId(null); setDragOver(null); };

  const renameStage = (stageId, newLabel) => {
    const updated = stages.map(s => s.id === stageId ? { ...s, label: newLabel } : s);
    setStages(updated); saveStages(updated);
  };

  const deleteStage = (stageId) => {
    if (stages.length <= 1) return;
    const updated = stages.filter(s => s.id !== stageId);
    setStages(updated); saveStages(updated);
    const fallback = updated[0].id;
    leads.filter(l => (l.leadPipelineStage || 'reviewing') === stageId).forEach(l => moveTo(l.id, fallback));
  };

  const addStage = () => {
    if (!newStageName.trim()) return;
    const id = newStageName.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const updated = [...stages, { id, label: newStageName.trim() }];
    setStages(updated); saveStages(updated);
    setNewStageName(''); setAddingStage(false);
  };

  const getStageStyle = (idx) => STAGE_COLORS[idx % STAGE_COLORS.length];

  // Determine which owner and pipeline type to display
  const viewOwner = pipelineView === 'mine' ? currentUsername : otherUsername;
  const currentPipelineType = pipelineTypes[viewOwner] || 'prospect';

  // Filter leads: show all prospect OR nb_tech leads regardless of status
  const visibleLeads = leads.filter(l => {
    const owner = l.leadPipelineOwner || 'admin';
    if (owner !== viewOwner) return false;
    if (currentPipelineType === 'nb_tech') return l.leadType === 'nb_tech';
    // Prospect pipeline: show all leads that aren't explicitly nb_tech
    return l.leadType !== 'nb_tech';
  });

  const leadsInStage = (stageId) => visibleLeads.filter(l => (l.leadPipelineStage || 'reviewing') === stageId).sort((a, b) => {
    return (todayApptLeadIds.has(b.id) ? 1 : 0) - (todayApptLeadIds.has(a.id) ? 1 : 0);
  });

  // Count helpers for tab badges
  const countFor = (username, type) => leads.filter(l => {
    const owner = l.leadPipelineOwner || 'admin';
    if (owner !== username) return false;
    if (type === 'nb_tech') return l.leadType === 'nb_tech';
    return l.leadType !== 'nb_tech';
  }).length;

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280', fontFamily: 'Georgia, serif' }}>Loading pipeline…</div>;

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <style>{`
        @keyframes calPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
        @keyframes apptPulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(245,158,11,0); } 50% { opacity: 0.85; box-shadow: 0 0 8px 2px rgba(245,158,11,0.25); } }
      `}</style>

      {/* ── User pipeline tabs ── */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '16px' }}>
        {[['mine', currentUsername], ['other', otherUsername]].map(([view, username]) => {
          const displayName = username === 'steph' ? 'Steph' : 'Admin';
          const prospectCount = countFor(username, 'prospect');
          const nbCount = countFor(username, 'nb_tech');
          return (
            <button key={view} onClick={() => setPipelineView(view)}
              style={{ background: 'none', border: 'none', borderBottom: pipelineView === view ? `2px solid ${GOLD}` : '2px solid transparent', color: pipelineView === view ? GOLD : '#6b7280', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.5px' }}>
              👤 {displayName}'s Pipeline
              <span style={{ marginLeft: '6px', fontSize: '10px', color: '#4a5568' }}>({prospectCount}🚀 {nbCount}💡)</span>
            </button>
          );
        })}
      </div>

      {/* ── Sub-pipeline type selector for active user ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <PipelineTypeSelector
          value={currentPipelineType}
          onChange={type => setPipelineTypes(prev => ({ ...prev, [viewOwner]: type }))}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          {addingStage ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={newStageName} onChange={e => setNewStageName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addStage(); if (e.key === 'Escape') { setAddingStage(false); setNewStageName(''); } }}
                placeholder="Stage name…" autoFocus
                style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${GOLD}`, borderRadius: '3px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif', width: '140px' }} />
              <button onClick={addStage} style={{ background: `linear-gradient(135deg,${GOLD},#d4aa50)`, color: DARK, border: 'none', borderRadius: '3px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Add</button>
              <button onClick={() => { setAddingStage(false); setNewStageName(''); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '6px 10px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingStage(true)} style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '7px 14px', cursor: 'pointer', fontSize: '11px' }}>+ Add Stage</button>
          )}
          <button onClick={loadData} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '7px 12px', cursor: 'pointer', fontSize: '11px' }}>↻</button>
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ color: '#e8e0d0', margin: '0 0 3px', fontSize: '18px', fontWeight: 'normal' }}>
          {currentPipelineType === 'nb_tech' ? '💡 NB Tech Pipeline' : '🚀 Prospect Pipeline'} — {viewOwner === currentUsername ? (currentUsername === 'steph' ? 'Steph' : 'Admin') : (otherUsername === 'steph' ? 'Steph' : 'Admin')}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
          Drag cards between stages · {visibleLeads.length} leads · Click stage name to rename
        </p>
      </div>

      {/* ── Kanban board ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(180px, 1fr))`, gap: '12px', alignItems: 'start', overflowX: 'auto' }}>
        {stages.map((stage, idx) => {
          const style = getStageStyle(idx);
          const stageWithStyle = { ...stage, ...style };
          const cards = leadsInStage(stage.id);
          const isOver = dragOver === stage.id;
          return (
            <div key={stage.id}
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, stage.id)}
              style={{ background: isOver ? style.bg : 'rgba(255,255,255,0.015)', border: `1px solid ${isOver ? style.color : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', minHeight: '500px', transition: 'all 0.15s' }}>

              <div style={{ padding: '12px 10px 8px', borderBottom: `2px solid ${style.color}44` }}>
                <StageHeader stage={stageWithStyle} onRename={label => renameStage(stage.id, label)} onDelete={() => deleteStage(stage.id)} canDelete={stages.length > 1} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', flex: 1, marginRight: '6px' }}>
                    <div style={{ height: '100%', background: style.color, borderRadius: '2px', width: `${Math.min(100, cards.length * 20)}%`, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>{cards.length}</span>
                </div>
              </div>

              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cards.map(lead => (
                  <LeadPipelineCard key={lead.id} lead={lead} stage={stageWithStyle}
                    hasApptToday={todayApptLeadIds.has(lead.id)} apptTime={apptTimeMap[lead.id] || null}
                    onDragStart={e => handleDragStart(e, lead.id)}
                    onOpenCard={() => onOpenLead(lead)}
                    onStarChange={val => handleStarChange(lead.id, val)}
                  />
                ))}
                {cards.length === 0 && (
                  <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', padding: '28px 6px', fontStyle: 'italic', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.06)', margin: '4px' }}>
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