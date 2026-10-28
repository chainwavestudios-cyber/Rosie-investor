import { useState } from 'react';
import { Link } from 'react-router-dom';
import DebtGmailEngagement from './DebtGmailEngagement';
import DebtCoachGmailCommandCenter from './DebtCoachGmailCommandCenter';

export default function DebtCoachGmailEngagementPanel({ standalone = false }) {
  const [view, setView] = useState('intelligence');
  return <div>
    <nav aria-label="Debt Call Coach Gmail reporting" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <button onClick={() => setView('intelligence')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'intelligence' ? '#125740' : '#121a2a', color: '#e9edf5' }}>Engagement Command Center</button>
      <button onClick={() => setView('report')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'report' ? '#125740' : '#121a2a', color: '#e9edf5' }}>Gmail Detail Report</button>
      <button onClick={() => setView('old')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'old' ? '#125740' : '#121a2a', color: '#e9edf5' }}>OLD Follow-Up Report</button>
      {!standalone && <Link to="/email-engagement" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(224,187,117,.44)', borderRadius: 7, padding: '8px 12px', color: '#edd097', background: '#152a2c', textDecoration: 'none', fontSize: 11, fontWeight: 750 }} aria-label="Open Email Engagement on its own page">Open full page ↗</Link>}
    </nav>
    {view === 'intelligence' ? <DebtCoachGmailCommandCenter /> : <DebtGmailEngagement view={view} />}
  </div>;
}
