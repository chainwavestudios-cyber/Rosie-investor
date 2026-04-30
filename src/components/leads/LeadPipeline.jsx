import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STAGES = [
  { id: 'reviewing', label: 'Reviewing Info',  color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)' },
  { id: 'read',      label: 'Read Info',        color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
  { id: 'callback',  label: 'Call Back',        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
  { id: 'preclose',  label: 'Pre-Close',        color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)' },
  { id: 'load',      label: 'Load',             color: GOLD,      bg: 'rgba(184,147,58,0.08)',  border: 'rgba(184,147,58,0.25)' },
];

function LeadPipelineCard({ lead, stage, onDragStart, onOpenCard, hasApptToday }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div draggable
      onDragStart={e => { setDragging(true); onDragStart(e); }}
      onDragEnd={() => setDragging(false)}
      onClick={onOpenCard}
      style={{
        background: dragging ? 'rgba(0,0,0,0.4)' : '#0d1b2a',
        border: `1px solid ${stage.border}`,
        borderLeft: `3px solid ${stage.color}`,
        borderRadius: '4px',
        padding: '12px 12px 10px',
        cursor: 'pointer',
        opacity: dragging ? 0.4 : 1,
        transition: 'all 0.1s',
        userSelect: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#0d1b2a'; }}>

      {/* Pulsing calendar emoji for today's appointments */}
      {hasApptToday && (
        <div style={{
          position: 'absolute', top: '8px', right: '8px',
          fontSize: '16px',
          animation: 'calPulse 1.4s ease-in-out infinite',
        }}>📅</div>
      )}

      <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', paddingRight: hasApptToday ? '24px' : '0',
        onMouseEnter: e => e.currentTarget.style.color = stage.color }}>
        {lead.firstName} {lead.lastName}
      </div>

      {lead.email && (
        <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.email}
        </div>
      )}

      {lead.phone && (
        <div style={{ color: '#60a5fa', fontSize: '11px', fontFamily: 'monospace', marginBottom: '6px' }}>
          📞 {lead.phone}
        </div>
      )}

      {lead.state && (
        <div style={{ color: GOLD, fontSize: '10px', background: 'rgba(184,147,58,0.1)', display: 'inline-block', padding: '1px 6px', borderRadius: '2px', marginBottom: '4px' }}>
          {lead.state}
        </div>
      )}

      {lead.engagementScore > 0 && (
        <div style={{ marginTop: '4px' }}>
          <span style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, borderRadius: '20px', padding: '1px 7px', fontSize: '9px', fontWeight: 'bold' }}>
            ⭐ {lead.engagementScore}
          </span>
        </div>
      )}
    </div>
  );
}

export default function LeadPipeline({ onOpenLead }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [todayApptLeadIds, setTodayApptLeadIds] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allLeads, appts] = await Promise.all([
        base44.entities.Lead.filter({ status: 'prospect' }),
        base44.entities.Appointment.filter({ status: 'scheduled' }),
      ]);

      // Filter out migrated leads
      const prospects = allLeads.filter(l => !l.migratedToPortal && !l.convertedToInvestorUserId);

      // Ensure all have a pipelineStage
      const needsStage = prospects.filter(l => !l.leadPipelineStage);
      if (needsStage.length > 0) {
        await Promise.all(needsStage.map(l =>
          base44.entities.Lead.update(l.id, { leadPipelineStage: 'reviewing' }).catch(() => {})
        ));
        // Re-fetch with updated stages
        const refreshed = await base44.entities.Lead.filter({ status: 'prospect' });
        setLeads(refreshed.filter(l => !l.migratedToPortal && !l.convertedToInvestorUserId));
      } else {
        setLeads(prospects);
      }

      // Today's appointments
      const today = new Date().toDateString();
      const ids = new Set(
        appts.filter(a => a.scheduledAt && new Date(a.scheduledAt).toDateString() === today)
             .map(a => a.investorId)
      );
      setTodayApptLeadIds(ids);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const moveTo = async (leadId, stageId) => {
    try {
      await base44.entities.Lead.update(leadId, { leadPipelineStage: stageId });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, leadPipelineStage: stageId } : l));
    } catch (e) { console.error(e); }
  };

  const handleDragStart = (e, leadId) => {
    setDragId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    if (dragId) moveTo(dragId, stageId);
    setDragId(null);
    setDragOver(null);
  };

  const leadsInStage = (stageId) =>
    leads.filter(l => (l.leadPipelineStage || 'reviewing') === stageId);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280', fontFamily: 'Georgia, serif' }}>Loading pipeline…</div>
  );

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <style>{`
        @keyframes calPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#e8e0d0', margin: '0 0 3px', fontSize: '18px', fontWeight: 'normal' }}>🚀 Prospect Pipeline</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
            Drag cards between stages · {leads.length} prospects
          </p>
        </div>
        <button onClick={loadData}
          style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>
          ↻ Refresh
        </button>
      </div>

      {leads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
          <div style={{ color: '#4a5568', fontSize: '14px', marginBottom: '8px' }}>No prospects yet.</div>
          <div style={{ color: '#374151', fontSize: '12px' }}>Mark a lead as "Prospect" from the Leads tab to add them here.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', alignItems: 'start', overflowX: 'auto' }}>
          {STAGES.map(stage => {
            const cards = leadsInStage(stage.id);
            const isOver = dragOver === stage.id;
            return (
              <div key={stage.id}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, stage.id)}
                style={{
                  background: isOver ? stage.bg : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${isOver ? stage.color : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '6px',
                  minHeight: '600px',
                  transition: 'all 0.15s',
                }}>

                {/* Stage header */}
                <div style={{ padding: '12px 12px 10px', borderBottom: `2px solid ${stage.color}44` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: stage.color, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>{stage.label}</span>
                    <span style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.border}`, borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 'bold' }}>{cards.length}</span>
                  </div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '6px' }}>
                    <div style={{ height: '100%', background: stage.color, borderRadius: '2px', width: `${Math.min(100, cards.length * 20)}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>

                {/* Cards */}
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cards.map(lead => (
                    <LeadPipelineCard
                      key={lead.id}
                      lead={lead}
                      stage={stage}
                      hasApptToday={todayApptLeadIds.has(lead.id)}
                      onDragStart={e => handleDragStart(e, lead.id)}
                      onOpenCard={() => onOpenLead(lead)}
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
      )}
    </div>
  );
}