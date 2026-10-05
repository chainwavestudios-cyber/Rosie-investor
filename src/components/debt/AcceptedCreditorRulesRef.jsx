/**
 * AcceptedCreditorRulesRef.jsx — Collapsible reference panel listing all
 * acceptable creditors with rules and exceptions. Shown in the Debt Ledger tab.
 */
import { useState } from 'react';
import { ACCEPTED_CREDITOR_RULES } from '@/components/debt/creditorRules';

const GOLD = '#10b981';

export default function AcceptedCreditorRulesRef() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? ACCEPTED_CREDITOR_RULES.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.rule.toLowerCase().includes(search.toLowerCase()))
    : ACCEPTED_CREDITOR_RULES;

  return (
    <div style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(p => !p)} style={{ width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
        <span>📋 Accepted Creditor Rules ({ACCEPTED_CREDITOR_RULES.length})</span>
        <span style={{ color: '#6b7280', fontSize: '14px' }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(16,185,129,0.1)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules…" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', marginTop: '10px', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {filtered.map((r, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: '4px', padding: '8px 10px' }}>
                <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{r.name}</div>
                <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5 }}>{r.rule}</div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ color: '#4a5568', textAlign: 'center', padding: '16px 0', fontSize: '12px' }}>No rules match "{search}".</div>}
          </div>
        </div>
      )}
    </div>
  );
}