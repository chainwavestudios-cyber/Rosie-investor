/**
 * systemAuditReport.js — the single source of the System Evidence and Readiness
 * Review: the claim boundary, the scope of the review, the system-by-system audit,
 * the data-access findings, the evidence gap register and the stated limitations.
 *
 * Both the on-screen document and the exported PDF read from this one file, so a
 * revision changes the page and the PDF together.
 */

export const AUDIT_META = {
  title: 'System Evidence and Readiness Review',
  subtitle: 'Companion evidence boundary for claims of outcome percentages, universal uptime and production readiness',
  platform: 'RoieAI-Investor',
  version: 'Version 1.0',
  preparedOn: '25 October 2026',
  classification: 'Internal document - share on request',
  nextReview: 'On any material change to a system in scope, and otherwise within 90 days of the review date',
};

export const STATUS_META = {
  verified: { label: 'Verified in source', tone: 'ok' },
  partial: { label: 'Partially evidenced', tone: 'warn' },
  'not-proven': { label: 'Not yet proven', tone: 'bad' },
};

export const CLAIM_BOUNDARY = {
  declaration: 'NOT YET PROVEN: Outcome percentages, universal uptime, and production readiness require separate evidence.',
  reading: 'Three claims are commonly made about a platform of this kind. This section states, for each of the three, what evidence the systems hold today, what remains unproven, and the specific separate evidence that would be required before the claim may be relied upon.',
  limbs: [
    {
      key: 'outcomes',
      title: '1. Outcome percentages',
      claim: 'Rates such as contact, conversion, enrolment and engagement percentages.',
      held: 'The platform records event-level evidence. Every tracked open, link click and qualification-page visit is written as its own timestamped record; calls and their outcomes are logged per contact; appointment, reschedule and pipeline events carry timestamps; and per-lead engagement scores are retained as history. Every percentage shown inside the application is computed live from those records.',
      notProven: [
        'No independent verification that the underlying events are complete, correctly ordered and free of duplicates.',
        'No reconciled totals: the figures are derived from tracked events and have not been tied back to the sending provider, the telephony records and the calendar for any closed period.',
        'Automated opens by mailbox preview crawlers are known to inflate raw open counts. A filter setting exists, but its accuracy has not been measured against known-good data.',
        'No stated measurement window, sample size, denominator rule or confidence treatment accompanies any published percentage.',
      ],
      required: [
        'A written metric dictionary: each metric, its numerator, its denominator, its window and its exclusions.',
        'A reconciliation pack for one closed period, tying the platform figures back to the source systems.',
        'A test result showing duplicate and automated-open filtering working against known-good data.',
        'Independent review of the reconciled pack before any percentage is relied upon.',
      ],
    },
    {
      key: 'uptime',
      title: '2. Universal uptime',
      claim: 'Continuous availability of the service, implied for all users at all times.',
      held: 'The application is built and served by the hosting platform, which also provides the database, authentication and file storage. The operational dependencies are third-party services: telephony, speech and voice, language models, email and calendar providers, reached with credentials held server-side. Failure handling in the application is reactive rather than measured.',
      notProven: [
        'No availability monitoring and no availability objective. No uptime figure for any period is measured, recorded or auditable.',
        'No incident register, and no time-to-detect or time-to-repair history.',
        'No dependency register listing each provider service commitment, its failure mode and the application behaviour when it is unavailable.',
        'No failover, degradation or recovery test results. Operational faults have been found and corrected reactively, which is evidence of incidents rather than of resilience.',
        'The word universal is not supported by any measurement held in this review.',
      ],
      required: [
        'Availability monitoring on the user-facing paths and on each dependency, with an agreed monthly objective.',
        'Alerting thresholds, and an incident log kept from the day monitoring begins.',
        'A dependency register with each service commitment, failure mode and fallback, and the intended behaviour when each dependency is lost.',
        'Recorded results of a degradation and recovery exercise.',
      ],
    },
    {
      key: 'production',
      title: '3. Production readiness',
      claim: 'Readiness to carry production load, protect data and operate under control.',
      held: 'The platform is live in daily use across several portals, with role-based capability gating, provider credentials held server-side and resolved at run time, central on/off and timing controls over every automation, a duplicate guard on outbound email, and a scheduled job that removes records flagged for deletion.',
      notProven: [
        'No independent security assessment. Neither the code nor the access rules have been tested by a third party, and no penetration test result is held.',
        'Row-level access rules are incomplete, as set out in section 5: 110 of the 120 application data types carry no row-level restriction.',
        'No load or capacity test result. The peak simultaneity the platform can absorb is unknown.',
        'No restore or recovery exercise. Backups exist at platform level, but a restore has not been performed and evidenced.',
        'No documented change management, release approval, or data retention and deletion policy.',
        'No release-stage evidence for the packaged mobile builds: no build artefact, store status or device test result is held.',
      ],
      required: [
        'An independent security assessment of the application and its data access rules, with the remediation record.',
        'Completion and verification of row-level access restrictions, beginning with the data types that hold personal contact data.',
        'A load test against expected peak simultaneity, with recorded results and headroom stated.',
        'A documented restore drill from backup, with elapsed time and any data loss measured.',
        'Written change management, release and retention policies, plus evidence that the retention job runs as stated.',
        'Mobile release evidence: build artefacts, store status and device test results.',
      ],
    },
  ],
};

export const SCOPE = {
  inScope: 'The systems listed in section 4, as they exist in the application source and in the stored data-access rules on the review date.',
  method: [
    'Read the application source for each surface: portals, telephony, voice agents, email engines, tracking, scheduling, automation and reporting.',
    'Enumerated the integrations and the scheduled automation from configuration.',
    'Read the stored access rule of every data type and counted the restricted and unrestricted sets.',
    'Counted the implementation surface: 138 backend functions, 37 screens, 22 scheduled automations and 121 stored data types.',
    'No traffic was generated, no call was placed and no production record was modified during this review.',
  ],
  notReviewed: [
    'Live traffic volumes, throughput and concurrency behaviour.',
    'The internal behaviour and service commitments of third-party providers.',
    'Mailbox placement and deliverability at the receiving mailbox providers.',
    'Unrecorded operational practice, staff procedure and training.',
    'Financial, legal and regulatory conclusions of any kind.',
  ],
};

export const SYSTEMS = [
  {
    key: 'identity',
    system: 'Identity and access',
    purpose: 'Sign-in for application users and separately credentialed access to the operator portals, with capability gating per role.',
    evidence: 'Role gates and portal credential validation are present in source, and sessions are issued per portal.',
    status: 'partial',
    note: 'The authorization boundaries themselves have not been tested independently.',
  },
  {
    key: 'portals',
    system: 'Portal surfaces',
    purpose: 'Admin Assistant, Fronter, Debt Call Coach, Manager, Compliance, the Super Admin command centre, and the investor and prospect portals.',
    evidence: 'Every surface, route and navigation exists in source with its own access gate.',
    status: 'verified',
    note: '',
  },
  {
    key: 'intake',
    system: 'Lead intake and enrichment',
    purpose: 'Batch intake into the lead vault, telephone number append, number validation, and do-not-call and litigator screening before distribution.',
    evidence: 'Each stage records its own status and timestamps per record.',
    status: 'partial',
    note: 'Match rates, append accuracy and screening completeness have not been measured.',
  },
  {
    key: 'distribution',
    system: 'Distribution and assignment',
    purpose: 'Routing of screened leads to the Fronter queues, the AI dialer and the marketing destinations.',
    evidence: 'Destination, assignee, distributor and timestamps are stored per lead.',
    status: 'verified',
    note: '',
  },
  {
    key: 'telephony',
    system: 'Telephony and dialer',
    purpose: 'Browser-based dialing, inbound and outbound call handling, warm transfer and bridging, call logs and voicemail capture.',
    evidence: 'Token issuance, call handlers and per-call logs are present, and calls are recorded against the contact.',
    status: 'partial',
    note: 'Call quality, connect rate and routing success have not been measured.',
  },
  {
    key: 'voice',
    system: 'Voice AI agents',
    purpose: 'Live voice agents for coaching and qualification, including speech, avatar and video qualification pipelines.',
    evidence: 'Agent configuration, session capture and per-call records exist, and model and provider settings are resolved from one central place.',
    status: 'partial',
    note: 'Session reliability has been addressed reactively when a model setting was rejected by the provider. No reliability measurement is held.',
  },
  {
    key: 'reasoning',
    system: 'AI reasoning and content generation',
    purpose: 'Transcript analysis, live field extraction, call briefings, knowledge-grounded answers, script and objection generation.',
    evidence: 'Prompts, provider routing and per-call cost and credit logging are present in source.',
    status: 'partial',
    note: 'Output accuracy has not been benchmarked against a reviewed sample.',
  },
  {
    key: 'email',
    system: 'Email delivery',
    purpose: 'Outbound mail across the operator mailbox, the outreach provider and the legacy marketing provider, driven by a shared template library.',
    evidence: 'Per-message send status, provider message identifiers, failure reasons and a duplicate guard are stored for each send.',
    status: 'partial',
    note: 'Bounce, complaint and inbox placement outcomes are not measured end to end.',
  },
  {
    key: 'tracking',
    system: 'Email engagement tracking',
    purpose: 'Open and click tracking, qualification-page visits, unsubscribe capture, engagement scoring and permanent hot-lead history.',
    evidence: 'Every tracked event is stored as its own record with its own identifier; scores derive from those events and the history is retained.',
    status: 'partial',
    note: 'Automated preview opens inflate raw counts; the filter exists but has not been measured.',
  },
  {
    key: 'campaigns',
    system: 'Campaign and sequence engines',
    purpose: 'Queue-based campaigns with batch size, interval, daily limits and sending windows, the rate-drop mailer engine, appointment reminders and eligibility-gated follow-up sequences.',
    evidence: 'Per-recipient state, run timestamps and gate configuration are stored for each job.',
    status: 'verified',
    note: '',
  },
  {
    key: 'calendar',
    system: 'Calendar and scheduling',
    purpose: 'Business calendar integration, appointment booking, confirmation and change handling, the public reschedule flow and reminder scheduling.',
    evidence: 'Event identifiers, event links and per-lead timestamps are stored, and sync handlers are present.',
    status: 'partial',
    note: 'Sync reliability across every flow has not been measured.',
  },
  {
    key: 'automation',
    system: 'Automation control',
    purpose: 'Central on/off switches and timing overrides for every automation in the platform.',
    evidence: 'The control is read inside each job itself, so a switch takes effect on the next run.',
    status: 'verified',
    note: '',
  },
  {
    key: 'data',
    system: 'Data layer and retention',
    purpose: 'Structured storage for leads, prospects, messages, events, transcripts, reports and configuration, with soft deletion and scheduled cleanup.',
    evidence: 'Schemas define 121 data types, and a scheduled job removes records flagged for deletion after the stated period.',
    status: 'partial',
    note: 'Transcript and session size limits have been reached operationally. No retention policy is documented.',
  },
  {
    key: 'reporting',
    system: 'Reporting and analytics',
    purpose: 'Performance, engagement, cost and credit reporting across the portals and the command centre.',
    evidence: 'Reports are generated from stored events and per-call cost records.',
    status: 'partial',
    note: 'Figures are derived. They have not been reconciled to the source systems.',
  },
  {
    key: 'secrets',
    system: 'Secrets and key handling',
    purpose: 'Provider credentials for telephony, speech, language models, email and screening services.',
    evidence: 'Credentials are held in server-side secret storage and resolved at run time, and provider calls are made from the server rather than the browser.',
    status: 'verified',
    note: '',
  },
  {
    key: 'access-rules',
    system: 'Data-access rules',
    purpose: 'Per-record access restriction on stored data types.',
    evidence: 'All 121 stored data types were read: 10 restrict access and 110 carry no row-level restriction. See section 5.',
    status: 'not-proven',
    note: '',
  },
  {
    key: 'delivery',
    system: 'Mobile and web delivery',
    purpose: 'One codebase served as a responsive web application and packaged for the mobile app stores.',
    evidence: 'The responsive web application is live. The packaging path exists at platform level.',
    status: 'not-proven',
    note: 'No build, submission or device test evidence is held in this review.',
  },
  {
    key: 'availability',
    system: 'Availability and monitoring',
    purpose: 'Measurement of whether the service is up, how often it fails, and how long recovery takes.',
    evidence: 'None held. No monitoring, no availability objective and no incident log.',
    status: 'not-proven',
    note: '',
  },
];

export const ACCESS_FINDINGS = {
  reviewed: 121,
  appDefined: 120,
  platformGoverned: 1,
  restricted: 10,
  unrestricted: 110,
  restrictedNames: ['AutomationConfig', 'EmailImageAsset', 'EmailMessage', 'EmailOptIn', 'EngagementHotLead', 'HomeChatMessage', 'HomeChatSession', 'ScoringConfig', 'VideoQualifyConfig', 'VideoQualifySession'],
  headline: '110 of the 120 application data types, 92 per cent, carry no row-level access restriction.',
  consequence: 'For those types, any caller able to reach the data interface can read, change or delete records. The set includes lead and prospect contact details, message and tracking logs, email templates, campaign records and operating configuration. The exposure is not limited to misjudgement by signed-in staff: it applies wherever the data interface is reachable.',
  caveat: 'Ten data types restrict access to administrators. Some unrestricted types are written by systems outside the signed-in application, such as mailbox tracking requests and public forms, so restricting access requires a per-flow decision rather than a blanket change. That analysis is not part of this review.',
  remediation: [
    'Decide, per data type, who must read and write it and from where.',
    'Apply row-level restrictions first to the types that hold personal contact data and message content.',
    'Where a flow must stay reachable by an outside system, scope it to the narrowest operation and value set.',
    'Repeat this census after each change and record the result in the next revision of this document.',
  ],
};

export const GAPS = [
  { id: 'G-01', gap: 'No metric dictionary and no instrumented outcome measurement', why: 'Without agreed numerators, denominators and windows, no percentage can be reproduced or defended.', closesWith: 'A written metric dictionary agreed with the operator.' },
  { id: 'G-02', gap: 'No reconciliation of any closed period', why: 'The central claim of outcome percentages rests on figures that have never been tied back to source systems.', closesWith: 'A reconciliation pack for one closed month against sending, telephony and calendar records.' },
  { id: 'G-03', gap: 'Automated-open and duplicate filtering is unmeasured', why: 'Raw open counts are inflated by mailbox preview crawlers, so engagement rates are overstated.', closesWith: 'A filtering test against known-good data, with the result recorded.' },
  { id: 'G-04', gap: 'No availability monitoring and no availability objective', why: 'Uptime is asserted, never measured; there is no figure for any period.', closesWith: 'Monitoring on user-facing paths and dependencies with an agreed monthly objective.' },
  { id: 'G-05', gap: 'No incident register', why: 'Recovery performance cannot be stated without a record of failures and their duration.', closesWith: 'An incident log kept from the date monitoring starts.' },
  { id: 'G-06', gap: 'No dependency and failure-mode register', why: 'Availability depends on several third parties whose commitments and failure behaviour are undocumented.', closesWith: 'A register of each provider, its commitment, failure mode and fallback.' },
  { id: 'G-07', gap: 'No recovery or degradation exercise', why: 'Resilience is untested, so behaviour under dependency loss is unknown.', closesWith: 'A recorded exercise demonstrating graceful degradation and recovery.' },
  { id: 'G-08', gap: 'No independent security assessment', why: 'No external test of the code, the access rules or the interface exists.', closesWith: 'A third-party assessment with a remediation record.' },
  { id: 'G-09', gap: 'Row-level access rules incomplete', why: '110 of 120 data types are readable and writable by any reachable caller, including personal contact data.', closesWith: 'Per-type access decisions applied and verified, then re-censused.' },
  { id: 'G-10', gap: 'No load or capacity test', why: 'The load the platform can carry, and the headroom, are unknown.', closesWith: 'A load test at expected peak simultaneity with recorded results.' },
  { id: 'G-11', gap: 'No restore drill from backup', why: 'Recoverability is assumed, not demonstrated, and data loss on restore is unquantified.', closesWith: 'A documented restore into a test environment with elapsed time measured.' },
  { id: 'G-12', gap: 'No change management or release process', why: 'There is no control record of what changed, who approved it, or how it was verified.', closesWith: 'A written release and approval process with a change log.' },
  { id: 'G-13', gap: 'No data retention and deletion policy', why: 'Retention is set by job behaviour rather than by policy, and transcript size limits have already been reached.', closesWith: 'A written retention schedule, implemented and evidenced.' },
  { id: 'G-14', gap: 'Call and voice reliability unmeasured', why: 'Session success, call quality and connect rates are the core operational experience and are not tracked.', closesWith: 'Per-session success instrumentation with a monthly report.' },
  { id: 'G-15', gap: 'Deliverability unmeasured', why: 'Bounce, complaint and placement outcomes decide whether email performance claims hold.', closesWith: 'Provider feedback and placement monitoring reported monthly.' },
  { id: 'G-16', gap: 'AI output accuracy unbenchmarked', why: 'Extraction, briefings and generated content influence live decisions without an accuracy baseline.', closesWith: 'A reviewed sample scored against expected output, with results retained.' },
  { id: 'G-17', gap: 'No mobile release evidence', why: 'Delivery to mobile is described as a capability, with no build, store or device proof.', closesWith: 'Build artefacts, store status and device test results.' },
];

export const LIMITATIONS = [
  'This document reports the state of the systems on the review date. It is not an audit opinion, a certification, a warranty or a statement of compliance.',
  'A system marked as verified in source means the mechanism was found in the reviewed code and configuration. It does not mean the mechanism was tested, that it is complete, or that it performs as intended under load.',
  'A system marked as partially evidenced exists and is in use, but its coverage, accuracy or reliability has not been proven.',
  'A system marked as not yet proven has no evidence held at all in this review.',
  'Nothing in this document supports a claim of outcome percentage, universal uptime or production readiness. Those three claims require the separate evidence set out in section 2 and tracked in section 6.',
];

export const DOCUMENT_CONTROL = {
  source: 'Prepared from the application source, the stored data-access rules and the integration and automation configuration held in the workspace.',
  preparer: 'Prepared by the platform build assistant at the request of the operator.',
  revision: 'A new version is issued whenever a system in scope changes materially, and the gap register is updated to show which gaps have closed.',
  distribution: 'Internal. Share only with recipients cleared to see the system inventory and the data-access findings.',
};