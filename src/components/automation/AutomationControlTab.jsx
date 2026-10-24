/**
 * AutomationControlTab.jsx — the whole automation board on one screen: every timed
 * automation, every event-driven one, and the AI / scoring rules that decide what
 * happens next — each with its live switch, its timing, and when it last ran.
 *
 * The switches are not cosmetic: the job itself checks its switch before any work.
 */
import { C } from '@/components/superadmin/kit';
import AutomationControlRow from '@/components/automation/AutomationControlRow';
import RuleSaveBar from '@/components/automation/RuleSaveBar';

const SECTIONS = [
  {
    kind: 'timed',
    head: '⏱ Timed automations',
    note: 'A schedule fires these. Switch one off and it stops everywhere; set its minutes to slow it down without touching a workflow.',
  },
  {
    kind: 'event',
    head: '⚡ Event-driven automations',
    note: 'Something happening in the app sets these off — a lead created or changed, a tracked open or click arriving.',
  },
  {
    kind: 'rule',
    head: '🎯 AI & scoring rules',
    note: 'The numbers the AI and the engagement scorer decide with. They apply app-wide and are changed on the Scoring rules tab.',
  },
];

const sectionHead = { color: C.muted, fontSize: '10px', letterSpacing: '1.4px', textTransform: 'uppercase', margin: '0 0 4px' };

export default function AutomationControlTab({ overview, draft, onToggle, onInterval, onSave, onRestore, saving, note }) {
  const automations = overview.automations || [];
  const state = overview.automationState || {};
  const isOn = (key) => draft.enabled[key] !== false;
  const minutesFor = (key) => draft.intervals[key] || 0;

  return (
    <div>
      {SECTIONS.map((section) => {
        const rows = automations.filter((row) => (row.kind || 'timed') === section.kind);
        if (!rows.length) return null;
        return (
          <div key={section.kind} style={{ marginBottom: '20px' }}>
            <div style={sectionHead}>{section.head} · {rows.length}</div>
            <div style={{ color: C.dim, fontSize: '11px', marginBottom: '10px' }}>{section.note}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '10px' }}>
              {rows.map((row) => (
                <AutomationControlRow
                  key={row.key}
                  automation={row}
                  on={isOn(row.key)}
                  intervalMinutes={minutesFor(row.key)}
                  lastRunAt={state.lastRun?.[row.key] || ''}
                  onToggle={(next) => onToggle(row.key, next)}
                  onInterval={(value) => onInterval(row.key, value)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <RuleSaveBar
        onSave={onSave}
        onRestore={onRestore}
        saving={saving}
        note={note}
        updatedBy={state.updatedBy}
        updatedAt={state.updatedAt}
      />
    </div>
  );
}