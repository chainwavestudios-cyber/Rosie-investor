/**
 * AutomationsTab.jsx — every automation this app runs, grouped, in plain English.
 * The email templates that carry their own rule are listed underneath with their
 * real on/off state, and the follow-up rule's link count is editable right on it.
 */
import { C, chip, rowStyle } from '@/components/superadmin/kit';
import AutomationCard from '@/components/automation/AutomationCard';
import RuleSaveBar from '@/components/automation/RuleSaveBar';
import FieldNumber from '@/components/automation/FieldNumber';

const TYPE_LABEL = {
  night_before: 'the night before',
  hour_before: 'one hour before',
  follow_up: 'as a follow-up',
  custom_automation: 'on its own trigger',
};

const offsetText = (row) => {
  if (row.offsetHours == null) return '';
  const hours = Number(row.offsetHours);
  const when = `${Math.abs(hours)}h ${hours < 0 ? 'before' : 'after'}`;
  return ` · ${when}${row.timeOfDay ? ` @ ${row.timeOfDay}` : ''}`;
};

const sectionHead = { color: C.muted, fontSize: '10px', letterSpacing: '1.4px', textTransform: 'uppercase', margin: '0 0 8px' };

export default function AutomationsTab({ overview, draft, onDraft, onSave, onRestore, saving, note }) {
  const { automations, groups, emailRules, scoring } = overview;

  return (
    <div>
      {groups.map((group) => {
        const rows = automations.filter((automation) => automation.group === group);
        if (!rows.length) return null;
        return (
          <div key={group} style={{ marginBottom: '18px' }}>
            <div style={sectionHead}>{group} · {rows.length}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '10px' }}>
              {rows.map((automation) => (
                <AutomationCard key={automation.key} automation={automation}>
                  {automation.editable === 'followUpLinksRequired' && draft && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '9px', paddingTop: '9px', borderTop: `1px solid ${C.border}` }}>
                      <div style={{ width: '74px' }}>
                        <FieldNumber
                          value={draft.thresholds.followUpLinksRequired}
                          changed={Number(draft.thresholds.followUpLinksRequired) !== Number(scoring.defaults.thresholds.followUpLinksRequired)}
                          onChange={(value) => onDraft({ followUpLinksRequired: value })}
                        />
                      </div>
                      <span style={{ color: C.ink, fontSize: '11px' }}>vetted links needed of the 3 we track</span>
                    </div>
                  )}
                </AutomationCard>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ marginBottom: '6px' }}>
        <div style={sectionHead}>Email templates with their own rule · {emailRules.length}</div>
        <div style={{ color: C.muted, fontSize: '11px', marginBottom: '10px' }}>
          These send on their own offset. Turn one on or off in the Debt Call Coach or Fronter email tabs.
        </div>
        {emailRules.length === 0 && <div style={{ color: C.dim, fontSize: '11px' }}>Every saved template is manual — nothing sends by itself.</div>}
        {emailRules.map((row) => (
          <div key={row.id} style={rowStyle}>
            <span style={chip(row.system === 'coach' ? C.coach : C.fronter)}>{row.system}</span>
            <span style={{ color: C.ink, fontSize: '12px', flex: 1 }}>{row.name}</span>
            <span style={{ color: C.muted, fontSize: '10px', whiteSpace: 'nowrap' }}>{TYPE_LABEL[row.templateType] || row.templateType}{offsetText(row)}</span>
            <span style={chip(row.enabled ? C.fronter : C.dim)}>{row.enabled ? 'On' : 'Off'}</span>
          </div>
        ))}
      </div>

      <RuleSaveBar onSave={onSave} onRestore={onRestore} saving={saving} note={note} />
    </div>
  );
}