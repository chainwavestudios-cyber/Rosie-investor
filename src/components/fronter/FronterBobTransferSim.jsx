/**
 * FronterBobTransferSim.jsx — Simulated transfer/merge popup for BOB training.
 *
 * Mirrors FronterMergePopup's flow exactly, but nothing leaves the browser:
 *   1. The remaining script (below @@COMPLETED_STEPS@@) is shown with the same
 *      Debt Confirm / AI Input / Send Credentials & Welcome Message buttons.
 *   2. "Dial Chris Bongiorno" puts BOB on hold in the transfer queue (the queue
 *      hold recording plays) and dials line 1 — Chris answers, or not, at random.
 *   3. No answer → BOB stays on hold and the fronter can try the 2nd line.
 *   4. Chris answers → his ElevenLabs voice plays, and the fronter can
 *      Merge & Transfer, or Hangup & Try 2nd Line when it's voicemail.
 *   5. Both lines exhausted → NO CONNECT: BOB stays queued and training returns
 *      to the dialer so the fronter can dial the next BOB.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import FronterPopup from './FronterPopup';
import FronterContactScript from './FronterContactScript';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';

// The advisor voice on the other end of the merge (ElevenLabs).
export const SIM_ADVISOR_VOICE_ID = 'Eplk91Ni9sYpeRifZStQ';
const ANSWER_LINES = ['Hey, what do you got?', 'Yeah, go ahead — who am I speaking with?'];
const MERGE_LINES = ["Alright, you're connected. Bring them in.", "Got it, I'll take it from here."];
const ANSWER_CHANCE = 0.5;
const DEFAULT_MERGE_SCRIPT = `Alright {{first name}}, I've got a senior debt advisor ready to help you through this. I'm going to connect you now — stay on the line and they'll be right with you.`;

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function FronterBobTransferSim({
  remainingScript, customerName, fronterFirstName, numbers, labels, callActive,
  onDebtConfirm, debtConfirming, onAiInput, aiInputRunning, onSendEmail, message,
  onMerge, onNoConnect, onClose,
}) {
  const [mergeState, setMergeState] = useState('idle'); // idle | dialing | connected | merging | done | no_answer
  const [numberIdx, setNumberIdx] = useState(0);
  const [dialingMsg, setDialingMsg] = useState('');
  const [chrisSaid, setChrisSaid] = useState('');
  const [chrisClipUrl, setChrisClipUrl] = useState('');
  const [outcome, setOutcome] = useState('');
  const [seconds, setSeconds] = useState(0);

  const holdRef = useRef(null);
  const chrisRef = useRef(null);
  const dialTimerRef = useRef(null);
  const endTimerRef = useRef(null);

  // Call timer, for the "call active" strip
  useEffect(() => {
    if (!callActive) return;
    const iv = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [callActive]);

  const stopHold = useCallback(() => {
    if (holdRef.current) { try { holdRef.current.pause(); } catch {} holdRef.current = null; }
  }, []);

  // The customer waits in the queue on the same hold recording the live merge uses.
  const startHold = useCallback(async () => {
    if (holdRef.current) return;
    try {
      let url = '';
      const queue = await base44.entities.InboundCallAudio.filter({ assetType: 'adam_transfer_hold', isActive: true }, '-uploadedAt', 1);
      url = (queue?.[0] || queue?.items?.[0])?.fileUrl || '';
      if (!url) {
        const page = await base44.entities.FronterHoldAudio.filter({ isActive: true }, { sort: '-uploadedAt', limit: 1 });
        const fileUri = page?.items?.[0]?.fileUri;
        if (fileUri) {
          const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 900 });
          url = signed?.signed_url || '';
        }
      }
      if (!url) return;
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.55;
      holdRef.current = audio;
      await audio.play().catch(() => {});
    } catch {}
  }, []);

  // Chris's side of the call, spoken by his ElevenLabs voice.
  const speakChris = useCallback(async (text) => {
    setChrisSaid(text);
    try {
      const res = await base44.functions.invoke('elevenLabsClip', { text, voiceId: SIM_ADVISOR_VOICE_ID, keyPrefix: 'bobsim' });
      const url = res?.data?.audioUrl || res?.audioUrl || '';
      if (!url) return;
      setChrisClipUrl(url);
      if (chrisRef.current) { try { chrisRef.current.pause(); } catch {} }
      const audio = new Audio(url);
      audio.volume = 0.95;
      chrisRef.current = audio;
      await audio.play().catch(() => {});
    } catch (e) {
      console.warn('[BOB sim] advisor voice failed:', e?.message);
    }
  }, []);

  const dial = useCallback((idx) => {
    setNumberIdx(idx);
    setMergeState('dialing');
    setDialingMsg(`Dialing Chris on ${labels[idx]}…`);
    setChrisSaid('');
    startHold();
    const wait = 2600 + Math.random() * 2200;
    dialTimerRef.current = setTimeout(() => {
      if (Math.random() < ANSWER_CHANCE) {
        stopHold();
        setMergeState('connected');
        setDialingMsg(`✓ Chris answered on ${labels[idx]}`);
        speakChris(pick(ANSWER_LINES));
      } else {
        setMergeState('no_answer');
        setDialingMsg(`No answer on ${labels[idx]} — BOB is still on hold in the queue.`);
      }
    }, wait);
  }, [labels, startHold, stopHold, speakChris]);

  const handleDialChris = () => {
    if (mergeState !== 'idle') return;
    dial(0);
  };

  const handleTryNext = () => {
    if (dialTimerRef.current) { clearTimeout(dialTimerRef.current); dialTimerRef.current = null; }
    if (chrisRef.current) { try { chrisRef.current.pause(); } catch {} }
    setDialingMsg(`Hanging up ${labels[numberIdx]} — trying ${labels[numberIdx + 1]}…`);
    setMergeState('idle');
    setTimeout(() => dial(numberIdx + 1), 900);
  };

  const handleMerge = () => {
    if (dialTimerRef.current) { clearTimeout(dialTimerRef.current); dialTimerRef.current = null; }
    stopHold();
    setMergeState('merging');
    setDialingMsg('');
    setTimeout(() => {
      setMergeState('done');
      setOutcome('merged');
      speakChris(pick(MERGE_LINES));
      endTimerRef.current = setTimeout(() => onMerge?.(), 2400);
    }, 900);
  };

  const handleNoConnect = () => {
    if (dialTimerRef.current) { clearTimeout(dialTimerRef.current); dialTimerRef.current = null; }
    if (chrisRef.current) { try { chrisRef.current.pause(); } catch {} }
    stopHold();
    setMergeState('done');
    setOutcome('no_connect');
    endTimerRef.current = setTimeout(() => onNoConnect?.(), 2200);
  };

  // Clean up every timer and audio on unmount / close
  const handleClose = useCallback(() => {
    if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    stopHold();
    if (chrisRef.current) { try { chrisRef.current.pause(); } catch {} }
    onClose?.();
  }, [stopHold, onClose]);

  useEffect(() => () => {
    if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    if (holdRef.current) { try { holdRef.current.pause(); } catch {} }
    if (chrisRef.current) { try { chrisRef.current.pause(); } catch {} }
  }, []);

  const fmtDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Same parsing as FronterMergePopup — the remaining script keeps its live buttons
  const rawScript = remainingScript || DEFAULT_MERGE_SCRIPT;
  const substituted = substituteScriptVars(rawScript, { lead: { firstName: customerName }, fronterFirstName });
  const displayScript = substituted.replace(/\[\[AI:\w+\]\]/gi, '');
  const segments = displayScript.split(/@@(DEBT_CONFIRM|AI_INPUT|SEND_EMAIL)@@/i);
  const simScripts = [{ id: 'merge-sim', name: 'Merge Call', content: remainingScript || DEFAULT_MERGE_SCRIPT }];

  const isLastNumber = numberIdx >= numbers.length - 1;
  const onHold = mergeState === 'dialing' || mergeState === 'no_answer';

  return (
    <FronterPopup
      title="🔀 Merge Call — Training"
      subtitle="Simulated transfer — complete the steps, then connect"
      accent={GOLD}
      onClose={handleClose}
      initialPos={{ x: 220, y: 60 }}
      initialSize={{ w: 540, h: 700 }}
      minW={400}
      minH={480}
      zIndex={21000}
    >
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Call + advisor status strip */}
        <div style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, padding: '8px 12px', background: callActive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${callActive ? GOLD + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px' }}>
            <div style={{ color: callActive ? GOLD : '#6b7280', fontSize: '10px', fontWeight: 'bold' }}>{callActive ? '📞 BOB Call Active' : '📞 No Call'}</div>
            {callActive && <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtDuration(seconds)}</div>}
          </div>
          <div style={{ flex: 1, padding: '8px 12px', background: mergeState === 'no_answer' ? 'rgba(239,68,68,0.08)' : mergeState === 'dialing' ? 'rgba(96,165,250,0.06)' : mergeState === 'connected' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${mergeState === 'no_answer' ? 'rgba(239,68,68,0.3)' : mergeState === 'dialing' ? 'rgba(96,165,250,0.25)' : mergeState === 'connected' ? GOLD + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px' }}>
            <div style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>Chris Bongiorno</div>
            <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '2px' }}>
              {mergeState === 'dialing' ? `📞 ${labels[numberIdx]}` : mergeState === 'connected' ? '✓ Connected' : mergeState === 'no_answer' ? '⚠ Unavailable' : labels.join(' · ')}
            </div>
          </div>
        </div>

        {onHold && (
          <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: BLUE, fontSize: '12px', animation: 'pulse 1.6s infinite' }}>🔊</span>
            <span style={{ color: BLUE, fontSize: '11px' }}>BOB is on hold in the transfer queue — playing the queue hold recording.</span>
          </div>
        )}

        {/* Remaining script — the fronter reads this to BOB */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '12px', minHeight: 0, background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Remaining Script — Read to BOB</span>
          </div>
          <FronterContactScript
            scripts={simScripts}
            activeScript={simScripts[0]}
            onSelectScript={() => {}}
            segments={segments}
            hasCompletedSteps={false}
            onComplete={() => {}}
            onDebtConfirm={onDebtConfirm}
            debtConfirming={debtConfirming}
            onAiInput={onAiInput}
            aiInputRunning={aiInputRunning}
            onSendEmail={onSendEmail}
            message={message}
          />
        </div>

        {chrisSaid && (
          <div style={{ marginBottom: '8px', padding: '8px 12px', background: 'rgba(16,185,129,0.06)', border: `1px solid ${GOLD}33`, borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold' }}>🔊 Chris:</span>
            <span style={{ color: '#c4cdd8', fontSize: '11px', flex: 1, fontStyle: 'italic' }}>"{chrisSaid}"</span>
            {chrisClipUrl && (
              <button onClick={() => { const a = new Audio(chrisClipUrl); a.volume = 0.95; a.play().catch(() => {}); }} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>▶ Replay</button>
            )}
          </div>
        )}

        {dialingMsg && <div style={{ color: mergeState === 'no_answer' ? AMBER : BLUE, fontSize: '11px', marginBottom: '8px' }}>{dialingMsg}</div>}

        {mergeState === 'no_answer' && isLastNumber && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '12px', marginBottom: '10px', textAlign: 'center' }}>
            <div style={{ color: RED, fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>⚠ Chris Isn't Available</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px' }}>Both lines have been tried. BOB is still on hold in the queue.</div>
          </div>
        )}

        {mergeState === 'done' && (
          <div style={{ background: outcome === 'merged' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${outcome === 'merged' ? GOLD + '44' : 'rgba(239,68,68,0.3)'}`, borderRadius: '6px', padding: '12px', marginBottom: '10px', textAlign: 'center' }}>
            <div style={{ color: outcome === 'merged' ? GOLD : RED, fontSize: '14px', fontWeight: 'bold' }}>
              {outcome === 'merged' ? '✓ Transfer Complete' : '🚫 NO CONNECT'}
            </div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '4px' }}>
              {outcome === 'merged' ? 'BOB is connected with Chris.' : 'BOB stays on hold in the transfer queue.'}
            </div>
          </div>
        )}

        {/* Phone controls — the fronter drives the flow, exactly like the live merge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mergeState === 'idle' && (
            <button
              onClick={handleDialChris}
              disabled={!callActive}
              style={{ width: '100%', background: callActive ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(255,255,255,0.05)', color: callActive ? DARK : '#6b7280', border: 'none', borderRadius: '6px', padding: '14px', cursor: callActive ? 'pointer' : 'not-allowed', fontSize: '15px', fontWeight: 'bold', opacity: callActive ? 1 : 0.5 }}
            >
              📞 Dial Chris Bongiorno
            </button>
          )}
          {mergeState === 'dialing' && (
            <button disabled style={{ width: '100%', background: 'rgba(96,165,250,0.15)', color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '6px', padding: '14px', fontSize: '15px', fontWeight: 'bold', cursor: 'wait' }}>
              ⏳ Dialing Chris on {labels[numberIdx]}…
            </button>
          )}
          {mergeState === 'no_answer' && !isLastNumber && (
            <button onClick={handleTryNext} style={{ width: '100%', background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '13px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              📞 Hangup &amp; Try 2nd Line ({labels[numberIdx + 1]})
            </button>
          )}
          {(mergeState === 'connected' || mergeState === 'merging') && (
            <>
              <button
                onClick={handleMerge}
                disabled={mergeState === 'merging'}
                style={{ width: '100%', background: mergeState === 'merging' ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${GOLD},#22c55e)`, color: mergeState === 'merging' ? '#6b7280' : DARK, border: 'none', borderRadius: '6px', padding: '14px', cursor: mergeState === 'merging' ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 'bold' }}
              >
                {mergeState === 'merging' ? '⏳ Bridging…' : '🔀 Merge & Transfer'}
              </button>
              {!isLastNumber && (
                <button onClick={handleTryNext} style={{ width: '100%', background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  📞 Hangup &amp; Try 2nd Line ({labels[numberIdx + 1]})
                </button>
              )}
            </>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleNoConnect}
              disabled={mergeState === 'idle' || mergeState === 'done'}
              style={{ flex: 1, background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '12px', cursor: (mergeState === 'idle' || mergeState === 'done') ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: (mergeState === 'idle' || mergeState === 'done') ? 0.5 : 1 }}
            >
              🚫 NO CONNECT
            </button>
            <button onClick={handleClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Close</button>
          </div>
          {mergeState === 'idle' && !callActive && (
            <div style={{ color: AMBER, fontSize: '11px', textAlign: 'center' }}>Start a BOB call first.</div>
          )}
          {mergeState === 'connected' && (
            <div style={{ color: GOLD, fontSize: '11px', textAlign: 'center' }}>
              ✓ Chris is connected on {labels[numberIdx]}. Merge &amp; Transfer, or Hangup &amp; Try 2nd Line if this is voicemail.
            </div>
          )}
          {mergeState === 'no_answer' && !isLastNumber && (
            <div style={{ color: AMBER, fontSize: '11px', textAlign: 'center' }}>No answer on {labels[numberIdx]}. Try the 2nd line, or NO CONNECT.</div>
          )}
        </div>
      </div>
    </FronterPopup>
  );
}