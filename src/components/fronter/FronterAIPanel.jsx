/**
 * FronterAIPanel.jsx — AI tools panel for the fronter system.
 * Mirrors DebtAIPanel's AI tab: transcript sidebar + Q&A/Coach/Intent toggles
 * + draggable AIAssistantPopup. Uses FronterKnowledgeBase instead of debt KB.
 * Works with live call transcripts (speaker: 0=agent, 1=customer) and BOB
 * transcripts (role: 'bob'|'trainee').
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import AIAssistantPopup from '@/components/leads/AIAssistantPopup';

const GOLD = '#10b981';

export default function FronterAIPanel({
  transcript: externalTranscript = [],
  kbEntries: externalKbEntries = [],
  isActive = false,
  transcriptFormat = 'live',
  username = null,
  autoOpenPopup = false,
  lead = null,
  callAttemptNumber = 1,
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [qaActive, setQaActive] = useState(true);
  const [coachActive, setCoachActive] = useState(false);
  const [intentActive, setIntentActive] = useState(false);
  const [allKbEntries, setAllKbEntries] = useState([]);
  const [kbEntries, setKbEntries] = useState(externalKbEntries);
  const [kbNames, setKbNames] = useState([]);
  const [selectedKbName, setSelectedKbName] = useState('Fronter KB');
  const transcriptRef = useRef([]);
  const scrollRef = useRef(null);

  // Load all FronterKnowledgeBase entries
  useEffect(() => {
    const load = async () => {
      try {
        const all = await base44.entities.FronterKnowledgeBase.list('-created_date', 500);
        setAllKbEntries(all || []);
        const names = [...new Set((all || []).map(e => e.category || '').filter(Boolean))];
        setKbNames(names);
      } catch {}
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  // Use external KB entries if provided
  useEffect(() => {
    if (externalKbEntries.length > 0) setKbEntries(externalKbEntries);
  }, [externalKbEntries]);

  // Normalize transcript for AIAssistantPopup (expects speaker: 0=prospect, 1=agent)
  // Live call format: speaker 0=agent, 1=customer → swap to 1=agent, 0=prospect
  // BOB format: role 'trainee'=agent→1, 'bob'=prospect→0
  const normalizedTranscript = useMemo(
    () => transcriptFormat === 'bob'
      ? externalTranscript.map(e => ({ speaker: e.role === 'trainee' ? 1 : 0, text: e.text, time: e.time, sentiment: e.sentiment, interim: e.interim }))
      : externalTranscript.map(e => ({ speaker: e.speaker === 0 ? 1 : 0, text: e.text, time: e.time, sentiment: e.sentiment, interim: e.interim })),
    [externalTranscript, transcriptFormat]
  );

  // Keep transcriptRef in sync — real ref, stable object
  useEffect(() => { transcriptRef.current = normalizedTranscript; }, [normalizedTranscript]);

  // Auto-scroll transcript
  const lineCount = externalTranscript.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [lineCount]);

  // Auto-open popup when call activates
  useEffect(() => {
    if (autoOpenPopup && (qaActive || coachActive || intentActive)) setShowPopup(true);
  }, [autoOpenPopup, qaActive, coachActive, intentActive]);

  const handleKbChange = (name) => {
    setSelectedKbName(name);
    setKbEntries(name ? allKbEntries.filter(e => (e.category || '') === name) : allKbEntries);
  };

  return (
    <>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '400px', maxHeight: '70vh' }}>
        {/* Header */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>🤖 AI Assistant</span>
            {isActive && <span style={{ color: '#4ade80', fontSize: '9px' }}>● Live</span>}
          </div>

          {/* Feature toggles */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: '❓ Q&A', active: qaActive, toggle: () => { setQaActive(p => !p); if (!qaActive) setShowPopup(true); }, color: '#f59e0b' },
              { label: '🎯 Coach', active: coachActive, toggle: () => { setCoachActive(p => !p); if (!coachActive) setShowPopup(true); }, color: '#a78bfa' },
              { label: '🦆 Intent', active: intentActive, toggle: () => { setIntentActive(p => !p); if (!intentActive) setShowPopup(true); }, color: '#60a5fa' },
            ].map(({ label, active, toggle, color }) => (
              <button key={label} onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: active ? `${color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? `${color}44` : 'rgba(255,255,255,0.08)'}`, color: active ? color : '#4a5568', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? color : '#4a5568', boxShadow: active ? `0 0 5px ${color}` : 'none' }} />
                {label}
              </button>
            ))}
            {(qaActive || coachActive || intentActive) && (
              <button onClick={() => setShowPopup(true)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>↗ Open Popup</button>
            )}
          </div>
        </div>

        {/* Full live transcript — scrollable, auto-scrolls to bottom */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }} ref={scrollRef}>
          {normalizedTranscript.length === 0 ? (
            <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
              {isActive ? 'Start talking — transcript appears here. Toggle Q&A/Coach/Intent above to activate AI.' : 'Start a call or BOB session to activate'}
            </div>
          ) : (
            normalizedTranscript.map((t, i) => (
              <div key={i} style={{ marginBottom: '5px', fontSize: '11px' }}>
                <span style={{ color: '#4a5568', fontSize: '9px', marginRight: '5px' }}>{t.time ? new Date(t.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''}</span>
                {t.speaker !== null && <span style={{ color: t.speaker === 1 ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', marginRight: '4px' }}>{t.speaker === 1 ? '🎙 Agent' : '👤 Prospect'}</span>}
                <span style={{ color: '#c4cdd8', opacity: t.interim ? 0.6 : 1, fontStyle: t.interim ? 'italic' : 'normal' }}>{t.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Assistant Popup — draggable, resizable, collapsible sections */}
      {showPopup && (
        <AIAssistantPopup
          lead={lead}
          transcript={normalizedTranscript}
          transcriptRef={transcriptRef}
          kbEntries={kbEntries}
          portalCfg={{}}
          engagementScore={0}
          qaActive={qaActive}
          coachActive={coachActive}
          intentActive={intentActive}
          onToggleQA={() => setQaActive(p => !p)}
          onToggleCoach={() => setCoachActive(p => !p)}
          onToggleIntent={() => setIntentActive(p => !p)}
          onClose={() => setShowPopup(false)}
          onIntentResult={() => {}}
          onQALog={() => {}}
          onCoachTip={() => {}}
          kbName={selectedKbName || 'Fronter KB'}
          allKbEntries={allKbEntries}
          kbNames={kbNames}
          selectedKbName={selectedKbName}
          onKbChange={handleKbChange}
          activeScript={null}
          scripts={[]}
          callAttemptNumber={callAttemptNumber}
          previousCallSummary={null}
          memories={[]}
          pendingQuestion={null}
          username={username}
        />
      )}
    </>
  );
}