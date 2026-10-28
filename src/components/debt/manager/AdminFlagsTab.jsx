/**
 * AdminFlagsTab.jsx — Flags tab for the Admin panel (admin/super_admin only).
 * Toggle ALL features per user: AI tools, tab access, compliance, call features, manager controls.
 * Replaces the limited dialer-permissions editor with a comprehensive feature-flag system.
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', super_manager: 'Super Manager', manager: 'Manager', dialer: 'Dialer' };
const ROLE_COLORS = { super_admin: '#f472b6', admin: '#60a5fa', super_manager: '#34d399', manager: '#a78bfa', dialer: '#f59e0b' };

// Comprehensive feature flags — grouped
const FLAG_GROUPS = [
  {
    group: 'Live Call AI',
    flags: [
      { key: 'liveAIEnabled', label: 'AI Assistant (Master)' },
      { key: 'liveQA', label: 'Q&A Engine' },
      { key: 'liveCoach', label: 'Coach Engine' },
      { key: 'liveIntent', label: 'Intent Engine' },
    ],
  },
  {
    group: 'BOB Training AI',
    flags: [
      { key: 'bobAIEnabled', label: 'AI Assistant (Master)' },
      { key: 'bobQA', label: 'Q&A Engine' },
      { key: 'bobCoach', label: 'Coach Engine' },
      { key: 'bobIntent', label: 'Intent Engine' },
    ],
  },
  {
    group: 'Tab Access',
    flags: [
      { key: 'tabLiveCall', label: 'Live Call Tab' },
      { key: 'tabCalls', label: 'Calls Tab' },
      { key: 'tabBob', label: 'BOB Training Tab' },
      { key: 'tabPitches', label: 'Pitches Tab' },
      { key: 'tabKB', label: 'Knowledge Base Tab' },
      { key: 'tabKBChat', label: 'AI KB Chat Tab' },
      { key: 'tabProfile', label: 'User Profiles Tab' },
      { key: 'tabCompliance', label: 'Compliance Tab' },
    ],
  },
  {
    group: 'Call Features',
    flags: [
      { key: 'canStartCall', label: 'Can Start Calls' },
      { key: 'canEndCall', label: 'Can End Calls' },
      { key: 'canEditLead', label: 'Can Edit Lead Profiles' },
      { key: 'canDeletePitch', label: 'Can Delete Pitches' },
    ],
  },
  {
    group: 'Compliance',
    flags: [
      { key: 'complianceVisible', label: 'Compliance Feature Visible' },
      { key: 'complianceSelfView', label: 'Can View Own Compliance' },
    ],
  },
];

const ALL_FLAG_KEYS = FLAG_GROUPS.flatMap(g => g.flags.map(f => f.key));

// Default: everything on
const DEFAULT_FLAGS = ALL_FLAG_KEYS.reduce((acc, k) => { acc[k] = true; return acc; }, {});

export default function AdminFlagsTab() {
  const { user, sessionUserId, sessionToken, isSuperAdmin } = useDebtCoachAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = useCallback(async () => {
    setError('');
    try {
      const res = await base44.functions.invoke('debtCoachAuth', { action: 'listUsers', sessionUserId, sessionToken });
      const data = res?.data || res;
      if(data?.error)throw new Error(data.error);
      if(!Array.isArray(data?.users))throw new Error('User list unavailable.');
      setUsers(data.users.filter(u => u.role !== 'super_admin'));
    } catch(e) {setError(e?.message||'Unable to load users.');}
    setLoading(false);
  }, [sessionUserId, sessionToken]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const selectUser = (u) => {
    setSelectedId(u.id);
    setSuccess('');setError('');
    let parsed = {};
    try { parsed = JSON.parse(u.aiSettingsJson || '{}'); } catch {}
    // Merge with defaults so all flags exist
    setFlags({ ...DEFAULT_FLAGS, ...parsed });
  };

  const selectedUser = users.find(u => u.id === selectedId);

  const toggle = (key) => {setSuccess('');setFlags(prev => ({ ...prev, [key]: !prev[key] }));};

  const setAll = (val) => {setSuccess('');setFlags(prev => ({...prev,...ALL_FLAG_KEYS.reduce((acc,k)=>{acc[k]=val;return acc;},{})}));};

  const save = async () => {
    if (!selectedUser) return;
    setSaving(true);setSuccess('');setError('');
    try {
      const res = await base44.functions.invoke('debtCoachAuth', {
        action: 'updateUser', sessionUserId, sessionToken,
        targetUserId: selectedUser.id,
        updates: { aiSettingsJson: JSON.stringify(flags) },
      });
      const data=res?.data||res;
      if(data?.error)throw new Error(data.error);
      // Confirm persistence: the existing API has previously returned success
      // without handling aiSettingsJson. Never show a false "saved" status.
      const check=await base44.functions.invoke('debtCoachAuth',{action:'listUsers',sessionUserId,sessionToken});
      const refreshed=check?.data||check;
      if(refreshed?.error)throw new Error(refreshed.error);
      const latest=(refreshed?.users||[]).find(u=>u.id===selectedUser.id);
      if(!latest)throw new Error('Could not verify the saved user settings.');
      let persisted={};try{persisted=JSON.parse(latest.aiSettingsJson||'{}');}catch{}
      if(ALL_FLAG_KEYS.some(key=>persisted[key] !== !!flags[key])) {
        throw new Error('The server acknowledged this request but did not persist all feature flags. The change is NOT confirmed.');
      }
      setUsers((refreshed.users||[]).filter(u=>u.role!=='super_admin'));
      setSuccess(`Verified feature settings for ${selectedUser.username}.`);
    } catch(e) {setError(e?.message||'Could not save feature flags.');}
    finally{setSaving(false);}
  };

  if (loading) return <div style={{color:'#99b8b6',textAlign:'center',padding:30}}>Loading access settings…</div>;

  return (<div className="dcc-admin-flags">
    <div style={{display:'flex',gap:9,justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
      <div><strong style={{color:'#e5c780',fontSize:12}}>Feature access</strong><p style={{fontSize:11,color:'#9cafb6',margin:'4px 0'}}>Select an account, review its settings, then verify any changes.</p></div>
      <label style={{display:'flex',alignItems:'center',gap:7,border:'1px solid #375862',borderRadius:7,padding:'6px 9px',color:'#9ebaba',background:'#10202d'}}><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Find users by name" placeholder="Find an account…" style={{background:'transparent',border:0,color:'#e1eae2',outline:0,fontSize:11,padding:4}}/></label>
    </div>
    {error&&<div role="alert" style={{display:'flex',alignItems:'center',gap:7,padding:10,background:'rgba(134,39,42,.14)',border:'1px solid #91514d',color:'#ffd0bc',fontSize:11,borderRadius:8,marginBottom:9}}><AlertTriangle size={14}/>{error}</div>}
    {success&&<div role="status" style={{display:'flex',alignItems:'center',gap:7,padding:10,background:'rgba(34,137,94,.13)',border:'1px solid #487d61',color:'#a9ebca',fontSize:11,borderRadius:8,marginBottom:9}}><CheckCircle2 size={14}/>{success}</div>}
    <div className="dcc-admin-flags-grid" style={{ display: 'grid',gridTemplateColumns: 'minmax(220px,260px) minmax(0,1fr)',gap:12,alignItems:'start' }}>
      {/* User list */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>👥 Select User</div>
        </div>
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {users.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No users.</div> :
           users.filter(u=>[u.username,u.email,u.role].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase()))).map(u => {
            const rc = ROLE_COLORS[u.role] || '#6b7280';
            return (
              <button key={u.id} onClick={() => selectUser(u)} style={{ width: '100%', background: selectedId === u.id ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ color: selectedId === u.id ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: 'bold' }}>{u.username}</div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ color: rc, fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>{ROLE_LABELS[u.role]}</span>
                  {!u.isActive && <span style={{ color: '#ef4444', fontSize: '9px' }}>INACTIVE</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flags editor */}
      {selectedUser ? (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🚩 Feature Flags — {selectedUser.username}</div>
              <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>Toggle any feature on or off for this user. Changes apply on their next page load.</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setAll(true)} style={{ background: 'rgba(16,185,129,0.1)', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>All ON</button>
              <button onClick={() => setAll(false)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>All OFF</button>
            </div>
          </div>

          {FLAG_GROUPS.map(grp => (
            <div key={grp.group} style={{ marginBottom: '16px' }}>
              <div style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{grp.group}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {grp.flags.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', background: flags[f.key] ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: '4px', border: `1px solid ${flags[f.key] ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                    <input type="checkbox" checked={!!flags[f.key]} onChange={() => toggle(f.key)} style={{ cursor: 'pointer', accentColor: GOLD }} />
                    <span style={{ color: flags[f.key] ? '#e8e0d0' : '#6b7280', fontSize: '12px' }}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 28px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>
            {saving ? '⏳ Saving…' : '💾 Save Flags'}
          </button>
        </div>
      ) : (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px', fontSize: '13px' }}>Select a user to manage their feature flags.</div>
      )}
    </div>
  </div>);
}