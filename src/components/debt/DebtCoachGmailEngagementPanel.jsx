import { useState } from 'react';
import { Link } from 'react-router-dom';
import DebtGmailEngagement from './DebtGmailEngagement';
import DebtCoachGmailCommandCenter from './DebtCoachGmailCommandCenter';
import DebtLegacyEmailTracking from './DebtLegacyEmailTracking';
import DebtEmailCampaignAnalytics from './DebtEmailCampaignAnalytics';

export default function DebtCoachGmailEngagementPanel({ standalone = false }) {
  const [view, setView] = useState(() => { try { const initial = new URLSearchParams(window.location.search).get('view'); return initial === 'campaigns' ? 'campaigns' : 'intelligence'; } catch { return 'intelligence'; } });
  return <div>
    <nav aria-label="Debt Call Coach Gmail reporting" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <button onClick={() => setView('intelligence')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'intelligence' ? '#125740' : '#121a2a', color: '#e9edf5' }}>Engagement Command Center</button>
      <button onClick={() => setView('campaigns')} aria-pressed={view === 'campaigns'} style={{ cursor: 'pointer', padding: '8px 14px', borderRadius: 6, border: '1px solid '+(view === 'campaigns' ? 'rgba(224,187,117,.85)' : '#305144'), background: view === 'campaigns' ? 'linear-gradient(110deg,#5c4b27,#294138)' : '#121a2a', color: view === 'campaigns' ? '#ffe5b2' : '#e9edf5', fontWeight: view === 'campaigns' ? 850 : 700 }}>Campaign View</button>
      <button onClick={() => setView('legacy')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid '+(view === 'legacy' ? 'rgba(224,187,117,.65)' : '#305144'), background: view === 'legacy' ? 'rgba(176,133,57,.25)' : '#121a2a', color: view === 'legacy' ? '#f5dfaa' : '#e9edf5', fontWeight: view === 'legacy' ? 800 : 600 }}>Legacy Tracking</button>
      <button onClick={() => setView('report')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'report' ? '#125740' : '#121a2a', color: '#e9edf5' }}>Gmail Detail Report</button>
      <button onClick={() => setView('old')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'old' ? '#125740' : '#121a2a', color: '#e9edf5' }}>OLD Follow-Up Report</button>
      {!standalone && <Link to="/email-engagement" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(224,187,117,.44)', borderRadius: 7, padding: '8px 12px', color: '#edd097', background: '#152a2c', textDecoration: 'none', fontSize: 11, fontWeight: 750 }} aria-label="Open Email Engagement on its own page">Open full page ↗</Link>}
    </nav>
    {view === 'intelligence' ? <DebtCoachGmailCommandCenter /> : view === 'campaigns' ? <DebtEmailCampaignAnalytics /> : view === 'legacy' ? <DebtLegacyEmailTracking /> : <DebtGmailEngagement view={view} />}
  </div>;
}
