/**
 * ScoringRulesTab.jsx — the scoring rules behind the hot-lead cue, all in one place
 * and all editable: the lines, what each behaviour is worth, and the patterns.
 */
import { C } from '@/components/superadmin/kit';
import ScoreThresholds from '@/components/automation/ScoreThresholds';
import ScoreFamilyTable from '@/components/automation/ScoreFamilyTable';
import ScorePatterns from '@/components/automation/ScorePatterns';
import RuleSaveBar from '@/components/automation/RuleSaveBar';

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '12px 13px', marginBottom: '12px' };
const heading = { color: C.ink, fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' };
const sub = { color: C.muted, fontSize: '11px', marginBottom: '10px', lineHeight: '1.5' };

export default function ScoringRulesTab({ draft, defaults, updatedBy, updatedAt, onSave, onRestore, saving, note }) {
  const setThresholds = (patch) => draft && onSave.merge({ thresholds: { ...draft.thresholds, ...patch } });
  const setPatterns = (patch) => onSave.merge({ patterns: { ...draft.patterns, ...patch } });
  const setWeight = (key, field, value) => onSave.merge({
    families: draft.families.map((family) => (family.key === key ? { ...family, weights: { ...family.weights, [field]: value } } : family)),
  });

  if (!draft) return null;

  return (
    <div>
      <div style={card}>
        <div style={heading}>Where the lines sit</div>
        <div style={sub}>A contact card below the warming line reads cold, at it warming, at the engaged line engaged, and at the hot line it goes hot and raises the alert.</div>
        <ScoreThresholds thresholds={draft.thresholds} defaults={defaults.thresholds} set={setThresholds} />
      </div>

      <div style={card}>
        <div style={heading}>What each email family is worth</div>
        <div style={sub}>Points a lead earns from behaviour on that family of emails. Repeat opens count up to three, and so do link clicks. A family marked “fronter” scores in the prospecting system only — those points never travel into Debt Call Coach.</div>
        <ScoreFamilyTable families={draft.families} defaults={defaults.families} onWeight={setWeight} />
      </div>

      <div style={card}>
        <div style={heading}>Patterns that add up</div>
        <div style={sub}>Combinations worth more than the individual opens, plus the one pattern that forces a lead hot regardless of the number.</div>
        <ScorePatterns patterns={draft.patterns} defaults={defaults.patterns} set={setPatterns} />
      </div>

      <RuleSaveBar onSave={onSave.save} onRestore={onRestore} saving={saving} note={note} updatedBy={updatedBy} updatedAt={updatedAt} />
    </div>
  );
}