/**
 * LeadNameButton.jsx — a lead's name anywhere in the engagement console.
 * Click it and the contact card opens; a card that is no longer on file reads as plain text.
 */
import { C } from '@/components/superadmin/kit';

export default function LeadNameButton({ lead, onOpenLead, size = '13px', color = C.ink }) {
  const label = lead?.name || (lead?.onFile === false ? 'Contact card removed' : 'Unknown lead');
  const canOpen = !!(onOpenLead && lead?.leadId && lead?.onFile !== false);

  if (!canOpen) return <span style={{ color, fontSize: size, fontWeight: 'bold' }}>{label}</span>;

  return (
    <button
      type="button"
      title="Open the contact card"
      onClick={() => onOpenLead({ leadId: lead.leadId, source: lead.source, name: label })}
      style={{
        background: 'none', border: 'none', padding: 0, margin: 0, color, fontFamily: 'inherit',
        fontSize: size, fontWeight: 'bold', textAlign: 'left', cursor: 'pointer',
        textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px',
      }}
    >{label}</button>
  );
}