/**
 * PopOutTab.jsx — Wraps a tab's content with a pop-out button.
 * When popped out, the content renders in a floating, draggable, resizable
 * panel that persists even when the user switches to other tabs — so multiple
 * tabs can be open simultaneously on a wide monitor.
 */
import { useEffect } from 'react';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const sizeBtn = {
  background: 'rgba(255,255,255,0.04)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '3px', padding: '3px 7px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold',
};

export default function PopOutTab({ storageKey, title, icon, active, children, defaultSize, autoPopOut, zIndex }) {
  const { user } = useDebtCoachAuth();
  const panel = usePopOutPanel(storageKey, defaultSize || { width: 900, height: 700 }, user?.username, zIndex);

  // Auto pop out when the trigger flips true (e.g. a live call starts) — and bring it on-screen
  useEffect(() => {
    if (!autoPopOut) return;
    if (!panel.poppedOut) panel.popOut();
    else panel.center();
  }, [autoPopOut]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Tab clicked while popped out — show where it is instead of an empty page */}
      {active && panel.poppedOut && (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(16,185,129,0.05)', border: `1px dashed ${GOLD}55`, borderRadius: '8px' }}>
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>{icon} {title} is open in a floating window</div>
          <div style={{ color: '#8a9ab8', fontSize: '12px', marginBottom: '14px' }}>Can't see it? Bring it to the center of the screen or dock it back here.</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={panel.center} style={{ background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⊕ Bring Window Here</button>
            <button onClick={panel.toggle} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⤡ Dock Into Tab</button>
          </div>
        </div>
      )}
      {/* Inline mode — only show when this tab is active and not popped out */}
      {active && !panel.poppedOut && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              onClick={panel.popOut}
              title="Pop out this tab into a floating, draggable, resizable window"
              style={{
                background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none',
                borderRadius: '6px', padding: '8px 18px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
              }}
            >
              ⤢ Pop Out Window
            </button>
          </div>
          {children}
        </div>
      )}

      {/* Floating mode — always rendered when popped out, regardless of active tab */}
      {panel.poppedOut && (
        <div
          style={{
            ...panel.floatingStyle,
            background: DARK,
            border: `1px solid ${GOLD}44`,
            borderRadius: '8px',
            boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
          }}
        >
          {/* Draggable header */}
          <div
            onMouseDown={panel.onDragStart}
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'move',
              userSelect: 'none',
              flexShrink: 0,
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {icon} {title}
            </span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={() => panel.setSize({ width: 380, height: 560 })} title="Small (380×560)" style={sizeBtn}>S</button>
              <button onClick={() => panel.setSize({ width: 560, height: 760 })} title="Medium (560×760)" style={sizeBtn}>M</button>
              <button onClick={() => panel.setSize({ width: 760, height: 960 })} title="Large (760×960)" style={sizeBtn}>L</button>
              <button onClick={() => panel.setSize({ width: Math.min(900, window.innerWidth - 40), height: Math.min(1000, window.innerHeight - 80) })} title="Extra large" style={sizeBtn}>XL</button>
              <button onClick={panel.center} title="Recenter on screen" style={{ ...sizeBtn, padding: '3px 8px' }}>⊕</button>
              <button
                onClick={panel.toggle}
                title="Dock this tab back into the main area"
                style={{
                  background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`,
                  borderRadius: '4px', padding: '3px 10px', cursor: 'pointer',
                  fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
                }}
              >
                ⤡ Dock
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {children}
          </div>

          {/* Resize handles */}
          {panel.resizeHandles}
        </div>
      )}
    </>
  );
}