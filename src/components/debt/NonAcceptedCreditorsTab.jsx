/**
 * NonAcceptedCreditorsTab.jsx — Displays non-accepted creditors for a lead.
 * Shown as a 2nd tab in the debt area of DebtLeadCard.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function NonAcceptedCreditorsTab({ lead, update }) {
  const list = (() => { try { return JSON.parse(lead.nonAcceptedCreditorsJson || '[]'); } catch { return []; } })();
  const setList = (next) => update('nonAcceptedCreditorsJson', JSON.stringify(next));

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ creditor: '', balance: '', accountLast4: '', notes: '' });

  const add = () => {
    if (!form.creditor.trim()) return;
    setList([...list, {
      creditor: form.creditor.trim(),
      balance: form.balance ? Number(form.balance) : null,
      accountLast4: form.accountLast4 || '',
      notes: form.notes || '',
    }]);
    setForm({ creditor: '', balance: '', accountLast4: '', notes: '' });
    setAdding(false);
  };

  const remove = (i) => { const next = [...list]; next.splice(i, 1); setList(next); };

  const totalBalance = list.reduce((s, c) => s + (c.balance || 0), 0);

  return (
    <div>
      <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>{list.length}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Non-Accepted Creditors</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>${totalBalance.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Balance</div>
        </div>
      </div>

      {adding ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ color: '#ef4444', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>+ Add Non-Accepted Creditor</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={ls}>Creditor Name</label><input value={form.creditor} onChange={e => setForm(p => ({ ...p, creditor: e.target.value }))} placeholder="Sallie Mae" style={inp} /></div>
            <div><label style={ls}>Balance ($)</label><input type="number" value={form.balance} onChange={e => setForm(p => ({ ...p, balance: e.target.value }))} placeholder="25000" style={inp} /></div>
            <div><label style={ls}>Account Last 4</label><input value={form.accountLast4} onChange={e => setForm(p => ({ ...p, accountLast4: e.target.value }))} placeholder="1234" style={inp} /></div>
          </div>
          <div style={{ marginBottom: '10px' }}><label style={ls}>Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Student loan, secured, etc." style={inp} /></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={add} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Add</button>
            <button onClick={() => setAdding(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px dashed rgba(239,68,68,0.3)', borderRadius: '4px', padding: '10px', cursor: 'pointer', fontSize: '12px', marginBottom: '12px' }}>+ Add Non-Accepted Creditor</button>
      )}

      {list.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No non-accepted creditors yet. These are auto-populated when you cross-reference account types on the Credit Upload page.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {list.map((c, i) => (
            <div key={i} style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#ef4444', fontSize: '14px' }}>❌</span>
                  <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{c.creditor}</span>
                </div>
                <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                {c.balance != null && <span style={{ color: '#6b7280' }}>Balance: <strong style={{ color: '#e8e0d0' }}>${(c.balance || 0).toLocaleString()}</strong></span>}
                {c.accountLast4 && <span style={{ color: '#6b7280' }}>····{c.accountLast4}</span>}
              </div>
              {c.notes && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>{c.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}