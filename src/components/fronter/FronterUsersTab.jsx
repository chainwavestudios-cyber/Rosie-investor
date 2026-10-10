/**
 * FronterUsersTab.jsx — Super admin user management for the fronter system.
 * Create, edit, delete fronter users. All created users are role 'fronter'.
 * Requires: first name, last name, username, password, email.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterUsersTab({ adminUsername }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', password: '', email: '' });
  const [resetPasswordId, setResetPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.DebtCoachUser.list('-created_date', 500);
      setUsers((all || []).filter(u => u.role === 'fronter'));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ firstName: '', lastName: '', username: '', password: '', email: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const saveUser = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim()) return;
    if (!editingId && !form.password.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        // Edit existing — update name/email only
        await base44.entities.DebtCoachUser.update(editingId, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
        });
        // If password provided, hash and update
        if (form.password.trim()) {
          const hashRes = await base44.functions.invoke('hashPassword', { action: 'hash', password: form.password.trim() });
          await base44.entities.DebtCoachUser.update(editingId, { passwordHash: hashRes.hash });
        }
        resetForm();
        load();
      } else {
        // Check for duplicate username
        const existing = await base44.entities.DebtCoachUser.filter({ username: form.username.trim() });
        if (existing && existing.length > 0) {
          alert('Username already exists. Choose a different one.');
          setSaving(false);
          return;
        }
        // Hash password
        const hashRes = await base44.functions.invoke('hashPassword', { action: 'hash', password: form.password.trim() });
        await base44.entities.DebtCoachUser.create({
          username: form.username.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          passwordHash: hashRes.hash,
          role: 'fronter',
          isActive: true,
          createdBy: adminUsername,
        });
        resetForm();
        load();
      }
    } catch (e) {
      alert('Failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  const toggleActive = async (user) => {
    try {
      await base44.entities.DebtCoachUser.update(user.id, { isActive: !user.isActive });
      load();
    } catch {}
  };

  const deleteUser = async (user) => {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await base44.entities.DebtCoachUser.delete(user.id);
      load();
    } catch (e) { alert('Delete failed: ' + (e?.message || String(e))); }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setForm({ firstName: user.firstName || '', lastName: user.lastName || '', username: user.username, password: '', email: user.email || '' });
    setShowForm(true);
  };

  const doResetPassword = async () => {
    if (!newPassword.trim() || !resetPasswordId) return;
    setSaving(true);
    try {
      const hashRes = await base44.functions.invoke('hashPassword', { action: 'hash', password: newPassword.trim() });
      await base44.entities.DebtCoachUser.update(resetPasswordId, { passwordHash: hashRes.hash });
      setResetPasswordId(null);
      setNewPassword('');
      alert('Password reset successfully.');
    } catch (e) { alert('Reset failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>👥 Fronter Users</div>
        {!showForm && <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ firstName: '', lastName: '', username: '', password: '', email: '' }); }} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+ Add User</button>}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>{editingId ? 'Edit User' : '+ New Fronter User'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={ls}>First Name *</label><input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} style={inp} /></div>
            <div><label style={ls}>Last Name *</label><input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={ls}>Username * {editingId && <span style={{ color: '#4a5568', fontSize: '9px' }}>(cannot change)</span>}</label><input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} disabled={!!editingId} style={{ ...inp, opacity: editingId ? 0.5 : 1 }} /></div>
            <div><label style={ls}>Email *</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="name@example.com" /></div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Password {editingId ? '(leave blank to keep current)' : '*'}</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} style={inp} placeholder={editingId ? '••••••••' : 'Enter password'} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={saveUser} disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim() || (!editingId && !form.password.trim())} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>{saving ? '⏳ Saving…' : editingId ? 'Update User' : 'Create User'}</button>
            <button onClick={resetForm} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Reset password inline */}
      {resetPasswordId && (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
          <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>🔑 Reset Password</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" style={inp} />
            <button onClick={doResetPassword} disabled={saving || !newPassword.trim()} style={{ background: '#f59e0b', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>{saving ? '⏳' : 'Reset'}</button>
            <button onClick={() => { setResetPasswordId(null); setNewPassword(''); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : users.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No fronter users yet. Click "Add User" to create one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map(u => (
            <div key={u.id} style={{ background: '#0d1b2a', border: `1px solid ${u.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: '6px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.isActive ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DARK, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{(u.firstName?.[0] || '?')}{(u.lastName?.[0] || '')}</div>
                <div>
                  <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{u.firstName || ''} {u.lastName || ''}</div>
                  <div style={{ color: '#6b7280', fontSize: '11px' }}>@{u.username} · {u.email || 'no email'}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', background: u.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.isActive ? GOLD : RED }}>{u.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => startEdit(u)} style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
                <button onClick={() => setResetPasswordId(u.id)} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>🔑 Password</button>
                <button onClick={() => toggleActive(u)} style={{ background: u.isActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: u.isActive ? RED : GOLD, border: `1px solid ${u.isActive ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => deleteUser(u)} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}