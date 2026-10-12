/**
 * AIPopulateTab — Shared tab component for both FronterContactCard and
 * ClientProfileModal. Displays the AI Populate overwrite log (field name,
 * old value, new value, timestamp) and any missing fields from the last sweep.
 */
import { useState, useEffect } from 'react';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const PURPLE = '#a78bfa';

// Human-readable labels for entity fields
const FIELD_LABELS = {
  firstName: 'First Name', lastName: 'Last Name', phone: 'Phone', phone2: 'Secondary Phone',
  email: 'Email', address: 'Address', city: 'City', state: 'State', zip: 'Zip', zipCode: 'Zip Code',
  dateOfBirth: 'Date of Birth', debtAmount: 'Debt Amount', creditorCount: 'Creditor Count',
  creditors: 'Creditors', employmentStatus: 'Employment Status', annualIncome: 'Annual Income',
  monthlyIncome: 'Monthly Income', creditScore: 'Credit Score', behindOnPayments: 'Behind on Payments',
  monthsBehind: 'Months Behind', preferredCallTime: 'Best Time to Call',
  hardshipQualification: 'Hardship Qualification', hardshipWhen: 'Hardship — When',
  hardshipWhy: 'Hardship — Why', hardshipHow: 'Hardship — How', referralSource: 'Lead Source',
};

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function AIPopulateTab({ lead }) {
  const [log, setLog] = useState([]);

  useEffect(() => {
    try { setLog(JSON.parse(lead?.aiPopulateLogJson || '[]')); } catch { setLog([]); }
  }, [lead?.aiPopulateLogJson]);

  const reversed = [...log].reverse(); // newest first

  return (
    <div>
      <div style={{ color: PURPLE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🤖 AI Populate Log</div>

      <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px' }}>
        The AI Contact Filler reviews the live call transcript every 5 minutes and at call end, auto-populating fields the customer provided. When it overwrites an existing value, the change is logged here so you can catch errors.
      </div>

      {reversed.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>
          No AI populate overwrites yet. The filler will log here when it updates existing fields during a call.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {reversed.map((entry, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${entry.isFinal ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: PURPLE, fontSize: '11px', fontWeight: 'bold' }}>{FIELD_LABELS[entry.fieldName] || entry.fieldName}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {entry.isFinal && <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(167,139,250,0.15)', color: PURPLE, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End of Call</span>}
                  <span style={{ color: '#4a5568', fontSize: '9px' }}>{fmtTime(entry.timestamp)}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '3px', padding: '6px 8px' }}>
                  <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Old</div>
                  <div style={{ color: '#ef4444', fontSize: '11px', wordBreak: 'break-word' }}>{entry.oldValue || '(empty)'}</div>
                </div>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>→</span>
                <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '3px', padding: '6px 8px' }}>
                  <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>New</div>
                  <div style={{ color: GOLD, fontSize: '11px', wordBreak: 'break-word' }}>{entry.newValue || '(empty)'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}