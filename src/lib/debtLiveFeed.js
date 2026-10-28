// Live call audio → Deepgram transcript feed.
//
// Two feeds are possible:
//  • dual   — mic on channel 0 (agent), the customer device on channel 1 (caller).
//  • single — one feed, Deepgram separates the voices itself (diarization).
//
// Dual only makes sense when the customer device really carries the caller. A dead
// customer slot (a Stereo Mix with nothing playing, a phone heard only through the
// room mic) leaves BOTH voices on the mic — and channel mapping then files the
// caller's words under the agent while the agent is never separated out at all.
// So the feed is watched: if the customer channel stays silent while the mic carries
// speech, the transcript re-opens in single-feed mode and the voices are separated
// by speaker instead of by channel.
import { createBleedSuppressor } from '@/lib/audioBleedSuppressor';

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
      onOpen?.();

      if (mode === 'dual') {
        // Multichannel: channel 0 = agent (left), channel 1 = customer (right).
        // Agent mic captures with echoCancellation enabled to reduce speaker
        // bleed; the agent channel stays live at all times so the agent can
        // speak over the customer when needed (no auto-muting gate).
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
        // Speaker bleed: the caller's voice plays out of the speakers and the mic
        // hears it, so the clean Stereo Mix channel is used as the reference and
        // the bleed is stripped off the agent channel before it goes to Deepgram.
        const suppressBleed = createBleedSuppressor();
        proc.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const left = ev.inputBuffer.getChannelData(0);
          const right = ev.inputBuffer.getChannelData(1);
          suppressBleed(left, right);
          const int16 = new Int16Array(left.length * 2);
          for (let i = 0; i < left.length; i++) {
            int16[i * 2] = Math.max(-1, Math.min(1, left[i])) * 0x7FFF;
            int16[i * 2 + 1] = Math.max(-1, Math.min(1, right[i])) * 0x7FFF;
          }
          ws.send(int16.buffer);
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
      // Flush any pending speech segments before the final save
      Object.keys(segBuf).forEach(k => emitSegment(Number(k)));
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

  if (dualMode) {
    watchdog = setTimeout(() => {
      if (!liveWs) return;
      if (feedCounts.customer !== 0 || feedCounts.mic < MIN_MIC_LINES) return;
      // Only the mic is carrying the call — separate the voices by speaker.
      feedMode = 'single';
      open('single');
    }, SILENT_CUSTOMER_AFTER_MS);
  }

  return {
    ctx,
    close() {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      if (liveWs) { try { liveWs.close(); } catch {} }
      if (processor) { try { processor.disconnect(); } catch {} processor = null; }
    },
  };
}