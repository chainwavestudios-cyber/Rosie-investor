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
import FronterCredsEmailPopup from './FronterCredsEmailPopup';
import FronterCardActions from './FronterCardActions';
import FronterHardshipField from './FronterHardshipField';
import FronterNotesSection from './FronterNotesSection';
import FronterEmailTrackingBadges from './FronterEmailTrackingBadges';
import FronterLeadConfirmedChecklist from './FronterLeadConfirmedChecklist';
import FronterClosedDealCelebration from './FronterClosedDealCelebration';
import FronterDialer from './FronterDialer';
import FronterMergePopup from './FronterMergePopup';
import FronterAIPanel from './FronterAIPanel';
import AIPopulateTab from '@/components/shared/AIPopulateTab';
import PhoneVerifyBadge from './PhoneVerifyBadge';

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

export default function FronterContactCard({ lead, username, fronterFirstName, onClose, onSave, onDial, onNext, isAdmin, lineKey, lineNumber, onTranscriptUpdate, onCallConnected, onOpenQA, embedded = false }) {
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
  const [scriptPos, setScriptPos] = useState({ x: 660, y: 80 });
  const [scriptSize, setScriptSize] = useState({ w: 400, h: 500 });
  const scriptDragRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const [headsUpSent, setHeadsUpSent] = useState(false);
  const [headsUpSending, setHeadsUpSending] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [showCredsPopup, setShowCredsPopup] = useState(false);
  const [meetingDisposition, setMeetingDisposition] = useState('interested');
  const [showChecklist, setShowChecklist] = useState(false);
  const [showClosedDealCelebration, setShowClosedDealCelebration] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [showQAPanel, setShowQAPanel] = useState(false);
  const [scriptFullscreen, setScriptFullscreen] = useState(false);
  const [hardshipMonitoring, setHardshipMonitoring] = useState(false);
  const [hardshipMonitorStart, setHardshipMonitorStart] = useState(null);
  const [hardshipAIProcessing, setHardshipAIProcessing] = useState(false);
  const [debtScanning, setDebtScanning] = useState(false);
  const [showMergePopup, setShowMergePopup] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const hardshipTimerRef = useRef(null);

  useEffect(() => {
    setLocal(lead || {});
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

  // Call timer — ticks every second while a call is active
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive, callStartTime]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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

  const markTransferred = async () => {
    if (!confirm(`Mark ${local.firstName || 'this contact'} as Transferred? The card becomes a Lead.`)) return;
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
      await base44.entities.FronterLead.update(lead.id, {
        firstName: local.firstName, lastName: local.lastName, phone: local.phone, phone2: local.phone2,
        email: local.email, address: local.address, city: local.city, state: local.state, zipCode: local.zipCode,
        preferredCallTime: local.preferredCallTime, employmentStatus: local.employmentStatus,
        hardshipQualification: local.hardshipQualification || '', referralSource: local.referralSource,
        debtAmount: local.debtAmount, debtTypesJson: local.debtTypesJson,
        notesLogJson: JSON.stringify(notesLog),
      });
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

  // ── Hardship AI: monitor transcript, then generate hardship text ──
  const toggleHardshipAI = () => {
    if (hardshipMonitoring) {
      stopHardshipAI();
    } else {
      setHardshipMonitoring(true);
      setHardshipMonitorStart(Date.now());
      hardshipTimerRef.current = setTimeout(() => stopHardshipAI(), 120000);
    }
  };

  const stopHardshipAI = async () => {
    setHardshipMonitoring(false);
    if (hardshipTimerRef.current) { clearTimeout(hardshipTimerRef.current); hardshipTimerRef.current = null; }
    if (liveTranscript.length < 2) { alert('No transcript available. Start a call first.'); return; }
    setHardshipAIProcessing(true);
    try {
      const transcriptText = liveTranscript.map(t => `${t.speaker === 0 ? 'Agent' : 'Customer'}: ${t.text}`).join('\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt settlement call assistant. Based on the following call transcript, write a concise hardship explanation for this customer. The hardship should explain what happened (job loss, medical, divorce, etc.) and how it impacted their finances. Write it in third person as if documenting it for their file. Keep it to 2-3 sentences.

Customer: ${local.firstName} ${local.lastName}

Transcript:
${transcriptText}`,
        response_json_schema: { type: 'object', properties: { hardship: { type: 'string' } } },
      });
      if (res?.hardship) {
        update('hardshipQualification', res.hardship);
        if (lead?.id) await base44.entities.FronterLead.update(lead.id, { hardshipQualification: res.hardship });
        scanDebtInfo(transcriptText);
      }
    } catch (e) { alert('AI hardship generation failed: ' + (e?.message || String(e))); }
    setHardshipAIProcessing(false);
  };

  // ── Scan transcript for debt amount and types ──
  const scanDebtInfo = async (transcriptText) => {
    setDebtScanning(true);
    try {
      const text = transcriptText || liveTranscript.map(t => t.text).join(' ');
      if (!text.trim()) { setDebtScanning(false); return; }
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this call transcript and extract the customer's debt information. Return JSON with:
- debtAmount: the total unsecured debt amount (number, or null if not mentioned)
- debtTypes: array of strings from ["Unsecured Credit Card", "Unsecured Loans"] based on what the customer has

Transcript:
${text}`,
        response_json_schema: {
          type: 'object',
          properties: {
            debtAmount: { type: 'number' },
            debtTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      if (res) {
        const updates = {};
        if (res.debtAmount) updates.debtAmount = res.debtAmount;
        if (res.debtTypes) updates.debtTypesJson = JSON.stringify(res.debtTypes);
        if (Object.keys(updates).length > 0) {
          setLocal(prev => ({ ...prev, ...updates }));
          if (lead?.id) await base44.entities.FronterLead.update(lead.id, updates);
        }
      }
    } catch (e) { console.error('Debt scan failed:', e); }
    setDebtScanning(false);
  };

  // ── Quick-send credentials email using lead's email ──
  const quickSendCreds = async () => {
    if (!local.email) { alert('No email address on the contact card. Please add an email first.'); return; }
    setEmailSending(true);
    try {
      const raw = await base44.entities.FronterEmailTemplate.list('sortOrder', 10);
      const all = Array.isArray(raw) ? raw : (raw?.items || []);
      const t = all[0];
      if (!t) { alert('No email templates found.'); setEmailSending(false); return; }
      const filledSubject = (t.subject || '').replace(/{{firstName}}/g, local.firstName || '').replace(/{{email}}/g, local.email || '');
      const filledBody = (t.body || '').replace(/{{firstName}}/g, local.firstName || '').replace(/{{email}}/g, local.email || '');
      const res = await base44.functions.invoke('sendGmailEmail', {
        to: local.email, subject: filledSubject, html: filledBody, leadId: lead?.id, sentBy: username,
      });
      if (res?.error) throw new Error(res.error);
      const now = new Date().toISOString();
      const updates = { credsSentAt: now, credsSentTemplate: t.label };
      if (local.status === 'prospect') updates.status = 'lead';
      try {
        const log = JSON.parse(local.notesLogJson || '[]');
        log.push({ text: `🔑 Company credentials emailed to ${local.email} (${t.label})`, timestamp: now, author: username, type: 'creds' });
        updates.notesLogJson = JSON.stringify(log);
      } catch {}
      if (lead?.id) await base44.entities.FronterLead.update(lead.id, updates);
      setLocal(prev => ({ ...prev, ...updates }));
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (e) { alert('Failed to send: ' + (e?.message || String(e))); }
    setEmailSending(false);
  };

  useEffect(() => () => { if (hardshipTimerRef.current) clearTimeout(hardshipTimerRef.current); }, []);

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
          <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{renderFormatted(substituteScriptVars(activeScript.content, { lead: local, fronterFirstName }))}</div>
        )}
      </div>
      {/* Interactive AI buttons */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={toggleHardshipAI} disabled={hardshipAIProcessing} style={{ background: hardshipMonitoring ? 'rgba(239,68,68,0.15)' : `${GOLD}18`, color: hardshipMonitoring ? '#ef4444' : GOLD, border: `1px solid ${hardshipMonitoring ? 'rgba(239,68,68,0.3)' : GOLD + '44'}`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {hardshipMonitoring ? '⏹ Stop & Generate' : hardshipAIProcessing ? '⏳ Generating…' : '🤖 Invoke AI — Hardship'}
          {hardshipMonitoring && hardshipMonitorStart && <span style={{ fontSize: '9px', opacity: 0.7 }}>{Math.floor((Date.now() - hardshipMonitorStart) / 1000)}s</span>}
        </button>
        <button onClick={() => scanDebtInfo()} disabled={debtScanning} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
          {debtScanning ? '⏳ Scanning…' : '🔍 Scan Debt Info'}
        </button>
        <button onClick={quickSendCreds} disabled={emailSending || !local.email} style={{ background: emailSent ? 'rgba(74,222,128,0.15)' : 'rgba(96,165,250,0.12)', color: emailSent ? '#4ade80' : BLUE, border: `1px solid ${emailSent ? 'rgba(74,222,128,0.3)' : BLUE + '30'}`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: (!local.email && !emailSending) ? 0.5 : 1 }}>
          {emailSending ? '⏳ Sending…' : emailSent ? '✓ Sent!' : '🔑 Send Credentials'}
        </button>
      </div>
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
                  onEmailCreds={() => setShowCredsPopup(true)}
                />
              </div>
            </div>
          </div>
        )}
        {/* Lead type banner */}
        <div style={{ padding: '6px 18px', background: `${leadTypeColor}18`, borderBottom: `1px solid ${leadTypeColor}33`, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: leadTypeColor, fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase' }}>● {leadTypeLabel} ●</span>
        </div>
        {/* Debt badge — visible on front of contact card */}
        <div style={{ padding: '4px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: GOLD, fontSize: '12px' }}>💰</span>
            <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>${(local.debtAmount || 0).toLocaleString()}</span>
          </div>
          {debtTypes.map(type => (
            <span key={type} style={{ padding: '1px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', background: type === 'Unsecured Credit Card' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)', color: type === 'Unsecured Credit Card' ? BLUE : '#a78bfa', whiteSpace: 'nowrap' }}>
              {type === 'Unsecured Credit Card' ? '💳' : '📄'} {type}
            </span>
          ))}
        </div>
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
          <FronterCardActions
            status={local.status || 'prospect'}
            isAdmin={isAdmin}
            credsSent={!!local.credsSentAt}
            headsUpSent={headsUpSent}
            headsUpSending={headsUpSending}
            onHeadsUp={sendHeadsUp}
            onCreds={() => setShowCredsPopup(true)}
            onInterested={() => { setMeetingDisposition('interested'); setShowMeetingScheduler(true); }}
            onTransferred={markTransferred}
            onEmailSent={markEmailSent}
            onClosedDeal={markClosedDeal}
            onNext={onNext}
            onClose={onClose}
            onQA={() => { setShowQAPanel(p => !p); onOpenQA?.(); }}
          />
        </div>

        {/* Green screen — embedded dialer with real call controls */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'rgba(0,0,0,0.2)', padding: '0 14px' }}>
          <FronterDialer
            lead={local}
            username={username}
            lineKey={lineKey}
            lineNumber={lineNumber}
            embedded
            onDial={onDial}
            onCallConnected={(l) => {
            setCallActive(true);
            setCallStartTime(Date.now());
            setCardTab('script');
            setShowQAPanel(true);
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
                  <FronterHardshipField value={local.hardshipQualification} onChange={v => update('hardshipQualification', v)} labelStyle={ls} inputStyle={inp} />
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

          {cardTab === 'checklist' && (
            <FronterLeadConfirmedChecklist
              lead={local}
              username={username}
              embedded
              onAllComplete={() => setShowMergePopup(true)}
              onEmailCreds={() => setShowCredsPopup(true)}
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

      {/* Company credentials email popup */}
      {showCredsPopup && (
        <FronterCredsEmailPopup
          lead={local}
          username={username}
          onClose={() => setShowCredsPopup(false)}
          onSent={(updated) => { setLocal(prev => ({ ...prev, ...updated })); setShowCredsPopup(false); onSave?.({ ...local, ...updated }); }}
        />
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

      {/* Merge popup — when all checklist items are complete */}
      {showMergePopup && (
        <FronterMergePopup
          lead={local}
          username={username}
          fronterFirstName={fronterFirstName}
          isAdmin={isAdmin}
          callActive={callActive}
          callDuration={callDuration}
          onMerge={() => { setShowMergePopup(false); markTransferred(); }}
          onClose={() => setShowMergePopup(false)}
        />
      )}

      {/* Live Q&A floating panel — toggled by Q&A button or auto-opened on call connect */}
      {showQAPanel && (
        <div style={{ position: 'fixed', top: 80, right: 20, width: 720, height: 560, background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.4)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.85)', zIndex: 21000, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Georgia, serif' }}>
          <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'move', userSelect: 'none', flexShrink: 0 }}
            onMouseDown={(e) => {
              const startX = e.clientX, startY = e.clientY, startL = e.currentTarget.parentElement.offsetLeft, startT = e.currentTarget.parentElement.offsetTop;
              const onMove = (ev) => { e.currentTarget.parentElement.style.left = (startL + ev.clientX - startX) + 'px'; e.currentTarget.parentElement.style.top = (startT + ev.clientY - startY) + 'px'; e.currentTarget.parentElement.style.right = 'auto'; };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}>
            <span style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>💬 Live Q&A</span>
            {callActive && <span style={{ color: GOLD, fontSize: '10px' }}>· Call Active</span>}
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowQAPanel(false)} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '3px 11px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <FronterAIPanel
              transcript={liveTranscript}
              isActive={callActive || liveTranscript.length > 0}
              transcriptFormat="live"
              username={username}
              autoOpenPopup={false}
              lead={local}
            />
          </div>
        </div>
      )}
    </>
  );
}