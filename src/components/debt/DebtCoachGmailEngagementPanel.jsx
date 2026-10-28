import { useState } from 'react';
import DebtGmailEngagement from './DebtGmailEngagement';
import DebtCoachGmailCommandCenter from './DebtCoachGmailCommandCenter';

export default function DebtCoachGmailEngagementPanel() {
  const [view, setView] = useState('intelligence');
  return <div>
    <nav aria-label="Debt Call Coach Gmail reporting" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button onClick={() => setView('intelligence')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'intelligence' ? '#125740' : '#121a2a', color: '#e9edf5' }}>Engagement Command Center</button>
      <button onClick={() => setView('report')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'report' ? '#125740' : '#121a2a', color: '#e9edf5' }}>Gmail Detail Report</button>
      <button onClick={() => setView('old')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'old' ? '#125740' : '#121a2a', color: '#e9edf5' }}>OLD Follow-Up Report</button>
    </nav>
    {view === 'intelligence' ? <DebtCoachGmailCommandCenter /> : <DebtGmailEngagement view={view} />}
  </div>;
}
