/**
 * PortalNavButtons.jsx — the large cross-portal switcher shown at the top of
 * every admin surface: Super Admin Portal, Fronter, Assistant Portal, Coach.
 * The page you are on is highlighted; admin-only portals stay hidden from fronters.
 */
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Target, BriefcaseBusiness, Headphones, ChartNoAxesCombined, Workflow, FileCheck2, ChevronRight } from 'lucide-react';

const ITEMS = [
  { key: 'superadmin', label: 'Super Admin Portal', icon: '🛡', path: '/superadmin-portal', accent: '#f59e0b', adminOnly: true },
  { key: 'fronter', label: 'Fronter', icon: '🎯', path: '/fronter', accent: '#10b981', adminOnly: false },
  { key: 'assistant', label: 'Assistant Portal', icon: '🗂', path: '/assistant-portal', accent: '#60a5fa', adminOnly: true },
  { key: 'coach', label: 'Debt Call Coach', icon: '🎧', path: '/debt-call-coach', accent: '#a78bfa', adminOnly: false },
  { key: 'engagement', label: 'Email Engagement', icon: '📈', path: '/email-engagement', accent: '#2dd4bf', adminOnly: true },
  { key: 'automations', label: 'Automations & Scoring', icon: '⚙️', path: '/automations', accent: '#38bdf8', adminOnly: true },
  { key: 'evidence', label: 'Evidence Review', icon: '📄', path: '/evidence-review', accent: '#e879f9', adminOnly: true },
];

const COMPACT_ICONS = { superadmin:ShieldCheck,fronter:Target,assistant:BriefcaseBusiness,coach:Headphones,engagement:ChartNoAxesCombined,automations:Workflow,evidence:FileCheck2 };

export default function PortalNavButtons({ current, isAdmin = false, compact = false }) {
  const navigate = useNavigate();
  // Only Debt Call Coach opts into compact mode. Existing portal appearances
  // and their access rules remain unchanged.
  if (compact) return (
    <nav className="dcc-portal-nav" aria-label="Switch between workspaces">
      <span className="dcc-portal-nav-label">WORKSPACES <ChevronRight size={13} aria-hidden="true"/></span>
      <div className="dcc-portal-nav-scroll">
        {ITEMS.filter(item=>!item.adminOnly||isAdmin).map(item=>{
          const active=item.key===current;
          const Icon=COMPACT_ICONS[item.key];
          return <button key={item.key} type="button" onClick={()=>{if(!active)navigate(item.path);}}
            aria-current={active?'page':undefined} aria-label={item.label}
            title={active?`${item.label} — current workspace`:`Switch to ${item.label}`}
            disabled={active} className={'dcc-portal-link'+(active?' is-active':'')}>
              <Icon size={14} strokeWidth={1.8} aria-hidden="true"/><span>{item.label}</span>
            </button>;
        })}
      </div>
    </nav>
  );

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