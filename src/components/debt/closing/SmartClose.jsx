/**
 * SmartClose.jsx — AI-powered closing assistant.
 * A variation of the call coach focused on the close: reads the live/saved
 * transcript + intent analytics, maps conversation to closing modules, auto-
 * checks completed steps, flags skipped steps (popup: ignore/save/confirm),
 * and surfaces close-specific recommendations + close-readiness score.
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
import SkippedStepPopup from './SkippedStepPopup';
import { logAIUsage, CREDIT_ESTIMATES } from '@/lib/aiCreditLog';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

// Compact module map for the AI prompt
function modulesForAI() {
  return CLOSING_MODULES.map(m => ({
    id: m.id, title: m.title,
    steps: m.steps.map((s, i) => ({ key: `${m.id}_${i}`, text: s })),
  }));
}

// Human-readable label for a step key
function labelForKey(key) {
  for (const m of CLOSING_MODULES) {
    const i = Number(key.replace(m.id + '_', ''));
    if (key.startsWith(m.id + '_') && m.steps[i]) return `${m.title}: ${m.steps[i]}`;
  }
  return key;
}

export default function SmartClose({ leadId, liveTranscript, intentScore, animalType, compact }) {
  const [smartOn, setSmartOn] = useState(false);
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
  const lastAnalyzedLinesRef = useRef(0);
  const dismissedRef = useRef({});
  const manualRef = useRef(manualDone);
  const savedNotesRef = useRef(savedNotes);

  useEffect(() => { dismissedRef.current = dismissedSkips; }, [dismissedSkips]);
  useEffect(() => { manualRef.current = manualDone; }, [manualDone]);
  useEffect(() => { savedNotesRef.current = savedNotes; }, [savedNotes]);

  const transcript = (liveTranscript && liveTranscript.length > 0) ? liveTranscript : savedTranscript;
  const combinedDone = { ...autoDone, ...manualDone };

  // Load lead
  useEffect(() => {
    if (!leadId) { setLead(null); setSavedTranscript([]); return; }
    let cancelled = false;
    base44.entities.DebtLead.get(leadId).then(l => { if (!cancelled) setLead(l); }).catch(() => {});
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

  // Persist manualDone to localStorage (same key as plain checklist → compatible)
  useEffect(() => {
    try { localStorage.setItem(`closing_progress_${leadId || 'general'}`, JSON.stringify(manualDone)); } catch {}
  }, [manualDone, leadId]);

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

  const runAnalysis = useCallback(async () => {
    if (!transcript || transcript.length < 4) return;
    setAnalyzing(true);
    setError('');
    try {
      logAIUsage({
        agentUsername: lead?.debtCoachOwner, leadId, leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
        callType: 'smart_close', estimatedCredits: CREDIT_ESTIMATES.smart_close ?? 2,
      });
      const recentText = transcript.slice(-60).map(t => `${t.speaker === 0 ? 'Agent' : 'Customer'}: ${t.text}`).join('\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a debt-settlement closing coach analyzing a live call transcript. The call follows these closing modules in order:

${JSON.stringify(modulesForAI())}

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
      setAutoDone(newAuto);
      // Queue skipped steps not already dismissed/saved/confirmed
      const newSkips = (result.skippedSteps || [])
        .filter(s => s.key && !dismissedRef.current[s.key] && !manualRef.current[s.key] && !savedNotesRef.current.find(n => n.key === s.key))
        .map(s => ({ ...s, label: labelForKey(s.key) }));
      if (newSkips.length > 0) setSkippedQueue(prev => [...prev, ...newSkips]);
      lastAnalyzedLinesRef.current = transcript.length;
    } catch (e) { setError('Smart Close analysis failed: ' + (e?.message || String(e))); }
    setAnalyzing(false);
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

  const handleToggle = (key) => setManualDone(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSkipIgnore = (key) => {
    setDismissedSkips(prev => ({ ...prev, [key]: true }));
    setSkippedQueue(prev => prev.slice(1));
  };
  const handleSkipSave = async (skip) => {
    try {
      await base44.entities.DebtLeadActivity.create({
        leadId, leadName: `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim(),
        activityType: 'note',
        activityText: `⚠️ Smart Close: skipped step — ${skip.label || skip.key}${skip.reason ? ` (${skip.reason})` : ''}`,
        createdBy: lead?.debtCoachOwner || 'smart_close',
      });
    } catch {}
    setSavedNotes(prev => [...prev, { key: skip.key, reason: skip.reason }]);
    setSkippedQueue(prev => prev.slice(1));
  };
  const handleSkipConfirm = (skip) => {
    setManualDone(prev => ({ ...prev, [skip.key]: true }));
    setSkippedQueue(prev => prev.slice(1));
  };

  const currentStage = analysis?.currentStage ? CLOSING_MODULES.find(m => m.id === analysis.currentStage) : null;
  const readiness = analysis?.closeReadiness;

  // No lead selected — show a lead picker
  if (!leadId && !lead) {
    return (
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
    );
  }

  return (
    <div>
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

      {/* The checklist — controlled by Smart Close when smartOn */}
      <ClosingChecklist
        leadId={leadId}
        compact={compact}
        done={smartOn ? combinedDone : undefined}
        onToggle={smartOn ? handleToggle : undefined}
        autoDone={smartOn ? autoDone : undefined}
        smartMode={smartOn}
      />

      {/* Smart recommendations — close-focused coaching */}
      {smartOn && analysis?.recommendations?.length > 0 && (
        <div style={{ marginTop: '14px', background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '6px', padding: '14px' }}>
          <div style={{ color: PURPLE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>🧠 Smart Close Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {analysis.recommendations.map((r, i) => (
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

      {/* Skipped step popup */}
      {skippedQueue.length > 0 && (
        <SkippedStepPopup
          skip={skippedQueue[0]}
          onIgnore={handleSkipIgnore}
          onSave={handleSkipSave}
          onConfirm={handleSkipConfirm}
        />
      )}
    </div>
  );
}