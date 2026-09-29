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
import DebtAIPanel from '@/components/debt/DebtAIPanel';
import DoNothingCalculator from '@/components/debt/DoNothingCalculator';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import LiveComplianceWidget from '@/components/compliance/LiveComplianceWidget';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const DEBT_KB_CATEGORIES = ['debt_agent', 'debt_customer', 'debt_doc', 'debt_web', 'debt_call', 'debt_kb', 'debt_faq', 'debt_hotpoints'];

export default function DebtLiveCall() {
  const { user: coachUser, can } = useDebtCoachAuth();
  const aiSettings = (() => { try { return JSON.parse(coachUser?.aiSettingsJson || '{}'); } catch { return {}; } })();
  const canLiveAI = can('liveAIAssistant') && aiSettings.liveAIEnabled !== false;
  const canLiveQA = can('liveQA') && aiSettings.liveQA !== false;
  const canLiveCoach = can('liveCoach') && aiSettings.liveCoach !== false;
  const canLiveIntent = can('liveIntent') && aiSettings.liveIntent !== false;
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [customerMicId, setCustomerMicId] = useState('');
  const [outputDevices, setOutputDevices] = useState([]);
  const [outputDeviceId, setOutputDeviceId] = useState('');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [dgStatus, setDgStatus] = useState('idle');
  const [testingAudio, setTestingAudio] = useState(false);
  const [agentLevel, setAgentLevel] = useState(0);
  const [customerLevel, setCustomerLevel] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [kbLoading, setKbLoading] = useState(true);

  // Lead
  const [leads, setLeads] = useState([]);
  const [lead, setLead] = useState({ firstName: '', lastName: '', status: 'new' });
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [memories, setMemories] = useState([]);

  // AI tools
  const [qaActive, setQaActive] = useState(canLiveAI && canLiveQA);
  const [coachActive, setCoachActive] = useState(canLiveAI && canLiveCoach);
  const [intentActive, setIntentActive] = useState(canLiveAI && canLiveIntent);
  const [rightTab, setRightTab] = useState('ai');
  const [ledgerExtracting, setLedgerExtracting] = useState(false);
  const [qaItems, setQaItems] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [intentScore, setIntentScore] = useState(null);

  // Post-call
  const [report, setReport] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [callMode, setCallMode] = useState('open'); // 'open' | 'close'
  const [showProfile, setShowProfile] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const leadPanel = usePopOutPanel('live_lead_card', { width: 420, height: 600 });
  const transcriptPanel = usePopOutPanel('live_transcript', { width: 520, height: 600 });
  const aiPanel = usePopOutPanel('live_ai_panel', { width: 420, height: 600 });
  const [allPoppedOut, setAllPoppedOut] = useState(false);
  const [layoutSavedMsg, setLayoutSavedMsg] = useState(false);

  // Click 💡 on a transcript line → send to Q&A
  const handleAnswerQuestion = useCallback((text) => {
    setPendingQuestion({ question: text, ts: Date.now() });
  }, []);

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
  const lastComplianceTime = useRef(0);
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

  // Load mic devices — auto-detect Rodecaster for customer audio
  useEffect(() => {
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
  }, []);

  // Load existing leads
  const loadLeads = useCallback(async () => {
    try {
      let all;
      if (coachUser?.role === 'dialer') {
        all = await base44.entities.DebtLead.filter({ debtCoachOwner: coachUser.username }, '-updated_date', 100);
      } else {
        all = await base44.entities.DebtLead.list('-updated_date', 100);
      }
      setLeads(all || []);
    } catch {}
  }, [coachUser]);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Auto-save transcript every 10 seconds during live call (in case audio feed drops)
  useEffect(() => {
    if (phase !== 'live' || !lead.id) return;
    const interval = setInterval(async () => {
      if (transcriptRef.current.length === 0) return;
      try {
        await base44.entities.DebtLead.update(leadRef.current.id, {
          transcriptJson: JSON.stringify(transcriptRef.current),
          lastCallAt: new Date().toISOString(),
        });
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [phase, lead.id]);

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

  const handleQa = useCallback((question) => {
    const id = Date.now() + Math.random();
    setQaItems(prev => [...prev, { id, question, answer: '', loading: true }]);
    base44.functions.invoke('liveAssistantAI', { question, transcript: transcriptRef.current.slice(-8), kbEntries, kbName: 'Debt Settlement' })
      .then(res => { const answer = res?.answer || res?.data?.answer || 'Check knowledge base.'; setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer, loading: false } : x)); })
      .catch(() => setQaItems(prev => prev.map(x => x.id === id ? { ...x, answer: 'Unable to answer.', loading: false } : x)));
  }, [kbEntries]);

  // Flush buffered customer lines as a single combined question to Q&A
  const flushCustomerBuffer = useCallback(() => {
    if (bufferTimeoutRef.current) { clearTimeout(bufferTimeoutRef.current); bufferTimeoutRef.current = null; }
    if (customerBufferRef.current.length === 0) return;
    const combined = customerBufferRef.current.join(' ').trim();
    customerBufferRef.current = [];
    if (combined.length < 8) return;
    // Only send if it looks like a question
    const qPat = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|show me|prove|how much|what's the)\b/i;
    if (qPat.test(combined)) {
      handleQa(combined);
    }
  }, [handleQa]);

  const handleCoach = useCallback(() => {
    base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current.slice(-6), kbEntries, mode: 'coach' })
      .then(res => { const tip = res?.tip || res?.response || res?.answer || ''; if (tip) setCoachTips(prev => [{ tip, time: new Date() }, ...prev].slice(0, 8)); })
      .catch(() => {});
  }, [kbEntries]);

  const handleIntent = useCallback(() => {
    base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'intent', intentRules: DEBT_INTENT_RULES })
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
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        transcript: transcriptRef.current.slice(-20),
        kbEntries,
        mode: 'profile',
        existingProfile: leadRef.current.profileJson || '{}',
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
    setLedgerExtracting(true);
    try {
      const recentText = transcriptRef.current.slice(-15).map(t => t.text).join(' ');
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

  // Auto-extract bills (rent, auto, insurance, gas, groceries, utilities, phone, internet, student loans) from transcript
  const handleBillsExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    try {
      const recentText = transcriptRef.current.slice(-15).map(t => t.text).join(' ');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a live debt settlement call transcript. The agent is reviewing the customer's monthly expenses/bills. Extract any monthly expense amounts the customer confirms. Look for:
- Rent or mortgage payment
- Auto payment (car loan/lease)
- Auto insurance
- Gas
- Groceries
- Utilities (electric, water, gas)
- Phone bill
- Internet bill
- Student loan payment
- Health insurance
- Childcare
- Any other recurring monthly expense

Return JSON with a "bills" object mapping category keys to monthly dollar amounts. Only include expenses explicitly mentioned — do NOT make up data. Use these keys: rent, auto, autoInsurance, gas, groceries, utilities, phone, internet, studentLoans, healthInsurance, childcare, misc.

Transcript:
${recentText}`,
        response_json_schema: {
          type: 'object',
          properties: {
            bills: { type: 'object', additionalProperties: { type: 'number' } },
            monthlyIncome: { type: 'number' },
          },
        },
      });
      const extractedBills = result?.bills || {};
      const extractedIncome = result?.monthlyIncome;
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

  // Auto-extract hardship info from transcript
  const handleHardshipExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current.slice(-15), mode: 'hardship' });
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
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current.slice(-15), mode: 'contact' });
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
        if (Object.keys(updates).length > 0) {
          setLead(prev => ({ ...prev, ...updates }));
          if (leadRef.current.id) base44.entities.DebtLead.update(leadRef.current.id, updates).catch(() => {});
          // Notify the lead card to flash the updated fields
          window.dispatchEvent(new CustomEvent('lead_autosaved', { detail: Object.keys(updates) }));
        }
      }
    } catch {}
  }, []);

  // Auto-extract co-signers from transcript
  const handleCosignerExtract = useCallback(async () => {
    if (!leadRef.current?.id || transcriptRef.current.length < 4) return;
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current.slice(-15), mode: 'cosigners' });
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

  const lastEntryRef = useRef(null);
  const processNewEntry = useCallback((entry) => {
    // Deduplicate — Deepgram with utterances=true can send the same final transcript twice
    const last = lastEntryRef.current;
    if (last && last.speaker === entry.speaker && last.text === entry.text && (Date.now() - last.ts < 3000)) {
      return;
    }
    lastEntryRef.current = { speaker: entry.speaker, text: entry.text, ts: Date.now() };
    setTranscript(prev => [...prev, entry]);
    const text = entry.text || '';

    // Q&A: buffer consecutive customer lines, flush as one combined question
    if (qaActive && entry.speaker === 1) {
      customerBufferRef.current.push(text);
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      // If this utterance ends with ? or !, flush immediately — question is complete
      if (text.trim().endsWith('?') || text.trim().endsWith('!')) {
        flushCustomerBuffer();
      } else {
        // Wait for more lines — flush after 3s of silence if no new customer line arrives
        bufferTimeoutRef.current = setTimeout(() => flushCustomerBuffer(), 3000);
      }
    } else if (entry.speaker === 0) {
      // Agent started speaking — flush any pending customer question
      flushCustomerBuffer();
    }

    const objWords = ['prove', 'doubt', 'skeptical', 'risky', 'guarantee', 'fail', 'burned', 'scam', 'catch', 'cost', 'fee', 'how much', 'too much', "can't afford", 'credit score', 'trust'];
    const now = Date.now();
    if (coachActive && (objWords.some(w => text.toLowerCase().includes(w)) || now - lastCoachTime.current > 20000)) { lastCoachTime.current = now; handleCoach(); }
    if (intentActive && now - lastIntentTime.current > 30000) { lastIntentTime.current = now; handleIntent(); }
    if (now - lastProfileTime.current > 60000) { lastProfileTime.current = now; handleProfile(); }
    if (now - lastLedgerTime.current > 45000) { lastLedgerTime.current = now; handleDebtExtract(); }
    if (now - lastBillsTime.current > 50000) { lastBillsTime.current = now; handleBillsExtract(); }
    if (now - lastHardshipTime.current > 55000) { lastHardshipTime.current = now; handleHardshipExtract(); }
    if (now - lastCosignerTime.current > 60000) { lastCosignerTime.current = now; handleCosignerExtract(); }
    if (now - lastContactTime.current > 40000) { lastContactTime.current = now; handleContactExtract(); }
    if (now - lastComplianceTime.current > 90000) { lastComplianceTime.current = now; handleComplianceEval(); }
  }, [qaActive, coachActive, intentActive, handleQa, flushCustomerBuffer, handleCoach, handleIntent, handleProfile, handleDebtExtract, handleBillsExtract, handleHardshipExtract, handleCosignerExtract, handleContactExtract, handleComplianceEval]);

  const startCall = useCallback(async () => {
    // Ensure we have a lead
    if (!lead.id) { await createNewLead(); }

    setError(''); setTranscript([]); setQaItems([]); setCoachTips([]); setIntentScore(null); setProfileData(null); setReport('');
    intentHistoryRef.current = [];
    customerBufferRef.current = []; if (bufferTimeoutRef.current) { clearTimeout(bufferTimeoutRef.current); bufferTimeoutRef.current = null; }
    setPhase('live'); setDgStatus('connecting');
    callStartRef.current = new Date();
    lastCoachTime.current = Date.now();
    lastIntentTime.current = Date.now();
    lastProfileTime.current = Date.now();

    // Auto-pop-out all panels to saved layout positions
    setTimeout(() => {
      leadPanel.popOut();
      transcriptPanel.popOut();
      aiPanel.popOut();
      setAllPoppedOut(true);
    }, 300);

    // Auto-activate Q&A, Coach, and Intent engines (only if permitted)
    setQaActive(canLiveAI && canLiveQA);
    setCoachActive(canLiveAI && canLiveCoach);
    setIntentActive(canLiveAI && canLiveIntent);

    // Auto-open client profile
    setShowProfile(true);

    const dualMode = !!customerMicId && !!micDeviceId;

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

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    ctxRef.current = ctx;
    const sr = ctx.sampleRate;

    const dgParams = dualMode
      ? `model=nova-3&multichannel=true&smart_format=true&punctuate=true&sentiment=true&utterances=true&interim_results=false&channels=2&sample_rate=${sr}&encoding=linear16`
      : `model=nova-3&diarize=true&smart_format=true&punctuate=true&sentiment=true&utterances=true&interim_results=false&sample_rate=${sr}&encoding=linear16`;
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${dgParams}`, ['token', dgKey]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
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

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'Results' || !msg.is_final) return;
        const alt = msg.channel?.alternatives?.[0];
        if (!alt || !alt.transcript?.trim()) return;
        const channelNum = Array.isArray(msg.channel_index) ? msg.channel_index[0] : (typeof msg.channel === 'number' ? msg.channel : 0);
        const speaker = dualMode ? (channelNum === 0 ? 0 : 1) : (alt.speaker ?? (msg.speaker ?? 0));
        processNewEntry({ speaker, text: alt.transcript, sentiment: msg.sentiment || alt.sentiment || null, time: new Date().toISOString() });
      } catch {}
    };

    ws.onclose = (e) => {
      setDgStatus('idle');
      // Final save of transcript when connection closes — captures lines since the last 15s auto-save
      if (transcriptRef.current.length > 0 && leadRef.current?.id) {
        base44.entities.DebtLead.update(leadRef.current.id, {
          transcriptJson: JSON.stringify(transcriptRef.current),
          lastCallAt: new Date().toISOString(),
        }).catch(() => {});
      }
      if (e.code !== 1000 && e.code !== 1005) setError(`Deepgram disconnected (code ${e.code}). ${e.reason || ''}`);
    };
    ws.onerror = () => { setDgStatus('error'); setError('Deepgram connection error — check API key.'); };
  }, [micDeviceId, customerMicId, processNewEntry, lead, createNewLead]);

  const stopCall = useCallback(async () => {
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
    setPhase('ended'); setDgStatus('idle');

    // Final profile + intent analysis
    if (transcriptRef.current.length > 0 && leadRef.current?.id) {
      try {
        const intentRes = await base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current, kbEntries, mode: 'intent_final', intentRules: DEBT_INTENT_RULES });
        const intent = intentRes?.intent || intentRes?.data?.intent;
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
          intentScore: intent?.intentScore,
          animalType: intent?.animalType,
        });

        // Also run dedicated fact extraction for any memories the intent engine missed
        try {
          const existingFactTexts = (await base44.entities.LeadMemory.filter({ leadId: leadRef.current.id }, '-created_date', 200)).map(m => (m.factText || '').toLowerCase());
          const factsRes = await base44.functions.invoke('liveAssistantAI', { transcript: transcriptRef.current, mode: 'extract_facts', existingFacts: existingFactTexts.map(t => ({ factText: t })) });
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
        const res = await base44.functions.invoke('liveAssistantAI', {
          transcript: transcriptRef.current, kbEntries, kbName: 'Debt Settlement', mode: 'full_report',
          usedCoach: coachActive, usedQA: qaActive, usedIntent: intentActive,
          coachTips: coachTips.map(t => t.tip), qaLog: qaItems.map(q => ({ question: q.question, answer: q.answer })),
        });
        const fullReport = res?.report || res?.data?.report || '';
        setReport(fullReport);

        // Save transcript + report to DebtCallTranscript entity
        const durationSeconds = callStartRef.current ? Math.round((Date.now() - callStartRef.current.getTime()) / 1000) : 0;
        const leadName = `${leadRef.current.firstName || ''} ${leadRef.current.lastName || ''}`.trim();
        const agentId = coachUser?.username || '';
        let transcriptRecord = null;
        try {
          transcriptRecord = await base44.entities.DebtCallTranscript.create({
            leadId: leadRef.current.id,
            leadName,
            leadNumber: leadRef.current.leadNumber || '',
            agentId,
            agentName: agentId,
            transcriptJson: JSON.stringify(transcriptRef.current),
            transcriptLineCount: transcriptRef.current.length,
            callMode,
            durationSeconds,
            intentScore: intentScore ?? null,
            animalType: leadRef.current.animalType || null,
            intentReport: intentScore != null ? `Intent Score: ${intentScore}/100\nAnimal: ${leadRef.current.animalType || 'unknown'}` : '',
            followUpReport: fullReport,
            callDate: new Date().toISOString(),
          });

          // Persist Q&A history for this call
          if (qaItems.length > 0 && transcriptRecord?.id) {
            const qaRecords = qaItems.filter(q => q.question && q.answer).map(q => ({
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
              try { await base44.entities.DebtQAHistory.bulkCreate(qaRecords); } catch {}
            }
          }

          // Persist coaching tips for this call
          if (coachTips.length > 0 && transcriptRecord?.id) {
            const tipRecords = coachTips.map(t => ({
              agentId,
              agentName: agentId,
              transcriptId: transcriptRecord.id,
              leadId: leadRef.current.id,
              leadName,
              tip: t.tip,
              tipTime: t.time ? t.time.toISOString() : new Date().toISOString(),
            }));
            try { await base44.entities.DebtCoachTip.bulkCreate(tipRecords); } catch {}
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
            try { await base44.entities.DebtIntentSnapshot.bulkCreate(snapshotRecords); } catch {}
          }
        } catch {}
      } catch { setReport('Failed to generate report.'); }
      setGeneratingReport(false);
    }
    loadLeads();
  }, [kbEntries, coachActive, qaActive, intentActive, coachTips, qaItems, loadLeads]);

  // Keep stopCallRef updated for monitor polling
  useEffect(() => { stopCallRef.current = stopCall; }, [stopCall]);

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

        {customerMicId && micDeviceId && (
          <span style={{ padding: '4px 10px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>DUAL CHANNEL</span>
        )}

        <button onClick={testingAudio ? stopAudioTest : startAudioTest} disabled={phase === 'live'} style={{ background: testingAudio ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', color: testingAudio ? '#f59e0b' : '#8a9ab8', border: `1px solid ${testingAudio ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '8px 14px', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: phase === 'live' ? 0.5 : 1 }}>
          {testingAudio ? '⏹ Stop Test' : '🔊 Test Audio'}
        </button>

        {/* Call Mode selector — Open vs Close */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ ...ls, marginBottom: 0 }}>📞 Call Mode</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setCallMode('open')} disabled={phase === 'live'} style={{ padding: '8px 14px', borderRadius: '4px', border: `1px solid ${callMode === 'open' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: callMode === 'open' ? `${GOLD}18` : 'transparent', color: callMode === 'open' ? GOLD : '#6b7280', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📞 Open</button>
            <button onClick={() => setCallMode('close')} disabled={phase === 'live'} style={{ padding: '8px 14px', borderRadius: '4px', border: `1px solid ${callMode === 'close' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: callMode === 'close' ? `${GOLD}18` : 'transparent', color: callMode === 'close' ? GOLD : '#6b7280', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🎯 Close</button>
          </div>
        </div>

        {phase !== 'live' ? (
          <button onClick={startCall} disabled={kbLoading} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: kbLoading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: kbLoading ? 0.5 : 1 }}>
            {kbLoading ? 'Loading KB…' : '🔴 Start Live Call'}
          </button>
        ) : (
          <button onClick={stopCall} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⏹ End Call</button>
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
        if (!aiPanel.poppedOut) cols.push('400px');
        const gridCols = cols.length > 0 ? cols.join(' ') : '1fr';
        const allOut = leadPanel.poppedOut && transcriptPanel.poppedOut && aiPanel.poppedOut;

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
              {/* Lead contact card — pop-out enabled */}
              {leadPanel.poppedOut ? (
                <div style={{ ...leadPanel.floatingStyle, background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
                  <div onMouseDown={leadPanel.onDragStart} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
                    <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 Lead Contact Card</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowLeadPicker(p => !p)} style={{ background: 'rgba(16,185,129,0.1)', color: GOLD, border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{lead.id ? 'Switch' : 'Select'}</button>
                      <button onClick={leadPanel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬇ Pop In</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <DebtLeadCard lead={lead} onLeadChange={setLead} transcript={transcript} intentScore={intentScore} animalType={profileData?.animalType} profileData={profileData} />
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
                  <DebtLeadCard lead={lead} onLeadChange={setLead} transcript={transcript} intentScore={intentScore} animalType={profileData?.animalType} profileData={profileData} />
                </div>
              )}

              {/* Transcript — pop-out enabled with Scripts tab */}
              <LiveTranscriptPanel transcript={transcript} phase={phase} panel={transcriptPanel} onAnswerQuestion={handleAnswerQuestion} />

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
        <ClientProfileModal lead={lead} onClose={() => setShowProfile(false)} onSave={(updated) => setLead(updated)} />
      )}
    </div>
  );
}