/**
 * FronterInlineField.jsx — a contact-card field that can be edited right inside
 * the script. Drop @@FIELD:email@@ in a script and the fronter gets an editable
 * field with an Update button: they type the correction, press Update, and the
 * contact card saves it — no closing the script and reopening the card.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Every field a script may lay out inline — the script editor lists these too.
export const INLINE_CARD_FIELDS = [
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'phone2', label: 'Second Phone', type: 'tel' },
  { key: 'firstName', label: 'First Name', type: 'text' },
  { key: 'lastName', label: 'Last Name', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'zipCode', label: 'Zip Code', type: 'text' },
];

const FIELD_SPEC = Object.fromEntries(INLINE_CARD_FIELDS.map((f) => [f.key, f]));

export default function FronterInlineField({ field, lead, onSaved }) {
  const spec = FIELD_SPEC[field] || { key: field, label: field, type: 'text' };
  const cardValue = lead?.[field] || '';
  const [value, setValue] = useState(cardValue);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // A different lead pulled up on the card — show that lead's value.
  useEffect(() => { setValue(lead?.[field] || ''); setMsg(''); }, [lead?.id, field]);

  const dirty = value.trim() !== cardValue.trim();

  const save = async () => {
    if (!lead?.id) { setMsg('No contact card open'); return; }
    setSaving(true);
    setMsg('');
    try {
      await base44.entities.FronterLead.update(lead.id, { [field]: value.trim() });
      onSaved?.({ [field]: value.trim() });
      setMsg('✓ Updated');
    } catch (e) {
      setMsg('Update failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div style={{ margin: '10px 0', padding: '8px 10px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ color: '#22d3ee', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{spec.label}</span>
      <input
        type={spec.type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Enter ${spec.label.toLowerCase()}…`}
        style={{ flex: '1 1 170px', minWidth: '130px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${dirty ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.14)'}`, borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif' }}
      />
      <button
        onClick={save}
        disabled={saving || !dirty}
        title="Save this field on the contact card"
        style={{ background: 'rgba(34,211,238,0.18)', color: '#22d3ee', border: '2px solid rgba(34,211,238,0.5)', borderRadius: '6px', padding: '7px 16px', cursor: saving || !dirty ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Georgia, serif', opacity: saving || !dirty ? 0.5 : 1, whiteSpace: 'nowrap' }}
      >
        {saving ? '⏳ Saving…' : '💾 Update'}
      </button>
      {msg && <span style={{ color: msg.startsWith('✓') ? '#4ade80' : '#ef4444', fontSize: '11px', fontWeight: 'bold' }}>{msg}</span>}
    </div>
  );
}