/**
 * CardTypeChip.jsx — the type badge on a Debt Call Coach contact card
 * (📧 Campaign · 👤 Prospect · 🔥 Hot Lead).
 */
import { CARD_TYPES, cardTypeOf } from '@/lib/cardTypes';

export default function CardTypeChip({ lead, size = 9 }) {
  const meta = CARD_TYPES[cardTypeOf(lead)];
  return (
    <span style={{
      padding: '1px 7px',
      borderRadius: '8px',
      fontSize: `${size}px`,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: `${meta.color}18`,
      color: meta.color,
      border: `1px solid ${meta.color}44`,
      whiteSpace: 'nowrap',
    }}>
      {meta.emoji} {meta.label}
    </span>
  );
}