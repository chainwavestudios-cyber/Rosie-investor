/**
 * FronterLeadConfirmedChecklist.jsx — Popup checklist that appears when a customer is dialed.
 * Items must be completed in order before the lead can be transferred/merged.
 * Steps: Name+Address → Debt Amount+Type → Not in Collections → Hardship → Email Creds
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';

const STEPS = [
  { id: 1, label: 'Obtain Name and Address', icon: '👤' },
  { id: 2, label: 'Confirm Debt Amount and Type', icon: '💰' },
  { id: 3, label: 'Confirm: Not in Collections, Not with Another Settlement Company', icon: '🚫' },
  { id: 4, label: 'Establish Hardship (AI-Assisted Explanation)', icon: '📝' },
  { id: 5, label: 'Email Company Credentials', icon: '📧' },
];

export default function FronterLeadConfirmedChecklist({ lead, username, onClose, onAllComplete, onEmailCreds }) {
  const [checklist, setChecklist] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(lead?.leadConfirmedChecklistJson || '[]');
      if (parsed.length === STEPS.length) {
        setChecklist(parsed);
      } else {
        setChecklist(STEPS.map(s => ({ step: s.id, completed: false, completedAt: null })));
      }
    } catch {
      setChecklist(STEPS.map(s => ({ step: s.id, completed: false, completedAt: null })));
    }
  }, [lead?.id]);

  const persist = async (next) => {
    if (!lead?.id) return;
    setSaving(true);
    try {
      await base44.entities.FronterLead.update(lead.id, { leadConfirmedChecklistJson: JSON.stringify(next) });
    } catch {}
    setSaving(false);
  };

  const toggleStep = (stepId) => {
    // Can only check step N if step N-1 is completed
    if (stepId > 1 && !checklist.find(c => c.step === stepId - 1)?.completed) return;
    const next = checklist.map(c =>
      c.step === stepId
        ? { ...c, completed: !c.completed, completedAt: !c.completed ? new Date().toISOString() : null }
        : c
    );
    setChecklist(next);
    persist(next);
    // Check if all complete
    if (next.every(c => c.completed) && !checklist.every(c => c.completed)) {
      onAllComplete?.();
    }
  };

  const allComplete = checklist.length > 0 && checklist.every(c => c.completed);
  const currentStep = checklist.findIndex(c => !c.completed);

  const handleEmailCreds = () => {
    // Mark step 5 as complete and trigger the creds popup
    const next = checklist.map(c => c.step === 5 ? { ...c, completed: true, completedAt: new Date().toISOString() } : c);
    setChecklist(next);
    persist(next);
    onEmailCreds?.();
    if (next.every(c => c.completed)) onAllComplete?.();
  };

  return (
    <FronterPopup title="✅ Lead Confirmed Checklist" initialWidth={420} initialHeight={520} onClose={onClose} accentColor={allComplete ? GOLD : RED}>
      <div style={{ padding: '14px' }}>
        {/* Lead name banner */}
        <div style={{ marginBottom: '14px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
          <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{lead?.firstName} {lead?.lastName}</div>
          <div style={{ color: '#6b7280', fontSize: '11px' }}>{lead?.phone} · {lead?.leadNumber || ''}</div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(checklist.filter(c => c.completed).length / STEPS.length) * 100}%`, background: `linear-gradient(90deg, ${GOLD}, #22c55e)`, transition: 'width 0.3s' }} />
          </div>
          <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px', textAlign: 'right' }}>{checklist.filter(c => c.completed).length}/{STEPS.length} complete</div>
        </div>

        {/* Checklist items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {STEPS.map((step, i) => {
            const item = checklist.find(c => c.step === step.id);
            const completed = item?.completed;
            const canCheck = step.id === 1 || checklist.find(c => c.step === step.id - 1)?.completed;
            const isCurrent = i === currentStep;
            return (
              <div key={step.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: completed ? 'rgba(16,185,129,0.06)' : isCurrent ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${completed ? `${GOLD}33` : isCurrent ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '6px',
                opacity: canCheck ? 1 : 0.4,
                transition: 'all 0.2s',
              }}>
                <button
                  onClick={() => step.id === 5 ? handleEmailCreds() : toggleStep(step.id)}
                  disabled={!canCheck}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: `2px solid ${completed ? GOLD : canCheck ? '#6b7280' : '#3a3a3a'}`,
                    background: completed ? GOLD : 'transparent',
                    cursor: canCheck ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: completed ? DARK : 'transparent',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  {completed ? '✓' : ''}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ color: completed ? GOLD : '#e8e0d0', fontSize: '12px', fontWeight: completed ? 'bold' : 'normal' }}>
                    {step.icon} {step.label}
                  </div>
                  {step.id === 5 && canCheck && !completed && (
                    <div style={{ color: '#f59e0b', fontSize: '10px', marginTop: '3px' }}>Click to send credentials email →</div>
                  )}
                </div>
                {completed && item?.completedAt && (
                  <span style={{ color: '#6b7280', fontSize: '9px', flexShrink: 0 }}>
                    {new Date(item.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Status */}
        <div style={{ marginTop: '14px', padding: '10px', borderRadius: '6px', textAlign: 'center', background: allComplete ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)' }}>
          {allComplete ? (
            <span style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>✅ Lead Confirmed — Ready to Transfer!</span>
          ) : (
            <span style={{ color: '#6b7280', fontSize: '12px' }}>Complete all steps in order to enable transfer</span>
          )}
        </div>

        {saving && <div style={{ color: '#6b7280', fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>Saving…</div>}
      </div>
    </FronterPopup>
  );
}