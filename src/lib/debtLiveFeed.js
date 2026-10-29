// Live call audio → Deepgram transcript feed.
//
// Two feeds are possible:
//  • dual   — mic on channel 0 (agent), the customer device on channel 1 (caller).
//  • single — one feed, Deepgram separates the voices itself (diarization).
//
// A selected dual-input setup stays dual: silence on the customer return must
// never silently replace that return with the room microphone.

// Deepgram Nova-3 keyterm prompting — boosts recognition of debt settlement vocabulary
// that the model mishears (e.g. "pay" → "training"). Nova-3 uses repeated keyterm= params.
// Extracted from real Drew call transcripts — creditor names, financial terms, phrases.
export const DEBT_KEYTERMS = [
  // ── Core financial terms (trimmed: removed 'pay','paid','debt','debts' — too common, caused 'pay'→'training' mishearing) ──
  'payment', 'paying', 'payments',
  'settle', 'settlement', 'settling', 'settled',
  'enroll', 'enrollment', 'enrolling', 'enrolled',
  'debtor', 'creditor', 'creditors',
  'bankruptcy', 'hardship', 'cosigner', 'cosigners',
  'garnishment', 'consolidation', 'escrow', 'forbearance', 'repossession',
  'collector', 'collectors', 'collection', 'balance', 'balances',
  'delinquent', 'delinquency', 'utilization', 'negotiate', 'negotiation',
  // ── Financial phrases ──
  'minimum+payment', 'charge+off', 'charged+off', 'monthly+payment',
  'credit+score', 'credit+report', 'credit+card', 'debit+card',
  'lump+sum', 'social+security', 'account+number', 'interest+rate',
  'unsecured+debt', 'soft+credit+check', 'fixed+income',
  'debt+settlement', 'debt+consolidation', 'debt+management',
  'authorized+user', 'past+due', 'escrow+account', 'trust+account',
  'tax+write-off', 'checking+account', 'savings+account', 'routing+number',
  'minimum+payment+warning', 'debt+to+income+ratio',
  // ── Creditor names ──
  'Chase', 'Discover', 'Amex', 'American+Express', 'Citi', 'Citibank',
  'Synchrony', 'Synchrony+Bank', 'Comenity', 'Comenity+Capital',
  'Barclaycard', 'Wells+Fargo', 'Capital+One', 'Bank+of+America',
  'Best+Egg', 'Venmo', 'One+Main', 'Home+Depot', 'Best+Buy',
  'Credit+One', 'Credit+One+Bank', 'First+Premier', 'Milestone',
  'Indigo', 'PayPal', 'Samsung', 'Amazon', 'Chevron',
  'Rooms+to+Go', 'Care+Credit', 'Farm+Bureau', 'First+Savings+Bank',
  'Goldman+Sachs', 'Navy+Federal', 'Pentagon', 'Vistar', 'Greenwood',
  'Bank+of+Missouri', 'Alfion', 'Alfion+Dental', 'Tampa+Bay',
  // ── Company / program names ──
  'Start+New+Financial', 'Global+Holdings', 'Evergreen+Legal',
  'Debt+Advisors', 'Better+Business+Bureau', 'Trustpilot',
  'DocuSign', 'LinkedIn', 'Torch+Award',
  // ── Bankruptcy / legal terms ──
  'Chapter+7', 'Chapter+13', 'means+test', 'liquidation',
  'APR',
].map(k => `keyterm=${k}`).join('&');

const COMMON_PARAMS = 'smart_format=true&punctuate=true&numerals=true&sentiment=true&utterances=true&interim_results=true&encoding=linear16&endpointing=400';

const SILENT_CUSTOMER_AFTER_MS = 30000; // how long a dead customer feed is given before switching
const MIN_MIC_LINES = 3;                // mic speech needed before the switch is trusted
const WATCHDOG_CHECKS = 3;              // a quiet opening must not use up the one and only check
const MAX_RECONNECTS = 20;              // a socket that drops mid-call reopens instead of going quiet
const RECONNECT_DELAY_MS = 1200;

/**
 * Opens the live transcript feed.
 * Returns { ctx, close() }. Callbacks:
 *  onStatus(status)            — 'connected' | 'idle' | 'error'
 *  onOpen()                    — socket connected (session bookkeeping)
 *  onLine({ speaker, text, sentiment, time }) — one finished transcript line
 *  onInterim(speaker, text)    — live preview of the line being spoken
 *  onError(message)
 *  onCreditExhaustion(kind, message)
 *  onSocketClosed(event)       — final save before the socket goes away
 */
export async function startLiveFeed({
  agentStream, customerStream, dualMode, dgKey, agentGain = 1, customerGain = 1,
  onStatus, onOpen, onLine, onInterim, onError, onCreditExhaustion, onSocketClosed,
}) {
  // Pin AudioContext to 16kHz — Deepgram nova-3 is trained on 16kHz audio.
  // Browser default (48kHz) wastes 3x bandwidth and doesn't match the model.
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  if (ctx.state === 'suspended') await ctx.resume();
  const sr = ctx.sampleRate;

  let feedMode = dualMode ? 'dual' : 'single';
  let liveWs = null;
  let processor = null;
  let watchdog = null;
  let cancelPreviousBuffers = () => {};
  let closedByUser = false;
  let reconnectsLeft = MAX_RECONNECTS;
  let reconnectTimer = null;
  let lastAudioAt = 0;      // last moment real audio left the browser
  let graphRebuildsLeft = 5;
  const feedCounts = { mic: 0, customer: 0 };
  const dgRoleMap = new Map(); // Deepgram speaker id → 0 agent / 1 customer

  // Diarization ids are arbitrary — the agent opens the call, so whoever is
  // heard first is the agent and the other voice is the caller.
  const roleForDgSpeaker = (id) => {
    const raw = id ?? 0;
    if (!dgRoleMap.has(raw)) dgRoleMap.set(raw, dgRoleMap.size === 0 ? 0 : 1);
    return dgRoleMap.get(raw);
  };

  const open = (mode) => {
    // On a dual→single fallback, old final-chunk timers must not emit stale
    // fragments from the abandoned socket into the new live transcript.
    cancelPreviousBuffers();
    // Close the previous socket silently — no error banner, no duplicate save.
    if (liveWs) {
      const old = liveWs; liveWs = null;
      old.onopen = old.onmessage = old.onclose = old.onerror = null;
      try { old.close(); } catch {}
    }
    if (processor) { try { processor.disconnect(); } catch {} processor = null; }

    const dgParams = mode === 'dual'
      ? `model=nova-3&multichannel=true&channels=2&${COMMON_PARAMS}&sample_rate=${sr}&${DEBT_KEYTERMS}`
      : `model=nova-3&diarize=true&${COMMON_PARAMS}&sample_rate=${sr}&${DEBT_KEYTERMS}`;
    let wsEverOpen = false;
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${dgParams}`, ['token', dgKey]);
    ws.binaryType = 'arraybuffer';
    liveWs = ws;

    // Collect is_final chunks until speech_final, then emit one complete line.
    // Deepgram sends is_final mid-sentence; speech_final marks a real pause.
    const segBuf = {}; // per speaker: { text, sentiment, timer }
    cancelPreviousBuffers = () => Object.values(segBuf).forEach(b => clearTimeout(b.timer));
    // A final chunk is NOT necessarily the end of a sentence. Keep interim
    // previews instantaneous, but don't hand partial finals to Q&A until a
    // speech_final pause (or a safety timeout if Deepgram misses the endpoint).
    const FINAL_CHUNK_SAFETY_MS = 2400;
    const scheduleSafetyFlush = (speaker, b) => {
      clearTimeout(b.timer);
      b.timer = setTimeout(() => emitSegment(speaker), FINAL_CHUNK_SAFETY_MS);
    };
    const emitSegment = (speaker) => {
      const b = segBuf[speaker];
      if (!b || !b.text.trim()) { delete segBuf[speaker]; return; }
      clearTimeout(b.timer);
      onLine({ speaker, text: b.text.trim(), sentiment: b.sentiment, time: new Date().toISOString() });
      delete segBuf[speaker];
    };

    ws.onopen = () => {
      if (liveWs !== ws) return;
      wsEverOpen = true;
      onStatus('connected');
      // Refill the retry budget only once the connection has proved it holds,
      // so a socket that opens and instantly drops cannot loop forever.
      setTimeout(() => { if (!closedByUser && liveWs === ws) reconnectsLeft = MAX_RECONNECTS; }, 10000);
      onOpen?.();

      if (mode === 'dual') {
        // Keep the two selected inputs separate: agent left, customer right.
        const agentSrc = ctx.createMediaStreamSource(agentStream);
        const customerSrc = ctx.createMediaStreamSource(customerStream);
        const agentGainNode = ctx.createGain();
        agentGainNode.gain.value = agentGain;
        const customerGainNode = ctx.createGain();
        customerGainNode.gain.value = customerGain;
        const merger = ctx.createChannelMerger(2);
        agentSrc.connect(agentGainNode);
        agentGainNode.connect(merger, 0, 0);
        customerSrc.connect(customerGainNode);
        customerGainNode.connect(merger, 0, 1);
        const proc = ctx.createScriptProcessor(4096, 2, 2);
        processor = proc;

        proc.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const left = ev.inputBuffer.getChannelData(0);
          const right = ev.inputBuffer.getChannelData(1);
          const int16 = new Int16Array(left.length * 2);
          for (let i = 0; i < left.length; i++) {
            int16[i * 2] = Math.max(-1, Math.min(1, left[i])) * 0x7FFF;
            int16[i * 2 + 1] = Math.max(-1, Math.min(1, right[i])) * 0x7FFF;
          }
          ws.send(int16.buffer);
          lastAudioAt = Date.now();
        };
        merger.connect(proc);
        const silence = ctx.createGain(); silence.gain.value = 0;
        proc.connect(silence); silence.connect(ctx.destination);
      } else {
        // Single feed with diarization
        const source = ctx.createMediaStreamSource(agentStream);
        const agentGainNode = ctx.createGain();
        agentGainNode.gain.value = agentGain;
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        processor = proc;
        proc.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = ev.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
          ws.send(int16.buffer);
          lastAudioAt = Date.now();
        };
        source.connect(agentGainNode);
        agentGainNode.connect(proc);
        const silence = ctx.createGain(); silence.gain.value = 0;
        proc.connect(silence); silence.connect(ctx.destination);
      }
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'Results') return;
        const alt = msg.channel?.alternatives?.[0];
        // speech_final with empty transcript = natural pause → flush all pending segments
        if (!alt || !alt.transcript?.trim()) {
          if (msg.is_final && msg.speech_final) Object.keys(segBuf).forEach(k => emitSegment(Number(k)));
          return;
        }
        const channelNum = Array.isArray(msg.channel_index) ? msg.channel_index[0] : 0;
        const speaker = mode === 'dual' ? (channelNum === 0 ? 0 : 1) : roleForDgSpeaker(alt.words?.[0]?.speaker);

        // Which channel is actually carrying the call — drives the switch below.
        if (mode === 'dual' && msg.is_final) {
          if (channelNum === 0) feedCounts.mic++; else feedCounts.customer++;
        }

        // Speaker changed mid-buffer (single feed): flush the other speaker first
        Object.keys(segBuf).forEach(k => { if (Number(k) !== speaker) emitSegment(Number(k)); });

        if (msg.is_final) {
          // Finalized chunk — accumulate in segBuf
          const b = segBuf[speaker] || (segBuf[speaker] = { text: '', sentiment: null, timer: null });
          const chunk = alt.transcript.trim();
          if (chunk) {
            const acc = b.text.trim();
            if (!acc) {
              b.text = chunk;
            } else if (chunk.startsWith(acc)) {
              // Deepgram re-sent the full accumulated text — replace, don't append
              b.text = chunk;
            } else if (acc.endsWith(chunk)) {
              // Exact duplicate chunk — skip
            } else {
              b.text += ' ' + chunk;
            }
          }
          b.sentiment = msg.sentiment || alt.sentiment || b.sentiment;
          clearTimeout(b.timer);
          if (msg.speech_final) {
            emitSegment(speaker);
          } else {
            // Show the accumulated text so far as a live preview
            onInterim(speaker, b.text.trim());
            scheduleSafetyFlush(speaker, b); // safety only; transcript preview is already live
          }
        } else {
          // Interim result — show live partial text (accumulated + current partial)
          const b = segBuf[speaker];
          const accumulated = b ? b.text.trim() : '';
          onInterim(speaker, (accumulated + ' ' + alt.transcript).trim());
          // Ongoing interim speech means the caller is still expanding the
          // thought. Refresh the fallback timer; do not emit stale partials.
          if (b?.text && b?.timer) scheduleSafetyFlush(speaker, b);
        }
      } catch {}
    };

    ws.onclose = (e) => {
      // Flush any pending speech segments before anything else.
      Object.keys(segBuf).forEach(k => emitSegment(Number(k)));
      // The call is still going, so a socket that closes by itself must not end
      // the transcript. Reopen the same feed instead of silently going quiet —
      // this is what used to lose the rest of a live call.
      if (!closedByUser && reconnectsLeft > 0) {
        reconnectsLeft--;
        onStatus('reconnecting');
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!closedByUser && liveWs === ws) open(feedMode);
        }, RECONNECT_DELAY_MS);
        return;
      }
      onStatus('idle');
      onSocketClosed?.(e);
      if (e.code !== 1000 && e.code !== 1005) onError(`Deepgram disconnected (code ${e.code}). ${e.reason || ''}`);
    };

    ws.onerror = () => {
      onStatus('error');
      onError('Deepgram connection error — check API key.');
      if (!wsEverOpen) onCreditExhaustion?.('deepgram', 'WebSocket failed to connect — credits may be exhausted or API key invalid.');
    };
  };

  open(feedMode);

  // A quiet opening (nobody talks for 30s) must not burn the only check, so the
  // watch keeps re-arming until the customer channel proves it carries the call.
  let watchdogChecks = 0;
  const armWatchdog = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      watchdog = null;
      if (closedByUser || !liveWs) return;
      watchdogChecks++;
      if (feedMode === 'dual' && feedCounts.customer === 0 && feedCounts.mic >= MIN_MIC_LINES) {
        onError('No customer speech detected. Check the selected customer input; the app will not switch devices automatically.');
        return;
      }
      if (feedMode === 'dual' && watchdogChecks < WATCHDOG_CHECKS) armWatchdog();
    }, SILENT_CUSTOMER_AFTER_MS);
  };
  if (dualMode) armWatchdog();

  // Audio that stops leaving the browser is the silent killer: the socket stays
  // open, no error is raised, and the transcript simply stops mid-call. Watch the
  // outbound audio itself and rebuild the capture graph when it goes dead.
  const liveness = setInterval(() => {
    if (closedByUser || !liveWs || liveWs.readyState !== WebSocket.OPEN) return;
    if (!lastAudioAt || Date.now() - lastAudioAt < 12000) return;
    if (graphRebuildsLeft <= 0) return;
    graphRebuildsLeft--;
    lastAudioAt = Date.now();
    open(feedMode);
  }, 12000);

  // A backgrounded tab can suspend the audio graph, which stops the transcript
  // with no error at all. Wake it the moment the operator comes back.
  const resumeAudio = () => {
    if (closedByUser) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('visibilitychange', resumeAudio);
  window.addEventListener('focus', resumeAudio);

  return {
    ctx,
    close() {
      closedByUser = true;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      clearInterval(liveness);
      document.removeEventListener('visibilitychange', resumeAudio);
      window.removeEventListener('focus', resumeAudio);
      if (liveWs) { try { liveWs.close(); } catch {} }
      if (processor) { try { processor.disconnect(); } catch {} processor = null; }
    },
  };
}