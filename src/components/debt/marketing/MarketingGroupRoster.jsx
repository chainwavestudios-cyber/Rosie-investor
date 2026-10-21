/**
 * MarketingGroupRoster.jsx — every vault lead in the Debt Call Coach marketing
 * group, with whether it has been assigned to a campaign yet.
 */
const BLUE = '#60a5fa';
const GOLD = '#10b981';

const th = { padding: '7px 10px', color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' };
const td = { padding: '7px 10px', fontSize: '12px', color: '#e8e0d0', borderBottom: '1px solid rgba(255,255,255,0.04)' };

export default function MarketingGroupRoster({ group, loading }) {
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', padding: '18px' }}>
      <div style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
        Marketing group leads ({group.length})
      </div>

      {loading ? (
        <div style={{ color: '#8a9ab8', fontSize: '12px' }}>Loading…</div>
      ) : group.length === 0 ? (
        <div style={{ color: '#8a9ab8', fontSize: '12px' }}>
          No leads here yet — distribute validated leads to “DCC Marketing” from the Lead Vault to fill this group.
        </div>
      ) : (
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>State</th><th style={th}>Debt</th><th style={th}>Campaign</th></tr>
            </thead>
            <tbody>
              {group.slice(0, 200).map((lead) => (
                <tr key={lead.id}>
                  <td style={td}>{`${lead.firstName || ''} ${lead.lastName || ''}`.trim()}</td>
                  <td style={td}>{lead.email || <span style={{ color: '#f59e0b' }}>no email</span>}</td>
                  <td style={td}>{lead.state || '—'}</td>
                  <td style={td}>{lead.debtAmount ? `$${Number(lead.debtAmount).toLocaleString()}` : '—'}</td>
                  <td style={td}>
                    {lead.marketingCampaignId
                      ? <span style={{ color: GOLD, fontSize: '10px' }}>in a campaign</span>
                      : <span style={{ color: '#8a9ab8', fontSize: '10px' }}>available</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}