/**
 * DebtTab.jsx — Debt details tab for the lead contact card.
 * Add/edit/view creditors with balances, interest rates, and payment schedules.
 * Stored on the Lead entity via debtLedgerJson (JSON array) + debtAmount/creditorCount summary.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const EMPTY_CREDITOR = { creditor: '', balance: '', interestRate: '', monthlyPayment: '', paymentSchedule: '', accountLast4: '', notes: '' };

export default function DebtTab({ lead, onUpdate }) {
  const [creditors, setCreditors] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [draft, setDraft] = useState([]);

  // Load creditors from lead.debtLedgerJson
  useEffect(() => {
    let parsed = [];
    try { parsed = JSON.parse(lead?.debtLedgerJson || '[]'); } catch { parsed = []; }
    setCreditors(Array.isArray(parsed) ? parsed : []);
  }, [lead?.id, lead?.debtLedgerJson]);

  const startEdit = () => { setDraft(creditors.length > 0 ? creditors.map(c => ({ ...c })) : [{ ...EMPTY_CREDITOR }]); setEditing(true); };

  const cancelEdit = () => { setEditing(false); setDraft([]); };

  const addCreditor = () => setDraft(prev => [...prev, { ...EMPTY_CREDITOR }]);

  const removeCreditor = (i) => setDraft(prev => prev.filter((_, idx) => idx !== i));

  const updateCreditor = (i, field, value) => {
    setDraft(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const save = async () => {
    setSaving(true); setSaveMsg('');
    try {
      // Clean: filter out completely empty rows, parse numbers
      const cleaned = draft
        .filter(c => (c.creditor && c.creditor.trim()) || c.balance || c.monthlyPayment)
        .map(c => ({
          creditor: (c.creditor || '').trim(),
          balance: c.balance !== '' && c.balance != null ? Number(c.balance) : null,
          interestRate: c.interestRate !== '' && c.interestRate != null ? Number(c.interestRate) : null,
          monthlyPayment: c.monthlyPayment !== '' && c.monthlyPayment != null ? Number(c.monthlyPayment) : null,
          paymentSchedule: (c.paymentSchedule || '').trim(),
          accountLast4: (c.accountLast4 || '').trim(),
          notes: (c.notes || '').trim(),
        }));

      const totalDebt = cleaned.reduce((sum, c) => sum + (c.balance || 0), 0);
      const updates = {
        debtLedgerJson: JSON.stringify(cleaned),
        debtAmount: totalDebt || null,
        creditorCount: cleaned.length,
      };
      await base44.entities.Lead.update(lead.id, updates);
      setCreditors(cleaned);
      setEditing(false);
      setDraft([]);
      setSaveMsg('✓ Saved');
      onUpdate && onUpdate();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg('Error: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  // Summary calculations
  const totalBalance = creditors.reduce((s, c) => s + (c.balance || 0), 0);
  const totalMonthly = creditors.reduce((s, c) => s + (c.monthlyPayment || 0), 0);
  const avgInterest = creditors.length > 0
    ? (creditors.reduce((s, c) => s + (c.interestRate || 0), 0) / creditors.filter(c => c.interestRate != null).length || 0)
    : 0;

  const fmtMoney = (v) => v != null && !isNaN(v) ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—';

  if (editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 Edit Debt Details</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {saveMsg && <span style={{ color: saveMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize: '12px' }}>{saveMsg}</span>}
            <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{saving ? 'Saving…' : '💾 Save'}</button>
            <button onClick={cancelEdit} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
          </div>
        </div>

        {draft.map((c, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Creditor #{i + 1}</span>
              {draft.length > 1 && (
                <button onClick={() => removeCreditor(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕ Remove</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={ls}>🏦 Creditor Name</label>
                <input value={c.creditor || ''} onChange={e => updateCreditor(i, 'creditor', e.target.value)} placeholder="e.g. Chase, Capital One, Discover" style={inp} />
              </div>
              <div>
                <label style={ls}>💰 Balance ($)</label>
                <input type="number" value={c.balance || ''} onChange={e => updateCreditor(i, 'balance', e.target.value)} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={ls}>% Interest Rate</label>
                <input type="number" step="0.01" value={c.interestRate || ''} onChange={e => updateCreditor(i, 'interestRate', e.target.value)} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={ls}>📅 Monthly Payment ($)</label>
                <input type="number" value={c.monthlyPayment || ''} onChange={e => updateCreditor(i, 'monthlyPayment', e.target.value)} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={ls}>🗓 Payment Schedule</label>
                <input value={c.paymentSchedule || ''} onChange={e => updateCreditor(i, 'paymentSchedule', e.target.value)} placeholder="e.g. 15th of month" style={inp} />
              </div>
              <div>
                <label style={ls}>🔢 Account Last 4</label>
                <input value={c.accountLast4 || ''} onChange={e => updateCreditor(i, 'accountLast4', e.target.value)} placeholder="1234" style={inp} maxLength={4} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={ls}>📝 Notes</label>
                <input value={c.notes || ''} onChange={e => updateCreditor(i, 'notes', e.target.value)} placeholder="e.g. Behind 3 months, in collections" style={inp} />
              </div>
            </div>
          </div>
        ))}

        <button onClick={addCreditor} style={{ background: 'rgba(184,147,58,0.1)', color: GOLD, border: '1px dashed rgba(184,147,58,0.4)', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', width: '100%' }}>+ Add Another Creditor</button>
      </div>
    );
  }

  // View mode
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 Debt Details</div>
        <button onClick={startEdit} style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.35)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{creditors.length > 0 ? '✏️ Edit' : '+ Add Debt Info'}</button>
      </div>

      {creditors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
          <h3 style={{ color: '#4a5568', fontWeight: 'normal', marginBottom: '10px' }}>No debt details yet</h3>
          <p style={{ color: '#374151', fontSize: '13px', maxWidth: '360px', margin: '0 auto', lineHeight: 1.7 }}>
            Click <strong style={{ color: GOLD }}>+ Add Debt Info</strong> to input creditors, balances, interest rates, and payment schedules for this customer.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
              <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>{fmtMoney(totalBalance)}</div>
              <div style={{ color: '#4a5568', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Debt</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
              <div style={{ color: '#60a5fa', fontSize: '18px', fontWeight: 'bold' }}>{creditors.length}</div>
              <div style={{ color: '#4a5568', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Creditors</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
              <div style={{ color: '#4ade80', fontSize: '18px', fontWeight: 'bold' }}>{fmtMoney(totalMonthly)}</div>
              <div style={{ color: '#4a5568', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Monthly Payments</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
              <div style={{ color: '#a78bfa', fontSize: '18px', fontWeight: 'bold' }}>{avgInterest > 0 ? `${avgInterest.toFixed(1)}%` : '—'}</div>
              <div style={{ color: '#4a5568', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Avg Interest</div>
            </div>
          </div>

          {/* Creditor cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {creditors.map((c, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🏦</span>
                    <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{c.creditor || 'Unnamed Creditor'}</span>
                    {c.accountLast4 && <span style={{ color: '#6b7280', fontSize: '11px', fontFamily: 'monospace' }}>••••{c.accountLast4}</span>}
                  </div>
                  {c.balance != null && (
                    <span style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>{fmtMoney(c.balance)}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {c.interestRate != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#4a5568', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Interest:</span>
                      <span style={{ color: '#a78bfa', fontSize: '12px', fontWeight: 'bold' }}>{c.interestRate}%</span>
                    </div>
                  )}
                  {c.monthlyPayment != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#4a5568', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Monthly:</span>
                      <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>{fmtMoney(c.monthlyPayment)}</span>
                    </div>
                  )}
                  {c.paymentSchedule && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#4a5568', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Schedule:</span>
                      <span style={{ color: '#8a9ab8', fontSize: '12px' }}>{c.paymentSchedule}</span>
                    </div>
                  )}
                </div>
                {c.notes && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>📝 {c.notes}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}