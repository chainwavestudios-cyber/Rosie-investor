/**
 * automationOverview — the Automations & Scoring screen, in one call.
 *
 * Returns:
 *   • every automation this app runs, in plain English: what starts it, what it
 *     then does, how often, and the screen where it is changed. Written down here
 *     because these rules live in workflow files and function code, which the app
 *     cannot read at runtime;
 *   • the email templates that carry their own automation rule — read live, with
 *     their real on/off state;
 *   • the scoring rules in force, and a save action that stores new ones.
 *
 * Admins only: the Debt Call Coach admin session, or a platform admin.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { marketingUser } from '../../shared/fronterMarketing.ts';
import { CATEGORIES, DEFAULT_SCORING, FRONTER_CATEGORY } from '../../shared/engagement.ts';
import { DEFAULT_FOLLOW_UP_LINKS, readScoringRecord, rulesFromRecord } from '../../shared/scoringConfig.ts';
import { AUTOMATION_SWITCHES, automationStateFromRecord, automationSwitch, readAutomationRecord } from '../../shared/automationRules.ts';

const GROUPS = ['Email & engagement', 'Appointments & calls', 'Lead pipeline', 'Syncs & knowledge', 'Upkeep & monitoring'];

/** Every automation in the app: what starts it, and what it does next. */
const AUTOMATIONS = [
  {
    key: 'email_followup', group: 'Email & engagement', name: 'Follow-up email + “call them” event',
    when: 'A lead has opened their credentials email AND clicked at least 2 of the 3 vetted links (Trustpilot, BBB, our website)',
    then: 'Sends the follow-up email with tracking injected; when that email is opened, creates a 15-minute “call them” calendar event within the hour and a meeting popup in Debt Call Coach',
    cadence: 'About 30 seconds after every tracked open or click', where: 'Workflow “Email Follow-Up Automation” → processEmailTrackingEvent',
    editable: 'followUpLinksRequired',
  },
  {
    key: 'hot_alert', group: 'Email & engagement', name: 'Hot-lead alert + permanent record',
    when: 'A contact card’s engagement score reaches the hot line (or hits a hot pattern such as repeat opens on the credentials email)',
    then: 'Turns the lead red in the engagement console, raises the live alert, and writes the lead into the permanent hot-lead record with its score and reasons',
    cadence: 'Live, on every tracked event', where: 'Scoring rules tab',
  },
  {
    key: 'coach_engine', group: 'Email & engagement', name: 'Debt Coach marketing engine',
    when: 'A campaign email’s scheduled time arrives',
    then: 'Sends that batch through its own template', cadence: 'Every 5 minutes',
    where: 'Workflow “Debt Coach Marketing Engine”',
  },
  {
    key: 'nightly_marketing', group: 'Email & engagement', name: 'Marketing nightly report',
    when: 'The end of each night (11:55pm ET)',
    then: 'Builds the Debt Coach marketing engagement report for the day', cadence: 'Daily at 11:55pm',
    where: 'Workflow “Debt Coach Marketing Nightly Report”',
  },
  {
    key: 'rate_drop', group: 'Email & engagement', name: 'Rate Drop mailer engine',
    when: 'A Rate Drop mailer is due in its campaign schedule',
    then: 'Generates the notice, injects it into the campaign’s Mailjet template and sends it', cadence: 'Every 5 minutes',
    where: 'Workflow “Rate Drop Mailer Engine”',
  },
  {
    key: 'nbtech_campaign', group: 'Email & engagement', name: 'NB Tech campaign runner',
    when: 'An active NB Tech email campaign has a due batch',
    then: 'Fires that batch', cadence: 'Every 5 minutes', where: 'Workflow “NB Tech Campaign Runner”',
  },
  {
    key: 'bot_filter', group: 'Email & engagement', name: 'Crawler filter on tracking events',
    when: 'A tracked open or click arrives in the first 30 seconds after a send',
    then: 'It is ignored everywhere — scoring, the follow-up email, the hot-lead cue — so mail preview crawlers can never fake engagement',
    cadence: 'On every tracking event', where: 'Scoring rules tab',
  },
  {
    key: 'migration_floor', group: 'Lead pipeline', name: 'Coach score a migrated lead starts on',
    when: 'A fronter prospect migrates into Debt Call Coach',
    then: 'Its coach score starts at the migration start score — the fronter score never travels into the coach system',
    cadence: 'On every migration', where: 'Scoring rules tab',
  },
  {
    key: 'appointment_reminders', group: 'Appointments & calls', name: 'Appointment reminders',
    when: 'A lead’s appointment is coming up',
    then: 'Sends the night-before email (credential links plus confirm / change buttons) and the 1-hour-before reminder, both tracked',
    cadence: 'Every 15 minutes', where: 'Workflow “Appointment Reminders”',
  },
  {
    key: 'fronter_meetings', group: 'Appointments & calls', name: 'Fronter meeting reminders',
    when: 'A fronter meeting is coming up',
    then: 'Sends the customer reminder the night before at 8pm in their timezone and again 1 hour before the meeting',
    cadence: 'Every 15 minutes', where: 'Workflow “Fronter Meeting Reminders”',
  },
  {
    key: 'nbtech_tag', group: 'Lead pipeline', name: 'Auto-tag NB Tech leads',
    when: 'A lead record is created or updated with the NB Tech email badge or a Data Room request',
    then: 'Sets the lead type to nb_tech and hands the lead pipeline to admin', cadence: 'On every lead create or update',
    where: 'Workflow “Auto-Tag NB Tech Leads”',
  },
  {
    key: 'scrape_social', group: 'Lead pipeline', name: 'Social lead scraping',
    when: 'The clock hits midnight, 6am, noon or 6pm ET',
    then: 'Mines Reddit, Quora, Stack Exchange, X and Facebook for fresh debt-distress posts and files them as scraped leads',
    cadence: 'Four times a day', where: 'Workflow “Scrape Social Leads 4x Daily”',
  },
  {
    key: 'sync_leads', group: 'Syncs & knowledge', name: 'Leads → master Google Sheet',
    when: 'A lead record is created or updated', then: 'Writes it to the master Google Sheets spreadsheet',
    cadence: 'Live', where: 'Workflow “Sync Leads to Google Sheets”',
  },
  {
    key: 'sync_investors', group: 'Syncs & knowledge', name: 'Investors → master Google Sheet',
    when: 'An investor or prospect record is created or updated', then: 'Writes it to the master Google Sheets spreadsheet',
    cadence: 'Live', where: 'Workflow “Sync Investors to Google Sheets”',
  },
  {
    key: 'sync_kb', group: 'Syncs & knowledge', name: 'Knowledge base merge',
    when: 'Every 2 hours', then: 'Merges BOB’s Brain with the main knowledge base so both show the same debt entries',
    cadence: 'Every 2 hours', where: 'Workflow “Sync Debt KB”',
  },
  {
    key: 'sync_objections', group: 'Syncs & knowledge', name: 'Objections → knowledge base',
    when: 'Every 2 hours', then: 'Copies enabled objections into the knowledge base so BOB training and the live-call panels pick them up',
    cadence: 'Every 2 hours', where: 'Workflow “Sync Objections to KB”',
  },
  {
    key: 'sync_scripts', group: 'Syncs & knowledge', name: 'Scripts → BOB’s knowledge base',
    when: 'Every 2 hours', then: 'Fetches the opener and closer scripts from the external endpoint into BOB’s knowledge base',
    cadence: 'Every 2 hours', where: 'Workflow “Sync Scripts for BOB”',
  },
  {
    key: 'script_backup', group: 'Upkeep & monitoring', name: 'Nightly script backup',
    when: 'Every night at 2am ET',
    then: 'Backs up every script marked for backup and deletes backups older than 7 days', cadence: 'Daily at 2am',
    where: 'Workflow “Nightly Script Backup”',
  },
  {
    key: 'cleanup_leads', group: 'Upkeep & monitoring', name: 'Delete soft-deleted leads',
    when: 'Daily at 3am', then: 'Permanently deletes leads that were soft-deleted more than 7 days ago',
    cadence: 'Daily at 3am', where: 'Workflow “Cleanup Soft-Deleted Leads”',
  },
  {
    key: 'cleanup_bob', group: 'Upkeep & monitoring', name: 'BOB recording cleanup',
    when: 'Every hour', then: 'Deletes BOB training recordings and their records past the 24-hour retention',
    cadence: 'Hourly', where: 'Workflow “Cleanup Expired BOB Sessions”',
  },
  {
    key: 'ai_cost', group: 'Upkeep & monitoring', name: 'Nightly AI cost report',
    when: 'Every night at 3am ET',
    then: 'Builds the exact AI cost report for the day just ended — one record per day, per call, with real token counts and dollars',
    cadence: 'Daily at 3am', where: 'Workflow “Nightly AI Cost Report”',
  },
  {
    key: 'fronter_audits', group: 'Upkeep & monitoring', name: 'Fronter performance audits',
    when: 'A fronter has clocked in today',
    then: 'Generates the AM audit 4.5 hours after clock-in and the PM audit at clock-out', cadence: 'Every 10 minutes',
    where: 'Workflow “Fronter Performance Audits”',
  },
  {
    key: 'bridge_keepalive', group: 'Upkeep & monitoring', name: 'Live voice bridge keepalive',
    when: 'Every 10 minutes', then: 'Pings the live AI voice bridge so it never spins down and drops a call mid-answer',
    cadence: 'Every 10 minutes', where: 'Workflow “Bridge Keepalive”',
  },
  {
    key: 'connector_keepalive', group: 'Upkeep & monitoring', name: 'Calendar & Gmail keepalive',
    when: 'Every 4 hours', then: 'Refreshes the shared Google Calendar and Gmail connections so their access never goes idle long enough to expire',
    cadence: 'Every 4 hours', where: 'Workflow “Connector Keepalive”',
  },
  {
    key: 'quote_broadcaster', group: 'Upkeep & monitoring', name: 'Fronter quote broadcaster',
    when: 'A scheduled quote is due',
    then: 'Posts the quote into the fronter chatroom, and generates two fresh AI quotes a day (9am and 3pm ET)',
    cadence: 'Every 15 minutes', where: 'Workflow “Fronter Quote Broadcaster”',
  },
];

const number = (value: any, fallback: number, max = 500) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.round(parsed * 10) / 10));
};

const rowsOf = (value: any) => (Array.isArray(value) ? value : (value?.items || []));

/** The email templates that carry their own automation rule, with its real state. */
function templateRules(coachTemplates: any[], fronterTemplates: any[]) {
  const coach = rowsOf(coachTemplates)
    .filter((row: any) => row.templateType && row.templateType !== 'manual')
    .map((row: any) => ({
      id: String(row.id), system: 'coach', name: row.name || 'Coach template', templateType: row.templateType,
      enabled: row.enabled !== false, offsetHours: row.triggerOffsetHours ?? null, timeOfDay: row.triggerTimeOfDay || '',
    }));
  const fronter = rowsOf(fronterTemplates)
    .filter((row: any) => row.templateType && row.templateType !== 'manual')
    .map((row: any) => ({
      id: String(row.id), system: 'fronter', name: row.label || 'Fronter template', templateType: row.templateType,
      enabled: row.enabled !== false, offsetHours: row.triggerOffsetHours ?? null, timeOfDay: row.triggerTimeOfDay || '',
    }));
  return [...coach, ...fronter];
}

const thresholdsOf = (rules: any) => ({
  hotScore: rules.hotScore,
  engagedScore: rules.engagedScore,
  warmingScore: rules.warmingScore,
  migrationStartScore: rules.migrationStartScore,
  botFilterSeconds: rules.botFilterSeconds,
  followUpLinksRequired: rules.followUpLinksRequired,
});

const familiesOf = (weights: any) =>
  [...CATEGORIES, FRONTER_CATEGORY].map((category) => ({
    key: category.key, label: category.label, system: category.system, weights: weights[category.key],
  }));

export default async function (req: Request): Promise<Response> {
  try {
    const body: any = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const user = await marketingUser(base44, body);
    if (!user.canEdit) return Response.json({ error: 'Only an admin can see or change the automations.' }, { status: 403 });

    if (body.action === 'saveAutomations') {
      const allowed = new Set(AUTOMATION_SWITCHES.map((row) => row.key));
      const enabledIn = body.enabled && typeof body.enabled === 'object' ? body.enabled : {};
      const intervalsIn = body.intervals && typeof body.intervals === 'object' ? body.intervals : {};

      // Only a switch that is off is stored; anything on is simply absent (the app's own default).
      const enabled: any = {};
      Object.keys(enabledIn).forEach((key) => {
        if (allowed.has(key) && enabledIn[key] === false) enabled[key] = false;
      });

      const intervals: any = {};
      Object.keys(intervalsIn).forEach((key) => {
        const minutes = Number(intervalsIn[key]);
        if (allowed.has(key) && Number.isFinite(minutes) && minutes > 0) intervals[key] = Math.min(10080, Math.round(minutes));
      });

      const existingAutomation = await readAutomationRecord(base44);
      const automationPayload = {
        configName: 'automations',
        enabledJson: JSON.stringify(enabled),
        intervalsJson: JSON.stringify(intervals),
        updatedBy: user.username || user.email || 'admin',
        updatedAt: new Date().toISOString(),
      };
      if (existingAutomation) await base44.asServiceRole.entities.AutomationConfig.update(existingAutomation.id, automationPayload);
      else await base44.asServiceRole.entities.AutomationConfig.create(automationPayload);
    }

    if (body.action === 'save') {
      const thresholds = body.thresholds || {};
      const patterns = body.patterns || {};
      const hot = number(thresholds.hotScore, DEFAULT_SCORING.hotScore, 100);
      const engaged = number(thresholds.engagedScore, DEFAULT_SCORING.engagedScore, 100);
      const warming = number(thresholds.warmingScore, DEFAULT_SCORING.warmingScore, 100);
      if (engaged > hot) return Response.json({ error: 'Engaged has to be at or below the hot line.' }, { status: 400 });
      if (warming > engaged) return Response.json({ error: 'Warming has to be at or below the engaged line.' }, { status: 400 });

      const families = rowsOf(body.families).filter((row: any) => row && row.key).map((row: any) => ({
        key: String(row.key),
        open: number(row.open, 0), repeat: number(row.repeat, 0), click: number(row.click, 0),
        depth: number(row.depth, 0), welcome: number(row.welcome, 0), qualify: number(row.qualify, 0), site: number(row.site, 0),
      }));

      const defaults = DEFAULT_SCORING.patterns as any;
      const payload: any = {
        configName: 'engagement',
        hotScore: hot, engagedScore: engaged, warmingScore: warming,
        migrationStartScore: number(thresholds.migrationStartScore, DEFAULT_SCORING.migrationStartScore, 100),
        botFilterSeconds: number(thresholds.botFilterSeconds, DEFAULT_SCORING.botFilterSeconds, 600),
        followUpLinksRequired: Math.max(1, Math.round(number(thresholds.followUpLinksRequired, DEFAULT_FOLLOW_UP_LINKS, 10))),
        weightsJson: JSON.stringify(families),
        patternsJson: JSON.stringify({
          bothReminders: number(patterns.bothReminders, defaults.bothReminders),
          followUpTwoLinks: number(patterns.followUpTwoLinks, defaults.followUpTwoLinks),
          credsRepeatPattern: number(patterns.credsRepeatPattern, defaults.credsRepeatPattern),
          credsRepeatOpens: number(patterns.credsRepeatOpens, defaults.credsRepeatOpens, 20),
          credsOpensWithSite: number(patterns.credsOpensWithSite, defaults.credsOpensWithSite, 20),
          credsQualifyIsHot: patterns.credsQualifyIsHot !== false,
          goldenAvatar: number(patterns.goldenAvatar, defaults.goldenAvatar),
          fronterClick: number(patterns.fronterClick, defaults.fronterClick),
          fronterRepeatOpens: number(patterns.fronterRepeatOpens, defaults.fronterRepeatOpens),
        }),
        updatedBy: user.username || user.email || 'admin',
        updatedAt: new Date().toISOString(),
      };

      const existing = await readScoringRecord(base44);
      if (existing) await base44.asServiceRole.entities.ScoringConfig.update(existing.id, payload);
      else await base44.asServiceRole.entities.ScoringConfig.create(payload);
    }

    const [coachTemplates, fronterTemplates, record, automationRecord] = await Promise.all([
      base44.asServiceRole.entities.DebtEmailTemplate.list('-created_date', 200),
      base44.asServiceRole.entities.FronterEmailTemplate.list('-created_date', 200),
      readScoringRecord(base44),
      readAutomationRecord(base44),
    ]);
    const rules: any = rulesFromRecord(record);

    return Response.json({
      generatedAt: new Date().toISOString(),
      groups: GROUPS,
      automations: AUTOMATIONS.map((automation: any) => {
        const meta = automationSwitch(automation.key);
        return {
          ...automation,
          kind: meta?.kind || 'timed',
          enforcedBy: meta?.enforcedBy || '',
          gated: Boolean(meta?.enforcedBy),
          warn: meta?.warn || '',
        };
      }),
      automationState: automationStateFromRecord(automationRecord),
      emailRules: templateRules(coachTemplates, fronterTemplates),
      scoring: {
        thresholds: thresholdsOf(rules),
        patterns: rules.patterns,
        families: familiesOf(rules.weights),
        defaults: {
          thresholds: thresholdsOf({ ...DEFAULT_SCORING, followUpLinksRequired: DEFAULT_FOLLOW_UP_LINKS }),
          patterns: DEFAULT_SCORING.patterns,
          families: familiesOf(DEFAULT_SCORING.weights),
        },
        updatedBy: record?.updatedBy || '',
        updatedAt: record?.updatedAt || '',
      },
    });
  } catch (error: any) {
    const forbidden = error?.message === 'Forbidden' || error?.message === 'Unauthorized';
    return Response.json({ error: error?.message || 'Could not read the automations' }, { status: forbidden ? 403 : 500 });
  }
}