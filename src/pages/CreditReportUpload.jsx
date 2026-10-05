/**
 * CreditReportUpload.jsx — Tabbed page: Credit Report | Account Types | Settings
 * Route: /credit
 */
import { useState } from 'react';
import CreditReportTab from '@/components/credit/CreditReportTab';
import AccountTypesTab from '@/components/credit/AccountTypesTab';
import CreditorListSettings from '@/components/credit/CreditorListSettings';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

const TABS = [
  { id: 'credit-report', label: '📷 Credit Report' },
  { id: 'account-types', label: '✅ Account Types' },
  { id: 'settings', label: '⚙️ Creditor Lists' },
];

export default function CreditReportUpload() {
  const [tab, setTab] = useState('credit-report');

  return (
    <div style={{ minHeight: '100vh', background: DARK, padding: '20px 16px', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase' }}>Settlement IQ</div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '12px 8px', borderRadius: '8px',
              background: tab === t.id ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'transparent',
              color: tab === t.id ? DARK : '#6b7280',
              border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
              letterSpacing: '0.5px', whiteSpace: 'nowrap', transition: 'all 0.2s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'credit-report' && <CreditReportTab />}
        {tab === 'account-types' && <AccountTypesTab />}
        {tab === 'settings' && <CreditorListSettings />}
      </div>
    </div>
  );
}