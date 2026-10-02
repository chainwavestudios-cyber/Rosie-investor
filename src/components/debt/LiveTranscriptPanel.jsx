/**
 * LiveTranscriptPanel.jsx — Pop-out-able transcript-only panel.
 * Scripts and Pitches are now in their own separate LiveScriptsPanel window.
 * Each customer question line has an "Answer" button to re-trigger Q&A,
 * plus a "+" button to join lines for multi-line questions/statements.
 * Uses usePopOutPanel for drag/resize with database-backed layout persistence.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const GOLD = '#10b981';

// Classification badge colors
const CLASS_COLORS = {
  question: '#f59e0b',
  statement: '#6b7280',
  objection: '#ef4444',
  greeting: '#4ade80',
  closing: '#60a5fa',
};

export default function LiveTranscriptPanel({ transcript, phase, panel, onAnswerQuestion, lead, micLabel, username }) {
  const [selected, setSelected] = useState({});
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true); // user wants auto-scroll; false = user scrolled up to read

  // Track whether the user has scrolled away from the bottom.
  // While away from bottom, new lines do NOT reset scroll position.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottomRef.current = isNearBottom;
  }, []);

  // Auto-scroll to bottom ONLY when the user is already at/near the bottom.
  // If the user scrolled up to read or select lines, we leave the position alone.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const toggleSelect = (i) => {
    setSelected(prev => { const next = { ...prev }; if (next[i]) delete next[i]; else next[i] = true; return next; });
    // Selecting a line means the user is interacting — stop auto-scroll so the
    // selection bar stays visible and the view doesn't jump.
    stickToBottomRef.current = false;
  };
  const clearSelected = () => {
    setSelected({});
    // After clearing, check if we're near the bottom to resume auto-scroll
    const el = scrollRef.current;
    if (el) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      stickToBottomRef.current = isNearBottom;
    }
  };
  const selectedIndices = Object.keys(selected).map(Number).sort((a, b) => a - b);
  const selectedCount = selectedIndices.length;

  const sendSelected = () => {
    if (selectedCount === 0 || !onAnswerQuestion) return;
    const combined = selectedIndices.map(i => transcript[i]?.text).filter(Boolean).join(' ').trim();
    if (combined) onAnswerQuestion(combined);
    clearSelected();
  };

  const renderTranscript = () => (
    <>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: '#6b7280', fontSize: '10px' }}><span style={{ color: '#60a5fa' }}>● Agent</span> · <span style={{ color: '#a78bfa' }}>● Transfer</span> · <span style={{ color: GOLD }}>● Customer</span></div>
        <div style={{ color: '#6b7280', fontSize: '10px' }}>{transcript.length} lines{selectedCount > 0 && <span style={{ color: '#f59e0b', marginLeft: '6px' }}>· {selectedCount} selected</span>}</div>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', paddingBottom: selectedCount > 0 ? '64px' : '14px' }}>
        {transcript.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>{phase === 'live' ? 'Listening… start speaking.' : 'No transcript yet. Start a call to begin.'}</div>
        ) : transcript.map((msg, i) => {
          const isAgent = msg.speaker === 0;
          const isTransferAgent = msg.speaker === 2;
          const sentColor = msg.sentiment === 'positive' ? '#4ade80' : msg.sentiment === 'negative' ? '#ef4444' : '#6b7280';
          const isSelected = !!selected[i];
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '10px', justifyContent: isAgent ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
              {!isAgent && !isTransferAgent && onAnswerQuestion && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, marginTop: '2px' }}>
                  <button
                    onClick={() => onAnswerQuestion(msg.text)}
                    title="Send this line to Q&A"
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)',
                      color: '#f59e0b', fontSize: '14px', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}
                  >💡</button>
                  <button
                    onClick={() => toggleSelect(i)}
                    title={isSelected ? 'Remove from selection' : 'Select for combined Q&A'}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: isSelected ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isSelected ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.12)'}`,
                      color: isSelected ? '#f59e0b' : '#6b7280', fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}
                  >{isSelected ? '✓' : '+'}</button>
                </div>
              )}
              <div style={{ maxWidth: '85%', background: isAgent ? 'rgba(96,165,250,0.1)' : isTransferAgent ? 'rgba(167,139,250,0.1)' : isSelected ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : isTransferAgent ? 'rgba(167,139,250,0.2)' : isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.2)'}`, borderRadius: isAgent ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ color: isAgent ? '#60a5fa' : isTransferAgent ? '#a78bfa' : GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAgent ? '🎙 Agent' : isTransferAgent ? '🔀 Transfer Agent' : '👤 Customer'}</span>
                  {msg.classification && (
                    <span style={{ color: CLASS_COLORS[msg.classification] || '#6b7280', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '1px 5px', borderRadius: '2px', background: `${CLASS_COLORS[msg.classification] || '#6b7280'}18` }}>{msg.classification}</span>
                  )}
                  {msg.sentiment && <span style={{ color: sentColor, fontSize: '9px' }}>● {msg.sentiment}</span>}
                </div>
                <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      {selectedCount > 0 && (
        <div style={{ position: 'absolute', bottom: '8px', left: '16px', right: '16px', background: '#0d1b2a', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 10 }}>
          <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>{selectedCount} line{selectedCount !== 1 ? 's' : ''} selected</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={clearSelected} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
            <button onClick={sendSelected} style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>💡 Send to Q&A</button>
          </div>
        </div>
      )}
    </>
  );

  const header = <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 Live Transcript</span>;

  // Popped out — floating, draggable, resizable
  if (panel.poppedOut) {
    return (
      <div style={{ ...panel.floatingStyle, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
        <div onMouseDown={panel.onDragStart} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
          {header}
          <button onClick={panel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬇ Pop In</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {renderTranscript()}
        </div>
        {panel.resizeHandles}
      </div>
    );
  }

  // Docked — inline with pop-out button
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {header}
        <button onClick={panel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬆ Pop Out</button>
      </div>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh', position: 'relative' }}>
        {renderTranscript()}
      </div>
    </div>
  );
}