/**
 * DoNothingCalculator.jsx — "Do Nothing" vs "Enroll in Program" comparison.
 * Based on the Debt Advisors of America Excel calculator.
 * Shows the compounding cost of minimum payments vs the program's negotiated settlement.
 */
import { useState, useMemo } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function DoNothingCalculator({ lead, scenario, mode = 'close' }) {
  // Derive inputs from lead or scenario
  const ledger = useMemo(() => {
    const raw = lead?.debtLedgerJson || scenario?.debtLedgerJson;
    try { return JSON.parse(raw || '[]'); } catch { return []; }
  }, [lead, scenario]);

  const totalDebt = lead?.debtAmount || scenario?.debtAmount
    ? Number(lead?.debtAmount || scenario?.debtAmount)
    : ledger.reduce((s, c) => s + (c.balance || 0), 0);

  const avgRate = ledger.length > 0
    ? ledger.reduce((s, c) => s + (c.interestRate || 0), 0) / ledger.length
    : 22; // default 22% if no ledger

  const currentMonthly = ledger.length > 0
    ? ledger.reduce((s, c) => s + (c.monthlyPayment || 0), 0)
    : 0;

  const [inputs, setInputs] = useState({
    totalDebt: totalDebt || 25000,
    avgInterestRate: avgRate,
    currentMonthlyPayment: currentMonthly || 600,
    settlementPct: 50,   // program negotiates down to 50% of debt
    programFeePct: 22,   // 22% of enrolled debt
    programMonths: 36,   // 36 month program
  });

  // Sync when lead/scenario changes
  useMemo(() => {
    setInputs(prev => ({
      ...prev,
      totalDebt: totalDebt || prev.totalDebt,
      avgInterestRate: avgRate || prev.avgInterestRate,
      currentMonthlyPayment: currentMonthly || prev.currentMonthlyPayment,
    }));
  }, [totalDebt, avgRate, currentMonthly]);

  const update = (field, val) => setInputs(prev => ({ ...prev, [field]: val ? Number(val) : 0 }));

  // ── Calculations ──────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const { totalDebt, avgInterestRate, currentMonthlyPayment, settlementPct, programFeePct, programMonths } = inputs;
    const monthlyRate = (avgInterestRate / 100) / 12;

    // DO NOTHING: How long to pay off with minimum payments?
    // If monthly payment covers interest, calculate months to payoff
    let doNothingMonths = 0;
    let doNothingTotalPaid = 0;
    if (currentMonthlyPayment > 0 && totalDebt > 0) {
      if (monthlyRate > 0) {
        const minPaymentForInterest = totalDebt * monthlyRate;
        if (currentMonthlyPayment <= minPaymentForInterest) {
          // Payment doesn't even cover interest — never pays off
          doNothingMonths = 600; // 50 years cap
          doNothingTotalPaid = totalDebt * 2.214; // compounding multiplier from Excel
        } else {
          // Amortization: n = -ln(1 - (P*r)/PM) / ln(1+r)
          const n = -Math.log(1 - (totalDebt * monthlyRate) / currentMonthlyPayment) / Math.log(1 + monthlyRate);
          doNothingMonths = Math.ceil(n);
          doNothingTotalPaid = currentMonthlyPayment * doNothingMonths;
        }
      } else {
        doNothingMonths = Math.ceil(totalDebt / currentMonthlyPayment);
        doNothingTotalPaid = totalDebt;
      }
    }
    const doNothingYears = (doNothingMonths / 12).toFixed(1);
    const doNothingInterestPaid = doNothingTotalPaid - totalDebt;

    // PROGRAM: Settlement + Fee
    const settlementAmount = totalDebt * (settlementPct / 100);
    const programFee = totalDebt * (programFeePct / 100);
    const programTotal = settlementAmount + programFee;
    const programMonthly = programTotal / programMonths;

    // SAVINGS
    const totalSavings = doNothingTotalPaid - programTotal;
    const savingsPct = doNothingTotalPaid > 0 ? ((totalSavings / doNothingTotalPaid) * 100).toFixed(0) : 0;

    return {
      doNothingMonths, doNothingYears, doNothingTotalPaid, doNothingInterestPaid,
      settlementAmount, programFee, programTotal, programMonthly,
      totalSavings, savingsPct,
    };
  }, [inputs]);

  const fmt = (n) => n ? `$${Math.round(n).toLocaleString()}` : '$0';

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '18px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>📊 Do Nothing Calculator</div>
        <div style={{ color: '#6b7280', fontSize: '11px' }}>Compare the cost of doing nothing vs enrolling in the program</div>
      </div>

      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div>
          <label style={ls}>Total Debt</label>
          <input type="number" value={inputs.totalDebt} onChange={e => update('totalDebt', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Avg Interest Rate (%)</label>
          <input type="number" step="0.01" value={inputs.avgInterestRate} onChange={e => update('avgInterestRate', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Current Monthly Payment</label>
          <input type="number" value={inputs.currentMonthlyPayment} onChange={e => update('currentMonthlyPayment', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Settlement %</label>
          <input type="number" value={inputs.settlementPct} onChange={e => update('settlementPct', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Program Fee %</label>
          <input type="number" value={inputs.programFeePct} onChange={e => update('programFeePct', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Program Length (months)</label>
          <input type="number" value={inputs.programMonths} onChange={e => update('programMonths', e.target.value)} style={inp} />
        </div>
      </div>

      {/* Results comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        {/* Do Nothing */}
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ color: '#ef4444', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>❌ Do Nothing (Minimum Payments)</div>
          <div style={{ color: '#e8e0d0', fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>{fmt(results.doNothingTotalPaid)}</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '12px' }}>Total paid over {results.doNothingYears} years ({results.doNothingMonths} months)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Row label="Principal" value={fmt(inputs.totalDebt)} />
            <Row label="Interest Paid" value={fmt(results.doNothingInterestPaid)} color="#ef4444" />
            <Row label="Monthly Payment" value={fmt(inputs.currentMonthlyPayment)} />
          </div>
        </div>

        {/* Program */}
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>✅ Enroll in Program</div>
          <div style={{ color: '#e8e0d0', fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>{fmt(results.programTotal)}</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '12px' }}>Total paid over {inputs.programMonths} months ({(inputs.programMonths / 12).toFixed(1)} years)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Row label="Settlement Amount" value={fmt(results.settlementAmount)} />
            <Row label="Program Fee" value={fmt(results.programFee)} />
            <Row label="Monthly Payment" value={fmt(results.programMonthly)} color={GOLD} />
          </div>
        </div>
      </div>

      {/* Savings banner */}
      <div style={{ background: `linear-gradient(135deg, rgba(16,185,129,0.15), rgba(34,197,94,0.08))`, border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>💰 Total Savings</div>
        <div style={{ color: GOLD, fontSize: '36px', fontWeight: 'bold' }}>{fmt(results.totalSavings)}</div>
        <div style={{ color: '#e8e0d0', fontSize: '13px', marginTop: '4px' }}>You save {results.savingsPct}% by enrolling · Pay off in {inputs.programMonths} months instead of {results.doNothingMonths}</div>
      </div>

      {/* Talking Points */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '14px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>🗣 Customer Talking Points</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <TalkingPoint icon="❌" color="#ef4444">
            If you continue to make your current monthly payments of {fmt(inputs.currentMonthlyPayment)} for the next {results.doNothingMonths} months ({results.doNothingYears} years), you will end up paying <strong style={{ color: '#e8e0d0' }}>{fmt(results.doNothingTotalPaid)}</strong> — that's <strong style={{ color: '#ef4444' }}>{fmt(results.doNothingInterestPaid)}</strong> in interest alone.
          </TalkingPoint>
          <TalkingPoint icon="✅" color={GOLD}>
            If you enroll and make your program payments of {fmt(results.programMonthly)}/month for the next {inputs.programMonths} months, you will end up paying <strong style={{ color: '#e8e0d0' }}>{fmt(results.programTotal)}</strong> total — and be completely debt-free in {(inputs.programMonths / 12).toFixed(1)} years.
          </TalkingPoint>
          <TalkingPoint icon="💰" color={GOLD}>
            That's a savings of <strong style={{ color: GOLD }}>{fmt(results.totalSavings)}</strong> ({results.savingsPct}%) and you'll be debt-free {Math.max(0, results.doNothingMonths - inputs.programMonths)} months sooner.
          </TalkingPoint>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color = '#c4cdd8' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}

function TalkingPoint({ icon, color, children }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}