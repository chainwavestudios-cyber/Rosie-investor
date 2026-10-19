/**
 * CalendarContactCard.jsx — Modal contact card opened from the Admin Assistant
 * calendar. Two tabs:
 *   • Overview  — contact info + appointment details
 *   • Call & Trans — softphone to call the client, then warm-merge & transfer
 *     to a senior advisor. While the client waits on hold, they hear the
 *     configured welcome / hold audio (managed in Fronter Hold Audio).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const ORANGE = '#f97316';

// Senior advisor transfer targets (same as the fronter merge flow).
const CHRIS_NUMBERS = ['+16193530919', '+12162586934'];
const CHRIS_LABELS = ['619-353-0919', '216-258-6934'];

const fmtDur = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
const fmtAppt = (d) => d ? new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export default function CalendarContactCard({ lead, username, onClose, onSave }) {
  const [tab, setTab] = useState('overview');

  // ── Softphone state ──
  const [lines, setLines] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [callStatus, setCallStatus] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [callErr, setCallErr] = useState('');

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  // ── Merge / transfer state ──
  const [mergeState, setMergeState] = useState('idle'); // idle|dialing|connected|merging|done|no_answer|failed
  const [conferenceName, setConferenceName] = useState('');
  const [agentCallSid, setAgentCallSid] = useState('');
  const [customerCallSid, setCustomerCallSid] = useState('');
  const [currentNumberIdx, setCurrentNumberIdx] = useState(0);
  const [mergeMsg, setMergeMsg] = useState('');
  const [mergeErr, setMergeErr] = useState('');
  const [noConnectBusy, setNoConnectBusy] = useState(false);
  const pollRef = useRef(null);

  // ── Hold audio state ──
  const [holdAudio, setHoldAudio] = useState(null);
  const [holdPreview, setHoldPreview] = useState('');

  // ── Credentials email state ──
  const [credsTemplate, setCredsTemplate] = useState(null);
  const [credsSending, setCredsSending] = useState(false);
  const [credsSent, setCredsSent] = useState(false);
  const [credsOpened, setCredsOpened] = useState(false);
  const [credsErr, setCredsErr] = useState('');

  const callActive = ['calling', 'ringing', 'connected'].includes(callStatus);
  const callSid = callRef.current?.parameters?.CallSid || '';

  // ── Load Twilio lines + active hold audio ──
  useEffect(() => {
    base44.functions.invoke('twilioGetLines', {}).then(res => {
      const l = res?.data?.lines || res?.lines || [];
      setLines(l);
      if (l[0]) setSelectedLine(l[0].number);
    }).catch(e => setCallErr('Could not load Twilio lines: ' + e.message));

    base44.entities.FronterHoldAudio.filter({ isActive: true }, '-uploadedAt', 1).then(async (all) => {
      const cur = all?.[0] || null;
      setHoldAudio(cur);
      if (cur?.fileUri) {
        try {
          const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: cur.fileUri, expires_in: 300 });
          setHoldPreview(signed?.signed_url || '');
        } catch { setHoldPreview(''); }
      }
    }).catch(() => {});
  }, []);

  // ── Load the "credentials" email template + open tracking for this lead ──
  useEffect(() => {
    if (!lead?.id) return;
    setCredsSent(false); setCredsOpened(false); setCredsErr(''); setCredsTemplate(null);
    (async () => {
      try {
        const page = await base44.entities.DebtEmailTemplate.filter({}, { sort: 'sortOrder', limit: 100, fields: ['name', 'subject', 'bodyHtml', 'attachToContactCard', 'buttonLabel'] });
        const all = page?.items || page || [];
        const match = all.find(t => (t.name || '').trim().toLowerCase() === 'credentials');
        if (match) setCredsTemplate(match);
      } catch {}
      try {
        const evs = await base44.entities.EmailTrackingEvent.filter({ leadId: lead.id }, '-trackedAt', 50);
        const arr = evs?.items || evs || [];
        const credEv = arr.find(e => (e.templateName || '').toLowerCase() === 'credentials' || (e.templateId && credsTemplate?.id === e.templateId));
        if (arr.some(e => e.eventType === 'open' && ((e.templateName || '').toLowerCase() === 'credentials' || (credsTemplate && e.templateId === credsTemplate.id)))) setCredsOpened(true);
        if (arr.some(e => ((e.templateName || '').toLowerCase() === 'credentials' || (credsTemplate && e.templateId === credsTemplate.id)))) setCredsSent(true);
      } catch {}
    })();
  }, [lead?.id]);

  const sendCredentialsEmail = async () => {
    if (!lead?.id) { setCredsErr('No lead loaded.'); return; }
    if (!lead?.email) { setCredsErr('Lead has no email address.'); return; }
    let tpl = credsTemplate;
    if (!tpl) {
      try {
        const page = await base44.entities.DebtEmailTemplate.filter({}, { sort: 'sortOrder', limit: 100 });
        const all = page?.items || page || [];
        tpl = all.find(t => (t.name || '').trim().toLowerCase() === 'credentials') || null;
        if (tpl) setCredsTemplate(tpl);
      } catch {}
    }
    if (!tpl) { setCredsErr('No email template named "credentials" found. Create one in Debt Emails and name it "credentials".'); return; }
    setCredsSending(true); setCredsErr('');
    try {
      const res = await base44.functions.invoke('sendDebtEmail', { templateId: tpl.id, leadId: lead.id });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setCredsSent(true);
    } catch (e) { setCredsErr('Send failed: ' + (e?.message || String(e))); }
    setCredsSending(false);
  };

  // ── Cleanup on unmount ──
  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    try { callRef.current?.disconnect(); } catch {}
    try { deviceRef.current?.destroy(); } catch {}
  }, []);

  const startTimer = () => { startRef.current = Date.now(); clearInterval(timerRef.current); timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startRef.current) / 1000)), 1000); };
  const stopTimer = () => clearInterval(timerRef.current);

  const getDevice = async () => {
    if (deviceRef.current) return deviceRef.current;
    const res = await base44.functions.invoke('fronterClientToken', { username });
    const token = res?.data?.token || res?.token;
    if (!token) throw new Error('No Twilio token');
    const device = new Device(token, { codecPreferences: ['opus', 'pcmu'], fakeLocalDTMF: true, enableRingingState: true, logLevel: 'error' });
    await new Promise((resolve, reject) => { device.once('registered', resolve); device.once('error', reject); device.register(); });
    deviceRef.current = device;
    return device;
  };

  const wireCall = (call) => {
    call.on('ringing', () => setCallStatus('ringing'));
    call.on('accept', () => { setCallStatus('connected'); startTimer(); });
    call.on('disconnect', () => { callRef.current = null; stopTimer(); setCallStatus('idle'); setMuted(false); resetMerge(); });
    call.on('cancel', () => { callRef.current = null; stopTimer(); setCallStatus('idle'); resetMerge(); });
    call.on('error', (e) => { if (e?.code !== 31000) setCallErr(e.message); callRef.current = null; stopTimer(); setCallStatus('idle'); resetMerge(); });
  };

  const resetMerge = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setMergeState('idle'); setConferenceName(''); setAgentCallSid(''); setCustomerCallSid('');
    setCurrentNumberIdx(0); setMergeMsg(''); setMergeErr('');
  };

  const dial = async () => {
    const raw = (lead?.phone || '').toString();
    const digits = raw.replace(/\D/g, '');
    const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : raw;
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) { setCallErr('Lead has no valid phone number'); return; }
    if (!selectedLine) { setCallErr('Select a Twilio line first'); return; }
    setCallErr(''); setCallStatus('calling'); setDuration(0); resetMerge();
    try {
      const device = await getDevice();
      const call = await device.connect({ params: { To: e164, CallerId: selectedLine } });
      callRef.current = call;
      wireCall(call);
    } catch (e) { setCallErr(e.message || String(e)); setCallStatus('idle'); }
  };

  const hangup = () => { try { callRef.current?.disconnect(); } catch {} callRef.current = null; stopTimer(); setCallStatus('idle'); resetMerge(); };

  const toggleMute = () => {
    if (!callRef.current) return;
    setMuted(p => { const n = !p; try { callRef.current?.mute(n); } catch {} return n; });
  };

  // ── Merge: dial the senior advisor (customer goes on hold w/ hold audio) ──
  const dialAdvisor = async (idx) => {
    if (!callSid || !callActive || !selectedLine) { setMergeErr('Start a call to the client first.'); return; }
    setMergeState('dialing'); setMergeErr(''); setMergeMsg(`Dialing advisor on ${CHRIS_LABELS[idx]}…`);
    try {
      const res = await base44.functions.invoke('fronterCall', {
        action: 'mergeDial', fronterCallSid: callSid, conferenceName: conferenceName || undefined,
        customerCallSid: customerCallSid || undefined, agentPhone: CHRIS_NUMBERS[idx], lineKey: selectedLine,
        leadId: lead?.id, leadEmail: lead?.email,
      });
      const data = res?.data || res;
      if (data?.conferenceName) {
        setConferenceName(data.conferenceName);
        setAgentCallSid(data.agentCallSid || '');
        if (data.customerCallSid) setCustomerCallSid(data.customerCallSid);
        setMergeMsg(`Advisor line ringing on ${CHRIS_LABELS[idx]} — client on hold listening to hold audio…`);
        const agentSid = data.agentCallSid || '';
        if (agentSid) {
          let wasInProgress = false;
          pollRef.current = setInterval(async () => {
            try {
              const sr = await base44.functions.invoke('fronterCall', { action: 'getAgentCallStatus', agentCallSid: agentSid });
              const sd = sr?.data || sr; const st = sd?.status || '';
              if (st === 'in-progress') { wasInProgress = true; clearInterval(pollRef.current); pollRef.current = null; setMergeState('connected'); setMergeMsg('✓ Advisor answered on ' + CHRIS_LABELS[idx]); }
              if (wasInProgress) { if (st === 'completed') { clearInterval(pollRef.current); pollRef.current = null; setMergeState('no_answer'); setMergeMsg('Advisor hung up on ' + CHRIS_LABELS[idx]); } }
              else if (st === 'no-answer' || st === 'busy' || st === 'failed' || st === 'canceled') { clearInterval(pollRef.current); pollRef.current = null; setMergeState('no_answer'); setMergeMsg('No answer on ' + CHRIS_LABELS[idx]); }
            } catch {}
          }, 2000);
        }
      } else { setMergeState('failed'); setMergeMsg(''); setMergeErr('Could not start the merge — no conference created.'); }
    } catch (e) { setMergeState('failed'); setMergeMsg(''); setMergeErr('Merge dial failed: ' + (e?.message || String(e))); }
  };

  const handleDialAdvisor = () => { if (mergeState !== 'idle') return; setCurrentNumberIdx(0); dialAdvisor(0); };

  const handleHangupTryNext = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setMergeMsg('');
    if (agentCallSid) { try { await base44.functions.invoke('fronterCall', { action: 'cancelAgentCall', agentCallSid }); } catch {} }
    const next = currentNumberIdx + 1;
    if (next < CHRIS_NUMBERS.length) { setCurrentNumberIdx(next); setMergeMsg(`Hanging up ${CHRIS_LABELS[currentNumberIdx]} — trying ${CHRIS_LABELS[next]}…`); setMergeState('idle'); setTimeout(() => dialAdvisor(next), 1000); }
    else { setMergeState('no_answer'); setMergeMsg(''); }
  };

  const handleMergeTransfer = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setMergeState('merging'); setMergeErr('');
    try {
      await base44.functions.invoke('fronterCall', { action: 'mergeConnect', conferenceName, fronterCallSid: callSid });
      setMergeState('done'); setMergeMsg('✓ Transfer complete — client is now with the advisor.');
    } catch (e) { setMergeState('connected'); setMergeErr('Connect failed: ' + (e?.message || String(e))); }
  };

  const handleNoConnect = async () => {
    if (noConnectBusy) return;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setMergeErr(''); setNoConnectBusy(true);
    try {
      const res = await base44.functions.invoke('fronterCall', {
        action: 'noConnect', conferenceName, fronterCallSid: callSid, agentCallSid, customerCallSid,
        leadId: lead?.id, leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
        leadPhone: lead?.phone || '', leadEmail: lead?.email || '', fronterUsername: username, lineKey: selectedLine,
      });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'The client could not be queued.');
      setMergeState('done'); setMergeMsg('Client left on hold in the queue (no connect).');
    } catch (e) { setMergeErr('NO CONNECT failed: ' + (e?.response?.data?.error || e?.message || String(e))); }
    finally { setNoConnectBusy(false); }
  };

  const canDialAdvisor = mergeState === 'idle' && callSid && callActive && selectedLine;
  const canMerge = !noConnectBusy && mergeState === 'connected';
  const canNoConnect = !noConnectBusy && (mergeState === 'connected' || mergeState === 'dialing' || mergeState === 'no_answer');
  const canTryNext = !noConnectBusy && (mergeState === 'connected' || mergeState === 'no_answer') && currentNumberIdx < CHRIS_NUMBERS.length - 1;
  const isLastNumber = currentNumberIdx >= CHRIS_NUMBERS.length - 1;
  const clientOnHold = mergeState === 'dialing' || mergeState === 'connected' || mergeState === 'merging';

  const fullName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || '(no name)';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '92vh', background: '#0d1b2a', border: `1px solid ${GOLD}33`, borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${GOLD}22`, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}>{(lead?.firstName?.[0] || '?').toUpperCase()}{(lead?.lastName?.[0] || '').toUpperCase()}</div>
            <div>
              <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{fullName}</div>
              <div style={{ color: '#6b7280', fontSize: '11px' }}>📅 Calendar Contact Card</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', width: 30, height: 30, cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[['overview', '📋 Overview'], ['calltrans', '📞 Call & Trans']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: tab === id ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: tab === id ? `2px solid ${GOLD}` : '2px solid transparent', color: tab === id ? GOLD : '#6b7280', padding: '11px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{label}</button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '18px' }}>
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>Appointment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Date / Time" value={fmtAppt(lead?.appointmentDate)} />
                  <Field label="Confirmed" value={lead?.appointmentConfirmed ? '✓ Yes' : '✗ No'} color={lead?.appointmentConfirmed ? GOLD : AMBER} />
                  <Field label="Title" value={lead?.appointmentTitle || '—'} />
                  <Field label="Status" value={lead?.status || '—'} />
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>Contact</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div>
                    <div style={{ color: BLUE, fontSize: '16px', fontWeight: 'bold', marginTop: '2px' }}>{lead?.phone || '—'}</div>
                  </div>
                  <button onClick={() => { setTab('calltrans'); setTimeout(dial, 200); }} disabled={!lead?.phone} style={{ background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '6px', padding: '10px 16px', cursor: lead?.phone ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: lead?.phone ? 1 : 0.4, whiteSpace: 'nowrap' }}>📞 Quick Dial</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Email" value={lead?.email || '—'} />
                  <Field label="City" value={lead?.city || '—'} />
                  <Field label="State" value={lead?.state || '—'} />
                </div>
              </div>
              {lead?.callbackAt && <div style={{ background: `${PURPLE}10`, border: `1px solid ${PURPLE}33`, borderRadius: '6px', padding: '12px', color: PURPLE, fontSize: '12px' }}>📞 Callback scheduled: {fmtAppt(lead.callbackAt)}</div>}
              {lead?.isHotLead && <div style={{ background: `${ORANGE}10`, border: `1px solid ${ORANGE}33`, borderRadius: '6px', padding: '12px', color: ORANGE, fontSize: '12px' }}>🔥 Hot lead — priority follow-up</div>}

              {/* Send Credentials Email */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>🔑 Credentials Email</div>
                <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px', lineHeight: 1.5 }}>
                  Sends the email template named <strong style={{ color: GOLD }}>“credentials”</strong> (the one with the welcome message). Tracked for opens & clicks.
                </div>
                {credsErr && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {credsErr}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: credsSent ? (credsOpened ? GOLD : AMBER) : '#6b7280' }}>
                    {credsSent ? (credsOpened ? '✓ Sent & Opened' : '✓ Sent (not opened yet)') : 'Not sent yet'}
                  </span>
                </div>
                <button onClick={sendCredentialsEmail} disabled={credsSending || !lead?.email} style={{ width: '100%', background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '6px', padding: '11px', cursor: (credsSending || !lead?.email) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: (credsSending || !lead?.email) ? 0.5 : 1 }}>
                  {credsSending ? '⏳ Sending…' : '🔑 Send Credentials Email'}
                </button>
                {!lead?.email && <div style={{ color: AMBER, fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>Lead has no email address</div>}
              </div>

              <button onClick={() => setTab('calltrans')} style={{ background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>📞 Go to Call & Transfer</button>
            </div>
          )}

          {/* ── CALL & TRANS ── */}
          {tab === 'calltrans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Hold audio status */}
              <div style={{ background: clientOnHold ? `${GOLD}10` : 'rgba(255,255,255,0.03)', border: `1px solid ${clientOnHold ? GOLD + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px' }}>{clientOnHold ? '🎵' : '🎶'}</span>
                  <span style={{ color: clientOnHold ? GOLD : '#8a9ab8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{clientOnHold ? 'Client On Hold' : 'Hold Audio'}</span>
                </div>
                <div style={{ color: '#e8e0d0', fontSize: '12px' }}>{holdAudio ? holdAudio.fileName : 'No custom hold audio — Twilio default hold music'}</div>
                {clientOnHold && <div style={{ color: GOLD, fontSize: '11px', marginTop: '4px' }}>Client is listening to the welcome / hold audio while waiting to be merged.</div>}
                {holdPreview && !clientOnHold && <audio controls src={holdPreview} style={{ width: '100%', height: '32px', marginTop: '8px' }} />}
              </div>

              {/* Softphone */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>📞 Call the Client</div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase' }}>Outbound Line</label>
                  <select value={selectedLine} onChange={e => setSelectedLine(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', marginTop: '4px' }}>
                    {lines.map(l => <option key={l.key} value={l.number}>{l.number} {l.assignedTo ? `(${l.assignedTo})` : ''}</option>)}
                  </select>
                </div>
                <div style={{ color: '#e8e0d0', fontSize: '13px', marginBottom: '10px' }}>👤 {fullName} · <span style={{ color: BLUE }}>{lead?.phone || '—'}</span></div>
                {callErr && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {callErr}</div>}
                {callActive && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${callStatus === 'connected' ? '#4ade8033' : AMBER + '33'}`, borderRadius: '6px', padding: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: callStatus === 'connected' ? '#4ade80' : AMBER, animation: 'pulse 1s infinite' }} />
                      <span style={{ color: callStatus === 'connected' ? '#4ade80' : AMBER, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{callStatus}{muted ? ' · MUTED' : ''}</span>
                      <span style={{ marginLeft: 'auto', color: callStatus === 'connected' ? '#4ade80' : AMBER, fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold' }}>{callStatus === 'connected' ? fmtDur(duration) : '--:--'}</span>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {!callActive ? (
                    <button onClick={dial} style={{ flex: 1, background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '11px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>📞 Call Client</button>
                  ) : (
                    <>
                      {callStatus === 'connected' && <button onClick={toggleMute} style={{ background: muted ? `${RED}22` : 'rgba(255,255,255,0.05)', color: muted ? RED : '#c4cdd8', border: `1px solid ${muted ? RED + '55' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '11px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{muted ? '🔇' : '🎤'}</button>}
                      <button onClick={hangup} style={{ flex: 1, background: `${RED}22`, color: RED, border: `1px solid ${RED}55`, borderRadius: '4px', padding: '11px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>📵 Hang Up</button>
                    </>
                  )}
                </div>
              </div>

              {/* Merge & Transfer */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>🔀 Merge & Transfer to Advisor</div>
                <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px', lineHeight: 1.5 }}>Call the client first, then dial the senior advisor. The client is placed on hold and hears the welcome / hold audio until you merge.</div>
                {mergeErr && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>⚠ {mergeErr}</div>}
                {mergeMsg && <div style={{ color: BLUE, fontSize: '11px', marginBottom: '8px' }}>⏳ {mergeMsg}</div>}

                {mergeState === 'idle' && (
                  <button onClick={handleDialAdvisor} disabled={!canDialAdvisor} style={{ width: '100%', background: canDialAdvisor ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(255,255,255,0.05)', color: canDialAdvisor ? DARK : '#6b7280', border: 'none', borderRadius: '6px', padding: '13px', cursor: canDialAdvisor ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: 'bold', opacity: canDialAdvisor ? 1 : 0.5 }}>📞 Dial Advisor ({CHRIS_LABELS[0]})</button>
                )}
                {mergeState === 'dialing' && (
                  <button disabled style={{ width: '100%', background: `${BLUE}15`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '6px', padding: '13px', fontSize: '14px', fontWeight: 'bold', cursor: 'wait' }}>⏳ Dialing advisor on {CHRIS_LABELS[currentNumberIdx]}…</button>
                )}
                {(mergeState === 'connected' || mergeState === 'merging') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button onClick={handleMergeTransfer} disabled={!canMerge} style={{ width: '100%', background: canMerge ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(255,255,255,0.05)', color: canMerge ? DARK : '#6b7280', border: 'none', borderRadius: '6px', padding: '13px', cursor: canMerge ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: 'bold', opacity: canMerge ? 1 : 0.5 }}>{mergeState === 'merging' ? '⏳ Bridging…' : '🔀 Merge & Transfer'}</button>
                    {canTryNext && <button onClick={handleHangupTryNext} style={{ width: '100%', background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '11px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>📞 Hangup & Try 2nd Line ({CHRIS_LABELS[currentNumberIdx + 1]})</button>}
                  </div>
                )}
                {mergeState === 'done' && <div style={{ width: '100%', textAlign: 'center', background: 'rgba(16,185,129,0.12)', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '13px', fontSize: '14px', fontWeight: 'bold' }}>✓ Transfer Complete</div>}
                {mergeState === 'no_answer' && isLastNumber && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ color: RED, fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>⚠ Advisor Isn't Available</div>
                    <div style={{ color: '#8a9ab8', fontSize: '11px' }}>Both numbers tried. The client is still on hold.</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={handleNoConnect} disabled={!canNoConnect} style={{ flex: 1, background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '11px', cursor: canNoConnect ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', opacity: canNoConnect ? 1 : 0.5 }}>{noConnectBusy ? 'Queuing…' : '🚫 NO CONNECT'}</button>
                </div>
                {mergeState === 'idle' && !canDialAdvisor && <div style={{ color: AMBER, fontSize: '11px', textAlign: 'center', marginTop: '6px' }}>{!callActive ? 'Start a call to the client first.' : 'Waiting for call details…'}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, color }) {
  return (
    <div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ color: color || '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginTop: '2px', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}