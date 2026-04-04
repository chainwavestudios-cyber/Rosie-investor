import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const GOLD = '#b8933a';
const GOLD2 = '#d4aa50';
const DARK = '#0a0f1e';

const labelStyle = {
  display: 'block', color: '#8a9ab8', fontSize: '10px',
  letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px'
};
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px',
  padding: '10px 14px', color: '#e8e0d0', fontSize: '14px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif'
};

// ─── Add User Form ────────────────────────────────────────────────────────
function AddUserForm({ onAdd, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'investor', company: '' });
  const [error, setError] = useState('');
  const { addUser } = usePortalAuth();

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.password) {
      setError('Name, email, and password are required.');
      return;
    }
    const result = addUser(form);
    if (result.success) {
      onAdd();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '40px', maxWidth: '500px', width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h3 style={{ color: GOLD, margin: 0, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>Add New User</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Full Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="John Smith" />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Email Address</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="investor@example.com" />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Temporary Password</label>
          <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={inputStyle} placeholder="Set a password" />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Company / Fund</label>
          <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={inputStyle} placeholder="Optional" />
        </div>
        <div style={{ marginBottom: '28px' }}>
          <label style={labelStyle}>Role</label>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="investor">Investor</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {error && <div style={{ background: 'rgba(220,60,60,0.12)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: '2px', padding: '10px 14px', color: '#ff8a8a', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleSubmit} style={{ flex: 1, background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Add User
          </button>
          <button onClick={onClose} style={{ padding: '12px 20px', background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px', cursor: 'pointer', fontSize: '12px' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────
function UserDetailModal({ user, onClose }) {
  const sessions = analytics.getUserSessions(user.email);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '40px', maxWidth: '780px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h3 style={{ color: GOLD, margin: '0 0 4px', fontSize: '18px', fontFamily: 'Georgia, serif', fontWeight: 'normal' }}>{user.name}</h3>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '13px' }}>{user.email} · {user.company || 'No company'} · <span style={{ color: user.role === 'admin' ? GOLD : '#4ade80', textTransform: 'uppercase', fontSize: '11px' }}>{user.role}</span></p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        {/* Engagement Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Total Sessions', value: sessions.length },
            { label: 'Total Time', value: analytics.formatDuration(sessions.reduce((s, sess) => s + (sess.durationSeconds || 0), 0)) },
            { label: 'Downloads', value: sessions.reduce((s, sess) => s + (sess.downloads?.length || 0), 0) },
            { label: 'Pages Viewed', value: sessions.reduce((s, sess) => s + (sess.pages?.length || 0), 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(184,147,58,0.08)', border: '1px solid rgba(184,147,58,0.15)', padding: '16px', textAlign: 'center', borderRadius: '2px' }}>
              <div style={{ color: GOLD, fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>{value}</div>
              <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Session History */}
        <h4 style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>Session History</h4>

        {sessions.length === 0 ? (
          <p style={{ color: '#4a5568', fontSize: '13px', textAlign: 'center', padding: '40px' }}>No sessions recorded yet.</p>
        ) : (
          sessions.slice().reverse().map((session, idx) => (
            <div key={session.id || idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '2px', padding: '20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>
                    {new Date(session.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
                    {new Date(session.startTime).toLocaleTimeString()} — {session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'Active'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>{analytics.formatDuration(session.durationSeconds)}</div>
                  <div style={{ color: '#4a5568', fontSize: '11px' }}>Duration</div>
                </div>
              </div>

              {/* Pages */}
              {session.pages && session.pages.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Pages Visited</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {session.pages.map((p, pi) => (
                      <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: '#8a9ab8' }}>{p.page}</span>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <span style={{ color: '#6b7280' }}>{new Date(p.enteredAt).toLocaleTimeString()}</span>
                          <span style={{ color: GOLD }}>{analytics.formatDuration(p.durationSeconds)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sections within pages */}
                  {session.pages.some(p => p.sections?.length > 0) && (
                    <div style={{ marginTop: '8px', paddingLeft: '16px' }}>
                      <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Sections</div>
                      {session.pages.flatMap(p => (p.sections || []).map(s => ({ ...s, page: p.page }))).map((s, si) => (
                        <div key={si} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0', color: '#6b7280' }}>
                          <span>{s.page} › {s.section}</span>
                          <span style={{ color: '#4a5568' }}>{analytics.formatDuration(s.durationSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Downloads */}
              {session.downloads && session.downloads.length > 0 && (
                <div>
                  <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Downloads</div>
                  {session.downloads.map((d, di) => (
                    <div key={di} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                      <span style={{ color: '#4ade80' }}>↓ {d.fileName}</span>
                      <span style={{ color: '#6b7280' }}>{new Date(d.downloadedAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────
export default function AdminDashboard() {
  const { portalUser, isAdmin, portalLogout, getAllUsers, removeUser } = usePortalAuth();
  const [activeView, setActiveView] = useState('users');
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!portalUser || !isAdmin) { navigate('/portal-login'); return; }
    loadData();
  }, [portalUser, isAdmin]);

  function loadData() {
    setUsers(getAllUsers());
    setAnalyticsData(analytics.getAllData());
  }

  const handleLogout = () => { portalLogout(); navigate('/'); };

  const totalSessions = analyticsData?.sessions?.length || 0;
  const totalTime = analyticsData?.sessions?.reduce((s, sess) => s + (sess.durationSeconds || 0), 0) || 0;
  const totalDownloads = analyticsData?.sessions?.reduce((s, sess) => s + (sess.downloads?.length || 0), 0) || 0;
  const activeUsers = users.filter(u => u.role === 'investor').length;

  // Recent activity
  const recentSessions = (analyticsData?.sessions || [])
    .filter(s => s.startTime)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, 10);

  if (!portalUser || !isAdmin) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#060c18', fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      {/* Nav */}
      <nav style={{ background: '#0a0f1e', borderBottom: '1px solid rgba(184,147,58,0.2)', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={LOGO_URL} alt="Rosie AI" style={{ height: '38px', width: 'auto' }} />
          <div style={{ width: '1px', height: '24px', background: 'rgba(184,147,58,0.3)' }} />
          <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase' }}>Admin Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/portal')} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px' }}>
            ← Portal
          </button>
          <button onClick={handleLogout} style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px' }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Sub Nav */}
      <div style={{ background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', display: 'flex', gap: '0' }}>
        {[['users', 'User Management'], ['analytics', 'Engagement Analytics'], ['activity', 'Recent Activity']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveView(id)} style={{
            background: 'none', border: 'none',
            borderBottom: activeView === id ? `2px solid ${GOLD}` : '2px solid transparent',
            color: activeView === id ? GOLD : '#6b7280',
            padding: '14px 20px', cursor: 'pointer', fontSize: '12px', letterSpacing: '1px'
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '36px' }}>
          {[
            { label: 'Investor Users', value: activeUsers, icon: '👥', color: GOLD },
            { label: 'Total Sessions', value: totalSessions, icon: '🔐', color: '#60a5fa' },
            { label: 'Total Time Spent', value: analytics.formatDuration(totalTime), icon: '⏱', color: '#4ade80' },
            { label: 'Downloads', value: totalDownloads, icon: '📥', color: '#f59e0b' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
                  <div style={{ color, fontSize: '28px', fontWeight: 'bold' }}>{value}</div>
                </div>
                <span style={{ fontSize: '24px' }}>{icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Users View ── */}
        {activeView === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#e8e0d0', margin: 0, fontSize: '20px', fontWeight: 'normal' }}>User Management</h2>
              <button onClick={() => setShowAddUser(true)} style={{
                background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: DARK,
                border: 'none', borderRadius: '2px', padding: '10px 24px', cursor: 'pointer',
                fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '700'
              }}>+ Add Investor</button>
            </div>

            {showAddUser && <AddUserForm onAdd={loadData} onClose={() => setShowAddUser(false)} />}
            {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(184,147,58,0.3)' }}>
                  {['Name', 'Email', 'Company', 'Role', 'Created', 'Sessions', 'Actions'].map(h => (
                    <th key={h} style={{ color: GOLD, padding: '10px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const userSessions = analytics.getUserSessions(user.email);
                  return (
                    <tr key={user.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{user.name}</div>
                      </td>
                      <td style={{ padding: '14px 14px', color: '#8a9ab8' }}>{user.email}</td>
                      <td style={{ padding: '14px 14px', color: '#6b7280' }}>{user.company || '—'}</td>
                      <td style={{ padding: '14px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '2px', background: user.role === 'admin' ? 'rgba(184,147,58,0.15)' : 'rgba(74,222,128,0.1)', color: user.role === 'admin' ? GOLD : '#4ade80', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 14px', color: '#4a5568' }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '14px 14px', color: '#60a5fa' }}>{userSessions.length}</td>
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setSelectedUser(user)} style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' }}>
                            View Activity
                          </button>
                          {user.role !== 'admin' && (
                            <button onClick={() => { if (window.confirm(`Remove ${user.name}?`)) { removeUser(user.email); loadData(); } }} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '2px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' }}>
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Analytics View ── */}
        {activeView === 'analytics' && (
          <div>
            <h2 style={{ color: '#e8e0d0', margin: '0 0 28px', fontSize: '20px', fontWeight: 'normal' }}>Engagement Analytics</h2>

            {/* Per-user engagement */}
            {users.filter(u => u.role === 'investor').map(user => {
              const userSessions = analytics.getUserSessions(user.email);
              const totalUserTime = userSessions.reduce((s, sess) => s + (sess.durationSeconds || 0), 0);
              const userDownloads = userSessions.reduce((s, sess) => s + (sess.downloads?.length || 0), 0);
              const lastSeen = userSessions.length > 0 ? new Date(Math.max(...userSessions.map(s => new Date(s.startTime)))).toLocaleDateString() : 'Never';
              const allPages = userSessions.flatMap(s => s.pages || []);
              const pageTime = {};
              allPages.forEach(p => { pageTime[p.page] = (pageTime[p.page] || 0) + (p.durationSeconds || 0); });

              return (
                <div key={user.email} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '24px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{user.name}</div>
                      <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>{user.email} · Last seen: {lastSeen}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                      <div><div style={{ color: GOLD, fontWeight: 'bold', fontSize: '18px' }}>{userSessions.length}</div><div style={{ color: '#4a5568', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Sessions</div></div>
                      <div><div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '18px' }}>{analytics.formatDuration(totalUserTime)}</div><div style={{ color: '#4a5568', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Time</div></div>
                      <div><div style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '18px' }}>{userDownloads}</div><div style={{ color: '#4a5568', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Downloads</div></div>
                    </div>
                  </div>

                  {/* Page time breakdown */}
                  {Object.keys(pageTime).length > 0 && (
                    <div>
                      <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Time by Page</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {Object.entries(pageTime).map(([page, time]) => (
                          <div key={page} style={{ background: 'rgba(184,147,58,0.08)', border: '1px solid rgba(184,147,58,0.15)', borderRadius: '2px', padding: '6px 12px', fontSize: '12px' }}>
                            <span style={{ color: '#8a9ab8' }}>{page}</span>
                            <span style={{ color: GOLD, marginLeft: '8px', fontWeight: 'bold' }}>{analytics.formatDuration(time)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => setSelectedUser(user)} style={{ marginTop: '16px', background: 'transparent', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px' }}>
                    Full Session History →
                  </button>
                </div>
              );
            })}

            {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
          </div>
        )}

        {/* ── Recent Activity View ── */}
        {activeView === 'activity' && (
          <div>
            <h2 style={{ color: '#e8e0d0', margin: '0 0 28px', fontSize: '20px', fontWeight: 'normal' }}>Recent Activity</h2>

            {recentSessions.length === 0 ? (
              <p style={{ color: '#4a5568', textAlign: 'center', padding: '60px' }}>No activity recorded yet. Activity will appear here once investors log in.</p>
            ) : (
              <div>
                {recentSessions.map((session, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '2px', padding: '20px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ color: '#e8e0d0', fontWeight: 'bold', marginBottom: '4px' }}>{session.userName || session.userEmail}</div>
                      <div style={{ color: '#6b7280', fontSize: '12px' }}>{session.userEmail}</div>
                      <div style={{ color: '#4a5568', fontSize: '12px', marginTop: '4px' }}>
                        {new Date(session.startTime).toLocaleString()} · {session.pages?.length || 0} pages · {session.downloads?.length || 0} downloads
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: GOLD, fontWeight: 'bold', fontSize: '16px' }}>{analytics.formatDuration(session.durationSeconds)}</div>
                      <div style={{ color: '#4a5568', fontSize: '11px', marginTop: '2px' }}>Duration</div>
                    </div>
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