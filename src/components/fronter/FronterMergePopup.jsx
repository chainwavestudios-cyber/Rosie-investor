/**
 * FronterMergePopup.jsx — Manual transfer/merge popup shown when all checklist
 * items are complete.
 *
 * Flow (fronter-driven, no auto-detection):
 *   1. The remaining script (below @@COMPLETED_STEPS@@) is displayed so the
 *      fronter can read it to the customer and complete the final steps.
 *   2. When ready, the fronter presses "📞 Dial Chris" — the customer is placed
 *      on hold in the queue while Chris is dialed on his first number.
 *   3. When Chris answers (call status = in-progress), the popup transitions to
 *      "connected" and shows "🔀 Merge & Transfer" + "📞 Hangup & Try 2nd Line".
 *   4. If the fronter hears voicemail or wants the other line, they press
 *      "Hangup & Try 2nd Line" — the current agent call is cancelled, the
 *      customer stays on hold, and Chris's 2nd number is dialed.
 *   5. When the 2nd number answers, the fronter can "Merge & Transfer" or
 *      "NO CONNECT". No 3rd number — the fronter decides.
 *   6. NO CONNECT: disconnects the fronter while leaving the customer on hold
 *      in the queue. The parent sets disposition to "queued_no_connect",
 *      migrates the prospect to lead status, and pulls up the next prospect.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import { renderFormatted } from '@/components/debt/ScriptRichText';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';

const CHRIS_NUMBERS = ['+16193530919', '+12162586934'];
const CHRIS_LABELS = ['619-353-0919', '216-258-6934'];

const DEFAULT_MERGE_SCRIPT = `Alright {{first name}}, I've got a senior debt advisor ready to help you through this. I'm going to connect you now — stay on the line and they'll be right with you.`;

export default function FronterMergePopup({ lead, username, fronterFirstName, isAdmin, callActive, callDuration, callSid, lineKey, onMerge, onNoConnect, onClose, transferScript }) {
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const [mergeState, setMergeState] = useState('idle'); // idle | dialing | connected | merging | done | failed | no_answer
  const [conferenceName, setConferenceName] = useState('');
  const [agentCallSid, setAgentCallSid] = useState('');
  const [currentNumberIdx, setCurrentNumberIdx] = useState(0);
  const [error, setError] = useState('');
  const [dialingMsg, setDialingMsg] = useState('');
  const pollTimerRef = useRef(null);

  const loadScript = useCallback(async () => {
    if (transferScript) { setScript({ content: transferScript }); setLoading(false); return; }
    try {
      const results = await base44.entities.FronterScript.filter({ name: '🔀 Merge Call Script' });
      const all = Array.isArray(results) ? results : (results?.items || []);
      const existing = all[0];
      if (existing) {
        setScript(existing);
      } else {
        const created = await base44.entities.FronterScript.create({
          name: '🔀 Merge Call Script', scriptType: 'close', content: DEFAULT_MERGE_SCRIPT,
          color: '#e8e0d0', fontSize: 16, sortOrder: 999,
        });
        setScript(created);
      }
    } catch (e) { console.error('Merge script load:', e); }
    setLoading(false);
  }, [transferScript]);

  useEffect(() => { loadScript(); }, [loadScript]);

  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  const handleSave = async () => {
    if (!script) return;
    setSaving(true);
    try {
      await base44.entities.FronterScript.update(script.id, { content: editText });
      setScript(prev => ({ ...prev, content: editText }));
      setEditMode(false);
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const clearPoll = () => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  };

  // ── Dial Chris on a specific number index ──
  const dialChris = async (numberIdx) => {
    if (!callSid || !callActive || !lineKey) { setError('No active call. Start a call from the contact card first.'); return; }
    setMergeState('dialing');
    setError('');
    const number = CHRIS_NUMBERS[numberIdx];
    const label = CHRIS_LABELS[numberIdx];
    setDialingMsg(`Dialing Chris on ${label}…`);

    try {
      const res = await base44.functions.invoke('fronterCall', {
        action: 'mergeDial',
        fronterCallSid: callSid,
        agentPhone: number,
        lineKey,
        leadId: lead?.id,
        leadEmail: lead?.email,
      });
      const data = res?.data || res;
      if (data?.conferenceName) {
        setConferenceName(data.conferenceName);
        setAgentCallSid(data.agentCallSid || '');
        setDialingMsg(`Dialing Chris on ${label}… waiting for answer`);

        // Poll the agent call status to detect when Chris answers.
        // No machine detection — the fronter listens and decides manually.
        const agentSid = data.agentCallSid || '';
        if (agentSid) {
          let wasInProgress = false;
          pollTimerRef.current = setInterval(async () => {
            try {
              const statusRes = await base44.functions.invoke('fronterCall', { action: 'getAgentCallStatus', agentCallSid: agentSid });
              const statusData = statusRes?.data || statusRes;
              const st = statusData?.status || '';
              // Human answered — transition to connected so the fronter can merge or try next
              if (st === 'in-progress') {
                wasInProgress = true;
                clearPoll();
                setMergeState('connected');
                setDialingMsg('✓ Chris answered on ' + label);
              }
              // Call ended without a human answer — no answer or busy
              if (wasInProgress) {
                // Was connected but now ended — Chris hung up
                if (st === 'completed') {
                  clearPoll();
                  setMergeState('no_answer');
                  setDialingMsg('Chris hung up on ' + label);
                }
              } else if (st === 'no-answer' || st === 'busy' || st === 'failed' || st === 'canceled') {
                clearPoll();
                setMergeState('no_answer');
                setDialingMsg('No answer on ' + label);
              }
            } catch {}
          }, 2000);
        }
      } else {
        setMergeState('failed');
        setDialingMsg('');
        setError('Could not start the merge — no conference created.');
      }
    } catch (e) {
      setMergeState('failed');
      setDialingMsg('');
      setError('Merge dial failed: ' + (e?.message || String(e)));
    }
  };

  // ── Hangup & Try Next Line: cancel current agent call, dial next number ──
  // Customer stays on hold in the queue. Fronter drives this manually.
  const handleHangupTryNext = async () => {
    clearPoll();
    setDialingMsg('');

    // Cancel the current agent call
    if (agentCallSid) {
      try {
        await base44.functions.invoke('fronterCall', { action: 'cancelAgentCall', agentCallSid });
      } catch {}
    }

    const nextIdx = currentNumberIdx + 1;
    if (nextIdx < CHRIS_NUMBERS.length) {
      setCurrentNumberIdx(nextIdx);
      setDialingMsg(`Hanging up ${CHRIS_LABELS[currentNumberIdx]} — trying ${CHRIS_LABELS[nextIdx]}…`);
      setMergeState('idle');
      setTimeout(() => dialChris(nextIdx), 1000);
    } else {
      setMergeState('no_answer');
      setDialingMsg('');
    }
  };

  // ── Fronter initiates the dial to Chris (starts with first number) ──
  const handleDialChris = () => {
    if (mergeState !== 'idle') return;
    setCurrentNumberIdx(0);
    dialChris(0);
  };

  // ── Fronter confirms Chris answered and wants to merge ──
  const handleMergeTransfer = async () => {
    clearPoll();
    setMergeState('merging');
    setError('');
    try {
      await base44.functions.invoke('fronterCall', { action: 'mergeConnect', conferenceName, fronterCallSid: callSid });
      setMergeState('done');
      onMerge?.();
    } catch (e) {
      setMergeState('connected');
      setError('Connect failed: ' + (e?.message || String(e)));
    }
  };

  // ── NO CONNECT: leave customer in queue, disconnect fronter ──
  const handleNoConnect = async () => {
    clearPoll();
    setError('');
    try {
      await base44.functions.invoke('fronterCall', { action: 'noConnect', conferenceName, fronterCallSid: callSid, agentCallSid });
      setMergeState('done');
      onNoConnect?.();
    } catch (e) {
      setError('NO CONNECT failed: ' + (e?.message || String(e)));
    }
  };

  const fmtDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const canDial = mergeState === 'idle' && callSid && callActive && lineKey;
  const canMerge = mergeState === 'connected';
  const canNoConnect = mergeState === 'connected' || mergeState === 'dialing' || mergeState === 'no_answer';
  const canTryNext = (mergeState === 'connected' || mergeState === 'no_answer') && currentNumberIdx < CHRIS_NUMBERS.length - 1;
  const isLastNumber = currentNumberIdx >= CHRIS_NUMBERS.length - 1;

  return (
    <FronterPopup title="🔀 Merge Call" subtitle="Complete the steps, then connect" accent={GOLD} onClose={onClose} initialSize={{ w: 520, h: 680 }} minW={380} minH={480} zIndex={11000}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Compact call + Chris status strip */}
        <div style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, padding: '8px 12px', background: callActive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${callActive ? GOLD + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px' }}>
            <div style={{ color: callActive ? GOLD : '#6b7280', fontSize: '10px', fontWeight: 'bold' }}>{callActive ? '📞 Call Active' : '📞 No Call'}</div>
            {callActive && <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtDuration(callDuration)}</div>}
          </div>
          <div style={{ flex: 1, padding: '8px 12px', background: mergeState === 'no_answer' ? 'rgba(239,68,68,0.08)' : mergeState === 'dialing' ? 'rgba(96,165,250,0.06)' : mergeState === 'connected' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${mergeState === 'no_answer' ? 'rgba(239,68,68,0.3)' : mergeState === 'dialing' ? 'rgba(96,165,250,0.25)' : mergeState === 'connected' ? GOLD + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px' }}>
            <div style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>Chris Bongiorno</div>
            <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '2px' }}>
              {mergeState === 'dialing' ? `📞 ${CHRIS_LABELS[currentNumberIdx]}` : mergeState === 'connected' ? '✓ Connected' : mergeState === 'no_answer' ? '⚠ Unavailable' : `${CHRIS_LABELS.join(' · ')}`}
            </div>
          </div>
        </div>

        {/* Remaining script — the fronter reads this to the customer first */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '12px', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Remaining Script — Read to Customer</span>
            {isAdmin && !editMode && (
              <button onClick={() => { setEditText(script?.content || ''); setEditMode(true); }} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✏️ Edit</button>
            )}
            {editMode && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{saving ? '⏳' : '💾 Save'}</button>
                <button onClick={() => setEditMode(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
              </div>
            )}
          </div>
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading…</div>
          ) : editMode ? (
            <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1, width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '14px', color: '#e8e0d0', fontSize: '15px', lineHeight: 1.7, fontFamily: 'Georgia, serif', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '16px' }}>
              <div style={{ color: '#e8e0d0', fontSize: '16px', lineHeight: 1.9, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
                {renderFormatted(substituteScriptVars(script?.content || DEFAULT_MERGE_SCRIPT, { lead, fronterFirstName }))}
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {error}</div>}
        {dialingMsg && <div style={{ color: BLUE, fontSize: '11px', marginBottom: '8px' }}>⏳ {dialingMsg}</div>}

        {/* Chris isn't available popup — shown when all numbers exhausted */}
        {mergeState === 'no_answer' && isLastNumber && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '14px', marginBottom: '10px', textAlign: 'center' }}>
            <div style={{ color: RED, fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>⚠ Chris Isn't Available</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px' }}>Both numbers have been tried. The customer is still on hold in the queue.</div>
          </div>
        )}

        {/* Phone controls — fronter drives the flow manually */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mergeState === 'idle' && (
            <button
              onClick={handleDialChris}
              disabled={!canDial}
              style={{
                width: '100%',
                background: canDial ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(255,255,255,0.05)',
                color: canDial ? DARK : '#6b7280',
                border: 'none',
                borderRadius: '6px',
                padding: '14px',
                cursor: canDial ? 'pointer' : 'not-allowed',
                fontSize: '15px',
                fontWeight: 'bold',
                opacity: canDial ? 1 : 0.5,
              }}
            >
              📞 Dial Chris Bongiorno
            </button>
          )}
          {mergeState === 'dialing' && (
            <button disabled style={{ width: '100%', background: 'rgba(96,165,250,0.15)', color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '6px', padding: '14px', fontSize: '15px', fontWeight: 'bold', cursor: 'wait' }}>
              ⏳ Dialing Chris on {CHRIS_LABELS[currentNumberIdx]}…
            </button>
          )}
          {(mergeState === 'connected' || mergeState === 'merging') && (
            <>
              <button
                onClick={handleMergeTransfer}
                disabled={!canMerge}
                style={{
                  width: '100%',
                  background: canMerge ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(255,255,255,0.05)',
                  color: canMerge ? DARK : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '14px',
                  cursor: canMerge ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  opacity: canMerge ? 1 : 0.5,
                }}
              >
                {mergeState === 'merging' ? '⏳ Bridging…' : '🔀 Merge & Transfer'}
              </button>
              {/* Hangup & Try 2nd Line — only on the 1st number, next to Merge */}
              {canTryNext && (
                <button
                  onClick={handleHangupTryNext}
                  style={{
                    width: '100%',
                    background: 'rgba(245,158,11,0.15)',
                    color: AMBER,
                    border: '1px solid rgba(245,158,11,0.4)',
                    borderRadius: '6px',
                    padding: '12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                  }}
                >
                  📞 Hangup & Try 2nd Line ({CHRIS_LABELS[currentNumberIdx + 1]})
                </button>
              )}
            </>
          )}
          {mergeState === 'done' && (
            <div style={{ width: '100%', textAlign: 'center', background: 'rgba(16,185,129,0.12)', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '14px', fontSize: '15px', fontWeight: 'bold' }}>✓ Transfer Complete</div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleNoConnect}
              disabled={!canNoConnect}
              style={{
                flex: 1,
                background: 'rgba(239,68,68,0.15)',
                color: RED,
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '6px',
                padding: '12px',
                cursor: canNoConnect ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: 'bold',
                opacity: canNoConnect ? 1 : 0.5,
              }}
            >
              🚫 NO CONNECT
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                color: '#6b7280',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '12px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              Close
            </button>
          </div>
          {mergeState === 'idle' && !canDial && (
            <div style={{ color: '#f59e0b', fontSize: '11px', textAlign: 'center' }}>
              {!callActive ? 'Start a call from the contact card first.' : 'Waiting for call details…'}
            </div>
          )}
          {mergeState === 'connected' && !isLastNumber && (
            <div style={{ color: GOLD, fontSize: '11px', textAlign: 'center' }}>✓ Chris is connected on {CHRIS_LABELS[currentNumberIdx]}. Merge & Transfer, or Hangup & Try 2nd Line if this is voicemail.</div>
          )}
          {mergeState === 'connected' && isLastNumber && (
            <div style={{ color: GOLD, fontSize: '11px', textAlign: 'center' }}>✓ Chris is connected on {CHRIS_LABELS[currentNumberIdx]}. Merge & Transfer or NO CONNECT.</div>
          )}
          {mergeState === 'no_answer' && canTryNext && (
            <div style={{ color: AMBER, fontSize: '11px', textAlign: 'center' }}>No answer on {CHRIS_LABELS[currentNumberIdx]}. Try the 2nd line or NO CONNECT.</div>
          )}
        </div>
      </div>
    </FronterPopup>
  );
}