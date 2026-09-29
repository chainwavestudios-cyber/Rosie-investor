import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', super_manager: 'Super Manager', manager: 'Manager', dialer: 'Dialer' };
const ROLE_COLORS = { super_admin: '#f472b6', admin: '#60a5fa', super_manager: '#34d399', manager: '#a78bfa', dialer: '#f59e0b' };

const PERMISSION_KEYS = [
  { key: 'liveAIAssistant', label: 'Live — AI Assistant', group: 'Live Call' },
  { key: 'liveQA', label: 'Live — Q&A', group: 'Live Call' },
  { key: 'liveCoach', label: 'Live — Coach', group: 'Live Call' },
  { key: 'liveIntent', label: 'Live — Intent', group: 'Live Call' },
  { key: 'bobAIAssistant', label: 'BOB — AI Assistant', group: 'BOB Training' },
  { key: 'bobQA', label: 'BOB — Q&A', group: 'BOB Training' },
  { key: 'bobCoach', label: 'BOB — Coach', group: 'BOB Training' },
  { key: 'bobIntent', label: 'BOB — Intent', group: 'BOB Training' },
];

export default function DebtCoachAdminPanel() {
  const { user, sessionUserId, sessionToken, isSuperAdmin } = useDebtCoachAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editPerms, setEditPerms] = useState({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('debtCoachAuth', { action: 'listUsers', sessionUserId, sessionToken });
      const data = res?.data || res;
      setUsers(data?.users || []);
    } catch {}
    setLoading(false);
  }, [sessionUserId, sessionToken]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const callApi = async (payload) => {
    const res = await base44.functions.invoke('debtCoachAuth', { ...payload, sessionUserId, sessionToken });
    const data = res?.data || res;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    try { setEditPerms(JSON.parse(u.permissions || '{}')); } catch { setEditPerms({}); }
  };

  const savePerms = async (userId) => {
    try {
      await callApi({ action: 'updateUser', targetUserId: userId, updates: { permissions: editPerms } });
      setEditingId(null);
      loadUsers();
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const toggleActive = async (u) => {
    try { await callApi({ action: 'updateUser', targetUserId: u.id, updates: { isActive: !u.isActive } }); loadUsers(); }
    catch (e) { alert('Failed: ' + e.message); }
  };

  const changeRole = async (u, newRole) => {
    try { await callApi({ action: 'updateUser', targetUserId: u.id, updates: { role: newRole } }); loadUsers(); }
    catch (e) { alert('Failed: ' + e.message); }
  };

  const resetPwd = async (u) => {
    if (!window.confirm(`Reset ${u.username}'s password to Debt@2026!!? They will need to set a new password on next login.`)) return;
    try { await callApi({ action: 'resetPassword', targetUserId: u.id }); alert('Password reset to Debt@2026!!'); }
    catch (e) { alert('Failed: ' + e.message); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try { await callApi({ action: 'deleteUser', targetUserId: u.id }); loadUsers(); }
    catch (e) { alert('Failed: ' + e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>⚙️ User Management — {users.length} Users</div>
        <button onClick={() => setShowCreate((s) => !s)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{showCreate ? 'Cancel' : '+ Create User'}</button>
      </div>

      {showCreate && <CreateUserForm onCreated={() => { setShowCreate(false); loadUsers(); }} sessionUserId={sessionUserId} sessionToken={sessionToken} />}

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map((u) => {
            const rc = ROLE_COLORS[u.role] || '#6b7280';
            const isEditing = editingId === u.id;
            const canEdit = u.role !== 'super_admin' || isSuperAdmin;
            return (
              <div key={u.id} style={{ background: '#0d1b2a', border: `1px solid ${rc}22`, borderRadius: '6px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${rc}18`, color: rc, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{ROLE_LABELS[u.role]}</span>
                    <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginLeft: '8px' }}>{u.username}</span>
                    {u.email && <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '8px' }}>· {u.email}</span>}
                    {!u.isActive && <span style={{ color: '#ef4444', fontSize: '10px', marginLeft: '8px', fontWeight: 'bold' }}>INACTIVE</span>}
                    {u.mustResetPassword && <span style={{ color: '#f59e0b', fontSize: '10px', marginLeft: '8px' }}>· Must reset password</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {canEdit && u.role === 'dialer' && !isEditing && (
                      <button onClick={() => startEdit(u)} style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Permissions</button>
                    )}
                    {canEdit && (
                      <>
                        <button onClick={() => toggleActive(u)} style={{ background: 'rgba(255,255,255,0.05)', color: u.isActive ? '#f59e0b' : '#10b981', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button onClick={() => resetPwd(u)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Reset Pwd</button>
                      </>
                    )}
                    {isSuperAdmin && u.id !== sessionUserId && (
                      <button onClick={() => deleteUser(u)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Delete</button>
                    )}
                  </div>
                </div>

                {u.role !== 'dialer' && (
                  <div style={{ color: '#4a5568', fontSize: '11px' }}>{u.role === 'manager' ? 'Manager — full feature access + can view/edit all calls, profiles, KB, and pitches.' : 'Full access — all features enabled.'}</div>
                )}

                {u.role === 'dialer' && !isEditing && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {PERMISSION_KEYS.map((p) => {
                      let perms = {};
                      try { perms = JSON.parse(u.permissions || '{}'); } catch {}
                      const on = !!perms[p.key];
                      return (
                        <span key={p.key} style={{ padding: '2px 8px', borderRadius: '2px', background: on ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)', color: on ? GOLD : '#4a5568', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{p.label}: {on ? '✓' : '✗'}</span>
                      );
                    })}
                  </div>
                )}

                {isEditing && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                    <div style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Dialer Permissions for {u.username}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {PERMISSION_KEYS.map((p) => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 10px', background: editPerms[p.key] ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '3px', border: `1px solid ${editPerms[p.key] ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                          <input type="checkbox" checked={!!editPerms[p.key]} onChange={(e) => setEditPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))} style={{ cursor: 'pointer', accentColor: GOLD }} />
                          <span style={{ color: editPerms[p.key] ? '#e8e0d0' : '#6b7280', fontSize: '12px' }}>{p.label}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button onClick={() => savePerms(u.id)} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Save Permissions</button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {canEdit && isSuperAdmin && u.role !== 'super_admin' && !isEditing && (
                  <div style={{ marginTop: '8px' }}>
                    <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} style={{ ...inp, width: 'auto', fontSize: '11px', cursor: 'pointer', padding: '4px 10px' }}>
                      <option value="dialer">Dialer</option>
                      <option value="manager">Manager</option>
                      <option value="super_manager">Super Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                )}

                {u.createdBy && <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>Created by: {u.createdBy}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ onCreated, sessionUserId, sessionToken }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('dialer');
  const [sendInvite, setSendInvite] = useState(false);
  const [perms, setPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!username.trim()) { setError('Username required'); return; }
    setSaving(true); setError('');
    try {
      const res = await base44.functions.invoke('debtCoachAuth', {
        action: 'createUser', sessionUserId, sessionToken,
        username, email, role, sendInvite,
        permissions: role === 'dialer' ? perms : {},
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setUsername(''); setEmail(''); setRole('dialer'); setSendInvite(false); setPerms({});
      onCreated();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ marginBottom: '20px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '20px' }}>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>+ Create New User</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div><label style={ls}>Username</label><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. john.doe" style={inp} /></div>
        <div><label style={ls}>Email (for invite)</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" style={inp} /></div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={ls}>Role</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['dialer', 'manager', 'super_manager', 'admin', 'super_admin'].map((r) => (
            <button key={r} onClick={() => setRole(r)} style={{ padding: '8px 16px', borderRadius: '4px', border: `1px solid ${role === r ? ROLE_COLORS[r] + '66' : 'rgba(255,255,255,0.1)'}`, background: role === r ? `${ROLE_COLORS[r]}18` : 'transparent', color: role === r ? ROLE_COLORS[r] : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{ROLE_LABELS[r]}</button>
          ))}
        </div>
      </div>
      {role === 'dialer' && (
        <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
          <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Dialer Permissions — grant access to AI features</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {PERMISSION_KEYS.map((p) => (
              <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '5px 8px', background: perms[p.key] ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '3px', border: `1px solid ${perms[p.key] ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                <input type="checkbox" checked={!!perms[p.key]} onChange={(e) => setPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))} style={{ cursor: 'pointer', accentColor: GOLD }} />
                <span style={{ color: perms[p.key] ? '#e8e0d0' : '#6b7280', fontSize: '11px' }}>{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} style={{ cursor: 'pointer', accentColor: GOLD }} />
          <span style={{ color: '#8a9ab8', fontSize: '12px' }}>Send invite email with login instructions (default password: Debt@2026!!)</span>
        </label>
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px' }}>⚠ {error}</div>}
      <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>{saving ? 'Creating…' : 'Create User'}</button>
    </div>
  );
}