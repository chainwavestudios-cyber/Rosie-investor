/**
 * FronterEmergencyScript.jsx — Alt+S toggles a hardcoded, non-editable emergency
 * script in a draggable, resizable popout (uses FronterPopup).
 */
import { useState, useEffect } from 'react';
import FronterPopup from './FronterPopup';

const EMERGENCY_SCRIPT = `EMERGENCY SCRIPT

(Script text not yet provided — paste the full emergency script here.)`;

export default function FronterEmergencyScript() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <FronterPopup title="🆘 Emergency Script" subtitle="Alt+S to toggle · not editable" accent="#ef4444" onClose={() => setOpen(false)} initialPos={{ x: 120, y: 90 }} initialSize={{ w: 460, h: 520 }} minW={300} minH={200} zIndex={10070}>
      <div style={{ padding: '16px', color: '#f5e6e6', fontSize: '15px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{EMERGENCY_SCRIPT}</div>
    </FronterPopup>
  );
}