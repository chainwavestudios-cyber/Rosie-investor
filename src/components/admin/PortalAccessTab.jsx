import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { InvestorUser } from '@/api/entities';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

export default function PortalAccessTab({ user, onClose, onSave }) {
  const [copied, setCopied]               = useState('');
  const [editingPortal, setEditingPortal] = useState(false);
  const [newUsername, setNewUsername]     = useState(user.username || '');
  const [newPassword, setNewPassword]     = useState('');
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState('');
  const [expiresAt, setExpiresAt]         = useState(user.accessExpiresAt || '');
  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const username       = user.username || '';
  const lastNameSlug   = (user.name || '').toLowerCase().split(' ').pop().replace(/[^a-z]/g, '');
  const portalPassword = username ? `${lastNameSlug}#2026` : '';
  const investorUrl    = username ? `https://investors.rosieai.tech/?code=${encodeURIComponent(username)}` : '';
  const portalUrl      = username ? `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(portalPassword)}` : '';
  const consumerUrl    = username ? `https://www.rosieai.tech?ref=${username}` : '';

  const isExpired = user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date();

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const saveCredentials = async () => {
    if (!newUsername.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      const updates = {
        username: newUsername.trim().toLowerCase(),
        accessExpiresAt: expiresAt || null,
      };
      if (newPassword.trim()) updates.password = newPassword.trim();
      await InvestorUser.update(user.id, updates);
      setSaveMsg('✓ Saved');
      setEditingPortal(false);
      setNewUsername(''); setNewPassword('');
      onSave && onSave();
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleDeleteAccess = async () => {
    setDeleting(true);
    try {
      const leads = await base44.entities.Lead.filter({ convertedToInvestorUserId: user.id });
      if (leads.length > 0) {
        await base44.entities.Lead.update(leads[0].id, { status:'prospect', convertedToInvestorUserId:null });
        await base44.entities.LeadHistory.create({ leadId:leads[0].id, type:'status_change', content:'Portal access revoked — returned to Leads.' });
      }
      await InvestorUser.delete(user.id);
      onSave && onSave();
      onClose && onClose();
    } catch (e) { setSaveMsg('Error: ' + e.message); setDeleting(false); }
  };

  const inp    = { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'monospace', boxSizing:'border-box' };
  const editInp = { ...inp, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(184,147,58,0.3)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* Status */}
      <div style={{ background: isExpired ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.06)', border:`1px solid ${isExpired ? 'rgba(239,68,68,0.25)' : 'rgba(74,222,128,0.2)'}`, borderRadius:'4px', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color: isExpired ? '#ef4444' : '#4ade80', fontSize:'12px', fontWeight:'bold', marginBottom:'2px' }}>{isExpired ? '⛔ Access Expired' : '✅ Access Active'}</div>
          <div style={{ color:'#6b7280', fontSize:'11px' }}>Username: <span style={{ color:'#e8e0d0', fontFamily:'monospace' }}>{username}</span>{user.accessExpiresAt ? ` · Expires ${new Date(user.accessExpiresAt).toLocaleDateString()}` : ' · No expiration'}</div>
        </div>
      </div>

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
        <div style={{ marginBottom:'12px' }}>
          <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Access URL</div>
          <div style={{ display:'flex', gap:'6px' }}>
            <input readOnly value={investorUrl} style={{ ...inp, fontSize:'10px' }} />
            <button onClick={() => copy(investorUrl, 'invUrl')} style={{ background:'rgba(96,165,250,0.1)', color: copied==='invUrl' ? '#4ade80' : '#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
              {copied==='invUrl' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
        <div>
          <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Consumer Site Tracking URL</div>
          <div style={{ display:'flex', gap:'6px' }}>
            <input readOnly value={consumerUrl} style={{ ...inp, fontSize:'10px' }} />
            <button onClick={() => copy(consumerUrl, 'conUrl')} style={{ background:'rgba(167,139,250,0.1)', color: copied==='conUrl' ? '#4ade80' : '#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
              {copied==='conUrl' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* ── PORTAL CREDENTIALS ── */}
      <div style={{ background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'6px', padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
          <div style={{ color:'#a78bfa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>🔐 Investor Portal — investors.rosieai.tech/portal</div>
          <button onClick={() => { setEditingPortal(e => !e); setNewUsername(username); setNewPassword(''); }}
            style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>
            {editingPortal ? 'Cancel' : '✏️ Edit'}
          </button>
        </div>
        {!editingPortal ? (
          <>
            <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
              <div style={{ flex:1, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'7px 10px' }}>
                <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Username</div>
                <div style={{ color:GOLD, fontFamily:'monospace', fontSize:'12px' }}>{username}</div>
              </div>
              <div style={{ flex:1, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'7px 10px' }}>
                <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Password</div>
                <div style={{ color:'#e8e0d0', fontFamily:'monospace', fontSize:'12px' }}>{portalPassword}</div>
              </div>
              <button onClick={() => copy(`Username: ${username}\nPassword: ${portalPassword}\nPortal: https://investors.rosieai.tech/portal-login`, 'creds')}
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
              <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Password (leave blank to keep current)</div>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" style={editInp} />
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <button onClick={saveCredentials} disabled={saving}
                style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'8px 18px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saveMsg && <span style={{ fontSize:'11px', color: saveMsg.startsWith('✓') ? '#4ade80' : '#ef4444' }}>{saveMsg}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── DANGER ZONE ── */}
      <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'4px', padding:'14px 16px' }}>
        <div style={{ color:'#ef4444', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Danger Zone</div>
        <p style={{ color:'#6b7280', fontSize:'11px', margin:'0 0 12px', lineHeight:1.6 }}>Removes from CRM and returns to Leads as a Prospect.</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'4px', padding:'7px 16px', cursor:'pointer', fontSize:'11px' }}>
            🗑 Revoke Access
          </button>
        ) : (
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <span style={{ color:'#f59e0b', fontSize:'12px' }}>Are you sure?</span>
            <button onClick={handleDeleteAccess} disabled={deleting} style={{ background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'4px', padding:'7px 16px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
              {deleting ? 'Removing…' : 'Yes, Revoke'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'7px 12px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}