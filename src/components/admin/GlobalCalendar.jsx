import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AppointmentDB } from '@/api/entities';

const GOLD = '#b8933a';

export default function GlobalCalendar({ users = [], setContactCard, setView }) {
  const [allAppts, setAllAppts] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [filter, setFilter] = useState('all');

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

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDay);
    d.setDate(d.getDate() + i);
    return d;
  });

  const isToday = (d) => d.toDateString() === new Date().toDateString();

  const invEvents = allAppts.map(a => ({
    id: a.id, type: 'investor', raw: a,
    title: a.title || 'Appointment',
    name: a.investorName || '',
    dateTime: new Date(a.scheduledAt),
    status: a.status || 'scheduled',
    notes: a.notes || '',
    phone: null,
    color: '#60a5fa',
  }));

  const leadEvents = allLeads
    .filter(l => l.callbackAt && l.status !== 'callback_later' && l.status !== 'converted' && l.status !== 'not_interested')
    .map(l => ({
      id: l.id, type: 'lead', raw: l,
      title: 'Lead Callback',
      name: `${l.firstName} ${l.lastName}`,
      dateTime: new Date(l.callbackAt),
      status: 'scheduled',
      notes: '',
      phone: l.phone,
      color: '#a78bfa',
    }));

  const allEvents = [...invEvents, ...leadEvents].filter(e => filter === 'all' || e.type === filter);

  const eventsForDay = (day) =>
    allEvents.filter(e => e.dateTime.toDateString() === day.toDateString()).sort((a, b) => a.dateTime - b.dateTime);

  const statusColors = { scheduled: GOLD, completed: '#4ade80', cancelled: '#4a5568', 'no-show': '#ef4444' };

  const handleDrop = async (targetDay, e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    if (!dragging || dragging.type !== 'investor') return;
    const appt = dragging; setDragging(null);
    const orig = new Date(appt.dateTime);
    const newDate = new Date(targetDay);
    newDate.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    if (newDate.toDateString() === orig.toDateString()) return;
    setAllAppts(prev => prev.map(a => a.id === appt.id ? { ...a, scheduledAt: newDate.toISOString() } : a));
    try { await AppointmentDB.update(appt.id, { scheduledAt: newDate.toISOString() }); }
    catch { setAllAppts(prev => prev.map(a => a.id === appt.id ? appt.raw : a)); }
  };

  const totalUpcoming = allEvents.filter(e => e.dateTime >= today).length;

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 2px', fontSize:'20px', fontWeight:'normal' }}>📅 Calendar</h2>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Drag appointments between days to reschedule</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          {[['all','All'],['investor','👤 Investors'],['lead','🎯 Leads']].map(([id,label]) => (
            <button key={id} onClick={() => setFilter(id)}
              style={{ background: filter===id ? 'rgba(184,147,58,0.15)' : 'transparent', border: filter===id ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)', color: filter===id ? GOLD : '#6b7280', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>
              {label}
            </button>
          ))}
          <div style={{ color:GOLD, fontWeight:'bold', fontSize:'14px', marginLeft:'8px' }}>{totalUpcoming} upcoming</div>
          <button onClick={() => setWeekOffset(0)} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>Today</button>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'13px' }}>‹</button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'13px' }}>›</button>
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
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                onDrop={e => handleDrop(day, e)}
                style={{ background: isDropTarget ? 'rgba(184,147,58,0.1)' : isT ? 'rgba(184,147,58,0.06)' : 'rgba(255,255,255,0.02)', border: isDropTarget ? `2px dashed ${GOLD}` : isT ? `1px solid rgba(184,147,58,0.35)` : '1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'8px', minHeight:'120px', opacity: isPast ? 0.6 : 1, transition:'background 0.15s, border 0.15s' }}>
                <div style={{ marginBottom:'8px', textAlign:'center' }}>
                  <div style={{ color: isT ? GOLD : '#6b7280', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase' }}>{day.toLocaleDateString('en-US', { weekday:'short' })}</div>
                  <div style={{ color: isT ? GOLD : isPast ? '#4a5568' : '#e8e0d0', fontSize:'18px', fontWeight: isT ? 'bold' : 'normal', lineHeight:1.2 }}>{day.getDate()}</div>
                  {isT && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:GOLD, margin:'2px auto 0' }} />}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {dayEvents.map(evt => (
                    <div key={`${evt.type}-${evt.id}`}
                      draggable={evt.type === 'investor'}
                      onDragStart={(e) => { e.stopPropagation(); setDragging(evt); }}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      onClick={() => {
                        if (evt.type === 'investor') { const u = users.find(u => u.id === evt.id); if (u) setContactCard(u); }
                        else if (evt.type === 'lead') { base44.entities.Lead.filter({ id: evt.id }).then(leads => { if (leads?.[0]) setView('leads'); }).catch(() => {}); }
                      }}
                      style={{ background: `${evt.color}18`, border: `1px solid ${evt.color}44`, borderLeft: `3px solid ${evt.color}`, borderRadius:'3px', padding:'5px 7px', cursor: 'pointer', userSelect:'none', opacity: dragging?.id === evt.id ? 0.4 : 1, transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = `${evt.color}30`}
                      onMouseLeave={e => e.currentTarget.style.background = `${evt.color}18`}>
                      <div style={{ color:'#e8e0d0', fontSize:'10px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.name}</div>
                      <div style={{ color: evt.color, fontSize:'9px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{evt.title}</div>
                      <div style={{ color:'#6b7280', fontSize:'9px', marginTop:'1px' }}>{evt.dateTime.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}</div>
                      {evt.phone && <div style={{ color:'#4ade80', fontSize:'9px', fontFamily:'monospace' }}>{evt.phone}</div>}
                      {evt.type === 'investor' && <div style={{ color: statusColors[evt.status] || GOLD, fontSize:'8px', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>● {evt.status}</div>}
                    </div>
                  ))}
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
                <div key={`past-${evt.type}-${evt.id}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'4px', borderLeft:`3px solid ${evt.color}` }}>
                  <div><span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold', marginRight:'8px' }}>{evt.name}</span><span style={{ color: evt.color, fontSize:'10px' }}>{evt.title}</span></div>
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