/**
 * FronterCallCard.jsx — Unified floating "Call Card" for the fronter.
 * Contains three collapsible sections: Contact Card, Q&A (AI Assistant), Script.
 * Opened via Alt+C. Draggable from the header, 8-way resizable, minimizable to a
 * header bar, and closable with an X button. Layout (position/size/sections) is
 * persisted per user via DebtCoachUserSetting.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachValue } from '@/lib/debtCoachStorage';
import FronterContactCard from './FronterContactCard';
import FronterAIPanel from './FronterAIPanel';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const SECTIONS = [
  { id: 'contact', label: '👤 Contact', color: GOLD },
  { id: 'qa',     label: '💬 Q&A',      color: AMBER },
  { id: 'script', label: '📜 Script',   color: BLUE },
];

export default function FronterCallCard({
  show, onClose, username,
  lead, setLead,
  fronterFirstName, lineKey, lineNumber, isAdmin,
  transcript, fronterKbEntries,
  onSaveLead, onDial, onNext,
  onTranscriptChange, onCallConnected, onOpenQA,
}) {
  // ── Persisted layout ──
  const [pos, setPos] = useDebtCoachValue(username, 'callcard_pos', { x: 40, y: 70 });
  const [size, setSize] = useDebtCoachValue(username, 'callcard_size', { w: 780, h: 680 });
  const [minimized, setMinimized] = useDebtCoachValue(username, 'callcard_min', false);
  const [collapsed, setCollapsed] = useDebtCoachValue(username, 'callcard_collapsed', { contact: false, qa: false, script: true });
  // Proportional heights for the three sections (sum = 100). Persisted.
  const [weights, setWeights] = useDebtCoachValue(username, 'callcard_weights', { contact: 40, qa: 40, script: 20 });

  // ── Script section state ──
  const [scripts, setScripts] = useState([]);
  const [activeScriptId, setActiveScriptId] = useState(null);

  useEffect(() => {
    if (!show) return;
    let active = true;
    const load = async () => {
      try {
        const all = await base44.entities.FronterScript.list('sortOrder', 200);
        if (!active) return;
        setScripts(all || []);
        if (!activeScriptId && all?.length) setActiveScriptId(all[0].id);
      } catch {}
    };
    load();
  }, [show]);

  // ── Drag + resize ──
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizing = useRef(null);

  useEffect(() => {
    if (!show) return;
    const onMove = (e) => {
      if (dragging.current) {
        const w = minimized ? 320 : (size?.w || 780);
        const h = minimized ? 40 : (size?.h || 680);
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - w, dragStart.current.px + e.clientX - dragStart.current.mx)),
          y: Math.max(0, Math.min(window.innerHeight - h, dragStart.current.py + e.clientY - dragStart.current.my)),
        });
      }
      if (resizing.current) {
        const { edge, sx, sy, sw, sh } = resizing.current;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        const minW = 420, minH = 320;
        let nw = sw, nh = sh, nx = pos?.x ?? 40, ny = pos?.y ?? 70;
        if (edge.includes('e')) nw = Math.max(minW, Math.min(window.innerWidth - nx - 4, sw + dx));
        if (edge.includes('s')) nh = Math.max(minH, Math.min(window.innerHeight - ny - 4, sh + dy));
        if (edge.includes('w')) { nw = Math.max(minW, sw - dx); nx = Math.max(0, (pos?.x ?? 40) + (sw - nw)); }
        if (edge.includes('n')) { nh = Math.max(minH, sh - dy); ny = Math.max(0, (pos?.y ?? 70) + (sh - nh)); }
        setSize({ w: nw, h: nh });
        setPos({ x: nx, y: ny });
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [show, minimized, size, pos, setPos, setSize]);

  const startDrag = (e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos?.x ?? 40, py: pos?.y ?? 70 };
    e.preventDefault();
  };
  const startResize = (edge) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { edge, sx: e.clientX, sy: e.clientY, sw: size?.w || 780, sh: size?.h || 680 };
    document.body.style.cursor = 'default';
  };

  // ── Section weight drag (divider between sections) ──
  const dividerDrag = useRef(null);
  useEffect(() => {
    if (!show) return;
    const onMove = (e) => {
      if (!dividerDrag.current) return;
      const { between, sy, sW } = dividerDrag.current;
      const dy = e.clientY - sy;
      const delta = (dy / (size?.h || 680)) * 100;
      setWeights(prev => {
        const w = { ...prev };
        const a = between[0], b = between[1];
        const aMin = 12, bMin = 12;
        let na = sW[a] + delta;
        let nb = sW[b] - delta;
        if (na < aMin) { nb -= (aMin - na); na = aMin; }
        if (nb < bMin) { na -= (bMin - nb); nb = bMin; }
        w[a] = na; w[b] = nb;
        return w;
      });
    };
    const onUp = () => { dividerDrag.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [show, size, setWeights]);

  const startDivider = (between) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dividerDrag.current = { between, sy: e.clientY, sW: { ...weights } };
  };

  if (!show) return null;

  const w = size?.w || 780;
  const h = minimized ? 40 : (size?.h || 680);
  const x = Math.max(0, Math.min(pos?.x ?? 40, window.innerWidth - w));
  const y = Math.max(0, Math.min(pos?.y ?? 70, window.innerHeight - h));
  const coll = collapsed || { contact: false, qa: false, script: true };
  const wgt = weights || { contact: 40, qa: 40, script: 20 };

  // Visible (expanded) sections in order
  const visibleSections = SECTIONS.filter(s => !coll[s.id]);
  // Compute flex weight for each visible section
  const totalWeight = visibleSections.reduce((s, sec) => s + (wgt[sec.id] || 0), 0) || 1;

  const activeScript = scripts.find(s => s.id === activeScriptId) || scripts[0];

  const toggleSection = (id) => setCollapsed({ ...coll, [id]: !coll[id] });

  const edge = (style) => ({ position: 'absolute', zIndex: 5, ...style });
  const EDGE_H = 6, EDGE_V = 6, CORNER = 14;

  return (
    <div style={{ position: 'fixed', left: x, top: y, width: w, height: h, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.85)', zIndex: 20000, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Georgia, serif' }}>

      {/* ── Resize handles ── */}
      {!minimized && (
        <>
          <div style={edge({ top: 0, left: CORNER, right: CORNER, height: EDGE_H, cursor: 'ns-resize' })} onMouseDown={startResize('n')} />
          <div style={edge({ bottom: 0, left: CORNER, right: CORNER, height: EDGE_H, cursor: 'ns-resize' })} onMouseDown={startResize('s')} />
          <div style={edge({ left: 0, top: CORNER, bottom: CORNER, width: EDGE_V, cursor: 'ew-resize' })} onMouseDown={startResize('w')} />
          <div style={edge({ right: 0, top: CORNER, bottom: CORNER, width: EDGE_V, cursor: 'ew-resize' })} onMouseDown={startResize('e')} />
          <div style={edge({ top: 0, left: 0, width: CORNER, height: CORNER, cursor: 'nwse-resize' })} onMouseDown={startResize('nw')} />
          <div style={edge({ top: 0, right: 0, width: CORNER, height: CORNER, cursor: 'nesw-resize' })} onMouseDown={startResize('ne')} />
          <div style={edge({ bottom: 0, left: 0, width: CORNER, height: CORNER, cursor: 'nesw-resize' })} onMouseDown={startResize('sw')} />
          <div style={edge({ bottom: 0, right: 0, width: CORNER, height: CORNER, cursor: 'nwse-resize' })} onMouseDown={startResize('se')} />
        </>
      )}

      {/* ── Header (drag handle) ── */}
      <div onMouseDown={startDrag} style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'move', userSelect: 'none', flexShrink: 0, zIndex: 6 }}>
        <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>📞 Call Card</span>
        {lead && <span style={{ color: '#8a9ab8', fontSize: '11px' }}>· {lead.firstName} {lead.lastName}</span>}
        <div style={{ flex: 1 }} />
        <button onClick={() => setMinimized(!minimized)} title={minimized ? 'Expand' : 'Minimize'} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{minimized ? '▢' : '—'}</button>
        <button onClick={onClose} title="Close (Alt+C)" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '3px 11px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', lineHeight: 1 }}>×</button>
      </div>

      {/* ── Body: collapsible sections ── */}
      {!minimized && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {SECTIONS.map((sec, i) => {
            const isCollapsed = coll[sec.id];
            const prevVisible = i > 0 && !coll[SECTIONS[i - 1].id];
            return (
              <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: isCollapsed ? '0 0 auto' : `${wgt[sec.id] || 0}`, overflow: 'hidden' }}>
                {/* Divider above (drag to resize between previous and this) */}
                {prevVisible && (
                  <div onMouseDown={startDivider([SECTIONS[i - 1].id, sec.id])} title="Drag to resize sections" style={{ height: 6, cursor: 'row-resize', flexShrink: 0, background: 'rgba(16,185,129,0.06)', borderTop: '1px solid rgba(16,185,129,0.18)', borderBottom: '1px solid rgba(16,185,129,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.06)'}>
                    <div style={{ width: 36, height: 2, borderRadius: 2, background: 'rgba(16,185,129,0.4)' }} />
                  </div>
                )}
                {/* Section header */}
                <div onClick={() => toggleSection(sec.id)} style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.25)', borderBottom: isCollapsed ? '1px solid rgba(255,255,255,0.05)' : `1px solid ${sec.color}22`, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: sec.color, boxShadow: `0 0 5px ${sec.color}` }} />
                  <span style={{ color: sec.color, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1.5px', textTransform: 'uppercase', flex: 1 }}>{sec.label}</span>
                  <span style={{ color: '#4a5568', fontSize: '11px' }}>{isCollapsed ? '▸' : '▾'}</span>
                </div>
                {/* Section content */}
                {!isCollapsed && (
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {sec.id === 'contact' && (
                      lead ? (
                        <FronterContactCard
                          lead={lead}
                          username={username}
                          fronterFirstName={fronterFirstName}
                          lineKey={lineKey}
                          lineNumber={lineNumber}
                          onClose={onClose}
                          onSave={onSaveLead}
                          onDial={onDial}
                          onNext={onNext}
                          isAdmin={isAdmin}
                          onTranscriptUpdate={onTranscriptChange}
                          onCallConnected={onCallConnected}
                          onOpenQA={() => { setCollapsed(c => ({ ...c, qa: false })); onOpenQA?.(); }}
                          embedded
                        />
                      ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontSize: '12px', padding: '20px' }}>Select a lead from the list to load the contact card.</div>
                      )
                    )}
                    {sec.id === 'qa' && (
                      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <FronterAIPanel
                          transcript={transcript || []}
                          kbEntries={fronterKbEntries || []}
                          isActive={(transcript || []).length > 0}
                          transcriptFormat="live"
                          username={username}
                          autoOpenPopup={false}
                          lead={lead}
                        />
                      </div>
                    )}
                    {sec.id === 'script' && (
                      <ScriptSection scripts={scripts} activeScript={activeScript} activeScriptId={activeScriptId} setActiveScriptId={setActiveScriptId} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Script section: dropdown + read-only viewer with font size ──
function ScriptSection({ scripts, activeScript, activeScriptId, setActiveScriptId }) {
  const [fontSize, setFontSize] = useState(14);
  if (!scripts || scripts.length === 0) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontSize: '12px', padding: '20px' }}>No scripts yet. Create one in the Scripts tab.</div>;
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
        <select value={activeScriptId || ''} onChange={e => setActiveScriptId(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '4px 8px', color: '#e8e0d0', fontSize: '11px', outline: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
          {scripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => setFontSize(f => Math.max(10, f - 1))} style={{ background: 'rgba(96,165,250,0.1)', color: BLUE, border: '1px solid rgba(96,165,250,0.25)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer', fontSize: '11px' }}>A−</button>
          <span style={{ color: '#6b7280', fontSize: '10px', minWidth: '28px', textAlign: 'center' }}>{fontSize}px</span>
          <button onClick={() => setFontSize(f => Math.min(28, f + 1))} style={{ background: 'rgba(96,165,250,0.1)', color: BLUE, border: '1px solid rgba(96,165,250,0.25)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer', fontSize: '11px' }}>A+</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', color: activeScript?.color || '#e8e0d0', fontSize: `${fontSize}px`, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
        {activeScript?.content || 'No content in this script.'}
      </div>
    </div>
  );
}