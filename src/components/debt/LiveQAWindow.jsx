import { useMemo, useRef, useState } from 'react';
import { QASection } from '@/components/leads/AIAssistantPopup';

const GOLD = '#10b981';

// Reuse the complete Q&A-only interface, not a reduced list of answers.
export default function LiveQAWindow({ panel, qaItems, transcript = [], kbEntries = [], lead, qaActive, onToggleQA }) {
  const [manualQ, setManualQ] = useState('');
  const [aiPanelItem, setAiPanelItem] = useState(null);
  const normalized = useMemo(() => transcript.map(line => ({ ...line, speaker: line.speaker === 0 ? 1 : 0 })), [transcript]);
  const transcriptRef = useRef(normalized);
  transcriptRef.current = normalized;

  return (
    <div role="region" aria-label="Live Q&A Only" style={{ ...panel.floatingStyle, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
      <div onMouseDown={e => { if (!e.target.closest('button,input,select,textarea,a')) panel.onDragStart(e); }} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', flex: 1 }}>❓ Live Q&A Only</span>
        <button onClick={onToggleQA} aria-pressed={qaActive} style={{ color: GOLD }}>{qaActive ? 'Q&A ON' : 'Q&A OFF'}</button>
        <button onClick={panel.saveLayout} style={{ color: GOLD }}>{panel.layoutSaved ? 'Saved' : 'Save Size'}</button>
        <button onClick={panel.toggle} style={{ color: GOLD }}>⬇ Pop In</button>
      </div>
      <QASection transcript={normalized} transcriptRef={transcriptRef} kbEntries={kbEntries} active={qaActive}
        manualQ={manualQ} setManualQ={setManualQ} collapsed={false} qaOnly={true}
        onSidePanel={setAiPanelItem} lead={lead} liveQAItems={qaItems} />
      {aiPanelItem && <div style={{ flex: '0 1 35%', minHeight: 80, overflow: 'auto', padding: 12, borderTop: '1px solid rgba(16,185,129,0.3)', color: '#d5dce7' }}>
        <button onClick={() => setAiPanelItem(null)} aria-label="Close answer details" style={{ float: 'right', color: GOLD }}>×</button>
        <strong>{aiPanelItem.type === 'moreInfo' ? 'More Info' : aiPanelItem.type === 'talkingPoints' ? 'Talking Points' : 'Research'}</strong>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>{aiPanelItem.loading ? 'Loading…' : aiPanelItem.content}</div>
      </div>}
      {panel.resizeHandles}
    </div>
  );
}