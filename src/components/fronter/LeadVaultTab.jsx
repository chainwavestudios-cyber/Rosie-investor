/**
 * LeadVaultTab.jsx — Admin lead validation vault.
 * Upload → Validate (Omkar carrier lookup) → Distribute (fronter or AI dialer).
 * VoIP numbers are stripped from distribution; mobile/landline get shield badges.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import VaultUploadSection from './VaultUploadSection';
import VaultTracerfyPanel from './VaultTracerfyPanel';
import VaultValidationPanel from './VaultValidationPanel';
import VaultDistributionPanel from './VaultDistributionPanel';
import VaultEntryTable from './VaultEntryTable';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

export default function LeadVaultTab({ adminUsername }) {
  const [entries, setEntries] = useState([]);
  const [fronters, setFronters] = useState([]);
  const [usage, setUsage] = useState({ used: 0, limit: 100, remaining: 100 });
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entryPage, users, agg] = await Promise.all([
        base44.entities.LeadVaultEntry.filter({}, { sort: '-created_date', limit: 500 }),
        base44.entities.DebtCoachUser.list('-created_date', 500).catch(() => []),
        base44.entities.LeadVaultEntry.aggregate({
          groupBy: ['validationStatus', 'phoneValid', 'phoneLineType', 'destination', 'tracerfyStatus'],
          limit: 1000,
        }).catch(() => ({ rows: [] })),
      ]);
      const allEntries = entryPage?.items || entryPage || [];
      setEntries(allEntries);
      setFronters((users || []).filter(u => (u.role === 'fronter' || u.role === 'super_admin') && u.isActive));

      // ── Server-side counts (accurate across ALL entries, not just the 500 loaded) ──
      const rows = agg?.rows || [];
      let pending = 0, validated = 0, failed = 0, distributed = 0;
      let mobileCount = 0, landlineCount = 0, voipCount = 0;
      let availableCount = 0;
      let tracerfyPending = 0, tracerfyCompleted = 0, tracerfyFailed = 0;
      for (const r of rows) {
        const count = r.count || 0;
        const { validationStatus, phoneValid, phoneLineType, destination, tracerfyStatus } = r;
        if (validationStatus === 'pending' && destination === 'none') pending += count;
        if (validationStatus === 'validated') validated += count;
        if (validationStatus === 'failed') failed += count;
        if (destination && destination !== 'none') distributed += count;
        if (phoneLineType === 'mobile') mobileCount += count;
        if (phoneLineType === 'landline') landlineCount += count;
        if (phoneLineType === 'voip') voipCount += count;
        // Available = validated + phoneValid + non-VoIP + undistributed
        if (validationStatus === 'validated' && phoneValid === true && phoneLineType && phoneLineType !== 'voip' && destination === 'none') {
          availableCount += count;
        }
        // Tracerfy pipeline counts
        if (tracerfyStatus === 'pending') tracerfyPending += count;
        if (tracerfyStatus === 'completed') tracerfyCompleted += count;
        if (tracerfyStatus === 'failed') tracerfyFailed += count;
      }
      setServerStats({ pending, validated, failed, distributed, mobileCount, landlineCount, voipCount, availableCount, tracerfyPending, tracerfyCompleted, tracerfyFailed, total: pending + validated + failed });

      // Compute usage from PhoneValidationUsage
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const usageRecords = await base44.entities.PhoneValidationUsage.filter({ monthKey }).catch(() => []);
      // Aggregate across all keys (each key has its own 100/month limit)
      const totalUsed = (usageRecords || []).reduce((s, r) => s + (r.requestCount || 0), 0);
      const keyCount = (usageRecords || []).length || 1;
      const totalLimit = keyCount * 100;
      setUsage({ used: totalUsed, limit: totalLimit, remaining: totalLimit - totalUsed, keyCount });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Use server-side counts (accurate across ALL entries) when available;
  // fall back to counting the loaded 500 for the table view only.
  const stats = serverStats ? {
    pending: serverStats.pending,
    validated: serverStats.validated,
    failed: serverStats.failed,
    distributed: serverStats.distributed,
    mobileCount: serverStats.mobileCount,
    landlineCount: serverStats.landlineCount,
    voipCount: serverStats.voipCount,
    remaining: usage.remaining,
    used: usage.used,
    limit: usage.limit,
    keyCount: usage.keyCount ?? 1,
  } : {
    pending: entries.filter(e => e.validationStatus === 'pending' && e.destination === 'none').length,
    validated: entries.filter(e => e.validationStatus === 'validated').length,
    failed: entries.filter(e => e.validationStatus === 'failed').length,
    distributed: entries.filter(e => e.destination !== 'none').length,
    mobileCount: entries.filter(e => e.phoneLineType === 'mobile').length,
    landlineCount: entries.filter(e => e.phoneLineType === 'landline').length,
    voipCount: entries.filter(e => e.phoneLineType === 'voip').length,
    remaining: usage.remaining,
    used: usage.used,
    limit: usage.limit,
    keyCount: usage.keyCount ?? 1,
  };

  const availableCount = serverStats ? serverStats.availableCount : entries.filter(e =>
    e.validationStatus === 'validated' && e.phoneValid && e.phoneLineType !== 'voip' && e.destination === 'none'
  ).length;

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '40px' }}>Loading vault…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>🏦 Lead Validation Vault</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>Upload leads → validate phone numbers → strip VoIP → distribute to fronters or AI dialer</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ padding: '6px 14px', background: `${GOLD}12`, border: `1px solid ${GOLD}33`, borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Available</div>
            <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>{availableCount}</div>
          </div>
          <div style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total in Vault</div>
            <div style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold' }}>{serverStats?.total ?? entries.length}</div>
          </div>
        </div>
      </div>

      {/* Top row: Upload → Tracerfy Append → Validate → Distribute */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
        <VaultUploadSection adminUsername={adminUsername} onUploaded={load} />
        <VaultTracerfyPanel stats={serverStats} onTracerfyDone={load} />
        <VaultValidationPanel stats={stats} onValidated={load} />
        <VaultDistributionPanel adminUsername={adminUsername} fronters={fronters} availableCount={availableCount} onDistributed={load} />
      </div>

      {/* Entry table */}
      <VaultEntryTable entries={entries} serverStats={serverStats} />
    </div>
  );
}