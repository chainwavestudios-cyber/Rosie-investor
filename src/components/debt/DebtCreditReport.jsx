/**
 * DebtCreditReport.jsx — Movable mock credit report window for BOB training.
 * Pops up during active calls: shows customer info + lines of credit that total to the debt amount.
 */
import { useState, useEffect, useMemo } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function DebtCreditReport({ scenario, visible }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    setPos({ x: window.innerWidth - 420, y: 140 });
  }, []);

  // Generate credit lines from creditors that add up to the total debt
  const creditLines = useMemo(() => {
    const creditors = (scenario?.creditors || '').split(',').map(c => c.trim()).filter(Boolean);
    const totalDebt = Number(scenario?.debtAmount || 0);
    if (creditors.length === 0 || totalDebt === 0) return [];

    // Distribute with deterministic variation per creditor index
    const weights = creditors.map((_, i) => 0.5 + Math.abs(Math.sin(i * 1.7 + 0.3)) * 1.5);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    return creditors.map((name, i) => {
      const balance = Math.round((totalDebt * weights[i] / weightSum) / 10) * 10;
      const limit = Math.round(balance * (1.15 + Math.abs(Math.sin(i * 2.3)) * 0.4) / 10) * 10;
      const minPayment = Math.max(25, Math.round(balance * 0.025));
      const apr = (16 + Math.abs(Math.sin(i * 3.1)) * 14).toFixed(1);
      const opened = ['2019', '2020', '2021', '2018', '2017', '2016', '2022', '2015'][i % 8];
      return { name, balance, limit, minPayment, apr, opened };
    });
  }, [scenario?.creditors, scenario?.debtAmount]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const w = minimized ? 260 : 380;
      const h = minimized ? 50 : 500;
      const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - offset.x));
      const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - offset.y));
      setPos({ x, y });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, offset, minimized]);

  if (!visible) return null;

  const totalDebt = Number(scenario?.debtAmount || 0);
  const totalLimit = creditLines.reduce((s, l) => s + l.limit, 0);
  const totalMinPayment = creditLines.reduce((s, l) => s + l.minPayment, 0);
  const utilization = totalLimit > 0 ? Math.round((totalDebt / totalLimit) * 100) : 0;

  const fullName = scenario?.customerName || 'Bob';
  const fullAddress = [scenario?.customerAddress, scenario?.customerCity, scenario?.customerState, scenario?.customerZip].filter(Boolean).join(', ') || 'Unspecified';

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: minimized ? '260px' : '380px',
      zIndex: 9999, background: DARK, border: `1px solid ${GOLD}44`, borderRadius: '6px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontFamily: 'Georgia, serif',
    }}>
      {/* Header — draggable */}
      <div
        onMouseDown={(e) => { setDragging(true); setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y }); }}
        style={{ cursor: 'move', padding: '10px 14px', background: `${GOLD}12`, borderBottom: `1px solid ${GOLD}33`, borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>📋</span>
          <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Credit Report</span>
        </div>
        <button onClick={() => setMinimized(!minimized)} style={{ background: 'none', border: 'none', color: '#8a9ab8', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>{minimized ? '▾' : '▴'}</button>
      </div>

      {!minimized && (
        <>
          {/* Customer Info */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>{fullName}</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.7 }}>
              <div>📍 {fullAddress}</div>
              <div>📞 {scenario?.phone || 'N/A'}</div>
              <div>📄 Notice #: {scenario?.noticeNumber || 'N/A'}</div>
            </div>
          </div>

          {/* Credit Lines */}
          <div style={{ padding: '10px 14px', maxHeight: '280px', overflowY: 'auto' }}>
            <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Revolving Accounts</div>
            {creditLines.length === 0 ? (
              <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px 0' }}>No creditors in scenario</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 2px', color: '#6b7280', fontWeight: 'normal' }}>Creditor</th>
                    <th style={{ textAlign: 'right', padding: '4px 2px', color: '#6b7280', fontWeight: 'normal' }}>Balance</th>
                    <th style={{ textAlign: 'right', padding: '4px 2px', color: '#6b7280', fontWeight: 'normal' }}>Limit</th>
                    <th style={{ textAlign: 'right', padding: '4px 2px', color: '#6b7280', fontWeight: 'normal' }}>Min</th>
                    <th style={{ textAlign: 'right', padding: '4px 2px', color: '#6b7280', fontWeight: 'normal' }}>APR</th>
                  </tr>
                </thead>
                <tbody>
                  {creditLines.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '5px 2px', color: '#e8e0d0', fontSize: '10px' }}>{l.name}</td>
                      <td style={{ padding: '5px 2px', color: '#ef4444', textAlign: 'right' }}>${l.balance.toLocaleString()}</td>
                      <td style={{ padding: '5px 2px', color: '#8a9ab8', textAlign: 'right' }}>${l.limit.toLocaleString()}</td>
                      <td style={{ padding: '5px 2px', color: '#8a9ab8', textAlign: 'right' }}>${l.minPayment}</td>
                      <td style={{ padding: '5px 2px', color: '#f59e0b', textAlign: 'right' }}>{l.apr}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `1px solid ${GOLD}44` }}>
                    <td style={{ padding: '6px 2px', color: GOLD, fontWeight: 'bold', fontSize: '10px' }}>TOTAL</td>
                    <td style={{ padding: '6px 2px', color: GOLD, textAlign: 'right', fontWeight: 'bold' }}>${totalDebt.toLocaleString()}</td>
                    <td style={{ padding: '6px 2px', color: '#8a9ab8', textAlign: 'right' }}>${totalLimit.toLocaleString()}</td>
                    <td style={{ padding: '6px 2px', color: '#8a9ab8', textAlign: 'right' }}>${totalMinPayment}</td>
                    <td style={{ padding: '6px 2px' }}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Summary */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#6b7280', fontSize: '10px' }}>Credit Utilization</span>
              <span style={{ color: utilization > 50 ? '#ef4444' : utilization > 30 ? '#f59e0b' : '#4ade80', fontSize: '11px', fontWeight: 'bold' }}>{utilization}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '10px' }}>Total Monthly Minimums</span>
              <span style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold' }}>${totalMinPayment}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}