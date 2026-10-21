/**
 * ManualLeadModal.jsx — Add a single raw lead to the vault by hand.
 *
 * Same shape as a CSV-uploaded row, so it enters the pipeline identically:
 * raw → Tracerfy append → phone validation → DNC scrub → distribute. Built for
 * running the whole pipeline on one record before committing a real list.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const FIELDS = [
  { key: 'firstName', label: 'First Name', required: true, col: 1 },
  { key: 'lastName', label: 'Last Name', required: true, col: 1 },
  { key: 'phone', label: 'Phone', required: true, col: 1 },
  { key: 'phone2', label: 'Secondary Phone', col: 1 },
  { key: 'email', label: 'Email', col: 2 },
  { key: 'address', label: 'Address', col: 2 },
  { key: 'city', label: 'City', col: 1 },
  { key: 'state', label: 'State', col: 2 },
  { key: 'zipCode', label: 'Zip Code', col: 1 },
  { key: 'debtAmount', label: 'Debt Amount ($)', col: 1 },
];

const EMPTY = {
  batchLabel: 'Manual Entry',
  firstName: '', lastName: '', phone: '', phone2: '', email: '',
  address: '', city: '', state: '', zipCode: '', debtAmount: '', notes: '',
};

export default function ManualLeadModal({ adminUsername, onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(null);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const canSave = form.firstName.trim() && form.lastName.trim() && form.phone.trim() && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      const record = await base44.entities.LeadVaultEntry.create({
        batchLabel: form.batchLabel.trim() || 'Manual Entry',
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        rawPhone: form.phone.trim(),
        phone2: form.phone2.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        zipCode: form.zipCode.trim(),
        debtAmount: parseFloat(String(form.debtAmount).replace(/[^0-9.]/g, '')) || 0,
        notes: form.notes,
        // Enter the pipeline exactly like an uploaded row would.
        pipelineStatus: 'raw',
        tracerfyStatus: 'pending',
        validationStatus: 'pending',
        lineType: 'unverified',
        dncScrubStatus: 'pending',
        destination: 'none',
        uploadedBy: adminUsername,
      });
      setAdded(record);
      onAdded?.(record);
    } catch (e) {
      setError(e?.message || String(e));
    }
    setSaving(false);
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,15,0.78)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}
    >
      <div style={{ width: '100%', maxWidth: '680px', background: '#0d1b2a', border: `1px solid ${GOLD}33`, borderRadius: '10px', padding: '22px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold' }}>＋ Add Single Raw Lead</div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '3px' }}>
              Lands in the vault as a raw lead — run it through Append → Validate → Scrub → Distribute to test the full pipeline.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>

        {added ? (
          <div style={{ textAlign: 'center', padding: '26px 10px' }}>
            <div style={{ fontSize: '38px', marginBottom: '8px' }}>✓</div>
            <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold', marginBottom: '6px' }}>
              {added.firstName} {added.lastName} is in the vault
            </div>
            <div style={{ color: '#8a9ab8', fontSize: '12px', marginBottom: '18px' }}>
              Status: raw · phone validation pending · DNC scrub pending · not distributed
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => { setAdded(null); setForm({ ...EMPTY }); }} style={{ background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Add another</button>
              <button onClick={onClose} style={{ background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '10px 22px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Done — show it in the vault</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={ls}>Batch Label</label>
                <input value={form.batchLabel} onChange={e => set('batchLabel', e.target.value)} placeholder="Manual Entry" style={inp} />
              </div>
              {FIELDS.map(f => (
                <div key={f.key} style={{ gridColumn: f.col === 2 ? 'span 2' : 'span 1' }}>
                  <label style={ls}>{f.label}{f.required ? ' *' : ''}</label>
                  <input value={form[f.key]} onChange={e => set(f.key, e.target.value)} style={inp} />
                </div>
              ))}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={ls}>Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>

            {error && <div style={{ color: RED, fontSize: '11px', marginTop: '10px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '11px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Cancel</button>
              <button onClick={save} disabled={!canSave} style={{ flex: 1, background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '11px', cursor: canSave ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: canSave ? 1 : 0.4 }}>
                {saving ? '⏳ Adding…' : '📥 Add Lead to Vault'}
              </button>
            </div>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '8px' }}>
              First name, last name and phone are required. <span style={{ color: BLUE }}>Phone is verified in the validation step, not here.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}