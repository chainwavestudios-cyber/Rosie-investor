/**
 * FronterReportPopup.jsx — Movable, resizable popup that displays an AI
 * performance audit report. Shows APS score badge, full markdown report,
 * and coaching highlights. Closes on ESC, close button, or "Got it" button.
 *
 * Does NOT appear during active calls — FronterPage queues it and shows
 * it only after the call ends.
 */
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const TIER_COLORS = {
  green: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#10b981', emoji: '🟢', label: 'EXCELLENT' },
  yellow: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#f59e0b', emoji: '🟡', label: 'NEEDS WORK' },
  red: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444', emoji: '🔴', label: 'CRITICAL' },
};

export default function FronterReportPopup({ report, onClose }) {
  const [pos, setPos] = useState({ x: 120, y: 80 });
  const [size, setSize] = useState({ w: 560, h: 640 });
  const dragRef = useRef(null);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const tier = TIER_COLORS[report?.scoreTier] || TIER_COLORS.yellow;
  const avgDur = report?.avgCallDurationSeconds || 0;
  const avgDurStr = `${Math.floor(avgDur / 60)}m ${avgDur % 60}s`;

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `2px solid ${tier.border}`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', zIndex: 45000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: tier.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <div>
            <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>Performance Audit Report</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>{report?.fronterName || report?.fronterUsername} · {report?.shiftPeriod} · {report?.reportDate}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: '0 4px', lineHeight: 1 }}>×</button>
      </div>

      {/* Score badge */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: tier.bg, border: `2px solid ${tier.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ color: tier.text, fontSize: '20px', fontWeight: 'bold' }}>{report?.apsScore || 0}</span>
            <span style={{ color: '#6b7280', fontSize: '7px', textTransform: 'uppercase', letterSpacing: '1px' }}>/ 100</span>
          </div>
          <div>
            <div style={{ color: tier.text, fontSize: '13px', fontWeight: 'bold' }}>{tier.emoji} {tier.label}</div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>Agent Performance Score</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#60a5fa', fontSize: '16px', fontWeight: 'bold' }}>{report?.totalCalls || 0}</div>
            <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Calls</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#a78bfa', fontSize: '16px', fontWeight: 'bold' }}>{report?.totalTransfers || 0}</div>
            <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Transfers</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>{avgDurStr}</div>
            <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg Duration</div>
          </div>
        </div>
      </div>

      {/* Report content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
        <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.8, fontFamily: 'Georgia, serif' }}>
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px' }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ color: '#8a9ab8', fontSize: '12px', fontWeight: 'bold', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</h3>,
              p: ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
              ul: ({ children }) => <ul style={{ margin: '0 0 10px', paddingLeft: '20px' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '0 0 10px', paddingLeft: '20px' }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
              strong: ({ children }) => <strong style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{children}</strong>,
              em: ({ children }) => <em style={{ color: '#8a9ab8' }}>{children}</em>,
              hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '14px 0' }} />,
              blockquote: ({ children }) => <blockquote style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: '12px', margin: '8px 0', color: '#8a9ab8' }}>{children}</blockquote>,
            }}
          >
            {report?.reportMarkdown || 'No report content available.'}
          </ReactMarkdown>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
        <button onClick={onClose} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>✓ Got It</button>
      </div>

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(400, startW + ev.clientX - startX), h: Math.max(400, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}