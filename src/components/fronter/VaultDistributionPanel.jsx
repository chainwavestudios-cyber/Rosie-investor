/**
 * VaultDistributionPanel.jsx — Admin selects validated leads and distributes
 * them to a specific fronter or the AI dialer. VoIP numbers are excluded.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function VaultDistributionPanel({ adminUsername, fronters, availableCount, onDistributed }) {
  const [destination, setDestination] = useState('fronter');
  const [selectedFronter, setSelectedFronter] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [lineTypeFilter, setLineTypeFilter] = useState('all');
  const [skipMailer, setSkipMailer] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    if (fronters?.length > 0 && !selectedFronter) setSelectedFronter(fronters[0].username);
  }, [fronters]);

  const handleDistribute = async () => {
    if (distributing) return;
    if (destination === 'fronter' && !selectedFronter) { alert('Select a fronter first.'); return; }
    if (availableCount === 0) { alert('No validated leads available to distribute.'); return; }
    setDistributing(true);
    try {
      // Fetch validated, non-VoIP, undistributed entries matching the filter
      const query = { validationStatus: 'validated', phoneValid: true, destination: 'none' };
      if (lineTypeFilter !== 'all') query.phoneLineType = lineTypeFilter;
      else query.phoneLineType = { $ne: 'voip' };

      const page = await base44.entities.LeadVaultEntry.filter(query, { sort: 'created_date', limit: quantity });
      const entries = page?.items || page || [];
      if (!entries || entries.length === 0) {
        alert('No matching validated leads found.');
        setDistributing(false);
        return;
      }

      const entryIds = entries.map(e => e.id);
      const res = await base44.functions.invoke('distributeVaultLeads', {
        entryIds,
        destination,
        assignedTo: destination === 'fronter' ? selectedFronter : '',
        assignedBy: adminUsername,
        skipMailer,
      });
      const data = res?.data || res;
      setLastResult(data);
      if (data?.error) {
        alert('Distribution error: ' + data.error);
      } else {
        onDistributed?.();
      }
    } catch (e) {
      alert('Distribution failed: ' + (e?.message || String(e)));
    }
    setDistributing(false);
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', padding: '20px' }}>
      <div style={{ color: PURPLE, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '14px' }}>📤 Distribute Validated Leads</div>

      {/* Destination toggle */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button onClick={() => setDestination('fronter')} style={{ flex: 1, padding: '10px', background: destination === 'fronter' ? `${GOLD}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${destination === 'fronter' ? GOLD + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: '4px', color: destination === 'fronter' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: destination === 'fronter' ? 'bold' : 'normal' }}>👤 To Fronter</button>
        <button onClick={() => setDestination('ai_dialer')} style={{ flex: 1, padding: '10px', background: destination === 'ai_dialer' ? `${PURPLE}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${destination === 'ai_dialer' ? PURPLE + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: '4px', color: destination === 'ai_dialer' ? PURPLE : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: destination === 'ai_dialer' ? 'bold' : 'normal' }}>🤖 To AI Dialer</button>
      </div>

      {/* Fronter selector */}
      {destination === 'fronter' && (
        <div style={{ marginBottom: '10px' }}>
          <label style={ls}>Assign To Fronter</label>
          <select value={selectedFronter} onChange={e => setSelectedFronter(e.target.value)} style={inp}>
            <option value="">— Select Fronter —</option>
            {fronters?.map(f => <option key={f.username} value={f.username}>{f.firstName} {f.lastName} ({f.username})</option>)}
          </select>
        </div>
      )}

      {/* Line type filter */}
      <div style={{ marginBottom: '10px' }}>
        <label style={ls}>Phone Type Filter</label>
        <select value={lineTypeFilter} onChange={e => setLineTypeFilter(e.target.value)} style={inp}>
          <option value="all">All Valid (Mobile + Landline)</option>
          <option value="mobile">Mobile Only</option>
          <option value="landline">Landline Only</option>
        </select>
      </div>

      {/* Quantity */}
      <div style={{ marginBottom: '14px' }}>
        <label style={ls}>Quantity (max {availableCount} available)</label>
        <input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(availableCount, parseInt(e.target.value) || 1)))} min="1" max={availableCount} style={inp} />
      </div>

      {/* Mailer creation toggle */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', padding: '9px 10px', background: `${GOLD}0d`, border: `1px solid ${GOLD}2a`, borderRadius: '6px', cursor: 'pointer' }}>
        <input type="checkbox" checked={skipMailer} onChange={e => setSkipMailer(e.target.checked)} style={{ accentColor: GOLD, marginTop: '2px', cursor: 'pointer' }} />
        <span>
          <span style={{ display: 'block', color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>Skip mailer creation</span>
          <span style={{ display: 'block', color: '#6b7280', fontSize: '10px', lineHeight: 1.4, marginTop: '2px' }}>Distribute leads and assign Notice IDs only — no digital mailers. Build them later from the Rate Drop Mailers tab.</span>
        </span>
      </label>

      <button onClick={handleDistribute} disabled={distributing || availableCount === 0 || (destination === 'fronter' && !selectedFronter)} style={{ width: '100%', background: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: (distributing || availableCount === 0 || (destination === 'fronter' && !selectedFronter)) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: (distributing || availableCount === 0 || (destination === 'fronter' && !selectedFronter)) ? 0.5 : 1 }}>
        {distributing ? '⏳ Distributing…' : `📤 Distribute ${Math.min(quantity, availableCount)} Leads → ${destination === 'fronter' ? selectedFronter || 'select fronter' : destination === 'debt_marketing' ? 'DCC Marketing' : 'AI Dialer'}`}
      </button>

      {lastResult && !lastResult.error && (
        <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(16,185,129,0.08)', borderRadius: '4px', color: GOLD, fontSize: '11px' }}>
          ✓ {lastResult.distributed} leads distributed to {lastResult.destination === 'fronter' ? lastResult.assignedTo : lastResult.destination === 'debt_marketing' ? 'Debt Call Coach Marketing' : 'AI Dialer'}
          {lastResult.skipped > 0 && <span style={{ color: '#f59e0b' }}> · {lastResult.skipped} skipped (VoIP, DNC or already assigned)</span>}
          {lastResult.mailersCreated === false && <span style={{ color: '#f59e0b' }}> · mailers skipped — Notice IDs assigned</span>}
        </div>
      )}
    </div>
  );
}