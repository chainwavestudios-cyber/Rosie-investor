/**
 * LiveTranscriptPanel.jsx — Pop-out-able transcript panel with tabs.
 * Tabs: Transcript (live call messages) | Scripts (personal teleprompter + pitches).
 * Each customer question line has an "Answer" button to re-trigger Q&A.
 * Uses usePopOutPanel for drag/resize with localStorage layout persistence.
 */
import { useState } from 'react';
import { DebtPitchPanel } from '@/components/debt/DebtPitchTab';
import { MyScriptsTab } from '@/components/debt/DebtScriptEditor';

const GOLD = '#10b981';

export default function LiveTranscriptPanel({ transcript, phase, panel, onAnswerQuestion }) {
  const [tab, setTab] = useState('transcript');

  const tabs = (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={() => setTab('transcript')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${tab === 'transcript' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: tab === 'transcript' ? `${GOLD}18` : 'transparent', color: tab === 'transcript' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📋 Transcript</button>
      <button onClick={() => setTab('scripts')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${tab === 'scripts' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: tab === 'scripts' ? `${GOLD}18` : 'transparent', color: tab === 'scripts' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📝 Scripts</button>
    </div>
  );

  const renderTranscript = () => (
    <>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: '#6b7280', fontSize: '10px' }}><span style={{ color: '#60a5fa' }}>● Agent</span> · <span style={{ color: GOLD }}>● Customer</span></div>
        <div style={{ color: '#6b7280', fontSize: '10px' }}>{transcript.length} lines</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {transcript.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>{phase === 'live' ? 'Listening… start speaking.' : 'No transcript yet. Start a call to begin.'}</div>
        ) : transcript.map((msg, i) => {
          const isAgent = msg.speaker === 0;
          const isQuestion = !isAgent && msg.text && msg.text.includes('?');
          const sentColor = msg.sentiment === 'positive' ? '#4ade80' : msg.sentiment === 'negative' ? '#ef4444' : '#6b7280';
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '10px', justifyContent: isAgent ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
              {isQuestion && onAnswerQuestion && (
                <button
                  onClick={() => onAnswerQuestion(msg.text)}
                  title="Send to Q&A"
                  style={{
                    flexShrink: 0, marginTop: '4px', width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)',
                    color: '#f59e0b', fontSize: '14px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}
                >💡</button>
              )}
              <div style={{ maxWidth: '85%', background: isAgent ? 'rgba(96,165,250,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: isAgent ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ color: isAgent ? '#60a5fa' : GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAgent ? '🎙 Agent' : '👤 Customer'}</span>
                  {msg.sentiment && <span style={{ color: sentColor, fontSize: '9px' }}>● {msg.sentiment}</span>}
                </div>
                <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderScripts = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
      <MyScriptsTab />
      <div style={{ marginTop: '12px' }}>
        <DebtPitchPanel />
      </div>
    </div>
  );

  // Popped out — floating, draggable, resizable
  if (panel.poppedOut) {
    return (
      <div style={{ ...panel.floatingStyle, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
        <div onMouseDown={panel.onDragStart} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
          {tabs}
          <button onClick={panel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬇ Pop In</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {tab === 'transcript' ? renderTranscript() : renderScripts()}
        </div>
        {panel.resizeHandles}
      </div>
    );
  }

  // Docked — inline with pop-out button
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {tabs}
        <button onClick={panel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬆ Pop Out</button>
      </div>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
        {tab === 'transcript' ? renderTranscript() : renderScripts()}
      </div>
    </div>
  );
}