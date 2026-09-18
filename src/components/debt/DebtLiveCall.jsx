/**
 * DebtLiveCall.jsx — Live call coaching with debt settlement lead contact card.
 * Captures headset mic → Deepgram (diarize + sentiment) → live Q&A/Coach/Intent + profile building.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import DebtLeadCard from '@/components/debt/DebtLeadCard';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const DEBT_KB_CATEGORIES = ['debt_agent', 'debt_customer', 'debt_doc', 'debt_web', 'debt_call', 'debt_kb', 'debt_faq'];

export default function DebtLiveCall() {
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [kbLoading, setKbLoading] = useState(true);

  // Lead
  const [leads, setLeads] = useState([]);
  const [lead, setLead] = useState({ firstName: '', lastName: '', status: 'new' });
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [profileData, setProfileData] = useState(null);

  // AI tools
  const [qaActive, setQaActive] = useState(true);
  const [coachActive, setCoachActive] = useState(true);
  const [intentActive, setIntentActive] = useState(true);
  const [qaItems, setQaItems] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [intentScore, setIntentScore] = useState(null);

  // Post-call
  const [report, setReport] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const processorRef = useRef(null);
  const transcriptRef = useRef([]);
  const leadRef = useRef(lead);
  const lastCoachTime = useRef(0);
  const lastIntentTime = useRef(0);
  const lastProfileTime = useRef(0);
  const callStartRef = useRef(null);

  useEffect(() => { leadRef.current = lead; }, [lead]);

  // Load KB
  useEffect(() => {
    base44.entities.KnowledgeBase.list('-created_date', 500)
      .then(all => setKbEntries((all || []).filter(e => DEBT_KB_CATEGORIES.includes(e.category))))
      .catch(() => {}).finally(() => setKbLoading(false));
  }, []);

  // Load mic devices
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0 && !micDeviceId) setMicDeviceId(mics[0].deviceId);
      })
      .catch(() => {});
  }, []);

  // Load existing leads
  const loadLeads = useCallback(async () => {
    try { const all = await base44.entities.DebtLead.list('-updated_date', 100); setLeads(all || []); } catch {}
  }, []);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const createNewLead = useCallback(async () => {
    try {
      const created = await base44.entities.DebtLead.create({
        firstName: lead.firstName || 'New',
        lastName: lead.lastName || 'Lead',
        status: 'new',
        callCount: 0,
      });
      setLead(created);
      loadLeads();
      return created;
    } catch (e) { alert('Failed to create lead: ' + (e?.message || String(e))); }
  }, [lead, loadLeads]);

  const handleQa = useCallback((question) => {
    const id = Date.now() + Math.random();
    setQaItems(prev => [...prev, { id, question, answer: '', loading: true }]);
    base44.functions.invoke('liveAssistantAI', { question, transcript: transcriptRef.current.slice(-8), kbEntries, kbName: 'Debt Settlement' })
      .then(res => { const answer = res?.answer || res?.data?.answer || 'Check knowledge base.'; setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer, loading: false } : x)); })
      .catch(() => setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer: 'Unable to answer.', loading: false } : x)));
  }, [kbEntries]);

  const handleCoach = useCallback(() => {
    base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current.slice(-6), kbEntries, mode: 'coach' })
      .then(res => { const tip = res?.tip || res?.response || res?.answer || ''; if (tip) setCoachTips(prev => [{ tip, time: new Date() }, ...prev].slice(0, 8)); })
      .catch(() => {});
  }, [kbEntries]);

  const handleIntent = useCallback(() => {
    base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'intent' })
      .then(res => { const score = res?.intent?.intentScore ?? res?.intentScore ?? res?.data?.intentScore; if (score !== undefined) setIntentScore(score); })
      .catch(() => {});
  }, [kbEntries]);

  const handleProfile = useCallback(async () => {
    if (!leadRef.current?.id) return;
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        transcript: transcriptRef.current.slice(-20),
        kbEntries,
        mode: 'profile',
        existingProfile: leadRef.current.profileJson || '{}',
      });
      const profile = res?.profile || res?.data?.profile;
      if (profile) {
        setProfileData(profile);
        setLead(prev => ({ ...prev, profileJson: JSON.stringify(profile), animalType: profile.animalType, intentScore: intentScore ?? prev.intentScore }));
      }
    } catch {}
  }, [kbEntries, intentScore]);

  const processNewEntry = useCallback((entry) => {
    setTranscript(prev => [...prev, entry]);
    const text = entry.text || '';

    if (qaActive && entry.speaker === 1) {
      const qPat = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|show me|prove|how much|what's the)\b.{3,80}[?!]/gi;
      const matches = [...(text.matchAll(qPat) || [])].map(m => m[0].trim());
      matches.forEach(q => handleQa(q));
    }

    const objWords = ['prove', 'doubt', 'skeptical', 'risky', 'guarantee', 'fail', 'burned', 'scam', 'catch', 'cost', 'fee', 'how much', 'too much', "can't afford", 'credit score', 'trust'];
    const now = Date.now();
    if (coachActive && (objWords.some(w => text.toLowerCase().includes(w)) || now - lastCoachTime.current > 20000)) { lastCoachTime.current = now; handleCoach(); }
    if (intentActive && now - lastIntentTime.current > 30000) { lastIntentTime.current = now; handleIntent(); }
    if (now - lastProfileTime.current > 60000) { lastProfileTime.current = now; handleProfile(); }
  }, [qaActive, coachActive, intentActive, handleQa, handleCoach, handleIntent, handleProfile]);

  const startCall = useCallback(async () => {
    // Ensure we have a lead
    if (!lead.id) { await createNewLead(); }

    setError(''); setTranscript([]); setQaItems([]); setCoachTips([]); setIntentScore(null); setProfileData(null); setReport('');
    setPhase('live');
    callStartRef.current = new Date();
    lastCoachTime.current = Date.now();
    lastIntentTime.current = Date.now();
    lastProfileTime.current = Date.now();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true });
      streamRef.current = stream;
    } catch { setError('Microphone access denied.'); setPhase('idle'); return; }

    let dgKey = '';
    try { const tokenRes = await base44.functions.invoke('deepgramToken2', {}); dgKey = tokenRes?.key || tokenRes?.data?.key || ''; }
    catch { dgKey = import.meta.env.VITE_DEEPGRAM_API_KEY || ''; }
    if (!dgKey) { setError('Could not get Deepgram API key.'); setPhase('idle'); stream.getTracks().forEach(t => t.stop()); return; }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    const ws = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-3&diarize=true&smart_format=true&punctuate=true&sentiment=true&utterances=true&interim_results=false', ['token', dgKey]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      processor.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = ev.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
        ws.send(int16.buffer);
      };
      source.connect(processor);
      const silence = ctx.createGain(); silence.gain.value = 0;
      processor.connect(silence); silence.connect(ctx.destination);
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'Results' || !msg.is_final) return;
        const alt = msg.channel?.alternatives?.[0];
        if (!alt || !alt.transcript?.trim()) return;
        processNewEntry({ speaker: alt.speaker ?? (msg.speaker ?? 0), text: alt.transcript, sentiment: msg.sentiment || alt.sentiment || null, time: new Date().toISOString() });
      } catch {}
    };

    ws.onerror = () => { setError('Deepgram connection error.'); };
  }, [micDeviceId, processNewEntry, lead, createNewLead]);

  const stopCall = useCallback(async () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
    setPhase('ended');

    // Final profile + intent analysis
    if (transcriptRef.current.length > 0 && leadRef.current?.id) {
      try {
        const intentRes = await base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current, kbEntries, mode: 'intent_final' });
        const intent = intentRes?.intent || intentRes?.data?.intent;
        if (intent) {
          setIntentScore(intent.intentScore);
          setProfileData(prev => ({ ...prev, ...intent }));
          setLead(prev => ({ ...prev, intentScore: intent.intentScore, animalType: intent.animalType, profileJson: JSON.stringify({ ...prev, ...intent }) }));
        }
        await base44.entities.DebtLead.update(leadRef.current.id, {
          lastCallAt: new Date().toISOString(),
          callCount: (leadRef.current.callCount || 0) + 1,
          transcriptJson: JSON.stringify(transcriptRef.current),
          intentScore: intent?.intentScore,
          animalType: intent?.animalType,
        });
      } catch {}

      setGeneratingReport(true);
      try {
        const res = await base44.functions.invoke('liveAssistantAI', {
          transcript: transcriptRef.current, kbEntries, kbName: 'Debt Settlement', mode: 'full_report',
          usedCoach: coachActive, usedQA: qaActive, usedIntent: intentActive,
          coachTips: coachTips.map(t => t.tip), qaLog: qaItems.map(q => ({ question: q.question, answer: q.answer })),
        });
        setReport(res?.report || res?.data?.report || '');
      } catch { setReport('Failed to generate report.'); }
      setGeneratingReport(false);
    }
    loadLeads();
  }, [kbEntries, coachActive, qaActive, intentActive, coachTips, qaItems, loadLeads]);

  const phaseColor = { idle: '#6b7280', live: '#ef4444', ended: '#8a9ab8' }[phase];
  const phaseLabel = { idle: 'Ready', live: '● LIVE', ended: 'Ended' }[phase];

  return (
    <div>
      {/* Controls bar */}
      <div style={{ marginBottom: '16px', padding: '14px 18px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ ...ls, marginBottom: 0 }}>🎙 Microphone</label>
          <select value={micDeviceId} onChange={e => setMicDeviceId(e.target.value)} disabled={phase === 'live'} style={{ ...inp, minWidth: '220px', cursor: 'pointer' }}>
            {micDevices.length === 0 && <option>Default microphone</option>}
            {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>

        {phase !== 'live' ? (
          <button onClick={startCall} disabled={kbLoading} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: kbLoading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: kbLoading ? 0.5 : 1 }}>
            {kbLoading ? 'Loading KB…' : '🔴 Start Live Call'}
          </button>
        ) : (
          <button onClick={stopCall} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⏹ End Call</button>
        )}

        {phase === 'ended' && (
          <button onClick={startCall} style={{ background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>🔄 New Call</button>
        )}

        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: `${phaseColor}18`, border: `1px solid ${phaseColor}44`, borderRadius: '20px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: phaseColor, animation: phase === 'live' ? 'pulse 1s infinite' : 'none' }} />
          <span style={{ color: phaseColor, fontSize: '11px', fontWeight: 'bold' }}>{phaseLabel}</span>
        </span>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>{transcript.length} lines</span>
      </div>

      {error && <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '12px' }}>⚠ {error}</div>}

      {/* Lead picker */}
      {showLeadPicker && (
        <div style={{ marginBottom: '12px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Select Existing Lead or Create New</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input value={lead.firstName || ''} onChange={e => setLead(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" style={{ ...inp, flex: 1 }} />
            <input value={lead.lastName || ''} onChange={e => setLead(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" style={{ ...inp, flex: 1 }} />
            <button onClick={createNewLead} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '0 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+ New</button>
          </div>
          {leads.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {leads.map(l => (
                <button key={l.id} onClick={() => { setLead(l); setProfileData(l.profileJson ? (() => { try { return JSON.parse(l.profileJson); } catch { return null; } })() : null); setShowLeadPicker(false); }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px', cursor: 'pointer', textAlign: 'left', color: '#c4cdd8', fontSize: '12px' }}>
                  {l.firstName} {l.lastName} — {l.status} ({l.callCount || 0} calls)
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowLeadPicker(false)} style={{ marginTop: '8px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '11px' }}>✕ Close</button>
        </div>
      )}

      {/* Main layout: lead card + transcript + AI tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 400px', gap: '16px', alignItems: 'start' }}>
        {/* Lead contact card */}
        <div>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 Lead Contact Card</div>
            <button onClick={() => setShowLeadPicker(p => !p)} style={{ background: 'rgba(16,185,129,0.1)', color: GOLD, border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{lead.id ? 'Switch' : 'Select'}</button>
          </div>
          <DebtLeadCard lead={lead} onLeadChange={setLead} transcript={transcript} intentScore={intentScore} animalType={profileData?.animalType} profileData={profileData} />
        </div>

        {/* Transcript */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 Live Transcript</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}><span style={{ color: '#60a5fa' }}>● Agent</span> · <span style={{ color: '#f59e0b' }}>● Customer</span></div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {transcript.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>{phase === 'live' ? 'Listening… start speaking.' : 'No transcript yet. Start a call to begin.'}</div>
            ) : transcript.map((msg, i) => {
              const isAgent = msg.speaker === 0;
              const sentColor = msg.sentiment === 'positive' ? '#4ade80' : msg.sentiment === 'negative' ? '#ef4444' : '#6b7280';
              return (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', background: isAgent ? 'rgba(96,165,250,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: isAgent ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ color: isAgent ? '#60a5fa' : '#f59e0b', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAgent ? '🎙 Agent' : '👤 Customer'}</span>
                      {msg.sentiment && <span style={{ color: sentColor, fontSize: '9px' }}>● {msg.sentiment}</span>}
                    </div>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Assistant */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 AI Assistant</div>
          </div>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '6px' }}>
            {[{ key: 'qa', label: 'Q&A', active: qaActive, toggle: () => setQaActive(p => !p), color: '#34d399' }, { key: 'coach', label: 'Coach', active: coachActive, toggle: () => setCoachActive(p => !p), color: '#f59e0b' }, { key: 'intent', label: 'Intent', active: intentActive, toggle: () => setIntentActive(p => !p), color: '#f472b6' }].map(f => (
              <button key={f.key} onClick={f.toggle} style={{ flex: 1, padding: '7px', borderRadius: '4px', border: `1px solid ${f.active ? f.color + '66' : 'rgba(255,255,255,0.1)'}`, background: f.active ? `${f.color}18` : 'transparent', color: f.active ? f.color : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{f.active ? '● ' : '○ '}{f.label}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {intentScore !== null && (
              <div style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '4px', padding: '10px' }}>
                <div style={{ color: '#f472b6', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📊 Intent Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${intentScore}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#f59e0b,#4ade80)', borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ color: '#f472b6', fontSize: '14px', fontWeight: 'bold' }}>{intentScore}</span>
                </div>
              </div>
            )}
            {profileData && (
              <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '10px' }}>
                <div style={{ color: '#a78bfa', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🧠 Profile Building</div>
                <div style={{ color: '#c4cdd8', fontSize: '11px' }}>Animal: <strong>{profileData.animalType || 'unknown'}</strong></div>
                {profileData.overallIntentLabel && <div style={{ color: '#8a9ab8', fontSize: '11px' }}>Intent: {profileData.overallIntentLabel}</div>}
                {profileData.keyObservations?.[0] && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>• {profileData.keyObservations[0]}</div>}
              </div>
            )}
            {coachTips.length > 0 && (
              <div>
                <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>💡 Coach Tips</div>
                {coachTips.slice(0, 5).map((t, i) => <div key={i} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '4px', padding: '8px 10px', marginBottom: '5px', fontSize: '11px', color: '#c4cdd8', lineHeight: 1.5 }}>{t.tip}</div>)}
              </div>
            )}
            {qaItems.length > 0 && (
              <div>
                <div style={{ color: '#34d399', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🔍 Q&A</div>
                {qaItems.slice(-5).map(item => <div key={item.id} style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '4px', padding: '8px 10px', marginBottom: '5px' }}><div style={{ color: '#34d399', fontSize: '10px' }}>Q: {item.question}</div><div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4 }}>{item.loading ? '⏳…' : `A: ${item.answer}`}</div></div>)}
              </div>
            )}
            {qaItems.length === 0 && coachTips.length === 0 && intentScore === null && <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center', padding: '30px 0' }}>{phase === 'live' ? 'AI tools listening…' : 'Start a call to activate.'}</div>}
          </div>
        </div>
      </div>

      {/* Post-call report */}
      {phase === 'ended' && (
        <div style={{ marginTop: '16px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '20px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>📄 Post-Call Report</div>
          {generatingReport ? <div style={{ color: '#6b7280', fontSize: '12px' }}>⏳ Generating report…</div> : report ? <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{report}</div> : <div style={{ color: '#4a5568', fontSize: '12px' }}>No report generated.</div>}
        </div>
      )}
    </div>
  );
}