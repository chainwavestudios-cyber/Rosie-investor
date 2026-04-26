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
  lead:     { label: '🔵 Lead',     color: '#60a5fa' },
  prospect: { label: '🚀 Prospect', color: '#a78bfa' },
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
  const DARK = '#0a0f1e';
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState('');

  const username = lead?.portalPasscode || '';
  const lastNameForUrl = (lead?.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  const sitePassword  = username ? `${lastNameForUrl}#2026` : '';
  // Info site - username only to auto-login
  const investorUrl   = username ? `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(username)}` : '';
  // Portal - full credentials (for admin reference)
  const portalUrl     = username ? `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(sitePassword)}` : '';
  const consumerUrl = username ? `https://www.rosieai.tech?ref=${username}` : '';

  const generate = async () => {
    setGenerating(true);
    try {
      // Build username: firstname + last 4 of phone
      const nameSlug = (lead.firstName || 'user').toLowerCase().replace(/[^a-z]/g, '');
      const last4 = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
      const newUsername = `${nameSlug}${last4}`;
      // Password = lastname#2026 all lowercase
      const lastNameSlug = (lead.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
      const newPassword = `${lastNameSlug}#2026`;

      // Create InvestorUser so they can log in
      const hashRes = await fetch(
        'https://investors.rosieai.tech/api/apps/69cd2741578c9b5ce655395b/functions/hashPassword',
        { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'hash', password: newPassword }) }
      );
      const hashData = await hashRes.json();
      const hashedPassword = hashData?.hash || newPassword;

      const existing = await base44.entities.InvestorUser.filter({ username: newUsername });
      if (existing?.length > 0) {
        await base44.entities.InvestorUser.update(existing[0].id, {
          email: lead.email || '', name: `${lead.firstName} ${lead.lastName}`, password: hashedPassword, leadId: lead.id,
        });
      } else {
        await base44.entities.InvestorUser.create({
          username: newUsername, email: lead.email || '', name: `${lead.firstName} ${lead.lastName}`,
          password: hashedPassword, role: 'guest', status: 'info_only', siteAccess: 'info_only', leadId: lead.id,
        });
      }

      // Save to lead
      await onSave({ portalPasscode: newUsername });

      // Log it
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'note',
        content: `🔑 Access credentials generated. Username: ${newUsername}`,
      });
    } catch(e) { console.error(e); }
    setGenerating(false);
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const inp = { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'monospace', boxSizing:'border-box', cursor:'text' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* Generate button */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color:'#e8e0d0', fontSize:'14px', marginBottom:'3px' }}>Access Credentials</div>
          <div style={{ color:'#6b7280', fontSize:'11px' }}>Generate a unique username and tracking links for this lead</div>
        </div>
        <button onClick={generate} disabled={generating}
          style={{ background: generating ? 'rgba(184,147,58,0.2)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'6px', padding:'9px 18px', cursor: generating ? 'not-allowed' : 'pointer', fontWeight:'bold', fontSize:'12px', letterSpacing:'1px', whiteSpace:'nowrap' }}>
          {generating ? '⏳ Generating…' : username ? '🔄 Regenerate' : '⚡ Generate Access'}
        </button>
      </div>

      {!username && (
        <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'6px', padding:'14px 16px', color:'#f59e0b', fontSize:'12px', textAlign:'center' }}>
          No credentials yet — click Generate Access to create them
        </div>
      )}

      {username && (
        <>
          {/* Username */}
          <div>
            <div style={{ color:'#6b7280', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>🔑 Username (investors.rosieai.tech)</div>
            <div style={{ display:'flex', gap:'6px' }}>
              <input readOnly value={username} style={inp} />
              <button onClick={() => copy(username, 'username')}
                style={{ background:'rgba(255,255,255,0.06)', color: copied==='username' ? '#4ade80' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                {copied==='username' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'4px' }}>Password is the same as username</div>
          </div>

          {/* Investor site URL - username only */}
          <div>
            <div style={{ color:'#6b7280', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>💼 Investors Site URL (Username Auto-Fill)</div>
            <div style={{ display:'flex', gap:'6px' }}>
              <input readOnly value={investorUrl} style={{ ...inp, fontSize:'10px' }} />
              <button onClick={() => copy(investorUrl, 'invUrl')}
                style={{ background:'rgba(96,165,250,0.1)', color: copied==='invUrl' ? '#4ade80' : '#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                {copied==='invUrl' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'4px' }}>Username pre-filled — they enter it to access the site</div>
          </div>

          {/* Portal credentials - admin reference */}
          <div>
            <div style={{ color:'#6b7280', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>🔐 Portal Credentials (Admin Reference)</div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
              <div style={{ flex:1, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'7px 10px' }}>
                <div style={{ color:'#4a5568', fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Username</div>
                <div style={{ color:GOLD, fontFamily:'monospace', fontSize:'12px' }}>{username}</div>
              </div>
              <div style={{ flex:1, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'7px 10px' }}>
                <div style={{ color:'#4a5568', fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Password</div>
                <div style={{ color:'#e8e0d0', fontFamily:'monospace', fontSize:'12px' }}>{sitePassword}</div>
              </div>
              <button onClick={() => copy(`Username: ${username}
Password: ${sitePassword}`, 'creds')}
                style={{ background:'rgba(255,255,255,0.05)', color: copied==='creds' ? '#4ade80' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 10px', cursor:'pointer', fontSize:'10px', whiteSpace:'nowrap' }}>
                {copied==='creds' ? '✓' : 'Copy'}
              </button>
            </div>
            <div style={{ color:'#4a5568', fontSize:'10px' }}>Portal password = lastname#2026 · Not shared with lead until migrated</div>
          </div>

          {/* Consumer site ref URL */}
          <div>
            <div style={{ color:'#6b7280', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>🌐 Consumer Site Referral URL</div>
            <div style={{ display:'flex', gap:'6px' }}>
              <input readOnly value={consumerUrl} style={{ ...inp, fontSize:'10px' }} />
              <button onClick={() => copy(consumerUrl, 'conUrl')}
                style={{ background:'rgba(167,139,250,0.1)', color: copied==='conUrl' ? '#4ade80' : '#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                {copied==='conUrl' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'4px' }}>Tracks their visits to rosieai.tech</div>
          </div>

          {/* Status */}
          <div style={{ background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'6px', padding:'10px 14px', display:'flex', gap:'10px', alignItems:'center' }}>
            <span style={{ fontSize:'18px' }}>✅</span>
            <div>
              <div style={{ color:'#4ade80', fontSize:'12px', fontWeight:'bold' }}>Access Active</div>
              <div style={{ color:'#6b7280', fontSize:'10px' }}>Portal account exists · tracking enabled</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OverviewTab({ editLead, setEditLead, saving, saveMsg, saveProfile, updateStatus, quickNote, setQuickNote, addQuickNote, addingNote, history, loading }) {
  const [editing, setEditing] = useState(false);
  const GOLD = '#b8933a';
  const DARK = '#0a0f1e';
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
  const ls = { display:'block', color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'5px' };

  const STATUS_LABELS = {
    lead:     { label: '🔵 Lead',     color: '#60a5fa' },
    prospect: { label: '🚀 Prospect', color: '#a78bfa' },
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', gap:'6px' }}>
          {['lead','prospect'].map(s => {
            const si = STATUS_LABELS[s];
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
      </div>

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
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          <input value={quickNote} onChange={e=>setQuickNote(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&quickNote.trim()) addQuickNote(); }}
            placeholder="Add a note and press Enter or Save…"
            style={{ ...inp, flex:1 }} />
          <button onClick={addQuickNote} disabled={!quickNote.trim()||addingNote}
            style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', padding:'8px 16px', cursor:'pointer', fontSize:'12px', whiteSpace:'nowrap' }}>
            Save
          </button>
        </div>
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

export default function LeadContactCard({ lead, onClose, onUpdate, onDialNumber, dialerRef, onResume, isDialerPaused, onNextLead, onPrevLead, currentLeadIndex, totalLeads }) {
  const [tab, setTab] = useState('overview');
  const [history, setHistory] = useState([]);
  const [editLead, setEditLead] = useState({ ...lead });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMigrate, setShowMigrate] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

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
      setEmailMsg('✓ Email sent!');
      await loadHistory();
      onUpdate && onUpdate();
      setTimeout(() => setEmailMsg(''), 3000);
    } catch (e) {
      setEmailMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSendingEmail(false);
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'820px', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 120px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.2)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}44,${GOLD}22)`, border:`2px solid ${GOLD}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
              {fullName[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ color:'#e8e0d0', fontSize:'17px', fontFamily:'Georgia,serif' }}>{fullName}</div>
              <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'1px' }}>{lead.email}{lead.state ? ` · ${lead.state}` : ''}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            {/* Engagement Score Badge */}
            {(editLead.engagementScore > 0) && (
              <div style={{ background:'rgba(184,147,58,0.15)', border:'1px solid rgba(184,147,58,0.4)', borderRadius:'20px', padding:'4px 10px', fontSize:'11px', color:GOLD, fontWeight:'bold' }}>
                ⭐ {editLead.engagementScore} pts
              </div>
            )}
            {/* Activity Badges */}
            {editLead.badgeEmailOpened && <span title="Email Opened" style={{ background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'20px', padding:'3px 8px', fontSize:'10px', color:'#4ade80' }}>📬 Email Opened</span>}
            {editLead.badgeConsumerWebsite && <span title="Visited Consumer Website" style={{ background:'rgba(96,165,250,0.15)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'20px', padding:'3px 8px', fontSize:'10px', color:'#60a5fa' }}>🌐 Consumer Site</span>}
            {editLead.badgeInvestorPage && <span title="Visited Investor Page" style={{ background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:'20px', padding:'3px 8px', fontSize:'10px', color:'#a78bfa' }}>💼 Investor Page</span>}

            {/* Send Email */}
            <button onClick={sendEmail} disabled={sendingEmail || !editLead.email}
              style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'7px 14px', cursor: editLead.email ? 'pointer' : 'not-allowed', fontSize:'11px', fontWeight:'bold', opacity: editLead.email ? 1 : 0.5 }}>
              {sendingEmail ? '⏳ Sending…' : '✉️ Send Email'}
            </button>
            {emailMsg && <span style={{ fontSize:'11px', color: emailMsg.startsWith('Error') ? '#ef4444' : '#4ade80' }}>{emailMsg}</span>}

            <button onClick={() => setShowZoom(true)}
              style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'7px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
              📅 Book Zoom
            </button>
            {isProspect && (
              <button onClick={() => setShowMigrate(true)}
                style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', border:'none', borderRadius:'2px', padding:'7px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px' }}>
                🚀 Migrate to CRM
              </button>
            )}
            {(lead.phone || editLead.phone) && (
              <button onClick={() => onDialNumber && onDialNumber(lead)}
                style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'2px', padding:'7px 14px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                📞 {lead.phone || editLead.phone}
              </button>
            )}
            {/* Lead navigation ‹ 3/47 › */}
            {totalLeads > 1 && (
              <div style={{ display:'flex', alignItems:'center', gap:'3px', marginRight:'4px' }}>
                <button onClick={onPrevLead} disabled={currentLeadIndex <= 0}
                  style={{ background:'rgba(255,255,255,0.05)', color: currentLeadIndex <= 0 ? '#2d3748' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'4px 7px', cursor: currentLeadIndex <= 0 ? 'not-allowed' : 'pointer', fontSize:'14px' }}>‹</button>
                <span style={{ color:'#4a5568', fontSize:'10px', minWidth:'36px', textAlign:'center' }}>{currentLeadIndex + 1}/{totalLeads}</span>
                <button onClick={onNextLead} disabled={currentLeadIndex >= totalLeads - 1}
                  style={{ background:'rgba(255,255,255,0.05)', color: currentLeadIndex >= totalLeads - 1 ? '#2d3748' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'4px 7px', cursor: currentLeadIndex >= totalLeads - 1 ? 'not-allowed' : 'pointer', fontSize:'14px' }}>›</button>
              </div>
            )}

            {/* Dialer controls — show when call active */}
            {isDialerPaused && (
              <div style={{ display:'flex', gap:'5px', marginRight:'4px' }}>
                <button onClick={() => { dialerRef.current?.hangupActiveCall?.(); }}
                  style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                  📵 Hang Up
                </button>
                <button onClick={() => { dialerRef.current?.hangupActiveCall?.(); onNextLead?.(); }}
                  style={{ background:'rgba(59,130,246,0.15)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.35)', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                  📵 → Next
                </button>
                <button onClick={async () => { await saveProfile?.(); dialerRef.current?.hangupActiveCall?.(); onResume?.(); }}
                  style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', boxShadow:'0 0 10px rgba(74,222,128,0.25)' }}>
                  ▶ Resume & Save
                </button>
              </div>
            )}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#6b7280', cursor:'pointer', fontSize:'20px', width:'34px', height:'34px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {[['overview','👤 Overview'],['actions','⚡ Actions'],['email','✉️ Emails'],['access','🔑 Access'],['invsite','💼 Inv. Site'],['research','🔍 Research'],['script','📝 Script']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:'none', border:'none', borderBottom:tab===id?`2px solid ${GOLD}`:'2px solid transparent', color:tab===id?GOLD:'#6b7280', padding:'11px 20px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>{label}</button>
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
            />
          )}

          {/* ── EMAILS ── */}
          {tab === 'email' && (
            <LeadEmailTab lead={editLead} onUpdate={() => { onUpdate && onUpdate(); }} />
          )}

          {tab === 'website' && (
            <WebsiteHistoryTab lead={editLead} />
          )}

          {tab === 'access' && (
            <AccessTab lead={editLead} onUpdate={(updates) => setEditLead(prev => ({ ...prev, ...updates }))} onSave={async (updates) => {
              try {
                await base44.entities.Lead.update(lead.id, updates);
                setEditLead(prev => ({ ...prev, ...updates }));
              } catch(e) { console.error(e); }
            }} />
          )}

          {tab === 'invsite' && (
            <InvestorWebsiteTab lead={editLead} />
          )}

          {tab === 'research' && (
            <ResearchTab lead={editLead} />
          )}

          {tab === 'script' && (
            <ScriptAssistant lead={editLead} />
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