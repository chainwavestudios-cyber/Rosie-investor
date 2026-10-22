/**
 * MarketingTab.jsx — The Marketing section for the assistant and super admin
 * command centers. Sub-tabs hold the outbound marketing tooling; Rate Drop
 * Mailers is the first.
 */
import { useState } from 'react';
import RateDropMailersTab from './RateDropMailersTab';
import TemplateTestSender from './TemplateTestSender';

const GOLD = '#10b981';

const SUB_TABS = [
  { id: 'rate_drop_mailers', label: '📨 Rate Drop Mailers' },
  { id: 'test_emails', label: '🧪 Test Emails' },
];

export default function MarketingTab({ username }) {
  const [sub, setSub] = useState('rate_drop_mailers');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold' }}>📣 Marketing</div>
        <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
          Outbound campaigns to prospect contact cards — Mailjet templates with the Rate Drop digital mailer injected
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            style={{
              padding: '9px 16px', background: sub === t.id ? `${GOLD}12` : 'transparent', border: 'none',
              borderBottom: `2px solid ${sub === t.id ? GOLD : 'transparent'}`,
              color: sub === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px',
              fontWeight: sub === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'rate_drop_mailers' && <RateDropMailersTab username={username} />}
      {sub === 'test_emails' && <TemplateTestSender system="fronter" username={username} />}
    </div>
  );
}