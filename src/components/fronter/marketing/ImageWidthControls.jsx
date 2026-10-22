import { useState } from 'react';

export default function ImageWidthControls({ onApply }) {
  const [width, setWidth] = useState('300');
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-assistant-border bg-assistant-surface p-3 text-assistant-ink" aria-label="Image sizing">
      <strong className="text-xs">Image width</strong>
      {['25%', '50%', '75%', '100%'].map(size => <button key={size} type="button" className="calendar-secondary" onClick={() => onApply(size)}>{size}</button>)}
      <input aria-label="Custom image width" type="number" min="20" max="2000" className="calendar-field max-w-28" value={width} onChange={e => setWidth(e.target.value)} />
      <button type="button" className="calendar-secondary" onClick={() => { if (Number(width) >= 20 && Number(width) <= 2000) onApply(`${Number(width)}px`); }}>Apply pixels</button>
      <button type="button" className="calendar-secondary" onClick={() => onApply('')}>Reset size</button>
    </div>
  );
}