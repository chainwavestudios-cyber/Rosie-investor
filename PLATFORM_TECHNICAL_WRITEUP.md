# RosieAI / Debt Advisors of America — Platform Technical Writeup

**Document type:** full platform technical audit + capability dossier
**Scope:** every system, screen, backend function, data entity, workflow and integration in this codebase
**Compiled:** 2026-10-24 · **Method:** direct read of the repository (routes, components, functions, entities, workflows, shared modules, configured secrets) — not a live end-to-end test of each endpoint
**Companion documents:** `LIVE_QA_AUDIT_REPORT.md` (Live Q&A tool, deep dive) · `src/AI_AGENT_AUDIT_REPORT.md` (AI Voice Agent, deep dive) · `base44/shared/appSystemMap.ts` (the in-app AI console's own map of the platform)

---

## 0. How to read this document

### Scale of the build

| Layer | Count |
|---|---|
| Backend functions | **138** |
| Data entities (typed schemas) | **120** |
| Scheduled / triggered workflows | **23** |
| Frontend routes | **37** |
| React components | **~420** across 22 modules |
| Shared backend modules | **42** (5,473 lines) |
| External services integrated | **13** |
| Configured platform secrets | **47** |

### Status legend (Part B function inventory)

| Tag | Meaning — what the evidence is |
|---|---|
| **UI** | Invoked from a screen in the app (the call site exists in `src/`) → part of a user-facing flow |
| **AUTO** | Not called from a screen; invoked by another function or by one of the 23 workflows → runs inside an automation |
| **ENDPOINT** | An inbound HTTP endpoint (Twilio / Vapi / Deepgram bridge / Mailjet / SMTPfast / tracking pixel / public token link). Called by an external provider, so having no in-app caller is expected |
| **MANUAL** | No caller anywhere in the codebase — invoked by hand (dashboard) only |
| **Docs ✓ / –** | Function carries a header documentation block (purpose, contract) / it does not |

**What "fully functional" means here.** A **UI** or **AUTO** tag means the function is wired into a live path and its dependencies (entity, secret, connector, helper) resolve in code. It is a code-level verdict, not a live-call test of all 138. Items where a dependency is known to be unset, expired or historically unreliable are flagged inline and again in Part F.

---

## PART A — THE SYSTEMS, A–Z

### A1. Lead Acquisition & the Vault Pipeline (B2B and B2C lead supply)

**What it is.** A five-stage industrial lead pipeline: **raw → phone-traced → carrier-validated → DNC/litigator-scrubbed → distributed**. Every stage is a screen plus a backend function, and every record keeps its full provenance on one `LeadVaultEntry` row.

**How it works.**
1. **Ingest** — `scrapeSocialLeads` (734 lines) pulls distress-signal leads on a schedule (workflow *Scrape Social Leads 4x Daily*), landing them in `ScrapedLead` / `LeadVaultEntry` with a batch label.
2. **Phone append** — `tracerfyBatch` sends the batch to Tracerfy, then writes back mobile/landline/carrier/line-type.
3. **Validation** — `validateVaultPhones` runs carrier + line-type validation with API-key rotation across three provider keys, metered per key in `PhoneValidationUsage` (quota visibility, so a dead key can't silently stop the line).
4. **Compliance scrub** — `dncScrubVault` runs the LandlineRemover DNC / state-DNC / TCPA-litigator scrub and stamps `llrClean`.
5. **Distribution** — `distributeVaultLeads` stamps a **Protoface ID** (the platform's own token system, deliberately independent of notice numbers), assigns fronters or the AI dialer, and writes the destination on the vault row.
6. **Identity** — `resolveLeadIdentity` + `leadCrossEnrich` dedupe and enrich across systems; `assignNoticeId` issues the `NFS-99999-999` notice series from a sequence lock in `SuperAdminConfig`.

**Real-world use.** This is the machine that feeds every downstream dollar: a batch of distressed-prospect records arrives, is traced to a reachable mobile, checked against DNC and litigator lists *before* anyone dials, and then split across human fronters and the AI dialer. The scrubbing stage is what keeps outbound volume defensible.

**Entities:** `LeadVaultEntry` (39 fields of provenance), `ScrapedLead`, `CreditorListEntry`, `PhoneValidationUsage`, `SmartLeadConfig`, `SmartLeadFeedback`, `ContactList`.
**UI:** Vault upload / distribution screens, phone-validation usage panels, Smart Leads.

---

### A2. The Fronter Workspace (human prospecting floor)

**What it is.** The complete workstation for "fronters" — the agents who work cold outbound and hand qualified prospects to closers. ~94 components.

**How it works.** `fronterCall` (899 lines) drives the browser dialer via Twilio; `fronterClientToken` mints the short-lived voice token; call results land on the `FronterLead` card (`callCount` capped at 3, then auto-removal), with a notes log, AI populate log, email/click tracking, checklists, hold audio, chat, time clock, and a **transfer queue** that hands a prospect to the Coach side (`transferredTo`, then `migratedDebtLeadId` on migration so the same human is never re-dialled as a stranger). Queue discipline is enforced server-side: `getQueueLeads`, assignment, and per-line assignment (`FronterLineAssignment`).

**Real-world use.** An outbound floor doing three-attempt cadence on fresh supply, with the transfer to a closer captured as a first-class record — the migration link is what makes cross-system attribution possible later.

**Entities:** `FronterLead`, `FronterScript`, `FronterEmailTemplate`, `FronterKnowledgeBase`, `FronterQuote`, `FronterMeeting`, `FronterHeadsUp`, `FronterTimeEntry`, `FronterActivityLog`, `FronterDailyReport`, `FronterPerformanceReport`, `FronterChatMessage`, `FronterCallTranscript`, `FronterCallReport`, `FronterCallComment`, `FronterLineAssignment`, `FronterHoldAudio`, `FronterAgreement`, `FronterPaymentInfo`, `FronterPopupMessage`, `FronterKnowledgeBase`.
**UI:** `/fronter` (guarded by its own error boundary + portal auth), Fronter contact card, Fronter monitor, Vault upload.

---

### A3. Debt Call Coach (the closer workspace)

**What it is.** The main dialer/closer application — a single deep-linked workspace (`?tab=`) of ~91 components covering live calling, scripts, closing, call history, new leads, hot leads, hot prospects, activities, ProtoFace, ProtoBot and more.

**How it works.**
- **Live call** — `saveCallOutcome` writes the entire outcome (notes, disposition, intent, report) as **one atomic server-side write**, so a dropped write can never lose half a call record.
- **Live AI** — `liveAssistantAI` (1,526 lines) is the brain inside the call: coach prompts, live Q&A, intent scoring, profile/hardship/cosigner/budget extraction. It logs exact token cost per call to `AICreditUsage` / `AICostReport` — cost per conversation is knowable, not a monthly surprise.
- **Intent & deal scoring** — `DebtIntentSnapshot` history, `dealScore`, `animalType` (duck/cow) behavioural typing, `EngagementHotLead` for tier changes.
- **Closing** — SmartClose closing flow with a persisted checklist (`closingProgressJson`) and a stored closing script config, so a multi-call close resumes exactly where it stopped.
- **Calls tab** — transcripts, intent reports, playbooks, recordings, dispositions.
- **Manager layer** — `managerCallControl` (live listen/takeover), `generateManagerReport` (222 lines of AI reporting), `ManagerComment`, coach tips, `FronterPerformanceAudit` / `fronterPerformanceAudit` for floor QA.

**Real-world use.** An agent on a live call sees the answer to the objection the client just raised, in the same window, sourced from the approved knowledge base; the call then becomes a structured record (transcript, intent, disposition, cost) rather than a note.

**Key entities:** `DebtLead`, `DebtLeadActivity`, `DebtCallTranscript`, `DebtScript`, `GlobalScript`, `ScriptBackup`, `DebtCoachUser`, `DebtCoachUserSetting`, `DebtCoachTip`, `DebtIntentSnapshot`, `DebtQAHistory`, `CustomerInsight`, `LeadMemory`, `ClosingScriptConfig`, `ClosingPhoneNumber`, `HotCallAlert`, `HotCallSettings`, `SavedLayout`, `DialerSession`.

---

### A4. Rosie — AI Video / Voice Qualification (multi-industry)

**What it is.** A consumer-facing AI agent that qualifies a lead by **video or voice, on the web, with no human on the call**, then transfers a qualified buyer to a live rep. Two interchangeable faces — **Rosie** and **Digital Chris** (Chris's AI counterpart) — each with its own voice and opening line, selected per invitation link (`?assistant=`).

**How it works.**
- Invitation links carry a **Protoface ID**; `vapiQualify` opens the session, `stephaniAgent` / `stephaniAgent` + `base44/shared/videoQualify.ts` (504 lines) hold the agent loop and settings, `vapiWebhook` receives the conversation events, `vapiBridgeTwiml` bridges a qualified caller to the sales line, and `VideoQualifySession` records the whole path (`started → in_progress → routing → bridged`).
- Agent-driven mode: our own LLM + knowledge base decide every line and our voice speaks it (the vendor embed is bypassed) — that is what allows **white-labelling** and script control.
- **Lip-sync tuning** is exposed as configuration (voice chunk, gap, voice delay; default 1,200 ms) so the words land with the lips rather than after them.
- Settings are read/written through the **admin-gated** `protofaceAdmin` function, so the screen works for portal admins.

**Real-world use — the cross-industry proof.** The same qualification agent that works debt-relief prospects is the one the **NB Tech offering** runs: a visitor arrives from an invitation email, is qualified on camera, and if they qualify is routed live. The by-product is intent data: `analyzeRosieSession` writes a full analysis onto the lead card (`rosieAiAnalysis`), which is where **buy signals** and **user-intent data** actually come from.

**Entities:** `VideoQualifyConfig` (single source of truth for faces, voices, prompt, KB, sales line, lip-sync), `VideoQualifySession`.

---

### A5. AI Voice Agent "Alex" (autonomous outbound + inbound)

**What it is.** A fully automated phone agent that dials a list, speaks a scripted greeting, holds a live LLM conversation through a 4-step debt-relief script, transcribes the prospect in real time, and either transfers to a senior advisor or dispositions the call.

**How it works — 3-tier architecture** (documented in full in `src/AI_AGENT_AUDIT_REPORT.md`):
- **Transport:** an external WebSocket bridge (`render-ws-bridge/`) — Twilio Media Stream, Deepgram streaming STT, ElevenLabs/Aura TTS, playback queue, barge-in.
- **Business logic:** `mediaStreamRelay` — config/lead loading, LLM inference, transfer execution, transcript persistence, disposition.
- **Call control:** `aiAgentDial` (outbound, E.164 validation, **8am–8pm local-time call-hours enforcement**, status callbacks) and `dialerVoiceHandler` (TwiML).
- `bridgeKeepalive` + the *Bridge Keepalive* workflow keep the bridge warm; `aiAgentPipeline` batches; `aiAgentRespond` handles individual turns.

**Real-world use.** Overnight capacity on the same supply the humans work in the day — calls attempted, qualified or dispositioned, and transferred warm to the human floor, with every call recorded in `AICreditUsage` for exact cost accounting.

**Entities:** `AIAgentConfig`, `AIAgentScript`, `AIAgentConfig` variants, `FronterLead`, `FronterCallTranscript`, `InboundCallAudio`, `InboundAudioCache` (audio caching so repeat greetings aren't re-synthesised — a direct cost saving).

---

### A6. Live Q&A / in-call AI coach (documented in depth)

**What it is.** The "❓ Q&A" tab that answers a prospect's question **during the call**: it listens to the live transcript, detects questions automatically, answers from the approved knowledge base first, falls back to an LLM grounded in the top KB matches, and star-saves good answers into a reusable library.

**How it works** (full audit: `LIVE_QA_AUDIT_REPORT.md`): KB direct hit → cheap gating classifier (short acknowledgement = zero tokens) → top-5 KB retrieval → cached Haiku call → answer rendered with *More Info / Talking Points / Research / ★ Common* actions. Every Q&A persists per lead in `DebtQAHistory`; `processTranscriptLearning` mines finished transcripts for new Q&A into a **human review queue** (`HistoricalQAExample`) — so the knowledge base grows from real calls without letting unreviewed AI text into production.

**Entities:** `KnowledgeBase`, `DebtQAHistory`, `HistoricalQAExample`, `Objection`, `FronterKnowledgeBase`.

---

### A7. BOB — the training agent

**What it is.** An internal training/role-play agent (`BobSession`, `BobTranscript`, `BobTrainingLog`, `BobCallback`) that runs the script knowledge base and drills agents, with callback scheduling. Sessions are auto-purged by the *Cleanup Expired BOB Sessions* workflow; scripts are synced to BOB by the *Sync Scripts for BOB* workflow via `getScriptsForBob`, and script edits are versioned by `backupScripts` (nightly).

**Note (carried):** the transcript entities used by BOB are the largest single storage pressure in the app (long sessions have historically hit field-size limits). See Part F.

---

### A8. Inbound AI & Voicemail

**What it is.** The inbound side: `voicemailWebhook` (292 lines) records and dispositions voicemail; `appointmentVoiceHandler` handles inbound/appointment calls; `inboundGreeting` and region detection (`riverside`, `san_bernardino`, `honolulu`, `fallback`) route inbound calls to the right queue; `testInboundCall` is a diagnostic. `DialerSession` + `FronterActivityLog` track presence so inbound routing knows who is actually on shift.

---

### A9. Email Engine (four senders, one tracking spine)

**What it is.** Every outbound email path in the business, with **universal open/click/qualify-visit tracking** and a legal footer.

**Sending lanes.**
| Lane | Function(s) | Used for |
|---|---|---|
| **SMTPfast** | `sendDebtEmail`, `sendFronterMarketingEmail`, `smtpfastSender.ts` | All outreach and marketing; template images hosted publicly; `data-smtpfast-track=off` on sensitive qualification links so tokens never leak into provider logs |
| **Gmail (connected account)** | `sendGmailEmail`, `gmailSend.ts`, `sendFronterCredsEmail`, `sendPortalAccessEmail` | Credentials, portal access, welcome messages — intentionally isolated from marketing |
| **Platform SendEmail** | `sendTemplateTest`, invitation/receipt paths | Transactional, app-branded |
| **Mailjet** | `rateDropMailjetTemplate`, `mailjetWebhook`, `registerMailjetWebhook`, `debtMarketing*` | Rate-drop / legacy marketing path (see Part F — historically unreliable, superseded by SMTPfast) |

**Tracking spine.** `emailTrackOpen` (pixel) + `emailTrackClick` (link) → `processEmailTrackingEvent` → `EmailTrackingEvent` / `EmailMessage` / `EmailLog` → engagement scoring (`engagement.ts`, `scoringConfig.ts`) → `EngagementHotLead`, surfaced in the **Email Engagement console** with click-through down to the individual lead. Bot-filtering ignores activity in the first N seconds (mail-preview crawlers); scoring weights per email family are admin-configurable.

**Campaign engine.** `emailCampaignImport` (CSV → `EmailCampaignRecipient` with column mapping, dedupe, unsubscribe and match-to-existing-card), `emailCampaignSend` (batched queue: batch size, interval, daily limit, sending window, timezone), `runEmailCampaigns` (the cron runner), `emailCampaignImport`/`EmailCampaignJob` state machine, `debtMarketingRun`/`Report`/`Track` (Debt Call Coach marketing sequences + nightly report workflow).

**The Rate Drop Mailer Engine.** `rateDropGenerateMailer` renders the notice, `rateDropCampaignRun` schedules it (all-at-once / stagger / repetitive with a daily window), `RateDropCampaign` / `RateDropMailer` / `RateDropTemplate` / `RateDropSend` keep the state, and the *Rate Drop Mailer Engine* workflow is the tick.

**Compliance built into send.** `emailOptIn`, `unsubscribeEmail`, `EmailOptInPage`, `/optin`, `/email-optin`, suppression honoured at send time; every commercial template carries the fixed mailing address and an unsubscribe link (Fronter marketing templates deliberately excluded from those two by configuration).

---

### A10. SMS System (full duplex)

**What it is.** A complete two-way SMS channel: opt-in capture (`smsOptIn`, `SmsOptIn`, `/optin`, screenshot flow for proof of consent), outbound sends (`sendSms` via Twilio), inbound delivery and threading (`smsWebhook` → `SmsMessage`), and a **live conversation UI** (`SmsConversationsPanel`, `SmsTab`, `IncomingSmsPopup`, `SmsIncomingPopup`, `SmsMediaPicker` for MMS). Inbound SMS pops on screen for the agent working the lead, and the thread is attached to the contact card.

**Real-world use.** Consent-first outreach on the channel consumers actually answer, with the proof-of-consent screenshot flow preserved for audit.

---

### A11. Compliance Oversight

**What it is.** A dedicated compliance portal plus an AI scanning engine, not a checkbox.

- `complianceEngine` (218 lines) scans calls/transcripts against a compliance knowledge base and raises findings; `complianceAdmin` (426 lines) manages the record.
- Full case machinery: `ComplianceIssue` → `ComplianceRecord` → `ComplianceNote` → `ComplianceRemedy`, with sensitivity thresholds in `ComplianceSettings` and a dedicated `ComplianceKnowledgeBase`.
- Role model in `complianceRoles.ts`; portal route `/compliance-portal` (super_manager / admin).
- Upstream data protection: the DNC/litigator scrub (A1), call-hours enforcement (A5), Twilio signature verification (`verifyTwilioSignature.ts`), consent records (`SmsOptIn`, `EmailOptIn`), and opt-in visibility controls the super admin can switch off platform-wide.

**Real-world use.** A TCPA/DNC posture that is *evidenced in the database* — who consented, when, on which channel, and every finding plus its remedy with an owner.

---

### A12. HR, Hiring & Training

**What it is.** The people-side of the operation, inside the same platform:
- **Hiring** — `/interviews`: `InterviewPage`, `InterviewAssistant`, `InterviewAudioRecorder` (record + transcribe + AI-assisted scoring), stored in `Interview`.
- **Training** — `/training`: `TrainingPage` + `scheduleTraining` + `TrainingAttendee` attendance tracking; BOB role-play (A7) as the practice loop.
- **Workforce management** — `FronterTimeEntry` (clock in/out, breaks, worked seconds), `FronterPerformanceReport` / `FronterDailyReport`, `fronterPerformanceAudit` (AI QA of calls), `/work-report` submission page, `FronterAgreement` and `FronterPaymentInfo`.
- **Assistant line** — `/assistant-portal`: calendar contact card, appointments, fast-dial, scripts (`SuperAdminConfig.assistantScriptTabsJson`).

**Real-world use.** Interview → train → certify → measure, with the AI doing first-pass QA on calls so a manager reviews exceptions rather than listening to everything.

---

### A13. Investor Portal — 506(c) Private Placement + Analytics + E-Signature

**What it is.** A gated investor experience that **knows how the documents are actually read**, and can get an investment signed immediately.

- **The deal room** — `/portal` (InvestorPortal), `/offering` (the Confidential Private Placement Memorandum), `/DirectD`, `/MarketData`, press releases, investor updates.
- **Read analytics** — each investor session records **pages viewed, documents viewed (per document), downloads and time on site** (`AnalyticsSession`, `SiteVisit`, and the `docViews` structure read by `InvestorAnalyticsTab`). The admin side classifies the document set (PPM / subscription agreement / accreditation questionnaire / operating agreement) and shows who has read what, how deep, how long, per session and in aggregate, with `RecentInvestorEvents` for the live feed.
- **Access control** — `RequestAccess` → `dataRoomAccessRequest` → approved portal users (`InvestorUser`, `deleteProspectPortalUsers`, `clearProspectPortalCreds`, `resetPortalPasswords`), validated access codes (`validateAccessCode`).
- **E-signature** — `src/lib/signnow.js` + `signnowProxy` (197 lines, CORS-safe server proxy): token → create document from template → send signature invite → poll status. Signing is triggered from the portal and from the contact cards. `SignNowRequest` and `DocusignRequest` hold the requests; `AccreditationDocument` holds verification artefacts.
- **506(c) verification** — the PPM text itself documents the reasonable-verification standard (income verification, third-party CPA/attorney/broker-dealer confirmation), and the portal is where those documents are collected.

**Real-world use.** Instead of "we sent the deck", the operator can say *which* investor opened the PPM, which pages, how long they spent, whether they pulled the subscription agreement, and then send the signature request in the same session. That is the difference between a mailing list and a pipeline.

---

### A14. Private-Placement Management (the NB Tech 506(c) engagement)

**What it is.** A live offering run end-to-end on this platform, not a mock-up. The codebase contains the **NB Tech Acquisitions Corp.** offering machinery:
- **Offering terms as structured, AI-answerable knowledge** (`NBTechKBImporter`) — common stock at **$0.16/share**, maximum offering **$10,000,000 (62,500,000 shares)**, minimum offering **$100,000**, minimum individual investment **$25,000**, maximum per investor **$500,000**, shares issued/outstanding and authorised, best-efforts non-underwritten, Nevada corporation.
- **The corporate event** — NB Tech acquiring **Nightowl SP, LLC** into NewCo (**NGMC**) with a **21:1 conversion ratio** and a **Nasdaq Capital Market** listing objective; the KB also carries the S-1 roadmap week by week, and correctly frames all of it as subject to completion, regulatory approval and S-1 effectiveness. **That is the "major company" engagement: the platform is running the raise, the investor experience, the answering machine and the signature flow for it.**
- **Distribution** — `setNbTechLeads` + the *Auto-Tag NB Tech Leads* workflow tag the recipient universe; the *NB Tech Campaign Runner* workflow sequences the mail; `sendNbtechEmail` / `NBTechKBImporter` provide the mail body and the answer base; `fixNbTechLeadTypes` repairs classification.
- **Marketing surfaces** — `/investor-page` (public), `/DirectD`, `/growth-plan` (120-day plan), `MarketData`, `PressRelease`, `InvestorUpdate`.

**Real-world use.** A prospective investor receives a campaign email, lands on the offering page, reads the PPM (tracked), asks Rosie about the conversion ratio on video (answered from the structured KB, not improvised), and signs — with the whole path attributed to one lead record.

> **Honest flag:** I found **no solar-permit scraper** in this repository. The scraper that exists is `scrapeSocialLeads` (distress-signal text/social sources, 4× daily). If the solar-permit scraper runs outside this app (external service, script on another host, or a provider dashboard), it is not documented here — give me the name/host and I will fold it into this document.

---

### A15. Appointments, Calendar & No-Missed-Meetings

**What it is.** The booking and reminder machine that protects set appointments.
- `autoScheduleAppointment` (243 lines) → Google Calendar event (via the authorized connector, `googleCalendarHelpers.ts`, `saveCalendarAppointment.ts`), with the event id/link stored on the lead, `confirmAppointment`, `requestApptChange` and the **public tokenised reschedule page** (`/reschedule`, `bookReschedule`).
- **Reminders** — `sendAppointmentReminders` (night-before and 1-hour-before, using the two designed email templates), `EmailCampaignJob`-style sequencing, and open/click of those reminders tracked back onto the lead (`apptEmailOpenedAt`, `apptBbbClickedAt`, `apptTrustpilotClickedAt`).
- `noMissedMeetings` + the *Appointment Reminders* workflow, `sendMissedApptReschedule` for recovery, `scheduleFronterMeeting` + *Fronter Meeting Reminders* for internal meetings.
- `connectorKeepalive` exists specifically to stop the Google connector going stale — an operational lesson encoded as a scheduled job.

**Design note worth keeping:** the reminder emails use the platform's designed templates (`AppointmentReminderNightBefore.html`, `AppointmentReminderHourBefore.html`) on the app's own brand tokens, so the client sees the same identity as the site.

---

### A16. Analytics, Cost Control & Self-Measurement

- **AI cost** — `AICreditUsage` (one row per AI call: provider, call type, tokens, cost) → `aiCostReport` → `AICostReport` (nightly, per day, per-call breakdown), driven by the *Nightly AI Cost Report* workflow. Model spend is attributable to systems, not just totalled.
- **Engagement** — `engagementReport` (542 lines) + `engagement.ts` + `ScoringConfig` (admin-editable thresholds: hot / engaged / warming / migration-start, weights per email family, pattern bonuses) → `EngagementHotLead` (permanent hot-lead history: first hot, last hot, sessions, peak score, reason, worked-by).
- **Prospect tracking** — `EmailEngagementPage`, `InvestorAnalyticsTab`, `AnalyticsSession`, `SiteVisit`, `logSiteVisit`, `RosieChatLog`, `DebugLog`.
- **Cross-system reporting** — `generateManagerReport`, `fronterPerformanceAudit`, `debtMarketingReport`, `FronterDailyReport`.
- **Google Sheets sync** — `syncToSheets` / `syncLeadToSheets` / `syncInvestorToSheets` / `fetchInvestorsPage` with three scheduled workflows: the operator's reporting habit (Sheets) stays current without manual export.

---

### A17. Super Admin Command Center & Portals

- **Super Admin** (`/superadmin-portal`) — the single source of truth for live configuration: `SuperAdminConfig` (transfer/rebook/merge scripts, assistant script tabs, transfer numbers and labels, fast-dial numbers, opt-in visibility, notice-ID sequence, **plan and credit snapshots**), plus line status (`AssistantLineStatus`, `FronterLineAssignment`) and closing numbers.
- **Admin dashboard** (`/admin`) — the platform-authenticated side: call logs, investor analytics, contact cards, KB manager, SMS conversations, BOB, scripts, AI agent config, credit/cost tabs.
- **Manager portal** (`/manager-portal`) — team performance, live call control, call review, reports.
- **Assistant portal** (`/assistant-portal`) — calendar contact card with transfer/rebook/merge scripts and fast dial.
- **Automations & Scoring** (`/automations`) — the admin-controlled layer over every automation and scoring threshold (`automationOverview`, `ScoringConfig`), so behaviour is changed without a code deploy.
- **Compliance portal** (`/compliance-portal`) — A11.
- **AI command console (⌘A)** — `appSystemMap.ts` (392 lines): the app's own AI agent is given a map of every route, tab, role, entity and function, plus the rules for how it may act. This is the platform documenting itself to its own agent.

---

### A18. Authentication, Roles & Access

- **Platform auth** — Base44 login for the app-admin surfaces (`/admin`, `/portal`), with role-based RLS on the sensitive entities (admin-only by default on configs, hot-lead history, image assets).
- **Portal auth (independent, session-based)** — `debtCoachAuth` (275 lines): password login, **voice login**, and **voice enrolment**, with `hashPassword`, session tokens, `mustResetPassword`, and a **cumulative role hierarchy** (`dialer` ⊂ `manager` ⊂ `super_manager` ⊂ `admin` ⊂ `super_admin`) exposed as `isDialer / isManager / isSuperManager / isAdmin / isSuperAdmin` — every higher role inherits all lower rights, so permissions never have to be listed twice.
- **Gate pattern:** portal-admin screens call admin-checked backend functions (`automationOverview`, `protofaceAdmin`, `complianceAdmin`) rather than reading admin-only tables directly — one gate, one audit path.

---

### A19. Public Site & Lead Capture

`/` home with the **qualification chat widget** (`homeQualifyChat`, 934 lines: greeting → debt slider → live AI qualification → call offer) bound to `HomeChatConfig`, `/optin`, `/email-optin`, `/aboutdebt`, `/request-access`, `/reschedule`, `/privacy`, `/terms`, `/stories/:slug`, `/investor-page`, `/log`, `/work-report`, `/growth-plan`, `/credit` (credit-report upload → `analyzeCreditReport` → `creditReportPhotoUri` on the lead).

---

### A20. Integrations & Credentials (current state)

| Service | Used for | Credential present? |
|---|---|---|
| **Twilio** | dialing, media streams, SMS, lines 1–6 | ✅ account SID + auth token + API key/secret + from-numbers + TwiML app SID |
| **Deepgram** | streaming STT, Aura TTS fallback | ✅ 2 keys |
| **ElevenLabs** | primary TTS, voice list, clips | ✅ |
| **Vapi** | voice agent transport | ✅ private/public key + webhook secret |
| **LiveKit** | video/audio rooms for the avatar | ✅ url + key + secret |
| **Render WS bridge** | Twilio↔Deepgram↔TTS transport | ✅ bridge URL + auth tokens |
| **Anthropic** | the LLM brain across the app | ✅ api key + workspace id |
| **SMTPfast** | outreach/marketing sending | ✅ api key + from name/email · ⚠️ **no webhook secret configured** (so the tracking callback is not authenticated — Part F) |
| **Mailjet** | legacy/rate-drop path | ⚠️ keys present; project history records 401 failures on both accounts — SMTPfast is the live sender |
| **Gmail (connector)** | credentials, welcome, reply reconciliation | ✅ authorized: `gmail.send`, `gmail.readonly`, `gmail.modify` |
| **Google Calendar (connector)** | appointments | ✅ authorized (+ workspace connector "Business Google Calendar", id `6a4ad0ffa4094927b7d35634`) |
| **Google Sheets** | reporting sync | via connector |
| **SignNow / DocuSign** | investment signature flow | ⚠️ credentials are passed at call time from the app (not platform secrets) — see Part F |
| **Tracerfy** | phone append | ✅ |
| **LandlineRemover** | DNC/litigator scrub | ✅ |
| **Phone lookup providers 1–3** | carrier/line validation | ✅ (metred in `PhoneValidationUsage`) |
| **Apify** | scraping | ✅ |

---

## PART B — COMPLETE FUNCTION INVENTORY (138 / 138)

`UI` = called from a screen · `AUTO` = called by another function or a workflow · `ENDPOINT` = inbound endpoint for an external provider · `MANUAL` = no caller in code · `✓` = has a header documentation block.

### B1. Telephony & dialing (13)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `twilioCall` | Place an outbound call from a chosen line | UI | – |
| `twilioCallWithCPA` | Outbound call with call-purpose analysis | UI | ✓ |
| `twilioCallCallback` | Dial back a callback | AUTO | ✓ |
| `twilioCallLogs` | Fetch Twilio call logs (read-only) | UI | – |
| `twilioGetLines` | List the app's Twilio numbers (read-only) | UI | ✓ |
| `twilioClientToken` | Browser dialer token (Twilio Voice SDK) | UI | – |
| `twilioClientToken2` | Second dialer token (fronter side) | AUTO | – |
| `fronterClientToken` | Fronter browser dialer token | UI | ✓ |
| `managerCallControl` | Manager live-call control (listen / take over) | UI | – |
| `dialerVoiceHandler` | TwiML webhook: AI agent connect, transfer, inbound | ENDPOINT | ✓ |
| `appointmentVoiceHandler` | TwiML webhook for appointment / inbound calls | ENDPOINT | ✓ |
| `voicemailWebhook` | Voicemail recording + disposition | ENDPOINT | ✓ |
| `testInboundCall` | Diagnostic inbound test call | UI | ✓ |

### B2. AI Voice Agent "Alex" (5)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `aiAgentDial` | Outbound AI dialer: validate, call-hours check, place call | UI | ✓ |
| `aiAgentRespond` | Single AI voice turn (LLM response for the call) | AUTO | ✓ |
| `aiAgentPipeline` | Batch/pipeline driving of AI calls | UI | – |
| `mediaStreamRelay` | Media-stream business logic: init, turn, transfer, end | ENDPOINT | ✓ |
| `bridgeKeepalive` | Ping the voice bridge so it stays warm | AUTO | ✓ |

### B3. Live AI coach, extraction & reporting (16)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `liveAssistantAI` | The in-call brain: coach, Q&A, intent, profile, hardship, cosigner, credit, budget; logs exact token cost | UI | – |
| `liveAssistantResearch` | Pre-call research on the lead's area/business | UI | – |
| `aiInputSummary` | Summarise dialer input | UI | ✓ |
| `aiContactFiller` | Fill contact fields from what was said | UI | ✓ |
| `aiTunerChat` | Script-tuning chat | UI | ✓ |
| `aiScriptBuilder` | AI script authoring | UI | ✓ |
| `processTranscriptLearning` | Mine transcripts for new Q&A into the review queue | UI | ✓ |
| `consolidateTranscript` | Consolidate transcript chunks | AUTO | ✓ |
| `generateManagerReport` | AI manager report | UI | – |
| `screenDebtFit` | Screen a lead for debt-fit | UI | ✓ |
| `analyzeCreditReport` | Analyse an uploaded credit report | UI | – |
| `analyzeRosieSession` | Write the Rosie video-session analysis onto the lead | UI | ✓ |
| `aiInviteLinks` | Mint AI invitation links | UI | ✓ |
| `aiCostReport` | Build the nightly exact AI cost report | UI | – |
| `aiScheduleAgent` | AI appointment scheduling | AUTO | ✓ |
| `appAgent` | App-wide AI command console entry | UI | – |

### B4. Rosie / video qualification & speech (10)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `stephaniAgent` | The agent loop + turn handling for the video agent | UI | ✓ |
| `vapiQualify` | Open a video qualification session | UI | ✓ |
| `vapiWebhook` | Receive Vapi conversation events | ENDPOINT | ✓ |
| `vapiBridgeTwiml` | TwiML bridging a qualified Vapi call to a rep | AUTO | ✓ |
| `protofaceAdmin` | Admin-gated read/save of the video qualification settings | UI | ✓ |
| `deepgramToken` | Streaming STT token (coach side) | UI | ✓ |
| `deepgramToken2` | Streaming STT token (second lane) | UI | ✓ |
| `transcribeAudioLarge` | Transcribe a large audio file | UI | ✓ |
| `listElevenLabsVoices` | List available voices | UI | ✓ |
| `elevenLabsClip` | Generate a short speech clip | UI | ✓ |

### B5. Knowledge base (8)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `kbChatIngest` | Ingest a chat/KB document | UI | ✓ |
| `kbExtractFile` | Extract KB content from an uploaded file | UI | ✓ |
| `kbScrapeUrl` | Scrape a URL into the KB | UI | – |
| `generateKBVariations` | Generate answer variations | UI | – |
| `syncDebtKB` | Sync the Debt Call Coach KB (scheduled) | AUTO | ✓ |
| `syncObjectionsToKB` | Sync objection handling into the KB (scheduled) | AUTO | ✓ |
| `getScriptsForBob` | Fetch scripts for BOB (read-only) | AUTO | ✓ |
| `smartLeadsChat` | Smart-leads assistant chat | UI | ✓ |

### B6. Lead intelligence & floor QA (3)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `leadCrossEnrich` | Cross-enrich a lead across systems | UI | ✓ |
| `resolveLeadIdentity` | Match/dedupe lead identity | AUTO | ✓ |
| `fronterPerformanceAudit` | AI QA of fronter calls | UI | ✓ |

### B7. Email, campaigns & engagement (32)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `sendCustomEmail` | Ad-hoc email from a card | UI | – |
| `sendDebtEmail` | Debt Call Coach template send (SMTPfast) | UI | ✓ |
| `sendLeadEmail` | Send to a lead | UI | – |
| `sendGmailEmail` | Send via the connected Gmail account | AUTO | – |
| `sendIntroEmail` | Intro/outreach email | UI | ✓ |
| `sendNbtechEmail` | NB Tech campaign email | UI | ✓ |
| `sendFronterCredsEmail` | Fronter credentials email | UI | ✓ |
| `sendFronterMarketingEmail` | Fronter marketing send | UI | – |
| `sendPortalAccessEmail` | Portal access/credentials send | UI | – |
| `sendTemplateTest` | Send a test copy of a template | UI | ✓ |
| `sendMissedApptReschedule` | Missed-appointment reschedule send | UI | ✓ |
| `sendAppointmentReminders` | Night-before / 1-hour reminder cadence | AUTO | ✓ |
| `sendFronterMeetingReminders` | Fronter meeting reminders | AUTO | ✓ |
| `runEmailCampaigns` | Campaign queue runner (cron) | AUTO | ✓ |
| `postScheduledQuotes` | Post scheduled quotes | AUTO | ✓ |
| `emailCampaignImport` | CSV → recipients with mapping, dedupe, suppression | UI | ✓ |
| `emailCampaignSend` | Batched campaign sending (limits, window, timezone) | UI | ✓ |
| `emailTrackOpen` | Open pixel endpoint | ENDPOINT | – |
| `emailTrackClick` | Click-tracking link endpoint | ENDPOINT | – |
| `processEmailTrackingEvent` | Turn tracking hits into events + score | AUTO | ✓ |
| `unsubscribeEmail` | Public unsubscribe endpoint | ENDPOINT | ✓ |
| `emailOptIn` | Email opt-in capture | UI | ✓ |
| `debtMarketingRun` | Debt Call Coach marketing sequence runner | AUTO | ✓ |
| `debtMarketingReport` | Nightly marketing report | UI | ✓ |
| `debtMarketingTrack` | Marketing send tracking | AUTO | ✓ |
| `rateDropCampaignRun` | Rate Drop scheduler tick | AUTO | ✓ |
| `rateDropGenerateMailer` | Render a Rate Drop notice | UI | ✓ |
| `rateDropMailjetTemplate` | Build the Mailjet template (legacy path) | MANUAL | ✓ |
| `mailjetWebhook` | Mailjet event webhook | ENDPOINT | – |
| `registerMailjetWebhook` | Register the Mailjet webhook | AUTO | – |
| `smtpfastWebhook` | SMTPfast tracking webhook | ENDPOINT | ✓ |
| `engagementReport` | Engagement scoring + hot-lead report | UI | ✓ |

### B8. SMS (3)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `sendSms` | Send SMS via Twilio | AUTO | – |
| `smsOptIn` | SMS opt-in capture | UI | – |
| `smsWebhook` | Inbound SMS webhook → thread | ENDPOINT | – |

### B9. Vault, validation & data operations (15)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `scrapeSocialLeads` | Scrape distress-signal leads from social/text sources | UI | ✓ |
| `tracerfyBatch` | Tracerfy phone-append batch | UI | ✓ |
| `validateVaultPhones` | Carrier/line validation with key rotation | UI | ✓ |
| `dncScrubVault` | DNC + litigator scrub (LandlineRemover) | UI | ✓ |
| `distributeVaultLeads` | Distribute to fronters / AI dialer + stamp Protoface ID | UI | ✓ |
| `assignNoticeId` | Issue the next notice ID from the sequence | UI | ✓ |
| `revertConvertedToProspect` | Move a lead back to prospect | AUTO | – |
| `cleanupDeletedLeads` | Purge soft-deleted leads after 7 days | AUTO | ✓ |
| `fixNbTechLeadTypes` | Repair NB Tech lead classification | AUTO | – |
| `setNbTechLeads` | Tag the NB Tech recipient universe | AUTO | – |
| `fixInvestorPhones` | Repair investor phone formats | AUTO | – |
| `clearJarvisSturdivant` | One-off data cleanup | AUTO | – |
| `clearJimmyJohnAccess` | One-off access cleanup | AUTO | – |
| `searchJoeParsons` | One-off lookup | AUTO | – |
| `testOmkarTwitter` | Provider diagnostic | AUTO | ✓ |

### B10. Coach core (fronter workspace + call outcomes) (3)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `fronterCall` | Fronter call control and lifecycle | UI | ✓ |
| `saveCallOutcome` | Atomic single write of a call outcome | UI | ✓ |
| `debtConfirm` | Booking/disposition confirmation on a card | UI | ✓ |

### B11. Appointments & calendar (10)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `googleCalendarSync` | Sync appointments to Google Calendar | UI | – |
| `listCalendarEvents` | Read calendar events | UI | ✓ |
| `connectorKeepalive` | Keep the Google connector from going stale | AUTO | – |
| `autoScheduleAppointment` | Create the calendar event for a set appointment | UI | ✓ |
| `confirmAppointment` | Client confirms an appointment | UI | ✓ |
| `requestApptChange` | Client requests a change | AUTO | ✓ |
| `bookReschedule` | Public tokenised reschedule | UI | ✓ |
| `scheduleFronterMeeting` | Book an internal fronter meeting | UI | ✓ |
| `scheduleTraining` | Schedule a training session | UI | – |
| `noMissedMeetings` | No-missed-meeting safeguard | UI | ✓ |

### B12. Investor portal, 506(c) & signature (12)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `dataRoomAccessRequest` | Validate + record a data-room access request | AUTO | ✓ |
| `signnowProxy` | SignNow API proxy (token, create from template, invite, status) | UI | – |
| `validateAccessCode` | Validate a portal access code | AUTO | ✓ |
| `portalLogin` | Investor portal login | UI | – |
| `resetPortalPasswords` | Reset portal passwords | AUTO | – |
| `deleteProspectPortalUsers` | Remove prospect portal users | AUTO | – |
| `clearProspectPortalCreds` | Clear stranded portal credentials | AUTO | – |
| `syncInvestorToSheets` | Sync investors to Google Sheets | AUTO | – |
| `fetchInvestorsPage` | Fetch the investor sheet page | AUTO | – |
| `syncToSheets` | General Sheets sync | AUTO | – |
| `syncLeadToSheets` | Sync leads to Google Sheets | AUTO | – |
| `logSiteVisit` | Log a site visit | AUTO | – |

### B13. Auth, scripts & maintenance (4)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `debtCoachAuth` | Portal login / voice login / enrol / session / password | UI | – |
| `hashPassword` | Password hashing | UI | – |
| `backupScripts` | Nightly script backup | AUTO | – |
| `cleanupBobSessions` | Purge expired BOB sessions | AUTO | ✓ |

### B14. Compliance & automation control (3)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `complianceEngine` | Scan calls/transcripts against compliance rules | UI | – |
| `complianceAdmin` | Compliance case management | UI | – |
| `automationOverview` | Admin-gated overview + save of automations/scoring | UI | ✓ |

### B15. Public lead capture (1)

| Function | What it does | Wired | Docs |
|---|---|---|---|
| `homeQualifyChat` | Home-page qualification chat (greeting → slider → qualify → call offer) | UI | ✓ |

**Totals:** 138 functions — **81 called from a screen**, **45 called by another function or workflow**, **11 inbound provider endpoints**, **1 manually invoked**; **87 carry an in-code header document**; **51 do not**.

---

## PART C — ENTITY INDEX (120)

**Identity & sales** `DebtLead`, `DebtLeadActivity`, `LeadMemory`, `CustomerInsight`, `DebtIntentSnapshot`, `DebtQAHistory`, `DebtCoachTip`, `DebtUserProfile`, `FronterLead`, `FronterQuote`, `FronterMeeting`, `FronterHeadsUp`, `FronterAgreement`, `FronterPaymentInfo`, `LeadVaultEntry`, `ScrapedLead`, `CreditorListEntry`, `ContactList`, `LeadHistory`, `Lead`, `ContactNote`.

**Calls & transcripts** `DebtCallTranscript`, `FronterCallTranscript`, `FronterCallReport`, `FronterCallComment`, `CallLog`, `CallStatus`, `InboundCallAudio`, `InboundAudioCache`, `HotCallAlert`, `HotCallSettings`, `BobSession`, `BobTranscript`, `BobTrainingLog`, `BobCallback`.

**AI & knowledge** `AIAgentConfig`, `AIAgentScript`, `KnowledgeBase`, `KnowledgeBaseConfig`, `FronterKnowledgeBase`, `HistoricalQAExample`, `Objection`, `SmartLeadConfig`, `SmartLeadFeedback`, `VideoQualifyConfig`, `VideoQualifySession`, `AICreditUsage`, `AICostReport`, `ScoringConfig`, `AutomationCenter` config (`ScoringConfig`), `ProtoFace` config (`VideoQualifyConfig`).

**Email & messaging** `DebtEmailTemplate`, `FronterEmailTemplate`, `EmailCampaignTemplate`, `EmailCampaign`, `EmailCampaignJob`, `EmailCampaignRecipient`, `EmailMessage`, `EmailLog`, `EmailTrackingEvent`, `EmailOptIn`, `EmailImageAsset`, `SmsMessage`, `SmsOptIn`, `AnalyticsSession`, `SiteVisit`, `PressRelease`, `InvestorUpdate`.

**Investor / 506(c)** `InvestorUser`, `SignNowRequest`, `DocusignRequest`, `AccreditationDocument`, `Appointment`.

**People, ops & portals** `DebtCoachUser`, `DebtCoachUserSetting`, `FronterScript`, `FronterActivityLog`, `FronterTimeEntry`, `FronterPerformanceReport`, `FronterDailyReport`, `FronterChatMessage`, `FronterLineAssignment`, `FronterHoldAudio`, `FronterPopupMessage`, `FronterKnowledgeBase`, `FronterEmergencyScript`, `Interview`, `TrainingAttendee`, `AssistantTask`, `AssistantLineStatus`, `DialerSession`, `SavedLayout`, `DebugLog`, `PortalSettings`, `SuperAdminConfig`, `ManagerComment`, `RatingConfig` family (`ScoringConfig`), `HomeChatConfig`, `HomeChatSession`, `HomeChatMessage`, `RosieChatLog`, `AdminChat`, `Script`, `GlobalScript`, `ScriptBackup`, `DebtScript`, `ClosingScriptConfig`, `ClosingPhoneNumber`, `ComplianceSettings`, `ComplianceNote`, `ComplianceRecord`, `ComplianceRemedy`, `ComplianceKnowledgeBase`, `ComplianceIssue`, `PhoneValidationUsage`, `RateDropCampaign`, `RateDropMailer`, `RateDropTemplate`, `RateDropSend`, `DebtMarketingCampaign`, `DebtMarketingSend`, `DebtMarketingReport`, `EngagementHotLead`, `FronterKnowledgeBase`.

Every entity is a typed schema (field types, enums, titles, descriptions); the 120 schemas are themselves the data dictionary.

---

## PART D — WORKFLOWS (23), SHARED MODULES (42), ROUTES (37)

### Scheduled / automated workflows
Appointment Reminders · Auto-Tag NB Tech Leads · Bridge Keepalive · Cleanup Expired BOB Sessions · Cleanup Soft-Deleted Leads · Connector Keepalive · Debt Coach Marketing Engine · Debt Coach Marketing Nightly Report · Email Follow-Up Automation · Fronter Meeting Reminders · Fronter Performance Audits · Fronter Quote Broadcaster · NB Tech Campaign Runner · Nightly AI Cost Report · Nightly Script Backup · Rate Drop Mailer Engine · Scrape Social Leads 4x Daily · Sync Debt KB · Sync Investors to Google Sheets · Sync Leads to Google Sheets · Sync Objections to KB · Sync Scripts for BOB.

### Shared backend modules (single source of truth — 42)
AI (11): `aiAgentHelpers`, `aiAgentPipeline`, `aiCost`, `aiVoiceMap`, `llmHelper`, `transcriptAnalysis`, `kbSearch`, `engagement`, `scoringConfig`, `complianceRoles`, `callCutoffOverride`.
Email & messaging (10): `emailMessageEngine`, `emailTracking`, `emailCampaign`, `emailSignature`, `gmailSend`, `smtpfastSender`, `debtEmailSender`, `debtMarketingEngage`, `debtMarketingRules`, `debtMarketingTracking`.
Telephony (6): `twilioHelpers`, `twilioVoiceParams`, `verifyTwilioSignature`, `phoneTimeZone`, `livekitToken`, `elevenLabsTts`.
Voice/agent (4): `videoQualify`, `inboundGreeting`, `protofaceId`, `appSystemMap`.
Business & data (8): `companyInfo`, `leadTemplate`, `mergeTags`, `noticeId`, `rateDropMailer`, `fronterMarketing`, `debtFieldCollections`, `queueFronterCustomer`.
Platform (3): `googleCalendarHelpers`, `saveCalendarAppointment`, `etTime`.

### Routes
Public/marketing: `/`, `/aboutdebt`, `/investor-page`, `/offering`, `/DirectD`, `/stories/:slug`, `/request-access`, `/optin`, `/optin/screenshot`, `/email-optin`, `/privacy`, `/terms`, `/reschedule`, `/log`, `/work-report`, `/growth-plan`, `/credit`.
Investor/portal: `/portal`, `/portal-login`, `/admin-login`.
Operations: `/debt-call-coach`, `/debt-call-coach-login`, `/fronter`, `/manager-portal`, `/compliance-portal`, `/assistant-portal`, `/superadmin-portal`, `/adminfrontpage`, `/interviews`, `/training`, `/email-engagement`, `/automations`, `/admin`, `/live-codebase-explorer`.

---

## PART E — DOCUMENTATION STATUS

| Asset | State | Gap |
|---|---|---|
| AI Voice Agent | ✅ deep audit report (`src/AI_AGENT_AUDIT_REPORT.md`, 1,201 lines: file inventory, architecture diagram, data flow, per-function contract) | snapshot-dated |
| Live Q&A tool | ✅ deep audit report (`LIVE_QA_AUDIT_REPORT.md`, 765 lines) | snapshot-dated |
| Platform map for the in-app AI console | ✅ `base44/shared/appSystemMap.ts` (routes, tabs, roles, entities, functions) | maintained as code, not as prose |
| Entity dictionary | ✅ 120 typed schemas with field titles/enums/descriptions | no generated ERD or field-level data dictionary document |
| Function-level docs | ✅ 87 / 138 carry header documentation blocks; ⚠️ **51 do not** | the 51 are listed in Part B (marked `–`) |
| Email/SMS/Investor/Compliance/Vault systems | ⚠️ no dedicated runbook | these are the four highest-value gaps for a technical reader |
| Integration & credentials register | ⚠️ documented here (A20) | no separate ops runbook for key rotation / expiry |
| Changelog / decision log | ❌ none found | project history lives in conversation context, not in the repo |
| API reference | ❌ none | functions are documented only where headers exist |

**Recommended next documents** (small, high value): (1) Email & SMS runbook (lanes, templates, tracking, suppression), (2) Investor/506(c) operations guide (access → analytics → signature → accreditation), (3) Vault pipeline SOP, (4) credentials & renewal register, (5) header blocks for the 51 undocumented functions.

---

## PART F — CARRIED OPEN ITEMS (from project history — **not re-verified in this audit**)

These are recorded so a technical reader sees them; several may already be resolved (the Gmail connector, for instance, now shows `send` + `readonly` + `modify` as authorized, and the ProtoFace settings load was repaired this session).

**Configuration / credentials:** SMTPfast webhook secret not set · SignNow credentials supplied at call time rather than as platform secrets · Mailjet accounts historically failing (401) — SMTPfast is the live lane.

**Fronter live-call path:** queued calls not appearing for pickup · call pickup · inbound call trigger · incoming-call audio alert · credentials-email button on the card · script popup auto-trigger · hot-lead checkmark on Migrate.

**Coach live-call path:** live-call AI field extraction auto-save to the contact card · customer-stats popup on live calls · recording playback in the admin calls tab · disposition labels/clickable names · lip-sync latency tuning on the video stage (voice delay is now configurable; residual latency is a tuning matter, not a defect).

**Storage:** large BOB session transcripts and 30+ minute call-training sessions have hit entity field-size limits (the reason `cleanupBobSessions` and the transcript consolidation exist).

**Reporting:** some leads filtered out of the global calendar by status codes · investor PDF page-number formatting · contact lists not surfaced under Marketing → Automate · Gmail reply reconciliation pending on read-access notification processing.

**Environment:** Twilio geo-permissions for non-US/Canada outbound · phone-validation key quota monitoring.

---

## Closing note on method

Every count, route, function name, wiring tag, entity name and credential statement in this document was read out of this repository on 2026-10-24. The status tags are **static evidence** (call sites, imports, secrets, connectors, workflow references) — they prove a function is wired into a live path, not that the path has been exercised end to end today. A live regression pass over the six revenue-critical flows (Fronter dial → transfer → Coach close → booking → reminder → bridge; inbound AI → queue; Vault batch → distribution; campaign → tracking → hot-lead; investor access → read analytics → signature; ProtoFace qualify → bridge) is the natural next step and can be run flow-by-flow on request.