/**
 * PortalNavButtons.jsx — the large cross-portal switcher shown at the top of
 * every admin surface: Super Admin Portal, Fronter, Assistant Portal, Coach.
 * The page you are on is highlighted; admin-only portals stay hidden from fronters.
 */
import { useNavigate } from 'react-router-dom';

const ITEMS = [
  { key: 'superadmin', label: 'Super Admin Portal', icon: '🛡', path: '/superadmin-portal', accent: '#f59e0b', adminOnly: true },
  { key: 'fronter', label: 'Fronter', icon: '🎯', path: '/fronter', accent: '#10b981', adminOnly: false },
  { key: 'assistant', label: 'Assistant Portal', icon: '🗂', path: '/assistant-portal', accent: '#60a5fa', adminOnly: true },
  { key: 'coach', label: 'Debt Call Coach', icon: '🎧', path: '/debt-call-coach', accent: '#a78bfa', adminOnly: false },
];

export default function PortalNavButtons({ current, isAdmin = false }) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '14px 0 18px' }}>
      {ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
        const active = item.key === current;
        return (
          <button
            key={item.key}
            onClick={() => { if (!active) navigate(item.path); }}
            disabled={active}
            style={{
              flex: '1 1 200px', minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
              padding: '15px 22px', borderRadius: '6px', cursor: active ? 'default' : 'pointer',
              fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.5px',
              color: active ? '#0a0f1e' : item.accent,
              background: active ? item.accent : `${item.accent}14`,
              border: `2px solid ${active ? item.accent : `${item.accent}55`}`,
              boxShadow: active ? `0 0 20px ${item.accent}55` : 'none',
            }}
          >
            <span style={{ fontSize: '19px' }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}