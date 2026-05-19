import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fmtDateTime, fmtDateTimeShort, fmtDateTimeLong, fmtDateTimeWithYear, fmtDate } from '@/lib/fmtDate.js';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import { fireScorecardCall, fireScorecardNBTechConvert } from '@/components/admin/ScoreCard';
import { useInlineDialer } from '@/hooks/useInlineDialer';
import InlineCallBar from '@/components/shared/InlineCallBar';
import MigrateLeadModal from './MigrateLeadModal';
import DateTimePicker from '@/components/admin/DateTimePicker';
import LeadEmailTab from './LeadEmailTab';
import CustomEmailTab from '@/components/shared/CustomEmailTab';
import ScriptAssistant from './ScriptAssistant';
import ResearchTab from './ResearchTab';
import InvestorWebsiteTab from './InvestorWebsiteTab';
import WebsiteHistoryTab from './WebsiteHistoryTab';
import ZoomBookingModal from '@/components/ZoomBookingModal';
import SetReminderButton from '@/components/SetReminderButton';
import ReminderCountdown from '@/components/ReminderCountdown';
import { useReminders } from '@/hooks/useReminders';
import RemindersFloatingPanel from '@/components/shared/RemindersFloatingPanel';
import CallLogPanel from '@/components/admin/CallLogPanel';
import SmsTab from '@/components/shared/SmsTab';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' };

const STATUS_LABELS = {
  lead:               { label: '🔵 Lead',              color: '#60a5fa' },
  intro_email_sent:   { label: '📧 Intro Email Sent',   color: '#f59e0b' },
  opened_intro_email: { label: '📬 Opened Intro Email', color: '#4ade80' },
  prospect:           { label: '⭐ Prospect',           color: '#a78bfa' },
};

const HISTORY_ICONS = {
  call: '📞', not_available: '📵', callback_later: '📅',
  not_interested: '❌', status_change: '🔄', note: '📝', prospect: '🚀',
};

function historyColor(type) {
  const map = { call:'#60a5fa', not_available:'#8a9ab8', callback_later:'#a78bfa', not_interested:'#ef4444', status_change:GOLD, note:'#c4cdd8', prospect:'#a78bfa' };
  return map[type] || '#6b7280';
}

function SiteAccessTab({ lead, onUpdate, onSave, createdBy = 'admin' }) {
  const GOLD = '#b8933a';
  const [copied, setCopied] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const siteUsername   = lead?.portalPasscode || '';
  const generatedUrl   = siteUsername ? `https://investors.rosieai.tech/?code=${encodeURIComponent(siteUsername)}` : '';
  const consumerRefUrl = siteUsername ? `https://www.rosieai.tech?ref=${siteUsername}` : '';

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const saveUsername = async () => {
    if (!newUsername.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      await onSave({ portalPasscode: newUsername.trim().toLowerCase() });
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'note',
        content: `🔗 Site access username updated. Username: ${newUsername.trim().toLowerCase()}`,
        createdBy: createdBy,
      });
      setSaveMsg('✓ Saved');
      setEditingUsername(false);
      setNewUsername('');
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const inp = { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'monospace', boxSizing:'border-box' };
  const editInp = { ...inp, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(184,147,58,0.3)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {!siteUsername ? (
        <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'6px', padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:'28px', marginBottom:'8px' }}>🔗</div>
          <div style={{ color:'#f59e0b', fontSize:'13px', marginBottom:'6px' }}>No site access yet</div>
          <div style={{ color:'#6b7280', fontSize:'11px', lineHeight:1.6 }}>
            Click <strong style={{ color:'#60a5fa' }}>Investor Site Access</strong> in the header to generate the site username and URLs, then send the email.
          </div>
        </div>
      ) : (
        <>
          {/* ── SITE USERNAME ── */}
          <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>🔑 Site Username</div>
              <button onClick={() => { setEditingUsername(e => !e); setNewUsername(siteUsername); }}
                style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>
                {editingUsername ? 'Cancel' : '✏️ Edit'}
              </button>
            </div>
            {!editingUsername ? (
              <div style={{ display:'flex', gap:'6px' }}>
                <input readOnly value={siteUsername} style={inp} />
                <button onClick={() => copy(siteUsername, 'username')} style={{ background:'rgba(255,255,255,0.06)', color: copied==='username' ? '#4ade80' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                  {copied==='username' ? '✓' : 'Copy'}
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:'8px' }}>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} style={editInp} />
                <button onClick={saveUsername} disabled={saving}
                  style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:'#0a0f1e', border:'none', borderRadius:'4px', padding:'8px 18px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {saveMsg && <span style={{ fontSize:'11px', color: saveMsg.startsWith('✓') ? '#4ade80' : '#ef4444' }}>{saveMsg}</span>}
              </div>
            )}
          </div>

          {/* ── GENERATED URL ── */}
          <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'6px', padding:'14px 16px' }}>
            <div style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>🔗 Generated Site URL</div>
            <div style={{ display:'flex', gap:'6px' }}>
              <input readOnly value={generatedUrl} style={{ ...inp, fontSize:'10px' }} />
              <button onClick={() => copy(generatedUrl, 'genUrl')} style={{ background:'rgba(96,165,250,0.1)', color: copied==='genUrl' ? '#4ade80' : '#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                {copied==='genUrl' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>

          {/* ── CONSUMER REF URL ── */}
          <div style={{ background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'6px', padding:'14px 16px' }}>
            <div style={{ color:'#a78bfa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>🌐 Consumer Ref URL</div>
            <div style={{ display:'flex', gap:'6px' }}>
              <input readOnly value={consumerRefUrl} style={{ ...inp, fontSize:'10px' }} />
              <button onClick={() => copy(consumerRefUrl, 'refUrl')} style={{ background:'rgba(167,139,250,0.1)', color: copied==='refUrl' ? '#4ade80' : '#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                {copied==='refUrl' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function OverviewTab({ editLead, setEditLead, saving, saveMsg, saveProfile, updateStatus, quickNote, setQuickNote, addQuickNote, addingNote, history, loading, isArchived, onQuickNotInterested, onQuickCallbackLater, onMigrate, onNoteAdded, createdBy = 'admin' }) {
  const [editing, setEditing] = useState(false);
  const GOLD = '#b8933a';
  const DARK = '#0a0f1e';
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
  const ls = { display:'block', color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'5px' };

  const STATUS_LABELS = {
    lead:               { label: '🔵 Lead',              color: '#60a5fa' },
    intro_email_sent:   { label: '📧 Intro Email Sent',   color: '#f59e0b' },
    opened_intro_email: { label: '📬 Opened Intro Email', color: '#4ade80' },
    prospect:           { label: '⭐ Prospect',           color: '#a78bfa' },
  };
  const HISTORY_ICONS = { call:'📞', not_available:'📵', callback_later:'📅', not_interested:'❌', status_change:'🔄', note:'📝', prospect:'⭐', connected:'🟢', abandoned:'⛔', voicemail:'📳', interested:'🌟' };
  const historyColor = (type) => ({ call:'#60a5fa', not_available:'#8a9ab8', callback_later:'#a78bfa', not_interested:'#ef4444', status_change:GOLD, note:'#c4cdd8', prospect:'#a78bfa', connected:'#4ade80' })[type] || '#6b7280';

  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [bottomTab, setBottomTab] = useState('notes'); // 'notes' | 'calls'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

      {/* Contact info — with Edit button */}
      {!editing && (
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'12px 14px', display:'flex', flexDirection:'column', gap:'7px' }}>
          {/* Name + badges + Edit */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', flex:1 }}>
              <span style={{ color:'#e8e0d0', fontSize:'15px', fontWeight:'bold' }}>{editLead.firstName} {editLead.lastName}</span>
              {(editLead.engagementScore > 0) && (
                <span style={{ background:`rgba(184,147,58,0.15)`, border:`1px solid rgba(184,147,58,0.4)`, borderRadius:'20px', padding:'2px 10px', color:'#b8933a', fontSize:'11px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'4px' }}>
                  ⭐ {editLead.engagementScore} pts
                </span>
              )}
              {editLead.badgeIntroEmailOpened && (<span style={{ background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'10px', padding:'2px 8px', color:'#60a5fa', fontSize:'10px', whiteSpace:'nowrap' }}>🌟 Intro Opened ✅</span>)}
              {editLead.badgeConsumerWebsite && (<span style={{ background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'10px', padding:'2px 8px', color:'#60a5fa', fontSize:'10px', whiteSpace:'nowrap' }}>🛒 Consumer ✅</span>)}
              {editLead.badgeInvestorPage && (<span style={{ background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'10px', padding:'2px 8px', color:'#60a5fa', fontSize:'10px', whiteSpace:'nowrap' }}>📈 Investor Page ✅</span>)}
            </div>
            {!isArchived && (
              <button onClick={() => setEditing(e => !e)}
                style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px', flexShrink:0 }}>
                ✏️ Edit
              </button>
            )}
          </div>
          {/* Phone row + last called */}
          <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', alignItems:'center' }}>
            {editLead.phone && <span style={{ color:'#4ade80', fontSize:'13px' }}>📞 {editLead.phone}</span>}
            {editLead.phone2 && <span style={{ color:'#8a9ab8', fontSize:'13px' }}>📱 {editLead.phone2}</span>}
            {/* Last called info */}
            {editLead.lastCalledAt ? (
            <span style={{ color:'#6b7280', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap' }}>
            <span style={{ color:'#4a5568' }}>🕐 Last called:</span>
            <span style={{ color:'#8a9ab8' }}>
              {fmtDateTime(editLead.lastCalledAt)}
            </span>
                {(() => {
                  // Find most recent call entry in history for duration
                  const lastCall = history.filter(h => ['call','connected'].includes(h.type) && h.callDurationSeconds > 0).sort((a,b) => new Date(b.created_date) - new Date(a.created_date))[0];
                  if (!lastCall) return null;
                  const m = Math.floor(lastCall.callDurationSeconds / 60);
                  const s = lastCall.callDurationSeconds % 60;
                  return <span style={{ color:'#a78bfa' }}>· {m}m {s}s</span>;
                })()}
              </span>
            ) : (editLead.phone || editLead.phone2) ? (
              <span style={{ color:'#4a5568', fontSize:'11px' }}>🕐 Never called</span>
            ) : null}
          </div>
          {/* Email row */}
          {editLead.email && <div><span style={{ color:'#60a5fa', fontSize:'13px' }}>✉️ {editLead.email}</span></div>}
          {/* Address row */}
          {(editLead.address || editLead.city || editLead.zip || editLead.state) && (
            <div style={{ color:'#8a9ab8', fontSize:'12px' }}>
              🏠 {[editLead.address, editLead.city, editLead.zip, editLead.state].filter(Boolean).join(', ')}
            </div>
          )}
          {/* Extra info */}
          {editLead.investment && <div style={{ color:'#4ade80', fontSize:'12px' }}>💰 Investment: {editLead.investment}</div>}
          {editLead.bestTimeToCall && <div style={{ color:'#6b7280', fontSize:'12px' }}>⏰ Best time: {editLead.bestTimeToCall}</div>}
          {editLead.callbackAt && (
            <div style={{ color:'#a78bfa', fontSize:'12px' }}>
              📅 Callback: {fmtDateTimeLong(editLead.callbackAt)}
            </div>
          )}
          {/* Custom fields */}
          {(() => {
            try {
              const cf = JSON.parse(editLead.customFields || '{}');
              const entries = Object.entries(cf).filter(([,v]) => v);
              if (!entries.length) return null;
              return (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'4px' }}>
                  {entries.map(([k,v]) => (
                    <span key={k} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'3px 9px', fontSize:'11px', color:'#8a9ab8' }}>
                      <span style={{ color:'#4a5568' }}>{k}:</span> <span style={{ color:'#c4cdd8' }}>{v}</span>
                    </span>
                  ))}
                </div>
              );
            } catch { return null; }
          })()}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 14px' }}>
            {[['firstName','First Name','👤'],['lastName','Last Name','👤'],['phone','Phone','📞'],['phone2','Alt Phone','📱'],['email','Email','✉️'],['state','State','📍'],['city','City','🏙'],['zip','Zip','📮']].map(([k,label,icon]) => (
              <div key={k}>
                <label style={ls}>{icon} {label}</label>
                <input value={editLead[k]||''} onChange={e=>setEditLead({...editLead,[k]:e.target.value})} style={inp} placeholder={label} />
              </div>
            ))}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={ls}>🏠 Address</label>
              <input value={editLead.address||''} onChange={e=>setEditLead({...editLead,address:e.target.value})} style={{...inp, gridColumn:'1/-1'}} placeholder="Street address…" />
            </div>
            <div>
              <label style={ls}>⏰ Best Time to Call</label>
              <input value={editLead.bestTimeToCall||''} onChange={e=>setEditLead({...editLead,bestTimeToCall:e.target.value})} style={inp} placeholder="e.g. mornings, after 3pm…" />
            </div>
            <div>
              <label style={ls}>💰 Investment Amount</label>
              <input value={editLead.investment||''} onChange={e=>setEditLead({...editLead,investment:e.target.value})} style={inp} placeholder="e.g. $50,000 cash" />
            </div>
          </div>

          {/* Custom fields editor */}
          {(() => {
            let cf = {};
            try { cf = JSON.parse(editLead.customFields || '{}'); } catch {}
            const entries = Object.entries(cf);
            if (!entries.length) return null;
            return (
              <div style={{ marginTop:'12px' }}>
                <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>📋 Custom Fields</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px 14px' }}>
                  {entries.map(([k, v]) => (
                    <div key={k}>
                      <label style={ls}>{k}</label>
                      <input value={v||''} onChange={e => {
                        const updated = {...cf, [k]: e.target.value};
                        setEditLead(prev => ({...prev, customFields: JSON.stringify(updated)}));
                      }} style={inp} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <div style={{ display:'flex', gap:'10px', alignItems:'center', marginTop:'14px' }}>
            <button onClick={async () => { await saveProfile(); setEditing(false); }} disabled={saving}
              style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'9px 24px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'1.5px', textTransform:'uppercase' }}>
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'9px 16px', cursor:'pointer', fontSize:'12px' }}>
              Cancel
            </button>
            {saveMsg && <span style={{ color:saveMsg.startsWith('Error')?'#ef4444':'#4ade80', fontSize:'12px' }}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* Notes & Activity — tabbed */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'14px' }}>
        {/* Sub-tab headers */}
        <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'12px' }}>
          {[['notes','📋 My Notes & Activity'],['calls','📞 Call History']].map(([id,label]) => (
            <button key={id} onClick={() => setBottomTab(id)}
              style={{ background:'none', border:'none', borderBottom:bottomTab===id?`2px solid ${GOLD}`:'2px solid transparent', color:bottomTab===id?GOLD:'#6b7280', padding:'6px 14px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
              {label}
            </button>
          ))}
        </div>

        {/* MY NOTES & ACTIVITY — excludes raw call logs */}
        {bottomTab === 'notes' && <>
          {!isArchived && <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
            <input value={quickNote} onChange={e=>setQuickNote(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&quickNote.trim()) addQuickNote(); }}
              placeholder="Add a note and press Enter or Save…"
              style={{ ...inp, flex:1 }} />
            <button onClick={addQuickNote} disabled={!quickNote.trim()||addingNote}
              style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', padding:'8px 16px', cursor:'pointer', fontSize:'12px', whiteSpace:'nowrap' }}>
              Save
            </button>
          </div>}
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'260px', overflowY:'auto', paddingRight:'4px' }}>
            {loading && <p style={{ color:'#6b7280', fontSize:'12px', textAlign:'center', padding:'16px' }}>Loading…</p>}
            {!loading && history.filter(h => ['note','status_change','callback_later','prospect','interested','call','connected','not_available','not_interested','abandoned','voicemail'].includes(h.type)).length === 0 && (
              <p style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'20px' }}>No notes or activity yet.</p>
            )}
            {history.filter(h => ['note','status_change','callback_later','prospect','interested','call','connected','not_available','not_interested','abandoned','voicemail'].includes(h.type)).map(h => {
              const icon = HISTORY_ICONS[h.type] || '📝';
              const color = historyColor(h.type);
              return (
                <div key={h.id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:'4px' }}>
                  <span style={{ fontSize:'13px', flexShrink:0, marginTop:'1px' }}>{icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <span style={{ color, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{h.type.replace(/_/g,' ')}</span>
                        {h.createdBy && <span style={{ color:'#6b7280', fontSize:'10px' }}>· {h.createdBy}</span>}
                      </div>
                      <span style={{ color:'#4a5568', fontSize:'10px', whiteSpace:'nowrap' }}>
                        {fmtDateTimeShort(h.created_date)}
                      </span>
                    </div>
                    {h.content && <div style={{ color:'#c4cdd8', fontSize:'12px', marginTop:'2px', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{h.content}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* CALL HISTORY — calls, connected, not_available */}
        {bottomTab === 'calls' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'260px', overflowY:'auto', paddingRight:'4px' }}>
            {loading && <p style={{ color:'#6b7280', fontSize:'12px', textAlign:'center', padding:'16px' }}>Loading…</p>}
            {!loading && history.filter(h => ['call','connected','not_available','not_interested','abandoned'].includes(h.type)).length === 0 && (
              <p style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'20px' }}>No call history yet.</p>
            )}
            {history.filter(h => ['call','connected','not_available','not_interested','abandoned'].includes(h.type)).map(h => {
              const icon = HISTORY_ICONS[h.type] || '📞';
              const color = historyColor(h.type);
              return (
                <div key={h.id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:'4px' }}>
                  <span style={{ fontSize:'13px', flexShrink:0, marginTop:'1px' }}>{icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                      <span style={{ color, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{h.type.replace(/_/g,' ')}</span>
                      <span style={{ color:'#4a5568', fontSize:'10px', whiteSpace:'nowrap' }}>
                        {fmtDateTimeShort(h.created_date)}
                      </span>
                    </div>
                    {h.content && <div style={{ color:'#c4cdd8', fontSize:'12px', marginTop:'2px', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{h.content}</div>}
                    {h.createdBy && <div style={{ color:'#4a5568', fontSize:'9px', marginTop:'2px' }}>by {h.createdBy}</div>}
                    {h.callDurationSeconds > 0 && <div style={{ color:'#8a9ab8', fontSize:'11px', marginTop:'2px' }}>⏱ {Math.floor(h.callDurationSeconds/60)}m {h.callDurationSeconds%60}s</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



// ── Client Info Tab ───────────────────────────────────────────────────────────
function ClientInfoTab({ lead, onUpdate }) {
  const GOLD = '#b8933a';
  const profile = (() => { try { return JSON.parse(lead?.clientProfile || '{}'); } catch { return {}; } })();
  const hasProfile = Object.keys(profile).length > 0;

  const animalColor = profile.animalType === 'duck' ? '#f59e0b' : profile.animalType === 'cow' ? '#4ade80' : '#6b7280';
  const intentColor = { hot:'#4ade80', warm:'#f59e0b', cold:'#8a9ab8' }[profile.overallIntentLabel] || '#6b7280';

  const TraitRow = ({ label, value, trueColor = '#4ade80', falseColor = '#4a5568' }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color:'#8a9ab8', fontSize:'12px' }}>{label}</span>
      <span style={{ fontSize:'12px', fontWeight:'bold', color: value ? trueColor : falseColor }}>
        {value ? '✓ Yes' : '—'}
      </span>
    </div>
  );

  if (!hasProfile) return (
    <div style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔍</div>
      <h3 style={{ color:'#4a5568', fontWeight:'normal', marginBottom:'10px' }}>No profile yet</h3>
      <p style={{ color:'#374151', fontSize:'13px', maxWidth:'360px', margin:'0 auto', lineHeight:1.7 }}>
        The client profile builds automatically after each call. Make a call with the AI Assistant active to generate the first profile.
      </p>
    </div>
  );

  return (
    <div>
      {/* Animal + Intent header */}
      <div style={{ display:'flex', gap:'16px', marginBottom:'20px' }}>
        {/* Animal card */}
        <div style={{ flex:1, background:'rgba(0,0,0,0.2)', border:`1px solid ${animalColor}33`, borderRadius:'4px', padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:'52px', marginBottom:'8px' }}>
            {profile.animalType === 'duck' ? '🦆' : profile.animalType === 'cow' ? '🐄' : '❓'}
          </div>
          <div style={{ color:animalColor, fontSize:'16px', fontWeight:'bold', marginBottom:'4px' }}>
            {profile.animalType === 'duck' ? 'Duck' : profile.animalType === 'cow' ? 'Cow' : 'Unknown'}
          </div>
          <div style={{ color:'#6b7280', fontSize:'11px' }}>
            {profile.animalType === 'duck' ? 'Skeptic — argues, challenges, pushes back' : profile.animalType === 'cow' ? 'Believer — curious, agreeable, open-minded' : 'Not enough data yet'}
          </div>
          {profile.animalConfidence > 0 && (
            <div style={{ marginTop:'8px', color:'#4a5568', fontSize:'10px' }}>{profile.animalConfidence}% confidence</div>
          )}
        </div>

        {/* Intent card */}
        <div style={{ flex:1, background:'rgba(0,0,0,0.2)', border:`1px solid ${intentColor}33`, borderRadius:'4px', padding:'20px' }}>
          <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Overall Intent</div>
          <div style={{ color:intentColor, fontSize:'22px', fontWeight:'bold', marginBottom:'8px', textTransform:'capitalize' }}>
            {profile.overallIntentLabel || '—'}
          </div>
          <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px', marginTop:'16px' }}>Calls Analyzed</div>
          <div style={{ color:GOLD, fontSize:'20px', fontWeight:'bold' }}>{profile.callCount || 1}</div>
        </div>
      </div>

      {/* Behavioral traits */}
      <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'16px', marginBottom:'16px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Behavioral Traits</div>
        <TraitRow label="Asks a lot of questions"     value={profile.traits?.asksLotOfQuestions} />
        <TraitRow label="Quick to interrupt"          value={profile.traits?.quickToInterrupt}   trueColor='#f59e0b' />
        <TraitRow label="Asks buying questions"       value={profile.traits?.asksBuyingQuestions} />
        <TraitRow label="Talks a lot"                 value={profile.traits?.talksALot} />
        <TraitRow label="Asks technical questions"    value={profile.traits?.asksTechnicalQuestions} />
        <TraitRow label="Raises objections"           value={profile.traits?.raisesObjections}  trueColor='#ef4444' />
        <TraitRow label="Generally agreeable"         value={profile.traits?.agreeable} />
        <TraitRow label="Price conscious"             value={profile.traits?.priceConscious}    trueColor='#f59e0b' />
        <TraitRow label="Decision maker"              value={profile.traits?.decisionMaker} />
      </div>

      {/* Key observations */}
      {profile.keyObservations?.length > 0 && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Key Observations</div>
          {profile.keyObservations.map((obs, i) => (
            <div key={i} style={{ display:'flex', gap:'8px', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color:GOLD, fontSize:'12px', flexShrink:0 }}>›</span>
              <span style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.5 }}>{obs}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommended approach */}
      {profile.recommendedApproach && (
        <div style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'4px', padding:'14px 16px', marginBottom:'16px' }}>
          <div style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Recommended Approach — Next Call</div>
          <p style={{ color:'#c4cdd8', fontSize:'13px', margin:0, lineHeight:1.6 }}>{profile.recommendedApproach}</p>
        </div>
      )}

      {/* Last call summary */}
      {profile.lastCallSummary && (
        <div style={{ background:'rgba(184,147,58,0.05)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'4px', padding:'14px 16px' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Last Call Summary</div>
          <p style={{ color:'#8a9ab8', fontSize:'12px', margin:0, lineHeight:1.6 }}>{profile.lastCallSummary}</p>
        </div>
      )}
    </div>
  );
}

// ── Lead History Tab ─────────────────────────────────────────────────────────
function LeadHistoryTab({ lead, history, onNoteAdded, createdBy = 'admin' }) {
  const [sub, setSub]         = useState('clientinfo');
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [emails, setEmails]   = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const GOLD = '#b8933a';

  const fmtDT = (iso) => fmtDateTime(iso);
  const fmtDur = (s) => !s ? '' : s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

  useEffect(() => {
    if (sub === 'emails' && emails.length === 0) loadEmails();
  }, [sub]);

  const loadEmails = async () => {
    setLoadingEmails(true);
    try {
      const logs = await base44.entities.EmailLog.filter({ leadId: lead.id });
      setEmails(logs.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt)));
    } catch {}
    setLoadingEmails(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await base44.entities.LeadHistory.create({ leadId: lead.id, type: 'note', content: note.trim(), createdBy: createdBy });
      setNote('');
      onNoteAdded && onNoteAdded();
    } catch {}
    setSaving(false);
  };

  // Filter history by sub-tab
  const notes       = history.filter(h => ['note','status_change','call','connected','not_available','callback_later','not_interested','abandoned','interested'].includes(h.type));
  const transcripts = history.filter(h => h.type === 'transcript');
  const reports     = history.filter(h => h.type === 'call_report');

  // Site access summary from lead fields
  const siteAccessSummary = lead.lastSiteVisit ? [
    { label: 'Last Visit', value: fmtDT(lead.lastSiteVisit) },
    { label: 'Portal User', value: lead.portalPasscode || '—' },
    { label: 'Email Opened', value: lead.badgeEmailOpened ? '✓ Yes' : 'No' },
    { label: 'Intro Email Opened', value: lead.badgeIntroEmailOpened ? '✓ Yes' : 'No' },
    { label: 'Consumer Site', value: lead.badgeConsumerWebsite ? '✓ Yes' : 'No' },
    { label: 'Investor Page', value: lead.badgeInvestorPage ? '✓ Yes' : 'No' },
  ] : null;

  const typeColor = { call:'#60a5fa', connected:'#4ade80', not_available:'#8a9ab8', callback_later:'#a78bfa', not_interested:'#ef4444', status_change:GOLD, note:'#c4cdd8', interested:'#4ade80', abandoned:'#ef4444' };
  const typeIcon  = { call:'📞', connected:'✅', not_available:'📵', callback_later:'🔁', not_interested:'🚫', status_change:'🔄', note:'📝', interested:'🌟', abandoned:'⛔', transcript:'🎙', call_report:'📋' };

  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical' };

  const SUB_TABS = [
    ['clientinfo',  '🦆 Client Info', ''],
    ['notes',       '📝 My Notes', notes.length],
    ['emails',      '✉️ Emails',   emails.length || ''],
    ['transcripts', '🎙 Transcripts', transcripts.length],
    ['reports',     '📋 Reports',  reports.length],
    ['siteaccess',  '🌐 Site Access', ''],
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Sub-tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'16px', flexShrink:0 }}>
        {SUB_TABS.map(([id, label, count]) => (
          <button key={id} onClick={() => setSub(id)}
            style={{ background:'none', border:'none', borderBottom:sub===id?`2px solid ${GOLD}`:'2px solid transparent', color:sub===id?GOLD:'#6b7280', padding:'8px 14px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px', whiteSpace:'nowrap', position:'relative' }}>
            {label}
            {count > 0 && <span style={{ marginLeft:'5px', background:'rgba(184,147,58,0.2)', color:GOLD, borderRadius:'10px', padding:'0px 5px', fontSize:'9px' }}>{count}</span>}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>

        {/* ── CLIENT INFO ── */}
        {sub === 'clientinfo' && (
          <ClientInfoTab lead={lead} onUpdate={onNoteAdded} />
        )}

        {/* ── MY NOTES ── */}
        {sub === 'notes' && (
          <div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note…" rows={2} style={inp}
                onKeyDown={e=>{ if(e.key==='Enter'&&e.metaKey) addNote(); }} />
              <button onClick={addNote} disabled={saving||!note.trim()}
                style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:'#0a0f1e', border:'none', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap', alignSelf:'flex-start' }}>
                {saving ? '…' : '+ Add'}
              </button>
            </div>
            {notes.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'24px' }}>No notes yet.</p>}
            {notes.map((h, i) => {
              const color = typeColor[h.type] || '#6b7280';
              const icon  = typeIcon[h.type]  || '📝';
              return (
                <div key={h.id||i} style={{ display:'flex', gap:'12px', marginBottom:'12px' }}>
                  <div style={{ fontSize:'16px', flexShrink:0, marginTop:'2px' }}>{icon}</div>
                  <div style={{ flex:1, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'10px 12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <span style={{ color, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{h.type.replace(/_/g,' ')}</span>
                        {h.createdBy && <span style={{ color:'#6b7280', fontSize:'10px' }}>· {h.createdBy}</span>}
                      </div>
                      <span style={{ color:'#4a5568', fontSize:'10px' }}>{fmtDateTime(h.created_date)}</span>
                    </div>
                    <p style={{ color:'#c4cdd8', fontSize:'12px', margin:0, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{h.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── EMAILS ── */}
        {sub === 'emails' && (
          <div>
            {loadingEmails && <p style={{ color:'#6b7280', textAlign:'center', padding:'24px' }}>Loading…</p>}
            {!loadingEmails && emails.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'24px' }}>No emails sent yet.</p>}
            {emails.map((log, i) => (
              <div key={log.id||i} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'12px 14px', marginBottom:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <span style={{ fontSize:'14px' }}>✉️</span>
                    <span style={{ color:{ sent:'#60a5fa', delivered:'#4ade80', opened:'#4ade80', clicked:'#f59e0b', bounced:'#ef4444', spam:'#ef4444' }[log.status]||'#8a9ab8', fontSize:'11px', fontWeight:'bold', textTransform:'uppercase' }}>{log.status}</span>
                  </div>
                  <span style={{ color:'#4a5568', fontSize:'10px' }}>{fmtDT(log.sentAt)}</span>
                </div>
                {log.openedAt  && <div style={{ color:'#4ade80', fontSize:'11px' }}>📬 Opened: {fmtDT(log.openedAt)}</div>}
                {log.clickedAt && <div style={{ color:'#f59e0b', fontSize:'11px', marginTop:'2px' }}>🔗 Clicked: {fmtDT(log.clickedAt)}{log.clickedUrl ? ` — ${log.clickedUrl}` : ''}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── TRANSCRIPTS ── */}
        {sub === 'transcripts' && (
          <div>
            {transcripts.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'24px' }}>No call transcripts yet. Transcripts are auto-saved when you stop listening.</p>}
            {transcripts.map((h, i) => (
              <div key={h.id||i} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', marginBottom:'12px', overflow:'hidden' }}>
                <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(96,165,250,0.06)' }}>
                  <span style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>🎙 Call Transcript</span>
                  <span style={{ color:'#4a5568', fontSize:'10px' }}>{fmtDT(h.created_date)}</span>
                </div>
                <pre style={{ color:'#8a9ab8', fontSize:'11px', lineHeight:1.7, margin:0, padding:'12px', whiteSpace:'pre-wrap', fontFamily:'monospace', maxHeight:'300px', overflowY:'auto' }}>{h.content}</pre>
              </div>
            ))}
          </div>
        )}

        {/* ── CALL REPORTS ── */}
        {sub === 'reports' && (
          <div>
            {reports.length === 0 && <p style={{ color:'#4a5568', textAlign:'center', padding:'24px' }}>No call reports yet. Reports are auto-generated when you stop listening.</p>}
            {reports.map((h, i) => (
              <div key={h.id||i} style={{ background:'rgba(184,147,58,0.04)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'4px', marginBottom:'12px', overflow:'hidden' }}>
                <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(184,147,58,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>📋 Call Report</span>
                  <span style={{ color:'#4a5568', fontSize:'10px' }}>{fmtDT(h.created_date)}</span>
                </div>
                <div style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.8, padding:'14px', whiteSpace:'pre-wrap' }}>{h.content}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── SITE ACCESS ── */}
        {sub === 'siteaccess' && (
          <div>
            <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'12px 16px', marginBottom:'14px', fontSize:'11px', color:'#6b7280' }}>
              Summary view only — visit <strong style={{ color:GOLD }}>📊 Site Stats</strong> tab for full page-by-page detail.
            </div>
            {!lead.lastSiteVisit && !lead.portalPasscode && (
              <p style={{ color:'#4a5568', textAlign:'center', padding:'24px' }}>No site activity yet. Send the prospect email to enable tracking.</p>
            )}
            {(lead.lastSiteVisit || lead.portalPasscode) && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                {[
                  ['🕐 Last Visit',     lead.lastSiteVisit ? fmtDateTime(lead.lastSiteVisit) : 'Never',  '#60a5fa'],
                  ['🔑 Portal User',    lead.portalPasscode || 'Not assigned',                       GOLD],
                  ['📬 Email Opened',   lead.badgeEmailOpened ? '✓ Yes' : 'Not yet',                lead.badgeEmailOpened ? '#4ade80' : '#4a5568'],
                  ['🌟 Intro Opened',   lead.badgeIntroEmailOpened ? '✓ Yes' : 'Not yet',           lead.badgeIntroEmailOpened ? '#4ade80' : '#4a5568'],
                  ['🌐 Consumer Site',  lead.badgeConsumerWebsite ? '✓ Visited' : 'Not yet',        lead.badgeConsumerWebsite ? '#4ade80' : '#4a5568'],
                  ['💼 Investor Page',  lead.badgeInvestorPage ? '✓ Visited' : 'Not yet',          lead.badgeInvestorPage ? '#4ade80' : '#4a5568'],
                  ['⭐ Engagement',     `${lead.engagementScore || 0} pts`,                         GOLD],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'10px 12px' }}>
                    <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{label}</div>
                    <div style={{ color, fontSize:'13px', fontWeight:'bold' }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// Inline star rating for the contact card header
function LeadStarRating({ value = 0, onChange, size = 18 }) {
  const [hover, setHover] = useState(null);
  const displayVal = hover !== null ? hover : value;
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }} onMouseLeave={() => setHover(null)}>
      {[1,2,3,4,5].map(star => {
        const full = displayVal >= star;
        const half = !full && displayVal >= star - 0.5;
        return (
          <div key={star} style={{ position:'relative', width:`${size}px`, height:`${size}px`, cursor:'pointer', flexShrink:0 }}
            onMouseMove={e => { const isLeft = e.clientX - e.currentTarget.getBoundingClientRect().left < size/2; setHover(isLeft ? star-0.5 : star); }}
            onClick={e => { e.stopPropagation(); const isLeft = e.clientX - e.currentTarget.getBoundingClientRect().left < size/2; const nv = (isLeft ? star-0.5 : star); onChange(nv === value ? 0 : nv); }}>
            <span style={{ position:'absolute', inset:0, color:'rgba(255,255,255,0.12)', fontSize:`${size}px`, lineHeight:`${size}px`, userSelect:'none' }}>★</span>
            {(full || half) && <span style={{ position:'absolute', inset:0, fontSize:`${size}px`, lineHeight:`${size}px`, userSelect:'none', color:'#f59e0b', clipPath: full?'none':'inset(0 50% 0 0)' }}>★</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── AI Details Tab ────────────────────────────────────────────────────────────
function AIDetailsTab({ lead, onUpdate }) {
  const GOLD = '#b8933a';
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');

  const intent  = (() => { try { return JSON.parse(lead?.lastIntentAnalysis || '{}'); } catch { return {}; } })();
  const profile = (() => { try { return JSON.parse(lead?.clientProfile || '{}'); } catch { return {}; } })();
  const extracted = intent?.extractedData || {};
  const hasIntent = Object.keys(intent).length > 0;
  const hasExtracted = Object.values(extracted).some(v => v && (Array.isArray(v) ? v.length > 0 : true));

  const scoreColor = (score) => {
    if (score >= 70) return '#4ade80';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const applyExtracted = async () => {
    setApplying(true); setApplyMsg('');
    try {
      const updates = {};
      if (extracted.mentionedAmount)  updates.notes = `${lead.notes ? lead.notes + '\n' : ''}[AI] Mentioned investment amount: $${extracted.mentionedAmount}`;
      if (extracted.bestTimeToCall)   updates.bestTimeToCall = extracted.bestTimeToCall;
      if (extracted.extractedNotes)   updates.notes = `${updates.notes || lead.notes || ''}\n[AI] ${extracted.extractedNotes}`.trim();
      if (Object.keys(updates).length > 0) {
        await base44.entities.Lead.update(lead.id, updates);
        onUpdate && onUpdate();
        setApplyMsg('✓ Applied to lead card');
        setTimeout(() => setApplyMsg(''), 3000);
      } else {
        setApplyMsg('Nothing new to apply');
        setTimeout(() => setApplyMsg(''), 2000);
      }
    } catch (e) { setApplyMsg('Error: ' + e.message); }
    setApplying(false);
  };

  if (!hasIntent && !profile.animalType) return (
    <div style={{ textAlign:'center', padding:'60px 24px' }}>
      <div style={{ fontSize:'48px', marginBottom:'16px' }}>🤖</div>
      <h3 style={{ color:'#4a5568', fontWeight:'normal', marginBottom:'10px' }}>No AI analysis yet</h3>
      <p style={{ color:'#374151', fontSize:'13px', maxWidth:'360px', margin:'0 auto', lineHeight:1.7 }}>
        AI details populate automatically after a call with the AI Assistant active. Make a call with Intent or Q&A enabled to generate analysis.
      </p>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

      {/* Intent score + signals */}
      {hasIntent && (
        <>
          {/* Score row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              ['Intent Score', `${intent.intentScore ?? '—'}/100`, scoreColor(intent.intentScore)],
              ['Interest', intent.interestLevel || '—', intent.interestLevel === 'high' ? '#4ade80' : intent.interestLevel === 'medium' ? '#f59e0b' : '#ef4444'],
              ['Tonality', intent.tonality || '—', '#8a9ab8'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'12px', textAlign:'center' }}>
                <div style={{ color, fontSize:'18px', fontWeight:'bold', textTransform:'capitalize' }}>{val}</div>
                <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'4px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Animal type */}
          {intent.animalType && (
            <div style={{ background:'rgba(0,0,0,0.15)', border:`1px solid ${intent.animalType==='duck'?'rgba(245,158,11,0.3)':'rgba(74,222,128,0.3)'}`, borderRadius:'4px', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'28px' }}>{intent.animalType === 'duck' ? '🦆' : intent.animalType === 'cow' ? '🐄' : '❓'}</span>
              <div>
                <div style={{ color: intent.animalType==='duck'?'#f59e0b':'#4ade80', fontSize:'14px', fontWeight:'bold', textTransform:'capitalize' }}>
                  {intent.animalType} — {intent.animalConfidence}% confidence
                </div>
                <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'2px' }}>{intent.tonalityNotes}</div>
              </div>
            </div>
          )}

          {/* Buying signals */}
          {intent.buyingSignals?.length > 0 && (
            <div style={{ background:'rgba(74,222,128,0.05)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'4px', padding:'12px 16px' }}>
              <div style={{ color:'#4ade80', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>✅ Buying Signals</div>
              {intent.buyingSignals.map((s, i) => (
                <div key={i} style={{ color:'#c4cdd8', fontSize:'12px', padding:'3px 0', display:'flex', gap:'8px' }}>
                  <span style={{ color:'#4ade80', flexShrink:0 }}>›</span>{s}
                </div>
              ))}
            </div>
          )}

          {/* Objections */}
          {intent.objections?.length > 0 && (
            <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'4px', padding:'12px 16px' }}>
              <div style={{ color:'#ef4444', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>⚠️ Objections</div>
              {intent.objections.map((o, i) => (
                <div key={i} style={{ color:'#c4cdd8', fontSize:'12px', padding:'3px 0', display:'flex', gap:'8px' }}>
                  <span style={{ color:'#ef4444', flexShrink:0 }}>›</span>{o}
                </div>
              ))}
            </div>
          )}

          {/* Key moments */}
          {intent.keyMoments?.length > 0 && (
            <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'12px 16px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>🎯 Key Moments</div>
              {intent.keyMoments.map((m, i) => (
                <div key={i} style={{ color:'#8a9ab8', fontSize:'12px', padding:'3px 0', display:'flex', gap:'8px' }}>
                  <span style={{ color:GOLD, flexShrink:0 }}>›</span>{m}
                </div>
              ))}
            </div>
          )}

          {/* Recommended next step */}
          {intent.recommendedNextStep && (
            <div style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'4px', padding:'12px 16px' }}>
              <div style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>📋 Recommended Next Step</div>
              <p style={{ color:'#c4cdd8', fontSize:'13px', margin:0, lineHeight:1.6 }}>{intent.recommendedNextStep}</p>
            </div>
          )}
        </>
      )}

      {/* Extracted call data */}
      {hasExtracted && (
        <div style={{ background:'rgba(184,147,58,0.05)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'4px', padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>🤖 Extracted from Call</div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {applyMsg && <span style={{ color: applyMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize:'11px' }}>{applyMsg}</span>}
              <button onClick={applyExtracted} disabled={applying}
                style={{ background:'rgba(184,147,58,0.15)', border:'1px solid rgba(184,147,58,0.35)', borderRadius:'4px', padding:'5px 12px', color:GOLD, cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                {applying ? '⏳' : '⬇ Apply to Card'}
              </button>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {extracted.mentionedAmount && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color:'#8a9ab8', fontSize:'12px' }}>Mentioned Amount</span>
                <span style={{ color:'#4ade80', fontSize:'12px', fontWeight:'bold' }}>${Number(extracted.mentionedAmount).toLocaleString()}</span>
              </div>
            )}
            {extracted.accountType && extracted.accountType !== 'null' && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color:'#8a9ab8', fontSize:'12px' }}>Account Type</span>
                <span style={{ color:'#e8e0d0', fontSize:'12px', textTransform:'uppercase', fontWeight:'bold' }}>{extracted.accountType}</span>
              </div>
            )}
            {extracted.iraDetails && extracted.iraDetails !== 'null' && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color:'#8a9ab8', fontSize:'12px' }}>IRA Details</span>
                <span style={{ color:'#e8e0d0', fontSize:'12px' }}>{extracted.iraDetails}</span>
              </div>
            )}
            {extracted.bestTimeToCall && extracted.bestTimeToCall !== 'null' && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color:'#8a9ab8', fontSize:'12px' }}>Best Time to Call</span>
                <span style={{ color:'#e8e0d0', fontSize:'12px' }}>{extracted.bestTimeToCall}</span>
              </div>
            )}
            {extracted.positiveSignals?.length > 0 && (
              <div style={{ padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color:'#4ade80', fontSize:'11px', marginBottom:'4px' }}>Positive Signals</div>
                {extracted.positiveSignals.map((s, i) => (
                  <div key={i} style={{ color:'#8a9ab8', fontSize:'12px', padding:'2px 0' }}>› "{s}"</div>
                ))}
              </div>
            )}
            {extracted.negativeSignals?.length > 0 && (
              <div style={{ padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color:'#ef4444', fontSize:'11px', marginBottom:'4px' }}>Negative Signals</div>
                {extracted.negativeSignals.map((s, i) => (
                  <div key={i} style={{ color:'#8a9ab8', fontSize:'12px', padding:'2px 0' }}>› "{s}"</div>
                ))}
              </div>
            )}
            {extracted.extractedNotes && extracted.extractedNotes !== 'null' && (
              <div style={{ padding:'6px 0' }}>
                <div style={{ color:GOLD, fontSize:'11px', marginBottom:'4px' }}>Notes</div>
                <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5 }}>{extracted.extractedNotes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client profile summary if present */}
      {profile.lastCallSummary && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'12px 16px' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Last Call Summary</div>
          <p style={{ color:'#8a9ab8', fontSize:'12px', margin:0, lineHeight:1.6 }}>{profile.lastCallSummary}</p>
        </div>
      )}

    </div>
  );
}

export default function LeadContactCard({ lead, onClose, onUpdate, onDialNumber, dialerRef, onResume, isDialerPaused, onNextLead, onPrevLead, currentLeadIndex, totalLeads, dialerPanelOpen, twilioStream: externalStream, onCallLogged, onDialStarted }) {
  const [moveToBack, setMoveToBack] = useState(false);
  // Archived = migrated to CRM — card is read-only
  const isArchived = !!(lead.migratedToPortal || lead.convertedToInvestorUserId || lead.status === 'converted');
  const [cardExpanded, setCardExpanded] = useState(false);
  const [starRating, setStarRating] = useState(lead.starRating || 0);
  const [transferring, setTransferring] = useState(false);

  const { portalUser } = usePortalAuth();
  const currentUsername = portalUser?.username || 'admin';
  const otherUsername = currentUsername === 'steph' ? 'admin' : 'steph';

  const { reminders, setReminder, clearReminder } = useReminders();

  const handleStarChange = async (val) => {
    setStarRating(val);
    try { await base44.entities.Lead.update(lead.id, { starRating: val }); onUpdate && onUpdate(); } catch {}
  };

  const handleRemoveFromPipeline = async () => {
    setTransferring(true);
    try {
      await base44.entities.Lead.update(lead.id, { leadPipelineStage: null, leadPipelineOwner: null });
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'note',
        content: `🚫 Removed from pipeline by ${currentUsername} — remains as prospect`,
        createdBy: currentUsername,
      });
      setEditLead(prev => ({ ...prev, leadPipelineStage: null, leadPipelineOwner: null }));
      onUpdate && onUpdate();
    } catch(e) { console.error(e); }
    setTransferring(false);
  };

  const handleTransferPipeline = async () => {
    setTransferring(true);
    try {
      await base44.entities.Lead.update(lead.id, { leadPipelineOwner: otherUsername });
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'note',
        content: `🔁 Pipeline transferred from ${currentUsername} → ${otherUsername}`,
        createdBy: currentUsername,
      });
      onUpdate && onUpdate();
    } catch(e) { console.error(e); }
    setTransferring(false);
  };
  const [selectedPhone, setSelectedPhone] = useState(lead.phone || lead.phone2 || '');
  const [inlineStream, setInlineStream] = useState(null);
  const currentLeadRef = useRef(lead);
  const dialer = useInlineDialer({ onCallStream: (stream) => setInlineStream(stream), agentName: currentUsername, leadId: lead.id, onCallLogged });
  // Prefer external stream (direct/predictive dialer) over inline dialer stream
  const twilioStream = externalStream || inlineStream;
  const [tab, setTab] = useState('overview');
  const [history, setHistory] = useState([]);
  const [editLead, setEditLead] = useState({ ...lead });
  const [smsOptedIn, setSmsOptedIn] = useState(!!(lead.badgeSmsOptIn));

  // When lead prop changes (Next Lead), reset card state
  useEffect(() => {
    currentLeadRef.current = lead;
    setEditLead({ ...lead });
    setSelectedPhone(lead.phone || lead.phone2 || '');
    setHistory([]);
    setLoading(true);
    setQuickNote('');
    setSelectedAction(null);
    setTab('overview');
  }, [lead.id]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMigrate, setShowMigrate] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [sendingPortalEmail, setSendingPortalEmail] = useState(false);
  const [portalEmailMsg, setPortalEmailMsg] = useState('');

  // Actions state
  const [prospectNote, setProspectNote] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [notAvailableNote, setNotAvailableNote] = useState('');
  const [notInterestedNote, setNotInterestedNote] = useState('');
  const [selectedAction, setSelectedAction] = useState(null); // 'not_available' | 'not_interested'

  // Note entry in overview
  const [quickNote, setQuickNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [showCallLog, setShowCallLog] = useState(false);
  const [unreadSms, setUnreadSms] = useState(0);

  // Poll unread SMS count
  useEffect(() => {
    const checkUnread = async () => {
      try {
        const msgs = await base44.entities.SmsMessage.filter({ leadId: lead.id, direction: 'inbound', read: false }).catch(() => []);
        setUnreadSms((msgs || []).length);
      } catch {}
    };
    checkUnread();
    const t = setInterval(checkUnread, 8000);
    return () => clearInterval(t);
  }, [lead.id]);

  useEffect(() => { loadHistory(); }, [lead.id]);
  useEffect(() => { setSelectedPhone(editLead.phone || editLead.phone2 || ''); }, [editLead.phone, editLead.phone2]);

  // Check SMS opt-in
  useEffect(() => {
    const checkOptIn = async () => {
      try {
        const phones = [lead.phone, lead.phone2].filter(Boolean).map(p => p.replace(/[\s\-().]/g, ''));
        if (!phones.length) return;
        const records = await base44.entities.SmsOptIn.filter({ active: true });
        const matched = (records || []).some(r => {
          const rp = (r.phone || '').replace(/[\s\-().]/g, '');
          return phones.some(p => p === rp);
        });
        setSmsOptedIn(matched);
      } catch {}
    };
    checkOptIn();
  }, [lead.id, lead.phone, lead.phone2]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // Always load LeadHistory
      const leadHist = await base44.entities.LeadHistory.filter({ leadId: lead.id }, '-created_date', 500).catch(() => []);

      // For archived leads, also pull ContactNotes from the linked InvestorUser
      let contactNotes = [];
      const investorUserId = lead.convertedToInvestorUserId;
      if (isArchived && investorUserId) {
        const cn = await base44.entities.ContactNote.filter({ investorId: investorUserId }, '-createdAt', 500).catch(() => []);
        // Convert ContactNotes to a LeadHistory-like shape so the UI renders them uniformly
        contactNotes = cn.map(n => ({
          id: 'cn_' + n.id,
          type: n.type === 'call' ? 'call' : n.type === 'email' ? 'note' : 'note',
          content: n.content,
          created_date: n.createdAt || n.created_date,
          callDurationSeconds: null,
          _isContactNote: true,
        }));
      }

      // Merge and sort by date descending, deduplicate by content+date
      const all = [...leadHist, ...contactNotes].sort((a, b) =>
        new Date(b.created_date || 0) - new Date(a.created_date || 0)
      );
      setHistory(all);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const logHistory = async (type, content, extra = {}) => {
    await base44.entities.LeadHistory.create({ leadId: lead.id, type, content, createdBy: currentUsername, ...extra });
    await loadHistory();
  };

  const updateStatus = async (newStatus, histType, histContent, extra = {}) => {
    // When marking as prospect, always assign pipeline owner to current user
    const prospectExtra = newStatus === 'prospect' ? { leadPipelineOwner: currentUsername } : {};
    await base44.entities.Lead.update(lead.id, { status: newStatus, ...prospectExtra, ...extra });
    await logHistory(histType || 'status_change', histContent || `Status changed to ${newStatus}`);
    onUpdate && onUpdate();
    setEditLead(prev => ({ ...prev, status: newStatus, ...prospectExtra, ...extra }));
  };

  const handleProspect = async () => {
    const note = prospectNote.trim();
    await updateStatus('prospect', 'prospect', `Marked as Prospect${note ? `: ${note}` : ''}`, { leadPipelineStage: 'reviewing' });
    if (note) await logHistory('note', note);
    if (callbackDate) {
      await base44.entities.Lead.update(lead.id, { callbackAt: callbackDate });
      await logHistory('callback_later', `Callback scheduled for ${fmtDateTime(callbackDate)}`);
      setEditLead(prev => ({ ...prev, callbackAt: callbackDate }));
    }
    setProspectNote('');
    setCallbackDate('');
  };

  const handleNotAvailable = async () => {
    const note = notAvailableNote.trim();
    const now = new Date().toISOString();
    await updateStatus('not_available', 'not_available', `Not available${note ? ` — ${note}` : ` — ${fmtDateTime(now)}`}`, { lastCalledAt: now });
    // Fire onCallLogged so LeadsTab stamps lastCalledAt and re-sorts
    onCallLogged && onCallLogged(lead.id);
    if (note) await logHistory('note', note);
    setNotAvailableNote('');
    setSelectedAction(null);
  };

  const handleNotInterested = async () => {
    if (!window.confirm('Remove this lead permanently?')) return;
    const note = notInterestedNote.trim();
    await updateStatus('not_interested', 'not_interested', `Not interested${note ? ` — ${note}` : ''}`);
    if (note) await logHistory('note', note);
    onClose();
    onUpdate && onUpdate();
  };

  const handleCallbackLater = async () => {
    if (!callbackDate) return;
    await updateStatus('callback_later', 'callback_later', `Callback scheduled for ${fmtDateTime(callbackDate)}`, { callbackAt: callbackDate });
    setCallbackDate('');
  };

  const handleQuickNotInterested = async () => {
    if (!window.confirm(`Remove ${lead.firstName} ${lead.lastName} from the lead list permanently?`)) return;
    await updateStatus('not_interested', 'not_interested', 'Not interested — permanently removed from list');
    onClose();
    onUpdate && onUpdate();
  };

  const handleQuickCallbackLater = async (date, clearFn) => {
    if (!date) {
      // Prompt for date inline — set a flag to show picker
      setShowCallbackPicker(true);
      return;
    }
    await updateStatus('callback_later', 'callback_later', `Callback later — ${fmtDateTime(date)}`, { callbackAt: date });
    clearFn && clearFn();
    setShowCallbackPicker(false);
  };

  const saveProfile = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.Lead.update(lead.id, {
        firstName: editLead.firstName, lastName: editLead.lastName,
        email: editLead.email, phone: editLead.phone, phone2: editLead.phone2,
        state: editLead.state, address: editLead.address, city: editLead.city, zip: editLead.zip,
        bestTimeToCall: editLead.bestTimeToCall,
        investment: editLead.investment || '',
        customFields: editLead.customFields || '',
      });
      setSaveMsg('Saved ✓');
      onUpdate && onUpdate();
      setTimeout(() => setSaveMsg(''), 2500);
    } catch(e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
  };

  const addQuickNote = async () => {
    if (!quickNote.trim()) return;
    setAddingNote(true);
    await logHistory('note', quickNote.trim());
    setQuickNote('');
    setAddingNote(false);
  };

  const sendEmail = async () => {
    if (!editLead.email) { setEmailMsg('No email address on file.'); return; }
    setSendingEmail(true); setEmailMsg('');
    try {
      await base44.functions.invoke('sendLeadEmail', {
        leadId: lead.id,
        toEmail: editLead.email,
        toName: `${lead.firstName} ${lead.lastName}`,
        firstName: lead.firstName,
        sentBy: currentUsername,
      });
      setEmailMsg('✓ Investor site access sent! Click "Portal Access" to send portal credentials.');
      await loadHistory();
      // Reload lead so Portal Access tab shows the new username
      try {
        const fresh = await base44.entities.Lead.filter({ id: lead.id });
        if (fresh?.[0]) setEditLead(fresh[0]);
      } catch {}
      onUpdate && onUpdate();
      setTimeout(() => setEmailMsg(''), 4000);
    } catch (e) {
      setEmailMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSendingEmail(false);
  };

  const sendPortalEmail = async () => {
    if (!editLead.email) { setPortalEmailMsg('No email on file.'); return; }
    setSendingPortalEmail(true); setPortalEmailMsg('');
    try {
      // Build portal credentials from lead data
      const u = editLead.portalPasscode;
      const lastSlug = (lead.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
      const pw = u ? `${lastSlug}#2026` : '';
      if (!u) {
        // No username yet — create via sendLeadEmail first
        setPortalEmailMsg('Generate investor site access first — click "Investor Site Access" button.');
        setSendingPortalEmail(false);
        return;
      }
      const portalLoginUrl = `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(u)}&password=${encodeURIComponent(pw)}`;
      await base44.functions.invoke('sendPortalAccessEmail', {
        leadId:    lead.id,
        toEmail:   editLead.email,
        toName:    `${lead.firstName} ${lead.lastName}`,
        firstName: lead.firstName,
        username:  u,
        password:  pw,
        loginUrl:  portalLoginUrl,
      });
      setPortalEmailMsg('✓ Portal access email sent!');
      await loadHistory();
      setTimeout(() => setPortalEmailMsg(''), 4000);
    } catch (e) {
      setPortalEmailMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSendingPortalEmail(false);
  };

  const statusInfo = STATUS_LABELS[editLead.status] || STATUS_LABELS.lead;
  const fullName = `${lead.firstName} ${lead.lastName}`;
  const isProspect = editLead.status === 'prospect';

  return (
    <>
    {showMigrate && (
      <MigrateLeadModal
        lead={lead}
        history={history}
        onClose={() => setShowMigrate(false)}
        onMigrated={() => { setShowMigrate(false); onUpdate && onUpdate(); onClose(); }}
      />
    )}
    {showFollowUpModal && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999, padding:'20px' }}>
        <div style={{ background:'#0d1b2a', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'8px', width:'100%', maxWidth:'420px', padding:'24px', fontFamily:'Georgia, serif' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
            <h3 style={{ color:'#4ade80', margin:0, fontSize:'14px', letterSpacing:'1.5px', textTransform:'uppercase' }}>📅 Schedule Follow Up</h3>
            <button onClick={() => { setShowFollowUpModal(false); setFollowUpDate(''); setFollowUpNote(''); }} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div>
              <label style={{ display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'6px' }}>Date & Time</label>
              <input type="datetime-local" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', colorScheme:'dark', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'6px' }}>Note (optional)</label>
              <input value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} placeholder="What to discuss, prep notes…"
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
              <button onClick={async () => {
                if (!followUpDate) return;
                setSavingFollowUp(true);
                try {
                  await base44.entities.Appointment.create({
                    investorId: lead.id,
                    investorEmail: lead.email || '',
                    investorName: `${lead.firstName} ${lead.lastName}`,
                    title: `Follow up — ${lead.firstName} ${lead.lastName}`,
                    type: 'follow-up',
                    scheduledAt: followUpDate,
                    notes: followUpNote,
                    status: 'scheduled',
                    createdBy: currentUsername,
                  });
                  await base44.entities.LeadHistory.create({
                    leadId: lead.id, type: 'callback_later',
                    content: `📅 Follow up scheduled for ${fmtDateTimeLong(followUpDate)}${followUpNote ? ` — ${followUpNote}` : ''} · by ${currentUsername}`,
                    createdBy: currentUsername,
                  });
                  setShowFollowUpModal(false); setFollowUpDate(''); setFollowUpNote('');
                  await loadHistory();
                } catch(e) { alert('Error: ' + e.message); }
                setSavingFollowUp(false);
              }} disabled={!followUpDate || savingFollowUp}
                style={{ flex:1, background: followUpDate ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.07)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.4)', borderRadius:'4px', padding:'10px', cursor: followUpDate ? 'pointer' : 'not-allowed', fontSize:'12px', fontWeight:'bold' }}>
                {savingFollowUp ? '⏳ Saving…' : '✓ Schedule'}
              </button>
              <button onClick={() => { setShowFollowUpModal(false); setFollowUpDate(''); setFollowUpNote(''); }}
                style={{ padding:'10px 18px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', cursor:'pointer', fontSize:'12px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {showZoom && (
      <div style={{ position:'fixed', inset:0, zIndex:99999 }}>
        <ZoomBookingModal isOpen={showZoom} onClose={() => setShowZoom(false)} buttonLabel="Book Zoom Call" zoomUrl="https://scheduler.zoom.us/stephani-sterling" />
      </div>
    )}
    <div style={{ position:'fixed', top:0, left:0, right: (dialerPanelOpen && !cardExpanded) ? '340px' : 0, bottom:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9000, padding: cardExpanded ? '0' : '16px' }}>
      <div style={{ background:'#0d1b2a', border:`1px solid ${isArchived ? 'rgba(245,158,11,0.3)' : 'rgba(184,147,58,0.3)'}`, borderRadius:'4px', width:'100%', maxWidth: cardExpanded ? '100%' : '1000px', maxHeight: cardExpanded ? '100%' : '92vh', height: cardExpanded ? '100%' : undefined, display:'flex', flexDirection:'column', boxShadow:'0 40px 120px rgba(0,0,0,0.9)', transition:'all 0.2s ease' }}>

        {/* Archived banner */}
        {isArchived && (
          <div style={{ background:'rgba(245,158,11,0.1)', borderBottom:'1px solid rgba(245,158,11,0.25)', padding:'8px 24px', display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
            <span style={{ fontSize:'14px' }}>📦</span>
            <span style={{ color:'#f59e0b', fontSize:'12px', fontWeight:'bold', letterSpacing:'0.5px' }}>Archived — Migrated to CRM</span>
            <span style={{ color:'#6b7280', fontSize:'11px' }}>This lead is read-only. Edit from the Potential Investor card in the CRM.</span>
          </div>
        )}

        {/* ── HEADER ── */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.25)', flexShrink:0 }}>

          {/* Row 1: Score + Name/Stars (left) | Status pills centered | Nav + Close (right) */}
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>

            {/* Left: Name + Stars */}
            <div style={{ display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  <div style={{ color:'#e8e0d0', fontSize:'22px', fontFamily:'Georgia,serif', fontWeight:'normal', lineHeight:1.1 }}>{fullName}</div>
                  {smsOptedIn && (
                    <img
                      src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/9febafab0_Untitled313x313px.png"
                      alt="SMS Opted In"
                      title="SMS Opted In"
                      style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }}
                    />
                  )}
                  {(editLead.badgeDataRoomRequest || lead.badgeDataRoomRequest) && (
                    <img
                      src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/5f030ac02_Untitled313x313px279x158px.png"
                      alt="NB Data Room Requested"
                      title="Data Room Requested"
                      style={{ width: '52px', height: '29px', objectFit: 'contain', flexShrink: 0, borderRadius: '4px' }}
                    />
                  )}
                </div>
                <div style={{ marginTop:'4px' }}>
                  <LeadStarRating value={starRating} onChange={handleStarChange} size={20} />
                </div>
              </div>
            </div>

            {/* Center: Status pills + Migrate */}
            {!isArchived && (
              <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'nowrap', flex:1, justifyContent:'center', overflow:'hidden' }}>
                {Object.entries(STATUS_LABELS).map(([s, { label, color }]) => {
                  const active = editLead.status === s;
                  return (
                    <button key={s} onClick={() => updateStatus(s, 'status_change', `Status changed to ${s}`, s === 'prospect' ? { leadPipelineStage: 'reviewing' } : {})}
                      style={{ background: active ? `${color}22` : 'transparent', border:`1.5px solid ${active ? color : 'rgba(255,255,255,0.12)'}`, borderRadius:'20px', color: active ? color : '#6b7280', padding:'5px 12px', cursor:'pointer', fontSize:'12px', fontWeight: active ? 'bold' : 'normal', whiteSpace:'nowrap', flexShrink:0 }}>
                      {label}
                    </button>
                  );
                })}
                <button onClick={async () => {
                    const newType = editLead.leadType === 'nb_tech' ? 'standard' : 'nb_tech';
                    const updates = { leadType: newType };
                    // When marking as NB Tech, assign pipeline owner to current user
                    if (newType === 'nb_tech') {
                      updates.leadPipelineOwner = currentUsername;
                      updates.leadPipelineStage = editLead.leadPipelineStage || 'reviewing';
                      fireScorecardNBTechConvert(currentUsername);
                    }
                    await base44.entities.Lead.update(lead.id, updates);
                    setEditLead(prev => ({ ...prev, ...updates }));
                    onUpdate && onUpdate();
                  }}
                  style={{ background: editLead.leadType === 'nb_tech' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', border:`1.5px solid ${editLead.leadType === 'nb_tech' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.15)'}`, borderRadius:'20px', color: editLead.leadType === 'nb_tech' ? '#818cf8' : '#6b7280', padding:'5px 12px', cursor:'pointer', fontSize:'12px', fontWeight: editLead.leadType === 'nb_tech' ? 'bold' : 'normal', whiteSpace:'nowrap', flexShrink:0 }}>
                  💡 {editLead.leadType === 'nb_tech' ? 'NB Tech ✓' : 'NB Tech'}
                </button>

                <button onClick={() => setShowMigrate(true)}
                  style={{ background:'rgba(167,139,250,0.12)', border:'1.5px solid rgba(167,139,250,0.35)', borderRadius:'20px', color:'#a78bfa', padding:'5px 12px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', whiteSpace:'nowrap', flexShrink:0 }}>
                  🚀 Migrate
                </button>
              </div>
            )}

            {/* Right: Close only */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
              <button onClick={onClose} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#6b7280', cursor:'pointer', fontSize:'18px', width:'32px', height:'32px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          </div>

          {/* Row 2: Phone selector + Inline Call Bar */}
          {(editLead.phone || lead.phone) && !isArchived && (
            <div>
              {(editLead.phone2 || lead.phone2) && (
                <div style={{ display:'flex', gap:'6px', marginBottom:'6px' }}>
                  {[editLead.phone || lead.phone, editLead.phone2 || lead.phone2].filter(Boolean).map((p, i) => (
                    <button key={p} onClick={() => setSelectedPhone(p)}
                      style={{ background: selectedPhone === p ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)', color: selectedPhone === p ? '#4ade80' : '#6b7280', border:`1px solid ${selectedPhone === p ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px', fontFamily:'monospace' }}>
                      {i === 0 ? '📞' : '📱'} {p}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ position:'relative', width:'100%' }}>
                <InlineCallBar
                  phone={selectedPhone || editLead.phone || lead.phone}
                  name={`${editLead.firstName || lead.firstName || ''} ${editLead.lastName || lead.lastName || ''}`.trim()}
                  dialer={{ ...dialer, dial: (phone) => { onDialStarted && onDialStarted(currentLeadRef.current.id); fireScorecardCall(currentUsername); dialer.dial(phone, currentLeadRef.current.id); } }}
                  onLogCall={async () => { await loadHistory(); }}
                  isPredictive={!!isDialerPaused}
                  isDialerPaused={!!isDialerPaused}
                  onPauseCampaign={() => dialerRef.current?.pauseDialer?.()}
                  onDisconnectNext={() => { dialerRef.current?.hangupActiveCall?.(); onNextLead?.(); }}
                  onSaveResume={async () => { await saveProfile(); dialerRef.current?.hangupActiveCall?.(); onResume?.(); }}
                  showCallLog={showCallLog}
                  onToggleCallLog={() => setShowCallLog(v => !v)}
                />
                {/* Score circle — overlays top-right of call bar */}
                <div style={{ position:'absolute', top:'12px', right:'12px', display:'flex', gap:'6px', alignItems:'center', zIndex:2, pointerEvents:'none' }}>
                  {unreadSms > 0 && (
                    <div onClick={e => { e.stopPropagation(); setTab('sms'); }} style={{ pointerEvents:'all', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'54px', height:'46px', borderRadius:'6px', background:'rgba(74,222,128,0.15)', border:'2px solid rgba(74,222,128,0.6)', animation:'smsBadgePulse 1.2s ease-in-out infinite' }}>
                      <style>{`@keyframes smsBadgePulse { 0%,100%{box-shadow:0 0 0 rgba(74,222,128,0)} 50%{box-shadow:0 0 12px rgba(74,222,128,0.5)} }`}</style>
                      <div style={{ fontSize:'11px', fontWeight:'bold', color:'#4ade80', lineHeight:1, fontFamily:'monospace' }}>{unreadSms}</div>
                      <div style={{ fontSize:'7px', color:'#4ade80', opacity:0.85, letterSpacing:'0.5px', textAlign:'center', lineHeight:1.2 }}>UNREAD<br/>SMS</div>
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'46px', height:'46px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}55,${GOLD}22)`, border:`2px solid ${GOLD}77` }}>
                    <div style={{ fontSize:'14px', fontWeight:'bold', color:GOLD, lineHeight:1, fontFamily:'monospace' }}>{editLead.engagementScore || 0}</div>
                    <div style={{ fontSize:'7px', color:GOLD, opacity:0.7, letterSpacing:'0.5px' }}>SCORE</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Action buttons */}
          <div style={{ display:'flex', alignItems:'center', marginTop:'10px', gap:'6px', flexWrap:'wrap', overflow:'auto', maxHeight:'60px', paddingBottom:'4px' }}>
            {isDialerPaused && (<>
              <button onClick={() => dialerRef.current?.hangupActiveCall?.()}
                style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', flexShrink:0 }}>
                📵 Hang Up
              </button>
              <button onClick={() => { dialerRef.current?.hangupActiveCall?.(); onNextLead?.(); }}
                style={{ background:'rgba(59,130,246,0.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.3)', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', flexShrink:0 }}>
                📵 Next
              </button>
              <button onClick={async () => { await saveProfile?.(); dialerRef.current?.hangupActiveCall?.(); onResume?.(); }}
                style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', flexShrink:0 }}>
                ▶ Resume
              </button>
            </>)}

            {!isArchived && (
              <button onClick={sendEmail} disabled={sendingEmail || !editLead.email}
                title="Email investor site access"
                style={{ background:'rgba(96,165,250,0.12)', color: editLead.email ? '#60a5fa' : '#4a5568', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'4px', padding:'6px 10px', cursor: editLead.email ? 'pointer' : 'not-allowed', fontSize:'10px', fontWeight:'bold', opacity: editLead.email ? 1 : 0.4, whiteSpace:'nowrap', flexShrink:0 }}>
                {sendingEmail ? '⏳' : '💼 Site Access'}
              </button>
            )}
            {!isArchived && (
              <button onClick={sendPortalEmail} disabled={sendingPortalEmail || !editLead.email}
                title="Email portal credentials"
                style={{ background:'rgba(167,139,250,0.12)', color: editLead.email ? '#a78bfa' : '#4a5568', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'6px 10px', cursor: editLead.email ? 'pointer' : 'not-allowed', fontSize:'10px', fontWeight:'bold', opacity: editLead.email ? 1 : 0.4, whiteSpace:'nowrap', flexShrink:0 }}>
                {sendingPortalEmail ? '⏳' : '🔐 Portal'}
              </button>
            )}
            {!isArchived && (
              <button onClick={() => setShowZoom(true)}
                style={{ background:'rgba(255,255,255,0.05)', color:'#c4cdd8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', fontSize:'10px', whiteSpace:'nowrap', flexShrink:0 }}>
                📅 Calendly
              </button>
            )}
            {!isArchived && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink:0 }}>
                <SetReminderButton 
                  contact={{ id: lead.id, firstName: editLead.firstName, lastName: editLead.lastName, type: 'lead', leadType: editLead.leadType }}
                  onSetReminder={setReminder}
                />
                <ReminderCountdown contactId={lead.id} />
              </div>
            )}
            {!isArchived && editLead.status === 'prospect' && (
              <button onClick={handleTransferPipeline} disabled={transferring}
                style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap', flexShrink:0 }}>
                {transferring ? '⏳' : `🔁 ${otherUsername}`}
              </button>
            )}
            {!isArchived && editLead.status === 'prospect' && editLead.leadPipelineOwner && (
              <button onClick={handleRemoveFromPipeline} disabled={transferring}
                style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'4px', padding:'6px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap', flexShrink:0 }}>
                🚫 Remove
              </button>
            )}
            {(emailMsg || portalEmailMsg) && <span style={{ fontSize:'9px', color: (emailMsg||portalEmailMsg).startsWith('Error') ? '#ef4444' : '#4ade80', flexShrink:0 }}>{emailMsg || portalEmailMsg}</span>}
          </div>

          {/* Row 4: Quick actions + Next Lead controls */}
          {!isArchived && (
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px', alignItems:'center' }}>
              <button onClick={() => setShowCallbackPicker(p => !p)}
                style={{ background:'rgba(245,158,11,0.08)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'20px', padding:'4px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                📵 Call Back Later
              </button>
              <button onClick={handleQuickNotInterested}
                style={{ background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'20px', padding:'4px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                ❌ Not Interested
              </button>
              <button onClick={() => setShowFollowUpModal(true)}
                style={{ background:'rgba(74,222,128,0.08)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'20px', padding:'4px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                📅 Schedule Follow Up
              </button>
              {/* Move to back + Next Lead — pushed to far right */}
              {onNextLead && (<>
                <div style={{ flex:1 }} />
                <label style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', userSelect:'none', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', padding:'4px 10px' }}>
                  <input
                    type="checkbox"
                    checked={moveToBack}
                    onChange={e => setMoveToBack(e.target.checked)}
                    style={{ cursor:'pointer', accentColor: '#b8933a' }}
                  />
                  <span style={{ color: moveToBack ? GOLD : '#6b7280', fontSize:'11px', whiteSpace:'nowrap' }}>Move to back</span>
                </label>
                <button
                  onClick={() => {
                    if (moveToBack && onDialStarted) onDialStarted(lead.id);
                    onNextLead();
                  }}
                  style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.35)', borderRadius:'20px', padding:'4px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  Next Lead →
                </button>
              </>)}
            </div>
          )}

          {/* Callback date picker — inline dropdown */}
          {showCallbackPicker && !isArchived && (
            <div style={{ marginTop:'8px', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'6px', padding:'12px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              <label style={{ color:'#f59e0b', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', flexShrink:0 }}>Call Back At</label>
              <input type="datetime-local" value={callbackDate} onChange={e => setCallbackDate(e.target.value)}
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'4px', padding:'6px 10px', color:'#e8e0d0', fontSize:'12px', outline:'none', colorScheme:'dark' }} />
              <button onClick={() => handleQuickCallbackLater(callbackDate, () => { setCallbackDate(''); })} disabled={!callbackDate}
                style={{ background:'rgba(245,158,11,0.2)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.4)', borderRadius:'4px', padding:'6px 14px', cursor: callbackDate ? 'pointer' : 'not-allowed', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                ✓ Save
              </button>
              <button onClick={() => setShowCallbackPicker(false)}
                style={{ background:'transparent', color:'#6b7280', border:'none', cursor:'pointer', fontSize:'13px' }}>✕</button>
            </div>
          )}
        </div>

        {/* Tabs row + activity badges on the right */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0, alignItems:'center' }}>
          {[['overview','Overview'],['history','History'],['email','✉️ Email'],['sms',unreadSms > 0 ? `💬 SMS (${unreadSms})` : '💬 SMS'],['actions','Actions'],['access','Site Access'],['sitestats','Site Stats'],['research','Research'],['script','Script & AI'],['aidetails','🤖 AI Details']].filter(([id]) => !(isArchived && id === 'actions')).map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:'none', border:'none', borderBottom:tab===id?`2px solid ${GOLD}`:'2px solid transparent', color:tab===id?GOLD:'#6b7280', padding:'10px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{label}</button>
          ))}
          <div style={{ flex:1 }} />
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <OverviewTab
              editLead={editLead} setEditLead={setEditLead}
              saving={saving} saveMsg={saveMsg}
              saveProfile={saveProfile}
              updateStatus={updateStatus}
              quickNote={quickNote} setQuickNote={setQuickNote}
              addQuickNote={addQuickNote} addingNote={addingNote}
              history={history} loading={loading}
              isArchived={isArchived}
              onQuickNotInterested={handleQuickNotInterested}
              onQuickCallbackLater={handleQuickCallbackLater}
              onMigrate={() => setShowMigrate(true)}
              onNoteAdded={loadHistory}
              createdBy={currentUsername}
            />
          )}

          {/* ── HISTORY ── */}
          {tab === 'history' && (
            <LeadHistoryTab lead={editLead} history={history} onNoteAdded={loadHistory} createdBy={currentUsername} />
          )}

          {/* ── SMS ── */}
          {tab === 'sms' && (
            <SmsTab
              toPhone={editLead.phone || lead.phone || ''}
              toPhone2={editLead.phone2 || lead.phone2 || ''}
              toName={`${editLead.firstName} ${editLead.lastName}`}
              leadId={lead.id}
              investorId={null}
              sentBy={currentUsername}
            />
          )}

          {/* ── EMAIL ── */}
          {tab === 'email' && (
            <CustomEmailTab
              toEmail={editLead.email}
              toName={`${editLead.firstName} ${editLead.lastName}`}
              leadId={lead.id}
              investorId={null}
              sentBy={currentUsername}
              onSent={loadHistory}
            />
          )}

          {tab === 'access' && (
            <SiteAccessTab lead={editLead} createdBy={currentUsername} onUpdate={(updates) => setEditLead(prev => ({ ...prev, ...updates }))} onSave={async (updates) => {
              try {
                await base44.entities.Lead.update(lead.id, updates);
                setEditLead(prev => ({ ...prev, ...updates }));
              } catch(e) { console.error(e); }
            }} />
          )}

          {tab === 'sitestats' && (
            <InvestorWebsiteTab lead={editLead} />
          )}

          {tab === 'research' && (
            <ResearchTab lead={editLead} />
          )}

          {tab === 'script' && (
            <ScriptAssistant lead={editLead} onExpandCard={() => setCardExpanded(e => !e)} isCardExpanded={cardExpanded} twilioStream={twilioStream} />
          )}

          {tab === 'aidetails' && (
            <AIDetailsTab lead={editLead} onUpdate={onUpdate} />
          )}

          {/* ── ACTIONS ── */}
          {tab === 'actions' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>Lead Actions</div>

              {/* Prospect — combined action */}
              <div style={{ background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:'4px', padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                  <span style={{ fontSize:'24px' }}>🚀</span>
                  <div>
                    <div style={{ color:'#a78bfa', fontWeight:'bold', fontSize:'14px' }}>Mark as Prospect</div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>Optionally add a note and/or schedule a callback.</div>
                  </div>
                </div>
                <textarea
                  value={prospectNote}
                  onChange={e => setProspectNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note (optional)…"
                  style={{ ...inp, resize:'vertical', marginBottom:'10px', fontSize:'12px' }}
                />
                <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:'160px' }}>
                    <label style={{ ...ls, marginBottom:'4px' }}>Schedule callback (optional)</label>
                    <DateTimePicker value={callbackDate} onChange={iso => setCallbackDate(iso)} />
                  </div>
                  <button onClick={handleProspect}
                    style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', border:'none', borderRadius:'2px', padding:'10px 22px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', letterSpacing:'1px', marginBottom:'16px', whiteSpace:'nowrap' }}>
                    🚀 Mark Prospect
                  </button>
                </div>
              </div>

              {/* Callback Later */}
              <div style={{ background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'4px', padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                  <span style={{ fontSize:'24px' }}>📅</span>
                  <div>
                    <div style={{ color:'#a78bfa', fontWeight:'bold', fontSize:'14px' }}>Call Back Later</div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>Schedule a callback without changing status.</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'10px', alignItems:'flex-end' }}>
                  <div style={{ flex:1 }}>
                    <DateTimePicker value={callbackDate} onChange={iso => setCallbackDate(iso)} />
                  </div>
                  <button onClick={handleCallbackLater} disabled={!callbackDate}
                    style={{ background:callbackDate?'rgba(167,139,250,0.2)':'rgba(167,139,250,0.07)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.4)', borderRadius:'2px', padding:'10px 20px', cursor:callbackDate?'pointer':'not-allowed', fontSize:'12px', marginBottom:'16px', whiteSpace:'nowrap' }}>
                    Set Callback
                  </button>
                </div>
              </div>

              {/* Not Available */}
              <div
                onClick={() => setSelectedAction(selectedAction === 'not_available' ? null : 'not_available')}
                style={{ background: selectedAction === 'not_available' ? 'rgba(138,154,184,0.15)' : 'rgba(138,154,184,0.04)', border:`1px solid ${selectedAction==='not_available'?'rgba(138,154,184,0.5)':'rgba(138,154,184,0.2)'}`, borderRadius:'4px', padding:'14px 18px', cursor:'pointer', transition:'all 0.15s' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'22px' }}>📵</span>
                  <div>
                    <div style={{ color:'#8a9ab8', fontWeight:'bold', fontSize:'14px' }}>Not Available</div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>Log a failed contact attempt.</div>
                  </div>
                </div>
                {selectedAction === 'not_available' && (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop:'12px' }}>
                    <textarea
                      value={notAvailableNote}
                      onChange={e => setNotAvailableNote(e.target.value)}
                      rows={2}
                      placeholder="Optional note…"
                      style={{ ...inp, resize:'vertical', marginBottom:'10px', fontSize:'12px' }}
                    />
                    <button onClick={handleNotAvailable}
                      style={{ background:'rgba(138,154,184,0.2)', color:'#8a9ab8', border:'1px solid rgba(138,154,184,0.4)', borderRadius:'2px', padding:'9px 20px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                      Save — Not Available
                    </button>
                  </div>
                )}
              </div>

              {/* Not Interested */}
              <div
                onClick={() => setSelectedAction(selectedAction === 'not_interested' ? null : 'not_interested')}
                style={{ background: selectedAction === 'not_interested' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.04)', border:`1px solid ${selectedAction==='not_interested'?'rgba(239,68,68,0.5)':'rgba(239,68,68,0.2)'}`, borderRadius:'4px', padding:'14px 18px', cursor:'pointer', transition:'all 0.15s' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'22px' }}>❌</span>
                  <div>
                    <div style={{ color:'#ef4444', fontWeight:'bold', fontSize:'14px' }}>Not Interested</div>
                    <div style={{ color:'#6b7280', fontSize:'12px' }}>Permanently remove from the list.</div>
                  </div>
                </div>
                {selectedAction === 'not_interested' && (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop:'12px' }}>
                    <textarea
                      value={notInterestedNote}
                      onChange={e => setNotInterestedNote(e.target.value)}
                      rows={2}
                      placeholder="Optional note before removing…"
                      style={{ ...inp, resize:'vertical', marginBottom:'10px', fontSize:'12px' }}
                    />
                    <button onClick={handleNotInterested}
                      style={{ background:'rgba(239,68,68,0.2)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.5)', borderRadius:'2px', padding:'9px 20px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                      Save — Remove Lead
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
    <RemindersFloatingPanel reminders={reminders} onClearReminder={clearReminder} />
    {showCallLog && (
      <CallLogPanel
        onClose={() => setShowCallLog(false)}
        onOpenLead={(leadId) => { setShowCallLog(false); /* caller handles navigation */ }}
      />
    )}
    </>
  );
}