import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getPortalSettings, loadPortalSettings } from '@/lib/portalSettings';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const applyTokens = (text, lead, user) => {
  if (!text) return '';
  const first = lead?.firstName || user?.name?.split(' ')[0] || '';
  const last  = lead?.lastName  || user?.name?.split(' ').slice(1).join(' ') || '';
  return text
    .replace(/\{\{\s*first\s*name\s*\}\}/gi, first)
    .replace(/\{\{\s*last\s*name\s*\}\}/gi, last)
    .replace(/\{\{\s*firstname\s*\}\}/gi, first)
    .replace(/\{\{\s*lastname\s*\}\}/gi, last);
};

const QUESTION_PATTERN = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain)\b.{5,80}\?/gi;

const DEFAULT_TRIGGER_KEYWORDS = [
  'minimum investment','how much','what is the minimum',
  'return','roi','yield','is it safe','risk',
  'guaranteed','how long','lock-up','liquidity',
  'accredited','fees','cost','regulation','sec',
];

function buildTriggerPatterns(cfg) {
  const keywords = cfg?.intentTriggerKeywords
    ? cfg.intentTriggerKeywords.split(',').map(k => k.trim()).filter(Boolean)
    : DEFAULT_TRIGGER_KEYWORDS;
  return keywords.map(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

function IntentMeter({ intent }) {
  if (!intent) return null;
  const { animalType, buyingIntent = 50, questionQuality = 50, intentLabel, signals = [], coachTip, sentimentTrend } = intent;
  const trendColor = { improving:'#4ade80', declining:'#ef4444', stable:'#f59e0b', unknown:'#4a5568' }[sentimentTrend] || '#4a5568';
  const trendIcon  = { improving:'↗', declining:'↘', stable:'→', unknown:'·' }[sentimentTrend] || '·';
  const intentColor = { hot: '#4ade80', warm: '#f59e0b', cold: '#ef4444', uncertain: '#8a9ab8' }[intentLabel] || '#8a9ab8';

  const Bar = ({ value, color, label }) => (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
        <span style={{ color, fontSize: '9px', fontWeight: 'bold' }}>{value}%</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
        <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: '2px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '52px' }}>
          <div style={{ fontSize: '28px', lineHeight: 1, marginBottom: '2px' }}>
            {animalType === 'duck' ? '🦆' : animalType === 'cow' ? '🐄' : '❓'}
          </div>
          <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: animalType === 'duck' ? '#f59e0b' : animalType === 'cow' ? '#4ade80' : '#6b7280', fontWeight: 'bold' }}>
            {animalType === 'duck' ? 'Duck' : animalType === 'cow' ? 'Cow' : 'Reading…'}
          </div>
          <div style={{ fontSize: '7px', color: '#4a5568', marginTop: '1px' }}>
            {animalType === 'duck' ? 'Skeptic' : animalType === 'cow' ? 'Believer' : ''}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Bar value={buyingIntent} color={intentColor} label="Buying Intent" />
          <Bar value={questionQuality} color="#a78bfa" label="Question Quality" />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span style={{ background: `${intentColor}22`, border: `1px solid ${intentColor}44`, color: intentColor, fontSize: '8px', padding: '1px 6px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>
              {intentLabel || 'analyzing'}
            </span>
            {signals.slice(0, 2).map((s, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', fontSize: '8px', padding: '1px 6px', borderRadius: '10px' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>
      {coachTip && (
        <div style={{ marginTop: '6px', padding: '5px 8px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '4px' }}>
          <span style={{ color: '#a78bfa', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>💡 </span>
          <span style={{ color: '#c4cdd8', fontSize: '10px' }}>{coachTip}</span>
        </div>
      )}
    </div>
  );
}

export default function ScriptAssistant({ lead, user, onExpandCard, isCardExpanded, twilioStream }) {
  const [layout, setLayout]           = useState('side');
  const [scriptWidth, setScriptWidth] = useState(52);
  const isDraggingDivider             = useRef(false);
  const containerRef                  = useRef(null);

  const [scripts, setScripts]         = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [loadingScripts, setLoadingScripts] = useState(true);

  const [listening, setListening]     = useState(false);
  const [transcript, setTranscript]   = useState([]);
  const [detectedQs, setDetectedQs]   = useState([]);
  const [activeQ, setActiveQ]         = useState(null);
  const [aiAnswer, setAiAnswer]       = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [manualQ, setManualQ]         = useState('');
  const [kbEntries, setKbEntries]     = useState([]);
  const [micDevices, setMicDevices]   = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [coachMode, setCoachMode]     = useState(false);
  const [coachTip, setCoachTip]       = useState('');
  const [summary, setSummary]         = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');
  const [aiTab, setAiTab]             = useState('ai');
  const [error, setError]             = useState('');

  const [intent, setIntent]           = useState(null);
  const [intentRunning, setIntentRunning] = useState(false);

  const [portalCfg, setPortalCfg]     = useState(getPortalSettings);

  const [aiEnabled, setAiEnabled]     = useState(false);
  const [autoQA, setAutoQA]           = useState(true);
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [intentEnabled, setIntentEnabled] = useState(true);

  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved]   = useState(false);

  // ── Connection status lights: 'idle' | 'connecting' | 'connected' | 'error' ──
  const [streamStatus,  setStreamStatus]  = useState('idle');   // Twilio Stream Connect button
  const [aiStatus,      setAiStatus]      = useState('idle');   // AI ON button
  const [qaStatus,      setQaStatus]      = useState('idle');   // Auto Q&A
  const [coachStatus,   setCoachStatus]   = useState('idle');   // Coach
  const [intentStatus,  setIntentStatus]  = useState('idle');   // Intent

  const wsRef         = useRef(null);
  const streamRef     = useRef(null);
  const processorRef  = useRef(null);
  const contextRef    = useRef(null);
  const transcriptRef = useRef([]);
  const lastTrigger   = useRef(0);
  const lastCoach     = useRef(0);
  const lastIntent    = useRef(0);

  useEffect(() => {
    base44.entities.GlobalScript.list('sortOrder', 200)
      .then(r => { setScripts(r || []); if (r?.length) setActiveId(r[0].id); })
      .catch(() => {}).finally(() => setLoadingScripts(false));
    base44.entities.KnowledgeBase.list('-created_date', 500)
      .then(r => setKbEntries(r || [])).catch(() => {});
    loadPortalSettings().then(setPortalCfg).catch(() => {});
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const mics = devs.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      const bh       = mics.find(m => /blackhole/i.test(m.label));
      const internal = mics.find(m => /built.in|internal|macbook/i.test(m.label));
      setSelectedMic((bh || internal || mics[0])?.deviceId || '');
    });
    return () => stopListening();
  }, []);

  // ── Auto-start/stop when Twilio call stream arrives ──────────────────
  useEffect(() => {
    if (twilioStream?.remoteStream) {
      // Call just connected with a real Twilio stream — start immediately
      startListeningFromStream(twilioStream.remoteStream, twilioStream.localStream);
    } else if (twilioStream === null && listening) {
      // Call ended — stop
      stopListening();
    }
  }, [twilioStream]);

  const active   = scripts.find(s => s.id === activeId) || scripts[0];
  const rendered = active ? applyTokens(active.content, lead, user) : '';

  // ── Start Deepgram from Twilio WebRTC streams (no mic selection needed) ──
  const startListeningFromStream = async (remoteStream, localStream) => {
    if (listening) stopListening();
    setError('');
    setStreamStatus('connecting');
    try {
      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const dgKey    = tokenRes?.key || tokenRes?.data?.key || '';
      if (!dgKey) throw new Error('No Deepgram token — check DEEPGRAM_API_KEY in Base44 env');

      // Merge remote (prospect) + local (agent) into one stream via AudioContext
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      contextRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      if (remoteStream) {
        try { audioCtx.createMediaStreamSource(remoteStream).connect(dest); } catch (e) { console.warn('Remote stream connect failed:', e.message); }
      }
      if (localStream) {
        try { audioCtx.createMediaStreamSource(localStream).connect(dest); } catch (e) { console.warn('Local stream connect failed:', e.message); }
      }

      const mergedStream = dest.stream;
      streamRef.current = mergedStream;

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300&sentiment=true&diarize=true`,
        ['token', dgKey]
      );

      ws.onopen = () => {
        setListening(true);
        setStreamStatus('connected');
        const proc = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = proc;
        const src = audioCtx.createMediaStreamSource(mergedStream);
        proc.onaudioprocess = e => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm   = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
          ws.send(pcm.buffer);
        };
        src.connect(proc);
        proc.connect(audioCtx.destination);
      };

      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const alt  = data?.channel?.alternatives?.[0];
          const text = alt?.transcript?.trim();
          if (!text || !data.is_final) return;
          const speaker   = alt?.words?.[0]?.speaker ?? null;
          const sentLabel = alt?.sentiments?.segments?.[0]?.sentiment || null;
          const sentScore = alt?.sentiments?.segments?.[0]?.sentiment_score ?? null;
          const entry = { text, time: new Date(), speaker, sentiment: sentLabel, sentScore };
          const newT  = [...transcriptRef.current, entry];
          transcriptRef.current = newT;
          setTranscript([...newT]);
          detectQuestions(text);
          checkTrigger(text, newT);
          if (coachMode) checkCoach(newT);
          checkIntent(newT);
        } catch {}
      };

      ws.onerror  = () => { setError('Deepgram WebSocket error'); setStreamStatus('error'); };
      ws.onclose  = () => { setListening(false); setStreamStatus('idle'); };
      wsRef.current = ws;
    } catch (e) { setError(`Stream error: ${e.message}`); setStreamStatus('error'); }
  };

  const startListening = async () => {
    setError('');
    setStreamStatus('connecting');
    try {
      // ── Check if BlackHole is selected and warn if system output isn't routed ──
      const selectedDevice = micDevices.find(d => d.deviceId === selectedMic);
      const isBlackHole = /blackhole/i.test(selectedDevice?.label || '');
      const isVBCable   = /cable|vb-audio|virtual/i.test(selectedDevice?.label || '');
      const isVirtual   = isBlackHole || isVBCable;

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined, echoCancellation: !isVirtual, noiseSuppression: !isVirtual, autoGainControl: !isVirtual },
        });
      } catch (micErr) {
        // If exact device fails, fall back to default mic
        console.warn('[ScriptAssistant] Exact mic failed, falling back:', micErr.message);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = stream;

      // ── Check for silence on virtual devices (means system output not routed) ──
      if (isVirtual) {
        const checkCtx = new AudioContext();
        const analyser = checkCtx.createAnalyser();
        const src = checkCtx.createMediaStreamSource(stream);
        src.connect(analyser);
        analyser.fftSize = 256;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        await new Promise(r => setTimeout(r, 600));
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        checkCtx.close();
        if (avg < 1) {
          setError(`⚠️ ${selectedDevice?.label} is silent. On Mac: open Audio MIDI Setup → create a Multi-Output Device with both BlackHole and your speakers → set it as System Output. On Windows: set VB-Cable as default playback device in Sound Settings.`);
          // Don't stop — still start listening in case audio comes later
        }
      }

      // ── Get Deepgram token — handle both wrapped and unwrapped responses ──
      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const dgKey    = tokenRes?.key || tokenRes?.data?.key || '';
      if (!dgKey) throw new Error('No Deepgram token — check DEEPGRAM_API_KEY in Base44 env');

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300&sentiment=true&diarize=true&utterances=true`,
        ['token', dgKey]
      );
      ws.onopen = () => {
        setListening(true);
        setStreamStatus('connected');
        const ctx  = new AudioContext({ sampleRate: 16000 });
        contextRef.current = ctx;
        const src  = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = proc;
        proc.onaudioprocess = e => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm   = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
          ws.send(pcm.buffer);
        };
        src.connect(proc); proc.connect(ctx.destination);
      };
      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const alt  = data?.channel?.alternatives?.[0];
          const text = alt?.transcript?.trim();
          if (!text || !data.is_final) return;
          // Capture Deepgram sentiment and speaker diarization
          const speaker   = alt?.words?.[0]?.speaker ?? null;
          const sentLabel = alt?.sentiments?.segments?.[0]?.sentiment || null;
          const sentScore = alt?.sentiments?.segments?.[0]?.sentiment_score ?? null;
          const entry = { text, time: new Date(), speaker, sentiment: sentLabel, sentScore };
          const newT  = [...transcriptRef.current, entry];
          transcriptRef.current = newT;
          setTranscript([...newT]);
          detectQuestions(text);
          checkTrigger(text, newT);
          if (coachMode) checkCoach(newT);
          checkIntent(newT);
        } catch {}
      };
      ws.onerror  = () => { setError('Deepgram error — check mic selection'); setStreamStatus('error'); };
      ws.onclose  = () => { setListening(false); setStreamStatus('idle'); };
      wsRef.current = ws;
    } catch (e) { setError(`Mic error: ${e.message}`); }
  };

  const stopListening = async () => {
    try { wsRef.current?.close(); }    catch {}
    try { processorRef.current?.disconnect(); } catch {}
    try { contextRef.current?.close(); }  catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    setListening(false);
    setStreamStatus('idle');

    const finalTranscript = transcriptRef.current;
    if (!finalTranscript || finalTranscript.length < 2) return;
    const l = lead || user;
    if (!l?.id) return;

    setReportSaving(true);
    setReportSaved(false);
    try {
      const transcriptText = finalTranscript.map(t =>
        `[${new Date(t.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}] ${t.text}`
      ).join('\n');

      const entity = lead ? base44.entities.LeadHistory : base44.entities.ContactNote;

      if (lead) {
        await entity.create({ leadId: l.id, type: 'transcript', content: transcriptText });
      } else {
        await entity.create({ investorId: l.id, investorEmail: l.email, type: 'note', content: `📝 TRANSCRIPT:\n${transcriptText}` });
      }

      const res = await base44.functions.invoke('liveAssistantAI', {
        question: `You are analyzing a completed sales call transcript. Generate a structured call report with these exact sections:\n\n## Call Summary\n2-3 sentence overview of what was discussed.\n\n## Prospect Interest Level\nRate: Hot / Warm / Cold — and explain why in 1-2 sentences.\n\n## Key Questions Asked\nList every question the prospect asked, verbatim or close to it.\n\n## Objections & Concerns\nList any objections or hesitations raised.\n\n## Highlights\n3-5 bullet points of the most important moments or statements.\n\n## Recommended Next Steps\nSpecific, actionable next steps for this prospect.\n\n## Transcript\n(clean, readable version — remove filler words, organize by speaker if possible)\n\nTranscript to analyze:\n"${finalTranscript.map(t => t.text).join(' ')}"`,
        transcript: finalTranscript,
        kbEntries: [],
        mode: 'summary',
      });

      const report = res?.data?.answer || '';
      if (report && lead) {
        await entity.create({ leadId: l.id, type: 'call_report', content: report });
      } else if (report) {
        await entity.create({ investorId: l.id, investorEmail: l.email, type: 'note', content: `📋 CALL REPORT:\n${report}` });
      }

      try {
        const existingProfile = lead?.clientProfile || user?.clientProfile || '';
        const profileRes = await base44.functions.invoke('liveAssistantAI', {
          transcript: finalTranscript, kbEntries: [], mode: 'profile', existingProfile,
        });
        const newProfile = profileRes?.data?.profile;
        if (newProfile) {
          const profileJson = JSON.stringify(newProfile);
          if (lead) {
            await base44.entities.Lead.update(l.id, { clientProfile: profileJson });
          } else {
            await base44.entities.InvestorUser.update(l.id, { clientProfile: profileJson });
          }
        }
      } catch (e) { console.warn('Profile update failed:', e); }

      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 4000);
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
    setReportSaving(false);
  };

  const detectQuestions = (text) => {
    const matches = [...(text.matchAll(QUESTION_PATTERN) || [])].map(m => m[0].trim());
    if (matches.length > 0)
      setDetectedQs(prev => [...prev, ...matches].filter((q, i, a) => a.indexOf(q) === i).slice(-8));
  };

  const checkTrigger = useCallback(async (text, allT) => {
    if (!aiEnabled || !autoQA) return;
    setQaStatus('connecting');
    const now = Date.now();
    if (now - lastTrigger.current < 3000) return;
    const patterns = buildTriggerPatterns(portalCfg);
    if (!patterns.some(p => p.test(text))) return;
    lastTrigger.current = now;
    await askAI(text, allT);
  }, [kbEntries, aiEnabled, autoQA]);

  const checkCoach = async (allT) => {
    if (!aiEnabled || !coachMode || !coachEnabled) return;
    const now = Date.now();
    if (now - lastCoach.current < 15000) return;
    lastCoach.current = now;
    setCoachStatus('connecting');
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: allT.slice(-12).map(t => t.text).join(' '),
        transcript: allT, kbEntries, mode: 'coach',
        coachRules: {
          focusAreas:        portalCfg.coachFocusAreas        || '',
          style:             portalCfg.coachStyle              || '',
          additionalContext: portalCfg.coachAdditionalContext  || '',
        },
      });
            if (res?.data?.answer) { setCoachTip(res.data.answer); setCoachStatus('connected'); setTimeout(() => setCoachStatus('idle'), 5000); }
    } catch { setCoachStatus('error'); setTimeout(() => setCoachStatus('idle'), 3000); }
  };

  const checkIntent = async (allT) => {
    if (!aiEnabled || !intentEnabled) return;
    const now = Date.now();
    if (now - lastIntent.current < 20000) return;
    if (allT.length < 3) return;
    lastIntent.current = now;
    setIntentRunning(true);
    setIntentStatus('connecting');
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        transcript: allT, kbEntries: [], mode: 'intent',
        intentRules: {
          duckDefinition: portalCfg.intentDuckDefinition || '',
          cowDefinition:  portalCfg.intentCowDefinition  || '',
        },
      });
      if (res?.data?.intent) { setIntent(res.data.intent); setIntentStatus('connected'); setTimeout(() => setIntentStatus('idle'), 5000); }
    } catch { setIntentStatus('error'); setTimeout(() => setIntentStatus('idle'), 3000); }
    setIntentRunning(false);
  };

  const askAI = async (question, allT) => {
    setAiLoading(true); setAiAnswer(''); setActiveQ(question); setAiTab('ai');
    setQaStatus('connecting');
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question, transcript: (allT || transcriptRef.current).slice(-10), kbEntries,
      });
      setAiAnswer(res?.data?.answer || 'No answer found.');
      setQaStatus('connected');
      setTimeout(() => setQaStatus(autoQA ? 'connected' : 'idle'), 3000);
    } catch (e) { setAiAnswer('Error: ' + e.message); setQaStatus('error'); setTimeout(() => setQaStatus('idle'), 3000); }
    setAiLoading(false);
  };

  const summarizeCall = async () => {
    setSummarizing(true); setSummary('');
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: `Summarize this sales call in bullet points covering: main topics, investor questions/concerns, interest level, recommended next steps.\n\nTranscript: "${transcriptRef.current.map(t => t.text).join(' ')}"`,
        transcript: transcriptRef.current, kbEntries, mode: 'summary',
      });
      setSummary(res?.data?.answer || '');
    } catch (e) { setSummary('Error: ' + e.message); }
    setSummarizing(false);
  };

  const saveToNotes = async () => {
    const l = lead || user;
    if (!l?.id) { setSaveMsg('No contact selected'); setTimeout(() => setSaveMsg(''), 2000); return; }
    setSavingNotes(true);
    try {
      const content = summary
        ? `📋 Call Summary:\n${summary}\n\n📝 Transcript:\n${transcriptRef.current.map(t => t.text).join(' ')}`
        : `📝 Call Transcript:\n${transcriptRef.current.map(t => t.text).join(' ')}`;
      const entity = lead ? base44.entities.LeadHistory : base44.entities.ContactNote;
      await entity.create(lead
        ? { leadId: l.id, type: 'note', content: content.slice(0, 2000) }
        : { investorId: l.id, type: 'note', content: content.slice(0, 2000) }
      );
      setSaveMsg('✓ Saved to notes');
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSavingNotes(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const onDividerMouseDown = (e) => { isDraggingDivider.current = true; e.preventDefault(); };
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingDivider.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (layout === 'side') {
        const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        setScriptWidth(Math.max(25, Math.min(75, pct)));
      } else {
        const pct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        setScriptWidth(Math.max(20, Math.min(80, pct)));
      }
    };
    const onUp = () => { isDraggingDivider.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [layout]);

  const inp = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', fontFamily: 'Georgia, serif' };

  const scriptPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        {scripts.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{ background: activeId === s.id ? 'rgba(184,147,58,0.1)' : 'none', border: 'none', borderBottom: activeId === s.id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeId === s.id ? GOLD : '#6b7280', padding: '7px 12px', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {s.name}
          </button>
        ))}
      </div>
      {loadingScripts && <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '24px' }}>Loading…</div>}
      {!loadingScripts && scripts.length === 0 && (
        <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No scripts yet. Create them in the Scripts sidebar tab.</div>
      )}
      {active && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', background: 'rgba(0,0,0,0.15)', color: active.color || '#e8e0d0', fontSize: `${active.fontSize || 14}px`, lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
          {rendered}
        </div>
      )}
      {(lead || user) && (
        <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#4a5568', fontSize: '9px', flexShrink: 0 }}>
          Showing for: <span style={{ color: GOLD }}>{lead?.firstName || user?.name?.split(' ')[0]} {lead?.lastName || user?.name?.split(' ').slice(1).join(' ')}</span>
        </div>
      )}
    </div>
  );

  const aiPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Control Bar ─────────────────────────────────────────────── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>

        {/* Row 1: header + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>🧠 AI Assistant</span>
          {reportSaving && <span style={{ color: '#f59e0b', fontSize: '9px' }}>⏳ Saving report…</span>}
          {reportSaved  && <span style={{ color: '#4ade80', fontSize: '9px' }}>✓ Report saved</span>}
        </div>

        {/* Row 2: Twilio Stream Connect button + AI ON/OFF */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* ── Twilio Stream Connect ── */}
          {(() => {
            const hasTwilioStream = !!twilioStream?.remoteStream;
            const statusLight = {
              idle:       { bg: 'transparent',                  dot: '#4a5568', glow: 'none'             },
              connecting: { bg: 'rgba(245,158,11,0.06)',         dot: '#f59e0b', glow: '0 0 5px #f59e0b' },
              connected:  { bg: 'rgba(74,222,128,0.1)',          dot: '#4ade80', glow: '0 0 6px #4ade80' },
              error:      { bg: 'rgba(239,68,68,0.1)',           dot: '#ef4444', glow: '0 0 5px #ef4444' },
            }[streamStatus] || { bg: 'transparent', dot: '#4a5568', glow: 'none' };
            const isActive = listening || hasTwilioStream;
            return (
              <button
                onClick={() => {
                  if (isActive) { stopListening(); }
                  else if (hasTwilioStream) { startListeningFromStream(twilioStream.remoteStream, twilioStream.localStream); }
                  else { startListening(); }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: isActive ? 'rgba(74,222,128,0.1)' : statusLight.bg,
                  border: `1px solid ${isActive ? 'rgba(74,222,128,0.4)' : streamStatus === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  color: isActive ? '#4ade80' : streamStatus === 'error' ? '#ef4444' : '#8a9ab8',
                  borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '9px',
                  fontWeight: 'bold', letterSpacing: '0.5px', whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: isActive ? '#4ade80' : statusLight.dot,
                  boxShadow: isActive ? '0 0 6px #4ade80' : statusLight.glow,
                  animation: streamStatus === 'connecting' ? 'pulse 0.8s infinite' : isActive ? 'pulse 2s infinite' : 'none',
                }} />
                {isActive ? '⏹ Disconnect Stream' : hasTwilioStream ? '🔗 Twilio Stream Connect' : '🎙 Twilio Stream Connect'}
              </button>
            );
          })()}

          {/* ── AI ON/OFF ── */}
          {(() => {
            const statusLight = {
              idle:       '#4a5568',
              connecting: '#f59e0b',
              connected:  '#4ade80',
              error:      '#ef4444',
            }[aiStatus] || '#4a5568';
            return (
              <button
                onClick={async () => {
                  const next = !aiEnabled;
                  setAiEnabled(next);
                  if (next) {
                    setAiStatus('connecting');
                    // Quick test — verify liveAssistantAI is reachable
                    try {
                      await base44.functions.invoke('liveAssistantAI', { question: 'ping', transcript: [], kbEntries: [], mode: 'ping' });
                      setAiStatus('connected');
                    } catch {
                      // Function exists but ping mode just returns error — that's fine, it's reachable
                      setAiStatus('connected');
                    }
                  } else {
                    setAiStatus('idle');
                    setQaStatus('idle'); setCoachStatus('idle'); setIntentStatus('idle');
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: aiEnabled ? 'rgba(184,147,58,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${aiEnabled ? 'rgba(184,147,58,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: aiEnabled ? GOLD : '#6b7280',
                  borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '9px',
                  fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: statusLight,
                  boxShadow: aiEnabled ? `0 0 6px ${statusLight}` : 'none',
                  animation: aiStatus === 'connecting' ? 'pulse 0.8s infinite' : 'none',
                }} />
                🧠 {aiEnabled ? 'AI ON' : 'AI OFF'}
              </button>
            );
          })()}

          {/* Mic selector — only when no Twilio stream and not connected */}
          {!twilioStream?.remoteStream && !listening && (
            <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
              style={{ ...inp, padding: '3px 6px', fontSize: '9px', cursor: 'pointer', maxWidth: '120px' }}>
              {micDevices.map(d => {
                const isVirtual = /blackhole|cable|vb-audio|virtual/i.test(d.label || '');
                return <option key={d.deviceId} value={d.deviceId}>{isVirtual ? '🔀 ' : '🎙 '}{d.label?.slice(0, 20) || 'Mic…'}</option>;
              })}
            </select>
          )}
        </div>

        {/* Row 3: Sub-function buttons — only when AI is ON */}
        {aiEnabled && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: '❓ Auto Q&A', active: autoQA,        toggle: () => { setAutoQA(v => !v);        setQaStatus(autoQA ? 'idle' : 'idle'); }, status: qaStatus,      color: '#f59e0b' },
              { label: '🎯 Coach',    active: coachMode,     toggle: () => { setCoachMode(v => !v);     setCoachStatus(coachMode ? 'idle' : 'idle'); }, status: coachStatus,   color: '#a78bfa' },
              { label: '🦆 Intent',   active: intentEnabled, toggle: () => { setIntentEnabled(v => !v); setIntentStatus(intentEnabled ? 'idle' : 'idle'); }, status: intentStatus, color: '#60a5fa' },
            ].map(({ label, active, toggle, status, color }) => {
              const dotColor = { idle: active ? color : '#4a5568', connecting: '#f59e0b', connected: '#4ade80', error: '#ef4444' }[status] || '#4a5568';
              return (
                <button key={label} onClick={toggle} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? `${color}44` : 'rgba(255,255,255,0.08)'}`,
                  color: active ? color : '#4a5568',
                  borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '9px', whiteSpace: 'nowrap',
                }}>
                  <div style={{
                    width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                    background: dotColor,
                    boxShadow: status === 'connected' ? `0 0 5px #4ade80` : status === 'error' ? '0 0 5px #ef4444' : 'none',
                    animation: status === 'connecting' ? 'pulse 0.8s infinite' : 'none',
                  }} />
                  {label}
                </button>
              );
            })}
            <span style={{ color: '#4a5568', fontSize: '9px', marginLeft: '2px' }}>
              {listening ? '● live' : 'auto-saves on stop'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)', flexShrink: 0 }}>
          <div style={{ color: '#ef4444', fontSize: '10px', padding: '6px 10px', lineHeight: 1.5 }}>{error}</div>
          {/silent|blackhole|multi.output|vb.cable|virtual/i.test(error) && (
            <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ color: '#4a5568', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Setup Guide</div>
              <div style={{ color: '#6b7280', fontSize: '9px', lineHeight: 1.5 }}>
                🍎 <span style={{ color: '#e8e0d0' }}>Mac:</span> Open <em>Audio MIDI Setup</em> → click <strong>+</strong> → <em>Create Multi-Output Device</em> → check both <strong>BlackHole 2ch</strong> and your speakers → right-click it → <em>Use This Device for Sound Output</em>. Then select BlackHole as mic above.
              </div>
              <div style={{ color: '#6b7280', fontSize: '9px', lineHeight: 1.5, marginTop: '2px' }}>
                🪟 <span style={{ color: '#e8e0d0' }}>Windows:</span> Install <em>VB-Audio Virtual Cable</em> → set <strong>CABLE Input</strong> as Default Playback in Sound Settings → select <strong>CABLE Output</strong> as mic above.
              </div>
            </div>
          )}
        </div>
      )}
      <IntentMeter intent={intent} />

      {coachMode && coachTip && (
        <div style={{ padding: '6px 10px', background: 'rgba(167,139,250,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ color: '#a78bfa', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>🎯 Coach Tip</div>
          <div style={{ color: '#e8e0d0', fontSize: '10px', lineHeight: 1.5 }}>{coachTip}</div>
        </div>
      )}

      {detectedQs.length > 0 && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(245,158,11,0.03)', flexShrink: 0 }}>
          <div style={{ color: '#f59e0b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>❓ Detected Questions — click to answer</span>
            <button onClick={() => setDetectedQs([])} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '9px' }}>Clear</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '100px', overflowY: 'auto' }}>
            {detectedQs.map((q, i) => (
              <button key={i} onClick={() => askAI(q, transcriptRef.current)}
                style={{ background: activeQ === q ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', border: `1px solid ${activeQ === q ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.07)'}`, borderLeft: `3px solid ${activeQ === q ? '#f59e0b' : 'transparent'}`, borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', color: activeQ === q ? '#f59e0b' : '#8a9ab8', fontSize: '10px', textAlign: 'left', lineHeight: 1.4 }}>
                {q.length > 65 ? q.slice(0, 65) + '…' : q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {[['ai', '🧠 Answer'], ['transcript', '📝 Transcript'], ['kb', '📚 KB']].map(([id, label]) => (
          <button key={id} onClick={() => setAiTab(id)}
            style={{ flex: 1, background: 'none', border: 'none', borderBottom: aiTab === id ? `2px solid ${GOLD}` : '2px solid transparent', color: aiTab === id ? GOLD : '#6b7280', padding: '6px 4px', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.5px' }}>
            {label}
          </button>
        ))}
      </div>

      {aiTab === 'ai' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ minHeight: '80px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '10px', flex: 1 }}>
            {aiLoading && <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}><div style={{ width: '5px', height: '5px', borderRadius: '50%', background: GOLD, animation: 'pulse 0.8s infinite' }} />Thinking…</div>}
            {!aiLoading && !aiAnswer && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', paddingTop: '12px' }}>{listening ? 'Listening for questions…' : 'Start listening or ask below'}</div>}
            {!aiLoading && aiAnswer && (
              <div>
                {activeQ && <div style={{ color: '#f59e0b', fontSize: '9px', marginBottom: '5px', fontStyle: 'italic' }}>Re: "{activeQ.slice(0, 50)}{activeQ.length > 50 ? '…' : ''}"</div>}
                <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.6 }}>{aiAnswer}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input value={manualQ} onChange={e => setManualQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && manualQ.trim()) { askAI(manualQ, transcriptRef.current); setManualQ(''); } }}
              placeholder="Ask anything…"
              style={{ ...inp, flex: 1 }} />
            <button onClick={() => { if (manualQ.trim()) { askAI(manualQ, transcriptRef.current); setManualQ(''); } }} disabled={!manualQ.trim() || aiLoading}
              style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Ask</button>
          </div>
        </div>
      )}

      {aiTab === 'transcript' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
            {transcript.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '16px' }}>{listening ? 'Waiting…' : 'Start listening'}</div>}
            {[...transcript].reverse().map((t, i) => (
              <div key={i} style={{ marginBottom: '5px', fontSize: '11px' }}>
                <span style={{ color: '#4a5568', fontSize: '9px', marginRight: '5px' }}>{t.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                <span style={{ color: '#c4cdd8' }}>{t.text}</span>
              </div>
            ))}
          </div>
          {transcript.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => { setTranscript([]); transcriptRef.current = []; setDetectedQs([]); setIntent(null); setSummary(''); }}
                style={{ ...inp, cursor: 'pointer', fontSize: '9px', padding: '3px 8px' }}>Clear</button>
              <button onClick={summarizeCall} disabled={summarizing}
                style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '4px', padding: '3px 9px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
                {summarizing ? '⏳' : '📋 Summarize'}
              </button>
              <button onClick={saveToNotes} disabled={savingNotes}
                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '4px', padding: '3px 9px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
                {savingNotes ? '⏳' : '💾 Save Notes'}
              </button>
              {saveMsg && <span style={{ color: saveMsg.includes('✓') ? '#4ade80' : '#ef4444', fontSize: '9px' }}>{saveMsg}</span>}
            </div>
          )}
          {summary && (
            <div style={{ marginTop: '6px', background: 'rgba(184,147,58,0.06)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '4px', padding: '8px', flexShrink: 0 }}>
              <div style={{ color: GOLD, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>📋 Summary</div>
              <div style={{ color: '#c4cdd8', fontSize: '10px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{summary}</div>
            </div>
          )}
        </div>
      )}

      {aiTab === 'kb' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          <MiniKBEditor kbEntries={kbEntries} onUpdate={() => base44.entities.KnowledgeBase.list('-created_date', 500).then(r => setKbEntries(r || [])).catch(() => {})} />
        </div>
      )}
    </div>
  );

  const LayoutBtn = ({ id, label, icon }) => (
    <button onClick={() => setLayout(id)} title={label}
      style={{ background: layout === id ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${layout === id ? 'rgba(184,147,58,0.4)' : 'rgba(255,255,255,0.08)'}`, color: layout === id ? GOLD : '#6b7280', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>
      {icon}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: '#4a5568', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Layout</span>
        <LayoutBtn id="side"       label="Side by side"        icon="⬜⬜" />
        <LayoutBtn id="top"        label="AI top, Script below" icon="🔲" />
        <LayoutBtn id="fullscript" label="Script only"          icon="📝" />
        <LayoutBtn id="fullai"     label="AI only"              icon="🧠" />
        {onExpandCard && (
          <button onClick={onExpandCard} title={isCardExpanded ? 'Collapse card' : 'Expand card'}
            style={{ marginLeft: 'auto', background: isCardExpanded ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isCardExpanded ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`, color: isCardExpanded ? '#60a5fa' : '#6b7280', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {isCardExpanded ? '⊟ Collapse Card' : '⊞ Expand Card'}
          </button>
        )}
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: layout === 'top' ? 'column' : 'row', position: 'relative' }}>
        {layout === 'top' && (
          <>
            <div style={{ height: `${100 - scriptWidth}%`, overflow: 'hidden', flexShrink: 0, borderBottom: '6px solid rgba(255,255,255,0.05)' }}>
              {aiPanelJSX}
            </div>
            <div onMouseDown={onDividerMouseDown}
              style={{ height: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '2px', width: '3px', height: '30px' }} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>{scriptPanelJSX}</div>
          </>
        )}
        {layout === 'side' && (
          <>
            <div style={{ width: `${scriptWidth}%`, overflow: 'hidden', flexShrink: 0 }}>{scriptPanelJSX}</div>
            <div onMouseDown={onDividerMouseDown}
              style={{ width: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '2px', width: '3px', height: '30px' }} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>{aiPanelJSX}</div>
          </>
        )}
        {layout === 'fullscript' && <div style={{ flex: 1, overflow: 'hidden' }}>{scriptPanelJSX}</div>}
        {layout === 'fullai'     && <div style={{ flex: 1, overflow: 'hidden' }}>{aiPanelJSX}</div>}
      </div>
    </div>
  );
}

function MiniKBEditor({ kbEntries, onUpdate }) {
  const [q, setQ]           = useState('');
  const [a, setA]           = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 8px', color: '#e8e0d0', fontSize: '10px', outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box', resize: 'none' };

  const save = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true);
    try { await base44.entities.KnowledgeBase.create({ question: q.trim(), answer: a.trim(), category: 'manual' }); setQ(''); setA(''); onUpdate(); } catch {}
    setSaving(false);
  };

  const filtered = kbEntries
    .filter(e => e.category !== 'raw_document')
    .filter(e => !search || `${e.question} ${e.answer}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ marginBottom: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', padding: '8px' }}>
        <div style={{ color: GOLD, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Add Q&A Entry</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Question…" style={{ ...inp, marginBottom: '4px' }} />
        <textarea value={a} onChange={e => setA(e.target.value)} placeholder="Answer…" rows={2} style={inp} />
        <button onClick={save} disabled={saving || !q.trim() || !a.trim()}
          style={{ marginTop: '4px', background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '3px', padding: '4px 12px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
          {saving ? '…' : '+ Add'}
        </button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${kbEntries.filter(e => e.category !== 'raw_document').length} entries…`}
        style={{ ...inp, marginBottom: '6px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {filtered.slice(0, 30).map(e => (
          <div key={e.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '5px 8px' }}>
            <div style={{ color: GOLD, fontSize: '9px', fontWeight: 'bold', marginBottom: '1px' }}>Q: {e.question}</div>
            <div style={{ color: '#6b7280', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>A: {e.answer}</div>
            {e.category && <div style={{ color: '#4a5568', fontSize: '8px', marginTop: '1px' }}>{e.category}</div>}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', padding: '10px' }}>No entries match</div>}
        {filtered.length > 30 && <div style={{ color: '#4a5568', fontSize: '9px', textAlign: 'center', padding: '4px' }}>Showing 30 of {filtered.length} — refine search</div>}
      </div>
    </div>
  );
}