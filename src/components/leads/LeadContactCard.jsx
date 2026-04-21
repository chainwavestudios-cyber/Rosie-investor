import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import MigrateLeadModal from './MigrateLeadModal';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

const STATUS_LABELS = {
  lead: { label: '🔵 Lead', color: '#60a5fa' },
  interested: { label: '⭐ Interested', color: '#f59e0b' },
  not_available: { label: '📵 Not Available', color: '#8a9ab8' },
  callback_later: { label: '📅 Call Back Later', color: '#a78bfa' },
  not_interested: { label: '❌ Not Interested', color: '#ef4444' },
  prospect: { label: '🚀 Prospect (Ready to Migrate)', color: '#a78bfa' },
  investor: { label: '✅ Investor', color: '#4ade80' },
};

const HISTORY_ICONS = {
  call: '📞', not_available: '📵', interested: '⭐', callback_later: '📅',
  not_interested: '❌', status_change: '🔄', note: '📝',
};

export default function LeadContactCard({ lead, onClose, onUpdate, onDialNumber }) {
  const [tab, setTab] = useState('overview');
  const [history, setHistory] = useState([]);
  const [editLead, setEditLead] = useState({ ...lead });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMigrate, setShowMigrate] = useState(false);

  useEffect(() => { loadHistory(); }, [lead.id]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const h = await base44.entities.LeadHistory.filter({ leadId: lead.id }, '-created_date');
      setHistory(h);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const logHistory = async (type, content, extra = {}) => {
    await base44.entities.LeadHistory.create({ leadId: lead.id, type, content, ...extra });
    await loadHistory();
  };

  const updateStatus = async (newStatus, histType, histContent, extra = {}) => {
    await base44.entities.Lead.update(lead.id, { status: newStatus, ...extra });
    await logHistory(histType || 'status_change', histContent || `Status changed to ${newStatus}`);
    onUpdate && onUpdate();
    setEditLead(prev => ({ ...prev, status: newStatus, ...extra }));
  };

  const handleNotInterested = async () => {
    if (!window.confirm('Remove this lead permanently?')) return;
    await updateStatus('not_interested', 'not_interested', 'Marked as not interested — removed from list.');
    onClose();
    onUpdate && onUpdate();
  };

  const handleNotAvailable = async () => {
    await updateStatus('not_available', 'not_available', `Called — not available at ${new Date().toLocaleString()}`);
  };

  const handleInterested = async () => {
    await updateStatus('interested', 'interested', 'Lead marked as interested!');
  };

  const handleCallbackLater = async () => {
    const at = callbackDate ? ` — scheduled for ${new Date(callbackDate).toLocaleString()}` : '';
    await updateStatus('callback_later', 'callback_later', `Call back later${at}`, callbackDate ? { callbackAt: callbackDate } : {});
    setCallbackDate('');
  };

  const saveProfile = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.Lead.update(lead.id, {
        firstName: editLead.firstName, lastName: editLead.lastName,
        email: editLead.email, phone: editLead.phone, state: editLead.state,
        notes: editLead.notes, status: editLead.status,
      });
      setSaveMsg('Saved ✓');
      onUpdate && onUpdate();
      setTimeout(() => setSaveMsg(''), 2500);
    } catch(e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
  };

  const addNote = async () => {
    if (!noteContent.trim()) return;
    await logHistory('note', noteContent);
    setNoteContent('');
  };

  const statusInfo = STATUS_LABELS[editLead.status] || STATUS_LABELS.lead;
  const fullName = `${lead.firstName} ${lead.lastName}`;
  const isProspect = editLead.status === 'prospect';

  const TABS = [['overview', '👤 Overview'], ['actions', '⚡ Actions'], ['notes', '📝 Notes'], ['history', '📋 History']];

  return (
    <>
    {showMigrate && (
      <MigrateLeadModal
        lead={lead}
        history={history}
        onClose={() => setShowMigrate(false)}
        onMigrated={(newUser) => {
          setShowMigrate(false);
          onUpdate && onUpdate();
          onClose();
        }}
      />
    )}
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'780px', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 120px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding:'20px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.2)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}44,${GOLD}22)`, border:`2px solid ${GOLD}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>
              {fullName[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ color:'#e8e0d0', fontSize:'18px', fontFamily:'Georgia,serif' }}>{fullName}</div>
              <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'2px' }}>{lead.email} · {lead.state}</div>
            </div>
            <span style={{ background:`${statusInfo.color}22`, color:statusInfo.color, border:`1px solid ${statusInfo.color}55`, padding:'3px 12px', borderRadius:'2px', fontSize:'11px', letterSpacing:'1px' }}>{statusInfo.label}</span>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {isProspect && (
              <button onClick={() => setShowMigrate(true)}
                style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', border:'none', borderRadius:'2px', padding:'8px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', letterSpacing:'1px' }}>
                🚀 Migrate to CRM
              </button>
            )}
            {lead.phone && (
              <button onClick={() => onDialNumber && onDialNumber(lead)} style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'2px', padding:'8px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                📞 {lead.phone}
              </button>
            )}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#6b7280', cursor:'pointer', fontSize:'20px', width:'36px', height:'36px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:'none', border:'none', borderBottom:tab===id?`2px solid ${GOLD}`:'2px solid transparent', color:tab===id?GOLD:'#6b7280', padding:'12px 20px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
              <div>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Contact Details</div>
                {[['firstName','First Name'],['lastName','Last Name'],['email','Email'],['phone','Phone'],['state','State']].map(([k,label]) => (
                  <div key={k} style={{ marginBottom:'14px' }}>
                    <label style={ls}>{label}</label>
                    <input value={editLead[k]||''} onChange={e=>setEditLead({...editLead,[k]:e.target.value})} style={inp} />
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Status</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'20px' }}>
                  {['lead','interested','prospect','investor'].map(s => {
                    const si = STATUS_LABELS[s];
                    return (
                      <button key={s} onClick={() => updateStatus(s, 'status_change', `Manually changed to ${s}`)}
                        style={{ padding:'9px 14px', textAlign:'left', border:`1px solid ${editLead.status===s?si.color:'rgba(255,255,255,0.1)'}`, borderRadius:'2px', background:editLead.status===s?`${si.color}22`:'transparent', color:editLead.status===s?si.color:'#6b7280', cursor:'pointer', fontSize:'12px' }}>
                        {si.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginBottom:'14px' }}>
                  <label style={ls}>Notes</label>
                  <textarea value={editLead.notes||''} onChange={e=>setEditLead({...editLead,notes:e.target.value})} rows={4} style={{ ...inp, resize:'vertical' }} placeholder="Internal notes…" />
                </div>
              </div>
              <div style={{ gridColumn:'1/-1', display:'flex', gap:'12px', alignItems:'center', paddingTop:'16px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                <button onClick={saveProfile} disabled={saving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'11px 32px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving?'Saving…':'Save Changes'}</button>
                {saveMsg && <span style={{ color:saveMsg.startsWith('Error')?'#ef4444':'#4ade80', fontSize:'13px' }}>{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* ACTIONS */}
          {tab === 'actions' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Lead Actions</div>

              <button onClick={handleInterested} style={{ display:'flex', alignItems:'center', gap:'14px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'18px 20px', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:'28px' }}>⭐</span>
                <div><div style={{ color:'#f59e0b', fontWeight:'bold', fontSize:'14px', marginBottom:'3px' }}>Interested</div><div style={{ color:'#6b7280', fontSize:'12px' }}>Mark this lead as interested in investing.</div></div>
              </button>

              <div style={{ background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'2px', padding:'18px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'14px' }}>
                  <span style={{ fontSize:'28px' }}>📅</span>
                  <div><div style={{ color:'#a78bfa', fontWeight:'bold', fontSize:'14px', marginBottom:'3px' }}>Call Back Later</div><div style={{ color:'#6b7280', fontSize:'12px' }}>Log a callback time and move to callback list.</div></div>
                </div>
                <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  <input type="datetime-local" value={callbackDate} onChange={e=>setCallbackDate(e.target.value)} style={{ ...inp, flex:1 }} />
                  <button onClick={handleCallbackLater} style={{ background:'rgba(167,139,250,0.2)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.4)', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px', whiteSpace:'nowrap' }}>Set Callback</button>
                </div>
              </div>

              <button onClick={handleNotAvailable} style={{ display:'flex', alignItems:'center', gap:'14px', background:'rgba(138,154,184,0.08)', border:'1px solid rgba(138,154,184,0.2)', borderRadius:'2px', padding:'18px 20px', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:'28px' }}>📵</span>
                <div><div style={{ color:'#8a9ab8', fontWeight:'bold', fontSize:'14px', marginBottom:'3px' }}>Not Available</div><div style={{ color:'#6b7280', fontSize:'12px' }}>Log a failed contact attempt with timestamp.</div></div>
              </button>

              <button onClick={handleNotInterested} style={{ display:'flex', alignItems:'center', gap:'14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'2px', padding:'18px 20px', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:'28px' }}>❌</span>
                <div><div style={{ color:'#ef4444', fontWeight:'bold', fontSize:'14px', marginBottom:'3px' }}>Not Interested</div><div style={{ color:'#6b7280', fontSize:'12px' }}>Permanently remove this lead from the list.</div></div>
              </button>

            </div>
          )}

          {/* NOTES */}
          {tab === 'notes' && (
            <div>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Notes</div>
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'16px', marginBottom:'20px' }}>
                <textarea value={noteContent} onChange={e=>setNoteContent(e.target.value)} rows={3} placeholder="Write a note…" style={{ ...inp, resize:'vertical', marginBottom:'10px' }} />
                <button onClick={addNote} disabled={!noteContent.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 24px', cursor:'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>Save Note</button>
              </div>
              {loading && <p style={{ color:'#6b7280', textAlign:'center' }}>Loading…</p>}
              {!loading && history.filter(h=>h.type==='note').length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'24px' }}>No notes yet.</p>}
              {history.filter(h=>h.type==='note').map(h => (
                <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'12px 16px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', marginBottom:'8px', gap:'16px' }}>
                  <p style={{ color:'#c4cdd8', fontSize:'13px', margin:0, lineHeight:1.6, whiteSpace:'pre-wrap', flex:1 }}>{h.content}</p>
                  <span style={{ color:'#4a5568', fontSize:'11px', whiteSpace:'nowrap', flexShrink:0 }}>{h.created_date ? new Date(h.created_date).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Contact History</div>
              {loading && <p style={{ color:'#6b7280', textAlign:'center' }}>Loading…</p>}
              {!loading && history.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No history yet. Use the Actions tab to log interactions.</p>}
              {history.map(h => (
                <div key={h.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'12px' }}>
                  <span style={{ fontSize:'14px', flexShrink:0 }}>{HISTORY_ICONS[h.type] || '📝'}</span>
                  <span style={{ color:GOLD, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap', flexShrink:0, minWidth:'80px' }}>{h.type.replace('_',' ')}</span>
                  <span style={{ color:'#c4cdd8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.content}</span>
                  {h.callDurationSeconds > 0 && <span style={{ color:'#8a9ab8', whiteSpace:'nowrap', flexShrink:0 }}>{Math.floor(h.callDurationSeconds/60)}m {h.callDurationSeconds%60}s</span>}
                  <span style={{ color:'#4a5568', whiteSpace:'nowrap', flexShrink:0 }}>{h.created_date ? new Date(h.created_date).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}