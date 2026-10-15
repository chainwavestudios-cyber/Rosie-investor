/**
 * FronterContactCard.jsx — Professional floating contact card for fronters.
 * Two-column layout: Contact fields (left) | Notes + Debt info (right).
 * Tabs: Contact | Script (with popout).
 * Next button cycles to the next lead. Phone click-to-dial.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import { renderFormatted } from '@/components/debt/ScriptRichText';
import FronterCardAudioControls from './FronterCardAudioControls';
import FronterMeetingScheduler from './FronterMeetingScheduler';
import FronterCardActions from './FronterCardActions';
import FronterHardshipField from './FronterHardshipField';
import FronterNotesSection from './FronterNotesSection';
import FronterEmailTrackingBadges from './FronterEmailTrackingBadges';
import FronterLeadConfirmedChecklist from './FronterLeadConfirmedChecklist';
import FronterClosedDealCelebration from './FronterClosedDealCelebration';
import FronterDialer from './FronterDialer';
import FronterMergePopup from './FronterMergePopup';
import FronterCredsEmailPopup from './FronterCredsEmailPopup';
import QAPopOutPanel from '@/components/leads/QAPopOutPanel';
import FronterTranscriptPopout from './FronterTranscriptPopout';
import AIPopulateTab from '@/components/shared/AIPopulateTab';
import PhoneVerifyBadge from './PhoneVerifyBadge';
import DebtBadge from './DebtBadge';
import FronterCallHistoryTab from './FronterCallHistoryTab';
import { loadFronterLayout, saveFronterLayout } from '@/lib/fronterPopoutLayout';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px 8px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', transition: 'border-color 0.2s' };

const DEBT_TYPES = ['Unsecured Credit Card', 'Unsecured Loans'];

function fmtET(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function FronterContactCard({ lead, username, fronterFirstName, onClose, onSave, onDial, onNext, isAdmin, isSuperAdmin, lineKey, lineNumber, onTranscriptUpdate, onCallConnected, onOpenQA, embedded = false }) {
  const [local, setLocal] = useState(lead || {});
  const [notesLog, setNotesLog] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cardTab, setCardTab] = useState('contact');
  const [pos, setPos] = useState({ x: 60, y: 50 });
  const [size, setSize] = useState({ w: 720, h: 640 });
  const dragRef = useRef(null);
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [scriptPoppedOut, setScriptPoppedOut] = useState(false);
  const savedLayoutRef = useRef(loadFronterLayout(username));
  const [scriptPos, setScriptPos] = useState(() => ({ x: savedLayoutRef.current.script.x, y: savedLayoutRef.current.script.y }));
  const [scriptSize, setScriptSize] = useState(() => ({ w: savedLayoutRef.current.script.w, h: savedLayoutRef.current.script.h }));
  const [callKey, setCallKey] = useState(0);
  const [layoutSavedMsg, setLayoutSavedMsg] = useState(false);
  const [layoutMode, setLayoutMode] = useState(false);
  const qaLayoutRef = useRef(null);
  const transcriptLayoutRef = useRef(null);
  const [scriptSaveMsg, setScriptSaveMsg] = useState(false);
  const scriptDragRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const [headsUpSent, setHeadsUpSent] = useState(false);
  const [headsUpSending, setHeadsUpSending] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [meetingDisposition, setMeetingDisposition] = useState('interested');
  const [showChecklist, setShowChecklist] = useState(false);
  const [showClosedDealCelebration, setShowClosedDealCelebration] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [qaPoppedOut, setQaPoppedOut] = useState(false);
  const [transcriptPoppedOut, setTranscriptPoppedOut] = useState(false);
  const [qaActive, setQaActive] = useState(true);
  const [qaKbEntries, setQaKbEntries] = useState([]);
  const [qaManualQ, setQaManualQ] = useState('');
  const [qaAiPanelItem, setQaAiPanelItem] = useState(null);
  const qaTranscriptRef = useRef([]);
  const [scriptFullscreen, setScriptFullscreen] = useState(false);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReviewMsg, setAiReviewMsg] = useState('');
  const [showMergePopup, setShowMergePopup] = useState(false);
  const [showCredsEmail, setShowCredsEmail] = useState(false);
  const [debtConfirming, setDebtConfirming] = useState(false);
  const [debtConfirmMsg, setDebtConfirmMsg] = useState('');
  const [transferScript, setTransferScript] = useState('');
  const [aiInputRunning, setAiInputRunning] = useState(false);
  const [aiInputMsg, setAiInputMsg] = useState('');
  const [callSid, setCallSid] = useState('');
  const [borrowedLine, setBorrowedLine] = useState(null);
  const [hangupSignal, setHangupSignal] = useState(0);
  const effectiveLineKey = borrowedLine?.key || lineKey;
  const effectiveLineNumber = borrowedLine?.number || lineNumber;

  // ── Ref for onNext: ensures setTimeout always calls the latest version ──
  // Without this, markTransferred/handleNoConnect capture a stale onNext from
  // the render before onSave triggers a FronterLeadsTab re-render.
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    setLocal(lead || {});
    setCallSid('');
    try { setNotesLog(JSON.parse(lead?.notesLogJson || '[]')); } catch { setNotesLog([]); }
  }, [lead]);

  useEffect(() => {
    base44.entities.FronterScript.list('sortOrder', 50).then(all => {
      setScripts(all || []);
      if (all?.length > 0) setActiveScript(prev => prev || all[0]);
    }).catch(() => {});
  }, []);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [liveTranscript.length]);

  // Load FronterKnowledgeBase entries for the Q&A popout
  useEffect(() => {
    const loadKb = async () => {
      try {
        const all = await base44.entities.FronterKnowledgeBase.list('-created_date', 500);
        setQaKbEntries(all || []);
      } catch {}
    };
    loadKb();
    const iv = setInterval(loadKb, 15000);
    return () => clearInterval(iv);
  }, []);

  // Normalize transcript for QAPopOutPanel (expects speaker 0=prospect, 1=agent)
  // Live call format: speaker 0=agent, 1=customer → swap
  const qaNormalizedTranscript = liveTranscript.map(e => ({
    speaker: e.speaker === 0 ? 1 : 0,
    text: e.text,
    time: e.time,
    sentiment: e.sentiment,
    interim: e.interim,
  }));
  useEffect(() => { qaTranscriptRef.current = qaNormalizedTranscript; }, [qaNormalizedTranscript]);

  // Call timer — ticks every second while a call is active
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive, callStartTime]);

  // Alt-L (Windows/Linux) or Command-L (Mac) — save all popout layouts at once
  useEffect(() => {
    const onKey = (e) => {
      if ((e.altKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        const layout = {
          qa: qaLayoutRef.current || savedLayoutRef.current.qa,
          script: { x: scriptPos.x, y: scriptPos.y, w: scriptSize.w, h: scriptSize.h },
          transcript: transcriptLayoutRef.current || savedLayoutRef.current.transcript,
        };
        saveFronterLayout(username, layout);
        savedLayoutRef.current = layout;
        setLayoutSavedMsg(true);
        setTimeout(() => setLayoutSavedMsg(false), 2000);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [username, scriptPos, scriptSize]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Layout Mode: open all 3 popouts for arrangement, then save ──
  // Lets the fronter set their preferred window layout without a live call.
  // The saved layout is restored automatically on every future call connect.
  const enterLayoutMode = () => {
    const layout = loadFronterLayout(username);
    savedLayoutRef.current = layout;
    setScriptPos(layout.script);
    setScriptSize({ w: layout.script.w, h: layout.script.h });
    setScriptPoppedOut(true);
    setQaPoppedOut(true);
    setTranscriptPoppedOut(true);
    setLayoutMode(true);
  };

  const saveLayoutAndExit = () => {
    const layout = {
      qa: qaLayoutRef.current || savedLayoutRef.current.qa,
      script: { x: scriptPos.x, y: scriptPos.y, w: scriptSize.w, h: scriptSize.h },
      transcript: transcriptLayoutRef.current || savedLayoutRef.current.transcript,
    };
    saveFronterLayout(username, layout);
    savedLayoutRef.current = layout;
    setScriptPoppedOut(false);
    setQaPoppedOut(false);
    setTranscriptPoppedOut(false);
    setLayoutMode(false);
    setLayoutSavedMsg(true);
    setTimeout(() => setLayoutSavedMsg(false), 2000);
  };

  const cancelLayoutMode = () => {
    setScriptPoppedOut(false);
    setQaPoppedOut(false);
    setTranscriptPoppedOut(false);
    setLayoutMode(false);
  };

  const onScriptDragStart = (e) => {
    scriptDragRef.current = { startX: e.clientX - scriptPos.x, startY: e.clientY - scriptPos.y };
    const onMove = (ev) => { if (scriptDragRef.current) setScriptPos({ x: ev.clientX - scriptDragRef.current.startX, y: ev.clientY - scriptDragRef.current.startY }); };
    const onUp = () => { scriptDragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const update = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  const debtTypes = (() => { try { return JSON.parse(local.debtTypesJson || '[]'); } catch { return []; } })();
  // Per-type amounts from blended debt confirm — [{type, amount}]
  const debtAmounts = (() => { try { return JSON.parse(local.debtAmountsJson || '[]'); } catch { return []; } })();
  const getAmountForType = (type) => {
    const entry = debtAmounts.find(a => a.type === type);
    return entry ? entry.amount : (local.debtAmount != null ? local.debtAmount : null);
  };
  const toggleDebtType = (type) => {
    const next = debtTypes.includes(type) ? debtTypes.filter(t => t !== type) : [...debtTypes, type];
    update('debtTypesJson', JSON.stringify(next));
  };

  const sendHeadsUp = async () => {
    if (!lead?.id || headsUpSending) return;
    setHeadsUpSending(true);
    try {
      // Look up the fronter's active DialerSession for conference name
      let conferenceName = '';
      let lineKey = '';
      try {
        const sessions = await base44.entities.DialerSession.filter({ username });
        if (sessions?.[0]) {
          conferenceName = sessions[0].currentCallConferenceName || '';
        }
        const assignments = await base44.entities.FronterLineAssignment.filter({ username });
        if (assignments?.[0]) lineKey = assignments[0].twilioLineKey || '';
      } catch {}
      await base44.entities.FronterHeadsUp.create({
        fronterUsername: username,
        leadId: lead.id,
        leadName: (lead.firstName || '') + ' ' + (lead.lastName || ''),
        leadPhone: lead.phone || '',
        leadEmail: lead.email || '',
        conferenceName,
        lineKey,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      setHeadsUpSent(true);
      setTimeout(() => setHeadsUpSent(false), 3000);
    } catch (e) { alert('Heads Up failed: ' + (e?.message || String(e))); }
    setHeadsUpSending(false);
  };

  const addNote = async (entry) => {
    if (!lead?.id) return;
    const nextLog = [...notesLog, entry];
    setNotesLog(nextLog);
    try { await base44.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(nextLog) }); } catch {}
  };

  const setDisposition = async (updates, confirmMsg) => {
    if (!lead?.id) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      await base44.entities.FronterLead.update(lead.id, updates);
      setLocal(prev => ({ ...prev, ...updates }));
      onSave?.({ ...local, ...updates });
    } catch (e) { alert('Update failed: ' + (e?.message || String(e))); }
  };

  // Find the first Twilio line not assigned to any fronter (used after NO CONNECT,
  // when the fronter's own line is tied up holding the queued customer).
  const findUnassignedLine = async () => {
    try {
      const [linesRes, assignments] = await Promise.all([
        base44.functions.invoke('twilioGetLines', {}),
        base44.entities.FronterLineAssignment.list('-assignedAt', 100),
      ]);
      const lines = linesRes?.data?.lines || linesRes?.lines || [];
      const assignedKeys = new Set((assignments || []).map(a => a.twilioLineKey));
      return lines.find(l => l.number && !assignedKeys.has(l.key)) || null;
    } catch { return null; }
  };

  // NO CONNECT — fronter couldn't reach Chris. The popup already told the backend to
  // drop the fronter + agent legs and keep the customer on hold. Here we record the
  // disposition as "queued_no_connect", migrate the prospect to lead status, rotate
  // to an available line for the next call, and advance to the next prospect.
  const handleNoConnect = async () => {
    if (!lead?.id) return;
    try {
      const newCount = (local.callCount || 0) + 1;
      const updates = {
        callCount: newCount,
        lastCalledAt: new Date().toISOString(),
        lastCallResult: 'queued_no_connect',
        status: 'lead',
      };
      await base44.entities.FronterLead.update(lead.id, updates);
      setLocal(prev => ({ ...prev, ...updates }));
      onSave?.({ ...local, ...updates });
      const unassigned = await findUnassignedLine();
      if (unassigned) {
        setBorrowedLine(unassigned);
      } else {
        alert('No unassigned lines available for the next call. Your assigned line may still be holding the queued customer — contact an admin.');
      }
      setShowMergePopup(false);
      setTransferScript('');
      setTimeout(() => { onNextRef.current?.(); }, 800);
    } catch (e) { alert('NO CONNECT failed: ' + (e?.message || String(e))); }
  };

  const markTransferred = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm(`Mark ${local.firstName || 'this contact'} as Transferred? The card becomes a Lead.`)) return;
    const now = new Date().toISOString();
    const updates = { status: 'transferred', lastCallResult: 'transferred', transferredAt: now, lastCalledAt: now };
    try {
      await base44.entities.FronterLead.update(lead.id, updates);
      setLocal(prev => ({ ...prev, ...updates }));
      onSave?.({ ...local, ...updates });

      // Transfer credit: if call duration >= 30s, credit the agent and send congrats
      if (callDuration >= 30) {
        try {
          await base44.entities.FronterLead.update(lead.id, { transferCreditedAt: now });
          const today = new Date().toISOString().split('T')[0];
          const existing = await base44.entities.FronterDailyReport.filter({ fronterUsername: username, reportDate: today });
          if (existing?.[0]) {
            await base44.entities.FronterDailyReport.update(existing[0].id, { transferCalls: (existing[0].transferCalls || 0) + 1 });
          } else {
            await base44.entities.FronterDailyReport.create({ fronterUsername: username, reportDate: today, transferCalls: 1, totalCalls: 0, totalTalkTimeSeconds: 0, futureMeetingCalls: 0 });
          }
          const agentName = fronterFirstName || username;
          await base44.entities.FronterChatMessage.create({
            senderUsername: 'system',
            senderRole: 'admin',
            message: `🎉 Congrats ${agentName}, on a successful open and transfer!!`,
            recipientUsername: username,
            readByAdmin: true,
            readByFronter: false,
          });
        } catch (e) { console.warn('Transfer credit failed:', e.message); }
      }

      // Auto-advance to the next prospect lead
      setTimeout(() => { onNextRef.current?.(); }, 1500);
    } catch (e) { alert('Transfer failed: ' + (e?.message || String(e))); }
  };

  const markEmailSent = () => {
    if (!isAdmin) return;
    setDisposition({ status: 'lead', lastCallResult: 'email_sent' }, `Mark ${local.firstName || 'this contact'} as Email Sent? This promotes them to a Lead.`);
  };

  const handleCallResult = async (result) => {
    if (!lead?.id) return;
    try {
      const newCount = (local.callCount || 0) + 1;
      const updates = { callCount: newCount, lastCalledAt: new Date().toISOString(), lastCallResult: result };
      if (result === 'not_interested') updates.status = 'removed';
      if (newCount >= 3) updates.status = 'removed';
      await base44.entities.FronterLead.update(lead.id, updates);
      setLocal(prev => ({ ...prev, ...updates }));
      onSave?.({ ...local, ...updates });
    } catch (e) { console.error('Call result update failed:', e); }
  };

  const save = async () => {
    if (!lead?.id) return;
    setSaving(true);
    try {
      const savePayload = {
        firstName: local.firstName, lastName: local.lastName, phone: local.phone, phone2: local.phone2,
        email: local.email, address: local.address, city: local.city, state: local.state, zipCode: local.zipCode,
        preferredCallTime: local.preferredCallTime, employmentStatus: local.employmentStatus,
        debtAmount: local.debtAmount, debtTypesJson: local.debtTypesJson, debtAmountsJson: local.debtAmountsJson,
        notesLogJson: JSON.stringify(notesLog),
      };
      // Only super admins can save hardship and lead source
      if (isSuperAdmin) {
        savePayload.hardshipQualification = local.hardshipQualification || '';
        savePayload.referralSource = local.referralSource;
      }
      await base44.entities.FronterLead.update(lead.id, savePayload);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onSave?.(local);
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const markClosedDeal = async () => {
    if (!lead?.id || !isAdmin) return;
    if (!confirm(`Mark ${local.firstName} ${local.lastName} as a Closed Deal? This will trigger a congratulatory popup for the fronter.`)) return;
    try {
      await base44.entities.FronterLead.update(lead.id, {
        status: 'closed_deal',
        closedDealAt: new Date().toISOString(),
        closedDealBy: username,
      });
      onSave?.({ ...local, status: 'closed_deal', closedDealAt: new Date().toISOString(), closedDealBy: username });
      setShowClosedDealCelebration(true);
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  // ── AI Review: review transcript up to now, auto-update contact card ──
  // Uses aiContactFiller (claude-sonnet-5) — same LLM as debt call coach
  // end-of-call contact card update. Passes the active script content with
  // [[AI:fieldName]] tags so the AI knows which transcript lines belong to
  // which contact card fields.
  const runAIReview = async () => {
    if (aiReviewing) return;
    if (liveTranscript.length < 2) { alert('No transcript available. Start a call first.'); return; }
    setAiReviewing(true);
    setAiReviewMsg('');
    try {
      const scriptContent = activeScript?.content || '';
      const res = await base44.functions.invoke('aiContactFiller', {
        transcript: liveTranscript,
        leadType: 'fronter',
        currentLeadData: local,
        scriptContent,
      });
      const data = res?.data || res;
      const updates = data?.updates || {};
      const overwrites = data?.overwrites || [];
      const missingFields = data?.missingFields || [];

      const updateCount = Object.keys(updates).length;
      const overwriteCount = overwrites.filter(o => o.fieldName && o.oldValue != null && o.oldValue !== '').length;

      if (updateCount > 0 || overwriteCount > 0) {
        // Apply updates to local state
        setLocal(prev => ({ ...prev, ...updates }));

        // Build a summary of what was updated
        const updatedFieldNames = Object.keys(updates);
        const summaryParts = updatedFieldNames.map(f => {
          const val = updates[f];
          if (val == null || val === '') return null;
          const displayVal = typeof val === 'number' ? `$${val.toLocaleString()}` : String(val);
          return `${f}: ${displayVal}`;
        }).filter(Boolean);
        const summaryText = summaryParts.length > 0
          ? `🤖 AI Review Summary — Updated: ${summaryParts.join(', ')}`
          : '🤖 AI Review: ran but no new fields to update';

        // Persist to lead record
        if (lead?.id) {
          const updatePayload = { ...updates };
          // Log overwrites to aiPopulateLogJson
          if (overwriteCount > 0) {
            const logEntries = overwrites
              .filter(o => o.fieldName && o.oldValue != null && o.oldValue !== '' && String(o.oldValue) !== String(o.newValue))
              .map(o => ({
                fieldName: o.fieldName,
                oldValue: String(o.oldValue),
                newValue: String(o.newValue),
                timestamp: new Date().toISOString(),
                isFinal: false,
              }));
            if (logEntries.length > 0) {
              let existingLog = [];
              try { existingLog = JSON.parse(local.aiPopulateLogJson || '[]'); } catch {}
              updatePayload.aiPopulateLogJson = JSON.stringify([...existingLog, ...logEntries]);
            }
          }
          await base44.entities.FronterLead.update(lead.id, updatePayload);

          // Add summary note to notes log
          const noteEntry = { text: summaryText, timestamp: new Date().toISOString(), author: 'AI', type: 'ai_review' };
          const nextLog = [...notesLog, noteEntry];
          setNotesLog(nextLog);
          try { await base44.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(nextLog) }); } catch {}
        }

        const msg = `✓ AI Review: ${updateCount} field${updateCount !== 1 ? 's' : ''} updated${overwriteCount > 0 ? `, ${overwriteCount} overwrite${overwriteCount !== 1 ? 's' : ''} logged` : ''}`;
        setAiReviewMsg(msg);
      } else {
        setAiReviewMsg('AI Review: No new information found in transcript.');
      }
      setTimeout(() => setAiReviewMsg(''), 5000);
    } catch (e) {
      alert('AI Review failed: ' + (e?.message || String(e)));
    }
    setAiReviewing(false);
  };

  // ── DebtConfirm: review transcript to confirm debt type + total + per-type amounts ──
  // Looks for [[AI:debtAmount]], [[AI:debtTypesJson]], and [[AI:debtAmountsJson]]
  // tags in the script, extracts confirmed debt info from the transcript in one
  // pass, and updates the contact card with the confirmed values + badges.
  // Each badge shows its own per-type amount when a blended breakdown is available.
  const runDebtConfirm = async () => {
    if (debtConfirming) return;
    if (liveTranscript.length < 2) { alert('No transcript available. Start a call first.'); return; }
    setDebtConfirming(true);
    setDebtConfirmMsg('');
    try {
      const scriptContent = activeScript?.content || '';
      const res = await base44.functions.invoke('debtConfirm', {
        transcript: liveTranscript,
        currentLeadData: local,
        scriptContent,
      });
      const data = res?.data || res;
      if (data?.confirmed && data.debtAmount != null && data.debtTypes?.length > 0) {
        const updates = {
          debtAmount: data.debtAmount,
          debtTypesJson: data.debtTypesJson || JSON.stringify(data.debtTypes),
        };
        // Per-type blended amounts — each badge shows its own amount
        const amounts = (() => { try { return JSON.parse(data.debtAmountsJson || '[]'); } catch { return []; } })();
        if (amounts.length > 0) {
          updates.debtAmountsJson = data.debtAmountsJson;
        } else {
          // No per-type breakdown — apply the total to each badge
          updates.debtAmountsJson = JSON.stringify(data.debtTypes.map(t => ({ type: t, amount: data.debtAmount })));
        }
        setLocal(prev => ({ ...prev, ...updates }));
        if (lead?.id) {
          await base44.entities.FronterLead.update(lead.id, updates);
        }
        const parts = (JSON.parse(updates.debtAmountsJson) || []).map(a => `${a.type}: $${Number(a.amount).toLocaleString()}`);
        setDebtConfirmMsg(`✓ ${parts.join(' · ')}`);
        // Add summary note
        if (data.summary && lead?.id) {
          const noteEntry = { text: `💰 Debt Confirm: ${data.summary}`, timestamp: new Date().toISOString(), author: 'AI', type: 'debt_confirm' };
          await addNote(noteEntry);
        }
      } else {
        setDebtConfirmMsg(data?.message || 'Debt not yet confirmed — customer must state debt type and amount.');
      }
      setTimeout(() => setDebtConfirmMsg(''), 5000);
    } catch (e) {
      alert('Debt Confirm failed: ' + (e?.message || String(e)));
    }
    setDebtConfirming(false);
  };

  // ── AI Input: summarize transcript so far into notes ──
  // Called when the fronter presses the AI Input button in the script.
  // Reviews the entire transcript up to the point of invocation and adds
  // a concise summary to the lead's notes log.
  const runAiInput = async () => {
    if (aiInputRunning) return;
    if (liveTranscript.length < 2) { alert('No transcript available. Start a call first.'); return; }
    setAiInputRunning(true);
    setAiInputMsg('');
    try {
      const res = await base44.functions.invoke('aiInputSummary', { transcript: liveTranscript });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      const summary = data?.summary || '';
      if (summary) {
        const noteEntry = { text: `🤖 AI Input Summary: ${summary}`, timestamp: new Date().toISOString(), author: 'AI', type: 'ai_input' };
        await addNote(noteEntry);
        setAiInputMsg('✓ Summary added to notes');
      } else {
        setAiInputMsg('No summary generated');
      }
      setTimeout(() => setAiInputMsg(''), 5000);
    } catch (e) {
      alert('AI Input failed: ' + (e?.message || String(e)));
    }
    setAiInputRunning(false);
  };


  // ── Script parsing: split at @@COMPLETED_STEPS@@ and handle @@DEBT_CONFIRM@@ ──
  const rawScript = activeScript?.content || '';
  const substitutedScript = substituteScriptVars(rawScript, { lead: local, fronterFirstName });
  // Strip [[AI:fieldName]] tags from display — they're for AI Review only, not for the fronter to see
  const displayScript = substitutedScript.replace(/\[\[AI:\w+\]\]/gi, '');
  const completedStepsIdx = displayScript.indexOf('@@COMPLETED_STEPS@@');
  const hasCompletedSteps = completedStepsIdx !== -1;
  const mainScriptPart = hasCompletedSteps ? displayScript.slice(0, completedStepsIdx) : displayScript;
  const remainingScriptPart = hasCompletedSteps ? displayScript.slice(completedStepsIdx + '@@COMPLETED_STEPS@@'.length).trim() : '';
  const hasDebtConfirm = /@@DEBT_CONFIRM@@/i.test(displayScript);
  const hasAiInput = /@@AI_INPUT@@/i.test(displayScript);
  const hasSendEmail = /@@SEND_EMAIL@@/i.test(displayScript);
  const hasAiTags = /\[\[AI:\w+\]\]/i.test(rawScript);

  // Split main script at all interactive markers for inline button rendering.
  // The capturing group includes the marker name in the result array.
  const interactiveSegments = mainScriptPart.split(/@@(DEBT_CONFIRM|AI_INPUT|SEND_EMAIL)@@/i);

  const scriptContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {scripts.length > 1 && (
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0 }}>
          {scripts.map(s => (
            <button key={s.id} onClick={() => setActiveScript(s)} style={{ padding: '6px 10px', background: 'none', border: 'none', borderBottom: `2px solid ${activeScript?.id === s.id ? GOLD : 'transparent'}`, color: activeScript?.id === s.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: activeScript?.id === s.id ? 'bold' : 'normal' }}>{s.name}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {!activeScript ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No scripts yet. Ask your admin to add a script.</div>
        ) : (
          <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
            {interactiveSegments.map((seg, i) => {
              if (seg.toUpperCase() === 'DEBT_CONFIRM') {
                return (
                  <div key={i} style={{ margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={runDebtConfirm}
                      disabled={debtConfirming}
                      style={{ background: `${GOLD}18`, color: GOLD, border: `2px solid ${GOLD}55`, borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: `0 0 12px ${GOLD}33` }}
                    >
                      {debtConfirming ? '⏳ Confirming…' : '💰 Confirm Debt'}
                    </button>
                  </div>
                );
              }
              if (seg.toUpperCase() === 'AI_INPUT') {
                return (
                  <div key={i} style={{ margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={runAiInput}
                      disabled={aiInputRunning}
                      style={{ background: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: '2px solid rgba(167,139,250,0.55)', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 0 12px rgba(167,139,250,0.33)' }}
                    >
                      {aiInputRunning ? '⏳ Summarizing…' : '🤖 AI Input'}
                    </button>
                  </div>
                );
              }
              if (seg.toUpperCase() === 'SEND_EMAIL') {
                return (
                  <div key={i} style={{ margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => setShowCredsEmail(true)}
                      style={{ background: 'rgba(96,165,250,0.18)', color: BLUE, border: '2px solid rgba(96,165,250,0.55)', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 0 12px rgba(96,165,250,0.33)' }}
                    >
                      📧 Send Credentials Email
                    </button>
                  </div>
                );
              }
              return <span key={i}>{renderFormatted(seg)}</span>;
            })}
            {hasCompletedSteps && (
              <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'center', padding: '14px 0 4px', background: 'linear-gradient(to top, #0d1b2a 70%, rgba(13,27,42,0.7) 90%, transparent)', zIndex: 5 }}>
                <button
                  onClick={() => { setTransferScript(remainingScriptPart); setShowMergePopup(true); }}
                  style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '8px', padding: '12px 32px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 0 16px rgba(16,185,129,0.4)' }}
                >
                  ✅ Completed Steps → Transfer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {(aiInputMsg || debtConfirmMsg) && (
        <div style={{ padding: '8px 14px', color: GOLD, fontSize: '10px' }}>
          {aiInputMsg || debtConfirmMsg}
        </div>
      )}
    </div>
  );

  const initials = `${(local.firstName?.[0] || '?')}${(local.lastName?.[0] || '')}`;
  const leadTypeColor = local.status === 'lead' ? GOLD : local.status === 'transferred' ? '#a78bfa' : local.status === 'booked' ? '#f59e0b' : local.status === 'closed_deal' ? '#c084fc' : '#60a5fa';
  const leadTypeLabel = local.status === 'lead' ? 'LEAD CONTACT' : local.status === 'transferred' ? 'LEAD CONTACT · TRANSFERRED' : local.status === 'booked' ? 'BOOKED CONTACT' : local.status === 'closed_deal' ? 'CLOSED DEAL' : 'PROSPECT CONTACT';
  const animalEmoji = local.status === 'closed_deal' ? '💎' : local.status === 'booked' ? '📗' : local.status === 'transferred' ? '🦄' : local.status === 'lead' ? '🐄' : '🦆';

  const outerStyle = embedded
    ? { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#0d1b2a', border: `1px solid ${leadTypeColor}33`, borderRadius: '6px', overflow: 'hidden' }
    : { position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `2px solid ${leadTypeColor}55`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', flexDirection: 'column' };

  return (
    <>
      <div style={outerStyle}>
        {/* Fullscreen script overlay — script + checklist fill the entire card */}
        {scriptFullscreen && (
          <div style={{ position: 'absolute', inset: 0, background: '#0d1b2a', borderRadius: embedded ? '6px' : '10px', display: 'flex', flexDirection: 'column', zIndex: 200 }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)' }}>
              <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Fullscreen Script + ✅ Checklist</span>
              <button onClick={() => setScriptFullscreen(false)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>⛶ Exit Fullscreen</button>
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 3, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {scriptContent}
              </div>
              <div style={{ flex: 2, overflowY: 'auto', padding: '8px' }}>
                <FronterLeadConfirmedChecklist
                  lead={local}
                  username={username}
                  embedded
                  onAllComplete={() => setShowMergePopup(true)}
                />
              </div>
            </div>
          </div>
        )}
        {/* Lead type banner */}
        <div style={{ padding: '6px 18px', background: `${leadTypeColor}18`, borderBottom: `1px solid ${leadTypeColor}33`, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: leadTypeColor, fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase' }}>● {leadTypeLabel} ●</span>
        </div>
        {/* Debt badges — visual badge cards with per-type amount overlay (shown when debt type + amount confirmed) */}
        {debtTypes.length > 0 && local.debtAmount != null && local.debtAmount > 0 && (
          <div style={{ padding: '6px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
            {debtTypes.map(type => (
              <DebtBadge key={type} debtType={type} amount={getAmountForType(type)} size={72} />
            ))}
          </div>
        )}
        {/* Header — draggable (disabled when embedded) */}
        <div onMouseDown={embedded ? undefined : onDragStart} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', cursor: embedded ? 'default' : 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(16,185,129,0.06), transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, #22c55e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DARK, fontSize: '14px', fontWeight: 'bold', flexShrink: 0, textTransform: 'uppercase' }}>{initials}</div>
            <div>
              <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>{local.firstName || 'New'} {local.lastName || 'Lead'}</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                {local.leadNumber && <span style={{ color: '#6b7280', fontSize: '10px' }}>{local.leadNumber}</span>}
                <span style={{ padding: '1px 7px', borderRadius: '8px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', background: local.status === 'lead' ? 'rgba(16,185,129,0.15)' : local.status === 'transferred' ? 'rgba(167,139,250,0.15)' : 'rgba(96,165,250,0.15)', color: local.status === 'lead' ? GOLD : local.status === 'transferred' ? '#a78bfa' : BLUE }}>{local.status || 'prospect'}</span>
                {local.callCount > 0 && <span style={{ color: '#6b7280', fontSize: '9px' }}>· {local.callCount}/3 calls</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={enterLayoutMode}
              title="Save Layout — arrange all 3 windows, then save for future calls"
              style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              📐 Save Layout
            </button>
            <FronterCardActions
              status={local.status || 'prospect'}
              isAdmin={isAdmin}
              headsUpSent={headsUpSent}
              headsUpSending={headsUpSending}
              onHeadsUp={sendHeadsUp}
              onInterested={() => { setMeetingDisposition('interested'); setShowMeetingScheduler(true); }}
              onTransferred={markTransferred}
              onEmailSent={markEmailSent}
              onClosedDeal={markClosedDeal}
              onNext={onNext}
              onClose={onClose}
              onQA={() => { setQaPoppedOut(p => !p); onOpenQA?.(); }}
            />
          </div>
        </div>

        {/* Green screen — embedded dialer with real call controls */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'rgba(0,0,0,0.2)', padding: '0 14px' }}>
          <FronterDialer
            lead={local}
            username={username}
            lineKey={effectiveLineKey}
            lineNumber={effectiveLineNumber}
            embedded
            hangupSignal={hangupSignal}
            onCallSid={(sid) => setCallSid(sid)}
            onDial={onDial}
            onCallConnected={(l) => {
            setCallActive(true);
            setCallStartTime(Date.now());
            setCardTab('script');
            // Restore saved layout for this call
            const layout = loadFronterLayout(username);
            savedLayoutRef.current = layout;
            setScriptPos(layout.script);
            setScriptSize({ w: layout.script.w, h: layout.script.h });
            setCallKey(k => k + 1);
            setScriptPoppedOut(true);
            setQaPoppedOut(true);
            setTranscriptPoppedOut(true);
            onCallConnected?.(l);
            onOpenQA?.();
          }}
            onCallEnded={() => { setCallActive(false); }}
            onLeadCalled={(leadId, newCount) => { setLocal(prev => ({ ...prev, callCount: newCount })); }}
            onTranscriptUpdate={(lines) => { setLiveTranscript(lines); onTranscriptUpdate?.(lines); }}
          />
        </div>

        {/* Dispositions — below green screen */}
        <div style={{ padding: '8px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginRight: '4px' }}>Dispositions:</span>
          {[
            { label: '✗ Not Interested', val: 'not_interested', color: '#ef4444' },
            { label: '📞 Voicemail', val: 'voicemail', color: '#f59e0b' },
            { label: '📵 Hung Up', val: 'hung_up', color: '#ef4444' },
            { label: '🚫 No Answer', val: 'no_answer', color: '#8a9ab8' },
          ].map(r => (
            <button key={r.val} onClick={() => handleCallResult(r.val)} style={{ background: `${r.color}15`, color: r.color, border: `1px solid ${r.color}33`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{r.label}</button>
          ))}
        </div>

        {/* Email tracking badges + Lead Confirmed button */}
        <div style={{ padding: '8px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
          <FronterEmailTrackingBadges lead={local} username={username} onManualUpdate={(upd) => setLocal(prev => ({ ...prev, ...upd }))} />
          <button onClick={() => setCardTab('checklist')} style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>✅ Lead Confirmed</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, padding: '0 14px' }}>
          <button onClick={() => setCardTab('contact')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'contact' ? GOLD : 'transparent'}`, color: cardTab === 'contact' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'contact' ? 'bold' : 'normal' }}>📇 Contact</button>
          <button onClick={() => setCardTab('script')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'script' ? GOLD : 'transparent'}`, color: cardTab === 'script' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'script' ? 'bold' : 'normal' }}>📜 Script</button>
          <button onClick={() => setCardTab('transcript')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'transcript' ? '#60a5fa' : 'transparent'}`, color: cardTab === 'transcript' ? '#60a5fa' : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'transcript' ? 'bold' : 'normal' }}>📝 Transcript {liveTranscript.length > 0 && <span style={{ fontSize: '10px' }}>({liveTranscript.length})</span>}</button>
          <button onClick={() => setCardTab('call_history')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'call_history' ? BLUE : 'transparent'}`, color: cardTab === 'call_history' ? BLUE : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'call_history' ? 'bold' : 'normal' }}>📋 Transcripts</button>
          <button onClick={() => setCardTab('checklist')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'checklist' ? GOLD : 'transparent'}`, color: cardTab === 'checklist' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'checklist' ? 'bold' : 'normal' }}>✅ Checklist</button>
          <button onClick={() => setCardTab('ai_populate')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'ai_populate' ? '#a78bfa' : 'transparent'}`, color: cardTab === 'ai_populate' ? '#a78bfa' : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'ai_populate' ? 'bold' : 'normal' }}>🤖 AI Populate</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {cardTab === 'contact' && (
            <div>
              {/* Audio controls */}
              <FronterCardAudioControls />

              {/* Compact two-column layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                {/* Left column: Contact info */}
                <div>
                  <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', paddingBottom: '3px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>Contact</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                    <div><label style={ls}>First Name</label><input value={local.firstName || ''} onChange={e => update('firstName', e.target.value)} style={inp} /></div>
                    <div><label style={ls}>Last Name</label><input value={local.lastName || ''} onChange={e => update('lastName', e.target.value)} style={inp} /></div>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <label style={ls}>Primary Phone</label>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input value={local.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="555-123-4567" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => { if (!local.phone) return; setCallActive(true); setCallStartTime(Date.now()); setCallDuration(0); setShowChecklist(true); onDial?.({ ...local, phone: local.phone }); }} disabled={!local.phone} title="Dial" style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '0 9px', cursor: local.phone ? 'pointer' : 'not-allowed', fontSize: '13px', flexShrink: 0, opacity: local.phone ? 1 : 0.4 }}>📞</button>
                      <PhoneVerifyBadge phoneValid={local.phoneValid} phoneLineType={local.phoneLineType} size={36} />
                    </div>
                    {local.phoneCarrier && <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>{local.phoneCarrier}{local.phoneLineType && local.phoneLineType !== 'unknown' ? ` · ${local.phoneLineType}` : ''}</div>}
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <label style={ls}>Secondary Phone</label>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input value={local.phone2 || ''} onChange={e => update('phone2', e.target.value)} placeholder="555-987-6543" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => { if (!local.phone2) return; setCallActive(true); setCallStartTime(Date.now()); setCallDuration(0); onDial?.({ ...local, phone: local.phone2 }); }} disabled={!local.phone2} title="Dial" style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '0 9px', cursor: local.phone2 ? 'pointer' : 'not-allowed', fontSize: '13px', flexShrink: 0, opacity: local.phone2 ? 1 : 0.4 }}>📞</button>
                      <PhoneVerifyBadge phoneValid={local.phone2Valid} phoneLineType={local.phone2LineType} size={36} />
                    </div>
                    {local.phone2Carrier && <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>{local.phone2Carrier}{local.phone2LineType && local.phone2LineType !== 'unknown' ? ` · ${local.phone2LineType}` : ''}</div>}
                  </div>
                  <div style={{ marginBottom: '6px' }}><label style={ls}>Email</label><input value={local.email || ''} onChange={e => update('email', e.target.value)} style={inp} placeholder="customer@email.com" /></div>
                  <div style={{ marginBottom: '6px' }}><label style={ls}>Address</label><input value={local.address || ''} onChange={e => update('address', e.target.value)} style={inp} placeholder="123 Main St" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr', gap: '6px', marginBottom: '6px' }}>
                    <div><label style={ls}>City</label><input value={local.city || ''} onChange={e => update('city', e.target.value)} style={inp} placeholder="New York" /></div>
                    <div><label style={ls}>State</label><input value={local.state || ''} onChange={e => update('state', e.target.value)} style={inp} placeholder="NY" maxLength={2} /></div>
                    <div><label style={ls}>Zip</label><input value={local.zipCode || ''} onChange={e => update('zipCode', e.target.value)} style={inp} placeholder="10001" /></div>
                  </div>
                </div>

                {/* Right column: Debt info */}
                <div>
                  <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', paddingBottom: '3px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>Debt Info</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                    <div>
                      <label style={ls}>Debt Amount ($)</label>
                      <input type="number" value={local.debtAmount ?? ''} onChange={e => update('debtAmount', e.target.value ? Number(e.target.value) : null)} style={inp} placeholder="0" />
                    </div>
                    <div>
                      <label style={ls}>Best Time to Call</label>
                      <input value={local.preferredCallTime || ''} onChange={e => update('preferredCallTime', e.target.value)} style={inp} placeholder="After 5pm" />
                    </div>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <label style={ls}>Type of Debt</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {DEBT_TYPES.map(type => {
                        const selected = debtTypes.includes(type);
                        return (
                          <button key={type} onClick={() => toggleDebtType(type)} style={{ padding: '3px 8px', borderRadius: '10px', border: `1px solid ${selected ? GOLD + '55' : 'rgba(255,255,255,0.1)'}`, background: selected ? `${GOLD}12` : 'transparent', color: selected ? GOLD : '#8a9ab8', cursor: 'pointer', fontSize: '10px', fontWeight: selected ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
                            {selected ? '✓ ' : ''}{type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <FronterHardshipField value={local.hardshipQualification} onChange={v => update('hardshipQualification', v)} labelStyle={ls} inputStyle={inp} />
                  )}
                </div>
              </div>

              {/* Notes section — full width */}
              <FronterNotesSection notesLog={notesLog} username={username} onAdd={addNote} inputStyle={inp} />

            </div>
          )}

          {cardTab === 'script' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginLeft: '-16px', marginRight: '-16px', marginTop: '-16px', marginBottom: '-16px' }}>
              {!scriptPoppedOut ? (
                <>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Scripts</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setScriptFullscreen(true)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>⛶ Fullscreen</button>
                      <button onClick={() => setScriptPoppedOut(true)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>↗ Pop Out</button>
                    </div>
                  </div>
                  {scriptContent}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4a5568', fontSize: '13px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div>📜 Script is popped out</div>
                    <button onClick={() => setScriptPoppedOut(false)} style={{ marginTop: '10px', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>↙ Dock Back</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {cardTab === 'transcript' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginLeft: '-16px', marginRight: '-16px', marginTop: '-16px', marginBottom: '-16px' }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>📝 Live Transcript</span>
                {liveTranscript.length > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />}
              </div>
              <div style={{ padding: '4px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#6b7280', fontSize: '10px', flexShrink: 0 }}>
                <span style={{ color: '#60a5fa' }}>● Agent</span> · <span style={{ color: GOLD }}>● Customer</span>
              </div>
              <div ref={transcriptScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                {liveTranscript.length === 0 ? (
                  <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 10px', fontSize: '13px' }}>
                    {callActive ? 'Listening… start speaking.' : 'No active call. Transcript will appear here when a call starts.'}
                  </div>
                ) : liveTranscript.map((msg, i) => {
                  const isAgent = msg.speaker === 0;
                  return (
                    <div key={i} style={{ display: 'flex', marginBottom: '10px', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '85%', background: isAgent ? 'rgba(96,165,250,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: isAgent ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px' }}>
                        <div style={{ marginBottom: '3px' }}>
                          <span style={{ color: isAgent ? '#60a5fa' : GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAgent ? '🎙 Agent' : '👤 Customer'}</span>
                        </div>
                        <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cardTab === 'call_history' && (
            <FronterCallHistoryTab leadId={local?.id} />
          )}

          {cardTab === 'checklist' && (
            <FronterLeadConfirmedChecklist
              lead={local}
              username={username}
              embedded
              onAllComplete={() => setShowMergePopup(true)}
            />
          )}

          {cardTab === 'ai_populate' && (
            <AIPopulateTab lead={local} leadType="fronter" />
          )}
        </div>

        {/* Save bar */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          {saved && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓ Saved</span>}
          <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 28px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>
            {saving ? '⏳ Saving…' : '💾 Save Changes'}
          </button>
        </div>

        {/* Resize handle — hidden when embedded (Call Card provides resize) */}
        {!embedded && (
        <div onMouseDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
          const onMove = (ev) => setSize({ w: Math.max(400, startW + ev.clientX - startX), h: Math.max(400, startH + ev.clientY - startY) });
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
        )}
      </div>

      {/* Script popout */}
      {scriptPoppedOut && (
        <div style={{ position: 'fixed', left: scriptPos.x, top: scriptPos.y, width: scriptSize.w, height: scriptSize.h, background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10001, display: 'flex', flexDirection: 'column' }}>
          <div onMouseDown={onScriptDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 {activeScript?.name || 'Script'}</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={() => setScriptSize(s => ({ ...s, w: Math.max(300, s.w - 50) }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>−</button>
              <button onClick={() => setScriptSize(s => ({ ...s, w: s.w + 50, h: s.h + 50 }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>+</button>
              <button onClick={() => { const layout = loadFronterLayout(username); layout.script = { ...scriptPos, ...scriptSize }; saveFronterLayout(username, layout); savedLayoutRef.current = layout; setScriptSaveMsg(true); setTimeout(() => setScriptSaveMsg(false), 2000); }} style={{ background: scriptSaveMsg ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', color: scriptSaveMsg ? '#4ade80' : '#6b7280', border: `1px solid ${scriptSaveMsg ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '3px', padding: '2px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{scriptSaveMsg ? '✓ Saved' : '📐 Save Size'}</button>
              <button onClick={() => setScriptPoppedOut(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}>×</button>
            </div>
          </div>
          {scriptContent}
          <div onMouseDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY, startW = scriptSize.w, startH = scriptSize.h;
            const onMove = (ev) => setScriptSize({ w: Math.max(300, startW + ev.clientX - startX), h: Math.max(200, startH + ev.clientY - startY) });
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
        </div>
      )}


      {/* Closed Deal celebration */}
      {showClosedDealCelebration && (
        <FronterClosedDealCelebration
          agentName={fronterFirstName || username}
          username={username}
          onClose={() => { setShowClosedDealCelebration(false); onClose?.(); }}
        />
      )}

      {/* Meeting scheduler popup */}
      {showMeetingScheduler && (
        <FronterMeetingScheduler
          lead={local}
          username={username}
          disposition={meetingDisposition}
          onClose={() => setShowMeetingScheduler(false)}
          onScheduled={() => { const upd = { status: 'lead', lastCallResult: meetingDisposition }; setShowMeetingScheduler(false); setLocal(prev => ({ ...prev, ...upd })); onSave?.({ ...local, ...upd }); }}
        />
      )}

      {/* Credentials email popup — triggered by @@SEND_EMAIL@@ in the script */}
      {showCredsEmail && (
        <FronterCredsEmailPopup
          lead={local}
          username={username}
          onClose={() => setShowCredsEmail(false)}
          onSent={(data) => {
            setShowCredsEmail(false);
            setLocal(prev => ({ ...prev, credsSentAt: data?.credsSentAt || new Date().toISOString(), credsSentTemplate: data?.credsSentTemplate }));
            onSave?.({ ...local, credsSentAt: data?.credsSentAt || new Date().toISOString(), credsSentTemplate: data?.credsSentTemplate });
          }}
        />
      )}

      {/* Merge popup — when all checklist items are complete */}
      {showMergePopup && (
        <FronterMergePopup
          lead={local}
          username={username}
          fronterFirstName={fronterFirstName}
          isAdmin={isAdmin}
          callActive={callActive}
          callDuration={callDuration}
          callSid={callSid}
          lineKey={effectiveLineKey}
          transferScript={transferScript}
          onAiInput={runAiInput}
          onDebtConfirm={runDebtConfirm}
          onSendEmail={() => setShowCredsEmail(true)}
          onMerge={() => { setScriptPoppedOut(false); setQaPoppedOut(false); setTranscriptPoppedOut(false); setShowMergePopup(false); setTransferScript(''); setHangupSignal(s => s + 1); markTransferred(true); }}
          onNoConnect={() => { setScriptPoppedOut(false); setQaPoppedOut(false); setTranscriptPoppedOut(false); setHangupSignal(s => s + 1); handleNoConnect(); }}
          onClose={() => { setShowMergePopup(false); setTransferScript(''); }}
        />
      )}

      {/* Transcript popout — narrow full-height window, auto-opens on call connect */}
      {transcriptPoppedOut && (
        <FronterTranscriptPopout
          key={`transcript-${callKey}`}
          transcript={liveTranscript}
          callActive={callActive}
          callDuration={callDuration}
          onClose={() => setTranscriptPoppedOut(false)}
          initialLayout={savedLayoutRef.current?.transcript}
          layoutRef={transcriptLayoutRef}
          onSave={(l) => { const layout = loadFronterLayout(username); layout.transcript = l; saveFronterLayout(username, layout); savedLayoutRef.current = layout; setLayoutSavedMsg(true); setTimeout(() => setLayoutSavedMsg(false), 2000); }}
        />
      )}

      {/* Q&A popout — standalone Q&A panel (no wrapper, no transcript sidebar) */}
      {qaPoppedOut && (
        <QAPopOutPanel
          key={`qa-${callKey}`}
          transcript={qaNormalizedTranscript}
          transcriptRef={qaTranscriptRef}
          kbEntries={qaKbEntries}
          lead={local}
          pendingQuestion={null}
          qaActive={qaActive}
          onToggleQA={() => setQaActive(p => !p)}
          portalCfg={{}}
          manualQ={qaManualQ}
          setManualQ={setQaManualQ}
          onClose={() => setQaPoppedOut(false)}
          aiPanelItem={qaAiPanelItem}
          setAiPanelItem={setQaAiPanelItem}
          rightPanelWidth={32}
          setRightPanelWidth={() => {}}
          username={username}
          initialLayout={savedLayoutRef.current?.qa}
          layoutRef={qaLayoutRef}
          onSave={(l) => { const layout = loadFronterLayout(username); layout.qa = l; saveFronterLayout(username, layout); savedLayoutRef.current = layout; setLayoutSavedMsg(true); setTimeout(() => setLayoutSavedMsg(false), 2000); }}
        />
      )}

      {/* Layout mode popup — arrange 3 windows, then save */}
      {layoutMode && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#0d1b2a', border: `2px solid ${GOLD}55`, borderRadius: '10px', padding: '16px 24px', boxShadow: '0 12px 48px rgba(0,0,0,0.8)', zIndex: 50000, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', maxWidth: '420px' }}>
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>📐 Arrange Your Call Layout</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', textAlign: 'center', lineHeight: 1.5 }}>Move and resize the Script, Q&A, and Transcript windows to your preferred positions. This layout will be restored automatically on every future live call.</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={saveLayoutAndExit} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '10px 28px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>💾 Save Layout</button>
            <button onClick={cancelLayoutMode} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Layout saved confirmation toast */}
      {layoutSavedMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', padding: '10px 24px', color: GOLD, fontSize: '13px', fontWeight: 'bold', zIndex: 50000, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>✓ Layout saved (Alt+L / ⌘L)</div>
      )}
    </>
  );
}