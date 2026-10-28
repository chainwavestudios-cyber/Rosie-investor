/**
 * SmartClose.jsx — AI-powered closing assistant.
 * A variation of the call coach focused on the close: reads the live/saved
 * transcript + intent analytics, maps conversation to closing modules, auto-
 * checks completed steps, flags skipped steps (popup: ignore/save/confirm),
 * and surfaces close-specific recommendations + close-readiness score.
 *
 * Progress persists to the DebtLead entity (closingProgressJson) so it
 * survives across calls, devices, and browser cache clears. localStorage
 * is used as a fast cache/fallback.
 *
 * Works two ways:
 *   1. Standalone Closing tab — polls the lead's saved transcript (auto-saved
 *      every 15s during a live call) + intent data from the lead record.
 *   2. Live-call closing pop-out — accepts the live transcript directly for
 *      instant updates.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { CLOSING_MODULES } from './ClosingModules';
import ClosingChecklist from './ClosingChecklist';
import ClosingScriptView from './ClosingScriptView';
import SkippedStepsNotice from './SkippedStepsNotice';
import ClosingPhoneNumbersTab from './ClosingPhoneNumbersTab';
import { logAIUsage, CREDIT_ESTIMATES } from '@/lib/aiCreditLog';

// Build default editable modules from the hardcoded CLOSING_MODULES
function defaultScriptModules() {
  const modules = CLOSING_MODULES.map(m => ({
    id: m.id, title: m.title, icon: m.icon,
    steps: m.steps.map(s => ({ text: s, keywords: [], score: 0 })),
    scriptText: m.steps.map(s => s).join('\n\n'),
    capture: m.capture || [],
  }));
  // Distribute 100 points across all steps so all-checked = dealScore 100
  let totalSteps = 0;
  modules.forEach(m => { totalSteps += m.steps.length; });
  let remaining = 100;
  let stepIdx = 0;
  modules.forEach(m => {
    m.steps.forEach(s => {
      const stepsLeft = totalSteps - stepIdx;
      s.score = Math.ceil(remaining / stepsLeft);
      remaining -= s.score;
      stepIdx++;
    });
  });
  return modules;
}

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

// Human-readable label for a step key (uses editable script modules at runtime)
function labelForKey(key, modules) {
  for (const m of modules) {
    const i = Number(key.replace(m.id + '_', ''));
    if (key.startsWith(m.id + '_') && m.steps[i]) return `${m.title}: ${m.steps[i].text || m.steps[i]}`;
  }
  return key;
}

// Load progress from the lead record (DB), falling back to localStorage
function loadProgress(leadId, leadRecord) {
  if (leadRecord?.closingProgressJson) {
    try { return JSON.parse(leadRecord.closingProgressJson); } catch {}
  }
  try { return JSON.parse(localStorage.getItem(`closing_progress_${leadId || 'general'}`) || '{}'); } catch { return {}; }
}

export default function SmartClose({ leadId, liveTranscript, intentScore, animalType, compact, canEditPhones = false, canEditScripts = false }) {
  const [closeTab, setCloseTab] = useState('checklist');
  const [smartOn, setSmartOn] = useState(true);
  const [lead, setLead] = useState(null);
  const [savedTranscript, setSavedTranscript] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoDone, setAutoDone] = useState({});
  const [manualDone, setManualDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`closing_progress_${leadId || 'general'}`) || '{}'); } catch { return {}; }
  });
  const [skippedQueue, setSkippedQueue] = useState([]);
  const [dismissedSkips, setDismissedSkips] = useState({});
  const [savedNotes, setSavedNotes] = useState([]);
  const [error, setError] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [progressLoadedLeadId, setProgressLoadedLeadId] = useState(null);
  const [progressDirty, setProgressDirty] = useState(false);
  const analysisRunningRef = useRef(false);
  // ── Closing script config (editable modules with keywords + script text) ──
  const [scriptModules, setScriptModules] = useState(defaultScriptModules());
  const [scriptConfigId, setScriptConfigId] = useState(null);
  const [scriptEdit, setScriptEdit] = useState(false);
  const [scriptSaving, setScriptSaving] = useState(false);
  const [scriptSaveMsg, setScriptSaveMsg] = useState('');
  const lastAnalyzedLinesRef = useRef(0);
  const dismissedRef = useRef({});
  const manualRef = useRef(manualDone);
  const savedNotesRef = useRef(savedNotes);
  const saveTimerRef = useRef(null);
  const scriptModulesRef = useRef(scriptModules);
  useEffect(() => { scriptModulesRef.current = scriptModules; }, [scriptModules]);

  useEffect(() => { dismissedRef.current = dismissedSkips; }, [dismissedSkips]);
  useEffect(() => { manualRef.current = manualDone; }, [manualDone]);
  useEffect(() => { savedNotesRef.current = savedNotes; }, [savedNotes]);

  const transcript = (liveTranscript && liveTranscript.length > 0) ? liveTranscript : savedTranscript;
  const combinedDone = { ...autoDone, ...manualDone };

  // Calculate deal score from checked steps (sum of step scores, capped at 100)
  const dealScore = (() => {
    let score = 0;
    scriptModules.forEach(m => {
      m.steps.forEach((s, i) => {
        if (combinedDone[`${m.id}_${i}`]) score += (s.score || 0);
      });
    });
    return Math.min(100, score);
  })();

  // Load lead + closing progress from DB
  useEffect(() => {
    setProgressLoadedLeadId(null);
    setProgressDirty(false);
    setSavedAt(null);
    if (!leadId) { setLead(null); setSavedTranscript([]); return; }
    let cancelled = false;
    base44.entities.DebtLead.get(leadId).then(l => {
      if (cancelled) return;
      setLead(l);
      setManualDone(loadProgress(leadId, l));
      setSavedAt(l.closingProgressUpdatedAt || null);
      setProgressLoadedLeadId(leadId);
    }).catch(e => { if (!cancelled) setError(`Unable to load closing progress: ${e?.message || e}`); });
    return () => { cancelled = true; };
  }, [leadId]);

  // Poll saved transcript every 5s when no live transcript (catches live-call auto-saves)
  useEffect(() => {
    if (!leadId) return;
    if (liveTranscript && liveTranscript.length > 0) { setSavedTranscript([]); return; }
    const load = () => {
      base44.entities.DebtLead.get(leadId).then(l => {
        setLead(l);
        try { setSavedTranscript(JSON.parse(l?.transcriptJson || '[]')); } catch { setSavedTranscript([]); }
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [leadId, liveTranscript]);

  // Do not allow a stale local cache to overwrite another lead or a newer DB record.
  useEffect(() => {
    if (!leadId || progressLoadedLeadId !== leadId) return;
    try { localStorage.setItem(`closing_progress_${leadId}`, JSON.stringify(manualDone)); } catch {}
  }, [manualDone, leadId, progressLoadedLeadId]);

  // Save only user-confirmed checklist edits. AI suggestions stay separate.
  useEffect(() => {
    if (!leadId || progressLoadedLeadId !== leadId || !progressDirty) return;
    let cancelled = false;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const savedOn = new Date().toISOString();
        await base44.entities.DebtLead.update(leadId, {
          closingProgressJson: JSON.stringify(manualDone),
          closingProgressUpdatedAt: savedOn,
        });
        if (!cancelled) { setSavedAt(savedOn); setProgressDirty(false); setError(''); }
      } catch (e) {
        if (!cancelled) setError(`Auto-save failed. Use Save Progress to retry: ${e?.message || e}`);
      }
    }, 1000);
    return () => { cancelled = true; if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [manualDone, leadId, progressLoadedLeadId, progressDirty]);

  // Deal score is a coaching metric, NOT proof of enrollment.
  useEffect(() => {
    if (!leadId || progressLoadedLeadId !== leadId) return;
    const t = setTimeout(() => {
      base44.entities.DebtLead.update(leadId, { dealScore }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [dealScore, leadId, progressLoadedLeadId]);

  // Reset state when lead changes
  useEffect(() => {
    setAutoDone({}); setAnalysis(null); setSkippedQueue([]); setDismissedSkips({}); setSavedNotes([]);
    setManualDone(() => { try { return JSON.parse(localStorage.getItem(`closing_progress_${leadId || 'general'}`) || '{}'); } catch { return {}; } });
    lastAnalyzedLinesRef.current = 0;
  }, [leadId]);

  // Lead picker search (when no leadId provided)
  useEffect(() => {
    if (leadId) return;
    const q = leadSearch.trim().toLowerCase();
    if (!q || q.length < 2) { setLeadResults([]); return; }
    base44.entities.DebtLead.list('-updated_date', 100).then(all => {
      setLeadResults((all || []).filter(l => !l.deletedAt && (() => {
        const name = `${l.firstName} ${l.lastName}`.toLowerCase();
        return name.includes(q) || (l.phone || '').includes(q) || (l.leadNumber || '').toLowerCase().includes(q);
      })()).slice(0, 8));
    }).catch(() => {});
  }, [leadSearch, leadId]);

  // ── Load editable closing script config from DB (singleton) ──
  useEffect(() => {
    let cancelled = false;
    base44.entities.ClosingScriptConfig.filter({ configName: 'default' }).then(results => {
      if (cancelled) return;
      const cfg = results?.[0];
      if (cfg) {
        setScriptConfigId(cfg.id);
        if (cfg.modulesJson) {
          try { setScriptModules(JSON.parse(cfg.modulesJson)); } catch {}
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Keyword-based auto-detection: when a step's keywords appear in the ──
  //    transcript, auto-check that step. Cheap (string match), runs on every
  //    transcript update alongside the heavier AI analysis.
  useEffect(() => {
    if (!smartOn || !transcript || transcript.length === 0) return;
    const text = transcript.map(t => t.text || '').join(' ').toLowerCase();
    if (!text.trim()) return;
    const modules = scriptModulesRef.current;
    let changed = false;
    const newAuto = { ...autoDone };
    for (const mod of modules) {
      mod.steps.forEach((step, i) => {
        const key = `${mod.id}_${i}`;
        if (step.keywords && step.keywords.length > 0 && !newAuto[key] && !manualDone[key]) {
          const matched = step.keywords.some(kw => kw && kw.trim() && text.includes(kw.trim().toLowerCase()));
          if (matched) { newAuto[key] = true; changed = true; }
        }
      });
    }
    if (changed) setAutoDone(newAuto);
  }, [transcript, autoDone, manualDone, smartOn]);

  // ── Save editable script config to DB ──
  const handleSaveScript = async () => {
    setScriptSaving(true);
    setScriptSaveMsg('');
    try {
      const data = { configName: 'default', modulesJson: JSON.stringify(scriptModules) };
      if (scriptConfigId) {
        await base44.entities.ClosingScriptConfig.update(scriptConfigId, data);
      } else {
        const created = await base44.entities.ClosingScriptConfig.create(data);
        setScriptConfigId(created.id);
      }
      setScriptSaveMsg('Saved ✓');
      setTimeout(() => setScriptSaveMsg(''), 2000);
    } catch (e) { setScriptSaveMsg('Error: ' + (e?.message || String(e))); }
    setScriptSaving(false);
  };

  const runAnalysis = useCallback(async () => {
    if (!transcript || transcript.length < 4 || analysisRunningRef.current) return;
    analysisRunningRef.current = true;
    lastAnalyzedLinesRef.current = transcript.length;
    setAnalyzing(true);
    setError('');
    try {
      logAIUsage({
        agentUsername: lead?.debtCoachOwner, leadId, leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
        callType: 'smart_close', estimatedCredits: CREDIT_ESTIMATES.smart_close ?? 2,
      });
      const recentText = transcript.slice(-60).map(t => `${t.speaker === 0 ? 'Agent' : 'Customer'}: ${t.text}`).join('\n');
      // Use editable script modules (with keywords) for the AI prompt
      const aiModules = scriptModulesRef.current.map(m => ({
        id: m.id, title: m.title,
        steps: m.steps.map((s, i) => ({ key: `${m.id}_${i}`, text: s.text, keywords: s.keywords || [] })),
      }));
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt-settlement closing coach analyzing a live call transcript. The call follows these closing modules in order:

${JSON.stringify(aiModules)}

Based on the transcript, return JSON with:
- currentStage: the module id the agent is currently in (or just finished).
- completedSteps: array of step keys that were clearly covered in the transcript. Be conservative — only include steps with clear evidence.
- skippedSteps: array of { key, reason } for steps that were skipped or left incomplete as the agent moved past them to a later module. Only flag steps in modules BEFORE the current stage that are not completed.
- recommendations: array of short, specific coaching tips focused on closing this deal (max 4, each under 120 chars).
- closeReadiness: 0-100 score for how ready the customer is to enroll based on the transcript.

Intent context: intent score ${intentScore ?? 'n/a'}/100, customer type ${animalType || 'unknown'}.

Transcript (last 60 lines):
${recentText}`,
        response_json_schema: {
          type: 'object',
          properties: {
            currentStage: { type: 'string' },
            completedSteps: { type: 'array', items: { type: 'string' } },
            skippedSteps: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, reason: { type: 'string' } } } },
            recommendations: { type: 'array', items: { type: 'string' } },
            closeReadiness: { type: 'number' },
          },
        },
      });
      const result = res || {};
      setAnalysis(result);
      // Auto-check completed steps
      const newAuto = {};
      (result.completedSteps || []).forEach(k => { newAuto[k] = true; });
      setAutoDone(prev => ({ ...prev, ...newAuto }));
      // Queue skipped steps not already dismissed/saved/confirmed
      const newSkips = (result.skippedSteps || [])
        .filter(s => s.key && !dismissedRef.current[s.key] && !manualRef.current[s.key] && !savedNotesRef.current.find(n => n.key === s.key))
        .map(s => ({ ...s, label: labelForKey(s.key, scriptModulesRef.current) }));
      if (newSkips.length > 0) setSkippedQueue(prev => [...prev, ...newSkips.filter(s => !prev.some(p => p.key === s.key))]);
    } catch (e) { setError('Smart Close analysis failed: ' + (e?.message || String(e))); }
    finally { analysisRunningRef.current = false; setAnalyzing(false); }
  }, [transcript, lead, leadId, intentScore, animalType]);

  // Analysis loop — run when smartOn and transcript grows (or first time)
  useEffect(() => {
    if (!smartOn) return;
    const lines = transcript.length;
    if (lines >= 4 && (lastAnalyzedLinesRef.current === 0 || lines - lastAnalyzedLinesRef.current >= 8)) {
      runAnalysis();
    }
    const interval = setInterval(() => {
      const cur = transcript.length;
      if (cur >= 4 && (lastAnalyzedLinesRef.current === 0 || cur - lastAnalyzedLinesRef.current >= 6)) {
        runAnalysis();
      }
    }, 50000);
    return () => clearInterval(interval);
  }, [smartOn, transcript.length, runAnalysis]);

  const handleToggle = (key) => {
    if (progressLoadedLeadId !== leadId) return;
    setManualDone(prev => ({ ...prev, [key]: !(prev[key] === undefined ? !!autoDone[key] : !!prev[key]) }));
    setProgressDirty(true);
  };

  // Force-complete an entire section: checks every step in the module at once,
  // awarding all of that section's points to the deal score immediately.
  const handleCompleteSection = (modId) => {
    if (progressLoadedLeadId !== leadId) return;
    const mod = scriptModules.find(m => m.id === modId);
    if (!mod) return;
    setManualDone(prev => {
      const next = { ...prev };
      mod.steps.forEach((_, i) => { next[`${modId}_${i}`] = true; });
      return next;
    });
    setProgressDirty(true);
  };

  // Explicit save button — persists immediately to DB
  const handleSave = async () => {
    if (!leadId || progressLoadedLeadId !== leadId) return;
    setSaving(true);
    try {
      await base44.entities.DebtLead.update(leadId, {
        closingProgressJson: JSON.stringify(manualDone),
        closingProgressUpdatedAt: new Date().toISOString(),
      });
      setSavedAt(new Date().toISOString());
      setProgressDirty(false);
      setError('');
    } catch (e) { setError('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const removeSkip = (key) => setSkippedQueue(prev => prev.filter(s => s.key !== key));
  const handleSkipIgnore = (key) => {
    setDismissedSkips(prev => ({ ...prev, [key]: true }));
    removeSkip(key);
  };
  const handleSkipSave = async (skip) => {
    try {
      await base44.entities.DebtLeadActivity.create({
        leadId, leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
        activityType: 'note',
        activityText: `⚠️ Smart Close: skipped step — ${skip.label || skip.key}${skip.reason ? ` (${skip.reason})` : ''}`,
        createdBy: lead?.debtCoachOwner || 'smart_close',
      });
    } catch (e) {
      setError(`Unable to save skipped-step note: ${e?.message || e}`);
      return;
    }
    setSavedNotes(prev => [...prev, { key: skip.key, label: skip.label, reason: skip.reason }]);
    removeSkip(skip.key);
  };
  const handleSkipConfirm = (skip) => {
    if (progressLoadedLeadId !== leadId) return;
    setManualDone(prev => ({ ...prev, [skip.key]: true }));
    setProgressDirty(true);
    removeSkip(skip.key);
  };

  const currentStage = smartOn && analysis?.currentStage ? scriptModules.find(m => m.id === analysis.currentStage) : null;
  const readiness = smartOn && Number.isFinite(analysis?.closeReadiness) ? Math.max(0, Math.min(100, Math.round(analysis.closeReadiness))) : null;
  const nextPending = scriptModules.flatMap(m => m.steps.map((step, index) => ({ key: `${m.id}_${index}`, text: step.text || step, title: m.title }))).find(item => !combinedDone[item.key]);
  const suggestedNextStep = (smartOn && analysis?.recommendations?.[0]) || nextPending?.text || 'All checklist steps reviewed. Verify the agreement and enrollment status separately.';

  // Tab bar — Checklist vs Script vs Phone #s
  const tabBar = (
    <div style={{ display: 'flex', gap: '2px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setCloseTab('checklist')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${closeTab === 'checklist' ? GOLD : 'transparent'}`, color: closeTab === 'checklist' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: closeTab === 'checklist' ? 'bold' : 'normal' }}>✅ Checklist</button>
      <button onClick={() => setCloseTab('script')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${closeTab === 'script' ? GOLD : 'transparent'}`, color: closeTab === 'script' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: closeTab === 'script' ? 'bold' : 'normal' }}>📜 Script</button>
      <button onClick={() => setCloseTab('phones')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${closeTab === 'phones' ? GOLD : 'transparent'}`, color: closeTab === 'phones' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: closeTab === 'phones' ? 'bold' : 'normal' }}>📞 Phone #s</button>
    </div>
  );

  // Phone #s tab — always available, no lead needed
  if (closeTab === 'phones') {
    return (
      <div>
        {tabBar}
        <ClosingPhoneNumbersTab canEdit={canEditPhones} />
      </div>
    );
  }

  // Script tab — expandable step blocks with checkboxes + keywords + edit mode
  if (closeTab === 'script') {
    return (
      <div>
        {tabBar}
        <ClosingScriptView
          modules={scriptModules}
          done={smartOn ? combinedDone : manualDone}
          onToggle={handleToggle}
          onCompleteSection={smartOn ? handleCompleteSection : undefined}
          autoDone={smartOn ? autoDone : undefined}
          smartMode={smartOn}
          canEdit={canEditScripts}
          editMode={scriptEdit}
          onEditModeChange={setScriptEdit}
          onModulesChange={setScriptModules}
          onSaveScript={handleSaveScript}
          saving={scriptSaving}
          saveMsg={scriptSaveMsg}
        />
      </div>
    );
  }

  // No lead selected — show a lead picker
  if (!leadId && !lead) {
    return (
      <div>
        {tabBar}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '18px' }}>
          <div style={{ color: GOLD, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>🏁 Smart Close</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '14px' }}>Select a client to track their closing progress against the live transcript.</div>
          <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Search by name, phone, or lead #…" style={inp} autoFocus />
          {leadResults.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {leadResults.map(l => (
                <button key={l.id} onClick={() => { setLeadSearch(''); setLeadResults([]); window.dispatchEvent(new CustomEvent('smart_close_select_lead', { detail: l.id })); }} style={{ background: 'rgba(255,255,255,0.03)', color: '#c4cdd8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>
                  {l.firstName} {l.lastName} <span style={{ color: '#6b7280', fontSize: '10px' }}>{l.leadNumber || l.phone || ''}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: '14px', color: '#4a5568', fontSize: '11px' }}>Tip: start a live call on the Live Call tab and Smart Close will track it here automatically once a lead is selected.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {tabBar}
      {/* Condensed command view: active contact, stage, AI readiness and next action. */}
      <div style={{ marginBottom: '12px', padding: '14px', borderRadius: '10px', background: 'linear-gradient(130deg,#102723,#10202d 66%,#151b2b)', border: '1px solid rgba(124,193,161,.24)' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#9cb7b2', fontSize: '9px', letterSpacing: '1.6px', fontWeight: 'bold' }}>ACTIVE CLOSE</div>
            <div style={{ color: '#f0f3eb', fontSize: '15px', fontWeight: 700, marginTop: '3px' }}>{[lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || 'Loading contact…'}</div>
          </div>
          <span style={{ fontSize: '10px', color: '#9edcc5', padding: '6px 9px', border: '1px solid rgba(90,164,134,.3)', background: 'rgba(90,164,134,.1)', borderRadius: '20px' }}>{transcript.length ? `${transcript.length} transcript lines` : 'Waiting for transcript'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8px', marginTop: '12px' }}>
          <div style={{ padding: '10px', border: '1px solid rgba(255,255,255,.08)', borderRadius: '8px', background: 'rgba(0,0,0,.12)' }}>
            <div style={{ color: '#90a6ac', fontSize: '10px', marginBottom: '5px' }}>Current stage</div>
            <div style={{ color: '#dceee7', fontSize: '12px', fontWeight: 700 }}>{currentStage?.title || nextPending?.title || 'Review complete'}</div>
          </div>
          <div style={{ padding: '10px', border: '1px solid rgba(255,255,255,.08)', borderRadius: '8px', background: 'rgba(0,0,0,.12)' }}>
            <div style={{ color: '#90a6ac', fontSize: '10px', marginBottom: '5px' }}>Customer readiness · AI estimate</div>
            <div style={{ color: readiness === null ? '#92a4ae' : readiness >= 70 ? '#8fe5ba' : readiness >= 40 ? '#f6cd80' : '#f1a3a3', fontSize: '16px', fontWeight: 700 }}>{readiness === null ? 'Not analyzed' : `${readiness}/100`}</div>
          </div>
        </div>
        <div style={{ marginTop: '9px', padding: '10px 12px', background: 'rgba(167,139,250,.075)', border: '1px solid rgba(167,139,250,.22)', borderRadius: '8px' }}>
          <div style={{ color: '#c4acf9', fontSize: '10px', fontWeight: 700, marginBottom: '5px' }}>SUGGESTED NEXT STEP</div>
          <div style={{ color: '#d6dee7', fontSize: '12px', lineHeight: 1.5 }}>{suggestedNextStep}</div>
        </div>
      </div>
      {/* Smart Close toggle bar */}
      <div style={{ marginBottom: '12px', padding: '12px 16px', background: smartOn ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${smartOn ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSmartOn(p => !p)}
          style={{
            background: smartOn ? `linear-gradient(135deg,${PURPLE},#7c3aed)` : 'rgba(255,255,255,0.05)',
            color: smartOn ? '#fff' : '#8a9ab8',
            border: `1px solid ${smartOn ? PURPLE + '66' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '4px', padding: '8px 16px', cursor: 'pointer',
            fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          {smartOn ? '🧠 Smart Close: ON' : '○ Enable Smart Close'}
        </button>
        {smartOn && (
          <>
            <span style={{ color: '#6b7280', fontSize: '10px' }}>{transcript.length} transcript lines</span>
            {analyzing && <span style={{ color: PURPLE, fontSize: '10px' }}>⏳ Analyzing…</span>}
            {currentStage && <span style={{ padding: '2px 8px', borderRadius: '2px', background: 'rgba(167,139,250,0.15)', color: PURPLE, fontSize: '10px', fontWeight: 'bold' }}>📍 {currentStage.icon} {currentStage.title}</span>}
            {readiness != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Close Readiness</span>
                <span style={{ color: readiness >= 70 ? GOLD : readiness >= 40 ? AMBER : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{readiness}/100</span>
              </span>
            )}
            {intentScore != null && <span style={{ color: BLUE, fontSize: '10px' }}>Intent {intentScore}/100</span>}
          </>
        )}
      </div>

      {error && <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '11px' }}>⚠ {error}</div>}

      {/* Skipped steps — inline list, never a popup */}
      <SkippedStepsNotice
        skips={skippedQueue}
        onIgnore={handleSkipIgnore}
        onSave={handleSkipSave}
        onConfirm={handleSkipConfirm}
      />

      {/* The checklist — controlled by Smart Close when smartOn */}
      <ClosingChecklist
        leadId={leadId}
        compact={compact}
        done={smartOn ? combinedDone : manualDone}
        onToggle={handleToggle}
        autoDone={smartOn ? autoDone : undefined}
        smartMode={smartOn}
        modules={scriptModules}
        currentStage={currentStage?.id}
      />

      {/* Save button — persists closing progress to the lead record */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={handleSave} disabled={saving || !leadId || progressLoadedLeadId !== leadId} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: saving || !leadId ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving || !leadId || progressLoadedLeadId !== leadId ? 0.5 : 1 }}>
          {saving ? '⏳ Saving…' : '💾 Save Progress'}
        </button>
        {progressDirty ? <span style={{ color: AMBER, fontSize: '10px' }}>Saving changes…</span> : savedAt && <span style={{ color: '#92bfb0', fontSize: '10px' }}>✓ Saved {new Date(savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Stage Score</span>
          <span style={{ color: dealScore >= 100 ? GOLD : dealScore >= 75 ? PURPLE : dealScore >= 50 ? BLUE : dealScore >= 25 ? AMBER : '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>{dealScore}/100</span>
          {dealScore >= 100 && <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold' }}>Checklist complete · verify enrollment separately</span>}
        </span>
      </div>

      {/* Smart recommendations — close-focused coaching */}
      {smartOn && analysis?.recommendations?.length > 1 && (
        <div style={{ marginTop: '14px', background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '6px', padding: '14px' }}>
          <div style={{ color: PURPLE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>🧠 Smart Close Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {analysis.recommendations.slice(1).map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(167,139,250,0.06)', borderRadius: '4px' }}>
                <span style={{ color: PURPLE, fontSize: '12px', flexShrink: 0 }}>💡</span>
                <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved skip notes — audit trail */}
      {smartOn && savedNotes.length > 0 && (
        <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px' }}>
          <div style={{ color: AMBER, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📝 Recorded Skips ({savedNotes.length})</div>
          {savedNotes.map((n, i) => (
            <div key={i} style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '3px' }}>• {n.label || n.key}{n.reason ? ` — ${n.reason}` : ''}</div>
          ))}
        </div>
      )}

    </div>
  );
}