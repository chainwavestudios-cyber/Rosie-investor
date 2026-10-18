/**
 * VaultTracerfyPanel.jsx — Tracerfy phone-append pipeline step.
 * Shows count of raw leads pending Tracerfy, runs a 50-record batch,
 * and routes appended phones into the existing Twilio verifier.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const PURPLE = '#a78bfa';
const RED = '#ef4444';
const AMBER = '#f59e0b';

export default function VaultTracerfyPanel({ stats, onTracerfyDone }) {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const runBatch = async (retryFailed) => {
    if (running) return;
    setRunning(true);
    try {
      const res = await base44.functions.invoke('tracerfyBatch', {
        mode: retryFailed ? 'retry_failed' : undefined,
      });
      const data = res?.data || res;
      setLastResult(data);
      if (data?.error) {
        alert('Tracerfy error: ' + data.error);
      } else {
        onTracerfyDone?.();
      }
    } catch (e) {
      alert('Tracerfy failed: ' + (e?.message || String(e)));
    }
    setRunning(false);
  };

  const rawCount = stats?.tracerfyPending ?? 0;
  const failedCount = stats?.tracerfyFailed ?? 0;
  const completedCount = stats?.tracerfyCompleted ?? 0;

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '8px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ color: PURPLE, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📡 Tracerfy Phone Append</div>
        {lastResult && !lastResult.error && (
          <span style={{ color: GOLD, fontSize: '11px' }}>
            {lastResult.appended} appended · {lastResult.hits} hits · {lastResult.creditsUsed || 0} credits
          </span>
        )}
      </div>

      <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '14px', lineHeight: 1.5 }}>
        Sends name + address to Tracerfy to append mobile &amp; landline phones. Appended records auto-route into the Twilio verifier below.
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(167,139,250,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Raw Pending</div>
          <div style={{ color: PURPLE, fontSize: '20px', fontWeight: 'bold' }}>{rawCount}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Appended</div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>{completedCount}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>No Match</div>
          <div style={{ color: RED, fontSize: '20px', fontWeight: 'bold' }}>{failedCount}</div>
        </div>
      </div>

      {/* Run batch button */}
      <button
        onClick={() => runBatch(false)}
        disabled={running || rawCount === 0}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
          color: DARK,
          border: 'none',
          borderRadius: '4px',
          padding: '12px',
          cursor: running || rawCount === 0 ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          opacity: running || rawCount === 0 ? 0.5 : 1,
        }}
      >
        {running ? '⏳ Tracing batch (up to 50)…' : `📡 Append Phones (up to ${Math.min(50, rawCount)} leads)`}
      </button>

      {/* Retry failed */}
      {failedCount > 0 && (
        <button
          onClick={() => runBatch(true)}
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
          {running ? '⏳ Working…' : `🔄 Retry Failed ({failedCount} entries)`}
        </button>
      )}

      {/* Status messages */}
      {lastResult?.outOfCredits && (
        <div style={{ color: RED, fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
          ⚠ Tracerfy credits exhausted — add credits at tracerfy.com
        </div>
      )}
      {lastResult?.rateLimited && (
        <div style={{ color: AMBER, fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
          ⏳ Rate limit hit — remaining entries will process on next run
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