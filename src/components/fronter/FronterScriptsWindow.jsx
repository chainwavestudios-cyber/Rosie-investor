import { createPortal } from 'react-dom';
import { Move, RotateCcw, PanelBottomClose } from 'lucide-react';

export default function FronterScriptsWindow({ panel, children }) {
  const resize = (width, height) => panel.setSize({ width: Math.min(width, window.innerWidth - 16), height: Math.min(height, window.innerHeight - 16) });
  const buttonClass = 'rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-accent';
  return createPortal(
    <div data-testid="fronter-scripts-window" role="region" aria-label="Floating Scripts window" className="dark rounded-lg border border-border bg-card text-card-foreground shadow-2xl" style={panel.floatingStyle}>
      <div data-testid="fronter-scripts-drag" onMouseDown={e => { if (!e.target.closest('button')) panel.onDragStart(e); }} className="flex shrink-0 cursor-move select-none flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-bold"><Move size={14} />Scripts</span>
        <div className="flex items-center gap-1">
          <button type="button" className={buttonClass} onClick={() => resize(480, 520)} aria-label="Small script window">S</button>
          <button type="button" className={buttonClass} onClick={() => resize(640, 640)} aria-label="Medium script window">M</button>
          <button type="button" className={buttonClass} onClick={() => resize(880, 760)} aria-label="Large script window">L</button>
          <button type="button" className={buttonClass} onClick={panel.center} aria-label="Recenter script window" title="Recenter"><RotateCcw size={13} /></button>
          <button type="button" className={buttonClass} onClick={panel.toggle} aria-label="Dock Scripts"><span className="flex items-center gap-1"><PanelBottomClose size={13} />Dock</span></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      <div className="shrink-0 border-t border-border px-3 py-2 text-xs text-muted-foreground">Drag the header to move. Drag an edge or corner to resize.</div>
      {panel.resizeHandles}
    </div>, document.body
  );
}