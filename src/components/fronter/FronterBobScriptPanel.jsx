/**
 * FronterBobScriptPanel.jsx — Floating script panel for BOB training that renders
 * the SAME script and the SAME step buttons as the /fronter prospect contact card.
 *
 * Parsing mirrors FronterContactCard: substitute lead/fronter vars, strip
 * [[AI:field]] tags, then split the script at @@DEBT_CONFIRM@@ / @@AI_INPUT@@ /
 * @@SEND_EMAIL@@ so those become live buttons, and stop at @@COMPLETED_STEPS@@
 * whose "Completed Steps → Transfer" button opens the transfer popout.
 */
import { useState, useEffect, useRef } from 'react';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import FronterContactScript from '@/components/fronter/FronterContactScript';

const GOLD = '#10b981';

export default function FronterBobScriptPanel({
  scripts, customerName, fronterFirstName, onComplete, onDebtConfirm, debtConfirming,
  onAiInput, aiInputRunning, onSendEmail, message, onClose,
}) {
  const [activeScript, setActiveScript] = useState(() => scripts?.[0] || null);
  const [pos, setPos] = useState({ x: 440, y: 60 });
  const [size, setSize] = useState({ w: 420, h: 520 });
  const dragRef = useRef(null);

  useEffect(() => {
    if (scripts.length > 0 && !scripts.some(s => s.id === activeScript?.id)) setActiveScript(scripts[0]);
  }, [scripts, activeScript]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Same parsing as the prospect contact card
  const rawScript = activeScript?.content || '';
  const substituted = substituteScriptVars(rawScript, { lead: { firstName: customerName }, fronterFirstName });
  const displayScript = substituted.replace(/\[\[AI:\w+\]\]/gi, '');
  const completedStepsIdx = displayScript.indexOf('@@COMPLETED_STEPS@@');
  const hasCompletedSteps = completedStepsIdx !== -1;
  const mainScriptPart = hasCompletedSteps ? displayScript.slice(0, completedStepsIdx) : displayScript;
  const segments = mainScriptPart.split(/@@(DEBT_CONFIRM|AI_INPUT|SEND_EMAIL)@@/i);

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <div onMouseDown={onDragStart} style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Script</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
      </div>
      <FronterContactScript
        scripts={scripts}
        activeScript={activeScript}
        onSelectScript={setActiveScript}
        segments={segments}
        hasCompletedSteps={hasCompletedSteps}
        onComplete={() => onComplete?.(activeScript)}
        onDebtConfirm={onDebtConfirm}
        debtConfirming={debtConfirming}
        onAiInput={onAiInput}
        aiInputRunning={aiInputRunning}
        onSendEmail={onSendEmail}
        message={message}
      />
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(300, startW + ev.clientX - startX), h: Math.max(280, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}