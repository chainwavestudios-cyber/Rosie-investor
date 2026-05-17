import { useState, useEffect } from 'react';
import { AppointmentDB } from '@/api/entities';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

// ── Event Detail Popup ──────────────────────────────────────────────────────
function EventPopup({ evt, onClose, onOpenCard, onOpenLeadCard }) {
  const [updating, setUpdating] = useState(false);

  const isInvestor = evt.type === 'investor';

  const updateApptStatus = async (status) => {
    setUpdating(true);
    try {
      await AppointmentDB.update(evt.id, { status });
    } catch {}
    setUpdating(false);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0d1b2a', border: `2px solid ${evt.color}55`, borderRadius: '10px', padding: '24px', width: '380px', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', fontFamily: 'Georgia, serif' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ color: evt.color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
              {isInvestor ? '👤 Investor Appointment' : '📞 Lead Callback'}
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold' }}>{evt.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: '0 2px' }}>×</button>
        </div>

        {/* Date/Time */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px', marginBottom: '14px' }}>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>
            📅 {evt.dateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ color: '#8a9ab8', fontSize: '12px', marginTop: '3px' }}>
            🕐 {evt.dateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>

        {/* Notes */}
        {evt.notes && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' }}>Notes</div>
            <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{evt.notes}</div>
          </div>
        )}

        {/* Phone */}
        {evt.phone && (
          <div style={{ marginBottom: '14px', color: '#4ade80', fontSize: '13px', fontFamily: 'monospace' }}>📞 {evt.phone}</div>
        )}

        {/* Status for investor appointments */}
        {isInvestor && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {['completed', 'no-show', 'cancelled'].map(s => (
              <button key={s} onClick={() => updateApptStatus(s)} disabled={updating}
                style={{
                  flex: 1, background: evt.status === s ? `${s === 'completed' ? 'rgba(74,222,128,0.2)' : s === 'no-show' ? 'rgba(239,68,68,0.2)' : 'rgba(100,100,100,0.2)'}` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${s === 'completed' ? 'rgba(74,222,128,0.4)' : s === 'no-show' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '4px', padding: '7px', cursor: 'pointer',
                  color: s === 'completed' ? '#4ade80' : s === 'no-show' ? '#ef4444' : '#8a9ab8',
                  fontSize: '10px', letterSpacing: '0.5px', textTransform: 'capitalize'
                }}>
                {s === 'completed' ? '✅ Completed' : s === 'no-show' ? '🚫 No-Show' : '❌ Cancelled'}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isInvestor && (
            <button onClick={() => updateApptStatus('completed')} disabled={updating}
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
              ✅ Completed Meeting
            </button>
          )}
          {isInvestor && (
            <button onClick={() => { const d = prompt('New date/time (e.g. 2025-06-15T14:00):'); if (d) AppointmentDB.update(evt.id, { scheduledAt: new Date(d).toISOString() }).then(onClose); }}
              style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              🔄 Reschedule Meeting
            </button>
          )}
          {isInvestor && (
            <button onClick={() => updateApptStatus('cancelled')} disabled={updating}
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              ❌ Cancel Meeting
            </button>
          )}
          <button onClick={() => { onClose(); onOpenCard(evt); }}
            style={{ background: `rgba(184,147,58,0.15)`, color: GOLD, border: `1px solid rgba(184,147,58,0.35)`, borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
            👤 {isInvestor ? 'Investor Contact Card' : 'Lead Contact Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GlobalCalendar({ users = [], setContactCard, setView, setOpenLeadId }) {
  const [allAppts, setAllAppts] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedEvt, setSelectedEvt] = useState(null);

  useEffect(() => {
    Promise.all([
      AppointmentDB.listAll(),
      base44.entities.Lead.list('-created_date', 2000),
    ]).then(([a, l]) => { setAllAppts(a); setAllLeads(l); setLoading(false); });
  }, []);

  const today = new Date();
  today.setHours(0,0,0,0);
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(startDay); d.setDate(d.getDate() + i); return d; });
  const isToday = (d) => d.toDateString() === new Date().toDateString();

  const invEvents = allAppts.map(a => ({ id:a.id, type:'investor', raw:a, title:a.title||'Appointment', name:a.investorName||'', dateTime:new Date(a.scheduledAt), status:a.status||'scheduled', notes:a.notes||'', phone:null, color:'#60a5fa', leadType: null }));
  const leadEvents = allLeads.filter(l => l.callbackAt && l.status !== 'callback_later' && l.status !== 'converted' && l.status !== 'not_interested').map(l => ({ id:l.id, type:'lead', raw:l, title:'Lead Callback', name:`${l.firstName} ${l.lastName}`, dateTime:new Date(l.callbackAt), status:'scheduled', notes: l.notes || '', phone:l.phone, color:'#a78bfa', leadType: l.leadType || 'standard' }));
  const allEvents = [...invEvents, ...leadEvents].filter(e => filter === 'all' || e.type === filter);
  const eventsForDay = (day) => allEvents.filter(e => e.dateTime.toDateString() === day.toDateString()).sort((a,b) => a.dateTime - b.dateTime);
  const statusColors = { scheduled:GOLD, completed:'#4ade80', cancelled:'#4a5568', 'no-show':'#ef4444' };
  const totalUpcoming = allEvents.filter(e => e.dateTime >= today).length;

  const handleDrop = async (targetDay, e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    if (!dragging || dragging.type !== 'investor') return;
    const appt = dragging; setDragging(null);
    const orig = new Date(appt.dateTime);
    const newDate = new Date(targetDay);
    newDate.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    if (newDate.toDateString() === orig.toDateString()) return;
    setAllAppts(prev => prev.map(a => a.id === appt.id ? {...a, scheduledAt: newDate.toISOString()} : a));
    try { await AppointmentDB.update(appt.id, { scheduledAt: newDate.toISOString() }); }
    catch (err) { console.error('Failed to move appointment:', err); setAllAppts(prev => prev.map(a => a.id === appt.id ? appt.raw : a)); }
  };

  const handleCardClick = (evt) => {
    setSelectedEvt(evt);
  };

  const handleOpenCardFromPopup = (evt) => {
    if (evt.type === 'investor') {
      const investorUserId = evt.raw?.investorId || evt.id;
      const u = users.find(u => u.id === investorUserId);
      if (u) { setContactCard(u); }
      else { base44.entities.InvestorUser.filter({id:investorUserId}).then(rows => { if (rows?.[0]) setContactCard(rows[0]); }).catch(()=>{}); }
    } else if (evt.type === 'lead') {
      setOpenLeadId(evt.id); setView('leads');
    }
  };

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      {selectedEvt && (
        <EventPopup
          evt={selectedEvt}
          onClose={() => setSelectedEvt(null)}
          onOpenCard={handleOpenCardFromPopup}
          onOpenLeadCard={(lead) => { setOpenLeadId(lead.id); setView('leads'); }}
        />
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 2px', fontSize:'20px', fontWeight:'normal' }}>📅 Calendar</h2>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Click a card to view details · Drag investor appointments to reschedule</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          {[['all','All'],['investor','👤 Investors'],['lead','🎯 Leads']].map(([id,label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{ background:filter===id?'rgba(184,147,58,0.15)':'transparent', border:filter===id?`1px solid ${GOLD}`:'1px solid rgba(255,255,255,0.1)', color:filter===id?GOLD:'#6b7280', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>{label}</button>
          ))}
          <div style={{ color:GOLD, fontWeight:'bold', fontSize:'14px', marginLeft:'8px' }}>{totalUpcoming} upcoming</div>
          <button onClick={() => setWeekOffset(0)} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>Today</button>
          <button onClick={() => setWeekOffset(w => w-1)} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'13px' }}>‹</button>
          <button onClick={() => setWeekOffset(w => w+1)} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'13px' }}>›</button>
        </div>
      </div>

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'60px' }}>Loading…</div>}

      {!loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px', minHeight:'500px' }}>
          {days.map((day, i) => {
            const dayEvents = eventsForDay(day);
            const isT = isToday(day);
            const isPast = day < today && !isT;
            const isDropTarget = dragOver === i;
            return (
              <div key={i}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(i); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                onDrop={e => handleDrop(day, e)}
                style={{ background:isDropTarget?'rgba(184,147,58,0.1)':isT?'rgba(184,147,58,0.06)':'rgba(255,255,255,0.02)', border:isDropTarget?`2px dashed ${GOLD}`:isT?`1px solid rgba(184,147,58,0.35)`:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'8px', minHeight:'120px', opacity:isPast?0.6:1, transition:'background 0.15s, border 0.15s' }}>
                <div style={{ marginBottom:'8px', textAlign:'center' }}>
                  <div style={{ color:isT?GOLD:'#6b7280', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase' }}>{day.toLocaleDateString('en-US',{weekday:'short'})}</div>
                  <div style={{ color:isT?GOLD:isPast?'#4a5568':'#e8e0d0', fontSize:'18px', fontWeight:isT?'bold':'normal', lineHeight:1.2 }}>{day.getDate()}</div>
                  {isT && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, margin:'2px auto 0' }} />}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {dayEvents.map(evt => {
                    // Lead type pill label
                    const isNBTech = evt.leadType === 'nb_tech';
                    const leadTypePill = evt.type === 'lead' ? (
                      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'3px' }}>
                        <span style={{ background: isNBTech ? 'rgba(99,102,241,0.2)' : 'rgba(167,139,250,0.15)', color: isNBTech ? '#818cf8' : '#a78bfa', border: `1px solid ${isNBTech ? 'rgba(99,102,241,0.4)' : 'rgba(167,139,250,0.35)'}`, borderRadius: '3px', padding: '1px 5px', fontSize: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                          {isNBTech ? '💡 NB Tech' : '🚀 Prospect'}
                        </span>
                      </div>
                    ) : null;

                    return (
                      <div key={`${evt.type}-${evt.id}`}
                        draggable={evt.type==='investor'}
                        onDragStart={e => { e.stopPropagation(); setDragging(evt); }}
                        onDragEnd={() => { setDragging(null); setDragOver(null); }}
                        onClick={() => handleCardClick(evt)}
                        style={{ background:`${evt.color}18`, border:`1px solid ${evt.color}44`, borderLeft:`3px solid ${evt.color}`, borderRadius:'3px', padding:'5px 7px', cursor:'pointer', userSelect:'none', opacity:dragging?.id===evt.id?0.4:1, transition:'all 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background=`${evt.color}30`}
                        onMouseLeave={e => e.currentTarget.style.background=`${evt.color}18`}>
                        <div style={{ color:'#e8e0d0', fontSize:'10px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.name}</div>
                        <div style={{ color:'#6b7280', fontSize:'9px', marginTop:'1px' }}>{evt.dateTime.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div>
                        {/* Clickable phone number instead of title */}
                        {evt.phone && (
                          <div
                            onClick={e => { e.stopPropagation(); handleCardClick(evt); }}
                            style={{ color:'#4ade80', fontSize:'9px', fontFamily:'monospace', marginTop:'2px', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(74,222,128,0.4)' }}>
                            {evt.phone}
                          </div>
                        )}
                        {evt.type==='investor' && <div style={{ color:statusColors[evt.status]||GOLD, fontSize:'8px', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>● {evt.status}</div>}
                        {leadTypePill}
                      </div>
                    );
                  })}
                  {dayEvents.length === 0 && <div style={{ color:'#2d3748', fontSize:'10px', textAlign:'center', padding:'8px 0', borderTop:'1px dashed rgba(255,255,255,0.04)', marginTop:'4px' }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && weekOffset === 0 && (() => {
        const past = allEvents.filter(e => e.dateTime < today).sort((a,b) => b.dateTime - a.dateTime).slice(0,8);
        if (!past.length) return null;
        return (
          <div style={{ marginTop:'24px', opacity:0.5 }}>
            <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>✓ Past</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {past.map(evt => (
                <div key={`past-${evt.type}-${evt.id}`}
                  onClick={() => handleCardClick(evt)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'4px', borderLeft:`3px solid ${evt.color}`, cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
                  <div>
                    <span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold', marginRight:'8px' }}>{evt.name}</span>
                    {evt.phone && <span style={{ color:'#4ade80', fontSize:'11px', fontFamily:'monospace' }}>{evt.phone}</span>}
                  </div>
                  <span style={{ color:'#4a5568', fontSize:'10px' }}>{evt.dateTime.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}