/**
 * VaultValidationPanel.jsx — Shows validation progress, remaining quota,
 * and buttons to validate pending vault entries in batches.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const AMBER = '#f59e0b';

export default function VaultValidationPanel({ stats, onValidated }) {
  const [validating, setValidating] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const runValidation = async (mode) => {
    if (validating) return;
    setValidating(true);
    try {
      const res = await base44.functions.invoke('validateVaultPhones', { maxCount: 50, mode });
      const data = res?.data || res;
      setLastResult(data);
      if (data?.error) {
        alert('Validation error: ' + data.error);
      } else {
        onValidated?.();
      }
    } catch (e) {
      alert('Validation failed: ' + (e?.message || String(e)));
    }
    setValidating(false);
  };

  const handleValidate = () => runValidation(undefined);
  const handleRetryFailed = () => runValidation('retry_failed');
  const handleTwilio = () => {
    if (!window.confirm('Use Twilio Lookup API? This costs ~$0.004 per number (~$0.20 for 50 numbers). It will be billed to your Twilio account.')) return;
    runValidation('twilio');
  };

  const remaining = stats?.remaining ?? 100;
  const used = stats?.used ?? 0;
  const limit = stats?.limit ?? 100;
  const quotaPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const quotaColor = quotaPct >= 90 ? RED : quotaPct >= 70 ? AMBER : GOLD;

  const keyErrors = lastResult?.keyErrors;

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🔍 Phone Validation</div>
        {lastResult && !lastResult.error && (
          <span style={{ color: GOLD, fontSize: '11px' }}>Last batch: {lastResult.validated} valid · {lastResult.failedCalls || 0} failed · {lastResult.apiCalls} calls</span>
        )}
      </div>

      {/* Quota bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#8a9ab8', fontSize: '10px' }}>Monthly API Quota (Omkar · {stats?.keyCount ?? 1} key{stats?.keyCount > 1 ? 's' : ''} × 100)</span>
          <span style={{ color: quotaColor, fontSize: '11px', fontWeight: 'bold' }}>{used} / {limit} used · {remaining} left</span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${quotaPct}%`, height: '100%', background: quotaColor, borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
        {remaining <= 0 && (
          <div style={{ color: RED, fontSize: '10px', marginTop: '6px' }}>⚠ All API keys exhausted this month. Add more keys or upgrade your Omkar plan.</div>
        )}
      </div>

      {/* Key error warning */}
      {keyErrors && Object.keys(keyErrors).length > 0 && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px' }}>
          <div style={{ color: RED, fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>⚠ API Key Error — {Object.keys(keyErrors).join(', ')} skipped</div>
          {Object.entries(keyErrors).map(([k, err]) => (
            <div key={k} style={{ color: '#8a9ab8', fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>{k}: {String(err).slice(0, 120)}</div>
          ))}
          <div style={{ color: AMBER, fontSize: '10px', marginTop: '6px' }}>Activate the free plan at omkar.cloud/tools/carrier-lookup-api/pricing to use this key again.</div>
        </div>
      )}

      {/* All keys exhausted warning */}
      {lastResult?.allKeysExhausted && (
        <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px' }}>
          <div style={{ color: RED, fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>🚫 All API keys exhausted or broken</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
            No leads could be validated. To fix this:
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li>Activate key2's free plan at omkar.cloud/tools/carrier-lookup-api/pricing</li>
              <li>Wait for next month when key1 & key3 quotas reset</li>
              <li>Or add a new API key (PHONE_LOOKUP_API_KEY_4) in Secrets</li>
            </ul>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Pending</div>
          <div style={{ color: '#8a9ab8', fontSize: '20px', fontWeight: 'bold' }}>{stats?.pending ?? 0}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Validated</div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>{stats?.validated ?? 0}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Failed</div>
          <div style={{ color: RED, fontSize: '20px', fontWeight: 'bold' }}>{stats?.failed ?? 0}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(96,165,250,0.08)', borderRadius: '6px' }}>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Distributed</div>
          <div style={{ color: BLUE, fontSize: '20px', fontWeight: 'bold' }}>{stats?.distributed ?? 0}</div>
        </div>
      </div>

      {/* Line type breakdown */}
      {(stats?.mobileCount > 0 || stats?.landlineCount > 0 || stats?.voipCount > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(16,185,129,0.12)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)' }}>📱 Mobile: {stats?.mobileCount ?? 0}</span>
          <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(96,165,250,0.12)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)' }}>☎️ Landline: {stats?.landlineCount ?? 0}</span>
          <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.3)' }}>📵 VoIP: {stats?.voipCount ?? 0}</span>
        </div>
      )}

      {/* Validate button */}
      <button onClick={handleValidate} disabled={validating || remaining <= 0 || (stats?.pending ?? 0) === 0} style={{ width: '100%', background: 'linear-gradient(135deg,#3b82f6,#60a5fa)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: (validating || remaining <= 0 || (stats?.pending ?? 0) === 0) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: (validating || remaining <= 0 || (stats?.pending ?? 0) === 0) ? 0.5 : 1 }}>
        {validating ? '⏳ Validating batch (up to 50)…' : `🔍 Validate Pending (up to ${Math.min(50, remaining)} numbers)`}
      </button>

      {/* Retry failed button */}
      {(stats?.failed ?? 0) > 0 && (
        <button onClick={handleRetryFailed} disabled={validating || remaining <= 0} style={{ width: '100%', marginTop: '8px', background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '10px', cursor: (validating || remaining <= 0) ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: (validating || remaining <= 0) ? 0.5 : 1 }}>
          {validating ? '⏳ Working…' : `🔄 Retry Failed ({stats.failed} entries)`}
        </button>
      )}

      {/* Twilio fallback button — always available as long as Twilio creds exist */}
      <button onClick={handleTwilio} disabled={validating} style={{ width: '100%', marginTop: '8px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '10px', cursor: validating ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: validating ? 0.5 : 1 }}>
        {validating ? '⏳ Working…' : `📱 Validate via Twilio (paid, ~$0.20/batch)`}
      </button>

      {lastResult?.provider === 'twilio' && (
        <div style={{ color: GOLD, fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>✅ Twilio: {lastResult.validated} valid · {lastResult.failedCalls} failed · cost {lastResult.cost}</div>
      )}

      {remaining > 0 && (stats?.pending ?? 0) > remaining && (
        <div style={{ color: AMBER, fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>⚠ Only {remaining} validations left this month — {stats.pending - remaining} leads will remain pending</div>
      )}
    </div>
  );
}