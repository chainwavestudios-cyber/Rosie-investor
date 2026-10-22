/**
 * SuperAdminPortal.jsx — the super admin's single source of truth.
 * Watches BOTH auth systems side by side, in three modes:
 *   Debt Call Coach · Fronter · Split Screen
 * Every card is docked by default, and can be re-ordered, resized, collapsed or
 * undocked into a free-floating window. The layout is remembered per user.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import DualClockBar from '@/components/shared/DualClockBar';
import CoachBoard from '@/components/superadmin/CoachBoard';
import FronterBoard from '@/components/superadmin/FronterBoard';
import WebChatBoard from '@/components/superadmin/WebChatBoard';
import MarketingTab from '@/components/marketing/MarketingTab';
import FronterMonitorPanel from '@/components/fronter/FronterMonitorPanel';
import PortalNavButtons from '@/components/shared/PortalNavButtons';
import FloatingInboundPhone from '@/components/superadmin/FloatingInboundPhone';
import { C } from '@/components/superadmin/kit';

const TABS = [
  { id: 'coach', label: '🔵 Debt Call Coach' },
  { id: 'fronter', label: '🟢 Fronter' },
  { id: 'monitor', label: '📡 Fronter Monitor' },
  { id: 'webchat', label: '💬 Website Chat' },
  { id: 'split', label: '⚡ Split Screen' },
  { id: 'marketing', label: '📣 Marketing' },
];

const navBtn = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: C.ink, borderRadius: '4px', padding: '7px 12px', cursor: 'pointer',
  fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
};

export default function SuperAdminPortal() {
  const { user, loading, isAuthenticated, isAdmin, isSuperAdmin, logout, mustResetPassword, sessionToken } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('coach');

  if (loading) {
    return (
      <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.muted, fontSize: '14px' }}>Loading…</div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/debt-call-coach" replace />;
  // First-login password changes are handled by the assistant portal's reset form.
  if (mustResetPassword) return <Navigate to="/assistant-portal" replace />;

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: C.bg, color: C.ink, padding: '16px 20px 40px' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <img
          src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png"
          alt="Settlement IQ"
          style={{ width: '130px', height: 'auto', objectFit: 'contain' }}
        />
        <div>
          <div style={{ color: C.fronter, fontSize: '18px', fontWeight: 'bold' }}>Super Admin Command Center</div>
          <div style={{ color: C.muted, fontSize: '11px' }}>Source of truth · both auth systems, live, side by side</div>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}>
          <DualClockBar userTimezone={user?.timezone || 'America/New_York'} isSuperAdmin={isSuperAdmin} />
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ color: C.ink, fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</div>
          <span style={{ padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.15)', color: C.fronter, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {isSuperAdmin ? 'Super Admin' : 'Admin'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/manager-portal')} style={navBtn}>Manager</button>
          <button onClick={() => navigate('/compliance-portal')} style={navBtn}>Compliance</button>
          <button onClick={logout} style={navBtn}>Logout</button>
        </div>
      </header>

      {/* Cross-portal switcher */}
      <PortalNavButtons current="superadmin" isAdmin={isSuperAdmin || isAdmin} />

      <nav style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px', background: tab === t.id ? 'rgba(16,185,129,0.12)' : 'transparent',
              border: 'none', borderBottom: `2px solid ${tab === t.id ? C.fronter : 'transparent'}`,
              color: tab === t.id ? C.fronter : C.muted, cursor: 'pointer', fontSize: '13px',
              fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ color: C.dim, fontSize: '10px', alignSelf: 'center', paddingRight: '6px' }}>
          drag a card header to move it · ▭ resize · ⤢ undock · ▾ collapse
        </span>
      </nav>

      {tab === 'coach' && <CoachBoard username={user?.username} columns={3} />}
      {tab === 'fronter' && <FronterBoard username={user?.username} columns={3} />}
      {tab === 'monitor' && <FronterMonitorPanel embedded adminUsername={user?.username} />}
      {tab === 'webchat' && <WebChatBoard username={user?.username} adminUserId={user?.id} adminToken={sessionToken} />}
      {tab === 'marketing' && <MarketingTab username={user?.username} />}

      {tab === 'split' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(520px, 100%), 1fr))', gap: '16px', alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <CoachBoard username={user?.username} columns={2} splitHint />
          </div>
          <div style={{ minWidth: 0 }}>
            <FronterBoard username={user?.username} columns={2} splitHint />
          </div>
        </div>
      )}

      <FloatingInboundPhone username={user?.username} />
    </div>
  );
}