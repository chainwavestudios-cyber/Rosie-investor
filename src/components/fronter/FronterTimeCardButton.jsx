/**
 * FronterTimeCardButton.jsx — Header button that opens a Time Card popup
 * with Clock In / Lunch Out / Lunch In / Clock Out controls.
 */
import { useState } from 'react';
import FronterClockBar from './FronterClockBar';

const GOLD = '#10b981';

export default function FronterTimeCardButton({ username }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} title="Time Card" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
        🕐 Time Card
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d1b2a', border: `1px solid ${GOLD}55`, borderRadius: '8px', padding: '20px', minWidth: '360px', maxWidth: '95vw', boxShadow: '0 12px 48px rgba(0,0,0,0.7)', fontFamily: 'Georgia, serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>🕐 Time Card</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <FronterClockBar username={username} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}