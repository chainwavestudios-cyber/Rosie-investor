/**
 * automationRules.ts — the live switchboard for every automation this app runs.
 *
 * The automations themselves live in workflow files and function code, which the
 * app cannot read or change at runtime. What it CAN do is decide, inside the
 * function that does the work, whether this run is allowed — and that is exactly
 * what this module is: one on/off switch and one timing value per automation,
 * stored in the single AutomationConfig record the Automations & Scoring screen
 * edits.
 *
 * A function that a workflow drives calls automationGate() first:
 *
 *   const gate = await automationGate(base44, 'appointment_reminders');
 *   if (!gate.run) return Response.json({ skipped: true, reason: gate.reason });
 *
 * Switched off  → the automation does not run anywhere.
 * Interval set  → it runs at most that often; ticks in between are skipped.
 * Interval 0    → it runs every time its schedule fires (the app's own default).
 *
 * The gate records the run itself when the interval is in use, so "last ran" on
 * the screen is the truth and never a guess.
 */

export type AutomationKind = 'timed' | 'event' | 'rule';

export interface AutomationSwitch {
  key: string;
  kind: AutomationKind;
  /** The function that honours this switch. Absent = the logic lives inside the workflow file. */
  enforcedBy?: string;
  /** Something the screen should tell the admin about this one. */
  warn?: string;
}

/** Works whether the caller handed us the plain client or an already service-role one. */
const serviceRole = (base44: any) => base44?.asServiceRole || base44;

/** Every automation the Automations & Scoring screen shows, and who obeys it. */
export const AUTOMATION_SWITCHES: AutomationSwitch[] = [
  { key: 'email_followup', kind: 'event' },
  { key: 'hot_alert', kind: 'rule' },
  { key: 'coach_engine', kind: 'timed', enforcedBy: 'debtMarketingRun' },
  { key: 'nightly_marketing', kind: 'timed', enforcedBy: 'debtMarketingReport' },
  { key: 'rate_drop', kind: 'timed', enforcedBy: 'rateDropCampaignRun' },
  { key: 'nbtech_campaign', kind: 'timed', enforcedBy: 'runEmailCampaigns' },
  { key: 'bot_filter', kind: 'rule' },
  { key: 'migration_floor', kind: 'rule' },
  { key: 'appointment_reminders', kind: 'timed', enforcedBy: 'sendAppointmentReminders' },
  { key: 'fronter_meetings', kind: 'timed', enforcedBy: 'sendFronterMeetingReminders' },
  { key: 'nbtech_tag', kind: 'event', warn: 'Its workflow calls autoTagNbTechLeads, which no longer exists in the app — so this auto-tag is not running.' },
  { key: 'scrape_social', kind: 'timed', enforcedBy: 'scrapeSocialLeads' },
  { key: 'sync_leads', kind: 'event', enforcedBy: 'syncLeadToSheets' },
  { key: 'sync_investors', kind: 'event', enforcedBy: 'syncInvestorToSheets' },
  { key: 'sync_kb', kind: 'timed', enforcedBy: 'syncDebtKB' },
  { key: 'sync_objections', kind: 'timed', enforcedBy: 'syncObjectionsToKB' },
  { key: 'sync_scripts', kind: 'timed', enforcedBy: 'getScriptsForBob' },
  { key: 'script_backup', kind: 'timed', enforcedBy: 'backupScripts' },
  { key: 'cleanup_leads', kind: 'timed', enforcedBy: 'cleanupDeletedLeads' },
  { key: 'cleanup_bob', kind: 'timed', enforcedBy: 'cleanupBobSessions' },
  { key: 'ai_cost', kind: 'timed', enforcedBy: 'aiCostReport' },
  { key: 'fronter_audits', kind: 'timed', enforcedBy: 'fronterPerformanceAudit' },
  { key: 'bridge_keepalive', kind: 'timed', enforcedBy: 'bridgeKeepalive' },
  { key: 'connector_keepalive', kind: 'timed', enforcedBy: 'connectorKeepalive' },
  { key: 'quote_broadcaster', kind: 'timed', enforcedBy: 'postScheduledQuotes' },
];

export const automationSwitch = (key: string) => AUTOMATION_SWITCHES.find((row) => row.key === key) || null;

/** The one AutomationConfig record, or null when the screen has never been saved. */
export async function readAutomationRecord(base44: any) {
  const raw = await serviceRole(base44).entities.AutomationConfig.filter({ configName: 'automations' }, { limit: 5 });
  return (Array.isArray(raw) ? raw[0] : (raw?.items || [])[0]) || null;
}

const mapOf = (json: any) => {
  if (!json) return {};
  if (typeof json === 'object') return json;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** The switches in force right now, read from the record. */
export function automationStateFromRecord(record: any) {
  return {
    enabled: mapOf(record?.enabledJson),
    intervals: mapOf(record?.intervalsJson),
    lastRun: mapOf(record?.lastRunJson),
    updatedBy: record?.updatedBy || '',
    updatedAt: record?.updatedAt || '',
  };
}

/** A missing record, or a read that fails, means every automation runs as shipped — never an error. */
export async function readAutomationState(base44: any) {
  return automationStateFromRecord(await readAutomationRecord(base44).catch(() => null));
}

const minutes = (value: any) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(10080, Math.round(parsed));
};

/**
 * May this automation run right now? Switched off is switched off everywhere.
 * When an interval is set and it has not elapsed, the tick is skipped.
 * An allowed run with an interval in use is recorded so the next tick is measured
 * from a real run rather than from the schedule.
 */
export async function automationGate(base44: any, key: string) {
  const record = await readAutomationRecord(base44).catch(() => null);
  const state = automationStateFromRecord(record);
  if (state.enabled[key] === false) return { run: false, reason: 'switched off' };

  const interval = minutes(state.intervals[key]);
  if (!interval) return { run: true, intervalMinutes: 0 };

  const last = state.lastRun[key] ? new Date(state.lastRun[key]).getTime() : 0;
  if (last && Date.now() - last < interval * 60_000) {
    return { run: false, reason: `not due yet — every ${interval} min`, intervalMinutes: interval };
  }

  // This run is the one the next tick is measured from, so record it before the work starts.
  const lastRun = { ...state.lastRun, [key]: new Date().toISOString() };
  const payload: any = { lastRunJson: JSON.stringify(lastRun), updatedAt: new Date().toISOString() };
  try {
    if (record) await serviceRole(base44).entities.AutomationConfig.update(record.id, payload);
    else await serviceRole(base44).entities.AutomationConfig.create({ configName: 'automations', enabledJson: '{}', intervalsJson: '{}', ...payload });
  } catch {
    // Bookkeeping only — it must never stop the automation itself.
  }
  return { run: true, intervalMinutes: interval };
}

/** Record that this automation really ran (called by it, right after the gate lets it through). */
export async function markAutomationRun(base44: any, key: string, state: any) {
  try {
    const lastRun = { ...(state?.lastRun || {}) };
    lastRun[key] = new Date().toISOString();
    const record = await readAutomationRecord(base44);
    const payload = { lastRunJson: JSON.stringify(lastRun) };
    if (record) await serviceRole(base44).entities.AutomationConfig.update(record.id, { ...payload, updatedAt: new Date().toISOString() });
    else await serviceRole(base44).entities.AutomationConfig.create({ configName: 'automations', enabledJson: '{}', intervalsJson: '{}', ...payload, updatedAt: new Date().toISOString() });
  } catch {
    // A failed bookkeeping write must never stop the automation itself.
  }
}