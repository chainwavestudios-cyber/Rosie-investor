import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, GraduationCap, LogOut } from 'lucide-react';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import DebtBobTrainer from '@/components/debt/DebtBobTrainer';
import { BobBrand } from './BobMarketing';
import './BobSite.css';

/** Keeps every existing Debt Call Coach BOB training feature available to staff,
 * while paid external customers use the separately authorized /bob/portal app.
 */
export default function BobInternalPage(){
  const { user,loading,isAuthenticated,logout,mustResetPassword }=useDebtCoachAuth();
  if(loading)return <div className="bob-site"><div className="bob-empty" style={{maxWidth:450,margin:'25vh auto'}}>Opening your BOB studio…</div></div>;
  if(!isAuthenticated||mustResetPassword)return <Navigate to="/debt-call-coach-login" replace/>;
  return <div className="bob-site"><div className="bob-nav"><BobBrand/><div className="bob-nav-links">
    <Link className="bob-btn bob-btn-ghost" to="/debt-call-coach"><ArrowLeft size={14}/> Debt Call Coach</Link>
    <Link className="bob-btn bob-btn-ghost" to="/bob/portal">Commercial portal <ExternalLink size={13}/></Link>
    <button className="bob-btn bob-btn-ghost" onClick={logout}><LogOut size={13}/> Sign out</button>
  </div></div>
  <main className="bob-portal"><div className="bob-portal-top"><div><div className="bob-eyebrow">BOB · Original Training Studio</div><h1>BOB Training Intelligence</h1><div className="bob-portal-desc">Full internal simulator · Voice training · BobBrain · Scripts · Training logs</div></div><span className="bob-pill"><GraduationCap size={13}/> Staff workspace · {user?.username}</span></div>
    <DebtBobTrainer debtCoachUser={user}/>
  </main></div>;
}
