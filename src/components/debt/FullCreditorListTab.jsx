/**
 * FullCreditorListTab.jsx — Shows the full creditor list from the uploaded
 * credit report image: both accepted (debt ledger) and non-accepted creditors.
 * Shown as a section in the Debt Details tab of DebtLeadCard.
 */
import { matchCreditorRule } from '@/components/debt/creditorRules';

export default function FullCreditorListTab({ lead }) {
  const ledger = (() => { try { return JSON.parse(lead.debtLedgerJson || '[]'); } catch { return []; } })();
  const nonAccepted = (() => { try { return JSON.parse(lead.nonAcceptedCreditorsJson || '[]'); } catch { return []; } })();

  const totalAccepted = ledger.reduce((s, c) => s + (c.balance || 0), 0);
  const totalNonAccepted = nonAccepted.reduce((s, c) => s + (c.balance || 0), 0);
  const totalAll = totalAccepted + totalNonAccepted;

  if (ledger.length === 0 && nonAccepted.length === 0) {
    return <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No creditors uploaded yet. Upload a credit report image on the Credit Upload page to populate this list.</div>;
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
          <div style={{ color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>${totalAccepted.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>Accepted ({ledger.length})</div>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
          <div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>${totalNonAccepted.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>Non-Accepted ({nonAccepted.length})</div>
        </div>
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
          <div style={{ color: '#60a5fa', fontSize: '16px', fontWeight: 'bold' }}>${totalAll.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>Total Debt</div>
        </div>
      </div>

      {/* Accepted creditors */}
      {ledger.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>✅ Accepted Creditors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ledger.map((c, i) => {
              const rule = matchCreditorRule(c.creditor);
              return (
                <div key={i} style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '4px', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#10b981', fontSize: '12px' }}>✓</span>
                      <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{c.creditor}</span>
                    </div>
                    {c.balance != null && <span style={{ color: '#c4cdd8', fontSize: '12px' }}>${(c.balance || 0).toLocaleString()}</span>}
                  </div>
                  {c.accountLast4 && <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>Account ending in {c.accountLast4}</div>}
                  {rule && (
                    <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '3px' }}>
                      <div style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>⚠ Rule: {rule.name}</div>
                      <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4 }}>{rule.rule}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-accepted creditors */}
      {nonAccepted.length > 0 && (
        <div>
          <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>❌ Non-Accepted Creditors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {nonAccepted.map((c, i) => (
              <div key={i} style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#ef4444', fontSize: '12px' }}>✕</span>
                    <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{c.creditor}</span>
                  </div>
                  {c.balance != null && <span style={{ color: '#c4cdd8', fontSize: '12px' }}>${(c.balance || 0).toLocaleString()}</span>}
                </div>
                {c.accountLast4 && <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>Account ending in {c.accountLast4}</div>}
                {c.notes && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>{c.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}