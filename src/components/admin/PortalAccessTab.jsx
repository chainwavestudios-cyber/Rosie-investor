import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { InvestorUser } from '@/api/entities';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

export default function PortalAccessTab({ user, onClose, onSave }) {
  const [newUsername, setNewUsername] = useState(user.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState(user.accessExpiresAt || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isExpired = user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date();

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const updates = {
        username: newUsername.trim().toLowerCase(),
        accessExpiresAt: expiresAt || null,
      };
      if (newPassword.trim()) {
        updates.password = newPassword.trim();
      }
      await InvestorUser.update(user.id, updates);
      setMsg('success:Saved ✓');
      setNewPassword('');
      onSave && onSave();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('error:Save failed — ' + e.message);
    }
    setSaving(false);
  };

  const handleDeleteAccess = async () => {
    setDeleting(true); setMsg('');
    try {
      // 1. Find if this user has a linked lead (convertedToInvestorUserId)
      const leads = await base44.entities.Lead.filter({ convertedToInvestorUserId: user.id });

      if (leads.length > 0) {
        // 2. Revert lead back to prospect status
        await base44.entities.Lead.update(leads[0].id, {
          status: 'prospect',
          convertedToInvestorUserId: null,
          lastCalledAt: null,
        });
        // 3. Log it
        await base44.entities.LeadHistory.create({
          leadId: leads[0].id,
          type: 'status_change',
          content: `Portal access revoked — lead returned to Prospects in Leads tab.`,
        });
      } else {
        // No linked lead — create a new lead record from CRM data
        await base44.entities.Lead.create({
          firstName: (user.name || '').split(' ')[0] || user.name,
          lastName: (user.name || '').split(' ').slice(1).join(' ') || '',
          email: user.email || '',
          phone: user.phone || '',
          status: 'prospect',
          notes: user.notes || '',
        });
      }

      // 4. Delete the InvestorUser record
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
    <div>
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px' }}>Portal Access Management</div>

      {/* Status banner */}
      <div style={{ background: isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.08)', border: `1px solid ${isExpired ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.2)'}`, borderRadius: '2px', padding: '14px 16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: isExpired ? '#ef4444' : '#4ade80', fontSize: '13px', fontWeight: 'bold', marginBottom: '3px' }}>{isExpired ? '⛔ Access Expired' : '✅ Access Active'}</div>
          <div style={{ color: '#6b7280', fontSize: '12px' }}>Username: <span style={{ color: '#e8e0d0', fontFamily: 'monospace' }}>@{user.username}</span>{user.accessExpiresAt ? ` · Expires: ${new Date(user.accessExpiresAt).toLocaleDateString()}` : ' · No expiration set'}</div>
        </div>
      </div>

      {/* Edit credentials */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ color: '#c4cdd8', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>Update Credentials</div>
        <div style={{ marginBottom: '14px' }}>
          <label style={ls}>Username</label>
          <input value={newUsername} onChange={e => setNewUsername(e.target.value)} style={inp} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={ls}>New Password (leave blank to keep current)</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" style={inp} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={ls}>Access Expiration Date (optional)</label>
          <input type="date" value={expiresAt ? expiresAt.slice(0, 10) : ''} onChange={e => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')} style={inp} />
          {expiresAt && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>Access will be automatically flagged as expired after this date.</div>}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '10px 28px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {msg && <span style={{ color: msgType === 'error' ? '#ef4444' : '#4ade80', fontSize: '13px' }}>{msgText}</span>}
        </div>
      </div>

      {/* Delete access */}
      <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '2px', padding: '20px' }}>
        <div style={{ color: '#ef4444', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Danger Zone</div>
        <p style={{ color: '#8a9ab8', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.6 }}>
          Deleting access will <strong style={{ color: '#e8e0d0' }}>remove this user from CRM/Clients</strong> and return them to the <strong style={{ color: '#e8e0d0' }}>Leads tab</strong> as a Prospect.
        </p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '2px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', letterSpacing: '1px' }}>
            🗑 Revoke Portal Access
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: '#f59e0b', fontSize: '13px' }}>Are you sure? This cannot be undone.</span>
            <button onClick={handleDeleteAccess} disabled={deleting} style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '2px', padding: '9px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {deleting ? 'Removing…' : 'Yes, Revoke & Move to Leads'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '9px 16px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}