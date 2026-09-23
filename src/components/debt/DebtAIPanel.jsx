/**
 * DebtAIPanel.jsx — AI tools panel for debt settlement coaching.
 * Three tabs: AI (Twilio Stream + Q&A/Coach/Intent popout) | Pitches | Signals.
 * Uses the same AIAssistantPopup as the admin panel — draggable, resizable, collapsible sections.
 * Works with live call transcripts (speaker: 0=agent, 1=customer) and BOB transcripts (role: 'bob'|'trainee').
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useTwilioDevice } from '@/lib/TwilioDeviceContext';
import { DebtPitchPanel } from '@/components/debt/DebtPitchTab';
import DebtIntentSignals, { DEBT_INTENT_RULES } from '@/components/debt/DebtIntentSignals';
import AIAssistantPopup from '@/components/leads/AIAssistantPopup';

const GOLD = '#10b981';
const DEBT_KB_CATEGORIES = ['debt_kb', 'debt_faq', 'debt_agent', 'debt_customer', 'debt_doc', 'debt_web', 'debt_call', 'debt_hotpoints'];

export default function DebtAIPanel({
  transcript: externalTranscript = [],
  kbEntries: externalKbEntries = [],
  isActive = false,
  transcriptFormat = 'live',
  profileData = null,
  intentScore: externalIntentScore = null,
  ledgerExtracting = false,
}) {
  const { incomingCall } = useTwilioDevice();

  const [rightTab, setRightTab] = useState('ai');
  const [showPopup, setShowPopup] = useState(false);
  const [qaActive, setQaActive] = useState(false);
  const [coachActive, setCoachActive] = useState(false);
  const [intentActive, setIntentActive] = useState(false);
  const [streamStatus, setStreamStatus] = useState('idle');
  const [error, setError] = useState('');
  const [twilioTranscript, setTwilioTranscript] = useState([]);
  const [allKbEntries, setAllKbEntries] = useState([]);
  const [kbEntries, setKbEntries] = useState(externalKbEntries);
  const [kbNames, setKbNames] = useState([]);
  const [selectedKbName, setSelectedKbName] = useState('Debt Settlement');

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptRef = useRef([]);

  // Load all KB entries
  useEffect(() => {
    base44.entities.KnowledgeBase.list('-created_date', 500).then(all => {
      const entries = all || [];
      setAllKbEntries(entries);
      const names = [...new Set(entries.map(e => e.kbName || '').filter(Boolean))];
      setKbNames(names);
    }).catch(() => {});
  }, []);

  // Use external KB entries if provided
  useEffect(() => {
    if (externalKbEntries.length > 0) setKbEntries(externalKbEntries);
  }, [externalKbEntries]);

  // Determine which transcript to use (Twilio stream takes priority over external)
  const activeTranscript = streamStatus === 'connected' ? twilioTranscript : externalTranscript;

  // Normalize transcript for AIAssistantPopup (expects speaker: 0=prospect, 1=agent)
  // Live call format: speaker 0=agent, 1=customer → swap to 1=agent, 0=prospect
  // BOB format: role 'trainee'=agent→1, 'bob'=prospect→0
  const normalizedTranscript = transcriptFormat === 'bob'
    ? activeTranscript.map(e => ({ speaker: e.role === 'trainee' ? 1 : 0, text: e.text, time: e.time, sentiment: e.sentiment }))
    : activeTranscript.map(e => ({ speaker: e.speaker === 0 ? 1 : 0, text: e.text, time: e.time, sentiment: e.sentiment }));

  // Keep transcriptRef in sync
  useEffect(() => { transcriptRef.current = normalizedTranscript; }, [normalizedTranscript]);

  // ── Twilio Stream Connect ──────────────────────────────────────────
  const connectStream = async () => {
    if (streamStatus === 'connected') { disconnectStream(); return; }

    setError(''); setStreamStatus('connecting');

    const call = incomingCall?.call;
    if (!call) { setError('No active Twilio call. Start or answer a call first.'); setStreamStatus('error'); return; }

    try {
      let remoteStream = call.getRemoteStream?.() || null;
      let localStream = call.getLocalStream?.() || null;

      if (!remoteStream && !localStream) {
        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 250));
          remoteStream = call.getRemoteStream?.() || null;
          localStream = call.getLocalStream?.() || null;
          if (remoteStream) break;
        }
      }

      if (!remoteStream && !localStream) { setError('Could not get call audio streams.'); setStreamStatus('error'); return; }

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      audioCtxRef.current = audioCtx;

      // ch0 = remote (prospect), ch1 = local (agent)
      const merger = audioCtx.createChannelMerger(2);
      if (remoteStream) audioCtx.createMediaStreamSource(remoteStream).connect(merger, 0, 0);
      if (localStream) audioCtx.createMediaStreamSource(localStream).connect(merger, 0, 1);
      const dest = audioCtx.createMediaStreamDestination();
      merger.connect(dest);
      streamRef.current = dest.stream;

      let dgKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
      if (!dgKey) { const tokenRes = await base44.functions.invoke('deepgramToken', {}); dgKey = tokenRes?.key || tokenRes?.data?.key || ''; }
      if (!dgKey) throw new Error('No Deepgram token');

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300&sentiment=true&multichannel=true&channels=2&sample_rate=16000&encoding=linear16`,
        ['token', dgKey]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setStreamStatus('connected');
        const proc = audioCtx.createScriptProcessor(4096, 2, 2);
        processorRef.current = proc;
        const src = audioCtx.createMediaStreamSource(dest.stream);
        proc.onaudioprocess = e => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const ch0 = e.inputBuffer.getChannelData(0);
          const ch1 = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : null;
          const len = ch0.length;
          const pcm = new Int16Array(len * 2);
          for (let i = 0; i < len; i++) {
            pcm[i * 2] = Math.max(-32768, Math.min(32767, ch0[i] * 32768));
            pcm[i * 2 + 1] = Math.max(-32768, Math.min(32767, (ch1?.[i] ?? 0) * 32768));
          }
          ws.send(pcm.buffer);
        };
        src.connect(proc); proc.connect(audioCtx.destination);
      };

      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const alt = data?.channel?.alternatives?.[0];
          const text = alt?.transcript?.trim();
          if (!text || !data.is_final) return;
          const channelIdx = Array.isArray(data.channel_index) ? data.channel_index[0] : null;
          // ch0 = remote = prospect (speaker 0), ch1 = local = agent (speaker 1)
          const speaker = channelIdx !== null ? channelIdx : 0;
          const entry = { text, time: new Date(), speaker, sentiment: alt?.sentiments?.segments?.[0]?.sentiment || null };
          setTwilioTranscript(prev => [...prev, entry]);
        } catch {}
      };

      ws.onerror = () => { setError('Deepgram WebSocket error'); setStreamStatus('error'); };
      ws.onclose = (e) => { if (e.code !== 1000) setError(`Stream disconnected (code ${e.code})`); setStreamStatus('idle'); };
    } catch (e) { setError(`Stream error: ${e.message}`); setStreamStatus('error'); }
  };

  const disconnectStream = () => {
    try { wsRef.current?.close(); } catch {}
    try { processorRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    wsRef.current = null; audioCtxRef.current = null; processorRef.current = null; streamRef.current = null;
    setStreamStatus('idle');
  };

  useEffect(() => () => disconnectStream(), []);
  useEffect(() => { if (!incomingCall && streamStatus === 'connected') disconnectStream(); }, [incomingCall, streamStatus]);

  // Toggle handlers — open popup when toggled on
  const toggleQA = () => { const n = !qaActive; setQaActive(n); if (n) setShowPopup(true); };
  const toggleCoach = () => { const n = !coachActive; setCoachActive(n); if (n) setShowPopup(true); };
  const toggleIntent = () => { const n = !intentActive; setIntentActive(n); if (n) setShowPopup(true); };

  const streamStatusLight = { idle: '#4a5568', connecting: '#f59e0b', connected: '#4ade80', error: '#ef4444' }[streamStatus];

  const handleKbChange = (name) => {
    setSelectedKbName(name);
    setKbEntries(name ? allKbEntries.filter(e => (e.kbName || '') === name) : allKbEntries.filter(e => !e.kbName || e.kbName === ''));
  };

  return (
    <>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

        {/* Tabs */}
        <div style={{ padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '2px' }}>
          {[{ id: 'ai', label: '🤖 AI' }, { id: 'pitches', label: '🎤 Pitches' }, { id: 'signals', label: '🎯 Signals' }].map(t => (
            <button key={t.id} onClick={() => setRightTab(t.id)} style={{ padding: '10px 12px', background: 'none', border: 'none', borderBottom: `2px solid ${rightTab === t.id ? GOLD : 'transparent'}`, color: rightTab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: rightTab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
          ))}
        </div>

        {rightTab === 'ai' && (
          <>
            {/* Control bar */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>🧠 AI Assistant</span>
                {streamStatus === 'connected' && <span style={{ color: '#4ade80', fontSize: '9px' }}>● Stream Live</span>}
              </div>

              {/* Twilio Stream Connect */}
              <button onClick={connectStream} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: streamStatus === 'connected' ? 'rgba(74,222,128,0.1)' : streamStatus === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${streamStatus === 'connected' ? 'rgba(74,222,128,0.4)' : streamStatus === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.12)'}`, color: streamStatus === 'connected' ? '#4ade80' : streamStatus === 'error' ? '#ef4444' : '#8a9ab8', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: streamStatusLight, animation: streamStatus === 'connecting' ? 'pulse 0.8s infinite' : streamStatus === 'connected' ? 'pulse 2.5s infinite' : 'none' }} />
                {streamStatus === 'connected' ? '⏹ Disconnect Stream' : '🔗 Twilio Stream Connect'}
              </button>

              {/* Feature toggles — open popup */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { label: '❓ Q&A', active: qaActive, toggle: toggleQA, color: '#f59e0b' },
                  { label: '🎯 Coach', active: coachActive, toggle: toggleCoach, color: '#a78bfa' },
                  { label: '🦆 Intent', active: intentActive, toggle: toggleIntent, color: '#60a5fa' },
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

            {/* Error */}
            {error && <div style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.06)' }}><div style={{ color: '#ef4444', fontSize: '10px' }}>{error}</div></div>}

            {/* Profile / Ledger / Intent Score (from live call) */}
            {(ledgerExtracting || externalIntentScore !== null || profileData) && (
              <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ledgerExtracting && <div style={{ color: GOLD, fontSize: '10px', textAlign: 'center' }}>⏳ Extracting debt info from call…</div>}
                {externalIntentScore !== null && (
                  <div style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ color: '#f472b6', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>📊 Intent Score</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${externalIntentScore}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#f59e0b,#4ade80)', borderRadius: '3px', transition: 'width 0.5s' }} />
                      </div>
                      <span style={{ color: '#f472b6', fontSize: '13px', fontWeight: 'bold' }}>{externalIntentScore}</span>
                    </div>
                  </div>
                )}
                {profileData && (
                  <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ color: '#a78bfa', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>🧠 Profile</div>
                    <div style={{ color: '#c4cdd8', fontSize: '11px' }}>Animal: <strong>{profileData.animalType || 'unknown'}</strong></div>
                    {profileData.overallIntentLabel && <div style={{ color: '#8a9ab8', fontSize: '10px' }}>{profileData.overallIntentLabel}</div>}
                  </div>
                )}
              </div>
            )}

            {/* Transcript preview */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              {normalizedTranscript.length === 0 ? (
                <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
                  {streamStatus === 'connected' ? 'Listening…' : isActive ? 'Connect Twilio stream or start audio — toggle Q&A/Coach/Intent above' : 'Start a call to activate'}
                </div>
              ) : (
                [...normalizedTranscript].reverse().slice(0, 8).map((t, i) => (
                  <div key={i} style={{ marginBottom: '5px', fontSize: '11px' }}>
                    <span style={{ color: '#4a5568', fontSize: '9px', marginRight: '5px' }}>{new Date(t.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                    {t.speaker !== null && <span style={{ color: t.speaker === 1 ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', marginRight: '4px' }}>{t.speaker === 1 ? '🎙 Agent' : '👤 Prospect'}</span>}
                    <span style={{ color: '#c4cdd8' }}>{t.text}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {rightTab === 'pitches' && <div style={{ flex: 1, overflowY: 'auto' }}><DebtPitchPanel /></div>}
        {rightTab === 'signals' && <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}><DebtIntentSignals /></div>}
      </div>

      {/* AI Assistant Popup — identical to admin panel: draggable, resizable, collapsible sections */}
      {showPopup && (
        <AIAssistantPopup
          lead={null}
          transcript={normalizedTranscript}
          transcriptRef={transcriptRef}
          kbEntries={kbEntries}
          portalCfg={{}}
          engagementScore={0}
          qaActive={qaActive}
          coachActive={coachActive}
          intentActive={intentActive}
          onToggleQA={toggleQA}
          onToggleCoach={toggleCoach}
          onToggleIntent={toggleIntent}
          onClose={() => setShowPopup(false)}
          onIntentResult={() => {}}
          onQALog={() => {}}
          onCoachTip={() => {}}
          kbName={selectedKbName || ''}
          allKbEntries={allKbEntries}
          kbNames={kbNames}
          selectedKbName={selectedKbName}
          onKbChange={handleKbChange}
          activeScript={null}
          scripts={[]}
          callAttemptNumber={1}
          previousCallSummary={null}
        />
      )}
    </>
  );
}