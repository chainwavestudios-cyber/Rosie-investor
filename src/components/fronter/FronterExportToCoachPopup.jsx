/**
 * FronterExportToCoachPopup.jsx — Exports a FronterLead to Debt Call Coach by
 * creating a DebtLead record. Super-admin only. Optionally tags the new
 * DebtLead as a Hot Lead. Checks for duplicates by email or phone before
 * creating.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const PURPLE = '#a78bfa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };

function mapEmploymentStatus(status) {
  if (!status || status === 'unknown') return undefined;
  if (status === 'self_employed') return 'self-employed';
  return status;
}

export default function FronterExportToCoachPopup({ lead, username, onClose, onExported }) {
  const [tagHotLead, setTagHotLead] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);

  // Check for duplicate DebtLead by email or phone
  useEffect(() => {
    const checkDup = async () => {
      setChecking(true);
      setError('');
      try {
        let dup = null;
        if (lead?.email) {
          const page = await base44.entities.DebtLead.filter(
            { email: { $regex: lead.email, $options: 'i' } },
            { limit: 1 }
          );
          const items = page?.items || page || [];
          if (items[0]) dup = items[0];
        }
        if (!dup && lead?.phone) {
          const cleanPhone = lead.phone.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            const page = await base44.entities.DebtLead.filter(
              { phone: { $regex: cleanPhone.slice(-10), $options: 'i' } },
              { limit: 1 }
            );
            const items = page?.items || page || [];
            if (items[0]) dup = items[0];
          }
        }
        setExisting(dup);
      } catch (e) {
        // Non-fatal — proceed with export
      }
      setChecking(false);
    };
    checkDup();
  }, [lead?.id]);

  const doExport = async () => {
    if (existing) {
      if (!confirm(`A DebtLead already exists for ${lead.firstName} ${lead.lastName} (${existing.email || existing.phone}). Export anyway? This will create a duplicate.`)) return;
    }
    setExporting(true);
    setError('');
    try {
      const now = new Date().toISOString();

      // Build notes from fronter notes + notes log
      let notesParts = [];
      if (lead.notes) notesParts.push(lead.notes);
      try {
        const log = JSON.parse(lead.notesLogJson || '[]');
        const logSummary = log
          .filter(n => n.text)
          .slice(-5)
          .map(n => `[${new Date(n.timestamp).toLocaleDateString()}] ${n.text}`)
          .join('\n');
        if (logSummary) notesParts.push(`Fronter Notes:\n${logSummary}`);
      } catch {}
      notesParts.push(`Exported from Fronter by ${username} on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);

      const debtLeadData = {
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        phone: lead.phone || '',
        email: lead.email || '',
        address: lead.address || '',
        city: lead.city || '',
        state: lead.state || '',
        zip: lead.zipCode || '',
        debtAmount: lead.debtAmount || undefined,
        employmentStatus: mapEmploymentStatus(lead.employmentStatus),
        status: 'new',
        notes: notesParts.join('\n\n'),
        isHotLead: tagHotLead,
        hotLeadTaggedAt: tagHotLead ? now : undefined,
        hotLeadTaggedBy: tagHotLead ? username : undefined,
      };

      // Remove undefined values
      Object.keys(debtLeadData).forEach(k => debtLeadData[k] === undefined && delete debtLeadData[k]);

      const created = await base44.entities.DebtLead.create(debtLeadData);

      // Add a note to the FronterLead
      try {
        const log = JSON.parse(lead.notesLogJson || '[]');
        log.push({
          text: `📤 Exported to Debt Call Coach by ${username}${tagHotLead ? ' (tagged as Hot Lead)' : ''}`,
          timestamp: now,
          author: username,
          type: 'export',
        });
        await base44.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(log) });
      } catch {}

      setSuccess(true);
      setTimeout(() => {
        onExported?.(created);
      }, 1500);
    } catch (e) {
      setError('Export failed: ' + (e?.message || String(e)));
    }
    setExporting(false);
  };

  return (
    <FronterPopup
      title="📤 Export to Debt Call Coach"
      subtitle="Creates a DebtLead record · Super Admin only"
      accent={PURPLE}
      onClose={onClose}
      initialSize={{ w: 480, h: 520 }}
      minW={380}
      minH={300}
      zIndex={11050}
    >
      <div style={{ padding: '16px' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
              {lead.firstName} {lead.lastName} exported to Debt Call Coach!
            </div>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>
              {tagHotLead ? '🔥 Tagged as Hot Lead' : 'Created as new prospect'}
            </div>
          </div>
        ) : (
          <>
            {/* Lead summary */}
            <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ color: PURPLE, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Exporting This Lead</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                <div><span style={{ color: '#6b7280' }}>Name:</span> <span style={{ color: '#e8e0d0' }}>{lead.firstName} {lead.lastName}</span></div>
                <div><span style={{ color: '#6b7280' }}>Phone:</span> <span style={{ color: '#e8e0d0' }}>{lead.phone || '—'}</span></div>
                <div><span style={{ color: '#6b7280' }}>Email:</span> <span style={{ color: '#e8e0d0' }}>{lead.email || '—'}</span></div>
                <div><span style={{ color: '#6b7280' }}>Debt:</span> <span style={{ color: '#e8e0d0' }}>{lead.debtAmount ? `$${Number(lead.debtAmount).toLocaleString()}` : '—'}</span></div>
                <div><span style={{ color: '#6b7280' }}>City:</span> <span style={{ color: '#e8e0d0' }}>{lead.city || '—'}, {lead.state || ''}</span></div>
                <div><span style={{ color: '#6b7280' }}>Status:</span> <span style={{ color: GOLD }}>New Prospect</span></div>
              </div>
            </div>

            {/* Duplicate check */}
            {checking ? (
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '16px' }}>⏳ Checking for existing DebtLead…</div>
            ) : existing ? (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px' }}>
                <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>⚠ Existing DebtLead Found</div>
                <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '4px' }}>
                  {existing.firstName} {existing.lastName} ({existing.email || existing.phone}) already exists in Debt Call Coach. Exporting will create a duplicate.
                </div>
              </div>
            ) : (
              <div style={{ color: GOLD, fontSize: '12px', marginBottom: '16px' }}>✓ No existing DebtLead found — safe to export.</div>
            )}

            {/* Hot lead option */}
            <div style={{ background: 'rgba(239,68,68,0.06)', border: `1px solid ${tagHotLead ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: tagHotLead ? RED : '#8a9ab8', fontSize: '13px', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={tagHotLead}
                  onChange={e => setTagHotLead(e.target.checked)}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
                🔥 Also tag as Hot Lead in Debt Call Coach
              </label>
              <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px', marginLeft: '28px' }}>
                The new DebtLead will appear in the Hot Leads tab with a fire border, ready for priority follow-up.
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 12px', color: RED, fontSize: '12px', marginBottom: '12px' }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {!success && (
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
          <button
            onClick={doExport}
            disabled={exporting || checking}
            style={{
              background: 'linear-gradient(135deg,#a78bfa,#8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 24px',
              cursor: exporting || checking ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: exporting || checking ? 0.5 : 1,
            }}
          >
            {exporting ? '⏳ Exporting…' : '📤 Export to Debt Call Coach'}
          </button>
        </div>
      )}
    </FronterPopup>
  );
}