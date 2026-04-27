import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import MigrateLeadModal from './MigrateLeadModal';
import DateTimePicker from '@/components/admin/DateTimePicker';
import LeadEmailTab from './LeadEmailTab';
import ScriptAssistant from './ScriptAssistant';
import ResearchTab from './ResearchTab';
import InvestorWebsiteTab from './InvestorWebsiteTab';
import WebsiteHistoryTab from './WebsiteHistoryTab';
import ZoomBookingModal from '@/components/ZoomBookingModal';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' };

const STATUS_LABELS = {
  lead:               { label: '🔵 Lead',              color: '#60a5fa' },
  prospect:           { label: '🚀 Prospect',           color: '#a78bfa' },
  intro_email_sent:   { label: '📧 Intro Email Sent',   color: '#f59e0b' },
  opened_intro_email: { label: '📬 Opened Intro Email', color: '#4ade80' },
};

const HISTORY_ICONS = {
  call: '📞', not_available: '📵', callback_later: '📅',
  not_interested: '❌', status_change: '🔄', note: '📝', prospect: '🚀',
};

function historyColor(type) {
  const map = { call:'#60a5fa', not_available:'#8a9ab8', callback_later:'#a78bfa', not_interested:'#ef4444', status_change:GOLD, note:'#c4cdd8', prospect:'#a78bfa' };
  return map[type] || '#6b7280';
}

function AccessTab({ lead, onUpdate, onSave }) {
  const GOLD = '#b8933a';
  const [copied, setCopied] = useState('');
  const [editingPortal, setEditingPortal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const username       = lead?.portalPasscode || '';
  const lastNameSlug   = (lead?.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  const portalPassword = username ? `${lastNameSlug}#2026` : '';
  const investorUrl    = username ? `https://investors.rosieai.tech/?code=${encodeURIComponent(username)}` : '';
  const portalUrl      = username ? `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(portalPassword)}` : '';
  const consumerUrl    = username ? `https://www.rosieai.tech?ref=${username}` : '';

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const saveCredentials = async () => {
    if (!newUsername.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      await onSave({ portalPasscode: newUsername.trim().toLowerCase() });
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'note',
        content: `🔑 Access credentials updated. Username: ${newUsername.trim().toLowerCase()}`,
      });
      setSaveMsg('✓ Saved');
      setEditingPortal(false);
      setNewUsername(''); setNewPassword('');
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const inp = { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'monospace', boxSizing:'border-box' };
  const editInp = { ...inp, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(184,147,58,0.3)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {!username ? (
        <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'6px', padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:'28px', marginBottom:'8px' }}>💼</div>
          <div style={{ color:'#f59e0b', fontSize:'13px', marginBottom:'6px' }}>No credentials yet</div>
          <div style={{ color:'#6b7280', fontSize:'11px', lineHeight:1.6 }}>
            Click <strong style={{ color:'#60a5fa' }}>Investor Site Access</strong> in the header to generate the investor site code and consumer URL and send the email.<br/>
            Click <strong style={{ color:'#a78bfa' }}>Portal Access</strong> to generate portal credentials and send the portal email.
          </div>
        </div>
      ) : (
        <>
          {/* ── INVESTOR INFO SITE ── */}
          <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'6px', padding:'14px 16px' }}>
            <div style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>💼 Investor Info Site — investors.rosieai.tech</div>
            <div style={{ marginBottom:'10px' }}>
              <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Personal Access Code</div>
              <div style={{ display:'flex', gap:'6px' }}>
                <input readOnly value={username} style={inp} />
                <button onClick={() => copy(username, 'code')} style={{ background:'rgba(255,255,255,0.06)', color: copied==='code' ? '#4ade80' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                  {copied==='code' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Access URL</div>
              <div style={{ display:'flex', gap:'6px' }}>
                <input readOnly value={investorUrl} style={{ ...inp, fontSize:'10px' }} />
                <button onClick={() => copy(investorUrl, 'invUrl')} style={{ background:'rgba(96,165,250,0.1)', color: copied==='invUrl' ? '#4ade80' : '#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                  {copied==='invUrl' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* ── PORTAL CREDENTIALS ── */}
          <div style={{ background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'6px', padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <div style={{ color:'#a78bfa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>🔐 Investor Portal — investors.rosieai.tech/portal</div>
              <button onClick={() => { setEditingPortal(e => !e); setNewUsername(username); setNewPassword(portalPassword); }}
                style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>
                {editingPortal ? 'Cancel' : '✏️ Edit'}
              </button>
            </div>
            {!editingPortal ? (
              <>
                <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                  <div style={{ flex:1, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'7px 10px' }}>
                    <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Username</div>
                    <div style={{ color:GOLD, fontFamily:'monospace', fontSize:'12px' }}>{username}</div>
                  </div>
                  <div style={{ flex:1, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'7px 10px' }}>
                    <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Password</div>
                    <div style={{ color:'#e8e0d0', fontFamily:'monospace', fontSize:'12px' }}>{portalPassword}</div>
                  </div>
                  <button onClick={() => copy(`Username: ${username}
Password: ${portalPassword}
Portal: https://investors.rosieai.tech/portal-login`, 'creds')}
                    style={{ background:'rgba(255,255,255,0.05)', color: copied==='creds' ? '#4ade80' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 10px', cursor:'pointer', fontSize:'10px', whiteSpace:'nowrap' }}>
                    {copied==='creds' ? '✓' : 'Copy All'}
                  </button>
                </div>
                <div>
                  <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Portal Auto-Login URL</div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <input readOnly value={portalUrl} style={{ ...inp, fontSize:'10px' }} />
                    <button onClick={() => copy(portalUrl, 'portalUrl')} style={{ background:'rgba(167,139,250,0.1)', color: copied==='portalUrl' ? '#4ade80' : '#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                      {copied==='portalUrl' ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ marginBottom:'10px' }}>
                  <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Username</div>
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)} style={editInp} />
                </div>
                <div style={{ marginBottom:'12px' }}>
                  <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Password (auto-derived from lastname#2026 if blank)</div>
                  <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={portalPassword} style={editInp} />
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <button onClick={saveCredentials} disabled={saving}
                    style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:'#0a0f1e', border:'none', borderRadius:'4px', padding:'8px 18px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {saveMsg && <span style={{ fontSize:'11px', color: saveMsg.startsWith('✓') ? '#4ade80' : '#ef4444' }}>{saveMsg}</span>}
                </div>
              </div>
            )}
          </div>

          {/* ── CONSUMER SITE ── */}
          <div>
            <div style={{ color:'#6b7280', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>🌐 Consumer Site Tracking URL</div>
            <div style={{ display:'flex', gap:'6px' }}>
              <input readOnly value={consumerUrl} style={{ ...inp, fontSize:'10px' }} />
              <button onClick={() => copy(consumerUrl, 'conUrl')} style={{ background:'rgba(167,139,250,0.1)', color: copied==='conUrl' ? '#4ade80' : '#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                {copied==='conUrl' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function OverviewTab({ editLead, setEditLead, saving, saveMsg, saveProfile, updateStatus, quickNote, setQuickNote, addQuickNote, addingNote, history, loading, isArchived }) {
  const [editing, setEditing] = useState(false);
  const GOLD = '#b8933a';
  const DARK = '#0a0f1e';
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
  const ls = { display:'block', color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'5px' };

  const STATUS_LABELS = {
    lead:               { label: '🔵 Lead',              color: '#60a5fa' },
    prospect:           { label: '🚀 Prospect',           color: '#a78bfa' },
    intro_email_sent:   { label: '📧 Intro Email Sent',   color: '#f59e0b' },
    opened_intro_email: { label: '📬 Opened Intro Email', color: '#4ade80' },
  };
  const HISTORY_ICONS = { call:'📞', not_available:'📵', callback_later:'📅', not_interested:'❌', status_change:'🔄', note:'📝', prospect:'🚀', connected:'🟢' };
  const historyColor = (type) => ({ call:'#60a5fa', not_available:'#8a9ab8', callback_later:'#a78bfa', not_interested:'#ef4444', status_change:GOLD, note:'#c4cdd8', prospect:'#a78bfa', connected:'#4ade80' })[type] || '#6b7280';

  const InfoRow = ({ icon, label, value, color }) => (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize:'16px', flexShrink:0 }}>{icon}</span>
      <div style={{ minWidth:0 }}>
        <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'1px' }}>{label}</div>
        <div style={{ color: color || '#e8e0d0', fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value || <span style={{ color:'#4a5568', fontStyle:'italic' }}>—</span>}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

      {/* Status + Edit row */}
      {!isArchived && <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', gap:'6px' }}>
          {['lead','prospect','intro_email_sent','opened_intro_email'].map(s => {
            const si = STATUS_LABELS[s];
            if (!si) return null;
            const active = editLead.status === s;
            return (
              <button key={s} onClick={() => updateStatus(s, 'status_change', `Status changed to ${s}`)}
                style={{ padding:'6px 16px', border:`1px solid ${active ? si.color : 'rgba(255,255,255,0.1)'}`, borderRadius:'20px', background:active ? `${si.color}22` : 'transparent', color:active ? si.color : '#6b7280', cursor:'pointer', fontSize:'12px', fontWeight:active?'bold':'normal', transition:'all 0.15s' }}>
                {si.label}
              </button>
            );
          })}
        </div>
        <button onClick={() => setEditing(e => !e)}
          style={{ background: editing ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.05)', color: editing ? GOLD : '#8a9ab8', border:`1px solid ${editing ? 'rgba(184,147,58,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius:'4px', padding:'6px 14px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px' }}>
          {editing ? '✕ Cancel Edit' : '✏️ Edit'}
        </button>
      </div>}

      {/* Contact info — view mode */}
      {!editing && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          <InfoRow icon="👤" label="First Name" value={editLead.firstName} />
          <InfoRow icon="👤" label="Last Name" value={editLead.lastName} />
          <InfoRow icon="📞" label="Phone" value={editLead.phone} color="#4ade80" />
          <InfoRow icon="📱" label="Alt Phone" value={editLead.phone2} />
          <InfoRow icon="✉️" label="Email" value={editLead.email} color="#60a5fa" />
          <InfoRow icon="📍" label="State" value={editLead.state} />
          {editLead.address && <div style={{ gridColumn:'1/-1' }}><InfoRow icon="🏠" label="Address" value={editLead.address} /></div>}
          {editLead.bestTimeToCall && <div style={{ gridColumn:'1/-1' }}><InfoRow icon="⏰" label="Best Time to Call" value={editLead.bestTimeToCall} /></div>}
          {editLead.callbackAt && <div style={{ gridColumn:'1/-1' }}><InfoRow icon="📅" label="Callback Scheduled" value={new Date(editLead.callbackAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} color="#a78bfa" /></div>}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 14px' }}>
            {[['firstName','First Name','👤'],['lastName','Last Name','👤'],['phone','Phone','📞'],['phone2','Alt Phone','📱'],['email','Email','✉️'],['state','State','📍']].map(([k,label,icon]) => (
              <div key={k}>
                <label style={ls}>{icon} {label}</label>
                <input value={editLead[k]||''} onChange={e=>setEditLead({...editLead,[k]:e.target.value})} style={inp} placeholder={label} />
              </div>
            ))}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={ls}>🏠 Address</label>
              <input value={editLead.address||''} onChange={e=>setEditLead({...editLead,address:e.target.value})} style={inp} placeholder="Street address…" />
            </div>
            <div>
              <label style={ls}>⏰ Best Time to Call</label>
              <input value={editLead.bestTimeToCall||''} onChange={e=>setEditLead({...editLead,bestTimeToCall:e.target.value})} style={inp} placeholder="e.g. mornings, after 3pm…" />
            </div>
          </div>
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

      {/* Notes & Activity */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'14px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>📋 Notes & Activity</div>
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
        <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'300px', overflowY:'auto', paddingRight:'4px' }}>
          {loading && <p style={{ color:'#6b7280', fontSize:'12px', textAlign:'center', padding:'16px' }}>Loading…</p>}
          {!loading && history.length === 0 && <p style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'20px' }}>No activity yet.</p>}
          {history.map(h => {
            const icon = HISTORY_ICONS[h.type] || '📝';
            const color = historyColor(h.type);
            return (
              <div key={h.id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 10px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:'4px' }}>
                <span style={{ fontSize:'13px', flexShrink:0, marginTop:'1px' }}>{icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                    <span style={{ color, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{h.type.replace(/_/g,' ')}</span>
                    <span style={{ color:'#4a5568', fontSize:'10px', whiteSpace:'nowrap' }}>
                      {h.created_date ? new Date(h.created_date).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''}
                    </span>
                  </div>
                  {h.content && <div style={{ color:'#c4cdd8', fontSize:'12px', marginTop:'2px', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{h.content}</div>}
                  {h.type==='call' && h.callDurationSeconds > 0 && <div style={{ color:'#8a9ab8', fontSize:'11px', marginTop:'2px' }}>⏱ {Math.floor(h.callDurationSeconds/60)}m {h.callDurationSeconds%60}s</div>}
                </div>
              </div>
            );
          })}
        </div>
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
function LeadHistoryTab({ lead, history, onNoteAdded }) {
  const [sub, setSub]         = useState('clientinfo');
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [emails, setEmails]   = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const GOLD = '#b8933a';

  const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '';
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
      await base44.entities.LeadHistory.create({ leadId: lead.id, type: 'note', content: note.trim(), createdBy: 'admin' });
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
                      <span style={{ color, fontSize:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>{h.type.replace(/_/g,' ')}</span>
                      <span style={{ color:'#4a5568', fontSize:'10px' }}>{fmtDT(h.created_date)}</span>
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
                  ['🕐 Last Visit',     lead.lastSiteVisit ? fmtDT(lead.lastSiteVisit) : 'Never',  '#60a5fa'],
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

export default function LeadContactCard({ lead, onClose, onUpdate, onDialNumber, dialerRef, onResume, isDialerPaused, onNextLead, onPrevLead, currentLeadIndex, totalLeads, dialerPanelOpen }) {
  // Archived = migrated to CRM — card is read-only
  const isArchived = !!(lead.migratedToPortal || lead.convertedToInvestorUserId || lead.status === 'converted');
  const [cardExpanded, setCardExpanded] = useState(false);
  const [tab, setTab] = useState('overview');
  const [history, setHistory] = useState([]);
  const [editLead, setEditLead] = useState({ ...lead });
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

  const handleProspect = async () => {
    const note = prospectNote.trim();
    await updateStatus('prospect', 'prospect', `Marked as Prospect${note ? `: ${note}` : ''}`);
    if (note) await logHistory('note', note);
    if (callbackDate) {
      await base44.entities.Lead.update(lead.id, { callbackAt: callbackDate });
      await logHistory('callback_later', `Callback scheduled for ${new Date(callbackDate).toLocaleString()}`);
      setEditLead(prev => ({ ...prev, callbackAt: callbackDate }));
    }
    setProspectNote('');
    setCallbackDate('');
  };

  const handleNotAvailable = async () => {
    const note = notAvailableNote.trim();
    await updateStatus('not_available', 'not_available', `Not available${note ? ` — ${note}` : ` — ${new Date().toLocaleString()}`}`);
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
    await updateStatus('callback_later', 'callback_later', `Callback scheduled for ${new Date(callbackDate).toLocaleString()}`, { callbackAt: callbackDate });
    setCallbackDate('');
  };

  const saveProfile = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.Lead.update(lead.id, {
        firstName: editLead.firstName, lastName: editLead.lastName,
        email: editLead.email, phone: editLead.phone, phone2: editLead.phone2,
        state: editLead.state, address: editLead.address, bestTimeToCall: editLead.bestTimeToCall,
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
    {showZoom && (
      <div style={{ position:'fixed', inset:0, zIndex:99999 }}>
        <ZoomBookingModal isOpen={showZoom} onClose={() => setShowZoom(false)} buttonLabel="Book Zoom Call" zoomUrl="https://scheduler.zoom.us/stephani-sterling" />
      </div>
    )}
    <div style={{ position:'fixed', top:0, left:0, right: (dialerPanelOpen && !cardExpanded) ? '340px' : 0, bottom:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9000, padding: cardExpanded ? '0' : '16px' }}>
      <div style={{ background:'#0d1b2a', border:`1px solid ${isArchived ? 'rgba(245,158,11,0.3)' : 'rgba(184,147,58,0.3)'}`, borderRadius:'4px', width:'100%', maxWidth: cardExpanded ? '100%' : '820px', maxHeight: cardExpanded ? '100%' : '92vh', height: cardExpanded ? '100%' : undefined, display:'flex', flexDirection:'column', boxShadow:'0 40px 120px rgba(0,0,0,0.9)', transition:'all 0.2s ease' }}>

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
          {/* Row 1: Identity + close */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'46px', height:'46px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}55,${GOLD}22)`, border:`2px solid ${GOLD}77`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'19px', fontWeight:'bold', color:GOLD, flexShrink:0 }}>
                {fullName[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                  <span style={{ color:'#e8e0d0', fontSize:'18px', fontFamily:'Georgia,serif', fontWeight:'normal' }}>{fullName}</span>
                  <span style={{ background:`${statusInfo.color}20`, color:statusInfo.color, border:`1px solid ${statusInfo.color}55`, borderRadius:'12px', padding:'2px 10px', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>{statusInfo.label}</span>
                  {editLead.engagementScore > 0 && <span style={{ color:GOLD, fontSize:'11px', background:'rgba(184,147,58,0.12)', border:'1px solid rgba(184,147,58,0.25)', borderRadius:'12px', padding:'2px 8px' }}>⭐ {editLead.engagementScore}</span>}
                </div>
                <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'3px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  {lead.email && <span>{lead.email}</span>}
                  {(lead.phone || editLead.phone) && <span style={{ color:'#8a9ab8' }}>{lead.phone || editLead.phone}</span>}
                  {lead.state && <span style={{ color:GOLD }}>{lead.state}</span>}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
              {/* Nav arrows */}
              {totalLeads > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:'2px' }}>
                  <button onClick={onPrevLead} disabled={currentLeadIndex <= 0} style={{ background:'rgba(255,255,255,0.04)', color: currentLeadIndex <= 0 ? '#2d3748' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'4px 8px', cursor: currentLeadIndex <= 0 ? 'not-allowed' : 'pointer', fontSize:'13px' }}>‹</button>
                  <span style={{ color:'#4a5568', fontSize:'10px', padding:'0 4px' }}>{currentLeadIndex + 1}/{totalLeads}</span>
                  <button onClick={onNextLead} disabled={currentLeadIndex >= totalLeads - 1} style={{ background:'rgba(255,255,255,0.04)', color: currentLeadIndex >= totalLeads - 1 ? '#2d3748' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'4px 8px', cursor: currentLeadIndex >= totalLeads - 1 ? 'not-allowed' : 'pointer', fontSize:'13px' }}>›</button>
                </div>
              )}
              <button onClick={onClose} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#6b7280', cursor:'pointer', fontSize:'18px', width:'32px', height:'32px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          </div>

          {/* Row 2: Action buttons */}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
            {/* Dialer controls when on a call */}
            {isDialerPaused ? (
              <>
                <button onClick={() => dialerRef.current?.hangupActiveCall?.()}
                  style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                  📵 Hang Up
                </button>
                <button onClick={() => { dialerRef.current?.hangupActiveCall?.(); onNextLead?.(); }}
                  style={{ background:'rgba(59,130,246,0.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.3)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                  📵 Next
                </button>
                <button onClick={async () => { await saveProfile?.(); dialerRef.current?.hangupActiveCall?.(); onResume?.(); }}
                  style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', borderRadius:'4px', padding:'6px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                  ▶ Resume & Save
                </button>
                <div style={{ width:'1px', height:'20px', background:'rgba(255,255,255,0.1)', margin:'0 2px' }} />
              </>
            ) : (
              <>
                {(lead.phone || editLead.phone) && !isArchived && (
                  <button onClick={() => onDialNumber && onDialNumber(lead)}
                    style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.35)', borderRadius:'4px', padding:'6px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px' }}>
                    📞 <span>{lead.phone || editLead.phone}</span>
                  </button>
                )}
              </>
            )}

            {/* Activity badges — compact */}
            {editLead.badgeIntroEmailOpened && <span style={{ background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'12px', padding:'3px 8px', fontSize:'10px', color:'#4ade80' }}>🌟 Intro Opened</span>}
            {editLead.badgeEmailOpened && !editLead.badgeIntroEmailOpened && <span style={{ background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'12px', padding:'3px 8px', fontSize:'10px', color:'#4ade80' }}>📬 Email Opened</span>}
            {editLead.badgeConsumerWebsite && <span style={{ background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'12px', padding:'3px 8px', fontSize:'10px', color:'#60a5fa' }}>🌐 Consumer</span>}
            {editLead.badgeInvestorPage && <span style={{ background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'12px', padding:'3px 8px', fontSize:'10px', color:'#a78bfa' }}>💼 Investor Page</span>}

            <div style={{ flex:1 }} />

            {/* Right-side actions */}
            {!isArchived && (
              <button onClick={sendEmail} disabled={sendingEmail || !editLead.email}
                title="Sends investor site access code + consumer ref URL (template 7949342)"
                style={{ background:'rgba(96,165,250,0.12)', color: editLead.email ? '#60a5fa' : '#4a5568', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'4px', padding:'6px 12px', cursor: editLead.email ? 'pointer' : 'not-allowed', fontSize:'11px', fontWeight:'bold', opacity: editLead.email ? 1 : 0.4, whiteSpace:'nowrap' }}>
                {sendingEmail ? '⏳ Sending…' : '💼 Investor Site Access'}
              </button>
            )}
            {!isArchived && (
              <button onClick={sendPortalEmail} disabled={sendingPortalEmail || !editLead.email}
                title="Sends portal username + password (template 7951003)"
                style={{ background:'rgba(167,139,250,0.12)', color: editLead.email ? '#a78bfa' : '#4a5568', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'6px 12px', cursor: editLead.email ? 'pointer' : 'not-allowed', fontSize:'11px', fontWeight:'bold', opacity: editLead.email ? 1 : 0.4, whiteSpace:'nowrap' }}>
                {sendingPortalEmail ? '⏳ Sending…' : '🔐 Portal Access'}
              </button>
            )}
            {(emailMsg || portalEmailMsg) && <span style={{ fontSize:'10px', color: (emailMsg||portalEmailMsg).startsWith('Error') ? '#ef4444' : '#4ade80' }}>{emailMsg || portalEmailMsg}</span>}
            {!isArchived && (
              <button onClick={() => setShowZoom(true)}
                style={{ background:'rgba(255,255,255,0.05)', color:'#c4cdd8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px' }}>
                📅 Book Call
              </button>
            )}
            {!isArchived && (
              <button onClick={() => setShowMigrate(true)}
                style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', border:'none', borderRadius:'4px', padding:'6px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                🚀 Migrate
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {[['overview','Overview'],['history','History'],['actions','Actions'],['access','Portal Access'],['sitestats','Site Stats'],['research','Research'],['script','Script & AI']].filter(([id]) => !(isArchived && id === 'actions')).map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:'none', border:'none', borderBottom:tab===id?`2px solid ${GOLD}`:'2px solid transparent', color:tab===id?GOLD:'#6b7280', padding:'10px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{label}</button>
          ))}
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
            />
          )}

          {/* ── HISTORY ── */}
          {tab === 'history' && (
            <LeadHistoryTab lead={editLead} history={history} onNoteAdded={loadHistory} />
          )}

          {tab === 'access' && (
            <AccessTab lead={editLead} onUpdate={(updates) => setEditLead(prev => ({ ...prev, ...updates }))} onSave={async (updates) => {
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
            <ScriptAssistant lead={editLead} onExpandCard={() => setCardExpanded(e => !e)} isCardExpanded={cardExpanded} />
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
    </>
  );
}