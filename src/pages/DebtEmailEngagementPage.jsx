/**
 * Standalone Email Engagement — same Gmail intelligence UI as the Debt Call
 * Coach tab. The shared panel stays the single source of truth for both entry
 * points; cross-system Super Admin / Assistant reporting remains unchanged.
 */
import { Link, Navigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import PortalNavButtons from '@/components/shared/PortalNavButtons';
import DebtCoachGmailEngagementPanel from '@/components/debt/DebtCoachGmailEngagementPanel';
import '@/components/debt/DebtCoachPolish.css';

export default function DebtEmailEngagementPage() {
  const { loading, isAuthenticated, mustResetPassword, isAdmin } = useDebtCoachAuth();
  if (loading) return <div style={{minHeight:'100vh',background:'#080f19',color:'#b1c8c4',display:'grid',placeItems:'center',font:'13px system-ui'}}>Loading Email Engagement…</div>;
  if (!isAuthenticated || mustResetPassword) return <Navigate to="/debt-call-coach-login" replace/>;
  if (!isAdmin) return <Navigate to="/debt-call-coach" replace/>;

  return <div className="dcc-shell" style={{minHeight:'100vh',background:'radial-gradient(ellipse at 70% -8%,rgba(27,77,66,.16),transparent 55%),#080f19',color:'#e8eae3',padding:'clamp(10px,1.55vw,22px)',fontFamily:'system-ui,-apple-system,sans-serif'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap',border:'1px solid rgba(157,191,183,.22)',borderRadius:12,background:'linear-gradient(105deg,#102734,#112b29,#111d2d)',padding:'11px 17px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <div className="dcc-logo-plaque">
          <img className="dcc-header-logo" src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ — Realtime Call Intelligence"/>
        </div>
        <div>
          <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:'#dfc382',fontWeight:800}}>Rosie AI · Dedicated workspace</div>
          <h1 style={{font:'normal clamp(18px,2vw,23px) Georgia,serif',color:'#f4ecdd',margin:'4px 0'}}>Email Engagement</h1>
          <div style={{fontSize:11,color:'#a6bdbf'}}>Same live dashboard as Debt Call Coach, now on its own page.</div>
        </div>
      </div>
      <Link to="/debt-call-coach?tab=engagement" style={{fontSize:11,padding:'9px 13px',border:'1px solid #49695e',borderRadius:8,background:'#19352f',color:'#e5d29d',textDecoration:'none',fontWeight:740}}>View inside Debt Call Coach</Link>
    </header>
    <PortalNavButtons current="engagement" isAdmin compact/>
    <main aria-label="Email Engagement Intelligence Center">
      <DebtCoachGmailEngagementPanel standalone/>
    </main>
  </div>;
}
