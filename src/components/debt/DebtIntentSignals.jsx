/**
 * DebtIntentSignals.jsx — Reference card showing debt-specific buying intent signals.
 * Four phases: Relief & Validation, Logistics & Math, Soft Objections, Micro-Commitments.
 * Also exports the rules as JSON for AI intent analysis.
 */
import { useState } from 'react';

const GOLD = '#10b981';

export const DEBT_INTENT_PHASES = [
  {
    id: 'relief',
    label: '1. Relief & Validation Shift',
    color: '#4ade80',
    icon: '😮‍💨',
    summary: 'Moving from defensive posturing to emotional surrender — mentally agreeing they can\'t solve this alone.',
    signals: [
      { type: 'Sighs & Tone Softening', cue: 'Exhaling heavily after sharing monthly payment numbers, followed by a softer, less guarded tone.' },
      { type: 'Validation Cues', cue: '"Yeah, exactly," or "That\'s what\'s keeping me up," when you frame their current interest-rate trap.' },
      { type: 'Future-State Imagery', cue: '"So my monthly out-of-pocket would drop to $X starting next month?" — already visualizing the relief.' },
    ],
  },
  {
    id: 'logistics',
    label: '2. Practical "Logistics & Math" Questions',
    color: '#60a5fa',
    icon: '🧮',
    summary: 'When they stop arguing about IF and start asking HOW it physically works — closing territory.',
    signals: [
      { type: 'Timeline Checks', cue: '"How long does it take for my current credit card statements to stop drafting?" or "When would my first new payment be due?"' },
      { type: 'Credit Impact Mechanics', cue: '"How bad does my score dip initially, and how long until it bounces back?" — weighing short-term pain vs long-term relief.' },
      { type: 'Payment Source Logistics', cue: '"Can I link my direct deposit, or do I make manual payments online?"' },
    ],
  },
  {
    id: 'objections',
    label: '3. Soft Objections vs Hard Rejections',
    color: '#f59e0b',
    icon: '🛡️',
    summary: 'Soft objections mean they WANT the solution — they need you to remove the fear of making a mistake.',
    signals: [
      { type: '"I need to think about it"', cue: 'Fear of loss / uncertainty about total cost or credit impact. → Isolate the math: "Is it the monthly payment amount, or the timeline you\'re unsure about?"' },
      { type: '"I want to talk to my spouse"', cue: 'Seeking external permission to relieve guilt. → "What\'s the main number they\'ll ask you about when you lay this out?"' },
      { type: '"Is this bankruptcy?"', cue: 'Fear of social stigma / extreme credit ruin. → Differentiate immediately: structured repayment vs court-ordered liquidation.' },
    ],
  },
  {
    id: 'micro',
    label: '4. Micro-Commitments & Trial Closes',
    color: '#a78bfa',
    icon: '🤝',
    summary: 'Watch whether the prospect agrees to small, friction-free steps along the way.',
    signals: [
      { type: 'Doc Submission Speed', cue: 'Agreeing to pull up their bank app or log into their credit card portal while on the phone.' },
      { type: 'Answering Hard Qualification', cue: 'Openly sharing sensitive data (SSN verification, exact gross income, hard debt totals) without pushing back.' },
      { type: 'Asking for Reassurance', cue: '"Is this really legal?" or "Will creditors stop calling me?" — asking you to be the authority figure that protects them.' },
    ],
  },
];

// JSON rules for AI intent analysis — pass to liveAssistantAI as intentRules
export const DEBT_INTENT_RULES = {
  sentimentRules: JSON.stringify([
    { condition: 'customer exhales heavily or tone softens after sharing payment numbers', effect: 'relief_shift — strong buying signal, move to logistics' },
    { condition: 'customer asks about timeline, payment mechanics, or credit recovery', effect: 'logistics_question — buying signal, answer precisely and move toward close' },
    { condition: 'customer says "I need to think about it" or "talk to my spouse"', effect: 'soft_objection — isolate the specific fear, do NOT treat as rejection' },
    { condition: 'customer asks "is this bankruptcy?"', effect: 'stigma_fear — differentiate immediately from bankruptcy' },
    { condition: 'customer agrees to pull up bank app or share SSN/income', effect: 'micro_commitment — trial close, move to enrollment' },
    { condition: 'customer asks "will creditors stop calling?"', effect: 'reassurance_seek — be the authority, confirm protections' },
    { condition: 'customer says "not interested" flatly with no follow-up question', effect: 'hard_rejection — disengage gracefully' },
  ]),
  positiveSignals: 'that would be a relief, that\'s what\'s keeping me up, my monthly out-of-pocket would drop, when would my first payment be due, how long until my score bounces back, can I link my direct deposit, what\'s the main number, is this really legal, will creditors stop calling me, let\'s do it, how do we get started, what\'s the next step, so I\'d be paying X instead, that sounds better, I can pull that up right now, let me grab my wallet, what do you need from me',
  negativeSignals: 'not interested, don\'t call me again, this is a scam, I\'m not giving you my social, I\'m not giving you my bank info, remove me from your list, I said no, don\'t call back, *hangs up*, I\'m recording this call, who gave you my number',
  duckDefinition: 'Skeptical, guarded, ashamed about debt, defensive posturing, challenges every claim, may mention scams or bankruptcy fears, negative/defensive tone',
  cowDefinition: 'Relieved, emotionally surrendering, asks logistics questions, shares financial details openly, visualizes future state, positive/hopeful tone, agrees to micro-commitments',
};

export default function DebtIntentSignals({ compact = false }) {
  const [expanded, setExpanded] = useState(compact ? null : 'relief');

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: compact ? '12px' : '20px' }}>
      <div style={{ color: GOLD, fontSize: compact ? '10px' : '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: compact ? '8px' : '14px' }}>
        🎯 Debt Intent Signals — 4 Phases
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {DEBT_INTENT_PHASES.map(phase => (
          <div key={phase.id} style={{ background: `${phase.color}06`, border: `1px solid ${phase.color}22`, borderRadius: '4px', overflow: 'hidden' }}>
            <button
              onClick={() => setExpanded(expanded === phase.id ? null : phase.id)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', textAlign: 'left' }}
            >
              <span style={{ fontSize: '16px' }}>{phase.icon}</span>
              <span style={{ color: phase.color, fontSize: '11px', fontWeight: 'bold', flex: 1 }}>{phase.label}</span>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>{expanded === phase.id ? '−' : '+'}</span>
            </button>
            {expanded === phase.id && (
              <div style={{ padding: '0 14px 12px' }}>
                <div style={{ color: '#6b7280', fontSize: '11px', lineHeight: 1.5, marginBottom: '8px', fontStyle: 'italic' }}>{phase.summary}</div>
                {phase.signals.map((s, i) => (
                  <div key={i} style={{ marginBottom: '6px', paddingLeft: '8px', borderLeft: `2px solid ${phase.color}44` }}>
                    <div style={{ color: phase.color, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.type}</div>
                    <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{s.cue}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}