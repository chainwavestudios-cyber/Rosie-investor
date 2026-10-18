/**
 * VaultDncScrubPanel.jsx — DNC + Litigator scrub step (LandlineRemover).
 * Runs after Twilio/Omkar validation, before distribution.
 * Blocks DNC and litigator numbers from reaching dialers.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const TEAL = '#14b8a6';
const RED = '#ef4444';
const AMBER = '#f59e0b';

export default function VaultDncScrubPanel({ stats, onScrubDone }) {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const runScrub = async (retryFailed) => {
    if (running) return;
    setRunning(true);
    try {
      const res = await base44.functions.invoke('dncScrubVault', {
        mode: retryFailed ? 'retry_failed' : undefined,
      });
      const data = res?.data || res;
      setLastResult(data);
      if (data?.error) {
        alert('DNC scrub error: ' + data.error);
      } else {
        onScrubDone?.();
      }
    } catch (e) {
      alert('DNC scrub failed: ' + (e?.message || String(e)));
    }
    setRunning(false);
  };

  const pendingCount = stats?.dncPending ?? 0;
  const cleanCount = stats?.dncClean ?? 0;
  const blockedCount = stats?.dncBlocked ?? 0;
  const failedCount = stats?.dncFailed ?? 0;

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(20,184,166,0.25)', borderRadius: '8px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ color: TEAL, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🛡️ DNC + Litigator Scrub</div>
        {lastResult && !lastResult.error && (
          <span style={{ color: GOLD, fontSize: '11px' }}>
            {lastResult.clean} clean · {lastResult.blocked} blocked
          </span>
        )}
      </div>

      <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '14px', lineHeight: 1.5 }}>
        LandlineRemover checks federal/state DNC &amp; TCPA litigator. Blocked numbers are dead-ended before distribution.
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(20,184,166,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</div>
          <div style={{ color: TEAL, fontSize: '18px', fontWeight: 'bold' }}>{pendingCount}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clean</div>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>{cleanCount}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Blocked</div>
          <div style={{ color: RED, fontSize: '18px', fontWeight: 'bold' }}>{blockedCount}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Failed</div>
          <div style={{ color: AMBER, fontSize: '18px', fontWeight: 'bold' }}>{failedCount}</div>
        </div>
      </div>

      {/* Run scrub button */}
      <button
        onClick={() => runScrub(false)}
        disabled={running || pendingCount === 0}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg,#0d9488,#14b8a6)',
          color: DARK,
          border: 'none',
          borderRadius: '4px',
          padding: '12px',
          cursor: running || pendingCount === 0 ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          opacity: running || pendingCount === 0 ? 0.5 : 1,
        }}
      >
        {running ? '⏳ Scrubbing batch (up to 50)…' : `🛡️ Scrub DNC (up to ${Math.min(50, pendingCount)} numbers)`}
      </button>

      {/* Retry failed */}
      {failedCount > 0 && (
        <button
          onClick={() => runScrub(true)}
          disabled={running}
          style={{
            width: '100%',
            marginTop: '8px',
            background: 'rgba(245,158,11,0.15)',
            color: AMBER,
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '4px',
            padding: '10px',
            cursor: running ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            opacity: running ? 0.5 : 1,
          }}
        >
          {running ? '⏳ Working…' : `🔄 Retry Failed ({failedCount})`}
        </button>
      )}

      {/* Status messages */}
      {lastResult?.outOfCredits && (
        <div style={{ color: RED, fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
          ⚠ LandlineRemover credits exhausted — add credits at landlineremover.com
        </div>
      )}
      {lastResult?.rateLimited && (
        <div style={{ color: AMBER, fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
          ⏳ Rate limited — remaining entries will scrub on next run
        </div>
      )}
      {lastResult && !lastResult.error && !lastResult.outOfCredits && !lastResult.rateLimited && (
        <div style={{ color: GOLD, fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>
          ✅ {lastResult.message}
        </div>
      )}
    </div>
  );
}