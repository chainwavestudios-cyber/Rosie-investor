/**
 * DebtLiveCall.jsx — Live call coaching with debt settlement lead contact card.
 * Captures headset mic → Deepgram (diarize + sentiment) → live Q&A/Coach/Intent + profile building.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import DebtLeadCard from '@/components/debt/DebtLeadCard';
import { DEBT_INTENT_RULES } from '@/components/debt/DebtIntentSignals';
import LiveTranscriptPanel from '@/components/debt/LiveTranscriptPanel';
import LiveScriptsPanel from '@/components/debt/LiveScriptsPanel';
import DebtAIPanel from '@/components/debt/DebtAIPanel';
import DoNothingCalculator from '@/components/debt/DoNothingCalculator';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import { findLoopback, findIsolatedInput, isLoopbackSource, isMasterMixInput } from '@/lib/audioDevices';
import { audioConstraints, captureChannelInfo } from '@/lib/audioChannels';
import useInputLevelTest from '@/hooks/useInputLevelTest';
import LiveCallControls from '@/components/debt/LiveCallControls';
import { AUDIO_MODE_DEFAULTS, audioModes, resolveAudioMode, captureAudioMode, isAudioModeEdited } from '@/lib/debtAudioModes';
import LiveComplianceWidget from '@/components/compliance/LiveComplianceWidget';
import CustomerStatsPopup from '@/components/debt/CustomerStatsPopup';
import { buildIntentReport } from '@/components/debt/intentReport';
import AppointmentPreviewModal from '@/components/debt/AppointmentPreviewModal';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';
import { startLiveFeed } from '@/lib/debtLiveFeed';
import { notifyCreditExhaustion, checkAIResponseForCreditError, checkErrorForCreditError } from '@/lib/creditAlert';
import { useHotCallTracker } from '@/hooks/useHotCallTracker';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { useDebtCoachValue, getDebtCoachValue, getAllDebtCoachValues, setAllDebtCoachValues } from '@/lib/debtCoachStorage';
import { liveWindowGeometry, LIVE_LAYOUT_KEY, LIVE_PROFILE_STORE, LIVE_MODE_KEY, LIVE_PANEL_KEYS,
  getWorkspaceViewport, resolveDisplayProfile, displayProfileName,
  createDisplayLayout, clampDisplayLayout } from '@/lib/liveWorkspaceLayout';
import LiveWorkspaceToolbar from '@/components/debt/LiveWorkspaceToolbar';
import EndCallDialog from '@/components/debt/EndCallDialog';
import { useCallRecorder } from '@/hooks/useCallRecorder';
import { useObjectionEngine } from '@/hooks/useObjectionEngine';
import ObjectionPopup from '@/components/debt/ObjectionPopup';
import LiveObjectionRail from '@/components/debt/LiveObjectionRail';
import { logAIUsage, CREDIT_ESTIMATES } from '@/lib/aiCreditLog';
import { isSameSentence, mergeFragments, trailingTurn } from '@/lib/transcriptTurn';
import { useAIContactFiller } from '@/hooks/useAIContactFiller';
import { useInlineDialer } from '@/hooks/useInlineDialer';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const DEFAULT_AUDIO_SETUPS = AUDIO_MODE_DEFAULTS;
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const DEBT_KB_CATEGORIES = ['debt_agent', 'debt_customer', 'debt_qa_statements', 'debt_doc', 'debt_web', 'debt_call', 'debt_kb', 'debt_faq', 'debt_hotpoints', 'debt_common_qa', 'debt_objections', 'debt_disqualify', 'debt_open_scenario', 'debt_close_scenario'];

import LiveQAWindow from '@/components/debt/LiveQAWindow';
// Context for the next liveAssistantAI call — stamped by logAI so the backend
// records exact token usage and cost against the same AI call (matched by callId).
let nextAICallContext = null;
function takeAICallContext() {
  const ctx = nextAICallContext;
  nextAICallContext = null;
  return ctx;
}

async function invokeAI(functionName, payload) {
  const ctx = takeAICallContext();
  try {
    const res = await base44.functions.invoke(functionName, ctx ? { ...payload, _ctx: ctx } : payload);
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

// Word-overlap ratio between two strings — used to detect cross-channel bleed
// (agent mic picking up customer audio from an external speaker).
function textSimilarity(a, b) {
  const wa = new Set((a || '').toLowerCase().split(/\s+/).filter(Boolean));
  const wb = new Set((b || '').toLowerCase().split(/\s+/).filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.min(wa.size, wb.size);
}

export default function DebtLiveCall({ onCallStart, onCallEnd, onScriptContextChange, onTwilioPresenceChange, launchAction }) {
  const { user: coachUser, can, sessionToken, sessionUserId } = useDebtCoachAuth();
  const recorder = useCallRecorder();
  const aiSettings = (() => { try { return JSON.parse(coachUser?.aiSettingsJson || '{}'); } catch { return {}; } })();
  const canLiveAI = can('liveAIAssistant') && aiSettings.liveAIEnabled !== false;
  const canLiveQA = can('liveQA') && aiSettings.liveQA !== false;
  const canLiveCoach = can('liveCoach') && aiSettings.liveCoach !== false;
  const canLiveIntent = can('liveIntent') && aiSettings.liveIntent !== false;
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId, micLoaded] = useDebtCoachValue(coachUser?.username, 'defaultMicDeviceId', '');
  const [customerMicId, setCustomerMicId, customerMicLoaded] = useDebtCoachValue(coachUser?.username, 'defaultCustomerMicId', '');
  // A multichannel mixer keeps its isolated tracks inside one device (mic 1 = track 3).
  const [agentChannel, setAgentChannel] = useDebtCoachValue(coachUser?.username, 'agentMicChannel', 0);
  const [customerChannel, setCustomerChannel] = useDebtCoachValue(coachUser?.username, 'customerMicChannel', 0);
  // Two saved audio setups — e.g. computer + Rodecaster, and cell + Realtek.
  const [audioSetups, setAudioSetups, setupsLoaded] = useDebtCoachValue(coachUser?.username, 'audioSetupsJson', DEFAULT_AUDIO_SETUPS);
  const [activeSetupIndex, setActiveSetupIndex, activeSetupLoaded] = useDebtCoachValue(coachUser?.username, 'activeAudioSetup', 0);
  const [outputDevices, setOutputDevices] = useState([]);
  const [outputDeviceId, setOutputDeviceId, outputLoaded] = useDebtCoachValue(coachUser?.username, 'defaultOutputDeviceId', '');
  const [agentGain, setAgentGain, agentGainLoaded] = useDebtCoachValue(coachUser?.username, 'agentMicGain', 1);
  const [customerGain, setCustomerGain, customerGainLoaded] = useDebtCoachValue(coachUser?.username, 'customerMicGain', 1);
  const [deviceScanCompleted, setDeviceScanCompleted] = useState(false);
  const firstDeviceScanRef = useRef(false);
  const restoredAudioModeRef = useRef('');
  const [audioModeMessage, setAudioModeMessage] = useState('');
  const [savingAudioMode, setSavingAudioMode] = useState(false);
  const modes = audioModes(audioSetups);
  const activeAudioMode = modes[activeSetupIndex] || modes[0];
  const audioModeValidation = resolveAudioMode(activeAudioMode, micDevices, outputDevices, isLoopbackSource);
  const audioDeviceStateRef = useRef(null);
  audioDeviceStateRef.current = {
    micDeviceId, customerMicId, outputDeviceId,
    hasSavedMode: !!(setupsLoaded && activeSetupLoaded && activeAudioMode?.saved),
  };
  const [phase, setPhase] = useState('idle');
  const phaseRef = useRef('idle');
  phaseRef.current = phase;
  const twilioMediaRef = useRef(false);
  const twilioDialerRef = useRef(null);
  const [twilioWarning, setTwilioWarning] = useState('');
  const [officeBridge, setOfficeBridge] = useState(null);
  const officeBridgeRef = useRef(null);
  const officeMonitorStartedRef = useRef(false);
  const officeEndedRef = useRef(false);
  const lastLaunchTokenRef = useRef(null);
  const officeActionBusyRef = useRef(false);
  const setOffice = useCallback((next) => {
    officeBridgeRef.current = typeof next==='function' ? next(officeBridgeRef.current) : next;
    setOfficeBridge(officeBridgeRef.current);
  }, []);
  const [error, setError] = useState('');
  const [dgStatus, setDgStatus] = useState('idle');
  const [testMode, setTestMode] = useState(false);
  const [statsPaused, setStatsPaused] = useDebtCoachValue(coachUser?.username, 'statsPaused', true);
  const [transcript, setTranscript] = useState([]);
  const { activeObjection, dismissObjection, recentMatches, openMatch, clearRecent } = useObjectionEngine(transcript, phase === 'live');
  const [kbEntries, setKbEntries] = useState([]);
  const [kbLoading, setKbLoading] = useState(true);

  // Notify parent when a live call starts/ends so it can auto-switch tabs and pop out panels
  const prevPhaseRef = useRef('idle');
  useEffect(() => {
    // Global flag so MissedAppointmentAlert and other components know a live
    // call is active and can suppress audio playback (beeps get picked up by
    // the agent mic and pollute the Deepgram transcript).
    window.__debtCallActive = phase === 'live';
    if (prevPhaseRef.current !== 'live' && phase === 'live') onCallStart?.(lead);
    if (prevPhaseRef.current === 'live' && phase !== 'live') onCallEnd?.();
    prevPhaseRef.current = phase;
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const agentQuestionWaitingRef = useRef(false);
  const agentQuestionTimeoutRef = useRef(null);

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
  // Share live intent and transcript with Scripts AND Smart Close while the call is mounted.
  useEffect(() => {
    onScriptContextChange?.({ lead, liveTranscript: transcript, phase, intentScore, animalType: profileData?.animalType || lead?.animalType });
  }, [lead, transcript, phase, intentScore, profileData?.animalType, onScriptContextChange]);

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
  // Auto-scheduler permanently disabled — appointments are created on demand
  // via the Live Profile Agent or the Appointment Preview modal.
  // AI feature auto-enable toggles — saved with layout (popout_ prefix)
  const [autoQA, setAutoQA] = useDebtCoachValue(coachUser?.username, 'popout_auto_qa', true);
  const [autoCoach, setAutoCoach] = useDebtCoachValue(coachUser?.username, 'popout_auto_coach', true);
  const [autoIntent, setAutoIntent] = useDebtCoachValue(coachUser?.username, 'popout_auto_intent', true);
  const [apptPreview, setApptPreview] = useState(null);
  const leadPersistedRef = useRef(false);
  const transcriptRecordIdRef = useRef(null);
  // The full contact profile opens automatically for the live call.
  const [showProfile, setShowProfile] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  // Per-desktop-size workspace profiles. Screen selection is independent
  // from the Rodecaster multitrack and all live voice/AI settings.
  const [layoutMode, setLayoutMode, layoutModeLoaded] = useDebtCoachValue(
    coachUser?.username, LIVE_MODE_KEY, 'auto');
  const [workspaceViewport, setWorkspaceViewport] = useState(getWorkspaceViewport);
  const selectedLayoutProfile = resolveDisplayProfile(layoutMode, workspaceViewport);
  const [savedLayoutProfiles, setSavedLayoutProfiles] = useState([]);
  const workspaceRequestRef = useRef(0);
  const [workspaceApplying, setWorkspaceApplying] = useState(false);
  useEffect(()=>{
    let timer;
    const onResize=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>setWorkspaceViewport(getWorkspaceViewport()),180);
    };
    window.addEventListener('resize',onResize);
    return()=>{clearTimeout(timer);window.removeEventListener('resize',onResize);};
  },[]);

  // Start with an ultrawide-friendly layout when the browser occupies a
  // 3840 × 1080 display. Saved geometry overrides it as soon as it loads.
  const initialWindowsRef=useRef(null);
  if(!initialWindowsRef.current){
    const viewport=getWorkspaceViewport();
    initialWindowsRef.current=Object.fromEntries(LIVE_PANEL_KEYS.map(key=>[
      key,liveWindowGeometry(key,viewport)
    ]));
  }
  const initialWindows=initialWindowsRef.current;
  const transcriptPanel=usePopOutPanel('live_transcript',initialWindows.live_transcript.size,
    coachUser?.username,9998,false,{defaultPosition:initialWindows.live_transcript.position,minWidth:320});
  const scriptsPanel=usePopOutPanel('live_scripts',initialWindows.live_scripts.size,
    coachUser?.username,9998,false,{defaultPosition:initialWindows.live_scripts.position,minWidth:330});
  const aiPanel=usePopOutPanel('live_ai_panel',initialWindows.live_ai_panel.size,
    coachUser?.username,15010,false,{defaultPosition:initialWindows.live_ai_panel.position,minWidth:350});
  const [showCustomerStats,setShowCustomerStats]=useState(false);
  const allPoppedOut=transcriptPanel.poppedOut&&scriptsPanel.poppedOut&&aiPanel.poppedOut;
  const [isInbound,setIsInbound]=useState(false);
  const [layoutSavedMsg,setLayoutSavedMsg]=useState('');
  const [layoutSaving,setLayoutSaving]=useState(false);

  const applyDisplayProfile=useCallback(async(profileId, {showFeedback=false}={})=>{
    const username=coachUser?.username;
    if(!username || !layoutModeLoaded)return;
    const requestId=++workspaceRequestRef.current;
    setWorkspaceApplying(true);
    try{
      const settings=await getAllDebtCoachValues(username);
      if(workspaceRequestRef.current!==requestId)return;
      const profiles=settings[LIVE_PROFILE_STORE]||{};
      const raw=profiles[profileId]||createDisplayLayout(profileId,workspaceViewport);
      const layout=clampDisplayLayout({...raw,profileId},workspaceViewport);
      const payload=Object.fromEntries(LIVE_PANEL_KEYS.map(key=>[
        'popout_'+key,layout['popout_'+key]
      ]));
      const saved=await setAllDebtCoachValues(username,payload);
      if(workspaceRequestRef.current!==requestId)return;
      if(!saved)throw new Error('Your layout could not be loaded from the settings database.');
      window.dispatchEvent(new CustomEvent('live_workspace_layout_restored'));
      setSavedLayoutProfiles(Object.keys(profiles));
      setShowProfile(layout.profileVisible!==false && !!leadRef.current?.id);
      if(showFeedback) setLayoutSavedMsg(
        profiles[profileId]?'✓ Saved '+displayProfileName(profileId)+' layout loaded':'✓ Default '+displayProfileName(profileId)+' layout loaded');
    }catch(e){
      if(workspaceRequestRef.current===requestId){
        console.warn('[Live workspace] Could not load display profile:',e?.message);
        setLayoutSavedMsg('Layout load failed: '+(e?.message||String(e)));
      }
    }finally{if(workspaceRequestRef.current===requestId)setWorkspaceApplying(false);}
  },[coachUser?.username,layoutModeLoaded,workspaceViewport.width,workspaceViewport.height]);

  const saveDefaultLayout=async()=>{
    const username=coachUser?.username;
    if(!username||layoutSaving||workspaceApplying)return;
    setLayoutSaving(true);setLayoutSavedMsg('');
    try{
      const settings=await getAllDebtCoachValues(username);
      const defaultContact=createDisplayLayout(selectedLayoutProfile,workspaceViewport).popout_live_contact_profile;
      const payload={
        popout_live_transcript:{poppedOut:transcriptPanel.poppedOut,position:transcriptPanel.position,size:transcriptPanel.size},
        popout_live_scripts:{poppedOut:scriptsPanel.poppedOut,position:scriptsPanel.position,size:scriptsPanel.size},
        popout_live_ai_panel:{poppedOut:aiPanel.poppedOut,position:aiPanel.position,size:aiPanel.size},
        popout_live_contact_profile:settings.popout_live_contact_profile||defaultContact
      };
      const snapshot={
        version:2,profileId:selectedLayoutProfile,profileVisible:showProfile,
        updatedAt:new Date().toISOString(),...payload
      };
      const profiles={...(settings[LIVE_PROFILE_STORE]||{}),[selectedLayoutProfile]:snapshot};
      const result=await setAllDebtCoachValues(username,{
        ...payload,[LIVE_LAYOUT_KEY]:snapshot,[LIVE_PROFILE_STORE]:profiles
      });
      if(!result)throw new Error('Your layout could not be saved to the settings database.');
      setSavedLayoutProfiles(Object.keys(profiles));
      setLayoutSavedMsg('✓ Saved '+displayProfileName(selectedLayoutProfile)+' for future calls');
    }catch(e){
      setLayoutSavedMsg('Save failed: '+(e?.message||String(e)));
    }finally{setLayoutSaving(false);}
  };

  const resetWorkspaceLayout=async()=>{
    const username=coachUser?.username;
    if(!username||layoutSaving||workspaceApplying)return;
    setLayoutSaving(true);setLayoutSavedMsg('');
    try{
      const layout=createDisplayLayout(selectedLayoutProfile,workspaceViewport);
      const current=await getAllDebtCoachValues(username);
      const profiles={...(current[LIVE_PROFILE_STORE]||{}),[selectedLayoutProfile]:{
        ...layout,updatedAt:new Date().toISOString()
      }};
      const payload=Object.fromEntries(LIVE_PANEL_KEYS.map(key=>[
        'popout_'+key,layout['popout_'+key]
      ]));
      const result=await setAllDebtCoachValues(username,{
        ...payload,[LIVE_PROFILE_STORE]:profiles,[LIVE_LAYOUT_KEY]:layout
      });
      if(!result)throw new Error('The default positions could not be saved.');
      window.dispatchEvent(new CustomEvent('live_workspace_layout_restored'));
      transcriptPanel.openAtSavedPosition();scriptsPanel.openAtSavedPosition();aiPanel.openAtSavedPosition();
      if(leadRef.current?.id)setShowProfile(true);
      setSavedLayoutProfiles(Object.keys(profiles));
      setLayoutSavedMsg('✓ '+displayProfileName(selectedLayoutProfile)+' reset; other screens preserved');
    }catch(e){setLayoutSavedMsg('Reset failed: '+(e?.message||String(e)));}
    finally{setLayoutSaving(false);}
  };

  // Auto-detect by browser viewport. Switching displays loads THAT screen's
  // separate profile. Moving a window within the same size class does not
  // overwrite the stored default until the user explicitly clicks Save.
  useEffect(()=>{
    if(!layoutModeLoaded||!coachUser?.username)return;
    void applyDisplayProfile(selectedLayoutProfile);
  },[layoutModeLoaded,coachUser?.username,selectedLayoutProfile,applyDisplayProfile]);

  // Each new call starts from the selected screen profile, even if the agent
  // temporarily moved windows during their previous live conversation.
  useEffect(()=>{
    if(phase!=='live'||!layoutModeLoaded||!coachUser?.username)return;
    void applyDisplayProfile(selectedLayoutProfile);
  },[phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(phase!=='live')return;
    setShowProfile(true);
    scriptsPanel.openAtSavedPosition();transcriptPanel.openAtSavedPosition();aiPanel.openAtSavedPosition();
  },[phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const [micMuted, setMicMuted] = useState(false);

  // Toggle the agent mic stream tracks on/off (mutes audio sent to Deepgram)
  const toggleMicMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) { setMicMuted(false); return; }
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) return;
    const anyEnabled = tracks.some(t => t.enabled);
    tracks.forEach(t => { t.enabled = !anyEnabled; });
    setMicMuted(anyEnabled);
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

  const feedRef = useRef(null);
  const streamRef = useRef(null);
  const customerStreamRef = useRef(null);
  const ctxRef = useRef(null);
  const processorRef = useRef(null);
  const transcriptRef = useRef([]);
  const leadRef = useRef(lead);
  // A manually edited email is authoritative for the active lead, including
  // while it is still incomplete / unsaved. AI may fill empty untouched email
  // fields but must never replace a human's draft or confirmed email.
  const manualEmailDraftRef = useRef({ leadId: null, value: null });
  const handleManualLeadField = useCallback((field, value) => {
    if (field === 'email') {
      manualEmailDraftRef.current = { leadId: leadRef.current?.id || null, value };
    }
    setLead(prev => {
      const next = { ...prev, [field]: value };
      leadRef.current = next;
      return next;
    });
  }, []);
  useEffect(() => {
    const refresh = async (event) => {
      const id = leadRef.current?.id;
      const fields = Array.isArray(event.detail) ? event.detail : [];
      if (!id || !fields.length) return;
      const savedLead = await base44.entities.DebtLead.get(id);
      setLead(current => {
        if (current.id !== id) return current;
        const accepted = fields.filter(field => field in savedLead && !(field === 'email' && manualEmailDraftRef.current.leadId === id));
        const next = { ...current, ...Object.fromEntries(accepted.map(field => [field, savedLead[field]])) };
        leadRef.current = next;
        return next;
      });
    };
    window.addEventListener('lead_autosaved', refresh);
    return () => window.removeEventListener('lead_autosaved', refresh);
  }, []);
  // A deliberate Scripts-tab save is authoritative, including email. Do not let
  // Live Call's unsaved-email guard overwrite or hide the saved script value.
  useEffect(() => {
    const syncScript = (event) => {
      const { leadId, updates } = event.detail || {};
      if (!leadId || leadRef.current?.id !== leadId || !updates) return;
      if ('email' in updates) manualEmailDraftRef.current = { leadId: null, value: null };
      setLead(previous => {
        if (previous.id !== leadId) return previous;
        const next = { ...previous, ...updates };
        leadRef.current = next;
        return next;
      });
    };
    window.addEventListener('debt_script_contact_saved', syncScript);
    return () => window.removeEventListener('debt_script_contact_saved', syncScript);
  }, []);
  const { runFiller: runContactFiller } = useAIContactFiller({
    leadId: lead?.id, leadType: 'debt', transcript, isActive: phase === 'live',
    getScriptContent: () => scriptPositionRef.current?.content || '',
    getProtectedFields: () => manualEmailDraftRef.current.leadId === leadRef.current?.id ? ['email'] : [],
  });
  const runContactFillerRef = useRef(runContactFiller);
  useEffect(() => { runContactFillerRef.current = runContactFiller; }, [runContactFiller]);
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
  const customerBufferRef = useRef([]);
  const bufferTimeoutRef = useRef(null);
  // The caller's turn as last asked in Q&A — lets a turn that was flushed
  // mid-sentence and then continued ask only the new part.
  const lastAskedQuestionRef = useRef('');
  const lastAskedAtRef = useRef(0);
  const recentQaRequestRef = useRef({ question: '', ts: 0, id: null });
  const supersededQaIdsRef = useRef(new Set());
  const interimPaintTimeRef = useRef({});
  const monitorPcRef = useRef(null);
  const stopCallRef = useRef(null);
  const twilioDialer = useInlineDialer({
    agentName: coachUser?.username || 'debt-agent',
    leadId: lead?.id || null,
    onCallStream: (streams) => {
      if (!streams) {
        if (twilioMediaRef.current) stopCallRef.current?.();
        return;
      }
      const remoteAvailable=!!streams.remoteStream?.getAudioTracks?.().length;
      const agentAvailable=!!streams.localStream?.getAudioTracks?.().length;
      if (!remoteAvailable || (!streams.mixOnly && !agentAvailable)) {
        setTwilioWarning('Twilio connected but the voice track is not ready. The phone call may be connected; Live transcription has not started.');
        return;
      }
      if (twilioMediaRef.current || phaseRef.current === 'live') return;
      twilioMediaRef.current = true;
      setTwilioWarning('');
      startCallRef.current?.(false, false, streams.mixOnly
        ? {agentStream:streams.remoteStream,customerStream:null,mixOnly:true}
        : {agentStream:streams.localStream,customerStream:streams.remoteStream});
    },
  });
  twilioDialerRef.current = twilioDialer;
  useEffect(() => {
    onTwilioPresenceChange?.(Boolean(officeBridge?.bridgeToken || twilioDialer.isActive));
  }, [officeBridge?.bridgeToken, twilioDialer.isActive, onTwilioPresenceChange]);

  useEffect(() => { leadRef.current = lead; }, [lead]);
  useEffect(() => { inboundRef.current = isInbound; }, [isInbound]);

  // Identifying a contact must never interrupt a live call with a profile modal.

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

  // Passive device enumeration on mount; microphone permission is requested
  // only after an explicit Re-scan / Test / Start Call action.
  // Windows Stereo Mix / Rodecaster sources still auto-select when enumerated.
  const loadDevices = useCallback(async (requestPermission = false) => {
    // List what Windows reports FIRST — before any permission grab — so a denied
    // or busy mic can never leave the dropdowns completely empty.
    const scan = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const ins = devices.filter(d => d.kind === 'audioinput');
      const outs = devices.filter(d => d.kind === 'audiooutput');
      setMicDevices(ins);
      setOutputDevices(outs);
      return { mics: ins, outputs: outs };
    };
    let { mics, outputs } = await scan();
    // Labels (and some loopback/virtual inputs) only appear after a permission
    // grant — grab the mic once, release it, then list again for the full set.
    const stream = requestPermission ? await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null) : null;
    if (stream) {
      // Release the mic immediately — we only grabbed it to populate device labels.
      // Keeping it open leaves Chrome showing "using mic" and can cause the later
      // call-start getUserMedia to be denied.
      stream.getTracks().forEach(t => t.stop());
      ({ mics, outputs } = await scan());
    }
    // Offer first-run suggestions only if there is NO saved audio mode.
    // Never overwrite a restored selection (including deliberate customer = None).
    // The preferred hardware is never assumed to be the same for Computer and Cell.
    if (!firstDeviceScanRef.current && !audioDeviceStateRef.current?.hasSavedMode) {
      const current = audioDeviceStateRef.current || {};
      // The isolated channel (USB 3) carries one voice; the master mix (1-2)
      // carries both, so the isolated pair is always preferred.
      const isolated = findIsolatedInput(mics);
      const rode = mics.find(m => !['default', 'communications'].includes(m.deviceId) && !isMasterMixInput(m.label || '') && /rode|røde|rodecaster/i.test(m.label || ''))
        || mics.find(m => !['default', 'communications'].includes(m.deviceId) && /rode|røde|rodecaster/i.test(m.label || ''));
      const agentId = current.micDeviceId || (isolated || rode || mics[0])?.deviceId;
      const loop = findIsolatedInput(mics, [agentId])
        || findLoopback(mics.filter(m => m.deviceId !== agentId && !isMasterMixInput(m.label || '')))
        || findLoopback(mics.filter(m => m.deviceId !== agentId));
      if (!current.micDeviceId && mics.length) setMicDeviceId(agentId);
      if (!current.customerMicId && loop) setCustomerMicId(loop.deviceId);
      if (!current.outputDeviceId && outputs.length) setOutputDeviceId(outputs[0].deviceId);
    }
    firstDeviceScanRef.current = true;
    setDeviceScanCompleted(true);
  }, []);

  useEffect(() => {
    if (!micLoaded || !customerMicLoaded || !outputLoaded || !setupsLoaded || !activeSetupLoaded) return;
    loadDevices(false);
  }, [micLoaded, customerMicLoaded, outputLoaded, setupsLoaded, activeSetupLoaded, loadDevices]);

  // Windows devices that are enabled/plugged in after the page loaded (Stereo
  // Mix turned on, speaker connected) show up immediately instead of needing
  // a manual re-scan.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onDeviceChange = () => loadDevices(false);
    md.addEventListener('devicechange', onDeviceChange);
    return () => md.removeEventListener('devicechange', onDeviceChange);
  }, [loadDevices]);

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
    manualEmailDraftRef.current = { leadId: null, value: null };
    setLead(selectedLead);
    leadRef.current = selectedLead;
    setProfileData(selectedLead.profileJson ? (() => { try { return JSON.parse(selectedLead.profileJson); } catch { return null; } })() : null);
    // Keep the contact card docked; the agent may open the profile manually.
    // Start the call with this lead
    setTimeout(() => startCall(false), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After Save on the lead card: lead is persisted in the card; here we close the card and open the Client Profile
  const handleLeadSaved = useCallback((savedLead) => {
    setLead(prev => {
      const draft = manualEmailDraftRef.current;
      const next = { ...savedLead, ...(draft.leadId === savedLead.id ? { email: draft.value } : {}) };
      leadRef.current = next;
      return next;
    });
    loadLeads();
    // Leave focus in the call workspace after saving; profile opens on demand.
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

  // Transcript consolidation is not needed: the feed emits whole sentences.

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
    const callId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const context = {
      callId,
      callType,
      agentUsername: coachUser?.username || '',
      leadId: leadRef.current?.id || '',
      leadName: `${leadRef.current?.firstName || ''} ${leadRef.current?.lastName || ''}`.trim(),
      leadNumber: leadRef.current?.leadNumber || '',
      transcriptId: transcriptRecordIdRef.current || '',
    };
    // Hand the same context to the next liveAssistantAI call so its exact token
    // usage and cost attach to this AI call in the AI Reports breakdown.
    nextAICallContext = context;
    logAIUsage({
      ...context,
      estimatedCredits: CREDIT_ESTIMATES[callType] ?? 1,
    });
  }, [coachUser]);

  const handleQa = useCallback((question) => {
    const id = Date.now() + Math.random();
    const startTime = Date.now();
    const prior = recentQaRequestRef.current;
    const normalized = question.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (prior.question === normalized && startTime - prior.ts < 11000) return;
    // If an early endpoint split a question, replace its card with the longer,
    // corrected question. A late reply to the old request cannot reappear.
    if (prior.id && startTime - prior.ts < 7000 && normalized.startsWith(prior.question) && normalized.length > prior.question.length) {
      supersededQaIdsRef.current.add(prior.id);
      setQaItems(prev => prev.filter(x => x.id !== prior.id));
    }
    recentQaRequestRef.current = { question: normalized, ts: startTime, id };
    setQaItems(prev => [...prev, { id, question, answer: '', loading: true }]);
    logAI('qa');
    invokeAI('liveAssistantAI', { question, transcript: transcriptRef.current.slice(-8), kbEntries, kbName: 'Debt Settlement', scriptPosition: scriptPositionRef.current })
      .then(res => {
        if (supersededQaIdsRef.current.has(id)) return;
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
        setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer, reallyAsking, opener, detail, source: res?.source || res?.data?.source || '', loading: false, responseMs } : x));
        // Q&A results remain available during the call. The existing
        // saveCallOutcome flow persists them once at call end, avoiding
        // duplicate DebtQAHistory rows and extra network traffic mid-call.
      })
      .catch(() => { if (!supersededQaIdsRef.current.has(id)) setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer: 'Unable to answer.', loading: false } : x)); });
  }, [kbEntries]);

  // Handle pushed questions once, regardless of whether the panel is popped out.
  const handledPendingQuestionRef = useRef(null);
  useEffect(() => {
    if (!pendingQuestion?.question || handledPendingQuestionRef.current === pendingQuestion.ts) return;
    handledPendingQuestionRef.current = pendingQuestion.ts;
    handleQa(pendingQuestion.question);
  }, [pendingQuestion, handleQa]);

  // Auto-flush the agent question buffer — combines captured lines and sends
  // as a single Q&A question. Called by the silence timeout, customer-speech
  // detection, question-mark detection, or a manual second press.
  const flushAgentQuestion = useCallback(() => {
    if (agentQuestionTimeoutRef.current) { clearTimeout(agentQuestionTimeoutRef.current); agentQuestionTimeoutRef.current = null; }
    const combined = agentQuestionBufferRef.current.join(' ').trim();
    agentQuestionBufferRef.current = [];
    agentQuestionActiveRef.current = false;
    agentQuestionWaitingRef.current = false;
    setAgentQuestionActive(false);
    if (combined.length > 0) {
      logAI('qa');
      setPendingQuestion({ question: combined, ts: Date.now() });
    }
  }, [logAI]);

  // Agent Question mode — press ONCE to start, speak your question, and it
  // auto-answers when you stop speaking (3s silence), when the customer starts
  // talking, or when your sentence ends with ? or !. Press again for an
  // immediate answer without waiting for the silence timeout.
  const toggleAgentQuestion = useCallback(() => {
    if (agentQuestionActiveRef.current) {
      // Already ON — manual flush for an immediate answer
      flushAgentQuestion();
    } else {
      agentQuestionBufferRef.current = [];
      agentQuestionWaitingRef.current = false;
      agentQuestionActiveRef.current = true;
      setAgentQuestionActive(true);
    }
  }, [flushAgentQuestion]);

  // Flush the caller's buffered turn as ONE complete question. The buffer holds
  // the transcript's merged trailing turn, so Q&A gets whole sentences instead
  // of the last Deepgram fragment.
  const flushCustomerBuffer = useCallback(() => {
    if (bufferTimeoutRef.current) { clearTimeout(bufferTimeoutRef.current); bufferTimeoutRef.current = null; }
    if (customerBufferRef.current.length === 0) return;
    const settled = customerBufferRef.current.join(' ').replace(/\s+/g, ' ').trim();
    customerBufferRef.current = [];
    if (!settled || settled.length < 3) return;
    // Short questions are first-class: "Why?", "What fees?" and
    // "How much?" should not be dropped because of character/word count.
    const normalized = settled.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const previous = lastAskedQuestionRef.current.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const recentlyAsked = Date.now() - lastAskedAtRef.current < 11000;
    // Deepgram sometimes emits the same thought again with punctuation or a
    // short trailing phrase; never fire a second AI request for that echo.
    if (recentlyAsked && (normalized === previous || (previous.startsWith(normalized) && previous.length - normalized.length < 24))) return;
    lastAskedQuestionRef.current = settled;
    lastAskedAtRef.current = Date.now();
    // Full settled customer turn goes to the one canonical live Q&A engine.
    handleQa(settled);
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
        // Do not replace a manually entered (possibly unsaved) email or an
        // existing email. AI extraction is a blank-field suggestion only.
        if (contact.email && !leadRef.current.email && manualEmailDraftRef.current.leadId !== leadRef.current.id) updates.email = contact.email;
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
  const recentBleedRef = useRef([]);
  const processNewEntry = useCallback((entry) => {
    // Deduplicate — Deepgram with utterances=true can send the same final transcript twice
    const last = lastEntryRef.current;
    if (last && last.speaker === entry.speaker) {
      const dt = Date.now() - last.ts;
      // Exact duplicate within 3s
      if (last.text === entry.text && dt < 3000) return;
      // Partial duplicate: one text contained in the other within 5s (re-emitted / overlapping chunks)
      if (dt < 5000 && entry.text.length > 10 && last.text.includes(entry.text)) return;
      // A LONGER cumulative final is a correction, not a duplicate; allow it
      // through so the previous transcript line can be replaced in-place.
    }
    lastEntryRef.current = { speaker: entry.speaker, text: entry.text, ts: Date.now() };

    // Cross-channel bleed detection: the agent mic picks up customer audio from
    // the external speaker, so the same text appears on channel 0 (agent) shortly
    // after it appears on channel 1 (customer). Discard the agent-channel version
    // as bleed — only for longer utterances to avoid discarding legitimate short
    // agent acknowledgments that happen to match customer words.
    // ── Channel isolation (hard rule) ───────────────────────────────────
    // Channel 1 is the Realtek / Stereo Mix feed — that is the caller, always.
    // Channel 0 is the mic — that is the agent, always. Anything the mic hears
    // coming out of the speakers must never be attributed to the agent, and
    // mic audio must never be attributed to the caller. So any line that echoes
    // the other channel inside the same few seconds is dropped from the channel
    // it does not belong to, whatever its length.
    const echoNow = Date.now();
    const ECHO_WINDOW_MS = 8000;
    if (entry.speaker === 0) {
      const echo = recentBleedRef.current.find(r =>
        r.speaker !== 0 && echoNow - r.ts <= ECHO_WINDOW_MS &&
        (r.text.trim() === entry.text.trim() || textSimilarity(entry.text, r.text) > 0.45));
      if (echo) {
        // Keep only the part of the agent line that is not the caller's speech
        // leaking back through the mic.
        const agtWords = entry.text.split(/\s+/);
        let bestCut = 0;
        for (let cut = 1; cut < agtWords.length; cut++) {
          const remaining = agtWords.slice(cut).join(' ').trim();
          if (!remaining) { bestCut = cut; break; }
          if (textSimilarity(remaining, echo.text) < 0.4) { bestCut = cut; break; }
          bestCut = cut;
        }
        const remaining = agtWords.slice(bestCut).join(' ').trim();
        if (remaining.length < 3) return; // caller audio — never the agent
        entry = { ...entry, text: remaining };
      }
    }
    // Same rule in reverse: when the agent's own microphone is played back into
    // the system output, his words come back on the loopback channel too. If the
    // mic already carried that statement in full, the customer-channel copy is
    // his own voice returning — drop it. A mic-side fragment is not proof, so a
    // complete customer line is always kept.
    if (entry.speaker === 1) {
      const ownVoice = recentBleedRef.current.find(r =>
        r.speaker === 0 && echoNow - r.ts <= ECHO_WINDOW_MS &&
        r.text.trim().length >= entry.text.trim().length &&
        (r.text.trim() === entry.text.trim() || textSimilarity(entry.text, r.text) > 0.6));
      if (ownVoice) return;
    }
    recentBleedRef.current = [...recentBleedRef.current, { speaker: entry.speaker, text: entry.text, ts: Date.now() }].slice(-20);

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
    // Also remove any interim (live preview) line for this speaker — the final
    // text is replacing it.
    // Build the next transcript from the ref (authoritative + synchronous) so any
    // save made right after this call — including the flush on socket close —
    // already contains the line just committed.
    const nextTranscript = (() => {
      const prev = transcriptRef.current;
      const withoutInterim = prev.filter(l => !(l.interim && l.speaker === entry.speaker));
      // Reverse bleed: if this is a clean customer line and the last committed
      // line was an agent line with near-identical text, that agent line was
      // external-speaker bleed that arrived before the clean audio — remove it
      // and let the clean customer line replace it.
      // A caller line just arrived clean — any earlier agent line carrying the
      // same words was the mic hearing the speakers, so scrub it. Scans the last
      // few lines because the bleed often commits before the clean caller line.
      if (entry.speaker === 1 && withoutInterim.length > 0) {
        for (let i = withoutInterim.length - 1; i >= Math.max(0, withoutInterim.length - 4); i--) {
          const line = withoutInterim[i];
          if (line.speaker !== 0 || line.interim) continue;
          if ((line.text || '').trim().length < 3) continue;
          const same = line.text.trim() === entry.text.trim() || textSimilarity(entry.text, line.text) > 0.45;
          if (!same) continue;
          const agtWords = (line.text || '').split(/\s+/);
          let bestCut = 0;
          for (let cut = 1; cut < agtWords.length; cut++) {
            const remaining = agtWords.slice(cut).join(' ').trim();
            if (!remaining) { bestCut = cut; break; }
            if (textSimilarity(remaining, entry.text) < 0.4) { bestCut = cut; break; }
            bestCut = cut;
          }
          const remaining = agtWords.slice(bestCut).join(' ').trim();
          if (remaining.length < 3) withoutInterim.splice(i, 1);
          else withoutInterim[i] = { ...line, text: remaining };
        }
      }
      if (withoutInterim.length === 0) return [...withoutInterim, entry];
      const lastLine = withoutInterim[withoutInterim.length - 1];
      if (lastLine.speaker === entry.speaker) {
        const lastText = (lastLine.text || '').trim();
        const entryText = (entry.text || '').trim();
        const lastTime = lastLine.time ? new Date(lastLine.time).getTime() : 0;
        const entryTime = entry.time ? new Date(entry.time).getTime() : Date.now();
        const gap = entryTime - lastTime;
        // Progressive/cumulative dedup: Deepgram sometimes re-emits the full
        // accumulated text as a new "final" result. If one text starts with
        // the other, keep the longer one instead of creating a duplicate line.
        if (entryText.length > 10 && lastText.length > 5 && (entryText.startsWith(lastText) || lastText.startsWith(entryText))) {
          const merged = [...withoutInterim];
          merged[merged.length - 1] = {
            ...lastLine,
            text: entryText.length >= lastText.length ? entryText : lastText,
            time: entry.time || lastLine.time,
          };
          return merged;
        }
        // Merge consecutive same-speaker fragments into one line per turn:
        //  • if the last line has no terminal punctuation (mid-sentence fragment), or
        //  • if the two segments were emitted within 3s (rapid bursts in the same turn).
        // This prevents sentences from being broken into many tiny lines.
        if (isSameSentence(lastText, entryText, gap)) {
          const merged = [...withoutInterim];
          merged[merged.length - 1] = {
            ...lastLine,
            text: mergeFragments(lastText, entryText),
            time: entry.time || lastLine.time,
          };
          return merged;
        }
      }
      return [...withoutInterim, entry];
    })();
    transcriptRef.current = nextTranscript;
    setTranscript(nextTranscript);
    const text = entry.text || '';

    // Cold call: extract name from opening "May I speak with X" + detect interest to auto-save
    if (callType === 'cold_call') {
      const lineCount = transcriptRef.current.length;
      if (lineCount <= 2 && entry.speaker === 0) handleColdCallNameExtract();
      if (entry.speaker === 1) handleColdCallInterestCheck(text);
    }

    // Agent Question mode: capture agent lines, auto-answer on silence / customer speech / question mark
    if (agentQuestionActiveRef.current && entry.speaker === 0) {
      // Ask the whole merged agent turn, not the last Deepgram fragment.
      agentQuestionBufferRef.current = [trailingTurn(nextTranscript, 'agent')];
      if (text.trim().endsWith('?') || text.trim().endsWith('!')) {
        flushAgentQuestion();
      } else {
        if (agentQuestionTimeoutRef.current) clearTimeout(agentQuestionTimeoutRef.current);
        agentQuestionTimeoutRef.current = setTimeout(() => flushAgentQuestion(), 3000);
      }
    }
    // Customer started speaking — agent is done asking, flush the question immediately
    if (agentQuestionActiveRef.current && entry.speaker === 1 && agentQuestionBufferRef.current.length > 0) {
      flushAgentQuestion();
    }

    // Q&A: hold the caller's turn as the transcript has merged it, so the
    // question asked is whole sentences rather than the latest fragment.
    if (qaActiveRef.current && entry.speaker === 1) {
      customerBufferRef.current = [trailingTurn(nextTranscript, 'customer')];
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      // Keep Deepgram preview immediate but let the *answer* settle.
      // An explicit finished question gets a short beat; a likely incomplete
      // fragment waits longer for continuation. Interim speech resets this timer.
      const latest = customerBufferRef.current[0] || text;
      const incomplete = /\b(?:and|or|but|because|if|that|with|to|for|of|about|is|are|does|do|can|could|would|should|will|what|how|why|when)\s*$/i.test(latest);
      const settleMs = incomplete ? 2450 : /[?]\s*$/.test(latest) ? 850 : 1700;
      bufferTimeoutRef.current = setTimeout(() => flushCustomerBuffer(), settleMs);
    } else if (entry.speaker === 0) {
      // Agent started speaking — flush any pending customer question, then treat
      // the next one as a fresh turn so it is asked in full.
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
  }, [handleQa, flushCustomerBuffer, flushAgentQuestion, handleCoach, handleIntent, runTimedExtractors, handleHandoffExtract]);

  // Show live partial transcript text as it arrives (interim results from Deepgram).
  // The interim line is replaced on each update and removed when the final text
  // is committed via processNewEntry (on speech_final).
  const updateInterimLine = useCallback((speaker, text) => {
    // Prospect still talking after an earlier speech_final fragment: don't
    // answer the old fragment. Restart only the Q&A settling clock; do not
    // delay the real-time transcript display.
    if (speaker === 1 && qaActiveRef.current && customerBufferRef.current.length > 0 && bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = setTimeout(() => flushCustomerBuffer(), 1300);
    }
    // Render no more than ~12 preview updates/sec per speaker. Recognition
    // stays streaming at full rate; this only reduces React layout work.
    const paintAt = Date.now();
    if (paintAt - (interimPaintTimeRef.current[speaker] || 0) < 85) return;
    interimPaintTimeRef.current[speaker] = paintAt;
    setTranscript(prev => {
      // Search backwards for the most recent interim line for this speaker.
      // Stop at the first non-interim line for this speaker (it was already committed).
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].speaker === speaker) {
          if (prev[i].interim) {
            const updated = [...prev];
            updated[i] = { ...prev[i], text, time: new Date().toISOString() };
            return updated;
          }
          break; // hit a committed line for this speaker — create a new interim
        }
      }
      return [...prev, { speaker, text, time: new Date().toISOString(), interim: true, sentiment: null }];
    });
  }, [flushCustomerBuffer]);

  const startCall = useCallback(async (forceNew = false, testModeArg = false, twilioStreams = null) => {
    if (phaseRef.current === 'live') return;
    if (!twilioStreams && audioModes(audioSetups)[activeSetupIndex]?.transport === 'twilio') {
      setError('Twilio Stream listens to a connected Twilio call. Use Dial + Live Coach; listening without dialing requires Computer or Cell mode.');
      return;
    }
    // Never start a saved mode with missing/mismatched hardware. In particular,
    // don't silently switch the customer line to an ordinary microphone.
    const selectedProfile = audioModes(audioSetups)[activeSetupIndex];
    if (selectedProfile?.saved && !twilioStreams && selectedProfile.transport !== 'twilio') {
      const resolved = resolveAudioMode(selectedProfile, micDevices, outputDevices, isLoopbackSource);
      const customerRequired = !!(selectedProfile.customerDeviceId || selectedProfile.customerLabel);
      if (!resolved.micId || (customerRequired && !resolved.customerId)) {
        setError(`Audio setup unavailable: ${resolved.problems.join(' ')} Re-scan, choose the correct devices, and Save Setup.`);
        return;
      }
    }
    if (!twilioStreams && !micDeviceId) {
      setError('Select the actual agent microphone before starting. The default room microphone will not be substituted.');
      return;
    }
    if (!twilioStreams && !testModeArg && customerMicId && customerMicId === micDeviceId) {
      setError('Agent and customer are using the same input. Choose a separate customer-only loopback/USB return, or select None for single-input mode.');
      return;
    }
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
        manualEmailDraftRef.current = { leadId: null, value: null };
        setLead(created); setProfileData(null); setMemories([]);
        leadRef.current = created;
        loadLeads();
      } catch (e) { alert('Failed to start call: ' + (e?.message || String(e))); return; }
    }

    setError(''); setTranscript([]); transcriptRef.current = []; setQaItems([]); setCoachTips([]); setIntentScore(null); setProfileData(null); setReport('');
    intentHistoryRef.current = [];
    handoffAttemptsRef.current = 0;
    transferAgentDoneRef.current = false;
    transferAgentDetectedRef.current = false;
    agentQuestionBufferRef.current = [];
    agentQuestionActiveRef.current = false;
    setAgentQuestionActive(false);
    leadPersistedRef.current = false;
    transcriptRecordIdRef.current = null;
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
    lastAskedQuestionRef.current = '';
    lastAskedAtRef.current = 0;
    recentQaRequestRef.current = { question: '', ts: 0, id: null };
    supersededQaIdsRef.current.clear();
    interimPaintTimeRef.current = {};
    setMicMuted(false);
    setTestMode(testModeArg);
    setPhase('live'); setDgStatus('connecting');
    callStartRef.current = new Date();
    lastCoachTime.current = Date.now();
    lastIntentTime.current = Date.now();
    lastProfileTime.current = Date.now();

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
    // The customer slot only counts when it really is a loopback: a microphone there
    // would put the agent's own voice (and the room) on the customer channel.
    const customerLabel = micDevices.find(m => m.deviceId === customerMicId)?.label || '';
    const customerSlotUsable = !!customerMicId && (!customerLabel || isLoopbackSource(customerLabel));
    const dualMode = twilioStreams ? !twilioStreams.mixOnly : !!customerMicId && !!micDeviceId && !testModeArg && customerSlotUsable;

    let agentStream, customerStream;
    let feedDual = dualMode;
    try {
      if (twilioStreams) {
        // Agent and remote customer tracks are WebRTC MediaStreams from the
        // active Twilio SDK call. Do not capture or substitute a local device.
        agentStream = twilioStreams.agentStream;
        customerStream = twilioStreams.customerStream;
        streamRef.current = agentStream;
        customerStreamRef.current = customerStream;
      } else {
      agentStream = await navigator.mediaDevices.getUserMedia(
        agentChannel > 0
          ? audioConstraints(micDeviceId, agentChannel)
          : audioConstraints(micDeviceId, 0, { echoCancellation: true, noiseSuppression: true, autoGainControl: false }),
      );
      const micCapture = captureChannelInfo(agentStream, agentChannel);
      if (agentChannel > 0 && !micCapture.supported) {
        try { agentStream.getTracks().forEach(t => t.stop()); } catch {}
        setError(micCapture.reason + ' The RØDECaster can be in USB multitrack mode while the browser delivers only stereo. On Windows Pro II/Duo, install RØDE Virtual Devices, enable USB 1 multitrack + Expanded input, re-scan, and select the virtual fader containing your microphone (Whole Input).');
        setPhase('idle'); setDgStatus('error'); return;
      }
      streamRef.current = agentStream;
      if (dualMode) {
        // `exact` is deliberate. With `ideal`, a stale or missing device id makes the
        // browser silently hand back the DEFAULT MICROPHONE, so the customer channel
        // ends up recording the agent's own voice — two voices on one channel.
        const grab = (id) => navigator.mediaDevices.getUserMedia(audioConstraints(id, customerChannel));
        customerStream = await grab(customerMicId).catch(async () => {
          // For a saved preset, never substitute an unrelated loopback device.
          // The agent must explicitly reselect and save the correct hardware.
          if (selectedProfile?.saved) return null;
          // Plugging in headphones re-numbers the Realtek inputs, so the saved id
          // goes stale. Re-find the loopback by name before giving up on it.
          const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
          const ins = devices.filter(d => d.kind === 'audioinput');
          const loop = ins.find(d => /stereo mix/i.test(d.label || ''))
            || ins.find(d => /what u hear|loopback/i.test(d.label || ''));
          if (!loop) return null;
          const s = await grab(loop.deviceId).catch(() => null);
          if (s) setCustomerMicId(loop.deviceId);
          return s;
        });
        if (customerStream && customerChannel > 0) {
          const customerCapture = captureChannelInfo(customerStream, customerChannel);
          if (!customerCapture.supported) {
            try { agentStream?.getTracks().forEach(t => t.stop()); } catch {}
            try { customerStream.getTracks().forEach(t => t.stop()); } catch {}
            setError('Customer USB channel unavailable. ' + customerCapture.reason + ' Select an independent loopback/virtual audio input and use Whole Input.');
            setPhase('idle'); setDgStatus('error'); return;
          }
        }
        if (customerStream) customerStreamRef.current = customerStream;
        else feedDual = false; // customer slot really is gone — keep transcribing the mic
      }
      }
    } catch (e) {
      setError(twilioStreams ? 'Twilio audio stream unavailable.' : 'Microphone/audio access denied.');
      setPhase('idle'); setDgStatus('error'); return;
    }
    if (dualMode && !feedDual) {
      if (selectedProfile?.saved) {
        // A saved dual-channel mode must not silently become microphone-only.
        try { agentStream?.getTracks().forEach(t => t.stop()); } catch {}
        setError('Saved customer input disconnected during call startup. The call was not started. Re-scan and restore the correct audio mode.');
        setPhase('idle'); setDgStatus('error');
        return;
      }
      setError('Customer audio device is unavailable — using microphone-only transcription. Re-scan the customer input to restore dual-channel audio.');
    }

    // Server-held key first (its secret is always the current one); the compiled
    // value is only a last resort, so a failed lookup can't fall back onto a dead key.
    const fetchDgKey = async (fn) => { try { const r = await base44.functions.invoke(fn, {}); return r?.key || r?.data?.key || ''; } catch { return ''; } };
    let dgKey = (await fetchDgKey('deepgramToken2')) || (await fetchDgKey('deepgramToken'));
    if (!dgKey) dgKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
    if (!dgKey) { setError('Could not get Deepgram API key.'); setPhase('idle'); setDgStatus('error'); if (!twilioStreams) {agentStream.getTracks().forEach(t => t.stop()); if (customerStream) customerStream.getTracks().forEach(t => t.stop());} return; }

    // The 16kHz AudioContext lives in the feed module, next to the socket.

    const feed = await startLiveFeed({
      // Saved RØDECaster USB channel offsets must never be applied to Twilio's
      // separate WebRTC mono tracks: doing so would select silent channels.
      agentStream, customerStream, dualMode: feedDual, dgKey, agentGain, customerGain,
      agentChannel: twilioStreams ? 0 : agentChannel,
      customerChannel: twilioStreams ? 0 : customerChannel,
      onStatus: setDgStatus,
      onError: setError,
      onLine: processNewEntry,
      onInterim: updateInterimLine,
      onCreditExhaustion: notifyCreditExhaustion,
      onOpen: () => {
        // Update DialerSession to on_call
        if (!coachUser?.username) return;
        base44.entities.DialerSession.filter({ username: coachUser.username }).then(sessions => {
          const active = (sessions || []).find(s => s.status === 'logged_in' || s.status === 'on_call');
          if (!active) return;
          base44.entities.DialerSession.update(active.id, {
            status: 'on_call',
            currentCallLeadId: leadRef.current?.id || '',
            currentCallLeadName: `${leadRef.current?.firstName || ''} ${leadRef.current?.lastName || ''}`.trim(),
            currentCallPhone: leadRef.current?.phone || '',
            currentCallStartedAt: new Date().toISOString(),
            currentCallMode: callMode,
          }).catch(() => {});
        }).catch(() => {});
      },
      // Final save of transcript when the connection closes — captures lines
      // since the last 15s auto-save.
      onSocketClosed: () => {
        if (transcriptRef.current.length === 0 || !leadRef.current?.id) return;
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
      },
    });
    feedRef.current = feed;
    ctxRef.current = feed.ctx;
  }, [micDeviceId, customerMicId, micDevices, outputDevices, audioSetups, activeSetupIndex, agentGain, customerGain, agentChannel, customerChannel, processNewEntry, updateInterimLine, lead, loadLeads, coachUser, autoQA, autoCoach, autoIntent]);

  const stopCall = useCallback(async () => {
    // Clear the 45-second auto-save timer
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
    // Stop audio recording and save the file to the transcript record
    let recordingUri = null;
    if (recorder.isRecording) {
      try { recordingUri = await recorder.stop(); } catch {}
    }
    // Nothing should submit a new Q&A question after the call has ended.
    customerBufferRef.current = [];
    if (bufferTimeoutRef.current) { clearTimeout(bufferTimeoutRef.current); bufferTimeoutRef.current = null; }
    if (agentQuestionTimeoutRef.current) { clearTimeout(agentQuestionTimeoutRef.current); agentQuestionTimeoutRef.current = null; }
    if (feedRef.current) { feedRef.current.close(); feedRef.current = null; }
    const wasTwilio = twilioMediaRef.current;
    twilioMediaRef.current = false;
    if (streamRef.current) { if (!wasTwilio) streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (customerStreamRef.current) { if (!wasTwilio) customerStreamRef.current.getTracks().forEach(t => t.stop()); customerStreamRef.current = null; }
    if (wasTwilio) twilioDialerRef.current?.hangup();
    if (officeBridgeRef.current?.bridgeToken) {
      try {
        const response=await base44.functions.invoke('officeLineBridge', {
          action:'end',leadId:officeBridgeRef.current.leadId,
          bridgeToken:officeBridgeRef.current.bridgeToken,sessionUserId,sessionToken
        });
        const ended=response?.data||response;
        if(ended?.error)throw new Error(ended.error);
        setOffice(null);
      } catch(err) {
        // Preserve controls for a retry. Never silently hide a still-open
        // external PSTN leg when the cleanup request fails.
        setTwilioWarning('Office call cleanup failed — use End Bridge again: '+(err?.message||String(err)));
      }
    }
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
    if (recordingUri && transcriptRecordIdRef.current) {
      base44.entities.DebtCallTranscript.update(transcriptRecordIdRef.current, { recordingUrl: recordingUri }).catch(() => {});
    }
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

      // AI Contact Filler — auto-populate contact card from full transcript
      try { await runContactFillerRef.current?.(true, transcriptRef.current); } catch {}

      let intent = null;
      try {
        logAI('intent_final');
        const intentRes = await invokeAI('liveAssistantAI', { transcript: transcriptRef.current, kbEntries, mode: 'intent_final', intentRules: DEBT_INTENT_RULES });
        intent = intentRes?.intent || intentRes?.data?.intent;
        if (intent) {
          setIntentScore(intent.intentScore);
          setProfileData(prev => ({ ...prev, ...intent }));
          setLead(prev => ({ ...prev, intentScore: intent.intentScore, animalType: intent.animalType, profileJson: JSON.stringify({ ...prev, ...intent }) }));

        }

        // ── Intent engine → full report + next-call playbook ───────────────
        // Saved here, immediately after the engine returns, so the report never
        // depends on the slower report/analysis calls further down. The empty
        // acknowledged stamp is what makes it pop up the next time the card opens.
        // The report, the briefing, the notes and the intent trail are all written
        // by saveCallOutcome below — in one server-side pass that cannot be lost.

        // The call row + AI synopsis are written by saveCallOutcome below — one
        // server-side pass, so they can never be lost to a browser-side failure.

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

        // One server-side pass writes the whole call record: transcript, intent
        // report, follow-up report, call analysis, notes, key facts and the intent
        // trail. Running it as the service role means no browser hiccup can drop it.
        let intentReportText = '';
        try { intentReportText = intent ? buildIntentReport(intent) : ''; } catch { intentReportText = ''; }
        try {
          const saved = await base44.functions.invoke('saveCallOutcome', {
            leadId: leadRef.current.id,
            transcriptRecordId: transcriptRecordIdRef.current || '',
            transcript: transcriptRef.current,
            intent,
            intentReport: intentReportText,
            followUpReport: fullReport,
            callAnalysisJson,
            agentId: coachUser?.username || '',
            durationSeconds: callStartRef.current ? Math.round((Date.now() - callStartRef.current.getTime()) / 1000) : 0,
            callMode,
            callType,
            direction: isInbound ? 'inbound' : 'outbound',
            coachTips: coachTipsRef.current.map(t => ({ tip: t.tip, time: t.time ? t.time.toISOString() : null })),
            qaItems: qaItemsRef.current.map(q => ({ question: q.question, answer: q.answer })),
            intentHistory: intentHistoryRef.current,
          });
          const steps = saved?.data?.steps || {};
          const failed = Object.entries(steps).filter(([, v]) => String(v).startsWith('error'));
          console.log('Call record saved:', steps);
          if (failed.length > 0) console.error('Call record — steps that failed:', failed);
        } catch (e) { console.error('Call record save failed:', e); }
      } catch { setReport('Failed to generate report.'); }
      setGeneratingReport(false);
    }

    // Auto-scheduler permanently disabled — appointments are created on demand
    // via the Live Profile Agent or the Appointment Preview modal.

    // Run No Missed Meetings scan to catch any missed follow-ups from today's calls
    if (transcriptRef.current.length > 0) {
      try { await base44.functions.invoke('noMissedMeetings', { todayOnly: true }); } catch (e) { console.error('No Missed Meetings scan failed:', e); }
    }

    // Extract Q&A pairs from the completed transcript for admin review (learning loop)
    if (transcriptRef.current.length >= 4 && leadRef.current?.id) {
      try {
        await base44.functions.invoke('processTranscriptLearning', {
          transcript: transcriptRef.current,
          leadId: leadRef.current.id,
          leadName: `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim(),
          transcriptId: transcriptRecordIdRef.current || '',
        });
      } catch (e) { console.error('Transcript learning extraction failed:', e); }
    }

    loadLeads();
  }, [kbEntries, loadLeads, coachUser, callType, handleDebtExtract, handleHardshipExtract, handleBillsExtract, handleCosignerExtract, recorder,sessionUserId,sessionToken,setOffice]);

  // Show the keep/delete dialog when the agent ends a call (not for monitor takeovers)
  const handleEndCallClick = useCallback(() => {
    setShowEndDialog(true);
  }, []);

  // Called from EndCallDialog — always saves transcript + logs call; optionally soft-deletes lead
  const handleEndChoice = useCallback(async (shouldDelete) => {
    setShowEndDialog(false);
    try {
      await stopCall();
    } catch (e) {
      console.error('stopCall error:', e);
    }
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

  // Keyboard shortcuts: Alt+L start call, Alt+Q agent question, Alt+X end call, Alt+E emergency scripts
  const startCallRef = useRef(null);
  const toggleAgentQuestionRef = useRef(null);
  const handleEndCallClickRef = useRef(null);
  useEffect(() => { startCallRef.current = startCall; }, [startCall]);

  // Only an explicit contact-card click may start these flows. Re-use the
  // existing Live Call workspace; do not create a second Q&A/Coach engine.
  useEffect(() => {
    if (!launchAction?.token || lastLaunchTokenRef.current === launchAction.token) return;
    lastLaunchTokenRef.current = launchAction.token;
    if (phaseRef.current === 'live' || officeBridgeRef.current?.bridgeToken || twilioDialerRef.current?.isActive) {
      setError('End the active call before launching another contact.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const chosen = await base44.entities.DebtLead.get(launchAction.leadId);
        if (!chosen?.id || chosen.deletedAt || cancelled) throw new Error('Contact not available.');
        manualEmailDraftRef.current = {leadId:null,value:null};
        setLead(chosen);
        leadRef.current = chosen;
        setProfileData(chosen.profileJson ? (()=>{try{return JSON.parse(chosen.profileJson)}catch{return null}})() : null);
        setError(''); setTwilioWarning('');
        if (launchAction.mode === 'listen') {
          if (audioModes(audioSetups)[activeSetupIndex]?.transport === 'twilio') {
            throw new Error('Select Computer or Cell audio first. Live Call listening never dials the customer.');
          }
          startCallRef.current?.(false);
        } else if (launchAction.mode === 'dial') {
          if (!chosen.phone) throw new Error('Add a customer phone number before dialing.');
          setActiveSetupIndex(2);
          await twilioDialerRef.current?.dial(chosen.phone,chosen.id);
        } else if (launchAction.mode === 'office') {
          setActiveSetupIndex(2);
          const res=await base44.functions.invoke('officeLineBridge',{
            action:'start',leadId:chosen.id,sessionUserId,sessionToken
          });
          const payload=res?.data||res;
          if(payload?.error||!payload?.bridgeToken)throw new Error(payload?.error||'Office bridge could not be created');
          if(cancelled)return;
          officeMonitorStartedRef.current=false;
          officeEndedRef.current=false;
          setOffice({...payload,leadId:chosen.id,clientStatus:'not_called',busy:false});
        }
      } catch(err) {if(!cancelled)setError('Call launch failed: '+(err?.message||String(err)));}
    })();
    return () => {cancelled=true;};
  }, [launchAction?.token, sessionUserId, sessionToken]);

  // Server-owned conference state: office must answer before Contact becomes
  // available; customer must connect before Merge is permitted.
  useEffect(() => {
    if (!officeBridge?.bridgeToken)return undefined;
    let cancelled=false;
    const token=officeBridge.bridgeToken;
    const leadId=officeBridge.leadId;
    const poll=async()=>{
      try {
        const res=await base44.functions.invoke('officeLineBridge',{
          action:'status',bridgeToken:token,leadId,sessionUserId,sessionToken
        });
        const status=res?.data||res;
        if(cancelled||officeBridgeRef.current?.bridgeToken!==token)return;
        if(status.error)throw new Error(status.error);
        setOffice(prev=>prev?.bridgeToken===token?{...prev,...status}:prev);
        if(status.officeStatus==='in-progress'&&status.conferenceReady&&!officeMonitorStartedRef.current){
          officeMonitorStartedRef.current=true;
          twilioDialerRef.current?.monitorOffice(officeBridgeRef.current.monitorToken)
            .catch(err=>{
              officeMonitorStartedRef.current=false;
              if(!cancelled)setTwilioWarning('Office connected, but listening monitor failed: '+(err?.message||String(err)));
            });
        }
        if(['completed','failed','busy','no-answer','canceled'].includes(status.officeStatus) && !officeEndedRef.current){
          officeEndedRef.current=true;
          // If the office leg ends before Merge, also release the isolated
          // customer hold; never leave an orphaned customer phone call.
          if (phaseRef.current === 'live') stopCallRef.current?.();
          else {
            twilioDialerRef.current?.hangup();
            base44.functions.invoke('officeLineBridge', {
              action:'end',bridgeToken:token,leadId,sessionUserId,sessionToken
            }).catch(()=>{});
            setOffice(null);
          }
        }
      }catch(err){if(!cancelled)setTwilioWarning('Office status check: '+(err?.message||String(err)));}
    };
    poll();
    const interval=setInterval(poll,2500);
    return ()=>{cancelled=true;clearInterval(interval);};
  },[officeBridge?.bridgeToken,officeBridge?.leadId,sessionUserId,sessionToken]);

  useEffect(()=>{
    const value=officeBridge?{
      leadId:officeBridge.leadId,officeStatus:officeBridge.officeStatus,
      clientStatus:officeBridge.clientStatus,clientAnswered:officeBridge.clientAnswered,
      merged:officeBridge.merged,officeNumber:officeBridge.officeNumber,
      busy:officeBridge.busy
    }:null;
    window.__debtOfficeBridgeState=value;
    window.dispatchEvent(new CustomEvent('debt_office_bridge_state',{detail:value}));
  },[officeBridge]);

  useEffect(()=>{
    const perform=async(event)=>{
      const action=event.detail?.action;
      const bridge=officeBridgeRef.current;
      if(!bridge?.bridgeToken||!['contact','merge','end'].includes(action)||officeActionBusyRef.current)return;
      officeActionBusyRef.current=true;
      setOffice(prev=>({...prev,busy:true}));
      try{
        const response=await base44.functions.invoke('officeLineBridge',{
          action,leadId:bridge.leadId,bridgeToken:bridge.bridgeToken,sessionUserId,sessionToken
        });
        const result=response?.data||response;
        if(result?.error)throw new Error(result.error);
        if(action==='end'){
          if(phaseRef.current==='live')stopCallRef.current?.();
          else{twilioDialerRef.current?.hangup();setOffice(null);}
        }else setOffice(prev=>prev?{...prev,...result,busy:false}:prev);
      }catch(err){setError('Office bridge action failed: '+(err?.message||String(err)));setOffice(prev=>prev?{...prev,busy:false}:prev);}
      finally{officeActionBusyRef.current=false;}
    };
    window.addEventListener('debt_office_bridge_action',perform);
    return ()=>window.removeEventListener('debt_office_bridge_action',perform);
  },[sessionUserId,sessionToken]);

  useEffect(() => { toggleAgentQuestionRef.current = toggleAgentQuestion; }, [toggleAgentQuestion]);
  useEffect(() => { handleEndCallClickRef.current = handleEndCallClick; }, [handleEndCallClick]);
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
      if (e.altKey && (e.key === 'x' || e.key === 'X') && phase === 'live') {
        e.preventDefault();
        handleEndCallClickRef.current?.();
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

  // ── Audio Test — independent level meter per input ─────────────────────
  const {
    testingAgent, agentLevel, agentTracks, agentCapture, startAgentTest, stopAgentTest,
    testingCustomer, customerLevel, customerTracks, customerCapture, startCustomerTest, stopCustomerTest,
  } = useInputLevelTest({
    micDeviceId, agentChannel, customerMicId, customerChannel, agentGain, customerGain, micDevices, onError: setError,
  });

  // The customer channel must be a loopback/line source, never an ordinary mic.
  const customerInputs = micDevices.filter(m => isLoopbackSource(m.label || ''));
  const customerLabelSelected = micDevices.find(m => m.deviceId === customerMicId)?.label || '';
  const micLabelSelected = micDevices.find(m => m.deviceId === micDeviceId)?.label || '';
  const currentAudioSelection = { micDeviceId, customerMicId, outputDeviceId, agentGain, customerGain };
  const audioModeDirty = isAudioModeEdited(activeAudioMode, currentAudioSelection, micDevices, outputDevices);
  const audioModeReady = setupsLoaded && activeSetupLoaded && micLoaded && customerMicLoaded
    && outputLoaded && agentGainLoaded && customerGainLoaded && deviceScanCompleted;

  // One-time restoration after both settings and device enumeration load.
  // Never overwrite a user's live edits on every render or each device scan.
  useEffect(() => {
    if (!audioModeReady || !coachUser?.username || restoredAudioModeRef.current === coachUser.username) return;
    restoredAudioModeRef.current = coachUser.username;
    if (!activeAudioMode?.saved) {
      setAudioModeMessage('No hardware profile saved for this mode yet. Select devices and Save Setup.');
      return;
    }
    const r = resolveAudioMode(activeAudioMode, micDevices, outputDevices, isLoopbackSource);
    setMicDeviceId(r.micId);
    setCustomerMicId(r.customerId);
    setOutputDeviceId(r.outputId);
    setAgentGain(r.agentGain);
    setCustomerGain(r.customerGain);
    setAudioModeMessage(r.valid
      ? `Restored ${activeAudioMode.name}. Check your audio meters before a call.`
      : `Saved setup needs attention: ${r.problems.join(' ')}`);
  }, [audioModeReady, coachUser?.username, activeSetupIndex, activeAudioMode?.saved, micDevices, outputDevices]);

  // Use a saved computer/cell profile. An unsaved slot starts blank so it
  // cannot misleadingly appear to be running another mode's hardware.
  const useAudioSetup = (idx) => {
    if (phase === 'live' || testingAgent || testingCustomer || !audioModeReady) return;
    const s = modes[idx];
    if (!s) return;
    setActiveSetupIndex(idx);
    setError('');
    if (s.transport === 'twilio') {
      setAudioModeMessage('Twilio Stream uses connected WebRTC call audio, not the Computer/Cell audio inputs.');
      return;
    }
    if (!s.saved) {
      setMicDeviceId(''); setCustomerMicId(''); setOutputDeviceId('');
      setAgentGain(1); setCustomerGain(1);
      setAudioModeMessage(`${s.name} is not configured. Choose your devices, test them, then Save Setup.`);
      return;
    }
    const r = resolveAudioMode(s, micDevices, outputDevices, isLoopbackSource);
    setMicDeviceId(r.micId);
    setCustomerMicId(r.customerId);
    setOutputDeviceId(r.outputId);
    setAgentGain(r.agentGain);
    setCustomerGain(r.customerGain);
    const msg = r.valid ? `${s.name} loaded. Verify your levels before the call.` : `${s.name}: ${r.problems.join(' ')}`;
    setAudioModeMessage(msg);
    if (!r.valid) setError(msg);
  };

  const renameAudioSetup = (idx, name) => {
    if (phase === 'live') return;
    setAudioSetups(modes.map((s, i) => i === idx ? { ...s, name: name.slice(0, 38) } : s));
  };

  // Save is an explicit action, never triggered by changing a dropdown.
  const saveAudioSetup = async () => {
    if (phase === 'live' || testingAgent || testingCustomer || !audioModeReady || savingAudioMode) return;
    const result = captureAudioMode(activeAudioMode, currentAudioSelection, micDevices, outputDevices, isLoopbackSource);
    if (!result.valid) {
      setAudioModeMessage(result.problems.join(' '));
      return;
    }
    setSavingAudioMode(true);
    setAudioModeMessage(`Saving ${result.mode.name} to your account…`);
    try {
      const next = modes.map((s, i) => i === activeSetupIndex ? result.mode : s);
      const saved = await setAllDebtCoachValues(coachUser?.username, {
        audioSetupsJson: next, activeAudioSetup: activeSetupIndex,
        defaultMicDeviceId: micDeviceId, defaultCustomerMicId: customerMicId,
        defaultOutputDeviceId: outputDeviceId, agentMicGain: agentGain, customerMicGain: customerGain,
      });
      if (!saved) throw new Error('The server did not confirm the save.');
      setError('');
      setAudioModeMessage(`Saved ${result.mode.name} to your account. Verify audio levels before calling.`);
    } catch (e) {
      setAudioModeMessage(`Save failed: ${e?.message || 'Please retry.'}`);
    } finally { setSavingAudioMode(false); }
  };


  return (
    <div className="dcc-live-workspace" style={{minWidth:0}}>
      <style>{` .dcc-live-workspace button:focus-visible,.dcc-live-workspace input:focus-visible,.dcc-live-workspace select:focus-visible{outline:2px solid #dab879;outline-offset:2px}
        .dcc-live-workspace .dcc-live-control{transition:background .15s,border-color .15s}
        @media(prefers-reduced-motion:reduce){.dcc-live-workspace *{animation-duration:.01ms!important;transition:none!important}}
      `}</style>
      <LiveCallControls phase={phase} lead={lead} showCustomerStats={showCustomerStats} setShowCustomerStats={setShowCustomerStats} setShowProfile={setShowProfile}
        audio={{ activeAudioMode, micDevices, micDeviceId, setMicDeviceId, agentGain, setAgentGain, testingAgent, startAgentTest, stopAgentTest, agentLevel, agentChannel, setAgentChannel, agentTracks, agentCapture, customerInputs, customerMicId, setCustomerMicId, customerGain, setCustomerGain, testingCustomer, startCustomerTest, stopCustomerTest, customerLevel, customerChannel, setCustomerChannel, customerTracks, customerCapture, loadDevices, customerLabelSelected, modes, activeSetupIndex, savingAudioMode, audioModeReady, audioModeDirty, audioModeValidation, audioModeMessage, useAudioSetup, renameAudioSetup, saveAudioSetup, outputDevices, outputDeviceId, setOutputDeviceId, testMode }}
        tools={{ statsPaused, setStatsPaused, callType, handleCallTypeChange, autoQA, setAutoQA, autoCoach, setAutoCoach, autoIntent, setAutoIntent, canLiveAI, canLiveQA, agentQuestionActive, toggleAgentQuestion }}
        session={{ leadSearch, setLeadSearch, setLeadSearchFocus, leadSearchFocus, leadSearchResults, selectLeadAndStartCall, startCall, kbLoading, handleEndCallClick }}
        recorder={recorder} onRecord={async () => { if (recorder.isRecording) { const uri = await recorder.stop(); if (uri && transcriptRecordIdRef.current) base44.entities.DebtCallTranscript.update(transcriptRecordIdRef.current, { recordingUrl: uri }).catch(() => {}); } else recorder.start(streamRef.current, customerStreamRef.current); }}
        layout={{ allPoppedOut, saved: !!layoutSavedMsg, onSave: saveDefaultLayout }} dgStatus={dgStatus} lineCount={transcript.length} />

      <LiveWorkspaceToolbar phase={phase} panels={{transcript:transcriptPanel,scripts:scriptsPanel,ai:aiPanel}}
        showProfile={showProfile} setShowProfile={setShowProfile} hasLead={!!lead?.id}
        onSave={saveDefaultLayout} onReset={resetWorkspaceLayout} saving={layoutSaving||workspaceApplying}
        message={layoutSavedMsg} layoutMode={layoutMode} onLayoutModeChange={setLayoutMode}
        activeProfile={selectedLayoutProfile} availableProfiles={savedLayoutProfiles}
        viewport={workspaceViewport} onApplyProfile={()=>applyDisplayProfile(selectedLayoutProfile,{showFeedback:true})} />

      {error && <div role="alert" style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '12px' }}>⚠ {error}</div>}
      {twilioWarning && <div role="status" style={{ marginBottom:12,padding:'9px 13px',borderRadius:8,background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.3)',color:'#fbd08b',fontSize:11 }}>Twilio audio: {twilioWarning}</div>}
      {(twilioDialer.isActive || officeBridge?.bridgeToken) && <div role="status" style={{ marginBottom:12,padding:'9px 12px',borderRadius:8,background:'#142b33',border:'1px solid rgba(162,210,184,.35)',color:'#c2dfd3',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',fontSize:11 }}>
        <strong style={{color:'#e3c789'}}>Twilio Stream</strong>
        {officeBridge?.bridgeToken && <span style={{color:'#92e1bc',fontWeight:800}}>Computer microphone muted · office line carries speech</span>}
        <span>{officeBridge?.bridgeToken ? 'Office '+(officeBridge.officeStatus||'calling')+' · Client '+(officeBridge.clientStatus||'not called') : 'Direct dial · '+twilioDialer.callStatus}</span>
        <span>Listening: {phase==='live'&&dgStatus==='connected'?'active':phase==='live'?'connecting':'awaiting call audio'}</span>
        {!officeBridge?.bridgeToken&&twilioDialer.isActive&&<button type="button" onClick={()=>twilioDialer.hangup()} style={{background:'#422629',border:'1px solid #93534d',borderRadius:6,color:'#ffd5cc',padding:'5px 10px',cursor:'pointer'}}>End Twilio call</button>}
      </div>}
      {twilioDialer.dialerError && <div role="alert" style={{color:'#ffb5a6',fontSize:11,marginBottom:10}}>Twilio: {twilioDialer.dialerError}</div>}

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

      {phase === 'live' && <LiveObjectionRail matches={recentMatches} onOpen={openMatch} onClear={clearRecent} />}

      {(testingAgent || testingCustomer) && (
        <div style={{ marginBottom: '12px', padding: '14px 18px', background: '#0d1b2a', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', display: 'flex', gap: '24px', alignItems: 'center' }}>
          {testingAgent && (
            <div style={{ flex: 1 }}>
              <div style={{ color: '#60a5fa', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🎙 Agent Mic — {micDevices.find(m => m.deviceId === micDeviceId)?.label || 'Default'}</div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${agentLevel}%`, height: '100%', background: 'linear-gradient(90deg,#60a5fa,#3b82f6)', borderRadius: '4px', transition: 'width 0.05s' }} />
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{agentLevel > 2 ? '✅ Audio detected' : '🔇 No audio'} · Gain {Math.round(agentGain * 100)}%</div>
            </div>
          )}
          {testingCustomer && (
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🎧 Customer — {micDevices.find(m => m.deviceId === customerMicId)?.label || 'Rodecaster'}</div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${customerLevel}%`, height: '100%', background: 'linear-gradient(90deg,#f59e0b,#f97316)', borderRadius: '4px', transition: 'width 0.05s' }} />
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{customerLevel > 2 ? '✅ Audio detected' : '🔇 No audio'} · Gain {Math.round(customerGain * 100)}%</div>
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
        // Responsive docked layout adapts to laptop and ultrawide workstations.
        const gridCols = 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))';
        const allOut = transcriptPanel.poppedOut && scriptsPanel.poppedOut && aiPanel.poppedOut;

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
              {/* Compact editor is only for setup; the pop-out is the full profile. */}
              {!showProfile && phase !== 'live' && (
                <div style={{ position: 'relative' }}>
                  <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 Lead Contact Card</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowLeadPicker(p => !p)} style={{ background: 'rgba(16,185,129,0.1)', color: GOLD, border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{lead.id ? 'Switch' : 'Select'}</button>
                      <button onClick={() => setShowProfile(true)} disabled={!lead.id} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬆ Full Contact Card</button>
                    </div>
                  </div>
                  <DebtLeadCard lead={lead} onLeadChange={setLead} onLeadFieldEdit={handleManualLeadField} onLeadSaved={handleLeadSaved} transcript={transcript} intentScore={intentScore} animalType={profileData?.animalType} profileData={profileData} />
                </div>
              )}

              {/* Transcript — pop-out enabled (transcript only) */}
              <LiveTranscriptPanel transcript={transcript} phase={phase} panel={transcriptPanel} onAnswerQuestion={handleAnswerQuestion} lead={lead} micLabel={micDevices.find(m => m.deviceId === micDeviceId)?.label || 'Agent Mic'} username={coachUser?.username} onScriptPositionChange={(pos) => { scriptPositionRef.current = pos; }} />

              {/* Scripts Panel — separate pop-out window for teleprompter + pitches */}
              <LiveScriptsPanel transcript={transcript} phase={phase} panel={scriptsPanel} lead={lead} micLabel={micDevices.find(m => m.deviceId === micDeviceId)?.label || 'Agent Mic'} username={coachUser?.username} onScriptPositionChange={(pos) => { scriptPositionRef.current = pos; }} />

              {/* AI Tools Panel — pop-out enabled */}
              {aiPanel.poppedOut ? (
                <LiveQAWindow panel={aiPanel} qaItems={qaItems} coachTips={coachTips} transcript={transcript}
                  kbEntries={kbEntries} lead={lead} qaActive={qaActive} coachActive={coachActive} intentActive={intentActive}
                  onToggleQA={toggleQaActive} onToggleCoach={toggleCoachActive} onToggleIntent={toggleIntentActive}
                  pendingQuestion={pendingQuestion} username={coachUser?.username} />
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 AI Assistant</div>
                    <button onClick={aiPanel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬆ Pop Out</button>
                  </div>
                  <DebtAIPanel
                    transcript={transcript} kbEntries={kbEntries} isActive={phase === 'live'}
                    profileData={profileData} intentScore={intentScore} ledgerExtracting={ledgerExtracting}
                    memories={memories} lead={lead} micDeviceId={micDeviceId} customerMicId={customerMicId} liveQAItems={qaItems} liveCoachTips={coachTips}
                    canAIAssistant={canLiveAI} canQA={canLiveQA} canCoach={canLiveCoach} canIntent={canLiveIntent}
                    username={coachUser?.username}
                    activeQA={qaActive} activeCoach={coachActive} activeIntent={intentActive}
                    onToggleQA={toggleQaActive} onToggleCoach={toggleCoachActive} onToggleIntent={toggleIntentActive}
                    autoOpenPopup={false}
                    onOpenWorkspaceAI={aiPanel.openAtSavedPosition}
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

      {/* Client Profile is opened from the Live Call toolbar, never a fixed launcher. */}

      {showProfile && lead.id && (
        <ClientProfileModal liveWorkspace lead={lead} username={coachUser?.username} onClose={() => setShowProfile(false)} onSave={(updated) => {
          if (updated?.id === leadRef.current?.id) manualEmailDraftRef.current = { leadId: updated.id, value: updated.email || '' };
          setLead(prev => {
            const next = { ...prev, ...updated };
            leadRef.current = next;
            return next;
          });
        }} />
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
        visible={showCustomerStats}
        onClose={() => setShowCustomerStats(false)}
      />


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

      {/* Objection Engine — live popup when a high-priority objection is detected */}
      <ObjectionPopup objection={activeObjection} onDismiss={dismissObjection} startMinimized />

    </div>
  );
}