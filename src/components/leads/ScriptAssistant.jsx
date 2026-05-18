import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getPortalSettings, loadPortalSettings } from '@/lib/portalSettings';
import AIAssistantPopup from './AIAssistantPopup';

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

export default function ScriptAssistant({ lead, user, onExpandCard, isCardExpanded, twilioStream }) {
  const LAYOUT_LOCK_KEY = 'script_assistant_layout_lock';
  const [layout, setLayout]           = useState(() => {
    try { return localStorage.getItem(LAYOUT_LOCK_KEY + '_layout') || 'side'; } catch { return 'side'; }
  });
  const [scriptWidth, setScriptWidth] = useState(() => {
    try { return parseInt(localStorage.getItem(LAYOUT_LOCK_KEY + '_width') || '52', 10); } catch { return 52; }
  });
  const [layoutLocked, setLayoutLocked] = useState(() => {
    try { return localStorage.getItem(LAYOUT_LOCK_KEY + '_locked') === 'true'; } catch { return false; }
  });
  const isDraggingDivider             = useRef(false);
  const containerRef                  = useRef(null);

  const [scripts, setScripts]         = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [loadingScripts, setLoadingScripts] = useState(true);

  const [listening, setListening]     = useState(false);
  const [transcript, setTranscript]   = useState([]);
  const [allKbEntries, setAllKbEntries] = useState([]);
  const [kbEntries, setKbEntries]     = useState([]);
  const [kbNames, setKbNames]           = useState([]);
  const [selectedKbName, setSelectedKbName] = useState('');
  const [kbConfig, setKbConfig]         = useState(null); // KnowledgeBaseConfig for selected named KB
  const [portalCfg, setPortalCfg]     = useState(getPortalSettings);
  const [error, setError]             = useState('');

  // Connection statuses
  const [streamStatus, setStreamStatus] = useState('idle');
  const [aiEnabled,    setAiEnabled]    = useState(false);

  // Popup + feature toggles — all default OFF
  const [showPopup,    setShowPopup]    = useState(false);
  const [qaActive,     setQaActive]     = useState(false);
  const [coachActive,  setCoachActive]  = useState(false);
  const [intentActive, setIntentActive] = useState(false);
  const [intentResult, setIntentResult] = useState(null);
  const [previousCallSummary, setPreviousCallSummary] = useState(null);

  // Post-call saving
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved,  setReportSaved]  = useState(false);

  const wsRef         = useRef(null);
  const streamRef     = useRef(null);
  const processorRef  = useRef(null);
  const contextRef    = useRef(null);
  const transcriptRef = useRef([]);
  const qaLogRef      = useRef([]);   // accumulated Q&A pairs
  const coachTipsRef  = useRef([]);   // accumulated coach tips

  // ── Pre-warm cache (populated as soon as call connects) ────────────
  const prewarmRef = useRef({
    dgKey:        null,   // Deepgram token
    audioCtx:     null,   // AudioContext (already resumed)
    mergedStream: null,   // mixed remote+local MediaStream
    workletReady: false,  // audioWorklet module loaded
    dest:         null,   // MediaStreamDestination node
  });

  // ── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    base44.entities.GlobalScript.list('sortOrder', 200)
      .then(r => { setScripts(r || []); if (r?.length) setActiveId(r[0].id); })
      .catch(() => {}).finally(() => setLoadingScripts(false));
    base44.entities.KnowledgeBase.list('-created_date', 500).then(all => {
      const entries = all || [];
      setAllKbEntries(entries);
      const names = [...new Set(entries.map(e => e.kbName || '').filter(Boolean))];
      setKbNames(names);
      setKbEntries(entries.filter(e => !e.kbName || e.kbName === ''));
    }).catch(() => {});
    loadPortalSettings().then(setPortalCfg).catch(() => {});
    // Load previous call transcript for coaching context (live calls only, not BOB)
    if (lead?.id) {
      base44.entities.LeadHistory.filter({ leadId: lead.id, type: 'transcript' })
        .then(records => {
          const real = (records || []).filter(r => r.source !== 'bob_training');
          if (real.length > 0) {
            // Most recent prior transcript becomes context for coaching
            const sorted = real.sort((a, b) => new Date(b.created_date||0) - new Date(a.created_date||0));
            const lines = (sorted[0].content || '').split('\n').slice(-12).join('\n');
            setPreviousCallSummary(lines);
          }
        }).catch(() => {});
    }
    return () => stopListening();
  }, []);

  // ── Auto-stop when call ends ──────────────────────────────────────
  // We do NOT auto-start — user clicks the button manually when they want it
  useEffect(() => {
    if (twilioStream === null && listening) {
      stopListening();
    }
  }, [twilioStream]);

  // ── Pre-warm: fire as soon as the call connects ───────────────────
  // Fetches Deepgram token, builds AudioContext, merges streams and loads
  // the AudioWorklet module — all before the user clicks "Connect Stream".
  useEffect(() => {
    if (!twilioStream?.remoteStream && !twilioStream?.localStream) return;

    let cancelled = false;
    const pw = prewarmRef.current;

    const prewarm = async () => {
      try {
        // 1. Deepgram token
        if (!pw.dgKey) {
          pw.dgKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
          if (!pw.dgKey) {
            const tokenRes = await base44.functions.invoke('deepgramToken', {});
            if (cancelled) return;
            pw.dgKey = tokenRes?.key || tokenRes?.data?.key || '';
          }
        }

        // 2. AudioContext + stereo stream (ch0=remote/prospect, ch1=local/agent)
        if (!pw.audioCtx) {
          const audioCtx = new AudioContext({ sampleRate: 16000 });
          if (audioCtx.state === 'suspended') await audioCtx.resume();
          if (cancelled) { audioCtx.close(); return; }

          // Build a 2-channel merger: ch0 = remote (prospect), ch1 = local (agent)
          const merger = audioCtx.createChannelMerger(2);
          if (twilioStream.remoteStream) {
            try { audioCtx.createMediaStreamSource(twilioStream.remoteStream).connect(merger, 0, 0); } catch {}
          }
          if (twilioStream.localStream) {
            try { audioCtx.createMediaStreamSource(twilioStream.localStream).connect(merger, 0, 1); } catch {}
          }
          const dest = audioCtx.createMediaStreamDestination();
          merger.connect(dest);

          pw.audioCtx     = audioCtx;
          pw.dest         = dest;
          pw.mergedStream = dest.stream;

          // 3. Pre-load AudioWorklet module
          const workletCode = `
            class PCMProcessor extends AudioWorkletProcessor {
              process(inputs) {
                const ch0 = inputs[0]?.[0]; // ch0 = remote / prospect
                const ch1 = inputs[0]?.[1]; // ch1 = local  / agent
                const len = ch0?.length || ch1?.length || 0;
                if (len) {
                  // Interleave both channels: L R L R... so Deepgram sees 2-channel audio
                  const pcm = new Int16Array(len * 2);
                  for (let i = 0; i < len; i++) {
                    pcm[i * 2]     = Math.max(-32768, Math.min(32767, (ch0?.[i] ?? 0) * 32768));
                    pcm[i * 2 + 1] = Math.max(-32768, Math.min(32767, (ch1?.[i] ?? 0) * 32768));
                  }
                  this.port.postMessage(pcm.buffer, [pcm.buffer]);
                }
                return true;
              }
            }
            registerProcessor('pcm-processor', PCMProcessor);
          `;
          const blob       = new Blob([workletCode], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          try {
            await audioCtx.audioWorklet.addModule(workletUrl);
            URL.revokeObjectURL(workletUrl);
            pw.workletReady = true;
            console.log('[ScriptAssistant] Pre-warm complete ✓');
          } catch (err) {
            URL.revokeObjectURL(workletUrl);
            console.warn('[ScriptAssistant] Pre-warm worklet failed (will fallback):', err.message);
          }
        }
      } catch (err) {
        console.warn('[ScriptAssistant] Pre-warm error (non-fatal):', err.message);
      }
    };

    prewarm();
    return () => { cancelled = true; };
  }, [twilioStream]);

  // ── Connect to Deepgram via Twilio streams ─────────────────────────
  // Uses pre-warmed token, AudioContext and worklet module cached in prewarmRef.
  // If pre-warm hasn't finished yet (e.g. user clicks very fast) it falls back
  // to the original on-demand setup so nothing ever breaks.
  const startListeningFromStream = async (remoteStream, localStream) => {
    if (listening) return;
    setError('');
    setStreamStatus('connecting');

    try {
      const pw = prewarmRef.current;

      // ── 1. Resolve streams ─────────────────────────────────────────
      // Use pre-warm streams if available, otherwise fall back to polling
      let mergedStream = pw.mergedStream || null;
      let audioCtx     = pw.audioCtx     || null;

      if (!mergedStream) {
        console.log('[ScriptAssistant] Pre-warm miss — resolving streams on demand');

        if (!remoteStream && twilioStream?.call) {
          for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 250));
            remoteStream = twilioStream.call.getRemoteStream?.() || null;
            localStream  = twilioStream.call.getLocalStream?.()  || null;
            if (remoteStream) break;
          }
        }

        if (!remoteStream && !localStream) {
          setError('Could not get call audio streams. Is the call still active?');
          setStreamStatus('error');
          return;
        }

        const nativeSampleRate = 16000;
        audioCtx = new AudioContext({ sampleRate: nativeSampleRate });
        contextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        // ch0 = remote (prospect), ch1 = local (agent)
        const merger = audioCtx.createChannelMerger(2);
        if (remoteStream) { try { audioCtx.createMediaStreamSource(remoteStream).connect(merger, 0, 0); } catch {} }
        if (localStream)  { try { audioCtx.createMediaStreamSource(localStream).connect(merger, 0, 1);  } catch {} }
        const dest = audioCtx.createMediaStreamDestination();
        merger.connect(dest);
        mergedStream = dest.stream;
      } else {
        console.log('[ScriptAssistant] Using pre-warmed streams ✓');
        contextRef.current = audioCtx;
      }

      streamRef.current = mergedStream;

      // ── 2. Deepgram token ─────────────────────────────────────────
      let dgKey = pw.dgKey || import.meta.env.VITE_DEEPGRAM_API_KEY || '';
      if (!dgKey) {
        console.log('[ScriptAssistant] Pre-warm token miss — fetching on demand');
        const tokenRes = await base44.functions.invoke('deepgramToken', {});
        dgKey = tokenRes?.key || tokenRes?.data?.key || '';
      } else {
        console.log('[ScriptAssistant] Using Deepgram key ✓');
      }
      if (!dgKey) throw new Error('No Deepgram token — check VITE_DEEPGRAM_API_KEY');

      // ── 3. Open WebSocket ─────────────────────────────────────────
      const nativeSampleRate = audioCtx.sampleRate;
      // multichannel=true: ch0=remote/prospect, ch1=local/agent — gives clean speaker separation
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=300&sentiment=true&multichannel=true&channels=2&sample_rate=${nativeSampleRate}&encoding=linear16`,
        ['token', dgKey]
      );
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('[ScriptAssistant] Deepgram WS opened');
        setListening(true);
        setStreamStatus('connected');
        setAiEnabled(true);

        // ── 4. Wire audio pipeline ────────────────────────────────
        if (pw.workletReady && audioCtx) {
          // Worklet already loaded — just create the node
          console.log('[ScriptAssistant] Using pre-warmed AudioWorklet ✓');
          try {
            const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
            processorRef.current = workletNode;
            workletNode.port.onmessage = (e) => {
              if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
            };
            const src = audioCtx.createMediaStreamSource(mergedStream);
            src.connect(workletNode);
            workletNode.connect(audioCtx.destination);
            console.log('[ScriptAssistant] AudioWorklet pipeline connected ✓');
          } catch (err) {
            console.warn('[ScriptAssistant] Worklet node failed, falling back:', err.message);
            pw.workletReady = false; // fall through to ScriptProcessor below
          }
        }

        if (!pw.workletReady) {
          // Load worklet fresh (pre-warm miss or worklet node failed)
          const workletCode = `
            class PCMProcessor extends AudioWorkletProcessor {
              process(inputs) {
                const ch0 = inputs[0]?.[0]; // ch0 = remote / prospect
                const ch1 = inputs[0]?.[1]; // ch1 = local  / agent
                const len = ch0?.length || ch1?.length || 0;
                if (len) {
                  // Interleave both channels: L R L R... so Deepgram sees 2-channel audio
                  const pcm = new Int16Array(len * 2);
                  for (let i = 0; i < len; i++) {
                    pcm[i * 2]     = Math.max(-32768, Math.min(32767, (ch0?.[i] ?? 0) * 32768));
                    pcm[i * 2 + 1] = Math.max(-32768, Math.min(32767, (ch1?.[i] ?? 0) * 32768));
                  }
                  this.port.postMessage(pcm.buffer, [pcm.buffer]);
                }
                return true;
              }
            }
            registerProcessor('pcm-processor', PCMProcessor);
          `;
          const blob       = new Blob([workletCode], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          try {
            await audioCtx.audioWorklet.addModule(workletUrl);
            URL.revokeObjectURL(workletUrl);
            const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
            processorRef.current = workletNode;
            workletNode.port.onmessage = (e) => {
              if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
            };
            const src = audioCtx.createMediaStreamSource(mergedStream);
            src.connect(workletNode);
            workletNode.connect(audioCtx.destination);
          } catch (err) {
            console.warn('AudioWorklet unavailable, falling back to ScriptProcessor:', err.message);
            const proc = audioCtx.createScriptProcessor(4096, 2, 2); // 2 input channels: ch0=prospect, ch1=agent
            processorRef.current = proc;
            const src = audioCtx.createMediaStreamSource(mergedStream);
            proc.onaudioprocess = e => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const ch0 = e.inputBuffer.getChannelData(0); // prospect
              const ch1 = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : null; // agent
              const len = ch0.length;
              const pcm = new Int16Array(len * 2);
              for (let i = 0; i < len; i++) {
                pcm[i * 2]     = Math.max(-32768, Math.min(32767, ch0[i] * 32768));
                pcm[i * 2 + 1] = Math.max(-32768, Math.min(32767, (ch1?.[i] ?? 0) * 32768));
              }
              ws.send(pcm.buffer);
            };
            src.connect(proc);
            proc.connect(audioCtx.destination);
          }
        }
      };

      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const alt  = data?.channel?.alternatives?.[0];
          const text = alt?.transcript?.trim();
          if (!text || !data.is_final) return;
          // channel_index[0] = 0 → remote/prospect, 1 → local/agent
          const channelIdx = Array.isArray(data.channel_index) ? data.channel_index[0] : null;
          // 0 = prospect (remote), 1 = agent (local)
          const speaker   = channelIdx !== null ? channelIdx : (alt?.words?.[0]?.speaker ?? null);
          const sentLabel = alt?.sentiments?.segments?.[0]?.sentiment || null;
          const sentScore = alt?.sentiments?.segments?.[0]?.sentiment_score ?? null;
          const entry = { text, time: new Date(), speaker, sentiment: sentLabel, sentScore };
          const newT  = [...transcriptRef.current, entry];
          transcriptRef.current = newT;
          setTranscript([...newT]);
        } catch {}
      };

      ws.onerror = (e) => {
        console.error('[ScriptAssistant] Deepgram WS error:', e);
        setError('Deepgram WebSocket error — check DEEPGRAM_API_KEY');
        setStreamStatus('error');
      };
      ws.onclose = (e) => {
        console.log('[ScriptAssistant] Deepgram WS closed — code:', e.code, 'reason:', e.reason);
        if (e.code === 1008) setError('Deepgram auth failed — check DEEPGRAM_API_KEY env var');
        else if (e.code === 1011) setError('Deepgram server error — invalid audio format');
        else if (e.code !== 1000) setError(`Deepgram disconnected (code ${e.code})`);
        setListening(false);
        setStreamStatus('idle');
        setAiEnabled(false);
      };

    } catch (e) {
      setError(`Stream error: ${e.message}`);
      setStreamStatus('error');
    }
  };

  // ── Manual connect (fallback if no twilioStream prop yet) ──────────
  const connectStream = () => {
    // GUARD: Must select a KB before connecting the stream
    if (!selectedKbName || selectedKbName.trim() === '') {
      setError('⚠ Please select a Knowledge Base before connecting the Twilio stream. This ensures call transcripts, AI answers, and reports are saved to the correct KB.');
      return;
    }
    if (twilioStream) {
      startListeningFromStream(twilioStream.remoteStream, twilioStream.localStream);
    } else {
      setError('No active Twilio call. Start a call first, then connect the stream.');
    }
  };

  // ── Disconnect + save ─────────────────────────────────────────────
  const stopListening = async () => {
    try { wsRef.current?.close(); } catch {}
    try { processorRef.current?.disconnect(); processorRef.current?.port?.close?.(); } catch {}
    try { contextRef.current?.close(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    // Reset pre-warm cache so next call starts fresh
    prewarmRef.current = { dgKey: null, audioCtx: null, mergedStream: null, workletReady: false, dest: null };
    setListening(false);
    setStreamStatus('idle');
    setAiEnabled(false);
    setQaActive(false);
    setCoachActive(false);
    setIntentActive(false);

    const finalTranscript = transcriptRef.current;
    if (!finalTranscript || finalTranscript.length < 2) return;
    const l = lead;
    if (!l?.id) return;

    setReportSaving(true);
    setReportSaved(false);

    try {
      // 1. Save raw transcript
      const transcriptText = finalTranscript.map(t => {
        const spkLabel = t.speaker === 1 ? '[Agent]' : t.speaker === 0 ? '[Prospect]' : '';
        return `[${new Date(t.time).toLocaleTimeString()}]${spkLabel ? ' ' + spkLabel : ''} ${t.text}`;
      }).join('\n');
      await base44.entities.LeadHistory.create({
        leadId: l.id,
        type: 'transcript',
        source: 'live_call',  // never 'bob_training' — BOB data stays in BOB
        content: transcriptText,
        kbName: selectedKbName || '',
        callAttemptNumber: l.callAttempts || 1,
        createdBy: 'system',
      });

      // 2. Run post-call intent if it was used
      let finalIntent = intentResult;
      if (intentActive || intentResult) {
        try {
          const ir = await base44.functions.invoke('liveAssistantAI', {
            transcript: finalTranscript, mode: 'intent_final',
            intentRules: {
              duckDefinition:  (kbConfig || portalCfg)?.intentDuckDefinition,
              cowDefinition:   (kbConfig || portalCfg)?.intentCowDefinition,
              positiveSignals: (kbConfig || portalCfg)?.intentPositiveSignals,
              negativeSignals: (kbConfig || portalCfg)?.intentNegativeSignals,
              sentimentRules:  (kbConfig || portalCfg)?.intentSentimentRules,
            },
            engagementScore: lead?.engagementScore || 0,
          });
          finalIntent = ir?.data?.intent || ir?.intent || finalIntent;
        } catch {}
      }

      // 3. Generate full report
      const reportRes = await base44.functions.invoke('liveAssistantAI', {
        transcript: finalTranscript, mode: 'full_report',
        usedQA: qaActive || qaLogRef.current.length > 0,
        usedCoach: coachActive || coachTipsRef.current.length > 0,
        usedIntent: !!finalIntent,
        qaLog: qaLogRef.current,
        coachTips: coachTipsRef.current,
        intentResult: finalIntent,
        kbName: selectedKbName || '',
      });
      const report = reportRes?.data?.report || '';
      if (report) {
        await base44.entities.LeadHistory.create({ leadId: l.id, type: 'call_report', content: report, createdBy: 'system' });
      }

      // 4. Save intent score to lead
      if (finalIntent?.intentScore !== undefined) {
        const leadUpdates = {
          intentScore: finalIntent.intentScore,
          lastIntentAnalysis: JSON.stringify(finalIntent),
        };
        // Auto-populate CRM fields from extracted call data
        const ex = finalIntent.extractedData || {};
        if (ex.bestTimeToCall && ex.bestTimeToCall !== 'null') {
          leadUpdates.bestTimeToCall = ex.bestTimeToCall;
        }
        if (ex.extractedNotes && ex.extractedNotes !== 'null') {
          const existingNotes = l.notes || '';
          const notePrefix = existingNotes ? existingNotes + '\n' : '';
          leadUpdates.notes = `${notePrefix}[AI ${new Date().toLocaleDateString()}] ${ex.extractedNotes}`.trim();
        }
        await base44.entities.Lead.update(l.id, leadUpdates);
      }

      // 5. Update client profile
      try {
        const profileRes = await base44.functions.invoke('liveAssistantAI', {
          transcript: finalTranscript, kbEntries: [], mode: 'profile',
          existingProfile: lead?.clientProfile || '',
        });
        const newProfile = profileRes?.data?.profile;
        if (newProfile) await base44.entities.Lead.update(l.id, { clientProfile: JSON.stringify(newProfile) });
      } catch {}

      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 5000);
    } catch (e) {
      console.error('Post-call save failed:', e);
    }
    setReportSaving(false);

    // Reset for next call
    transcriptRef.current = [];
    qaLogRef.current      = [];
    coachTipsRef.current  = [];
    setTranscript([]);
    setIntentResult(null);
    // Note: popup intentionally stays open — user closes it manually
  };

  // ── Toggle features → open popup ──────────────────────────────────
  const toggleQA = () => {
    const next = !qaActive;
    setQaActive(next);
    if (next) setShowPopup(true);
  };
  const toggleCoach = () => {
    const next = !coachActive;
    setCoachActive(next);
    if (next) setShowPopup(true);
  };
  const toggleIntent = () => {
    const next = !intentActive;
    setIntentActive(next);
    if (next) setShowPopup(true);
  };

  // ── Script panel + auto-scroll ───────────────────────────────────
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1);
  const [autoScrollActive, setAutoScrollActive] = useState(false);
  const scriptContentRef = useRef(null);
  
  const active   = scripts.find(s => s.id === activeId) || scripts[0];
  const rendered = active ? applyTokens(active.content, lead, user) : '';

  // Auto-scroll effect — only scrolls the script panel, not the AI side
  const userScrollingRef = useRef(false);
  useEffect(() => {
    if (!autoScrollActive || !scriptContentRef.current) return;
    const el = scriptContentRef.current;

    // Pause auto-scroll briefly when user scrolls manually
    const onUserScroll = () => {
      userScrollingRef.current = true;
      clearTimeout(onUserScroll._timeout);
      onUserScroll._timeout = setTimeout(() => { userScrollingRef.current = false; }, 2000);
    };
    el.addEventListener('wheel', onUserScroll, { passive: true });

    const interval = setInterval(() => {
      if (!userScrollingRef.current && scriptContentRef.current) {
        scriptContentRef.current.scrollTop += autoScrollSpeed;
      }
    }, 50);
    
    return () => {
      clearInterval(interval);
      el.removeEventListener('wheel', onUserScroll);
    };
  }, [autoScrollActive, autoScrollSpeed]);

  const onDividerMouseDown = (e) => { isDraggingDivider.current = true; e.preventDefault(); };
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingDivider.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (layout === 'side') {
        const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const clamped = Math.max(25, Math.min(75, pct));
        setScriptWidth(clamped);
        if (layoutLocked) localStorage.setItem(LAYOUT_LOCK_KEY + '_width', String(clamped));
      } else {
        const pct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        const clamped = Math.max(20, Math.min(80, pct));
        setScriptWidth(clamped);
        if (layoutLocked) localStorage.setItem(LAYOUT_LOCK_KEY + '_width', String(clamped));
      }
    };
    const onUp = () => { isDraggingDivider.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [layout]);

  const inp = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', fontFamily: 'Georgia, serif' };

  const streamStatusLight = { idle: '#4a5568', connecting: '#f59e0b', connected: '#4ade80', error: '#ef4444' }[streamStatus];

  const scriptPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }} onWheel={e => e.stopPropagation()}>
      {/* Sticky script tabs */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(0,0,0,0.25)' }}>
        {scripts.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{ background: activeId === s.id ? 'rgba(184,147,58,0.1)' : 'none', border: 'none', borderBottom: activeId === s.id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeId === s.id ? GOLD : '#6b7280', padding: '7px 12px', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {s.name}
          </button>
        ))}
      </div>

      {/* Auto-scroll controls */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: 'rgba(0,0,0,0.1)' }}>
        <button onClick={() => setAutoScrollActive(!autoScrollActive)}
          style={{ background: autoScrollActive ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)', color: autoScrollActive ? '#4ade80' : '#8a9ab8', border: `1px solid ${autoScrollActive ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {autoScrollActive ? '⏸ Pause' : '▶ Auto Scroll'}
        </button>
        <input type="range" min="0.5" max="3" step="0.5" value={autoScrollSpeed} onChange={e => setAutoScrollSpeed(parseFloat(e.target.value))}
          style={{ width: '80px', cursor: 'pointer', accentColor: GOLD }} />
        <span style={{ color: '#8a9ab8', fontSize: '9px', minWidth: '30px' }}>{autoScrollSpeed}x</span>
      </div>

      {/* Scrollable script content */}
      {loadingScripts && <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '24px' }}>Loading…</div>}
      {!loadingScripts && scripts.length === 0 && <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No scripts yet.</div>}
      {active && (
        <div ref={scriptContentRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', background: 'rgba(0,0,0,0.15)', color: active.color || '#e8e0d0', fontSize: `${active.fontSize || 14}px`, lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
          {rendered}
        </div>
      )}
    </div>
  );

  const aiPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Control bar */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>

        {/* Row 1: header + save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>🧠 AI Assistant</span>
          {reportSaving && <span style={{ color: '#f59e0b', fontSize: '9px' }}>⏳ Saving report…</span>}
          {reportSaved  && <span style={{ color: '#4ade80', fontSize: '9px' }}>✓ Report saved</span>}
        </div>

        {/* Row 2: KB Selector — REQUIRED before stream can connect */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2px' }}>
          <span style={{ color: !selectedKbName ? '#ef4444' : '#6b7280', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', flexShrink: 0 }}>
            📚 KB{!selectedKbName && !listening ? ' ⚠ Required' : ':'}
          </span>
          <select
            value={selectedKbName}
            onChange={async e => {
              const name = e.target.value;
              setSelectedKbName(name);
              setKbEntries(name
                ? allKbEntries.filter(e2 => (e2.kbName || '') === name)
                : allKbEntries.filter(e2 => !e2.kbName || e2.kbName === ''));
              if (name) {
                try {
                  const cfgs = await base44.entities.KnowledgeBaseConfig.filter({ kbName: name });
                  setKbConfig(cfgs?.[0] || null);
                } catch { setKbConfig(null); }
              } else {
                setKbConfig(null);
              }
            }}
            disabled={listening}
            style={{ background: !selectedKbName ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)', border: `1px solid ${!selectedKbName ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '4px', padding: '2px 8px', color: selectedKbName ? GOLD : '#ef4444', fontSize: '10px', outline: 'none', cursor: listening ? 'not-allowed' : 'pointer', maxWidth: '180px' }}
          >
            <option value="">— Select KB (required) —</option>
            {kbNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {selectedKbName && (
            <span style={{ color: '#4a5568', fontSize: '9px' }}>
              ({kbEntries.length} entries)
            </span>
          )}
        </div>

        {/* Row 3: Stream connect + AI status */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Stream connect button */}
          <button onClick={() => listening ? stopListening() : connectStream()}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: listening ? 'rgba(74,222,128,0.1)' : streamStatus === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${listening ? 'rgba(74,222,128,0.4)' : streamStatus === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.12)'}`, color: listening ? '#4ade80' : streamStatus === 'error' ? '#ef4444' : '#8a9ab8', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: streamStatusLight, boxShadow: listening ? '0 0 6px #4ade80' : 'none', animation: streamStatus === 'connecting' ? 'pulse 0.8s infinite' : listening ? 'pulse 2.5s infinite' : 'none' }} />
            {listening ? '⏹ Disconnect Stream' : '🔗 Twilio Stream Connect'}
          </button>

          {/* AI status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: aiEnabled ? 'rgba(184,147,58,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${aiEnabled ? 'rgba(184,147,58,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '4px', padding: '4px 10px', fontSize: '9px', color: aiEnabled ? GOLD : '#4a5568', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: aiEnabled ? '#4ade80' : '#4a5568', boxShadow: aiEnabled ? '0 0 6px #4ade80' : 'none' }} />
            🧠 {aiEnabled ? 'AI ON' : 'AI OFF'}
          </div>
        </div>

        {/* Row 3: Feature toggles (only when AI is on) */}
        {aiEnabled && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: '❓ Auto Q&A', active: qaActive,     toggle: toggleQA,     color: '#f59e0b' },
              { label: '🎯 Coach',    active: coachActive,  toggle: toggleCoach,  color: '#a78bfa' },
              { label: '🦆 Intent',   active: intentActive, toggle: toggleIntent, color: '#60a5fa' },
            ].map(({ label, active: on, toggle, color }) => (
              <button key={label} onClick={toggle}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: on ? `${color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? `${color}44` : 'rgba(255,255,255,0.08)'}`, color: on ? color : '#4a5568', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '9px', whiteSpace: 'nowrap' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: on ? color : '#4a5568', boxShadow: on ? `0 0 5px ${color}` : 'none' }} />
                {label}
              </button>
            ))}
            {(qaActive || coachActive || intentActive) && (
              <button onClick={() => setShowPopup(true)}
                style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
                ↗ Open Popup
              </button>
            )}
            <span style={{ color: '#4a5568', fontSize: '9px', marginLeft: '2px' }}>
              {listening ? '● live' : 'auto-saves on stop'}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)', flexShrink: 0, padding: '6px 10px' }}>
          <div style={{ color: '#ef4444', fontSize: '10px', lineHeight: 1.5 }}>{error}</div>
        </div>
      )}

      {/* Transcript preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {transcript.length === 0
          ? <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>{listening ? 'Listening…' : 'Connect stream to begin'}</div>
          : [...transcript].reverse().slice(0, 30).map((t, i) => (
            <div key={i} style={{ marginBottom: '5px', fontSize: '11px' }}>
              <span style={{ color: '#4a5568', fontSize: '9px', marginRight: '5px' }}>{new Date(t.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
              {t.speaker !== null && (
                <span style={{ color: t.speaker === 1 ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', marginRight: '4px' }}>
                  {t.speaker === 1 ? '🎙 Agent' : '👤 Prospect'}
                </span>
              )}
              <span style={{ color: '#c4cdd8' }}>{t.text}</span>
            </div>
          ))
        }
      </div>
    </div>
  );

  const handleSetLayout = (id) => {
    setLayout(id);
    if (layoutLocked) {
      localStorage.setItem(LAYOUT_LOCK_KEY + '_layout', id);
    }
  };

  const handleToggleLock = () => {
    const next = !layoutLocked;
    setLayoutLocked(next);
    localStorage.setItem(LAYOUT_LOCK_KEY + '_locked', String(next));
    if (next) {
      localStorage.setItem(LAYOUT_LOCK_KEY + '_layout', layout);
      localStorage.setItem(LAYOUT_LOCK_KEY + '_width', String(scriptWidth));
    }
  };

  const LayoutBtn = ({ id, label, icon }) => (
    <button onClick={() => handleSetLayout(id)} title={label}
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
        {/* Lock layout as default */}
        <button onClick={handleToggleLock} title={layoutLocked ? 'Layout locked as default — click to unlock' : 'Lock this layout as default for all lead cards'}
          style={{ background: layoutLocked ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${layoutLocked ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)'}`, color: layoutLocked ? '#4ade80' : '#6b7280', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: layoutLocked ? 'bold' : 'normal' }}>
          {layoutLocked ? '🔒 Locked' : '🔓 Lock'}
        </button>
        {onExpandCard && (
          <button onClick={onExpandCard} title={isCardExpanded ? 'Collapse card' : 'Expand card'}
            style={{ marginLeft: 'auto', background: isCardExpanded ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isCardExpanded ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`, color: isCardExpanded ? '#60a5fa' : '#6b7280', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {isCardExpanded ? '⊟ Collapse Card' : '⊞ Expand Card'}
          </button>
        )}
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: layout === 'top' ? 'column' : 'row', position: 'relative' }}>
        {layout === 'top' && (<>
          <div style={{ height: `${100 - scriptWidth}%`, overflow: 'hidden', flexShrink: 0 }}>{aiPanelJSX}</div>
          <div onMouseDown={onDividerMouseDown} style={{ height: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '2px', width: '3px', height: '30px' }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>{scriptPanelJSX}</div>
        </>)}
        {layout === 'side' && (<>
          <div style={{ width: `${scriptWidth}%`, overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>{scriptPanelJSX}</div>
          <div onMouseDown={onDividerMouseDown} style={{ width: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '2px', width: '3px', height: '30px' }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{aiPanelJSX}</div>
        </>)}
        {layout === 'fullscript' && <div style={{ flex: 1, overflow: 'hidden' }}>{scriptPanelJSX}</div>}
        {layout === 'fullai'     && <div style={{ flex: 1, overflow: 'hidden' }}>{aiPanelJSX}</div>}
      </div>

      {/* Floating popup */}
      {showPopup && (
        <AIAssistantPopup
          lead={lead}
          transcript={transcript}
          transcriptRef={transcriptRef}
          kbEntries={kbEntries}
          portalCfg={kbConfig ? { ...portalCfg, ...kbConfig } : portalCfg}
          engagementScore={lead?.engagementScore || 0}
          qaActive={qaActive}
          coachActive={coachActive}
          intentActive={intentActive}
          onToggleQA={toggleQA}
          onToggleCoach={toggleCoach}
          onToggleIntent={toggleIntent}
          onClose={() => setShowPopup(false)}
          onIntentResult={result => { setIntentResult(result); }}
          onQALog={(qa) => { qaLogRef.current.push(qa); }}
          onCoachTip={(tip) => { coachTipsRef.current.push(tip); }}
          kbName={selectedKbName || ''}
          allKbEntries={allKbEntries}
          kbNames={kbNames}
          selectedKbName={selectedKbName}
          activeScript={scripts.find(s => s.id === activeId) || scripts[0]}
          scripts={scripts}
          callAttemptNumber={lead?.callAttempts || 1}
          previousCallSummary={previousCallSummary}
          onKbChange={async (name) => {
            setSelectedKbName(name);
            setKbEntries(name
              ? allKbEntries.filter(e => (e.kbName || '') === name)
              : allKbEntries.filter(e => !e.kbName || e.kbName === ''));
            // Load KnowledgeBaseConfig for named KB
            if (name) {
              try {
                const cfgs = await base44.entities.KnowledgeBaseConfig.filter({ kbName: name });
                setKbConfig(cfgs?.[0] || null);
              } catch { setKbConfig(null); }
            } else {
              setKbConfig(null); // Default KB uses portalCfg
            }
          }}
        />
      )}
    </div>
  );
}