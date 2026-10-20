/**
 * DockBoard.jsx — the card board engine for the Super Admin Command Center.
 *
 * Every card starts DOCKED in a responsive grid. From a card's header the super admin can:
 *   ▭  cycle the card's width (1 → 2 → 3 columns)
 *   ⤢  undock it into a free-floating window, then drag / resize it anywhere
 *   ▾  collapse it
 * Dragging a docked card's header re-orders the board. Layout persists per user in SavedLayout.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C } from '@/components/superadmin/kit';

const LAYOUT_NAME = 'superadmin-board';

/**
 * One shared layout store for the whole command center. Split view mounts both boards
 * at once, and they must read and write the same SavedLayout record — otherwise each
 * board's save would drop the other board's arrangement.
 */
const store = { username: null, layout: {}, recordId: null, loaded: false, loading: null, timer: null, subs: new Set() };

function loadStore(username) {
  if (store.username === username && store.loaded) return Promise.resolve();
  if (store.loading) return store.loading;
  store.username = username;
  store.layout = {};
  store.recordId = null;
  store.loaded = false;
  store.loading = (async () => {
    try {
      const found = await base44.entities.SavedLayout.filter({ username, layoutName: LAYOUT_NAME });
      const rec = (Array.isArray(found) ? found : found?.items || [])[0];
      if (rec) {
        store.recordId = rec.id;
        store.layout = JSON.parse(rec.layoutDataJson || '{}') || {};
      }
    } catch { /* first run — no saved layout yet */ }
    store.loaded = true;
    store.loading = null;
    store.subs.forEach((fn) => fn(store.layout));
  })();
  return store.loading;
}

function writeStore(next) {
  store.layout = next;
  store.subs.forEach((fn) => fn(next));
  clearTimeout(store.timer);
  store.timer = setTimeout(async () => {
    const layoutDataJson = JSON.stringify(store.layout);
    try {
      if (store.recordId) await base44.entities.SavedLayout.update(store.recordId, { layoutDataJson });
      else store.recordId = (await base44.entities.SavedLayout.create({ layoutName: LAYOUT_NAME, username: store.username, layoutDataJson })).id;
    } catch (e) { console.error('Layout save failed:', e); }
  }, 700);
}

function useBoardLayout(username) {
  const [layout, setLayout] = useState(store.username === username ? store.layout : {});

  useEffect(() => {
    let alive = true;
    const notify = (next) => { if (alive) setLayout(next); };
    store.subs.add(notify);
    if (store.username === username && store.loaded) setLayout(store.layout);
    else loadStore(username).then(() => { if (!alive) return; setLayout(store.layout); });
    return () => { alive = false; store.subs.delete(notify); };
  }, [username]);

  return { layout, persist: writeStore };
}

const headerBtn = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a8b4c4',
  borderRadius: '3px', width: '22px', height: '20px', cursor: 'pointer', fontSize: '11px',
  lineHeight: 1, padding: 0, flexShrink: 0,
};

export default function DockBoard({ boardKey, cards, accent, columns = 3, username, splitHint }) {
  const { layout, persist } = useBoardLayout(username);
  // Cards must stay usable on a phone: fewer columns on narrow screens.
  const [vw, setVw] = useState(typeof window === 'undefined' ? 1280 : window.innerWidth);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const cols = vw < 700 ? 1 : vw < 1100 ? Math.min(2, columns) : columns;
  const cfg = layout[boardKey] || {};
  const declared = cards.map((c) => c.id);
  const storedOrder = (cfg.order || []).filter((id) => declared.includes(id));
  const order = [...storedOrder, ...declared.filter((id) => !storedOrder.includes(id))];
  const spans = cfg.spans || {};
  const floating = cfg.floating || {};
  const collapsed = cfg.collapsed || {};

  const localRef = useRef({});
  localRef.current = { layout, cfg, order, spans, floating, collapsed };

  const [dragging, setDragging] = useState(null);
  const gridRef = useRef(null);

  const patch = useCallback((obj) => {
    // Always merge into the shared store, never into this board's local copy.
    const base = store.layout || {};
    const cur = base[boardKey] || {};
    const next = {
      ...base,
      [boardKey]: {
        ...cur,
        order: cur.order || localRef.current.order,
        spans: cur.spans || {},
        floating: cur.floating || {},
        collapsed: cur.collapsed || {},
        ...obj,
      },
    };
    persist(next);
  }, [boardKey, persist]);

  const cycleSpan = (id) => {
    const cur = Math.min(spans[id] ?? cards.find((c) => c.id === id)?.span ?? 1, cols);
    patch({ spans: { ...localRef.current.spans, [id]: (cur % cols) + 1 } });
  };

  const toggleCollapse = (id) => patch({ collapsed: { ...localRef.current.collapsed, [id]: !collapsed[id] } });

  const undock = (id) => {
    const count = Object.keys(localRef.current.floating).length;
    patch({ floating: { ...localRef.current.floating, [id]: { x: 18 + count * 16, y: 18 + count * 16, w: 440, h: 380 } } });
  };

  const dock = (id) => {
    const next = { ...localRef.current.floating };
    delete next[id];
    patch({ floating: next });
  };

  const dockAll = () => patch({ floating: {} });

  // ── pointer interactions ────────────────────────────────────────────────
  const endListeners = (move, up) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    setDragging(null);
  };

  const startMove = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const origin = localRef.current.floating[id];
    if (!origin) return;
    const start = { x: e.clientX, y: e.clientY };
    setDragging({ id, mode: 'move' });
    const move = (ev) => {
      patch({
        floating: {
          ...localRef.current.floating,
          [id]: { ...origin, x: Math.max(0, origin.x + (ev.clientX - start.x)), y: Math.max(0, origin.y + (ev.clientY - start.y)) },
        },
      });
    };
    const up = () => endListeners(move, up);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startResize = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const origin = localRef.current.floating[id];
    if (!origin) return;
    const start = { x: e.clientX, y: e.clientY };
    setDragging({ id, mode: 'resize' });
    const move = (ev) => {
      patch({
        floating: {
          ...localRef.current.floating,
          [id]: { ...origin, w: Math.max(320, origin.w + (ev.clientX - start.x)), h: Math.max(220, origin.h + (ev.clientY - start.y)) },
        },
      });
    };
    const up = () => endListeners(move, up);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startReorder = (e, id) => {
    e.preventDefault();
    setDragging({ id, mode: 'reorder' });
    const move = (ev) => {
      const grid = gridRef.current;
      if (!grid) return;
      const els = Array.from(grid.querySelectorAll('[data-card]'));
      const over = els.find((el) => {
        if (el.dataset.card === id) return false;
        const r = el.getBoundingClientRect();
        return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      });
      if (!over) return;
      const cur = localRef.current.order;
      const from = cur.indexOf(id), to = cur.indexOf(over.dataset.card);
      if (from < 0 || to < 0 || from === to) return;
      const next = [...cur];
      next.splice(from, 1);
      next.splice(to, 0, id);
      patch({ order: next });
    };
    const up = () => endListeners(move, up);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const floatIds = order.filter((id) => floating[id]);

  const chrome = (card, isFloat) => (
    <header
      onPointerDown={(e) => (isFloat ? startMove(e, card.id) : startReorder(e, card.id))}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px',
        background: 'rgba(0,0,0,0.28)', borderBottom: `1px solid ${C.border}`,
        cursor: 'grab', touchAction: 'none', userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '13px' }}>{card.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.ink, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
        {card.subtitle && <div style={{ color: C.dim, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{card.subtitle}</div>}
      </div>
      {!isFloat && <button title="Cycle width" onPointerDown={(e) => e.stopPropagation()} onClick={() => cycleSpan(card.id)} style={headerBtn}>▭</button>}
      <button title={isFloat ? 'Dock this card back' : 'Undock (free float)'} onPointerDown={(e) => e.stopPropagation()} onClick={() => (isFloat ? dock(card.id) : undock(card.id))} style={{ ...headerBtn, color: isFloat ? accent : '#a8b4c4' }}>{isFloat ? '▣' : '⤢'}</button>
      <button title="Collapse" onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleCollapse(card.id)} style={headerBtn}>{collapsed[card.id] ? '▸' : '▾'}</button>
    </header>
  );

  return (
    <div>
      {floatIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: C.muted, fontSize: '10px' }}>
          <span>{floatIds.length} floating card{floatIds.length > 1 ? 's' : ''}</span>
          <button onClick={dockAll} style={{ ...headerBtn, width: 'auto', padding: '0 8px', color: accent, borderColor: `${accent}66` }}>▣ Dock all</button>
        </div>
      )}

      <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '12px', alignItems: 'start' }}>
        {order.filter((id) => !floating[id]).map((id) => {
          const card = cards.find((c) => c.id === id);
          if (!card) return null;
          const span = Math.min(spans[id] ?? card.span ?? 1, cols);
          return (
            <section
              key={id}
              data-card={id}
              style={{
                gridColumn: `span ${span}`,
                background: C.surface,
                border: `1px solid ${dragging?.id === id ? accent : C.border}`,
                borderRadius: '8px',
                overflow: 'hidden',
                opacity: dragging?.id === id ? 0.7 : 1,
                boxShadow: dragging?.id === id ? `0 8px 24px ${accent}33` : '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              {chrome(card, false)}
              {!collapsed[id] && <div style={{ padding: '12px' }}>{card.render()}</div>}
            </section>
          );
        })}
      </div>

      {/* Floating layer: undocked cards keep their own position and size. */}
      <div style={{ position: 'relative', minHeight: floatIds.length ? 460 : 0 }}>
        {floatIds.map((id) => {
          const card = cards.find((c) => c.id === id);
          if (!card || !floating[id]) return null;
          const f = floating[id];
          return (
            <div
              key={id}
              style={{
                position: 'absolute', left: f.x, top: f.y, width: f.w, height: collapsed[id] ? 34 : f.h,
                background: C.surface, border: `1px solid ${accent}66`, borderRadius: '8px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.6)', zIndex: dragging?.id === id ? 60 : 30,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
            >
              {chrome(card, true)}
              {!collapsed[id] && (
                <>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px' }}>{card.render()}</div>
                  <div
                    title="Resize"
                    onPointerDown={(e) => startResize(e, id)}
                    style={{ position: 'absolute', right: 0, bottom: 0, width: '16px', height: '16px', cursor: 'nwse-resize', touchAction: 'none', background: `linear-gradient(135deg, transparent 50%, ${accent}99 50%)` }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {splitHint && floatIds.length > 0 && (
        <p style={{ color: C.dim, fontSize: '10px', marginTop: '6px' }}>Floating cards stay inside their own system column in split view.</p>
      )}
    </div>
  );
}