/**
 * FronterMergePopup.jsx — Transfer/merge popup shown when all checklist items are complete.
 *
 * Flow:
 *   1. Resolves Chris Bongiorno's assigned Twilio line (FronterLineAssignment username ~ "chris").
 *   2. Auto-dials Chris (mergeDial): customer is placed on hold in the queue with custom hold
 *      music while the fronter's leg stays in the conference to talk to Chris.
 *   3. When Chris answers, the fronter presses "Merge & Transfer" (mergeConnect) to bridge
 *      Chris + customer, remove the fronter's leg, mark the lead transferred, and advance.
 *   4. If Chris can't be reached, the fronter presses "NO CONNECT" (noConnect) to disconnect
 *      from the customer while leaving the customer on hold in the queue, then advance to the
 *      next prospect (the parent rotates to the first unassigned line).
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import { renderFormatted } from '@/components/debt/ScriptRichText';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';

const DEFAULT_MERGE_SCRIPT = `Alright {{firstname}}, I've got a senior debt advisor ready to help you through this. I'm going to connect you now — stay on the line and they'll be right with you.`;

export default function FronterMergePopup({ lead, username, fronterFirstName, isAdmin, callActive, callDuration, callSid, lineKey, onMerge, onNoConnect, onClose, transferScript }) {
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const [chrisLine, setChrisLine] = useState(null);
  const [resolvingChris, setResolvingChris] = useState(true);
  const [mergeState, setMergeState] = useState('idle'); // idle | dialing | connected | merging | done | failed
  const [conferenceName, setConferenceName] = useState('');
  const [agentCallSid, setAgentCallSid] = useState('');
  const [error, setError] = useState('');

  // Resolve Chris Bongiorno's assigned Twilio line
  useEffect(() => {
    const resolve = async () => {
      try {
        const assignments = await base44.entities.FronterLineAssignment.list('-assignedAt', 100);
        const chris = (assignments || []).find(a => (a.username || '').toLowerCase() === 'chris');
        setChrisLine(chris || null);
      } catch {}
      setResolvingChris(false);
    };
    resolve();
  }, []);

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

  // Auto-trigger mergeDial once we have Chris's line + the active call SID
  useEffect(() => {
    if (mergeState !== 'idle') return;
    if (resolvingChris) return;
    if (!chrisLine?.twilioNumber) return;
    if (!callSid || !callActive || !lineKey) return;
    const trigger = async () => {
      setMergeState('dialing');
      setError('');
      try {
        const res = await base44.functions.invoke('fronterCall', {
          action: 'mergeDial',
          fronterCallSid: callSid,
          agentPhone: chrisLine.twilioNumber,
          lineKey,
          leadId: lead?.id,
          leadEmail: lead?.email,
        });
        const data = res?.data || res;
        if (data?.conferenceName) {
          setConferenceName(data.conferenceName);
          setAgentCallSid(data.agentCallSid || '');
          setMergeState('connected');
        } else {
          setMergeState('failed');
          setError('Could not start the merge — no conference created.');
        }
      } catch (e) {
        setMergeState('failed');
        setError('Merge dial failed: ' + (e?.message || String(e)));
      }
    };
    trigger();
  }, [chrisLine, callSid, callActive, lineKey, mergeState, resolvingChris, lead?.id, lead?.email]);

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

  const handleMergeTransfer = async () => {
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

  const handleNoConnect = async () => {
    if (!window.confirm(`NO CONNECT — disconnect from ${lead?.firstName || 'this customer'} but leave them on hold in the queue?`)) return;
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

  const blockedNoCall = !resolvingChris && chrisLine && (!callSid || !callActive);
  const canMerge = mergeState === 'connected';
  const canNoConnect = mergeState === 'connected' || mergeState === 'dialing';

  return (
    <FronterPopup title="🔀 Merge Call" subtitle="All checklist items complete" accent={GOLD} onClose={onClose} initialSize={{ w: 480, h: 620 }} minW={360} minH={420} zIndex={10500}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Call status */}
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: callActive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${callActive ? GOLD + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: callActive ? GOLD : '#6b7280', fontSize: '11px', fontWeight: 'bold' }}>
              {callActive ? '📞 Call Active' : '📞 No Active Call'}
            </div>
            {callActive && <div style={{ color: '#e8e0d0', fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtDuration(callDuration)}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{lead?.firstName} {lead?.lastName}</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{lead?.phone}</div>
          </div>
        </div>

        {/* Chris line status */}
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: resolvingChris ? 'rgba(96,165,250,0.06)' : chrisLine ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${resolvingChris ? 'rgba(96,165,250,0.25)' : chrisLine ? GOLD + '33' : 'rgba(239,68,68,0.3)'}`, borderRadius: '6px' }}>
          {resolvingChris ? (
            <div style={{ color: '#60a5fa', fontSize: '12px' }}>⏳ Resolving Chris Bongiorno's line…</div>
          ) : chrisLine ? (
            <div>
              <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold' }}>✓ Chris Bongiorno's line: <span style={{ fontFamily: 'monospace' }}>{chrisLine.twilioNumber}</span></div>
              <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>
                {mergeState === 'dialing' && '⏳ Customer on hold — dialing Chris…'}
                {mergeState === 'connected' && "✓ Chris is connected. Confirm he is ready, then press Merge & Transfer."}
                {mergeState === 'merging' && '⏳ Bridging customer + Chris…'}
                {mergeState === 'done' && '✓ Done.'}
                {mergeState === 'failed' && '⚠ Merge could not start.'}
                {mergeState === 'idle' && 'Preparing merge…'}
              </div>
            </div>
          ) : (
            <div style={{ color: RED, fontSize: '12px', fontWeight: 'bold' }}>⚠ Chris Bongiorno has no assigned Twilio line. Ask an admin to assign a line to "chris" before merging.</div>
          )}
        </div>

        {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {error}</div>}

        {/* Merge script */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Merge Script</span>
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
            <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1, width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '14px', color: '#e8e0d0', fontSize: '14px', lineHeight: 1.7, fontFamily: 'Georgia, serif', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ color: '#e8e0d0', fontSize: '16px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
                {renderFormatted(substituteScriptVars(script?.content || DEFAULT_MERGE_SCRIPT, { lead, fronterFirstName }))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleMergeTransfer}
            disabled={!canMerge}
            style={{
              flex: 1,
              background: canMerge ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(255,255,255,0.05)',
              color: canMerge ? DARK : '#6b7280',
              border: 'none',
              borderRadius: '6px',
              padding: '14px',
              cursor: canMerge ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: canMerge ? 1 : 0.5,
            }}
          >
            {mergeState === 'merging' ? '⏳ Bridging…' : '🔀 Merge & Transfer'}
          </button>
          <button
            onClick={handleNoConnect}
            disabled={!canNoConnect}
            style={{
              background: 'rgba(239,68,68,0.15)',
              color: RED,
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '6px',
              padding: '14px 18px',
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
              background: 'rgba(255,255,255,0.05)',
              color: '#6b7280',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '14px 18px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
            }}
          >
            Close
          </button>
        </div>

        {blockedNoCall && (
          <div style={{ marginTop: '8px', color: '#f59e0b', fontSize: '11px', textAlign: 'center' }}>No active call detected. Start a call from the contact card before merging.</div>
        )}
      </div>
    </FronterPopup>
  );
}