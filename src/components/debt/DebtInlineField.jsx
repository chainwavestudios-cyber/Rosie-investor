/**
 * DebtInlineField.jsx — a contact-card field that can be edited right inside the
 * script. Drop @@FIELD:email@@ (or phone / debtAmount) in a script and the coach
 * gets an editable field with an Update button: they type the correction, press
 * Update, and the contact card saves it — no closing the script and reopening the card.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';

// Every field a debt script may lay out inline — the insert toolbar lists these too.
export const DEBT_INLINE_FIELDS = [
  { key: 'email', label: 'Email', type: 'email', money: false },
  { key: 'phone', label: 'Phone', type: 'tel', money: false },
  { key: 'debtAmount', label: 'Total Debt', type: 'number', money: true },
];

const SPEC = Object.fromEntries(DEBT_INLINE_FIELDS.map((f) => [f.key.toLowerCase(), f]));

export function inlineFieldSpec(field) {
  return SPEC[String(field || '').toLowerCase()] || null;
}

export default function DebtInlineField({ field, lead, onSaved }) {
  const spec = inlineFieldSpec(field);
  const key = spec?.key || field;
  const cardValue = lead?.[key] ?? '';
  const [value, setValue] = useState(String(cardValue));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // A different contact pulled up on the card — show that contact's value.
  useEffect(() => { setValue(String(cardValue ?? '')); }, [lead?.id, key, cardValue]);
  useEffect(() => { setMsg(''); }, [lead?.id, key]);

  if (!spec) return null;

  const dirty = value.trim() !== String(cardValue).trim();

  const save = async () => {
    if (!lead?.id) { setMsg('No contact card open'); return; }
    setSaving(true);
    setMsg('');
    try {
      let next = value.trim();
      if (spec.money) {
        next = Number(next.replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(next)) { setMsg('Enter a dollar amount'); setSaving(false); return; }
      }
      await base44.entities.DebtLead.update(lead.id, { [key]: next });
      window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: [key] }));
      onSaved?.({ [key]: next });
      setValue(String(next));
      setMsg('✓ Updated');
    } catch (e) {
      setMsg('Update failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const shown = spec.money && value ? '$' + Number(String(value).replace(/[^0-9.]/g, '') || 0).toLocaleString() : '';

  return (
    <div style={{ margin: '10px 0', padding: '8px 10px', background: 'rgba(16,185,129,0.06)', border: `1px solid ${GOLD}55`, borderRadius: '6px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{spec.label}</span>
      <input
        type={spec.type}
        aria-label={spec.label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Enter ${spec.label.toLowerCase()}…`}
        style={{ flex: '1 1 170px', minWidth: '130px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${dirty ? GOLD + '88' : 'rgba(255,255,255,0.14)'}`, borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif' }}
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        title="Save this field on the contact card"
        style={{ background: `${GOLD}22`, color: GOLD, border: `2px solid ${GOLD}88`, borderRadius: '6px', padding: '7px 16px', cursor: saving || !dirty ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Georgia, serif', opacity: saving || !dirty ? 0.5 : 1, whiteSpace: 'nowrap' }}
      >
        {saving ? '⏳ Saving…' : '💾 Update'}
      </button>
      {!dirty && shown && !msg && <span style={{ color: '#8a9ab8', fontSize: '11px' }}>on card: {shown}</span>}
      {msg && <span style={{ color: msg.startsWith('✓') ? '#4ade80' : '#ef4444', fontSize: '11px', fontWeight: 'bold' }}>{msg}</span>}
    </div>
  );
}