import { useState } from 'react';
import DebtGmailEngagement from './DebtGmailEngagement';

export default function DebtCoachGmailEngagementPanel() {
  const [view, setView] = useState('report');
  return <div>
    <nav aria-label="Debt Call Coach Gmail reporting" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button onClick={() => setView('report')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'report' ? '#125740' : '#121a2a', color: '#e9edf5' }}>Gmail Engagement</button>
      <button onClick={() => setView('old')} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: '1px solid #305144', background: view === 'old' ? '#125740' : '#121a2a', color: '#e9edf5' }}>OLD Follow-Up Report</button>
    </nav>
    <DebtGmailEngagement view={view} />
  </div>;
}
