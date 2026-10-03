/**
 * DebtLiveCall.jsx — Live call coaching with debt settlement lead contact card.
 * Captures headset mic → Deepgram (diarize + sentiment) → live Q&A/Coach/Intent + profile building.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import DebtLeadCard from '@/components/debt/DebtLeadCard';
import { DebtPitchPanel } from '@/components/debt/DebtPitchTab';
import DebtIntentSignals, { DEBT_INTENT_RULES } from '@/components/debt/DebtIntentSignals';
import LiveTranscriptPanel from '@/components/debt/LiveTranscriptPanel';
import LiveScriptsPanel from '@/components/debt/LiveScriptsPanel';
import DebtAIPanel from '@/components/debt/DebtAIPanel';
import DoNothingCalculator from '@/components/debt/DoNothingCalculator';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import LiveComplianceWidget from '@/components/compliance/LiveComplianceWidget';
import CustomerStatsPopup from '@/components/debt/CustomerStatsPopup';
import NextCallBriefing from '@/components/debt/NextCallBriefing';
import NoMissedMeetingsButton from '@/components/debt/NoMissedMeetingsButton';
import AppointmentPreviewModal from '@/components/debt/AppointmentPreviewModal';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';
import { notifyCreditExhaustion, checkAIResponseForCreditError, checkErrorForCreditError } from '@/lib/creditAlert';
import { useHotCallTracker } from '@/hooks/useHotCallTracker';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { useDebtCoachValue } from '@/lib/debtCoachStorage';
import EndCallDialog from '@/components/debt/EndCallDialog';
import { logAIUsage, CREDIT_ESTIMATES } from '@/lib/aiCreditLog';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const DEBT_KB_CATEGORIES = ['debt_agent', 'debt_customer', 'debt_qa_statements', 'debt_doc', 'debt_web', 'debt_call', 'debt_kb', 'debt_faq', 'debt_hotpoints'];

// Deepgram Nova-3 keyterm prompting — boosts recognition of debt settlement vocabulary
// that the model mishears (e.g. "pay" → "training"). Nova-3 uses repeated keyterm= params.
// Extracted from real Drew call transcripts — creditor names, financial terms, phrases.
const DEBT_KEYTERMS = [
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

// Wrapper for liveAssistantAI calls — detects credit exhaustion in responses/errors
// and triggers the CreditAlertPopup automatically.
async function invokeAI(functionName, payload) {
  try {
    const res = await base44.functions.invoke(functionName, payload);
    const creditErr = checkAIResponseForCreditError(res);
    if (creditErr) notifyCreditExhaustion(creditErr.service, creditErr.detail);
    return res;
  } catch (e) {
    const creditErr = checkErrorForCreditError(e);
    if (creditErr) notifyCreditExhaustion(creditErr.service, creditErr.detail);
    throw e;
  }
}

// Check if the agent's current script position is at or near an [[AI INPUT]] tag
function posHasAiInput(pos) {
  if (!pos?.scriptLines || pos.activeIdx == null) return false;
  return pos.scriptLines.some((l, i) => i >= pos.activeIdx - 1 && i <= pos.activeIdx + 3 && /\[\[AI\s*INPUT\]\]/i.test(l || ''));
}

export default function DebtLiveCall() {
  const { user: coachUser, can } = useDebtCoachAuth();
  const aiSettings = (() => { try { return JSON.parse(coachUser?.aiSettingsJson || '{}'); } catch { return {}; } })();
  const canLiveAI = can('liveAIAssistant') && aiSettings.liveAIEnabled !== false;
  const canLiveQA = can('liveQA') && aiSettings.liveQA !== false;
  const canLiveCoach = can('liveCoach') && aiSettings.liveCoach !== false;
  const canLiveIntent = can('liveIntent') && aiSettings.liveIntent !== false;
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId, micLoaded] = useDebtCoachValue(coachUser?.username, 'defaultMicDeviceId', '');
  const [customerMicId, setCustomerMicId, customerMicLoaded] = useDebtCoachValue(coachUser?.username, 'defaultCustomerMicId', '');
  const [outputDevices, setOutputDevices] = useState([]);
  const [outputDeviceId, setOutputDeviceId, outputLoaded] = useDebtCoachValue(coachUser?.username, 'defaultOutputDeviceId', '');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [dgStatus, setDgStatus] = useState('idle');
  const [testingAudio, setTestingAudio] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [statsPaused, setStatsPaused] = useDebtCoachValue(coachUser?.username, 'statsPaused', true);
  const [agentLevel, setAgentLevel] = useState(0);
  const [customerLevel, setCustomerLevel] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [kbLoading, setKbLoading] = useState(true);

  // Track active script position for Q&A redirect (updated by ScriptTeleprompter via LiveTranscriptPanel)
  const scriptPositionRef = useRef(null);

  // Lead
  const [leads, setLeads] = useState([]);
  const [lead, setLead] = useState({ firstName: '', lastName: '', status: 'new' });
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [memories, setMemories] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState([]);
  const [leadSearchFocus, setLeadSearchFocus] = useState(false);

  // AI tools
  const [qaActive, setQaActive] = useState(canLiveAI && canLiveQA);
  const [coachActive, setCoachActive] = useState(canLiveAI && canLiveCoach);
  const [intentActive, setIntentActive] = useState(canLiveAI && canLiveIntent);
  const [rightTab, setRightTab] = useState('ai');
  // Agent Question mode — toggle ON, ask question, toggle OFF to auto-answer in popup
  const [agentQuestionActive, setAgentQuestionActive] = useState(false);
  const agentQuestionActiveRef = useRef(false);
  const agentQuestionBufferRef = useRef([]);

  useEffect(() => { agentQuestionActiveRef.current = agentQuestionActive; }, [agentQuestionActive]);
  // Refs mirror the AI feature flags + accumulated Q&A/coach data so that
  // processNewEntry (captured by the WebSocket onmessage handler at call
  // start) and stopCall always read the LIVE values, not the stale closure
  // values from when startCall/stopCall were originally created.
  const qaActiveRef = useRef(qaActive);
  const coachActiveRef = useRef(coachActive);
  const intentActiveRef = useRef(intentActive);
  useEffect(() => { qaActiveRef.current = qaActive; }, [qaActive]);
  useEffect(() => { coachActiveRef.current = coachActive; }, [coachActive]);
  useEffect(() => { intentActiveRef.current = intentActive; }, [intentActive]);
  const [ledgerExtracting, setLedgerExtracting] = useState(false);
  const [qaItems, setQaItems] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [intentScore, setIntentScore] = useState(null);
  const qaItemsRef = useRef(qaItems);
  const coachTipsRef = useRef(coachTips);
  const intentScoreRef = useRef(intentScore);
  useEffect(() => { qaItemsRef.current = qaItems; }, [qaItems]);
  useEffect(() => { coachTipsRef.current = coachTips; }, [coachTips]);
  useEffect(() => { intentScoreRef.current = intentScore; }, [intentScore]);

  // Toggle handlers for the AI tools — update state AND ref so processNewEntry
  // (captured by the WebSocket onmessage handler) sees the change immediately.
  const toggleQaActive = useCallback(() => {
    setQaActive(prev => { const n = !prev; qaActiveRef.current = n; return n; });
  }, []);
  const toggleCoachActive = useCallback(() => {
    setCoachActive(prev => { const n = !prev; coachActiveRef.current = n; return n; });
  }, []);
  const toggleIntentActive = useCallback(() => {
    setIntentActive(prev => { const n = !prev; intentActiveRef.current = n; return n; });
  }, []);

  // Post-call
  const [report, setReport] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [callMode, setCallMode] = useState('close'); // 'open' | 'close' — derived from callType
  const [callType, setCallType] = useDebtCoachValue(coachUser?.username, 'defaultCallType', 'front_to_back'); // 'front_to_back' | 'open_only' | 'cold_call' | 'closer_call'
  const [autoSchedulerEnabled, setAutoSchedulerEnabled] = useDebtCoachValue(coachUser?.username, 'autoSchedulerEnabled', true);
  // AI feature auto-enable toggles — saved with layout (popout_ prefix)
  const [autoQA, setAutoQA] = useDebtCoachValue(coachUser?.username, 'popout_auto_qa', true);
  const [autoCoach, setAutoCoach] = useDebtCoachValue(coachUser?.username, 'popout_auto_coach', true);
  const [autoIntent, setAutoIntent] = useDebtCoachValue(coachUser?.username, 'popout_auto_intent', true);
  const [apptPreview, setApptPreview] = useState(null);
  const leadPersistedRef = useRef(false);
  const transcriptRecordIdRef = useRef(null);
  const profileAutoOpenedRef = useRef(false); // tracks if client profile was auto-opened (name or 45s)
  const autoSaveTimerRef = useRef(null); // 45-second auto-save timer
  const [showProfile, setShowProfile] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const leadPanel = usePopOutPanel('live_lead_card', { width: 420, height: 600 }, coachUser?.username);
  const transcriptPanel = usePopOutPanel('live_transcript', { width: 520, height: 600 }, coachUser?.username);
  const scriptsPanel = usePopOutPanel('live_scripts', { width: 480, height: 600 }, coachUser?.username);
  const aiPanel = usePopOutPanel('live_ai_panel', { width: 420, height: 600 }, coachUser?.username);
  const [allPoppedOut, setAllPoppedOut] = useState(false);
  const [isInbound, setIsInbound] = useState(false);
  const [layoutSavedMsg, setLayoutSavedMsg] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  // Toggle the agent mic stream tracks on/off (mutes audio sent to Deepgram)
  const toggleMicMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) { setMicMuted(false); return; }
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) return;
    const anyEnabled = tracks.some(t => t.enabled);
    tracks.forEach(t => { t.enabled = !anyEnabled; });
    setMicMuted(!anyEnabled);
  }, []);

  // 🔥 Hot Call Tracker — turbo intent engine; writes HotCallAlerts for the manager portal
  const { hotStatus, hotScore, agentScore } = useHotCallTracker({
    isActive: phase === 'live', lead, transcript, callMode, coachUser,
  });

  // Click 💡 on a transcript line → send to Q&A
  const handleAnswerQuestion = useCallback((text) => {
    setPendingQuestion({ question: text, ts: Date.now() });
  }, []);

  // Call type selector — drives callMode + isInbound
  const handleCallTypeChange = useCallback((type) => {
    setCallType(type);
    if (type === 'front_to_back') { setCallMode('close'); setIsInbound(true); }
    else if (type === 'open_only') { setCallMode('open'); setIsInbound(true); }
    else if (type === 'cold_call') { setCallMode('open'); setIsInbound(false); }
    else if (type === 'closer_call') { setCallMode('close'); setIsInbound(true); }
  }, [setCallType]);

  // Sync callMode + isInbound when saved callType loads from DB
  useEffect(() => {
    if (callType === 'front_to_back') { setCallMode('close'); setIsInbound(true); }
    else if (callType === 'open_only') { setCallMode('open'); setIsInbound(true); }
    else if (callType === 'cold_call') { setCallMode('open'); setIsInbound(false); }
    else if (callType === 'closer_call') { setCallMode('close'); setIsInbound(true); }
  }, [callType]);

  const toggleAutoScheduler = useCallback(() => {
    setAutoSchedulerEnabled(prev => !prev);
  }, [setAutoSchedulerEnabled]);

  // Cold call: extract "May I speak with John Smith please" from the first agent lines
  const handleColdCallNameExtract = useCallback(async () => {
    if (!transcriptRef.current || transcriptRef.current.length < 1) return;
    const firstAgentLines = transcriptRef.current.filter(l => l.speaker === 0).slice(0, 3).map(l => l.text).join(' ');
    if (!firstAgentLines || firstAgentLines.length < 10) return;
    try {
      logAI('cold_call_name');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract the customer's first and last name from this opening cold-call line. The agent says something like "May I speak with John Smith please?" or "Hi, is this Jane Doe?"

Return JSON with firstName and lastName. If you cannot find a name, return empty strings.

Agent line: "${firstAgentLines}"`,
        response_json_schema: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      });
      if (result?.firstName || result?.lastName) {
        const curFirst = (leadRef.current.firstName || '').trim();
        const curLast = (leadRef.current.lastName || '').trim();
        // Only update if the lead is still a blank/new placeholder
        const updates = {};
        if (result.firstName && (!curFirst || curFirst.toLowerCase() === 'new')) updates.firstName = result.firstName;
        if (result.lastName && (!curLast || curLast.toLowerCase() === 'lead')) updates.lastName = result.lastName;
        if (Object.keys(updates).length > 0) {
          setLead(prev => ({ ...prev, ...updates }));
          window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: Object.keys(updates) }));
        }
      }
    } catch {}
  }, []);

  // Cold call: detect genuine interest and auto-save the lead if so
  const INTEREST_PHRASES = ['sounds interesting', 'tell me more', 'i\'m interested', 'how does this work', 'what do i need to do', 'sign me up', 'let\'s do it', 'what are the next steps', 'how do we get started', 'how do i get started', 'i like the sound of that', 'this could work', 'what\'s the next step', 'i want to do this', 'where do i sign', 'let\'s move forward'];
  const handleColdCallInterestCheck = useCallback(async (text) => {
    if (callType !== 'cold_call') return;
    if (leadPersistedRef.current) return; // already marked as interested
    const lower = text.toLowerCase();
    if (!INTEREST_PHRASES.some(p => lower.includes(p))) return;
    // Interest detected — update the existing lead's notes (lead was already
    // persisted at call start, so we just flag it with interest).
    const lead = leadRef.current;
    if (!lead?.id) return;
    if (!lead.firstName || lead.firstName.toLowerCase() === 'new') return; // no name yet
    try {
      await base44.entities.DebtLead.update(lead.id, {
        notes: 'Auto-saved: genuine interest detected during cold call.',
      });
      leadPersistedRef.current = true;
      window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: ['interest_save'] }));
    } catch (e) { console.error('Cold call interest save failed:', e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callType, coachUser]);

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const customerStreamRef = useRef(null);
  const ctxRef = useRef(null);
  const processorRef = useRef(null);
  const transcriptRef = useRef([]);
  const leadRef = useRef(lead);
  const lastCoachTime = useRef(0);
  const lastIntentTime = useRef(0);
  const lastProfileTime = useRef(0);
  const lastLedgerTime = useRef(0);
  const lastBillsTime = useRef(0);
  const lastHardshipTime = useRef(0);
  const lastCosignerTime = useRef(0);
  const lastContactTime = useRef(0);
  const lastCreditTime = useRef(0);
  const lastComplianceTime = useRef(0);
  // "Done" refs — once a mid-call extractor has run in its time window, it
  // won't run again until the end-of-call sweep in stopCall.
  const ledgerDoneRef = useRef(false);
  const hardshipDoneRef = useRef(false);
  const billsDoneRef = useRef(false);
  // Per-extractor cursors — track last transcript line index sent to each
  // extractor so only NEW lines are sent (not the full 8000 chars every time).
  const contactCursorRef = useRef(0);
  const ledgerCursorRef = useRef(0);
  const hardshipCursorRef = useRef(0);
  const billsCursorRef = useRef(0);
  const cosignerCursorRef = useRef(0);
  const creditCursorRef = useRef(0);
  const profileCursorRef = useRef(0);
  // Debounce: only fire runTimedExtractors every N lines or on speaker change
  const extractLineCounterRef = useRef(0);
  const lastSpeakerRef = useRef(null);
  const handoffAttemptsRef = useRef(0);
  const inboundRef = useRef(false);
  const transferAgentDoneRef = useRef(false); // true once agent says "can you hear me ok" — transfer agent leaves
  const transferAgentDetectedRef = useRef(false); // true once regex extracts data from transfer agent's intro
  const callStartRef = useRef(null);
  const intentHistoryRef = useRef([]);
  const testCtxRef = useRef(null);
  const testAgentStreamRef = useRef(null);
  const testCustomerStreamRef = useRef(null);
  const testAnimRef = useRef(null);
  const customerBufferRef = useRef([]);
  const bufferTimeoutRef = useRef(null);
  const monitorPcRef = useRef(null);
  const stopCallRef = useRef(null);

  useEffect(() => { leadRef.current = lead; }, [lead]);
  useEffect(() => { inboundRef.current = isInbound; }, [isInbound]);

  // Auto-pop up Client Profile when a real name is detected (transition from placeholder)
  useEffect(() => {
    if (profileAutoOpenedRef.current) return;
    if (phase !== 'live') return;
    const fn = (lead.firstName || '').trim();
    const ln = (lead.lastName || '').trim();
    // Placeholder names: 'New', 'Lead', empty
    const isPlaceholder = (!fn || fn.toLowerCase() === 'new') && (!ln || ln.toLowerCase() === 'lead');
    if (!isPlaceholder && fn && ln) {
      profileAutoOpenedRef.current = true;
      setShowProfile(true);
    }
  }, [lead.firstName, lead.lastName, phase]);

  // Load key memories for the selected lead — surfaced in AI Coach on follow-up calls
  const loadMemories = useCallback(async (leadId) => {
    if (!leadId) { setMemories([]); return; }
    try {
      const rows = await base44.entities.LeadMemory.filter({ leadId }, '-created_date', 200);
      setMemories(rows || []);
    } catch { setMemories([]); }
  }, []);

  useEffect(() => { loadMemories(lead.id); }, [lead.id, loadMemories]);

  // Listen for memory updates from fact extraction
  useEffect(() => {
    const handler = () => { if (leadRef.current?.id) loadMemories(leadRef.current.id); };
    window.addEventListener('lead_memories_updated', handler);
    return () => window.removeEventListener('lead_memories_updated', handler);
  }, [loadMemories]);

  // Load KB
  useEffect(() => {
    base44.entities.KnowledgeBase.list('-created_date', 500)
      .then(all => setKbEntries((all || []).filter(e => DEBT_KB_CATEGORIES.includes(e.category))))
      .catch(() => {}).finally(() => setKbLoading(false));
  }, []);

  // Load mic devices — auto-detect Rodecaster for customer audio (wait for saved defaults)
  useEffect(() => {
    if (!micLoaded || !customerMicLoaded || !outputLoaded) return;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0 && !micDeviceId) setMicDeviceId(mics[0].deviceId);
        const rodecaster = mics.find(m => /rode|rodecaster|røde/i.test(m.label || ''));
        if (rodecaster && !customerMicId) setCustomerMicId(rodecaster.deviceId);
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setOutputDevices(outputs);
        if (outputs.length > 0 && !outputDeviceId) setOutputDeviceId(outputs[0].deviceId);
      })
      .catch(() => {});
  }, [micLoaded, customerMicLoaded, outputLoaded]);

  // Load existing leads
  const loadLeads = useCallback(async () => {
    try {
      let all;
      if (coachUser?.role === 'dialer') {
        all = await base44.entities.DebtLead.filter({ debtCoachOwner: coachUser.username }, '-updated_date', 100);
      } else {
        all = await base44.entities.DebtLead.list('-updated_date', 100);
      }
      // Exclude soft-deleted leads (kept for 7 days before permanent deletion)
      setLeads((all || []).filter(l => !l.deletedAt));
    } catch {}
  }, [coachUser]);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Filter leads for the quick-search field next to Start Live Call
  useEffect(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q || q.length < 2) { setLeadSearchResults([]); return; }
    const filtered = (leads || []).filter(l => {
      const name = `${l.firstName || ''} ${l.lastName || ''}`.toLowerCase();
      const phone = (l.phone || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    }).slice(0, 8);
    setLeadSearchResults(filtered);
  }, [leadSearch, leads]);

  // Select a lead from the quick-search and start the call
  const selectLeadAndStartCall = useCallback(async (selectedLead) => {
    setLeadSearch(''); setLeadSearchResults([]); setLeadSearchFocus(false);
    setLead(selectedLead);
    leadRef.current = selectedLead;
    setProfileData(selectedLead.profileJson ? (() => { try { return JSON.parse(selectedLead.profileJson); } catch { return null; } })() : null);
    setShowProfile(true);
    // Start the call with this lead
    setTimeout(() => startCall(false), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After Save on the lead card: lead is persisted in the card; here we close the card and open the Client Profile
  const handleLeadSaved = useCallback((savedLead) => {
    setLead(savedLead);
    leadRef.current = savedLead;
    loadLeads();
    setShowProfile(true);
  }, [loadLeads]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Auto-save transcript every 15 seconds during live call (in case audio feed drops)
  useEffect(() => {
    if (phase !== 'live' || !lead.id) return;
    const interval = setInterval(async () => {
      if (transcriptRef.current.length === 0) return;
      try {
        await base44.entities.DebtLead.update(leadRef.current.id, {
          transcriptJson: JSON.stringify(transcriptRef.current),
          lastCallAt: new Date().toISOString(),
        });
        if (transcriptRecordIdRef.current) {
          await base44.entities.DebtCallTranscript.update(transcriptRecordIdRef.current, {
            leadName: `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim(),
            leadNumber: leadRef.current.leadNumber || '',
            transcriptJson: JSON.stringify(transcriptRef.current),
            transcriptLineCount: transcriptRef.current.length,
          });
        }
      } catch (e) { console.error('15s auto-save failed:', e); }
    }, 15000);
    return () => clearInterval(interval);
  }, [phase, lead.id]);

  // ── Transcript consolidation removed ──────────────────────────────────
  // endpointing=700 + speech_final-based chunk collection now produces clean
  // complete-sentence lines, so the 30s consolidateTranscript call is no
  // longer needed. The regex-based consolidateTranscript function remains
  // available for manual use if classification labels are needed.

  const createNewLead = useCallback(async () => {
    try {
      // Auto-assign lead number: find max existing number and increment
      const allLeads = await base44.entities.DebtLead.list('-created_date', 500);
      const maxNum = (allLeads || []).reduce((max, l) => {
        const n = parseInt((l.leadNumber || '').replace('#', ''), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const leadNumber = `#${String(maxNum + 1).padStart(5, '0')}`;

      const created = await base44.entities.DebtLead.create({
        firstName: lead.firstName || 'New',
        lastName: lead.lastName || 'Lead',
        status: 'new',
        callCount: 0,
        leadNumber,
        debtCoachOwner: coachUser?.username || null,
      });
      setLead(created);
      loadLeads();
      return created;
    } catch (e) { alert('Failed to create lead: ' + (e?.message || String(e))); }
  }, [lead, loadLeads, coachUser]);

  // Log an AI call to AICreditUsage for the super-admin AI Credits tab (fire-and-forget).
  const logAI = useCallback((callType) => {
    logAIUsage({
      agentUsername: coachUser?.username,
      leadId: leadRef.current?.id,
      leadName: `${leadRef.current?.firstName || ''} ${leadRef.current?.lastName || ''}`.trim(),
      leadNumber: leadRef.current?.leadNumber || '',
      transcriptId: transcriptRecordIdRef.current,
      callType,
      estimatedCredits: CREDIT_ESTIMATES[callType] ?? 1,
    });
  }, [coachUser]);

  const handleQa = useCallback((question) => {
    const id = Date.now() + Math.random();
    const startTime = Date.now();
    setQaItems(prev => [...prev, { id, question, answer: '', loading: true }]);
    logAI('qa');
    invokeAI('liveAssistantAI', { question, transcript: transcriptRef.current.slice(-8), kbEntries, kbName: 'Debt Settlement', scriptPosition: scriptPositionRef.current })
      .then(res => {
        const responseMs = Date.now() - startTime;
        // AI decided no answer is needed (small talk, greeting, etc.)
        if (res?.needs_answer === false || res?.data?.needs_answer === false) {
          setQaItems(prev => prev.filter(x => x.id !== id));
          return;
        }
        const answer = res?.answer || res?.data?.answer || 'Check knowledge base.';
        const reallyAsking = res?.really_asking || res?.data?.really_asking || '';
        const opener = res?.opener || res?.data?.opener || '';
        const detail = res?.detail || res?.data?.detail || '';
        console.log(`[QA] ${responseMs}ms${reallyAsking ? ` — ${reallyAsking}` : ''}`);
        setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer, reallyAsking, opener, detail, loading: false, responseMs } : x));
      })
      .catch(() => setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer: 'Unable to answer.', loading: false } : x)));
  }, [kbEntries]);

  // Agent Question mode — press ON, ask question, press OFF to auto-answer in the Q&A list.
  // While ON, agent mic lines are captured (not sent to Q&A). When toggled OFF,
  // the captured text is sent as a single question and the answer appears in the Q&A list.
  const toggleAgentQuestion = useCallback(() => {
    if (agentQuestionActiveRef.current) {
      const combined = agentQuestionBufferRef.current.join(' ').trim();
      agentQuestionBufferRef.current = [];
      agentQuestionActiveRef.current = false;
      setAgentQuestionActive(false);
      if (combined.length > 0) handleQa(combined);
    } else {
      agentQuestionBufferRef.current = [];
      agentQuestionActiveRef.current = true;
      setAgentQuestionActive(true);
    }
  }, [handleQa]);

  // Flush buffered customer lines as a single combined question to Q&A
  const flushCustomerBuffer = useCallback(() => {
    if (bufferTimeoutRef.current) { clearTimeout(bufferTimeoutRef.current); bufferTimeoutRef.current = null; }
    if (customerBufferRef.current.length === 0) return;
    const combined = customerBufferRef.current.join(' ').trim();
    customerBufferRef.current = [];
    if (combined.length < 12) return;
    // Send all customer statements to QA — the Sonnet model detects implied
    // questions/concerns/objections and returns needs_answer=false for small
    // talk, so non-questions are filtered server-side instead of by regex here.
    handleQa(combined);
  }, [handleQa]);

  const handleCoach = useCallback(() => {
    logAI('coach');
    invokeAI('liveAssistantAI', { transcript: transcriptRef.current.slice(-6), kbEntries, mode: 'coach' })
      .then(res => { const tip = res?.tip || res?.response || res?.answer || ''; if (tip) setCoachTips(prev => [{ tip, time: new Date() }, ...prev].slice(0, 8)); })
      .catch(() => {});
  }, [kbEntries]);

  const handleIntent = useCallback(() => {
    logAI('intent');
    invokeAI('liveAssistantAI', { transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'intent', intentRules: DEBT_INTENT_RULES })
      .then(res => {
        const score = res?.intent?.intentScore ?? res?.intentScore ?? res?.data?.intentScore;
        if (score !== undefined) {
          setIntentScore(score);
          intentHistoryRef.current.push({ score, time: new Date().toISOString(), animalType: res?.intent?.animalType || res?.animalType || null, report: res?.intent?.report || res?.report || null });
        }
      })
      .catch(() => {});
  }, [kbEntries]);

  const handleProfile = useCallback(async () => {
    if (!leadRef.current?.id) return;
    const newLines = transcriptRef.current.slice(profileCursorRef.current);
    if (newLines.length === 0) return;
    profileCursorRef.current = transcriptRef.current.length;
    try {
      logAI('profile');
      const res = await invokeAI('liveAssistantAI', {
        transcript: newLines,
        kbEntries,
        mode: 'profile',
        existingProfile: leadRef.current.profileJson || '{}',
        aiInputActive: posHasAiInput(scriptPositionRef.current),
      });
      const profile = res?.profile || res?.data?.profile;
      if (profile) {
        setProfileData(profile);
        setLead(prev => ({ ...prev, profileJson: JSON.stringify(profile), animalType: profile.animalType, intentScore: intentScore ?? prev.intentScore }));
      }
    } catch {}
  }, [kbEntries, intentScore]);

  const handleDebtExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    const newLines = transcriptRef.current.slice(ledgerCursorRef.current);
    if (newLines.length === 0) return;
    ledgerCursorRef.current = transcriptRef.current.length;
    setLedgerExtracting(true);
    logAI('debt_extract');
    try {
      const recentText = newLines.map(t => t.text).join(' ').slice(0, 8000);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a live debt settlement call transcript. Extract any creditor/debt information the customer mentions. Look for:
- Creditor names (Chase, Capital One, Discover, Amex, etc.)
- Account balances
- Interest rates
- Monthly payment amounts
- Payment schedules
- Account last-4 digits

Return JSON with a "creditors" array. Only include information explicitly mentioned — do NOT make up data. If nothing new is mentioned, return empty array.

Transcript:
${recentText}`,
        response_json_schema: {
          type: 'object',
          properties: {
            creditors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  creditor: { type: 'string' },
                  balance: { type: 'number' },
                  interestRate: { type: 'number' },
                  monthlyPayment: { type: 'number' },
                  paymentSchedule: { type: 'string' },
                  accountLast4: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const extracted = result?.creditors || [];
      if (extracted.length > 0) {
        const existing = (() => { try { return JSON.parse(leadRef.current.debtLedgerJson || '[]'); } catch { return []; } })();
        // Merge: only add creditors not already in the ledger (match by name)
        const existingNames = existing.map(c => (c.creditor || '').toLowerCase());
        const newEntries = extracted.filter(c => c.creditor && !existingNames.includes(c.creditor.toLowerCase()));
        if (newEntries.length > 0) {
          const merged = [...existing, ...newEntries];
          setLead(prev => ({ ...prev, debtLedgerJson: JSON.stringify(merged) }));
          // Auto-save to entity
          if (leadRef.current.id) {
            base44.entities.DebtLead.update(leadRef.current.id, { debtLedgerJson: JSON.stringify(merged), debtAmount: merged.reduce((s, c) => s + (c.balance || 0), 0), creditorCount: merged.length }).catch(() => {});
          }
        }
      }
    } catch {}
    setLedgerExtracting(false);
  }, []);

  // Auto-extract budget (income + monthly expenses with custom keys) via backend AI
  const handleBillsExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    const newLines = transcriptRef.current.slice(billsCursorRef.current);
    if (newLines.length === 0) return;
    billsCursorRef.current = transcriptRef.current.length;
    try {
      logAI('budget');
      const res = await invokeAI('liveAssistantAI', {
        transcript: newLines,
        mode: 'budget',
        aiInputActive: posHasAiInput(scriptPositionRef.current),
        existingBills: leadRef.current.billsJson || '{}',
      });
      const budget = res?.budget || res?.data?.budget;
      if (!budget) return;
      const extractedBills = budget.bills || {};
      const extractedIncome = budget.monthlyIncome;
      const existingBills = (() => { try { return JSON.parse(leadRef.current.billsJson || '{}'); } catch { return {}; } })();
      const mergedBills = { ...existingBills };
      let hasNew = false;
      for (const [k, v] of Object.entries(extractedBills)) {
        if (v && v > 0) { mergedBills[k] = v; hasNew = true; }
      }
      const updates = {};
      if (hasNew) updates.billsJson = JSON.stringify(mergedBills);
      if (extractedIncome) updates.monthlyIncome = extractedIncome;
      if (Object.keys(updates).length > 0) {
        setLead(prev => ({ ...prev, ...updates }));
        if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, updates).catch(() => {});
      }
    } catch {}
  }, []);

  // Auto-extract credit review info (credit score, behind on payments, months behind) from transcript
  const handleCreditExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    const newLines = transcriptRef.current.slice(creditCursorRef.current);
    if (newLines.length === 0) return;
    creditCursorRef.current = transcriptRef.current.length;
    try {
      logAI('credit');
      const res = await invokeAI('liveAssistantAI', {
        transcript: newLines,
        mode: 'credit',
        aiInputActive: posHasAiInput(scriptPositionRef.current),
      });
      const credit = res?.credit || res?.data?.credit;
      if (!credit) return;
      const updates = {};
      if (credit.creditScore) updates.creditScore = Number(credit.creditScore) || credit.creditScore;
      if (credit.behindOnPayments !== undefined) updates.behindOnPayments = credit.behindOnPayments;
      if (credit.monthsBehind) updates.monthsBehind = Number(credit.monthsBehind) || credit.monthsBehind;
      if (Object.keys(updates).length > 0) {
        setLead(prev => ({ ...prev, ...updates }));
        if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, updates).catch(() => {});
      }
    } catch {}
  }, []);

  // Auto-extract hardship info from transcript
  const handleHardshipExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    const newLines = transcriptRef.current.slice(hardshipCursorRef.current);
    if (newLines.length === 0) return;
    hardshipCursorRef.current = transcriptRef.current.length;
    try {
      logAI('hardship');
      const res = await invokeAI('liveAssistantAI', { transcript: newLines, mode: 'hardship', aiInputActive: posHasAiInput(scriptPositionRef.current) });
      const hardship = res?.hardship || res?.data?.hardship;
      if (hardship) {
        const updates = {};
        if (hardship.when) updates.hardshipWhen = hardship.when;
        if (hardship.why) updates.hardshipWhy = hardship.why;
        if (hardship.how) updates.hardshipHow = hardship.how;
        if (Object.keys(updates).length > 0) {
          setLead(prev => ({ ...prev, ...updates }));
          if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, updates).catch(() => {});
        }
      }
    } catch {}
  }, []);

  // Run compliance evaluation on transcript (creates Compliance IDs if violations found)
  const handleComplianceEval = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 6) return;
    try {
      logAI('compliance');
      await base44.functions.invoke('complianceEngine', {
        action: 'evaluate',
        transcriptChunk: transcriptRef.current.slice(-20),
        fullTranscript: transcriptRef.current,
        username: coachUser?.username,
        userRole: coachUser?.role,
        userId: coachUser?.id,
        callMode,
        leadId: leadRef.current.id,
        leadName: `${leadRef.current.firstName} ${leadRef.current.lastName}`.trim(),
        sensitivityLevel: 'balanced',
        callStartIso: callStartRef.current?.toISOString(),
      });
    } catch {}
  }, [coachUser, callMode]);

  // Auto-extract customer info (name, phone, address, email, debt amount) from transcript
  const handleContactExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    const newLines = transcriptRef.current.slice(contactCursorRef.current);
    if (newLines.length === 0) return;
    contactCursorRef.current = transcriptRef.current.length;
    try {
      const aiInputActive = posHasAiInput(scriptPositionRef.current);
      logAI('contact');
      const res = await invokeAI('liveAssistantAI', { transcript: newLines, mode: 'contact', aiInputActive });
      const contact = res?.contact || res?.data?.contact;
      if (contact) {
        const updates = {};
        // Always update with the latest confirmed value — customer may correct info mid-call
        if (contact.firstName) updates.firstName = contact.firstName;
        if (contact.lastName) updates.lastName = contact.lastName;
        if (contact.phone) updates.phone = contact.phone;
        if (contact.email) updates.email = contact.email;
        if (contact.address) updates.address = contact.address;
        if (contact.city) updates.city = contact.city;
        if (contact.state) updates.state = contact.state;
        if (contact.zip) updates.zip = contact.zip;
        if (contact.debtAmount) updates.debtAmount = Number(contact.debtAmount) || contact.debtAmount;
        if (contact.dateOfBirth) updates.dateOfBirth = contact.dateOfBirth;
        if (Object.keys(updates).length > 0) {
          setLead(prev => ({ ...prev, ...updates }));
          if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, updates).catch(() => {});
          // Notify the lead card to flash the updated fields
          window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: Object.keys(updates) }));
        }
      }
    } catch {}
  }, []);

  // Auto-extract the opening handoff: transfer agent introduces the customer
  // ("I have Bob on the line here, and he has approx 20k in debt") → populate
  // first name + debt amount and save the lead immediately.
  const handleHandoffExtract = useCallback(async () => {
    if (transferAgentDetectedRef.current) return; // regex already extracted the data
    if (!leadRef.current?.id || transcriptRef.current.length < 2) return;
    try {
      logAI('handoff');
      const res = await invokeAI('liveAssistantAI', { transcript: transcriptRef.current.slice(0, 8), mode: 'handoff' });
      const h = res?.handoff || res?.data?.handoff;
      if (h) {
        const updates = {};
        const curFirst = (leadRef.current.firstName || '').trim();
        const curLast = (leadRef.current.lastName || '').trim();
        // Only fill name if the lead is still a blank/new placeholder
        if (h.customerFirstName && (!curFirst || curFirst.toLowerCase() === 'new')) updates.firstName = h.customerFirstName;
        if (h.customerLastName && (!curLast || curLast.toLowerCase() === 'lead')) updates.lastName = h.customerLastName;
        // Always capture a freshly mentioned debt amount if none is set yet
        if (h.debtAmount && !leadRef.current.debtAmount) updates.debtAmount = Number(h.debtAmount) || h.debtAmount;
        // Transfer agent often states where the prospect is from — always populate
        if (h.city) updates.city = h.city;
        if (h.state) updates.state = h.state;
        if (Object.keys(updates).length > 0) {
          setLead(prev => ({ ...prev, ...updates }));
          if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, updates).catch(() => {});
          window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: Object.keys(updates) }));
        }
      }
    } catch {}
  }, []);

  // Auto-extract co-signers from transcript
  const handleCosignerExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    const newLines = transcriptRef.current.slice(cosignerCursorRef.current);
    if (newLines.length === 0) return;
    cosignerCursorRef.current = transcriptRef.current.length;
    try {
      logAI('cosigners');
      const res = await invokeAI('liveAssistantAI', { transcript: newLines, mode: 'cosigners', aiInputActive: posHasAiInput(scriptPositionRef.current) });
      const cosigners = res?.cosigners || res?.data?.cosigners || [];
      if (cosigners.length > 0) {
        const existing = (() => { try { return JSON.parse(leadRef.current.cosignersJson || '[]'); } catch { return []; } })();
        const existingNames = existing.map(c => (c.name || '').toLowerCase());
        const newEntries = cosigners.filter(c => c.name && !existingNames.includes(c.name.toLowerCase()));
        if (newEntries.length > 0) {
          const merged = [...existing, ...newEntries];
          setLead(prev => ({ ...prev, cosignersJson: JSON.stringify(merged) }));
          if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, { cosignersJson: JSON.stringify(merged) }).catch(() => {});
        }
      }
    } catch {}
  }, []);

  // Timed extractors — run on a fixed 30s interval during live calls AND from
  // processNewEntry so client info is captured reliably even when no new
  // transcript lines are arriving. Each extractor keeps its own throttle.
  // (Declared before processNewEntry and the interval useEffect to avoid TDZ.)
  const runTimedExtractors = useCallback(() => {
    const now = Date.now();
    const callElapsedSec = callStartRef.current ? (now - callStartRef.current.getTime()) / 1000 : 0;

    // Profile — every 2 min
    if (now - lastProfileTime.current > 120000) { lastProfileTime.current = now; handleProfile(); }

    // Contact — only 0-90s, every 15s (name corrections happen in the opening)
    if (callElapsedSec < 90 && now - lastContactTime.current > 15000) { lastContactTime.current = now; handleContactExtract(); }

    // Debt ledger — not until 15 min in, then once only (again at end of call)
    if (callElapsedSec >= 900 && !ledgerDoneRef.current && now - lastLedgerTime.current > 60000) { lastLedgerTime.current = now; ledgerDoneRef.current = true; handleDebtExtract(); }

    // Hardship — 15-30 min window, once only (again at end of call)
    if (callElapsedSec >= 900 && callElapsedSec < 1800 && !hardshipDoneRef.current && now - lastHardshipTime.current > 60000) { lastHardshipTime.current = now; hardshipDoneRef.current = true; handleHardshipExtract(); }

    // Budget — 15-35 min window, once only (again at end of call)
    if (callElapsedSec >= 900 && callElapsedSec < 2100 && !billsDoneRef.current && now - lastBillsTime.current > 60000) { lastBillsTime.current = now; billsDoneRef.current = true; handleBillsExtract(); }

    // Credit — every 2 min
    if (now - lastCreditTime.current > 120000) { lastCreditTime.current = now; handleCreditExtract(); }

    // Co-signers — moved to end-of-call sweep in stopCall
    // Compliance — turned off for now
  }, [handleProfile, handleDebtExtract, handleBillsExtract, handleHardshipExtract, handleContactExtract, handleCreditExtract]);

  // Run timed extractors on a 90s fallback interval during live calls — only
  // fires when no new transcript lines have triggered runTimedExtractors via
  // processNewEntry. processNewEntry is the primary driver; this catches
  // quiet periods without re-scanning the same transcript every 30s.
  useEffect(() => {
    if (phase !== 'live') return;
    const interval = setInterval(runTimedExtractors, 90000);
    return () => clearInterval(interval);
  }, [phase, runTimedExtractors]);

  const lastEntryRef = useRef(null);
  const processNewEntry = useCallback((entry) => {
    // Deduplicate — Deepgram with utterances=true can send the same final transcript twice
    const last = lastEntryRef.current;
    if (last && last.speaker === entry.speaker && last.text === entry.text && (Date.now() - last.ts < 3000)) {
      return;
    }
    lastEntryRef.current = { speaker: entry.speaker, text: entry.text, ts: Date.now() };

    // ── Transfer Agent Detection (inbound calls only) ──────────────────
    // For front_to_back / open_only calls, the transfer agent speaks on the
    // customer channel before the actual customer. Tag them as speaker 2
    // until the agent says "can you hear me ok", then the customer (speaker 1)
    // begins. Extract name, city, state, and debt amount from the intro.
    if ((callType === 'front_to_back' || callType === 'open_only') && !transferAgentDoneRef.current) {
      if (entry.speaker === 0) {
        if (/\b(?:can you hear me|you there|are you there)\b/i.test(entry.text)) {
          transferAgentDoneRef.current = true;
        }
      } else if (entry.speaker === 1) {
        entry = { ...entry, speaker: 2 };
        if (!transferAgentDetectedRef.current) {
          const m = entry.text.match(/i\s+have\s+(\w+)\s+(\w+)\s+(?:on\s+the\s+line,?\s+)?from\s+(.+?),?\s+([a-z]{2,})\s+(?:with|and\s+has)\s+(?:approx|about|approximately|currently)?\s*\$?([\d,.]+k?)\s*(?:currently\s+)?(?:in\s+|of\s+)?(?:unsecured\s+|credit\s+card\s+)?debt/i);
          if (m) {
            transferAgentDetectedRef.current = true;
            const [, firstName, lastName, city, state, amtRaw] = m;
            const debtAmount = parseFloat(amtRaw.replace(/[$,]/g, '').replace(/k$/i, '000')) || 0;
            const updates = {};
            const curFirst = (leadRef.current.firstName || '').trim();
            const curLast = (leadRef.current.lastName || '').trim();
            if (firstName && (!curFirst || curFirst.toLowerCase() === 'new')) updates.firstName = firstName;
            if (lastName && (!curLast || curLast.toLowerCase() === 'lead')) updates.lastName = lastName;
            if (city) updates.city = city.trim();
            if (state) updates.state = state.toUpperCase();
            if (debtAmount > 0 && !leadRef.current.debtAmount) updates.debtAmount = debtAmount;
            if (Object.keys(updates).length > 0) {
              setLead(prev => ({ ...prev, ...updates }));
              if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, updates).catch(() => {});
              window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: Object.keys(updates) }));
            }
          }
        }
      }
    }

    // Immediate merge: if same speaker as last line and last line doesn't end
    // with sentence punctuation, this is a fragment — append to last line.
    // This prevents one statement from appearing as 10 separate lines.
    setTranscript(prev => {
      if (prev.length === 0) return [...prev, entry];
      const lastLine = prev[prev.length - 1];
      if (lastLine.speaker === entry.speaker) {
        const lastText = (lastLine.text || '').trim();
        if (!/[.?!…]["']?$/.test(lastText)) {
          const merged = [...prev];
          merged[merged.length - 1] = {
            ...lastLine,
            text: lastText + ' ' + entry.text,
          };
          return merged;
        }
      }
      return [...prev, entry];
    });
    const text = entry.text || '';

    // Cold call: extract name from opening "May I speak with X" + detect interest to auto-save
    if (callType === 'cold_call') {
      const lineCount = transcriptRef.current.length;
      if (lineCount <= 2 && entry.speaker === 0) handleColdCallNameExtract();
      if (entry.speaker === 1) handleColdCallInterestCheck(text);
    }

    // Agent Question mode: capture agent lines when the button is ON (not sent to Q&A until toggled OFF)
    if (agentQuestionActiveRef.current && entry.speaker === 0) {
      agentQuestionBufferRef.current.push(text);
    }

    // Q&A: buffer consecutive customer lines, flush as one combined question
    if (qaActiveRef.current && entry.speaker === 1) {
      customerBufferRef.current.push(text);
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      // If this utterance ends with ? or !, flush immediately — question is complete
      if (text.trim().endsWith('?') || text.trim().endsWith('!')) {
        flushCustomerBuffer();
      } else {
        // Wait for more lines — flush after 3s of silence if no new customer line arrives
        bufferTimeoutRef.current = setTimeout(() => flushCustomerBuffer(), 1500);
      }
    } else if (entry.speaker === 0) {
      // Agent started speaking — flush any pending customer question
      flushCustomerBuffer();
    }

    const objWords = ['prove', 'doubt', 'skeptical', 'risky', 'guarantee', 'fail', 'burned', 'scam', 'catch', 'cost', 'fee', 'how much', 'too much', "can't afford", 'credit score', 'trust'];
    const now = Date.now();
    const isCustomer = entry.speaker === 1;
    // Coach: only on customer lines, with a 20s minimum gap even on keyword hits
    if (coachActiveRef.current && isCustomer && now - lastCoachTime.current > 20000 &&
        ((objWords.some(w => text.toLowerCase().includes(w))) || now - lastCoachTime.current > 45000)) {
      lastCoachTime.current = now; handleCoach();
    }
    if (intentActiveRef.current && now - lastIntentTime.current > 60000) { lastIntentTime.current = now; handleIntent(); }
    // Debounce: only run timed extractors every 5 lines or when speaker changes
    extractLineCounterRef.current++;
    const speakerChanged = entry.speaker !== lastSpeakerRef.current;
    lastSpeakerRef.current = entry.speaker;
    if (extractLineCounterRef.current >= 5 || speakerChanged) {
      extractLineCounterRef.current = 0;
      runTimedExtractors();
    }
    // Opening handoff: for inbound calls, listen aggressively for transfer agent intro
    // (name, debt amount, hardship, address, phone, account details)
    const lineCount = transcriptRef.current.length;
    if (inboundRef.current) {
      if (handoffAttemptsRef.current < 1 && lineCount >= 2) { handoffAttemptsRef.current = 1; handleHandoffExtract(); }
      else if (handoffAttemptsRef.current < 2 && lineCount >= 4) { handoffAttemptsRef.current = 2; handleHandoffExtract(); }
      else if (handoffAttemptsRef.current < 3 && lineCount >= 6) { handoffAttemptsRef.current = 3; handleHandoffExtract(); }
      else if (handoffAttemptsRef.current < 4 && lineCount >= 8) { handoffAttemptsRef.current = 4; handleHandoffExtract(); }
    } else {
      if (handoffAttemptsRef.current < 1 && lineCount >= 3) { handoffAttemptsRef.current = 1; handleHandoffExtract(); }
      else if (handoffAttemptsRef.current < 2 && lineCount >= 7) { handoffAttemptsRef.current = 2; handleHandoffExtract(); }
    }
  }, [handleQa, flushCustomerBuffer, handleCoach, handleIntent, runTimedExtractors, handleHandoffExtract]);

  const startCall = useCallback(async (forceNew = false, testModeArg = false) => {
    // Ensure we have a lead — always create a brand new one for new/inbound calls
    if (forceNew || !leadRef.current?.id) {
      // Persist the lead to the database immediately so transcript + auto-extraction
      // (handoff name, contact, debt, bills, hardship, cosigners) can all save
      // against a real lead ID throughout the call.
      try {
        const allLeads = await base44.entities.DebtLead.list('-created_date', 500);
        const maxNum = (allLeads || []).reduce((max, l) => {
          const n = parseInt((l.leadNumber || '').replace('#', ''), 10);
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const leadNumber = `#${String(maxNum + 1).padStart(5, '0')}`;
        const created = await base44.entities.DebtLead.create({
          firstName: forceNew ? 'New' : (lead.firstName || 'New'),
          lastName: forceNew ? 'Lead' : (lead.lastName || 'Lead'),
          status: 'new', callCount: 0,
          leadNumber, debtCoachOwner: coachUser?.username || null,
        });
        setLead(created); setProfileData(null); setMemories([]);
        leadRef.current = created;
        loadLeads();
      } catch (e) { alert('Failed to start call: ' + (e?.message || String(e))); return; }
    }

    setError(''); setTranscript([]); setQaItems([]); setCoachTips([]); setIntentScore(null); setProfileData(null); setReport('');
    intentHistoryRef.current = [];
    handoffAttemptsRef.current = 0;
    transferAgentDoneRef.current = false;
    transferAgentDetectedRef.current = false;
    agentQuestionBufferRef.current = [];
    agentQuestionActiveRef.current = false;
    setAgentQuestionActive(false);
    leadPersistedRef.current = false;
    transcriptRecordIdRef.current = null;
    profileAutoOpenedRef.current = false;
    ledgerDoneRef.current = false;
    hardshipDoneRef.current = false;
    billsDoneRef.current = false;
    contactCursorRef.current = 0;
    ledgerCursorRef.current = 0;
    hardshipCursorRef.current = 0;
    billsCursorRef.current = 0;
    cosignerCursorRef.current = 0;
    creditCursorRef.current = 0;
    profileCursorRef.current = 0;
    extractLineCounterRef.current = 0;
    lastSpeakerRef.current = null;

    // Create a live transcript record immediately — updated every 15s and finalized on end
    try {
      const leadName = `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim();
      const tr = await base44.entities.DebtCallTranscript.create({
        leadId: leadRef.current.id,
        leadName,
        leadNumber: leadRef.current.leadNumber || '',
        agentId: coachUser?.username || '',
        agentName: coachUser?.username || '',
        transcriptJson: '[]',
        transcriptLineCount: 0,
        callMode,
        callType,
        durationSeconds: 0,
        callDate: new Date().toISOString(),
      });
      transcriptRecordIdRef.current = tr?.id || null;
    } catch (e) { console.error('Failed to create live transcript record:', e); }
    customerBufferRef.current = []; if (bufferTimeoutRef.current) { clearTimeout(bufferTimeoutRef.current); bufferTimeoutRef.current = null; }
    setMicMuted(false);
    setTestMode(testModeArg);
    setPhase('live'); setDgStatus('connecting');
    callStartRef.current = new Date();
    lastCoachTime.current = Date.now();
    lastIntentTime.current = Date.now();
    lastProfileTime.current = Date.now();

    // 45-second auto-save: pop up Client Profile to remind agent to save lead info
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    autoSaveTimerRef.current = setTimeout(() => {
      if (!profileAutoOpenedRef.current) {
        profileAutoOpenedRef.current = true;
        setShowProfile(true);
      }
    }, 45000);

    // Auto-pop-out all panels to saved layout positions
    setTimeout(() => {
      leadPanel.popOut();
      transcriptPanel.popOut();
      scriptsPanel.popOut();
      aiPanel.popOut();
      setAllPoppedOut(true);
    }, 300);

    // Auto-activate Q&A, Coach, and Intent engines (only if permitted + enabled in layout).
    // Set the refs directly too so processNewEntry (captured by the WebSocket handler)
    // sees the live values immediately — don't wait for the next render's useEffect sync.
    const wantQA = canLiveAI && canLiveQA && autoQA;
    const wantCoach = canLiveAI && canLiveCoach && autoCoach;
    const wantIntent = canLiveAI && canLiveIntent && autoIntent;
    setQaActive(wantQA); qaActiveRef.current = wantQA;
    setCoachActive(wantCoach); coachActiveRef.current = wantCoach;
    setIntentActive(wantIntent); intentActiveRef.current = wantIntent;

    // Test mode forces single-mic diarization — one feed, no dual-channel duplicates.
    // Used when playing pre-recorded calls through speakers for testing.
    const dualMode = !!customerMicId && !!micDeviceId && !testModeArg;

    let agentStream, customerStream;
    try {
      agentStream = await navigator.mediaDevices.getUserMedia({ audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true });
      streamRef.current = agentStream;
      if (dualMode) {
        customerStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: customerMicId } } });
        customerStreamRef.current = customerStream;
      }
    } catch { setError('Microphone/audio access denied.'); setPhase('idle'); setDgStatus('error'); return; }

    let dgKey = '';
    try { const tokenRes = await base44.functions.invoke('deepgramToken2', {}); dgKey = tokenRes?.key || tokenRes?.data?.key || ''; }
    catch { dgKey = import.meta.env.VITE_DEEPGRAM_API_KEY || ''; }
    if (!dgKey) { setError('Could not get Deepgram API key.'); setPhase('idle'); setDgStatus('error'); agentStream.getTracks().forEach(t => t.stop()); if (customerStream) customerStream.getTracks().forEach(t => t.stop()); return; }

    // Pin AudioContext to 16kHz — Deepgram nova-3 is trained on 16kHz audio.
    // Browser default (48kHz) wastes 3x bandwidth and doesn't match the model.
    // The browser resamples all input (mic + Twilio stream) to this rate automatically.
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    if (ctx.state === 'suspended') await ctx.resume();
    ctxRef.current = ctx;
    const sr = ctx.sampleRate;

    const dgParams = dualMode
      ? `model=nova-3&multichannel=true&smart_format=true&punctuate=true&numerals=true&sentiment=true&utterances=true&interim_results=false&channels=2&sample_rate=${sr}&encoding=linear16&endpointing=700&${DEBT_KEYTERMS}`
      : `model=nova-3&diarize=true&smart_format=true&punctuate=true&numerals=true&sentiment=true&utterances=true&interim_results=false&sample_rate=${sr}&encoding=linear16&endpointing=700&${DEBT_KEYTERMS}`;
    let wsEverOpen = false;
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${dgParams}`, ['token', dgKey]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      wsEverOpen = true;
      setDgStatus('connected');
      // Update DialerSession to on_call
      if (coachUser?.username) {
        base44.entities.DialerSession.filter({ username: coachUser.username }).then(sessions => {
          const active = (sessions || []).find(s => s.status === 'logged_in' || s.status === 'on_call');
          if (active) {
            base44.entities.DialerSession.update(active.id, {
              status: 'on_call',
              currentCallLeadId: leadRef.current?.id || '',
              currentCallLeadName: `${leadRef.current?.firstName || ''} ${leadRef.current?.lastName || ''}`.trim(),
              currentCallPhone: leadRef.current?.phone || '',
              currentCallStartedAt: new Date().toISOString(),
              currentCallMode: callMode,
            }).catch(() => {});
          }
        }).catch(() => {});
      }
      if (dualMode) {
        // Multichannel: channel 0 = agent (left), channel 1 = customer (right)
        const agentSrc = ctx.createMediaStreamSource(agentStream);
        const customerSrc = ctx.createMediaStreamSource(customerStream);
        const merger = ctx.createChannelMerger(2);
        agentSrc.connect(merger, 0, 0);
        customerSrc.connect(merger, 0, 1);
        const processor = ctx.createScriptProcessor(4096, 2, 2);
        processorRef.current = processor;
        processor.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const left = ev.inputBuffer.getChannelData(0);
          const right = ev.inputBuffer.getChannelData(1);
          const int16 = new Int16Array(left.length * 2);
          for (let i = 0; i < left.length; i++) {
            int16[i * 2] = Math.max(-1, Math.min(1, left[i])) * 0x7FFF;
            int16[i * 2 + 1] = Math.max(-1, Math.min(1, right[i])) * 0x7FFF;
          }
          ws.send(int16.buffer);
        };
        merger.connect(processor);
        const silence = ctx.createGain(); silence.gain.value = 0;
        processor.connect(silence); silence.connect(ctx.destination);
      } else {
        // Single mic with diarization
        const source = ctx.createMediaStreamSource(agentStream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = ev.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
          ws.send(int16.buffer);
        };
        source.connect(processor);
        const silence = ctx.createGain(); silence.gain.value = 0;
        processor.connect(silence); silence.connect(ctx.destination);
      }
    };

    // Collect is_final chunks until speech_final, then emit one complete line.
    // Deepgram sends is_final mid-sentence; speech_final marks a real pause.
    // endpointing=700 gives 700ms of silence before Deepgram fires speech_final.
    const segBuf = {}; // per speaker: { text, sentiment, timer }
    const emitSegment = (speaker) => {
      const b = segBuf[speaker];
      if (!b || !b.text.trim()) { delete segBuf[speaker]; return; }
      clearTimeout(b.timer);
      processNewEntry({ speaker, text: b.text.trim(), sentiment: b.sentiment, time: new Date().toISOString() });
      delete segBuf[speaker];
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'Results' || !msg.is_final) return;
        const alt = msg.channel?.alternatives?.[0];
        // speech_final with empty transcript = natural pause → flush all pending segments
        if (!alt || !alt.transcript?.trim()) {
          if (msg.speech_final) Object.keys(segBuf).forEach(k => emitSegment(Number(k)));
          return;
        }
        const channelNum = Array.isArray(msg.channel_index) ? msg.channel_index[0] : 0;
        const speaker = dualMode ? (channelNum === 0 ? 0 : 1) : (alt.words?.[0]?.speaker ?? 0);

        // Speaker changed mid-buffer (single-mic mode): flush the other speaker first
        Object.keys(segBuf).forEach(k => { if (Number(k) !== speaker) emitSegment(Number(k)); });

        const b = segBuf[speaker] || (segBuf[speaker] = { text: '', sentiment: null, timer: null });
        b.text += ' ' + alt.transcript;
        b.sentiment = msg.sentiment || alt.sentiment || b.sentiment;
        clearTimeout(b.timer);
        if (msg.speech_final) emitSegment(speaker);
        else b.timer = setTimeout(() => emitSegment(speaker), 2500); // safety flush
      } catch {}
    };

    ws.onclose = (e) => {
      // Flush any pending speech segments before final save
      Object.keys(segBuf).forEach(k => emitSegment(Number(k)));
      setDgStatus('idle');
      // Final save of transcript when connection closes — captures lines since the last 15s auto-save
      if (transcriptRef.current.length > 0 && leadRef.current?.id) {
        base44.entities.DebtLead.update(leadRef.current.id, {
          transcriptJson: JSON.stringify(transcriptRef.current),
          lastCallAt: new Date().toISOString(),
        }).catch(() => {});
        if (transcriptRecordIdRef.current) {
          base44.entities.DebtCallTranscript.update(transcriptRecordIdRef.current, {
            transcriptJson: JSON.stringify(transcriptRef.current),
            transcriptLineCount: transcriptRef.current.length,
          }).catch(() => {});
        }
      }
      if (e.code !== 1000 && e.code !== 1005) setError(`Deepgram disconnected (code ${e.code}). ${e.reason || ''}`);
    };
    ws.onerror = () => {
      setDgStatus('error');
      setError('Deepgram connection error — check API key.');
      if (!wsEverOpen) notifyCreditExhaustion('deepgram', 'WebSocket failed to connect — credits may be exhausted or API key invalid.');
    };
  }, [micDeviceId, customerMicId, processNewEntry, lead, loadLeads, coachUser, autoQA, autoCoach, autoIntent]);

  const stopCall = useCallback(async () => {
    // Clear the 45-second auto-save timer
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    // Update DialerSession back to logged_in
    if (coachUser?.username) {
      try {
        const sessions = await base44.entities.DialerSession.filter({ username: coachUser.username });
        const active = (sessions || []).find(s => s.status === 'on_call');
        if (active) {
          await base44.entities.DialerSession.update(active.id, {
            status: 'logged_in',
            currentCallLeadId: '',
            currentCallLeadName: '',
            currentCallPhone: '',
            currentCallStartedAt: '',
            currentCallMode: '',
            monitorMode: 'none',
            monitorManagerUsername: '',
            webrtcOfferSdp: '',
            webrtcAnswerSdp: '',
          });
        }
      } catch {}
    }
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (customerStreamRef.current) { customerStreamRef.current.getTracks().forEach(t => t.stop()); customerStreamRef.current = null; }
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
    setMicMuted(false);
    setTestMode(false);
    agentQuestionBufferRef.current = [];
    agentQuestionActiveRef.current = false;
    setAgentQuestionActive(false);
    setPhase('ended'); setDgStatus('idle');

    // Final profile + intent analysis
    if (transcriptRef.current.length > 0 && leadRef.current?.id) {
      // End-of-call extractor sweep — run each once now (co-signers only run here)
      try { await handleDebtExtract(); } catch {}
      try { await handleHardshipExtract(); } catch {}
      try { await handleBillsExtract(); } catch {}
      try { await handleCosignerExtract(); } catch {}

      let intent = null;
      try {
        logAI('intent_final');
        const intentRes = await invokeAI('liveAssistantAI', { transcript: transcriptRef.current, kbEntries, mode: 'intent_final', intentRules: DEBT_INTENT_RULES });
        intent = intentRes?.intent || intentRes?.data?.intent;
        if (intent) {
          setIntentScore(intent.intentScore);
          setProfileData(prev => ({ ...prev, ...intent }));
          setLead(prev => ({ ...prev, intentScore: intent.intentScore, animalType: intent.animalType, profileJson: JSON.stringify({ ...prev, ...intent }) }));

          // Save keyFacts from intent engine to LeadMemory
          if (intent.keyFacts && intent.keyFacts.length > 0) {
            const leadName = `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim();
            const nowISO = new Date().toISOString();
            const factsToCreate = intent.keyFacts.map(f => ({
              leadId: leadRef.current.id,
              leadName,
              factType: f.type || 'personal',
              factText: f.fact || '',
              context: f.context || '',
              importance: f.importance || 'medium',
              callDate: nowISO,
              followUpDate: f.followUpDate || null,
            })).filter(f => f.factText);
            if (factsToCreate.length > 0) {
              try { await base44.entities.LeadMemory.bulkCreate(factsToCreate); } catch {}
            }
          }
        }
        await base44.entities.DebtLead.update(leadRef.current.id, {
          lastCallAt: new Date().toISOString(),
          callCount: (leadRef.current.callCount || 0) + 1,
          transcriptJson: JSON.stringify(transcriptRef.current),
          intentScore: (intent && typeof intent.intentScore === 'number' && !Number.isNaN(intent.intentScore)) ? intent.intentScore : null,
          animalType: intent?.animalType || null,
        });

        // Log call + AI synopsis to activity history
        try {
          const actLeadName = `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim();
          const actAgentId = coachUser?.username || '';
          const durationMin = callStartRef.current ? Math.round((Date.now() - callStartRef.current.getTime()) / 60000) : 0;
          await base44.entities.DebtLeadActivity.create({
            leadId: leadRef.current.id,
            leadName: actLeadName,
            activityType: 'call',
            activityText: `${callType === 'front_to_back' ? 'Front→Back' : callType === 'open_only' ? 'Open Only' : callType === 'cold_call' ? 'Cold Call' : callType === 'closer_call' ? 'Closer Call' : 'Call'} (${callMode === 'close' ? 'close' : 'open'}) — ${durationMin} min, ${transcriptRef.current.length} lines${intent?.intentScore != null ? `, intent ${intent.intentScore}/100` : ''}`,
            createdBy: actAgentId,
            metadataJson: JSON.stringify({ durationMin, mode: callMode, callType, intentScore: intent?.intentScore, animalType: intent?.animalType }),
          });
          // AI synopsis — 1-2 sentence summary of the intent report
          if (intent?.report) {
            const synopsis = intent.report.split(/[.!?]/).filter(s => s.trim()).slice(0, 2).join('. ').trim() + '.';
            await base44.entities.DebtLeadActivity.create({
              leadId: leadRef.current.id,
              leadName: actLeadName,
              activityType: 'ai_synopsis',
              activityText: synopsis,
              createdBy: actAgentId,
            });
          }
        } catch {}

        // Also run dedicated fact extraction for any memories the intent engine missed
        try {
          const existingFactTexts = (await base44.entities.LeadMemory.filter({ leadId: leadRef.current.id }, '-created_date', 200)).map(m => (m.factText || '').toLowerCase());
          logAI('extract_facts');
          const factsRes = await invokeAI('liveAssistantAI', { transcript: transcriptRef.current, mode: 'extract_facts', existingFacts: existingFactTexts.map(t => ({ factText: t })) });
          const newFacts = factsRes?.facts || factsRes?.data?.facts || [];
          if (newFacts.length > 0) {
            const leadName = `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim();
            const nowISO = new Date().toISOString();
            const factsToCreate = newFacts.map(f => ({
              leadId: leadRef.current.id,
              leadName,
              factType: f.type || 'personal',
              factText: f.fact || '',
              context: f.context || '',
              importance: f.importance || 'medium',
              callDate: nowISO,
              followUpDate: f.followUpDate || null,
            })).filter(f => f.factText && !existingFactTexts.includes(f.fact.toLowerCase()));
            if (factsToCreate.length > 0) {
              await base44.entities.LeadMemory.bulkCreate(factsToCreate);
              window.dispatchEvent(new CustomEvent('lead_memories_updated'));
            }
          }
        } catch {}
      } catch {}

      setGeneratingReport(true);
      try {
        logAI('full_report');
        const res = await invokeAI('liveAssistantAI', {
          transcript: transcriptRef.current, kbEntries, kbName: 'Debt Settlement', mode: 'full_report',
          usedCoach: coachActiveRef.current, usedQA: qaActiveRef.current, usedIntent: intentActiveRef.current,
          coachTips: coachTipsRef.current.map(t => t.tip), qaLog: qaItemsRef.current.map(q => ({ question: q.question, answer: q.answer })),
        });
        const fullReport = res?.report || res?.data?.report || '';
        setReport(fullReport);

        // Run structured call analysis (timeline + manager report + suggestions + follow-up)
        let callAnalysisJson = '';
        try {
          logAI('call_analysis');
          const analysisRes = await invokeAI('liveAssistantAI', {
            transcript: transcriptRef.current, mode: 'call_analysis', callType,
          });
          const analysis = analysisRes?.analysis || analysisRes?.data?.analysis;
          if (analysis) callAnalysisJson = JSON.stringify(analysis);
        } catch {}

        // Save transcript + report to DebtCallTranscript entity
        const durationSeconds = callStartRef.current ? Math.round((Date.now() - callStartRef.current.getTime()) / 1000) : 0;
        const leadName = `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim();
        const agentId = coachUser?.username || '';
        let transcriptRecord = null;
        try {
          const transcriptData = {
            leadName,
            leadNumber: leadRef.current.leadNumber || '',
            transcriptJson: JSON.stringify(transcriptRef.current),
            transcriptLineCount: transcriptRef.current.length,
            durationSeconds,
            intentScore: (intent && typeof intent.intentScore === 'number' && !Number.isNaN(intent.intentScore)) ? intent.intentScore : (intentScoreRef.current ?? null),
            animalType: intent?.animalType || leadRef.current.animalType || null,
            intentReport: intent?.report || (intent && typeof intent.intentScore === 'number' && !Number.isNaN(intent.intentScore) ? `Intent Score: ${intent.intentScore}/100\nAnimal: ${intent.animalType || 'unknown'}` : ''),
            followUpReport: fullReport,
            callAnalysisJson,
          };
          if (transcriptRecordIdRef.current) {
            // Update the live transcript record created at call start
            transcriptRecord = await base44.entities.DebtCallTranscript.update(transcriptRecordIdRef.current, transcriptData);
            transcriptRecord = { id: transcriptRecordIdRef.current, ...transcriptRecord, ...transcriptData };
          } else {
            // Fallback: create if the live record was never created
            transcriptRecord = await base44.entities.DebtCallTranscript.create({
              leadId: leadRef.current.id,
              leadName,
              leadNumber: leadRef.current.leadNumber || '',
              agentId,
              agentName: agentId,
              callMode,
              callType,
              callDate: new Date().toISOString(),
              ...transcriptData,
            });
          }

          // Persist Q&A history for this call
          if (qaItemsRef.current.length > 0 && transcriptRecord?.id) {
            const qaRecords = qaItemsRef.current.filter(q => q.question && q.answer).map(q => ({
              leadId: leadRef.current.id,
              leadName,
              agentId,
              transcriptId: transcriptRecord.id,
              question: q.question,
              answer: q.answer,
              askedAt: new Date().toISOString(),
              source: 'auto',
            }));
            if (qaRecords.length > 0) {
              try { await base44.entities.DebtQAHistory.bulkCreate(qaRecords); } catch (e) { console.error('Q&A history save failed:', e); }
            }
          }

          // Persist coaching tips for this call
          if (coachTipsRef.current.length > 0 && transcriptRecord?.id) {
            const tipRecords = coachTipsRef.current.map(t => ({
              agentId,
              agentName: agentId,
              transcriptId: transcriptRecord.id,
              leadId: leadRef.current.id,
              leadName,
              tip: t.tip,
              tipTime: t.time ? t.time.toISOString() : new Date().toISOString(),
            }));
            try { await base44.entities.DebtCoachTip.bulkCreate(tipRecords); } catch (e) { console.error('Coach tips save failed:', e); }
          }

          // Persist intent snapshots for this call
          if (intentHistoryRef.current.length > 0 && transcriptRecord?.id) {
            const snapshotRecords = intentHistoryRef.current.map(s => ({
              agentId,
              agentName: agentId,
              transcriptId: transcriptRecord.id,
              leadId: leadRef.current.id,
              leadName,
              intentScore: s.score,
              animalType: s.animalType || null,
              report: s.report || '',
              snapshotTime: s.time,
            }));
            try { await base44.entities.DebtIntentSnapshot.bulkCreate(snapshotRecords); } catch (e) { console.error('Intent snapshot save failed:', e); }
          }
        } catch {}
      } catch { setReport('Failed to generate report.'); }
      setGeneratingReport(false);
    }

    // Auto-schedule follow-up: preview first, then show modal for approval
    if (autoSchedulerEnabled && transcriptRef.current.length > 0 && leadRef.current?.id) {
      try {
        const leadName = `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim();
        const res = await base44.functions.invoke('autoScheduleAppointment', {
          action: 'preview',
          transcript: transcriptRef.current,
          leadId: leadRef.current.id,
          leadName,
          agentName: coachUser?.username || '',
        });
        const data = res?.data || res;
        if (data?.hasCallbackRequest && data?.startISO) {
          setApptPreview(data);
        }
      } catch (e) { console.error('Auto-scheduler preview failed:', e); }
    }

    loadLeads();
  }, [kbEntries, loadLeads, autoSchedulerEnabled, coachUser, callType, handleDebtExtract, handleHardshipExtract, handleBillsExtract, handleCosignerExtract]);

  // Show the keep/delete dialog when the agent ends a call (not for monitor takeovers)
  const handleEndCallClick = useCallback(() => {
    setShowEndDialog(true);
  }, []);

  // Called from EndCallDialog — always saves transcript + logs call; optionally soft-deletes lead
  const handleEndChoice = useCallback(async (shouldDelete) => {
    setShowEndDialog(false);
    await stopCall();
    if (shouldDelete && leadRef.current?.id) {
      try {
        await base44.entities.DebtLead.update(leadRef.current.id, {
          deletedAt: new Date().toISOString(),
          deletedBy: coachUser?.username || '',
        });
        loadLeads();
      } catch (e) { console.error('Soft-delete failed:', e); }
    }
  }, [stopCall, coachUser, loadLeads]);

  // Keep stopCallRef updated for monitor polling
  useEffect(() => { stopCallRef.current = stopCall; }, [stopCall]);

  // Keyboard shortcuts: Alt+L to start live call, Alt+Q to toggle agent question
  const startCallRef = useRef(null);
  const toggleAgentQuestionRef = useRef(null);
  useEffect(() => { startCallRef.current = startCall; }, [startCall]);
  useEffect(() => { toggleAgentQuestionRef.current = toggleAgentQuestion; }, [toggleAgentQuestion]);
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && (e.key === 'l' || e.key === 'L') && phase !== 'live') {
        e.preventDefault();
        startCallRef.current?.(false);
      }
      if (e.altKey && (e.key === 'q' || e.key === 'Q') && phase === 'live') {
        e.preventDefault();
        toggleAgentQuestionRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase]);

  // Poll for manager monitor requests (listen, whisper, barge, takeover)
  useEffect(() => {
    if (phase !== 'live' || !coachUser?.username) return;
    const interval = setInterval(async () => {
      try {
        const res = await base44.functions.invoke('managerCallControl', { action: 'getSession', managerUsername: coachUser.username, dialerUsername: coachUser.username });
        const session = res?.data?.session || res?.session;
        if (!session) return;
        // Handle takeover — manager ends the agent's call
        if (session.monitorMode === 'takeover') {
          stopCallRef.current?.();
        }
        // Handle WebRTC monitoring request from manager
        if ((session.monitorMode === 'listen' || session.monitorMode === 'whisper' || session.monitorMode === 'barge') && session.webrtcOfferSdp && !session.webrtcAnswerSdp) {
          if (monitorPcRef.current) return;
          try {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            monitorPcRef.current = pc;
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
            }
            await pc.setRemoteDescription({ type: 'offer', sdp: session.webrtcOfferSdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await new Promise(resolve => {
              if (pc.iceGatheringState === 'complete') return resolve();
              pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') resolve(); };
              setTimeout(resolve, 3000);
            });
            await base44.functions.invoke('managerCallControl', { action: 'sendAnswer', managerUsername: coachUser.username, dialerUsername: coachUser.username, answerSdp: pc.localDescription.sdp });
          } catch (e) {
            try { monitorPcRef.current?.close(); } catch {}
            monitorPcRef.current = null;
          }
        }
        // Close peer connection when monitoring stops
        if (session.monitorMode === 'none' && monitorPcRef.current) {
          try { monitorPcRef.current.close(); } catch {}
          monitorPcRef.current = null;
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [phase, coachUser?.username]);

  // ── Audio Test — level meters for both inputs ──────────────────────────
  const startAudioTest = useCallback(async () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      testCtxRef.current = ctx;
      const agentStream = await navigator.mediaDevices.getUserMedia({ audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true });
      testAgentStreamRef.current = agentStream;
      const agentAnalyser = ctx.createAnalyser();
      agentAnalyser.fftSize = 256;
      ctx.createMediaStreamSource(agentStream).connect(agentAnalyser);
      let customerAnalyser = null;
      if (customerMicId) {
        const customerStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: customerMicId } } });
        testCustomerStreamRef.current = customerStream;
        customerAnalyser = ctx.createAnalyser();
        customerAnalyser.fftSize = 256;
        ctx.createMediaStreamSource(customerStream).connect(customerAnalyser);
      }
      const agentData = new Uint8Array(agentAnalyser.frequencyBinCount);
      const customerData = customerAnalyser ? new Uint8Array(customerAnalyser.frequencyBinCount) : null;
      const tick = () => {
        agentAnalyser.getByteTimeDomainData(agentData);
        let aMax = 0;
        for (let i = 0; i < agentData.length; i++) { const v = Math.abs(agentData[i] - 128) / 128; if (v > aMax) aMax = v; }
        setAgentLevel(Math.round(aMax * 100));
        if (customerAnalyser) {
          customerAnalyser.getByteTimeDomainData(customerData);
          let cMax = 0;
          for (let i = 0; i < customerData.length; i++) { const v = Math.abs(customerData[i] - 128) / 128; if (v > cMax) cMax = v; }
          setCustomerLevel(Math.round(cMax * 100));
        }
        testAnimRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTestingAudio(true);
    } catch (e) { setError('Audio test failed: ' + (e?.message || String(e))); }
  }, [micDeviceId, customerMicId]);

  const stopAudioTest = useCallback(() => {
    if (testAnimRef.current) cancelAnimationFrame(testAnimRef.current);
    testAnimRef.current = null;
    if (testAgentStreamRef.current) testAgentStreamRef.current.getTracks().forEach(t => t.stop());
    if (testCustomerStreamRef.current) testCustomerStreamRef.current.getTracks().forEach(t => t.stop());
    if (testCtxRef.current) { try { testCtxRef.current.close(); } catch {} }
    testCtxRef.current = null; testAgentStreamRef.current = null; testCustomerStreamRef.current = null;
    setTestingAudio(false); setAgentLevel(0); setCustomerLevel(0);
  }, []);

  useEffect(() => () => stopAudioTest(), [stopAudioTest]);

  const phaseColor = { idle: '#6b7280', live: '#ef4444', ended: '#8a9ab8' }[phase];
  const phaseLabel = { idle: 'Ready', live: '● LIVE', ended: 'Ended' }[phase];

  return (
    <div>
      {/* Controls bar */}
      <div style={{ marginBottom: '16px', padding: '14px 18px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ ...ls, marginBottom: 0 }}>🎙 Agent Mic</label>
          <select value={micDeviceId} onChange={e => setMicDeviceId(e.target.value)} disabled={phase === 'live'} style={{ ...inp, minWidth: '220px', cursor: 'pointer' }}>
            {micDevices.length === 0 && <option>Default microphone</option>}
            {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ ...ls, marginBottom: 0 }}>🎧 Customer Audio (Split Input)</label>
          <select value={customerMicId} onChange={e => setCustomerMicId(e.target.value)} disabled={phase === 'live'} style={{ ...inp, minWidth: '220px', cursor: 'pointer' }}>
            <option value="">— None (use diarization) —</option>
            {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Input ${m.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>

        {outputDevices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ ...ls, marginBottom: 0 }}>🔊 Audio Output</label>
            <select value={outputDeviceId} onChange={e => setOutputDeviceId(e.target.value)} style={{ ...inp, minWidth: '220px', cursor: 'pointer' }}>
              {outputDevices.map(o => <option key={o.deviceId} value={o.deviceId}>{o.label || `Speaker ${o.deviceId.slice(0, 6)}`}</option>)}
            </select>
          </div>
        )}

        {testMode ? (
          <span style={{ padding: '4px 10px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '4px', color: '#f59e0b', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>🧪 TEST MODE — Single Feed</span>
        ) : customerMicId && micDeviceId ? (
          <span style={{ padding: '4px 10px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>DUAL CHANNEL</span>
        ) : null}

        <button onClick={testingAudio ? stopAudioTest : startAudioTest} disabled={phase === 'live'} style={{ background: testingAudio ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', color: testingAudio ? '#f59e0b' : '#8a9ab8', border: `1px solid ${testingAudio ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '8px 14px', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: phase === 'live' ? 0.5 : 1 }}>
          {testingAudio ? '⏹ Stop Test' : '🔊 Test Audio'}
        </button>

        <button onClick={() => setStatsPaused(p => !p)} title="Pause/resume auto customer stats extraction during calls" style={{ padding: '8px 14px', borderRadius: '4px', border: `1px solid ${statsPaused ? 'rgba(107,113,128,0.2)' : 'rgba(16,185,129,0.3)'}`, background: statsPaused ? 'rgba(255,255,255,0.03)' : `${GOLD}18`, color: statsPaused ? '#6b7280' : GOLD, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {statsPaused ? '⏸ Stats Paused' : '▶ Stats On'}
        </button>

        {/* Call Type selector — Front to Back / Open Only / Cold Call / Closer Call */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ ...ls, marginBottom: 0 }}>📞 Call Type</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => handleCallTypeChange('front_to_back')} disabled={phase === 'live'} title="Inbound transfer — full open + close" style={{ padding: '8px 12px', borderRadius: '4px', border: `1px solid ${callType === 'front_to_back' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: callType === 'front_to_back' ? `${GOLD}18` : 'transparent', color: callType === 'front_to_back' ? GOLD : '#6b7280', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🔄 Front→Back</button>
            <button onClick={() => handleCallTypeChange('open_only')} disabled={phase === 'live'} title="Inbound transfer — open only, transfer at SSN" style={{ padding: '8px 12px', borderRadius: '4px', border: `1px solid ${callType === 'open_only' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: callType === 'open_only' ? `${GOLD}18` : 'transparent', color: callType === 'open_only' ? GOLD : '#6b7280', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>📞 Open Only</button>
            <button onClick={() => handleCallTypeChange('cold_call')} disabled={phase === 'live'} title="Outgoing cold call — ask for name, save on interest" style={{ padding: '8px 12px', borderRadius: '4px', border: `1px solid ${callType === 'cold_call' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: callType === 'cold_call' ? `${GOLD}18` : 'transparent', color: callType === 'cold_call' ? GOLD : '#6b7280', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🧊 Cold Call</button>
            <button onClick={() => handleCallTypeChange('closer_call')} disabled={phase === 'live'} title="Inbound — opener got SSN, transferred to you (account manager) for the close" style={{ padding: '8px 12px', borderRadius: '4px', border: `1px solid ${callType === 'closer_call' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: callType === 'closer_call' ? `${GOLD}18` : 'transparent', color: callType === 'closer_call' ? GOLD : '#6b7280', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🤝 Closer Call</button>
          </div>
        </div>

        {/* Auto-Scheduler toggle */}
        <button onClick={toggleAutoScheduler} title="Auto-schedule Google Calendar follow-ups from transcript" style={{ padding: '8px 14px', borderRadius: '4px', border: `1px solid ${autoSchedulerEnabled ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`, background: autoSchedulerEnabled ? `${GOLD}18` : 'transparent', color: autoSchedulerEnabled ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {autoSchedulerEnabled ? '✓' : '○'} 📅 Auto-Schedule
        </button>

        {/* AI Feature auto-enable checkboxes — saved with layout */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px' }}>
          <span style={{ color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginRight: '4px' }}>🤖 Auto:</span>
          {[
            { label: '❓ Q&A', value: autoQA, setter: setAutoQA, color: '#f59e0b' },
            { label: '🎯 Coach', value: autoCoach, setter: setAutoCoach, color: '#a78bfa' },
            { label: '🦆 Intent', value: autoIntent, setter: setAutoIntent, color: '#60a5fa' },
          ].filter(f => canLiveAI).map(({ label, value, setter, color }) => (
            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }} title={`Auto-enable ${label} on call start (saved in layout)`}>
              <input type="checkbox" checked={value} onChange={e => setter(e.target.checked)} style={{ cursor: 'pointer', accentColor: color }} />
              <span style={{ color: value ? color : '#6b7280', fontSize: '10px', fontWeight: value ? 'bold' : 'normal' }}>{label}</span>
            </label>
          ))}
        </div>

        <NoMissedMeetingsButton />

        {/* Agent Question mode — toggle ON, ask question, toggle OFF to auto-answer in popup */}
        {phase === 'live' && canLiveAI && canLiveQA && (
          <button
            onClick={toggleAgentQuestion}
            title="Press to start recording your question, press again to get the answer (Alt+Q)"
            style={{
              padding: '8px 14px', borderRadius: '4px',
              border: `1px solid ${agentQuestionActive ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.3)'}`,
              background: agentQuestionActive ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.08)',
              color: agentQuestionActive ? '#ef4444' : '#f59e0b',
              cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '5px',
              animation: agentQuestionActive ? 'pulse 1s infinite' : 'none',
            }}
          >
            {agentQuestionActive ? '🔴 Recording Question… (press again)' : '🎤 Agent Question (Alt+Q)'}
          </button>
        )}

        {/* Quick lead search + Start Live Call (2/3 smaller) */}
        {phase !== 'live' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
            <label style={{ ...ls, marginBottom: 0 }}>👤 Search Client Profile</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                onFocus={() => setLeadSearchFocus(true)}
                onBlur={() => setTimeout(() => setLeadSearchFocus(false), 200)}
                placeholder="Type name, phone, or email…"
                style={{ ...inp, width: '200px', fontSize: '11px', padding: '6px 10px' }}
              />
              <button onClick={() => startCall(false)} disabled={kbLoading} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: kbLoading ? 'not-allowed' : 'pointer', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', opacity: kbLoading ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                {kbLoading ? 'Loading…' : '🔴 Live Call (Alt+L)'}
              </button>
              <button onClick={() => startCall(false, true)} disabled={kbLoading} title="Single-mic test mode — play a pre-recorded call through speakers, no dual-channel duplicates" style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: kbLoading ? 'not-allowed' : 'pointer', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', opacity: kbLoading ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                🧪 Test Call
              </button>
            </div>
            {/* Search results dropdown */}
            {leadSearchFocus && leadSearchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '2px', background: DARK, border: `1px solid ${GOLD}44`, borderRadius: '4px', maxHeight: '240px', overflowY: 'auto', zIndex: 10000, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                {leadSearchResults.map(l => (
                  <button key={l.id} onClick={() => selectLeadAndStartCall(l)} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px', cursor: 'pointer', textAlign: 'left', color: '#c4cdd8', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{l.firstName} {l.lastName}</span>
                    <span style={{ color: '#6b7280', fontSize: '9px' }}>{l.phone || l.email || l.leadNumber || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleEndCallClick} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>⏹ End</button>
        )}

        {phase === 'ended' && (
          <button onClick={startCall} style={{ background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>🔄 New Call</button>
        )}

        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: `${phaseColor}18`, border: `1px solid ${phaseColor}44`, borderRadius: '20px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: phaseColor, animation: phase === 'live' ? 'pulse 1s infinite' : 'none' }} />
          <span style={{ color: phaseColor, fontSize: '11px', fontWeight: 'bold' }}>{phaseLabel}</span>
        </span>
        {phase === 'live' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: dgStatus === 'connected' ? 'rgba(74,222,128,0.12)' : dgStatus === 'connecting' ? 'rgba(245,158,11,0.12)' : dgStatus === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(107,114,128,0.12)', border: `1px solid ${dgStatus === 'connected' ? 'rgba(74,222,128,0.3)' : dgStatus === 'connecting' ? 'rgba(245,158,11,0.3)' : dgStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(107,114,128,0.2)'}`, borderRadius: '20px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dgStatus === 'connected' ? '#4ade80' : dgStatus === 'connecting' ? '#f59e0b' : dgStatus === 'error' ? '#ef4444' : '#6b7280', animation: dgStatus === 'connecting' ? 'pulse 0.8s infinite' : 'none' }} />
            <span style={{ color: dgStatus === 'connected' ? '#4ade80' : dgStatus === 'connecting' ? '#f59e0b' : dgStatus === 'error' ? '#ef4444' : '#6b7280', fontSize: '11px', fontWeight: 'bold' }}>Deepgram: {dgStatus}</span>
          </span>
        )}
        <span style={{ color: '#6b7280', fontSize: '11px' }}>{transcript.length} lines</span>

        {allPoppedOut && phase === 'live' && (
          <button
            onClick={() => {
              leadPanel.saveLayout();
              transcriptPanel.saveLayout();
              scriptsPanel.saveLayout();
              aiPanel.saveLayout();
              setLayoutSavedMsg(true);
              setTimeout(() => setLayoutSavedMsg(false), 2000);
            }}
            style={{ background: layoutSavedMsg ? 'rgba(74,222,128,0.2)' : `${GOLD}18`, color: layoutSavedMsg ? '#4ade80' : GOLD, border: `1px solid ${layoutSavedMsg ? 'rgba(74,222,128,0.4)' : GOLD + '44'}`, borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
          >
            {layoutSavedMsg ? '✓ Layout Saved' : '💾 Save Layout'}
          </button>
        )}
      </div>

      {error && <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '12px' }}>⚠ {error}</div>}

      {phase === 'live' && coachUser?.username && (
        <div style={{ marginBottom: '12px' }}>
          <LiveComplianceWidget username={coachUser.username} isActive={phase === 'live'} />
        </div>
      )}

      {phase === 'live' && hotStatus !== 'off' && (
        <div style={{ marginBottom: '12px' }}>
          <span style={{ padding: '6px 14px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: hotStatus === 'critical' ? 'rgba(239,68,68,0.15)' : hotStatus === 'hot' ? 'rgba(245,158,11,0.15)' : hotStatus === 'cold' ? 'rgba(107,114,128,0.1)' : 'rgba(96,165,250,0.1)',
            border: `1px solid ${hotStatus === 'critical' ? 'rgba(239,68,68,0.4)' : hotStatus === 'hot' ? 'rgba(245,158,11,0.4)' : hotStatus === 'cold' ? 'rgba(107,114,128,0.3)' : 'rgba(96,165,250,0.3)'}`,
            color: hotStatus === 'critical' ? '#ef4444' : hotStatus === 'hot' ? '#f59e0b' : hotStatus === 'cold' ? '#6b7280' : '#60a5fa',
            fontSize: '11px', fontWeight: 'bold' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%',
              background: hotStatus === 'critical' ? '#ef4444' : hotStatus === 'hot' ? '#f59e0b' : hotStatus === 'cold' ? '#6b7280' : '#60a5fa',
              animation: (hotStatus === 'hot' || hotStatus === 'critical') ? 'pulse 1s infinite' : 'none' }} />
            🔥 Hot Call Tracker: {hotStatus === 'critical' ? 'CRITICAL — agent struggling' : hotStatus === 'hot' ? 'HOT CALL' : hotStatus === 'cold' ? 'Cold — monitoring stopped (saving credits)' : 'Monitoring…'}
            {hotScore != null && ` · ${hotScore}/100`}{agentScore != null && hotStatus !== 'cold' && ` · Agent ${agentScore}/100`}
          </span>
        </div>
      )}

      {testingAudio && (
        <div style={{ marginBottom: '12px', padding: '14px 18px', background: '#0d1b2a', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#60a5fa', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🎙 Agent Mic</div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${agentLevel}%`, height: '100%', background: 'linear-gradient(90deg,#60a5fa,#3b82f6)', borderRadius: '4px', transition: 'width 0.05s' }} />
            </div>
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{agentLevel > 2 ? '✅ Audio detected' : '🔇 No audio'}</div>
          </div>
          {customerMicId && (
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🎧 Customer (Rodecaster)</div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${customerLevel}%`, height: '100%', background: 'linear-gradient(90deg,#f59e0b,#f97316)', borderRadius: '4px', transition: 'width 0.05s' }} />
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{customerLevel > 2 ? '✅ Audio detected' : '🔇 No audio'}</div>
            </div>
          )}
        </div>
      )}

      {/* Lead picker */}
      {showLeadPicker && (
        <div style={{ marginBottom: '12px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Select Existing Lead or Create New</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input value={lead.firstName || ''} onChange={e => setLead(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" style={{ ...inp, flex: 1 }} />
            <input value={lead.lastName || ''} onChange={e => setLead(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" style={{ ...inp, flex: 1 }} />
            <button onClick={createNewLead} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '0 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+ New</button>
          </div>
          {leads.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {leads.map(l => (
                <button key={l.id} onClick={() => { setLead(l); setProfileData(l.profileJson ? (() => { try { return JSON.parse(l.profileJson); } catch { return null; } })() : null); setShowLeadPicker(false); }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px', cursor: 'pointer', textAlign: 'left', color: '#c4cdd8', fontSize: '12px' }}>
                  {l.firstName} {l.lastName} — {l.status} ({l.callCount || 0} calls)
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowLeadPicker(false)} style={{ marginTop: '8px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '11px' }}>✕ Close</button>
        </div>
      )}

      {/* Main layout: lead card + transcript + AI tools — all pop-out enabled */}
      {(() => {
        const cols = [];
        if (!leadPanel.poppedOut) cols.push('380px');
        if (!transcriptPanel.poppedOut) cols.push('1fr');
        if (!scriptsPanel.poppedOut) cols.push('420px');
        if (!aiPanel.poppedOut) cols.push('400px');
        const gridCols = cols.length > 0 ? cols.join(' ') : '1fr';
        const allOut = leadPanel.poppedOut && transcriptPanel.poppedOut && scriptsPanel.poppedOut && aiPanel.poppedOut;

        return (
          <>
            {allOut && phase === 'live' && (
              <div style={{ padding: '40px', textAlign: 'center', background: '#0d1b2a', border: '1px dashed rgba(16,185,129,0.2)', borderRadius: '6px', color: '#6b7280', fontSize: '13px' }}>
                🖥️ All panels popped out. Arrange them on your screen, then click <strong style={{ color: GOLD }}>💾 Save Layout</strong> in the top bar to remember their positions.
                <br /><br />
                <span style={{ fontSize: '11px' }}>Lead: <strong style={{ color: '#c4cdd8' }}>{lead.firstName} {lead.lastName}</strong> {lead.leadNumber && <span style={{ color: GOLD }}>({lead.leadNumber})</span>} · {transcript.length} transcript lines · Intent: {intentScore ?? '—'}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '16px', alignItems: 'start' }}>
              {/* Lead contact card — hidden when Client Profile is open */}
              {!showProfile && (leadPanel.poppedOut ? (
                <div style={{ ...leadPanel.floatingStyle, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
                  <div onMouseDown={leadPanel.onDragStart} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
                    <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 Lead Contact Card</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowLeadPicker(p => !p)} style={{ background: 'rgba(16,185,129,0.1)', color: GOLD, border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{lead.id ? 'Switch' : 'Select'}</button>
                      <button onClick={leadPanel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬇ Pop In</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <DebtLeadCard lead={lead} onLeadChange={setLead} onLeadSaved={handleLeadSaved} transcript={transcript} intentScore={intentScore} animalType={profileData?.animalType} profileData={profileData} />
                  </div>
                  {leadPanel.resizeHandles}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 Lead Contact Card</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowLeadPicker(p => !p)} style={{ background: 'rgba(16,185,129,0.1)', color: GOLD, border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{lead.id ? 'Switch' : 'Select'}</button>
                      <button onClick={leadPanel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬆ Pop Out</button>
                    </div>
                  </div>
                  <DebtLeadCard lead={lead} onLeadChange={setLead} onLeadSaved={handleLeadSaved} transcript={transcript} intentScore={intentScore} animalType={profileData?.animalType} profileData={profileData} />
                </div>
              ))}

              {/* Transcript — pop-out enabled (transcript only) */}
              <LiveTranscriptPanel transcript={transcript} phase={phase} panel={transcriptPanel} onAnswerQuestion={handleAnswerQuestion} lead={lead} micLabel={micDevices.find(m => m.deviceId === micDeviceId)?.label || 'Agent Mic'} username={coachUser?.username} onScriptPositionChange={(pos) => { scriptPositionRef.current = pos; }} />

              {/* Scripts Panel — separate pop-out window for teleprompter + pitches */}
              <LiveScriptsPanel transcript={transcript} phase={phase} panel={scriptsPanel} lead={lead} micLabel={micDevices.find(m => m.deviceId === micDeviceId)?.label || 'Agent Mic'} username={coachUser?.username} onScriptPositionChange={(pos) => { scriptPositionRef.current = pos; }} />

              {/* AI Tools Panel — pop-out enabled */}
              {aiPanel.poppedOut ? (
                <div style={{ ...aiPanel.floatingStyle, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
                  <div onMouseDown={aiPanel.onDragStart} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
                    <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 AI Assistant</span>
                    <button onClick={aiPanel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬇ Pop In</button>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <DebtAIPanel
                      transcript={transcript} kbEntries={kbEntries} isActive={phase === 'live'}
                      profileData={profileData} intentScore={intentScore} ledgerExtracting={ledgerExtracting}
                      memories={memories} lead={lead} micDeviceId={micDeviceId} customerMicId={customerMicId} pendingQuestion={pendingQuestion}
                      canAIAssistant={canLiveAI} canQA={canLiveQA} canCoach={canLiveCoach} canIntent={canLiveIntent}
                      username={coachUser?.username}
                      activeQA={qaActive} activeCoach={coachActive} activeIntent={intentActive}
                      onToggleQA={toggleQaActive} onToggleCoach={toggleCoachActive} onToggleIntent={toggleIntentActive}
                      autoOpenPopup={phase === 'live'}
                    />
                  </div>
                  {aiPanel.resizeHandles}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 AI Assistant</div>
                    <button onClick={aiPanel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬆ Pop Out</button>
                  </div>
                  <DebtAIPanel
                    transcript={transcript} kbEntries={kbEntries} isActive={phase === 'live'}
                    profileData={profileData} intentScore={intentScore} ledgerExtracting={ledgerExtracting}
                    memories={memories} lead={lead} micDeviceId={micDeviceId} customerMicId={customerMicId} pendingQuestion={pendingQuestion}
                    canAIAssistant={canLiveAI} canQA={canLiveQA} canCoach={canLiveCoach} canIntent={canLiveIntent}
                    username={coachUser?.username}
                    activeQA={qaActive} activeCoach={coachActive} activeIntent={intentActive}
                    onToggleQA={toggleQaActive} onToggleCoach={toggleCoachActive} onToggleIntent={toggleIntentActive}
                    autoOpenPopup={phase === 'live'}
                  />
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* Do Nothing Calculator — shows for close mode */}
      {callMode === 'close' && lead.id && (
        <div style={{ marginTop: '16px' }}>
          <DoNothingCalculator lead={lead} mode={callMode} />
        </div>
      )}

      {/* Post-call report */}
      {phase === 'ended' && (
        <div style={{ marginTop: '16px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '20px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>📄 Post-Call Report</div>
          {generatingReport ? <div style={{ color: '#6b7280', fontSize: '12px' }}>⏳ Generating report…</div> : report ? <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{report}</div> : <div style={{ color: '#4a5568', fontSize: '12px' }}>No report generated.</div>}
        </div>
      )}

      {/* Floating Client Profile pop-out button */}
      <button
        onClick={() => setShowProfile(true)}
        disabled={!lead.id}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
          background: lead.id ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(255,255,255,0.05)',
          color: lead.id ? '#0a0f1e' : '#4a5568',
          border: `1px solid ${lead.id ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '28px', padding: '12px 20px', cursor: lead.id ? 'pointer' : 'not-allowed',
          fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
          boxShadow: lead.id ? '0 4px 16px rgba(16,185,129,0.3)' : 'none',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        👤 Client Profile
      </button>

      {showProfile && lead.id && (
        <ClientProfileModal lead={lead} username={coachUser?.username} onClose={() => setShowProfile(false)} onSave={(updated) => setLead(updated)} />
      )}

      {/* End Call Dialog — asks keep or delete profile/lead contact card */}
      {showEndDialog && phase === 'live' && (
        <EndCallDialog
          lead={lead}
          transcriptLineCount={transcript.length}
          onKeep={() => handleEndChoice(false)}
          onDelete={() => handleEndChoice(true)}
          onCancel={() => setShowEndDialog(false)}
        />
      )}

      {/* Customer Stats Popup — auto-detects insights during live calls */}
      <CustomerStatsPopup
        lead={lead}
        transcript={transcript}
        isActive={phase === 'live'}
        agentUsername={coachUser?.username}
        phase={phase}
        onStartCall={() => startCall(true)}
        onStopCall={handleEndCallClick}
        isInbound={isInbound}
        onToggleInbound={setIsInbound}
        micMuted={micMuted}
        onToggleMicMute={toggleMicMute}
        paused={statsPaused}
      />

      {/* Ready for Next Call briefing — available after call ends */}
      {phase === 'ended' && lead.id && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
          <NextCallBriefing lead={lead} agentUsername={coachUser?.username} />
        </div>
      )}

      {/* Appointment Preview — shows parsed callback info for approval */}
      {apptPreview && lead.id && (
        <AppointmentPreviewModal
          preview={apptPreview}
          lead={lead}
          agentName={coachUser?.username}
          onDone={(result) => {
            // Only auto-schedule when the user explicitly approved (result is truthy).
            // Closing or "Do Not Schedule" cancels — no auto-book fallback.
            setApptPreview(null);
          }}
        />
      )}
    </div>
  );
}