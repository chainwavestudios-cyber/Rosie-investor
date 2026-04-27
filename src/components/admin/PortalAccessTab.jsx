import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { InvestorUser } from '@/api/entities';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
const monoInp = { ...inp, fontFamily:'monospace', fontSize:'12px', cursor:'text' };

export default function PortalAccessTab({ user, onClose, onSave }) {
  const [newUsername, setNewUsername] = useState(user.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [expiresAt, setExpiresAt]     = useState(user.accessExpiresAt || '');
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');
  const [deleting, setDeleting]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied]           = useState('');
  const [sendingInvestorEmail, setSendingInvestorEmail] = useState(false);
  const [sendingPortalEmail, setSendingPortalEmail]     = useState(false);
  const [emailMsg, setEmailMsg]       = useState('');

  const username       = user.username || '';
  const lastNameSlug   = (user.name || '').toLowerCase().split(' ').pop().replace(/[^a-z]/g, '');
  const portalPassword = username ? `${lastNameSlug}#2026` : '';

  // Investor INFO site — personal access code, auto-unlocks the site
  const investorSiteUrl = username
    ? `https://investors.rosieai.tech/?code=${encodeURIComponent(username)}`
    : '';

  // Portal — full credentials auto-login
  const portalLoginUrl = username
    ? `https://investors.rosieai.tech/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(portalPassword)}`
    : '';

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const isExpired = user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date();

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const updates = {
        username: newUsername.trim().toLowerCase(),
        accessExpiresAt: expiresAt || null,
      };
      if (newPassword.trim()) updates.password = newPassword.trim();
      await InvestorUser.update(user.id, updates);
      setMsg('success:Saved ✓');
      setNewPassword('');
      onSave && onSave();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('error:Save failed — ' + e.message); }
    setSaving(false);
  };

  const sendInvestorSiteEmail = async () => {
    if (!user.email) { setEmailMsg('No email on file.'); return; }
    setSendingInvestorEmail(true); setEmailMsg('');
    try {
      // Re-send the original intro email (template 7949342) with correct investor site URL
      await base44.functions.invoke('sendLeadEmail', {
        leadId:    user.leadId || user.id,
        toEmail:   user.email,
        toName:    user.name,
        firstName: user.name?.split(' ')[0] || '',
      });
      setEmailMsg('✓ Investor site access email sent!');
    } catch (e) { setEmailMsg('Error: ' + (e.response?.data?.error || e.message)); }
    setSendingInvestorEmail(false);
    setTimeout(() => setEmailMsg(''), 4000);
  };

  const sendPortalAccessEmail = async () => {
    if (!user.email) { setEmailMsg('No email on file.'); return; }
    setSendingPortalEmail(true); setEmailMsg('');
    try {
      await base44.functions.invoke('sendPortalAccessEmail', {
        investorId: user.id,
        toEmail:    user.email,
        toName:     user.name,
        firstName:  user.name?.split(' ')[0] || '',
        username,
        password:   portalPassword,
        loginUrl:   portalLoginUrl,
      });
      setEmailMsg('✓ Portal access email sent!');
      // Log it
      await base44.entities.ContactNote.create({
        investorId:    user.id,
        investorEmail: user.email,
        type:          'email',
        content:       `📧 Portal access email sent. Username: ${username}`,
        createdAt:     new Date().toISOString(),
        createdBy:     'admin',
      }).catch(() => {});
    } catch (e) { setEmailMsg('Error: ' + (e.response?.data?.error || e.message)); }
    setSendingPortalEmail(false);
    setTimeout(() => setEmailMsg(''), 4000);
  };

  const handleDeleteAccess = async () => {
    setDeleting(true); setMsg('');
    try {
      const leads = await base44.entities.Lead.filter({ convertedToInvestorUserId: user.id });
      if (leads.length > 0) {
        await base44.entities.Lead.update(leads[0].id, {
          status: 'prospect', convertedToInvestorUserId: null,
        });
        await base44.entities.LeadHistory.create({
          leadId: leads[0].id, type: 'status_change',
          content: 'Portal access revoked — lead returned to Prospects.',
        });
      }
      await InvestorUser.delete(user.id);
      onSave && onSave();
      onClose && onClose();
    } catch (e) {
      setMsg('error:Delete failed — ' + e.message);
      setDeleting(false);
    }
  };

  const [msgType, msgText] = (msg || '').split(':');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* Status */}
      <div style={{ background: isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.08)', border:`1px solid ${isExpired ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.2)'}`, borderRadius:'4px', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color: isExpired ? '#ef4444' : '#4ade80', fontSize:'13px', fontWeight:'bold', marginBottom:'2px' }}>{isExpired ? '⛔ Access Expired' : '✅ Access Active'}</div>
          <div style={{ color:'#6b7280', fontSize:'11px' }}>Username: <span style={{ color:'#e8e0d0', fontFamily:'monospace' }}>{username}</span>{user.accessExpiresAt ? ` · Expires ${new Date(user.accessExpiresAt).toLocaleDateString()}` : ' · No expiration'}</div>
        </div>
      </div>

      {/* ── INVESTOR INFO SITE ── */}
      <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'4px', padding:'16px' }}>
        <div style={{ color:'#60a5fa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>💼 Investor Info Site — investors.rosieai.tech</div>

        <div style={{ marginBottom:'10px' }}>
          <label style={ls}>Personal Access Code</label>
          <div style={{ display:'flex', gap:'6px' }}>
            <input readOnly value={username} style={monoInp} />
            <button onClick={() => copy(username, 'code')} style={{ background:'rgba(255,255,255,0.06)', color: copied==='code' ? '#4ade80' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
              {copied==='code' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom:'14px' }}>
          <label style={ls}>Auto-Login URL (for email)</label>
          <div style={{ display:'flex', gap:'6px' }}>
            <input readOnly value={investorSiteUrl} style={{ ...monoInp, fontSize:'11px' }} />
            <button onClick={() => copy(investorSiteUrl, 'invUrl')} style={{ background:'rgba(96,165,250,0.1)', color: copied==='invUrl' ? '#4ade80' : '#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
              {copied==='invUrl' ? '✓' : 'Copy'}
            </button>
          </div>
          <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'4px' }}>Clicking this auto-unlocks the investor info site — no password needed</div>
        </div>

        <button onClick={sendInvestorSiteEmail} disabled={sendingInvestorEmail || !user.email}
          style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'4px', padding:'8px 16px', cursor: user.email ? 'pointer' : 'not-allowed', fontSize:'11px', fontWeight:'bold', opacity: user.email ? 1 : 0.5 }}>
          {sendingInvestorEmail ? '⏳ Sending…' : '📧 Re-send Investor Site Email'}
        </button>
      </div>

      {/* ── PORTAL CREDENTIALS ── */}
      <div style={{ background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'4px', padding:'16px' }}>
        <div style={{ color:'#a78bfa', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>🔐 Investor Portal — investors.rosieai.tech/portal</div>

        <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
          <div style={{ flex:1, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'8px 12px' }}>
            <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>Username</div>
            <div style={{ color:GOLD, fontFamily:'monospace', fontSize:'13px' }}>{username}</div>
          </div>
          <div style={{ flex:1, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'8px 12px' }}>
            <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>Password</div>
            <div style={{ color:'#e8e0d0', fontFamily:'monospace', fontSize:'13px' }}>{portalPassword}</div>
          </div>
          <button onClick={() => copy(`Username: ${username}\nPassword: ${portalPassword}\nPortal: https://investors.rosieai.tech/portal-login`, 'creds')}
            style={{ background:'rgba(255,255,255,0.05)', color: copied==='creds' ? '#4ade80' : '#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 10px', cursor:'pointer', fontSize:'10px', whiteSpace:'nowrap' }}>
            {copied==='creds' ? '✓' : 'Copy All'}
          </button>
        </div>

        <div style={{ marginBottom:'12px' }}>
          <label style={ls}>Auto-Login URL</label>
          <div style={{ display:'flex', gap:'6px' }}>
            <input readOnly value={portalLoginUrl} style={{ ...monoInp, fontSize:'10px' }} />
            <button onClick={() => copy(portalLoginUrl, 'portalUrl')} style={{ background:'rgba(167,139,250,0.1)', color: copied==='portalUrl' ? '#4ade80' : '#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'8px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
              {copied==='portalUrl' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        <button onClick={sendPortalAccessEmail} disabled={sendingPortalEmail || !user.email}
          style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', border:'none', borderRadius:'4px', padding:'8px 16px', cursor: user.email ? 'pointer' : 'not-allowed', fontSize:'11px', fontWeight:'bold', opacity: user.email ? 1 : 0.5 }}>
          {sendingPortalEmail ? '⏳ Sending…' : '📧 Send Portal Access Email'}
        </button>
      </div>

      {emailMsg && (
        <div style={{ background: emailMsg.startsWith('✓') ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${emailMsg.startsWith('✓') ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'10px 14px', color: emailMsg.startsWith('✓') ? '#4ade80' : '#ef4444', fontSize:'13px' }}>
          {emailMsg}
        </div>
      )}

      {/* ── EDIT CREDENTIALS ── */}
      <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'16px' }}>
        <div style={{ color:'#c4cdd8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'14px' }}>Edit Credentials</div>
        <div style={{ marginBottom:'12px' }}>
          <label style={ls}>Username</label>
          <input value={newUsername} onChange={e => setNewUsername(e.target.value)} style={inp} />
        </div>
        <div style={{ marginBottom:'12px' }}>
          <label style={ls}>New Password (leave blank to keep current)</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" style={inp} />
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={ls}>Access Expiration (optional)</label>
          <input type="date" value={expiresAt ? expiresAt.slice(0, 10) : ''} onChange={e => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')} style={inp} />
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 24px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {msg && <span style={{ color: msgType === 'error' ? '#ef4444' : '#4ade80', fontSize:'13px' }}>{msgText}</span>}
        </div>
      </div>

      {/* ── DANGER ZONE ── */}
      <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'4px', padding:'16px' }}>
        <div style={{ color:'#ef4444', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Danger Zone</div>
        <p style={{ color:'#8a9ab8', fontSize:'12px', margin:'0 0 14px', lineHeight:1.6 }}>
          Removes this contact from CRM and returns them to the Leads tab as a Prospect.
        </p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'4px', padding:'9px 20px', cursor:'pointer', fontSize:'12px' }}>
            🗑 Revoke Access
          </button>
        ) : (
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <span style={{ color:'#f59e0b', fontSize:'12px' }}>Are you sure?</span>
            <button onClick={handleDeleteAccess} disabled={deleting} style={{ background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'4px', padding:'8px 18px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
              {deleting ? 'Removing…' : 'Yes, Revoke'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}