/**
 * Debt Call Coach / Admin — compact, searchable account directory.
 * Keeps existing debtCoachAuth actions and role gating.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import AdminFlagsTab from '@/components/debt/manager/AdminFlagsTab';
import QAReviewTab from '@/components/debt/QAReviewTab';
import AIScriptBuilderTab from '@/components/debt/AIScriptBuilderTab';
import {
  UsersRound, ShieldCheck, BookOpenCheck, WandSparkles, UserPlus,
  RefreshCw, Search, Filter, UserRound, ChevronDown, ChevronUp,
  CheckCircle2, CircleOff, KeyRound, SlidersHorizontal, Trash2,
  X, Save, AlertTriangle, BadgeCheck, Mail, LockKeyhole, LoaderCircle
} from 'lucide-react';
import './DebtCoachAdminPanel.css';

const TABS=[
  {id:'users',label:'Team & access',Icon:UsersRound},
  {id:'flags',label:'Feature flags',Icon:ShieldCheck},
  {id:'qareview',label:'Q&A learning',Icon:BookOpenCheck},
  {id:'aibuilder',label:'AI script builder',Icon:WandSparkles},
];
const ROLE_LABELS={super_admin:'Super Admin',admin:'Admin',super_manager:'Super Manager',manager:'Manager',dialer:'Dialer',fronter:'Fronter'};
const ROLE_ORDER=['super_admin','admin','super_manager','manager','dialer','fronter'];
const PERMISSION_GROUPS={
  'Live Call':['liveAIAssistant','liveQA','liveCoach','liveIntent'],
  'BOB Training':['bobAIAssistant','bobQA','bobCoach','bobIntent'],
};
const PERMISSION_LABELS={
  liveAIAssistant:'AI Assistant',liveQA:'Live Q&A',liveCoach:'Coach',liveIntent:'Intent',
  bobAIAssistant:'AI Assistant',bobQA:'Training Q&A',bobCoach:'Training Coach',bobIntent:'Training Intent',
};
const safePermissions=(value)=>{
  try {const data=typeof value==='string'?JSON.parse(value||'{}'):value;return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}
  catch {return {};}
};
const initials=(name='')=>String(name).replace(/[^a-z0-9]/gi,'').slice(0,2).toUpperCase()||'U';

export default function DebtCoachAdminPanel(){
  const {user,sessionUserId,sessionToken,isSuperAdmin}=useDebtCoachAuth();
  const [tab,setTab]=useState('users');
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [notice,setNotice]=useState(null);
  const [showCreate,setShowCreate]=useState(false);
  const [search,setSearch]=useState('');
  const [roleFilter,setRoleFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('all');
  const [expandedId,setExpandedId]=useState(null);
  const [editingId,setEditingId]=useState(null);
  const [editPerms,setEditPerms]=useState({});
  const [pendingId,setPendingId]=useState('');
  const [showAll,setShowAll]=useState(false);
  const [setupDelivery,setSetupDelivery]=useState(null);
  const [linkCopied,setLinkCopied]=useState(false);

  const callApi=useCallback(async(payload)=>{
    const response=await base44.functions.invoke('debtCoachAuth',{...payload,sessionUserId,sessionToken});
    const data=response?.data||response;
    if(data?.error)throw new Error(data.error);
    return data;
  },[sessionUserId,sessionToken]);

  const loadUsers=useCallback(async()=>{
    if(!sessionUserId||!sessionToken)return;
    setLoading(true);setLoadError('');
    try {
      const data=await callApi({action:'listUsers'});
      if(!Array.isArray(data?.users))throw new Error('The server returned no user list.');
      setUsers(data.users);
    }catch(e){setLoadError(e?.message||'Could not load users.');}
    finally{setLoading(false);}
  },[callApi,sessionUserId,sessionToken]);
  useEffect(()=>{loadUsers();},[loadUsers]);

  const stats=useMemo(()=>({
    total:users.length,
    active:users.filter(u=>u.isActive).length,
    inactive:users.filter(u=>!u.isActive).length,
    agents:users.filter(u=>['dialer','fronter'].includes(u.role)).length,
    privileged:users.filter(u=>['admin','super_admin','super_manager','manager'].includes(u.role)).length,
  }),[users]);
  const filtered=useMemo(()=>{
    const query=search.trim().toLowerCase();
    return users.filter(u=>(roleFilter==='all'||u.role===roleFilter)
      &&(statusFilter==='all'||(statusFilter==='active'?!!u.isActive:!u.isActive))
      &&(!query||[u.username,u.email,u.role,u.createdBy].some(field=>String(field||'').toLowerCase().includes(query))))
      .sort((a,b)=>Number(!!b.isActive)-Number(!!a.isActive)
        ||(ROLE_ORDER.indexOf(a.role)<0?99:ROLE_ORDER.indexOf(a.role))-(ROLE_ORDER.indexOf(b.role)<0?99:ROLE_ORDER.indexOf(b.role))
        ||String(a.username||'').localeCompare(String(b.username||'')));
  },[users,roleFilter,statusFilter,search]);
  const visible=showAll?filtered:filtered.slice(0,35);

  const perform=async(id,callback,success)=>{
    setPendingId(id);setNotice(null);
    try {
      const response=await callback();
      setNotice({type:'success',text:success||'Changes saved successfully.'});
      await loadUsers();
      return response;
    }catch(e){
      setNotice({type:'error',text:e?.message||'Action failed. No change was confirmed.'});
      return null;
    }finally{setPendingId('');}
  };

  const startEditing=(u)=>{
    setExpandedId(u.id);setEditingId(u.id);setEditPerms(safePermissions(u.permissions));
  };
  const savePermissions=async(u)=>{
    const result=await perform(u.id,()=>callApi({action:'updateUser',targetUserId:u.id,updates:{permissions:editPerms}}),`Permissions updated for ${u.username}.`);
    if(result)setEditingId(null);
  };
  const changeActive=async(u)=>{
    if(u.id===sessionUserId)return;
    if(!window.confirm(`${u.isActive?'Deactivate':'Activate'} ${u.username}?${u.isActive?' They will lose access to this workspace.':''}`))return;
    await perform(u.id,()=>callApi({action:'updateUser',targetUserId:u.id,updates:{isActive:!u.isActive}}),`${u.username} ${u.isActive?'deactivated':'activated'}.`);
  };
  const changeRole=async(u,next)=>{
    if(!next||next===u.role||u.id===sessionUserId)return;
    if(!window.confirm(`Change ${u.username} from ${ROLE_LABELS[u.role]||u.role} to ${ROLE_LABELS[next]||next}? This changes their access permissions.`))return;
    await perform(u.id,()=>callApi({action:'updateUser',targetUserId:u.id,updates:{role:next}}),`${u.username}'s role was updated.`);
  };
  const resetPassword=async(u)=>{
    if(!window.confirm(`Reset the password for ${u.username}? Their current password and sessions will be revoked. ${u.email?'A one-time setup link will be emailed to their recorded address.':'A private one-time setup link will be shown to you.'}`))return;
    setSetupDelivery(null);
    const result=await perform(u.id,()=>callApi({action:'resetPassword',targetUserId:u.id,sendInvite:!!u.email}),`Password reset created for ${u.username}.`);
    if(result){
      setExpandedId(null);
      setLinkCopied(false);
      if(result.setupLink){setSetupDelivery({username:u.username,link:result.setupLink});setNotice({type:'success',text:'Password reset created. The private one-time setup link is shown below; share it securely.'});}
      else if(result.inviteSent)setNotice({type:'success',text:`Reset email sent to ${u.email}. The link is valid for 24 hours.`});
    }
  };
  const deleteUser=async(u)=>{
    if(!isSuperAdmin||u.id===sessionUserId)return;
    if(!window.confirm(`Permanently delete ${u.username}? This cannot be undone.`))return;
    await perform(u.id,()=>callApi({action:'deleteUser',targetUserId:u.id}),`Account ${u.username} deleted.`);
  };
  const mayManage=(u)=>u.id!==sessionUserId && (isSuperAdmin||!['admin','super_admin'].includes(u.role));

  const onAccountCreated=(response)=>{
    setShowCreate(false);loadUsers();setLinkCopied(false);
    if(response?.setupLink){setSetupDelivery({username:response.user?.username||'New user',link:response.setupLink});setNotice({type:'success',text:'Account created. Copy the private one-time setup link below to give the new user.'});}
    else {setSetupDelivery(null);setNotice({type:'success',text:'Account created and setup invitation emailed. The private link is valid for 24 hours.'});}
  };
  return <section className="dcc-admin" aria-label="Debt Call Coach Administration">
    <div className="dcc-admin-heading">
      <div>
        <div className="dcc-admin-eyebrow"><ShieldCheck size={13}/> ACCESS & OPERATIONS</div>
        <h2>Administration</h2>
        <p>Manage your team, AI permissions, approved answers, and script configurations.</p>
      </div>
      <div className="dcc-admin-heading-aside"><LockKeyhole size={14}/> Admin workspace · Restricted access</div>
    </div>

    <nav className="dcc-admin-tabs" role="tablist" aria-label="Administration sections">
      {TABS.map(({id,label,Icon})=><button key={id} type="button" role="tab" aria-selected={tab===id} className={'dcc-admin-tab'+(tab===id?' is-active':'')}
        onClick={()=>{setTab(id);setNotice(null);}}><Icon size={15}/>{label}</button>)}
    </nav>

    {tab==='users'&&<>
      <div className="dcc-admin-stats" aria-label="User overview">
        {[
          ['Total accounts',stats.total,UsersRound],
          ['Active',stats.active,CheckCircle2],
          ['Inactive',stats.inactive,CircleOff],
          ['Agents',stats.agents,UserRound],
          ['Managers & admin',stats.privileged,ShieldCheck],
        ].map(([label,value,Icon])=><div key={label} className="dcc-admin-stat"><Icon size={15}/><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <div className="dcc-admin-tools">
        <div>
          <strong className="dcc-admin-section-label">TEAM DIRECTORY</strong>
          <span className="dcc-admin-count">{filtered.length} of {users.length} people</span>
        </div>
        <div className="dcc-admin-tools-actions">
          <button type="button" className="dcc-admin-btn is-quiet" onClick={loadUsers} disabled={loading} title="Refresh users"><RefreshCw size={14}/> Refresh</button>
          <button type="button" className="dcc-admin-btn is-primary" onClick={()=>setShowCreate(v=>!v)} aria-expanded={showCreate}><UserPlus size={15}/>{showCreate?'Close form':'Add user'}</button>
        </div>
      </div>
      {showCreate&&<CreateUserForm isSuperAdmin={isSuperAdmin} sessionUserId={sessionUserId} sessionToken={sessionToken}
        onCreated={onAccountCreated}/>}
      <div className="dcc-admin-filters">
        <label className="dcc-admin-search"><Search size={15}/>
          <input aria-label="Find users" placeholder="Search name, email, role…" value={search} onChange={e=>{setSearch(e.target.value);setShowAll(false);}}/>
        </label>
        <label className="dcc-admin-filter-label"><Filter size={13}/><select aria-label="Filter by role" value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setShowAll(false);}}>
          <option value="all">All roles</option>{ROLE_ORDER.map(role=><option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
        </select></label>
        <label className="dcc-admin-filter-label"><select aria-label="Filter by account status" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setShowAll(false);}}>
          <option value="all">All statuses</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
        </select></label>
      </div>
      {notice&&<div role="status" className={'dcc-admin-notice is-'+notice.type}>{notice.type==='error'?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>}<span>{notice.text}</span><button aria-label="Dismiss notice" onClick={()=>setNotice(null)}><X size={14}/></button></div>}
      {setupDelivery&&<div className="dcc-admin-setup-delivery" role="group" aria-label="One-time account setup link">
        <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><strong style={{color:'#ebd39a',fontSize:12}}>Private setup link for {setupDelivery.username}</strong><button type="button" className="dcc-admin-btn is-quiet" onClick={()=>{setSetupDelivery(null);setLinkCopied(false);}}>Dismiss link</button></div>
        <p style={{fontSize:11,color:'#b9cfc5',lineHeight:1.5,margin:'8px 0'}}>Valid for 24 hours and one use only. Share directly with the intended person. Anyone holding this link can set that account's password until it expires.</p>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><input readOnly aria-label="One-time account setup link" value={setupDelivery.link} onFocus={e=>e.target.select()} style={{flex:'1 1 250px',minWidth:0,padding:10,background:'#0c1b27',border:'1px solid #395f56',borderRadius:7,color:'#bce4ca',fontSize:11}}/><button className="dcc-admin-btn is-primary" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(setupDelivery.link);setLinkCopied(true);}catch{setLinkCopied(false);}}}>{linkCopied?'Copied':'Copy link'}</button></div>
      </div>}
      {loadError&&<div role="alert" className="dcc-admin-notice is-error"><AlertTriangle size={15}/><span>Could not load the user directory: {loadError}</span><button onClick={loadUsers} className="dcc-admin-btn is-quiet">Retry</button></div>}
      {loading?<div className="dcc-admin-empty"><LoaderCircle size={17}/> Loading the team…</div>:
        filtered.length===0?<div className="dcc-admin-empty">No accounts match your filters.</div>:
        <div className="dcc-admin-list" role="list" aria-label="Team accounts">
          {visible.map(u=>{
            const open=expandedId===u.id;
            const editing=editingId===u.id;
            const allowed=mayManage(u);
            const busy=pendingId===u.id;
            const enabledPermissions=Object.values(safePermissions(u.permissions)).filter(Boolean).length;
            return <div className={'dcc-admin-person'+(!u.isActive?' is-inactive':'')} key={u.id} role="listitem">
              <div className="dcc-admin-person-row">
                <button type="button" className="dcc-admin-person-summary" aria-expanded={open} onClick={()=>setExpandedId(open?null:u.id)}>
                  <span className="dcc-admin-avatar">{initials(u.username)}</span>
                  <span className="dcc-admin-person-identity">
                    <strong>{u.username}</strong>
                    <span title={u.email||'No email recorded'}>{u.email||'No email on file'}</span>
                  </span>
                  <span className={'dcc-admin-role is-'+(u.role||'dialer')}>{ROLE_LABELS[u.role]||u.role}</span>
                  <span className={'dcc-admin-status'+(u.isActive?' is-active':'')}><span className="dcc-admin-status-dot"/>{u.isActive?'Active':'Inactive'}</span>
                  {u.mustResetPassword&&<span className="dcc-admin-reset-label" title="Password change required at next login"><KeyRound size={13}/> Reset required</span>}
                  <span className="dcc-admin-row-trail">{u.role==='dialer'?enabledPermissions+' permissions enabled':u.createdBy?'Added by '+u.createdBy:'Manage account'}</span>
                  {open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
                </button>
                <div className="dcc-admin-row-actions">
                  {allowed&&<button type="button" className="dcc-admin-mini" disabled={!!pendingId} onClick={()=>{setExpandedId(open?null:u.id);}}>{open?'Close':'Manage'}</button>}
                </div>
              </div>
              {open&&<div className="dcc-admin-expanded">
                <div className="dcc-admin-expanded-head">
                  <div><strong>{u.username}</strong><p>{u.role==='dialer'?'Edit this agent’s AI features and account status.':'Manage role and access for this account.'}</p></div>
                  {busy&&<span className="dcc-admin-busy"><LoaderCircle size={14}/> Saving…</span>}
                </div>
                {editing?<>
                  <div className="dcc-admin-permissions">
                    {Object.entries(PERMISSION_GROUPS).map(([group,keys])=><fieldset key={group}><legend>{group}</legend>
                      <div className="dcc-admin-permission-grid">{keys.map(key=><label key={key} className={'dcc-admin-permission'+(editPerms[key]?' is-on':'')}>
                        <input type="checkbox" checked={!!editPerms[key]} onChange={e=>setEditPerms(p=>({...p,[key]:e.target.checked}))}/>
                        {PERMISSION_LABELS[key]}</label>)}</div>
                    </fieldset>)}
                  </div>
                  <div className="dcc-admin-expanded-actions">
                    <button type="button" className="dcc-admin-btn is-primary" disabled={!!pendingId} onClick={()=>savePermissions(u)}><Save size={14}/> Save permissions</button>
                    <button type="button" className="dcc-admin-btn is-quiet" onClick={()=>setEditingId(null)}>Cancel</button>
                  </div>
                </>:<>
                  <div className="dcc-admin-expanded-actions">
                    {u.role==='dialer'&&allowed&&<button type="button" className="dcc-admin-btn" onClick={()=>startEditing(u)}><SlidersHorizontal size={14}/> Edit AI permissions</button>}
                    {allowed&&<button type="button" className="dcc-admin-btn" disabled={!!pendingId} onClick={()=>changeActive(u)}>{u.isActive?<CircleOff size={14}/>:<CheckCircle2 size={14}/>} {u.isActive?'Deactivate':'Activate'}</button>}
                    {allowed&&<button type="button" className="dcc-admin-btn" disabled={!!pendingId} onClick={()=>resetPassword(u)}><KeyRound size={14}/> Reset password</button>}
                    {isSuperAdmin&&u.id!==sessionUserId&&<button type="button" className="dcc-admin-btn is-danger" disabled={!!pendingId} onClick={()=>deleteUser(u)}><Trash2 size={14}/> Delete</button>}
                    {isSuperAdmin&&u.id!==sessionUserId&&u.role!=='super_admin'&&<label className="dcc-admin-role-select">Role
                      <select aria-label={'Role for '+u.username} value={u.role} disabled={!!pendingId} onChange={e=>changeRole(u,e.target.value)}>
                        {ROLE_ORDER.filter(role=>role!=='super_admin').map(role=><option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                      </select></label>}
                  </div>
                  {u.role==='dialer'&&<div className="dcc-admin-perm-summary">{Object.entries(PERMISSION_GROUPS).map(([group,keys])=>
                    <span key={group}><strong>{group}:</strong> {keys.filter(k=>safePermissions(u.permissions)[k]).length}/{keys.length} enabled</span>)}</div>}
                </>}
              </div>}
            </div>;
          })}
          {filtered.length>visible.length&&<button className="dcc-admin-showmore" type="button" onClick={()=>setShowAll(true)}>Show all {filtered.length} accounts <ChevronDown size={14}/></button>}
        </div>}
      <div className="dcc-admin-security-note"><LockKeyhole size={15}/><span>New accounts and resets use unique, expiring, one-time setup links instead of a shared default password. Existing account passwords are not changed unless an administrator explicitly resets them.</span></div>
    </>}
    {tab==='flags'&&<div className="dcc-admin-module"><AdminFlagsTab/></div>}
    {tab==='qareview'&&<div className="dcc-admin-module"><QAReviewTab/></div>}
    {tab==='aibuilder'&&<div className="dcc-admin-module"><AIScriptBuilderTab/></div>}
  </section>;
}
function CreateUserForm({onCreated,sessionUserId,sessionToken,isSuperAdmin}){
  const [username,setUsername]=useState('');
  const [email,setEmail]=useState('');
  const [role,setRole]=useState('dialer');
  const [sendInvite,setSendInvite]=useState(false);
  const [permissions,setPermissions]=useState({});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const save=async(e)=>{
    e.preventDefault();
    if(!username.trim()){setError('Username is required.');return;}
    if(sendInvite&&!email.trim()){setError('An email address is required to send an invitation.');return;}
    setSaving(true);setError('');
    try {
      const response=await base44.functions.invoke('debtCoachAuth',{
        action:'createUser',sessionUserId,sessionToken,
        username:username.trim(),email:email.trim(),role,sendInvite,
        permissions:role==='dialer'?permissions:{},
      });
      const data=response?.data||response;
      if(data?.error)throw new Error(data.error);
      onCreated(data);
    }catch(e){setError(e?.message||'The account could not be created.');}
    finally{setSaving(false);}
  };
  return <form className="dcc-admin-create" onSubmit={save}>
    <div className="dcc-admin-create-title"><UserPlus size={16}/> Add a team member <span>New users must set their own password after first login.</span></div>
    <div className="dcc-admin-create-fields">
      <label>Username <input autoComplete="off" required value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. taylor.s" maxLength={80}/></label>
      <label>Email <input type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} placeholder="person@example.com"/></label>
      <label>Role <select value={role} onChange={e=>setRole(e.target.value)}>
        {ROLE_ORDER.filter(r=>isSuperAdmin||!['admin','super_admin','fronter'].includes(r)).map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select></label>
    </div>
    {role==='dialer'&&<div className="dcc-admin-create-perms">
      <strong>Dialer AI permissions</strong>
      <div className="dcc-admin-permission-grid">{Object.entries(PERMISSION_GROUPS).flatMap(([group,keys])=>keys.map(key=><label key={key} className={'dcc-admin-permission'+(permissions[key]?' is-on':'')}>
        <input type="checkbox" checked={!!permissions[key]} onChange={e=>setPermissions(p=>({...p,[key]:e.target.checked}))}/>
        {group} · {PERMISSION_LABELS[key]}</label>))}</div>
    </div>}
    <label className="dcc-admin-invite-label"><input type="checkbox" checked={sendInvite} onChange={e=>setSendInvite(e.target.checked)}/>
      <Mail size={15}/> Email a private, 24-hour password setup link
    </label>
    {error&&<div role="alert" className="dcc-admin-notice is-error"><AlertTriangle size={15}/>{error}</div>}
    <div className="dcc-admin-expanded-actions"><button disabled={saving} className="dcc-admin-btn is-primary" type="submit"><UserPlus size={14}/>{saving?'Creating…':'Create account'}</button>
      <span className="dcc-admin-create-hint">Account creation is immediate; no invitation is sent unless selected.</span></div>
  </form>;
}
