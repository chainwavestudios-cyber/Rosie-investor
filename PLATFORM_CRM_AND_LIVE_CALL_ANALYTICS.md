# RosieAI / Debt Advisors of America — Platform Functionality & Benefits
## Part II — The CRM, every screen and tab, and the live-call analytics engine

**Document type:** functional dossier (Part II of the platform writeup set)
**Scope:** every screen, tab and panel in the app; the CRM record itself; and the live-call intelligence layer end to end
**Compiled:** 2026-10-24 · **Method:** direct read of the repository (routes, page shells, the tab registries, each module's components and the backend functions they call)
**Companion to:** `PLATFORM_TECHNICAL_WRITEUP.md` (Part I — systems A–Z, all 138 functions, 120 entities, 23 workflows) · `LIVE_QA_AUDIT_REPORT.md` (Live Q&A deep dive) · `src/AI_AGENT_AUDIT_REPORT.md` (AI Voice Agent deep dive)

**Why this part exists.** Part I describes the *systems*. It did not walk the **screens** — the CRM record, the tab-by-tab surfaces every user actually works in — and it did not open up the **live-call analytics** layer, which is the platform's most differentiated asset. This part does both.

**One correction to Part I:** the router holds **36** routes (35 screens plus the catch-all), not 37.

---

## PART G — THE CRM AND EVERY SCREEN, TAB BY TAB

### G1. The CRM test — where every standard CRM capability actually lives

Read this first. It answers "does it do normal CRM things?" — contact records, notes, activity, pipeline, calls, email history, SMS history, tasks, calendar, search, bulk actions, ownership, dedupe, audit, reporting — with the real screen or entity for each.

| CRM capability | Where it lives | What it does |
|---|---|---|
| Contact / lead records | `DebtLead` (coach) · `FronterLead` (fronter) · `LeadVaultEntry` (supply) · `ScrapedLead` | Separate record types per stage of the funnel, each keeping full provenance; a lead number / notice ID / Protoface ID identifies it |
| The record's main view | `ClientProfileModal` — **15 tabs** (G3) · `DebtLeadCard` (live-call card) · `LeadContactCard` (leads module) | The full client file, not a form: overview, debt, bills, insights, co-signers, hardship, Q&A, transcripts, email activity, Rosie AI, credit report, closing, calculator, AI populate |
| Notes | `LeadActivityTab` · `FronterNotesSection` + `FronterNoteAttachment` · `ContactNote` | Free-text notes with attachments, on both the coach and fronter cards |
| Activity timeline | `LeadActivityTab` · `LeadActivityFeed` · `FronterLead.notesLogJson` | One chronological thread: manual notes, call logs, AI intent synopsis, status changes, calendar events, transcripts, call reports |
| Call history | `CallsTab` · `CallLogPanel` · `FronterCallHistoryTab` · `CallLog` | Every call with outcome, duration, disposition, recording, transcript; dialers see their own, managers see all |
| Call outcomes / dispositions | `saveCallOutcome` (atomic write) · `FronterLead.lastCallResult` · `CallStatus` | Outcome + notes + report saved in one server-side write, so a dropped field can't lose the note |
| Email history | `EmailMessage` + `EmailActivityTimeline` · `ApptTrackingBadges` · `FronterEmailTrackingBadges` | Per-contact send log with opens, clicks, clicked URLs, replies/bounces, plus badges on the card (opened · BBB · Trustpilot · website · 1-hour reminder) |
| SMS history | `SmsConversationsPanel` · `IncomingSmsPopup` · `SmsMessage` / `SmsOptIn` | Full-duplex conversation threads with consent proof stored on the record |
| Pipeline / stages | `LeadPipeline` · `PipelineTab` · `ProspectPipeline` | Coach stages (new → contacted → qualified → enrolled / declined / callback / completed) and fronter stages (prospect → lead → transferred → booked → closed deal → migrated) |
| Tasks & reminders | `AssistantTask` · `AppointmentReminders` · `RemindersFloatingPanel` · `UpcomingReminders` · `Next3HoursWindow` | Assignable tasks and time-based reminders, plus a live "next 3 hours" window for the assistant desk |
| Calendar | `GlobalCalendar` · `AssistantCalendar` + Google Calendar sync | Events written to Google Calendar (appointments, follow-up calls, transfers) with tracking links back on the record |
| Search / filter / sort / paging | `LeadsTab` (server-side filtering) · every list view | Filtering, sorting, counts and pagination run as server queries, not in-page loops |
| Ownership & assignment | `assignedTo` / `assignedBy` / `assignedAt` · `debtCoachOwner` · `LeadAssignmentPopup` · `FronterLineAssignment` | Leads are assigned to a named rep or a queue; the rep gets a popup the moment a lead lands on them |
| Bulk operations & import | `FronterLeadImportModal` · `emailCampaignImport` (CSV → contact cards) · `distributeVaultLeads` (bulk distribution) · `syncToSheets` | CSV in, mapped, deduped, bulk-created; batches distributed across fronters or the AI dialer in one action |
| Saved views / layouts | `SavedLayout` · `LayoutSaveLoad` · `useCoachTabOrder` | Each user's tab order, and popped-out panel layouts, saved per user |
| Dedupe & merge | `FronterMergePopup` · `resolveLeadIdentity` · `leadCrossEnrich` · `EmailMessage.dedupeKey` | Identity resolution across systems, cross-enrichment, and a duplicate guard that blocks an accidental double send |
| Audit trail | `aiPopulateLogJson` · `notesLogJson` · `FronterActivityLog` · `ComplianceRecord` · `EmailTrackingEvent` · `DebugLog` | Field-level AI change logs, activity logs, compliance records, tracking events |
| Tags & flags | `isHotLead` + tagged-by/at · `animalType` · engagement tier badges · Protoface ID | Priority flags with who set them and when, plus AI-derived personality and engagement tiers |
| Reporting | `HotCallAnalytics` · `FronterCallMetricsTab` · `FronterReportsTab` · `DialerReports` · `ScoreCard` · `WorkReportPage` · AI Reports · Email Engagement console | Dialer, floor, manager and cost reporting — see Part H7 |
| Soft delete & restore | `deletedAt` / `deletedBy` + `cleanupDeletedLeads` | Deletion is staged and reversible for 7 days before permanent removal |
| Roles & access | `DebtCoachAuthContext` · portal logins · per-entity RLS | Role-gated tabs, portal-level auth, and row-level rules on the data itself |

### G2. Debt Call Coach — the 25-tab closer workspace (`/debt-call-coach`)

The tab registry is `src/lib/coachTabs.js`; the bar is two rows and **every tab can be dragged into any position or row**, saved per user in `SavedLayout`. Tabs are deep-linkable (`?tab=<id>`), and the ⌘A AI console can open an exact tab.

| Tab | Who sees it | What it is |
|---|---|---|
| 📞 **Live Call** | all | The live working window: debt contact card, AI panel, transcript, scripts, compliance widget, objection popup, appointment preview, end-call dialog |
| 📜 **Scripts** | all | Personal scripts, teleprompter-ready, with a Pitches sub-tab; pops out automatically during a live call |
| 🏁 **Closing** | all | The closing flow (`SmartClose`) — checklist-driven close, step progress saved across calls |
| 📋 **Calls** | all | Call history: own calls for dialers, every call for managers/admins, with recordings and transcripts |
| 📥 **New Leads** | all | Scraped leads assigned to the user, to be imported into profiles they own |
| 🔥 **Hot Leads** | all | Hot-lead list plus a calendar view of upcoming scheduled calls; opens the heat-map popout |
| 🤖 **BOB Training** | all | The duck-to-cow training simulator (Deepgram voice agent, open/close scenarios, objection catalog, mock credit report) |
| 📊 **Pipeline** | all | Pipeline board of deals and stages |
| 🎤 **Pitches** | all | Closer pitches organized by closer (MP3 file names become closer names) |
| 📧 **Emails** | all | Email template management for the coach: night-before, hour-before, manual and custom-automation templates, contact-card buttons, tracking toggles |
| 🛡️ **Objections** | all (read-only for dialers) | The objections engine — catalog plus AI objection handling during calls |
| 🧠 **Knowledge Base** | all | KB manager separated into Agent Scripts · Customer Q&A · Documents · Websites · MP3 call recordings |
| 💬 **AI KB Chat** | non-dialers | Ingest knowledge by typing, image or audio; the AI decides where it belongs |
| 👤 **Prospects** | all | AI-built prospect profiles: animal type, intent score, traits and recommended approach |
| 🎥 **ProtoFace** | admins | Central control of the video-AI assistants: avatars, voices, opening lines, script tuning, knowledge base selection |
| 📣 **Marketing** | admins | Debt Call Coach marketing sequences and sends |
| 🎯 **Lead Gen** | admins | Social scraping and intent mining — distress posts, debt amounts, matched into the vault |
| 🧠 **Smart Leads** | admins | Smart-lead scoring, reject reasons, and its settings |
| 📮 **Email Campaigns** | admins | The full campaign manager: CSV → mapping → recipients → approval → throttled sending → monitoring |
| 📈 **Email Engagement** | admins | The engagement console (G10) |
| 📊 **My Stats** | dialers | Dialer-facing analytics: hot-call counts, calls today, talk time |
| ⚙️ **Admin** | admins | Coach admin panel, user profiles, scoring tuners, AI script builder |
| 🧾 **AI Reports** | admins | Nightly AI cost reports — exact dollar cost per call, per agent, per AI model |
| 💳 **AI Credits** | super admins | Credit usage by agent/employee, by client/lead, and by call type |
| 🛡 **Compliance** | super managers | The compliance portal, embedded inside the coach (G9) |

**Always-on across every tab.** Floating WCR checklist · profile timer watcher (re-reminds you to open a profile, and can reopen it) · lead-assignment popup · credit-exhaustion alert · meeting alert 5 minutes out with audible tone · missed-appointment alert (super admin, every 15 min, 10am–10pm ET Mon–Sat) · Alt+D **Deal Monitor** popout (hot leads + next 3 days) · Alt+H **heat map** popout (radial deal distribution, center = enrolled) · pop-out panels for Scripts / Closing / Calls / Lead Gen / Smart Leads / Hot Leads with saved layouts · emergency-scripts overlay above everything · end-call dialog that asks whether to keep or delete the profile · client profile modal reachable from any list.

### G3. The contact record — what "opening a lead" actually gives you

**a) `ClientProfileModal` — the full client file, 15 tabs**

| Tab | What it holds |
|---|---|
| 📋 Overview | The identity block: contact details, status, scores, ownership, appointment |
| 📋 Activity | Notes and the chronological history — calls, notes, status changes, AI synopsis, calendar events |
| 💳 Debt | Creditors with balances, interest rates, payment schedules; debt ledger; accepted vs non-accepted creditors |
| 🧾 Bills | Monthly expenses and income (budget picture) |
| 🔍 Insights | AI-captured customer insights (location, occupation, hobbies, life events) |
| 👥 Co-Signers | Co-signer records |
| ⚠️ Hardship | When it started, why, how it hit their finances |
| ❓ Q&A | The questions asked on calls and the answers given |
| 📝 Transcripts | Every call transcript for this lead, with the intent report stored on it |
| 📧 Email Activity | Every email sent to this lead with opens/clicks and the tracking timeline |
| 🤖 Rosie AI | The video/voice qualification session: who they met, what was said, the analysis |
| 📷 Credit Report | The uploaded credit report photo and what was extracted from it |
| 🏁 Closing | Closing checklist progress, saved across calls |
| 📊 Do Nothing Calculator | "Do nothing" vs "enroll" comparison (from the Debt Advisors spreadsheet) |
| 🤖 AI Populate | The field-by-field log of what the AI wrote into this record, old value → new value, with timestamps |

The card reads stored state in full (a stored "CA" opens as "California"), and saves go through an atomic server-side write so a partial failure can't drop a note or a report.

**b) `DebtLeadCard` — the live-call version.** Debt-specific fields plus everything the AI detects during the call: debt amount, creditors, ledger, non-accepted creditors, hardship, co-signers, profile fields — with the voice/chat field updater and key-facts panel beside it.

**c) `LeadContactCard` (leads module) — sub-tabs + tabs.** Sub-tabs: 🦆 Client Info · 📝 My Notes · ✉️ Emails · 🎙 Transcripts · 📋 Reports · 🌐 Site Access. Main tabs: overview · history · SMS · email · access · site stats · research · script · AI details · debt · actions.

### G4. The Fronter workspace — the human prospecting floor (`/fronter`)

| Tab | Who sees it | What it is |
|---|---|---|
| 📋 Prospects | all | Cold prospects assigned to the rep |
| 📋 Leads | all | Leads in progress, with the fronter contact card and script |
| 📋 Queued No Connect | all | Attempts that didn't connect yet, queued for retry |
| 🚀 Migrated | all | Leads transferred into Debt Call Coach, with the link to the created coach lead |
| 💎 Closed Deals | all | Won deals, with the celebration popup when one lands |
| 📊 Reports | all | The rep's own performance reporting |
| 💬 Feedback | all | Feedback submitted by the rep |
| 🤖 BOB Training | all | The fronter training simulator (scenarios, objection popup, transfer sim, script panel, mailer sim) |
| 🕐 HR | all | Time clock and rep HR surfaces (time card button, bonus tracker) |
| 🔧 Settings | all | The rep's own settings, quick-dial editor, hold-audio recorder |
| 📜 Scripts · ⚙️ Admin · 🤖 AI Agent · 📧 Emails · ✉️ Email Opt-In · 📣 Marketing | admins | Fronter script library, admin panel, AI dialer agent control and monitoring, email templates, opt-in controls, marketing/rate-drop mailers |

**Always-on in the fronter:** the dialer (Twilio-based, with an AI-agent dialer alongside), assistant line strip, inbound line bar, dual clock bar, lead-confirmed checklist, note attachments, hardship field, phone-verify badge, email-tracking badges and notifications, quick dial, hold audio, meeting scheduler, merge popup, heads-up and direct-message popups, QA popup, report popup, transfer/export-to-coach popup, onboarding, monitor panel, and the **Lead Vault** surfaces (upload → Tracerfy append → validation → DNC scrub → distribution → entry table).

### G5. The admin dashboard (`/admin`) — the operator's CRM screen

**Views:** users (with a CRM sidebar: Prospects · Investors · Activity) · calendar (`GlobalCalendar`, clickable events, upcoming reminders) · analytics (investor analytics, recent investor events) · activity · leads (`LeadsTab` + Twilio dialer + predictive dialer) · SMS conversations · marketing · NB Tech email activity · knowledge base (with the intent-engine and coach-rules tuners) · SignNow requests + settings · portal controls · settings · BOB.
**Live popups:** incoming call (WebRTC chat voice), incoming SMS, voicemail notification, reminders, admin alert, Discord-style admin chat, contact-card modal, prospect pipeline, scorecard, Rosie tab, portal-access tab, call-log panel, audio recorder manager, NB Tech KB importer.

### G6. Super Admin Command Center (`/superadmin-portal`)

Boards: 🔵 **Debt Call Coach** (AI agent, AI call activity, AI + platform credit usage) · 🟢 **Fronter** (who is on the phones, the transfer queue) · 📡 **Fronter Monitor** · 💬 **Website Chat** (every visitor talking to the homepage assistant, with human takeover) · ⚡ **Split screen** (coach + fronter side by side) · 📣 Marketing · 📈 Email Engagement — plus a floating inbound handset, a system strip, and a card-board engine (`DockBoard`).

### G7. Manager portal (`/manager-portal`)

| Tab | What it gives the manager |
|---|---|
| 👥 Employees | The floor roster with employee contact cards, dialer cards, dialer reports and admin flags |
| 🔥 Hot Call | Hot-call settings plus a realtime hot-call alerts popup that can jump straight to the dialer |
| 📝 Transcripts | Every call transcript, with the live call monitor |
| 🛡 Compliance Monitor · 🛡 My Compliance · ⚙️ Compliance Admin | Per-dialer compliance toggles, live compliance scores, and compliance management |

### G8. Admin Assistant portal (`/assistant-portal`)

🔔 Alert Center · ✅ My Tasks · 📅 Calendar (with the calendar contact card and scripts) · 👥 Fronter Team · ☎️ Dialer (fast-dial, Chris office/mobile) · 📚 System Guide · 📣 Marketing · 📈 Email Engagement · 🗂 Contact Card Editor (super admin). Live pieces: appointment reminders popping every 30s, the next-3-hours window, and manual line-status broadcast to the fronter floor.

### G9. Compliance portal (`/compliance-portal`)

My Compliance · Monitor (per-dialer toggles and live scores) · Admin (knowledge base, conversational AI for rule ingestion, remedies). The compliance ticket card has four tabs: **Overview · Transcript & Issues · Notes Thread · Remedy**, and a live scorecard widget rides on live calls.

### G10. Email Engagement console (`/email-engagement`)

Every tile is click-through — click a number and the people behind it are listed.

- **Coach system:** Emails sent · Leads engaging · Leads who opened · Leads who clicked · Welcome messages · Qualification page · Avg coach score
- **Fronter system:** Emails sent · Prospects engaging · Prospects who opened · Prospects who clicked · Engaged + · Qualification page · Avg fronter score
- **Plus:** the ranked follow-up list (hottest first), campaign-effectiveness table (which email actually moves people), the live feed, the hot-lead banner (who just crossed into hot, with chime), the permanent hot-lead record (everyone who ever went hot, with sessions, peak score and outcome), and one-click opening of the right contact card behind any name.
- The two systems' engagement data are kept strictly separate.

### G11. Campaigns & marketing surfaces

`CampaignWizard` (build → `CsvUploadStep` → `FieldMappingStep` → `CampaignRecipientsTable` → `PersonalizeTestStep` → `CampaignLaunchStep` → `CampaignMonitor`), `TemplateLibrary` with merge tags, hosted image assets, the rate-drop mailer engine (per-campaign scheduling, staggering, repetitive windows), the template test sender, and the email opt-in panels. Sending runs across the four lanes described in Part I (A9).

### G12. Automations & Scoring center (`/automations`)

One panel for every automated thing: the automations list with **on/off per automation** and **timing overrides**, the last-run time each job writes itself, warnings on dead automations, and the scoring side — tier thresholds (hot / engaged / warming), migration start score, bot-filter window, per-email-family weights, and pattern bonuses.

### G13. Investor, public and utility screens

`/portal` investor portal (document-read analytics, e-signature) · `/investor-page` · `/offering` · `/growth-plan` · `/work-report` · `/aboutdebt` · `/qualify` · `/reschedule` · `/credit` (credit-report upload) · `/optin` (+ screenshot variant) · `/email-optin` · `/privacy` · `/terms` · `/stories/:slug` · `/live-codebase-explorer` · `/DirectD` · `/log` · `/request-access` · the three portal logins · `/adminfrontpage` · `/email-engagement` · `/automations`. Plus the homepage with its chat widget (greeting → debt slider → qualification chat).

### G14. Screen inventory by route

| Route | Page | Module |
|---|---|---|
| `/` | Home (+ chat widget) | public |
| `/portal` · `/investor-page` · `/offering` · `/growth-plan` | InvestorPortal · InvestorPage · Offering · GrowthPlan120Day | investor |
| `/admin` · `/adminfrontpage` | AdminDashboard · AdminFrontPage | admin |
| `/debt-call-coach` · `/manager-portal` · `/compliance-portal` · `/interviews` · `/training` | Coach, Manager, Compliance, Interviews, Training | coach |
| `/fronter` · `/assistant-portal` · `/superadmin-portal` | Fronter, Assistant, Super Admin | floor / command |
| `/email-engagement` · `/automations` | Engagement console, Automation center | reporting / control |
| `/credit` · `/qualify` · `/reschedule` · `/optin` · `/email-optin` | CreditReportUpload, SarahQualifyPage, ReschedulePage, OptIn, EmailOptInPage | lead-facing |
| `/aboutdebt` · `/stories/:slug` · `/privacy` · `/terms` · `/work-report` · `/log` · `/request-access` · `/DirectD` · `/live-codebase-explorer` | content & utility | mixed |
| logins | `/portal-login` · `/admin-login` · `/debt-call-coach-login` | auth |

---

## PART H — LIVE-CALL ANALYTICS AND INTELLIGENCE, IN DEPTH

### H1. The pipeline that runs on every call

Headset mic → **Deepgram** (diarized, sentiment-scored streaming transcript) → the live intelligence windows → per-turn AI work → the CRM record → post-call reports. The live working window (`DebtLiveCall`) composes: the debt contact card, `DebtAIPanel`, `LiveTranscriptPanel`, `LiveScriptsPanel`, the live compliance widget, customer-stats capture, the do-nothing calculator, objection popup, appointment preview, emergency scripts, end-call dialog, call recorder, contact filler, and the hot-call tracker.

**Nothing here is a mock:** the transcript is diarized and sentiment-scored, AI calls are metered in credits, and every AI write to a record is logged field-by-field.

### H2. The live coaching windows

- **`DebtAIPanel` — four inner tabs:** 🤖 **AI** (the Q&A / Coach / Intent popout) · ❓ **Common Q&A** (searchable library of the questions that actually come up, add/edit/delete) · 🎤 **Pitches** · 🎯 **Signals** (the reference card of debt buying signals in four phases: Relief & Validation → Logistics & Math → Soft Objections → Micro-Commitments).
- **Live Q&A:** questions are detected from the running transcript, answered from the knowledge base first (direct hits and scored relevance), then expanded by AI when needed, and rendered as an answer card with actions. Saves are persisted to Q&A history per lead.
- **Coach mode:** streaming coaching guidance as the call runs; **Intent mode:** live buying-signal read.
- **`QAPopOutPanel`** detaches Q&A alone; **`LiveTranscriptPanel`** detaches the transcript; **`LiveScriptsPanel`** detaches scripts + closer pitches; **`ScriptTeleprompter`** runs the script at reading speed with rich-text formatting, insert toolbar and a floating script box; **`EmergencyScripts`** floats above everything for the moment a call goes sideways.

### H3. The 24 AI modes behind the live panel (and what each is for)

`liveAssistantAI` is the single backend entry point, dispatching on mode. This is the "full power" list:

| Group | Modes | Purpose |
|---|---|---|
| Live coaching | `coach`, `coach_stream`, `intent`, `intent_final`, `hot_call_check` | Coach the rep, stream guidance, read intent live, finalise intent at call end, flag a hot call |
| Q&A | default Q&A mode, `qa_expand` | Answer the question in the moment; expand an answer when the short form isn't enough |
| Field extraction | `extract_facts`, `extract_insights`, `contact`, `budget`, `credit`, `hardship`, `cosigners` | Pull facts, customer insights, contact details, budget, credit, hardship and co-signers out of the conversation |
| Identity research | `dob_research`, `birth_year_research`, `research_insight`, `internet_search` | Fill identity gaps and enrich an insight with outside information |
| Call handling | `handoff`, `generate_smalltalk` | Handoff content and small-talk generation when the line goes quiet |
| Post-call | `next_call_briefing`, `full_report`, `call_analysis`, `profile` | Pre-call briefing, the full call report, post-call quality analysis, and the AI-built profile |

### H4. What gets written into the CRM while the call is still running

- **`aiContactFiller` (via `useAIContactFiller`) and `VoiceFieldUpdater`** write validated fields straight onto the record: debt amount, creditors, the debt ledger (creditor, balance, credit limit, interest rate, monthly payment, payment schedule, account last 4, notes), non-accepted creditors, hardship, co-signers, budget, contact details.
- **`LiveProfileAgent`** is a chat-style agent inside the profile: type a natural-language command and it fills profile fields and/or answers questions about the client.
- Every AI write is recorded in the **AI populate log** (field, old value, new value, timestamp), so a manager can see exactly what the AI changed and when.
- **`CustomerStatsPopup`** captures customer insights during the call — it auto-detects location/occupation/hobby mentions and lets the rep research them with AI on the spot.
- **`KeyFactsPanel`** holds the memories that persist across calls: personal details, family, life events, follow-ups, hot buttons.

### H5. Live scoring, signals and guardrails

- **Intent score** (live and final), **deal score**, **animal type** (🦆 duck = skeptical · 🐄 cow = buying-curious), interest level and tonality notes.
- **Hot-call tracking** (`useHotCallTracker` + `HotCallAlert` / `HotCallSettings`) raises a realtime alert to managers while the call is hot.
- **Live compliance scorecard** on the call: current score, compliant hooks, violation count; alerts toast to the compliance desk with an "Inspect Call" action.
- **Deal Monitor** (Alt+D) and the **heat map** (Alt+H) give the floor a live read on where deals sit.

### H6. Post-call intelligence

- **Intent Report + next-call playbook** (`intentReport.js`): score /100, animal type, interest level, the analysis, and the playbook — stored on the transcript and shown word-for-word. It pops up automatically the next time the profile is opened.
- **`NextCallBriefing`** ("Ready for next call") generates the pre-call briefing: insights, reminders, what to ask, what to avoid.
- **`CallAnalysisDiagram`** renders the post-call quality read: a timeline of strengths and issues, plus the manager quality report.
- **`QAReviewTab`**, **`ManagerTranscriptTab`**, **`LiveCallMonitor`** and **`ManagerComment`** give managers the coaching loop over real calls.
- **Transcripts** are stored per lead, consolidated, and fed to the learning loop (`processTranscriptLearning`, `HistoricalQAExample`, `DebtQAHistory`, `DebtIntentSnapshot`) so answers and scoring improve from actual calls; `CustomerInsight` holds the insight layer.
- **`Rosie AI` tab** holds what the video/voice qualification session gathered (who they met, the conversation, the analysis), which is the bridge between the website and the phone call.

### H7. Cost and credit accountability

`aiCostReport` + **AI Reports** tab: exact dollar cost per call, per agent and per AI model, nightly. **AI Credits** tab: usage broken down by agent/employee, by client/lead and by call type. Credit exhaustion raises a global popup rather than failing silently mid-call.

### H8. What the live layer buys you (the benefits, concretely)

1. **A rep who is never alone on a call** — live Q&A, coaching, signals and objection handling while the client is still talking.
2. **A record that fills itself** — debt, creditors, ledger, hardship, co-signers and insights land on the card during the call, with an auditable log of every AI write.
3. **A manager who can coach from reality** — transcripts, quality diagrams, manager comments and live monitoring instead of guesswork.
4. **The next call is prepared before it starts** — intent report, playbook and next-call briefing generated from the last conversation.
5. **Memory that survives across calls** — key facts, insights and prior reports are there when the same person calls back weeks later.
6. **Compliance inside the call, not after it** — a live score, hooks and violations, with a paper trail on the ticket.
7. **Every AI dollar accounted for** — per call, per agent, per model, per client.
8. **Scoring you can trust** — thresholds, weights and patterns are configurable in one panel, and the two systems' engagement data never mix.