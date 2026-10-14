/**
 * PipelineTab.jsx — 5-bucket drag-and-drop pipeline for interested prospects.
 * Buckets: 5-25, 25-50, 50-75, 75-99, Enrolled (100).
 * Cards show name, phone, city, state, email. Drag between buckets to update
 * dealScore. Cards with appointments in the next 2 hours get a neon pulsing
 * edge + meeting badge. Click a card to open the contact card.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const DARK = '#0a0f1e';

const BUCKETS = [
  { id: 'b1', label: '5-25', min: 5, max: 25, color: RED, score: 15 },
  { id: 'b2', label: '25-50', min: 25, max: 50, color: AMBER, score: 37 },
  { id: 'b3', label: '50-75', min: 50, max: 75, color: BLUE, score: 62 },
  { id: 'b4', label: '75-99', min: 75, max: 99, color: PURPLE, score: 87 },
  { id: 'b5', label: 'Enrolled', min: 100, max: 100, color: GOLD, score: 100 },
];

function getBucketForScore(score) {
  if (score >= 100) return 'b5';
  if (score >= 75) return 'b4';
  if (score >= 50) return 'b3';
  if (score >= 25) return 'b2';
  if (score >= 5) return 'b1';
  return null;
}

// Check if a lead has an appointment in the next 2 hours
function getUpcomingAppointment(lead, events) {
  const now = Date.now();
  const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.toLowerCase().trim();
  for (const ev of events) {
    const startMs = new Date(ev.start?.dateTime || ev.start?.date || ev.startTime || '').getTime();
    if (isNaN(startMs)) continue;
    const diffHrs = (startMs - now) / 3600000;
    if (diffHrs < 0 || diffHrs > 2) continue;
    // Match by name in event title
    const titleLower = (ev.title || '').toLowerCase();
    if (leadName && (titleLower.includes(leadName) || titleLower.includes(lead.firstName?.toLowerCase() || '') || titleLower.includes(lead.lastName?.toLowerCase() || ''))) {
      return { ...ev, minutesAway: Math.round((startMs - now) / 60000) };
    }
  }
  return null;
}

export default function PipelineTab({ onOpenLead }) {
  const [leads, setLeads] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.DebtLead.filter(
        { dealScore: { $gte: 5 }, status: { $nin: ['declined', 'completed'] }, deletedAt: { $exists: false } },
        { sort: '-dealScore', limit: 200 }
      );
      const all = page?.items || page || [];
      setLeads(all.filter(l => !l.deletedAt));
    } catch (e) {
      // Fallback: query without deletedAt filter (some DBs handle $exists differently)
      try {
        const page2 = await base44.entities.DebtLead.filter(
          { dealScore: { $gte: 5 }, status: { $nin: ['declined', 'completed'] } },
          { sort: '-dealScore', limit: 200 }
        );
        const all2 = page2?.items || page2 || [];
        setLeads(all2.filter(l => !l.deletedAt));
      } catch (e2) { console.error('Pipeline load failed:', e2); }
    }
    setLoading(false);
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('listCalendarEvents', { days: 1 });
      const data = res?.data || res;
      if (!data?.error) setEvents(data?.events || []);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    loadEvents();
    const interval = setInterval(loadEvents, 60000); // refresh events every minute
    return () => clearInterval(interval);
  }, [load, loadEvents]);

  const onDragEnd = async (result) => {
    setDraggingId(null);
    if (!result.destination) return;
    const { destination, draggableId } = result;
    const bucket = BUCKETS.find(b => b.id === destination.droppableId);
    if (!bucket) return;

    const lead = leads.find(l => l.id === draggableId);
    if (!lead) return;

    // Don't re-save if already in this bucket
    const currentBucket = getBucketForScore(lead.dealScore || 0);
    if (currentBucket === bucket.id) return;

    const updates = { dealScore: bucket.score };
    if (bucket.id === 'b5') {
      updates.status = 'enrolled';
      updates.programEnrolled = true;
      updates.enrollmentDate = new Date().toISOString().split('T')[0];
    }

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updates } : l));

    try {
      await base44.entities.DebtLead.update(lead.id, updates);
    } catch (e) {
      alert('Failed to update: ' + (e?.message || String(e)));
      load(); // revert on error
    }
  };

  // Group leads by bucket
  const buckets = {};
  BUCKETS.forEach(b => { buckets[b.id] = []; });
  leads.forEach(lead => {
    const bucketId = getBucketForScore(lead.dealScore || 0);
    if (bucketId) buckets[bucketId].push(lead);
  });

  return (
    <div>
      <style>{`
        @keyframes neon-pulse {
          0%, 100% { box-shadow: 0 0 5px ${GOLD}, 0 0 10px ${GOLD}, 0 0 15px ${GOLD}; }
          50% { box-shadow: 0 0 10px ${GOLD}, 0 0 20px ${GOLD}, 0 0 30px ${GOLD}; }
        }
        .neon-edge { animation: neon-pulse 1.5s ease-in-out infinite; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>📊 Deal Pipeline</span>
          <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '10px' }}>{leads.length} interested prospects</span>
        </div>
        <button onClick={load} disabled={loading} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{loading ? '⏳' : '↻ Refresh'}</button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', minHeight: '500px' }}>
          {BUCKETS.map(bucket => (
            <Droppable droppableId={bucket.id} key={bucket.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    background: snapshot.isDraggingOver ? `${bucket.color}11` : '#0d1b2a',
                    border: `1px solid ${snapshot.isDraggingOver ? bucket.color + '66' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '6px',
                    minHeight: '480px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  {/* Bucket header */}
                  <div style={{ padding: '10px 12px', borderBottom: `1px solid ${bucket.color}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: bucket.color, fontSize: '12px', fontWeight: 'bold' }}>{bucket.label === 'Enrolled' ? '🎓 Enrolled' : `Score ${bucket.label}`}</span>
                    <span style={{ color: '#6b7280', fontSize: '10px', fontWeight: 'bold' }}>{buckets[bucket.id].length}</span>
                  </div>

                  {/* Cards */}
                  <div style={{ flex: 1, padding: '6px', overflowY: 'auto', maxHeight: '440px' }}>
                    {buckets[bucket.id].map((lead, idx) => {
                      const appt = getUpcomingAppointment(lead, events);
                      const hasAppt = !!appt;
                      return (
                        <Draggable draggableId={lead.id} index={idx} key={lead.id}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => !snap.isDragging && onOpenLead?.(lead)}
                              className={hasAppt ? 'neon-edge' : ''}
                              style={{
                                ...prov.draggableProps.style,
                                background: snap.isDragging ? `${bucket.color}22` : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${hasAppt ? GOLD : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '4px',
                                padding: '8px 10px',
                                marginBottom: '5px',
                                cursor: 'pointer',
                                position: 'relative',
                              }}
                            >
                              {/* Meeting badge */}
                              {hasAppt && (
                                <div style={{ position: 'absolute', top: '-6px', right: '-4px', background: GOLD, color: DARK, fontSize: '8px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '8px', border: `1px solid ${DARK}` }}>
                                  📅 {appt.minutesAway}m
                                </div>
                              )}
                              <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>
                                {lead.firstName} {lead.lastName}
                              </div>
                              <div style={{ color: '#6b7280', fontSize: '9px', lineHeight: 1.4 }}>
                                {lead.phone && <div>📞 {lead.phone}</div>}
                                {lead.email && <div style={{ color: BLUE }}>✉ {lead.email}</div>}
                                {(lead.city || lead.state) && <div>📍 {[lead.city, lead.state].filter(Boolean).join(', ')}</div>}
                              </div>
                              <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: bucket.color, fontSize: '10px', fontWeight: 'bold' }}>{lead.dealScore}/100</span>
                                {lead.isHotLead && <span style={{ color: RED, fontSize: '9px' }}>🔥</span>}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <div style={{ marginTop: '12px', color: '#4a5568', fontSize: '11px' }}>
        💡 Drag cards between buckets to update their deal score. Cards with a pulsing neon edge have an appointment in the next 2 hours. Click a card to open the full contact profile.
      </div>
    </div>
  );
}