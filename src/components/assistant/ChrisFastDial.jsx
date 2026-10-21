import { Phone } from 'lucide-react';

export const CHRIS_OFFICE = '+16193530919';
export const CHRIS_CELL = '+12162586934';

export default function ChrisFastDial({ onDial, compact = false }) {
  const btn = (number, label, sub) => (
    <button key={label} onClick={() => onDial(number, `Chris Bongiorno — ${sub}`)} className={compact ? 'calendar-secondary' : 'fast-dial-btn'}>
      <Phone size={15} />{label}
    </button>
  );
  return <div className="flex flex-wrap gap-2">
    {btn(CHRIS_OFFICE, 'Chris · Office', 'Office')}
    {btn(CHRIS_CELL, 'Chris · Mobile', 'Mobile')}
  </div>;
}