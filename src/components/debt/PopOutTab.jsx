/**
 * PopOutTab.jsx — Wraps a tab's content with a pop-out button.
 * When popped out, the content renders in a floating, draggable, resizable
 * panel that persists even when the user switches to other tabs — so multiple
 * tabs can be open simultaneously on a wide monitor.
 */
import { usePopOutPanel } from '@/hooks/usePopOutPanel';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function PopOutTab({ storageKey, title, icon, active, children, defaultSize }) {
  const { user } = useDebtCoachAuth();
  const panel = usePopOutPanel(storageKey, defaultSize || { width: 900, height: 700 }, user?.username);

  return (
    <>
      {/* Inline mode — only show when this tab is active and not popped out */}
      {active && !panel.poppedOut && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <button
              onClick={panel.popOut}
              title="Pop out this tab into a floating window"
              style={{
                background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}44`,
                borderRadius: '4px', padding: '4px 12px', cursor: 'pointer',
                fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              ⤢ Pop Out
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