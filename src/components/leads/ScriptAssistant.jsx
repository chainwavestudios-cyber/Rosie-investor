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
  const { animalType, buyingIntent = 50, questionQuality = 50, intentLabel, signals = [], coachTip } = intent;
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

export default function ScriptAssistant({ lead, user, onExpandCard, isCardExpanded }) {
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

  const active   = scripts.find(s => s.id === activeId) || scripts[0];
  const rendered = active ? applyTokens(active.content, lead, user) : '';

  const startListening = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined } });
      streamRef.current = stream;
      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const dgKey    = tokenRes?.data?.key || '';
      if (!dgKey) throw new Error('No Deepgram token');

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300`,
        ['token', dgKey]
      );
      ws.onopen = () => {
        setListening(true);
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
          const text = data?.channel?.alternatives?.[0]?.transcript?.trim();
          if (!text || !data.is_final) return;
          const entry = { text, time: new Date() };
          const newT  = [...transcriptRef.current, entry];
          transcriptRef.current = newT;
          setTranscript([...newT]);
          detectQuestions(text);
          checkTrigger(text, newT);
          if (coachMode) checkCoach(newT);
          checkIntent(newT);
        } catch {}
      };
      ws.onerror  = () => setError('Deepgram error — check mic selection');
      ws.onclose  = () => setListening(false);
      wsRef.current = ws;
    } catch (e) { setError(`Mic error: ${e.message}`); }
  };

  const stopListening = async () => {
    try { wsRef.current?.close(); }    catch {}
    try { processorRef.current?.disconnect(); } catch {}
    try { contextRef.current?.close(); }  catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    setListening(false);

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
      if (res?.data?.answer) setCoachTip(res.data.answer);
    } catch {}
  };

  const checkIntent = async (allT) => {
    if (!aiEnabled || !intentEnabled) return;
    const now = Date.now();
    if (now - lastIntent.current < 20000) return;
    if (allT.length < 3) return;
    lastIntent.current = now;
    setIntentRunning(true);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        transcript: allT, kbEntries: [], mode: 'intent',
        intentRules: {
          duckDefinition: portalCfg.intentDuckDefinition || '',
          cowDefinition:  portalCfg.intentCowDefinition  || '',
        },
      });
      if (res?.data?.intent) setIntent(res.data.intent);
    } catch {}
    setIntentRunning(false);
  };

  const askAI = async (question, allT) => {
    setAiLoading(true); setAiAnswer(''); setActiveQ(question); setAiTab('ai');
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question, transcript: (allT || transcriptRef.current).slice(-10), kbEntries,
      });
      setAiAnswer(res?.data?.answer || 'No answer found.');
    } catch (e) { setAiAnswer('Error: ' + e.message); }
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
      <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: aiEnabled ? '6px' : '0' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: listening ? '#4ade80' : '#4a5568', boxShadow: listening ? '0 0 6px #4ade80' : 'none', animation: listening ? 'pulse 1.5s infinite' : 'none', flexShrink: 0 }} />
          <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>🧠 AI Assistant</span>
          {reportSaving && <span style={{ color: '#f59e0b', fontSize: '9px' }}>⏳ Saving report…</span>}
          {reportSaved  && <span style={{ color: '#4ade80', fontSize: '9px' }}>✓ Report saved</span>}
          {intentRunning && <span style={{ color: '#6b7280', fontSize: '9px' }}>reading intent…</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button onClick={() => setAiEnabled(v => !v)}
              style={{ background: aiEnabled ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${aiEnabled ? 'rgba(184,147,58,0.5)' : 'rgba(255,255,255,0.1)'}`, color: aiEnabled ? GOLD : '#6b7280', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {aiEnabled ? '🧠 AI ON' : '🧠 AI OFF'}
            </button>
            <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
              style={{ ...inp, padding: '3px 6px', fontSize: '9px', cursor: 'pointer', maxWidth: '110px' }}>
              {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label?.slice(0, 18) || 'Mic…'}</option>)}
            </select>
            <button onClick={listening ? stopListening : startListening}
              style={{ background: listening ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)', color: listening ? '#ef4444' : '#4ade80', border: `1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>
              {listening ? '⏹ Stop' : '🎙 Listen'}
            </button>
          </div>
        </div>
        {aiEnabled && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[
              ['❓ Auto Q&A', autoQA,        () => setAutoQA(v => !v),        'rgba(245,158,11,0.2)', 'rgba(245,158,11,0.5)', '#f59e0b'],
              ['🎯 Coach',    coachMode,     () => setCoachMode(v => !v),     'rgba(167,139,250,0.2)', 'rgba(167,139,250,0.5)', '#a78bfa'],
              ['🦆 Intent',   intentEnabled, () => setIntentEnabled(v => !v), 'rgba(96,165,250,0.2)',  'rgba(96,165,250,0.5)',  '#60a5fa'],
            ].map(([label, active, toggle, bg, border, color]) => (
              <button key={label} onClick={toggle}
                style={{ background: active ? bg : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? border : 'rgba(255,255,255,0.08)'}`, color: active ? color : '#4a5568', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '9px', whiteSpace: 'nowrap' }}>
                {label}
              </button>
            ))}
            <span style={{ color: '#4a5568', fontSize: '9px', alignSelf: 'center', marginLeft: '4px' }}>
              {listening ? '● Transcribing always' : 'Transcript auto-saves on stop'}
            </span>
          </div>
        )}
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '10px', padding: '5px 10px', flexShrink: 0 }}>{error}</div>}
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