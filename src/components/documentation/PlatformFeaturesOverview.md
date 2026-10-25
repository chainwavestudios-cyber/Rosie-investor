# Settlement IQ / Rosie AI
## Comprehensive Technical Platform Features Overview
### Interactive scripts, live CRM intelligence, automated actions, outreach, calling, qualification and operating controls

**Prepared:** October 24, 2026  
**Audience:** owners, operations leaders, technical reviewers, trainers and prospective platform partners  
**Basis:** repository inspection of the implemented screens, handlers, field definitions, shared services and workflow definitions. This is a capability and architecture reference, not a declaration that every integration or production flow passed a live test today.  
**Relationship to earlier reports:** this is the consolidated overview. The earlier technical inventory and CRM/live-call supplement remain supporting references; this document corrects their omissions and several overstatements.

---

## Contents

1. What the platform actually is
2. The most powerful capabilities, and exactly where to find them
3. Interactive scripts: a working sales process, not a text document
4. Script tag and action reference
5. On-the-fly contact-card updates and AI-assisted data capture
6. Instant email, automatic handoff preparation and behavior-triggered follow-up
7. The complete CRM and client record
8. Live-call intelligence, Q&A and coaching
9. Intent, AI classifications, hot leads and engagement scoring
10. Closing, financial analysis and credit-report tools
11. Calling, routing, transfers and manager intervention
12. Autonomous AI phone agents
13. Rosie / Digital Chris video qualification and website chat
14. Lead acquisition, enrichment, compliance checks and distribution
15. Email templates, campaigns, tracking and marketing
16. Scheduling, reminders, rescheduling and assistant tasks
17. Knowledge management, script generation and continuous improvement
18. BOB training, hiring, workforce and performance management
19. Management, compliance and operating controls
20. Investor / offering CRM and document engagement
21. Workspace navigation and feature-location directory
22. Technical architecture, data flows and integration map
23. Automation catalog and real operating boundaries
24. Benefits and connected operating scenarios
25. Evidence index, corrections and readiness notes

---

## 1. What the platform actually is

Settlement IQ / Rosie AI combines an operational CRM, human calling workspace, interactive sales scripts, live AI coaching, autonomous phone qualification, avatar-based qualification, outreach and engagement tracking, appointment protection, training, compliance review and management reporting.

Its distinguishing capability is the connection between **what a person says**, **what a script instructs the representative to do**, **what is saved on the contact card**, and **what should happen next**.

A representative can stay inside a script while correcting a customer's email, confirming debt figures, generating a call summary, sending the credentials email and opening the transfer process. The AI can also populate supported contact fields from the conversation. A subsequent email open or qualifying link-click pattern can initiate follow-up and create a calendar call task through the corresponding automation.

Those are different kinds of behavior:

- **Inline action:** a person presses a script button and the system performs the task.
- **Assisted capture:** AI interprets speech or text and updates supported fields through the relevant save path.
- **Automatic call processing:** timers, call-end processing or the AI agent's transfer action run without pressing each individual task button.
- **Event-driven automation:** a saved record or tracking event starts a workflow.
- **Scheduled automation:** a recurring workflow invokes a runner, which checks settings and eligibility.

The platform contains all five. They should not be collapsed into the vague claim that every script tag automatically executes every action.

### Repository scale at this review

| Artifact | Files / declarations found | What this number means |
|---|---:|---|
| Backend `entry.ts` handlers | 139 | Physical handler files, not a deployment-health count |
| Entity schemas | 121 | Stored-data definitions in the repository |
| Workflow definitions | 22 | Scheduled and event-driven definitions; presence does not prove active status or a successful recent run |
| Shared backend modules | 43 | Reused email, AI, telephony, scoring and business logic |
| React `.jsx` components | 485 | Component files under `src/components`, not a claim that every component is mounted |
| Router declarations | 36 | 35 explicit page routes plus the catch-all |

These are a dated repository snapshot, not throughput, concurrency, customer or revenue metrics.

---

## 2. The most powerful capabilities, and exactly where to find them

| Capability | Where the user finds it | What makes it useful | Primary implementation |
|---|---|---|---|
| Scripts with real task buttons | Coach → Scripts → My Scripts; Fronter → contact card → Script | Confirm debt, summarize, send email and proceed without leaving the conversation | `DebtScriptEditor`, `FronterContactScript`, `ScriptTeleprompter` |
| Edit the contact card inside the script | Fronter script and transfer/merge script | Correct email, phones, names or address and press Update on the spot | `FronterInlineField` |
| Field-specific AI tags | Coach / Fronter script editor → AI Field Tag | Tell the review/extraction tool which field a question is collecting | `debtContactFields`, `fronterContactFields`, `aiContactFiller` |
| Whole-section AI tags | Same tag picker → Whole tab | Collect related facts for a full section such as hardship or bills | `[[AI:tab_hardship]]`, `[[AI:tab_bills]]` |
| Fine-grained collection tags | Coach script editor → ledger, bills or co-signer fields | Identify a particular property without replacing the entire customer file | Child tags such as `billsJson_rent` |
| Speech-following teleprompter | Coach Scripts; supported training script views | Highlight the line being read and move with the conversation | `ScriptTeleprompter` |
| Non-spoken coaching cues | Script editor → Insert Cue | Place reminders, objection advice and tone instructions beside spoken lines | `@@CUE:...@@` |
| Rich-text and attention formatting | Coach / Fronter script editors | Bold, italic, colors, neon highlighting, font/size, spacing and animations | `ScriptFormatToolbar`, `ScriptWysiwygEditor`, `ScriptRichText` |
| One-tap credentials and welcome email | Script Send Email button; contact-card email buttons | Sends the selected/master template with tracking, without a compose detour | `sendDebtEmail`, `sendFronterCredsEmail` |
| Automatic AI handoff preparation | AI phone agent → transfer stage | Extract data, prepare notes, optionally send credentials and update the lead before routing | `prepareTransfer` |
| Live contact extraction | Live Call; Fronter dialer; Fronter AI Review | Saves customer-provided information from the transcript | `useAIContactFiller`, `aiContactFiller` |
| Speak changes to a client record | Client profile → Live Agent → Talk to Agent | Dictate supported field changes or notes instead of typing them individually | `LiveProfileAgent`, `useAgentVoice` |
| Conversational CRM commands | Client profile → Live Agent | Update fields, save a note, change status, mark hot or book an appointment | `LiveProfileAgent` |
| App-wide AI operations console | AI command console | Read supported records, make allowed edits and send welcome emails when explicitly requested | `appAgent`, `useAppAgent` |
| Engagement-driven follow-up | Automations & Scoring; Fronter tracking | An open plus qualifying website clicks can trigger the follow-up email | `processEmailTrackingEvent` |
| Follow-up-open → calendar call | Same event-driven flow | Create a 15-minute follow-up call event after the follow-up email is opened | `processEmailTrackingEvent` |
| Live Q&A and objection support | Live Call → AI / Common Q&A / Pitches / Signals | Find relevant answers while the prospect is still on the phone | `DebtAIPanel`, `liveAssistantAI` |
| Cross-call memory and next-call playbook | Client record; Intent Report; Next Call Briefing | Preserve useful facts and prepare the next conversation | `LeadMemory`, `intentReport`, `NextCallBriefing` |
| Central automation switches | Automations & Scoring | Change supported automation behavior and scoring rules without editing each runner | `AutomationConfig`, `ScoringConfig`, `automationRules` |
| Hot-lead evidence and history | Email Engagement; Hot Leads | Open the exact record behind a metric and retain the history after it cools | `EngagementHotLead`, engagement console |
| A script that seeds an entire operating system | Coach → Admin → AI Script Builder | Generate proposed scripts, agent configuration, rebuttals, Q&A and knowledge entries from one source | `AIScriptBuilderTab`, `aiScriptBuilder` |

---

## 3. Interactive scripts: a working sales process, not a text document

### 3.1 Authoring and script organization

The Coach script editor separates **My Scripts** from **Agent Scripts**, the latter drawing read-only script material from imported knowledge. Script records have a name, content, type, color and reading size. Script-type controls include opener/closer organization.

The Fronter script management screen supplies the corresponding human-fronting script library. The selected script is available on the working contact card, with its actions connected to that contact's transcript and record.

Authoring capabilities include:

- Create, rename, edit, select and delete scripts.
- Edit in a visual rich-text surface instead of making representatives read formatting syntax.
- Apply bold and italic to selected text.
- Choose text colors and background highlights, including neon attention colors.
- Choose font family and size.
- Add vertical spacing to separate difficult sections or provide a visual pause.
- Apply pulse, blink, shake or glow emphasis.
- Clear selected formatting.
- Insert supported personalization variables from a toolbar.
- Insert a reminder, objection or tone cue.
- Insert a field-specific or whole-section AI collection tag.
- Insert a real task button at the exact point in the conversation where it belongs.
- Use debounced autosave plus an explicit Save action.
- Use floating/pop-out script views alongside the dialer.

The rich-text layer converts the editor's HTML into the application's stored formatting representation and renders it back for reading. This keeps authoring, stored content and read views connected.

### 3.2 Live personalization

Scripts substitute values from the active contact, rather than requiring the representative to mentally replace placeholders.

Supported examples include first/last name, phone, email, street/full address, city, state, ZIP, debt amount, notice/lead number, hardship statement, best callback time and the representative's name. Both legacy name placeholders and supported `{{variable}}` aliases are recognized.

Examples of implemented variables: `{{firstname}}`, `{{lastname}}`, `{{email}}`, `{{phone}}`, `{{city}}`, `{{state}}`, `{{zip}}`, `{{debt_amount}}`, `{{notice_id}}`, `{{hardship_statement}}`, `{{contingency_time}}`, `{{frontername}}`.

Aliases are case-insensitive in the shared substitution utility. A missing value does not become an invented fact. This variable catalog is explicit; arbitrary entity fields are not automatically valid placeholders.

### 3.3 A teleprompter that follows speech

The Coach teleprompter:

- Highlights the active spoken line.
- Scrolls that line into view.
- Dims previously read lines.
- Follows the live Deepgram transcript during a live call instead of opening a competing microphone recognizer.
- Offers browser speech-recognition voice sync outside that live transcript path, where supported.
- Uses significant-word matching and looks ahead across upcoming spoken lines to tolerate movement through the script.
- Supports Prev, Next, Reset and clicking a line to jump.
- Supports Arrow Down / Space for next, Arrow Up for previous and R to reset, outside ordinary form inputs.
- Reports its position to the host for connected script-aware assistance.
- Excludes non-spoken action/cue elements from ordinary spoken-line advancement.

Speech matching is a navigation aid, not proof that the representative said every required disclosure or completed a legal/compliance step.

### 3.4 Non-spoken cues and hidden AI guidance

A manager can place three kinds of visual cue within the script: **Reminder**, **Objection** and **Tone**. A cue can remind the rep to pause, listen, check understanding or handle an objection in a particular way without making it part of the words read to the customer.

AI field tags are a separate layer. They remain visible while authoring but are stripped from supported read/teleprompter/closing displays. The rep reads the question; the review tool gets the field-mapping context.

### 3.5 Scripts that continue into transfer and closing

On the Fronter card, **Completed Steps** divides the main script from the remaining transfer script. Pressing it opens the transfer/merge surface with the continuation text, so the rep keeps reading the relevant next step rather than searching for a different document.

In Coach, the corresponding action opens the Closing Flow for the active contact. The same marker therefore has a context-specific meaning. It does not independently prove that every step was actually completed.

### 3.6 Emergency and floating scripts

The platform contains ordinary script popouts, closer pitches, a floating script box and emergency-script overlays. These are separate from script editing: they keep the material visible while the agent uses another part of the workspace.

Saved workspace layouts and per-user tab order reduce repeated rearranging between calls. The particular views that support popouts are controlled by their host screens.

---

## 4. Script tag and action reference

### 4.1 Exact tag families and their different jobs

| Syntax | Type | What it does | Activation / scope |
|---|---|---|---|
| `[[AI:email]]` | AI collection guidance | Associate customer-provided information with a supported field | Used when script context is passed to extraction/review; does not send email |
| `[[AI:tab_hardship]]` | Section-level guidance | Identify a whole information-collection section | Extract only supported, customer-provided facts from that section |
| `[[AI:billsJson_rent]]` | Child-property guidance | Identify rent within the bills collection | Extractor returns/merges the validated root collection, not an arbitrary new field |
| `[[AI INPUT]]` | Listening / collection cue | Displays the AI-input listening marker in the teleprompter | Distinct from the summary button; connected host extractors control capture |
| `@@AI_INPUT@@` | Task button | Summarize the call so far and append the result to notes | Representative clicks; Coach and Fronter have their own save paths |
| `@@DEBT_CONFIRM@@` | Task button | Extract customer-confirmed debt total/type/breakdown | Representative clicks; writes supported debt fields through the host |
| `@@SEND_EMAIL@@` | Task button | Send the credentials/welcome email for the active contact | Representative clicks; requires email, template and working sender |
| `@@COMPLETED_STEPS@@` | Progression / handoff | Open Fronter transfer continuation or Coach Closing Flow | Representative clicks; behavior differs by host |
| `@@FIELD:email@@` | Editable inline field | Render the contact's email and an Update button in the script | Fronter contact/merge script; saves on Update |
| `@@CUE:reminder:...@@` | Non-spoken visual cue | Display a reminder next to the script | Read aid, not a backend task |
| `@@CUE:objection:...@@` | Non-spoken visual cue | Display objection-handling advice | Read aid |
| `@@CUE:tone:...@@` | Non-spoken visual cue | Display delivery/tone guidance | Read aid |
| `{{firstname}}` and other supported variables | Personalization | Substitute the active record's stored value | Display-time substitution, not data extraction |

**Important:** task markers render working buttons only in a host that supplies the corresponding handler. A marker copied into an unrelated text box is not a universal workflow command.

### 4.2 Coach AI field and section coverage

The editor's catalog covers these groups:

| Section | Examples of collection targets |
|---|---|
| Overview / contact | Name, phone, email, address, city, state, ZIP, birth date, age, existing lead identifier, explicit status |
| Debt details | Debt amount, creditor count/list, behind-on-payments status, months behind, explicitly confirmed existing enrollment/date |
| Debt ledger | Creditor, balance, credit limit, interest rate, monthly payment, payment schedule, account last four, notes |
| Non-accepted creditors | Creditor, balance, account last four, reason/notes where explicitly provided |
| Financials | Employment, monthly/household income, credit score, home value/equity and tradelines |
| Bills / monthly expenses | Rent/mortgage, car, auto insurance, gas, groceries, utilities, phone, internet, student loans, health insurance, childcare, miscellaneous/custom bills |
| Co-signers | Name, relationship, phone, email, accounts, employment and notes |
| Hardship | When it started, why it happened and its effect on finances |
| Appointment | Agreed appointment date/title or callback time |
| Notes | Customer-stated information to preserve |

Whole-section markers include `tab_contact`, `tab_debt`, `tab_ledger`, `tab_nonaccepted`, `tab_financials`, `tab_bills`, `tab_cosigners`, `tab_hardship`, `tab_appointment` and `tab_notes`.

The extraction server has an explicit allowlist and validates results. **A field appearing in an editor menu does not bypass that allowlist.** For structured debt collections, a child tag points to a property within the validated root collection. Account/person identity must be established; a tag is not permission to guess which account or co-signer was discussed.

### 4.3 Fronter AI tag coverage

The Fronter catalog groups contact details, debt information, income/assets/credit, hardship, lead source, notes and checklist context. The review handler passes the selected script to `aiContactFiller`, and debt confirmation passes it to `debtConfirm`.

There is an important implementation boundary: the Fronter dialer's generic five-minute filler currently does not pass the selected script context in the same way the explicit card AI Review does. The two paths should not be described as identical. Likewise, catalog entries are not a promise that every listed field can be written by every extractor; backend validation decides what is accepted.

### 4.4 Editable fields inside a Fronter script

The inline picker exposes nine editable fields: **email, primary phone, second phone, first name, last name, street address, city, state and ZIP**.

Each inline control:

1. Starts with the active contact's saved value.
2. Detects a change.
3. Offers Update and a saving state.
4. Persists the changed field to that Fronter contact.
5. Updates the open card's local state through its callback.
6. Shows success or a failure message.
7. Resets appropriately when another contact is opened.

This is genuine on-the-fly record editing within the script, not simply printing contact information beside it.

---

## 5. On-the-fly contact-card updates and AI-assisted data capture

The platform supplies several complementary update mechanisms.

| Update path | How it starts | What it handles | Save behavior |
|---|---|---|---|
| Standard contact editing | Agent edits the card | Ordinary record fields | Card's Save path |
| Inline script field | Agent presses Update | The supported Fronter identity/contact fields | Direct field update plus open-card refresh |
| AI Review | Agent requests review | Transcript facts plus the selected script's collection guidance | Validated fields saved; relevant corrections logged |
| Background Contact Filler | Active-call timer | Newly added transcript lines | Five-minute incremental pass; saves accepted updates |
| Final Contact Filler | Call-end path where invoked | Full transcript | Full-call review rather than just the last incremental window |
| Specialist live extractors | Live Call's timed/windowed logic | Contact, debt, credit, hardship, budget, co-signers and profile facts | Host merges/saves their results |
| Standalone Voice Update component | Component implementation exists; not mounted in the inspected profile | Tab-scoped dictation logic for overview, debt, bills, hardship and co-signers | Would use the host save callback when mounted; not listed here as a currently reachable control |
| Live Agent | Agent types or speaks a command | Fields, collections, notes, status, hot-lead flag and appointment requests | Field changes saved through profile; appointments through scheduling handler |
| AI phone handoff prep | Autonomous agent chooses transfer | Debt/contact extraction and summary | Shared preparation service updates the Fronter lead |

### 5.1 Incremental, not endless re-reading

`useAIContactFiller` runs every five minutes while its call is active. Mid-call runs analyze lines after a cursor; the final pass can review the full call. Overlapping runs are prevented and the current record is fetched before comparing changes. The cursor advances only after successful extraction.

This is a cost-conscious architecture. It is not a claim that every spoken word creates an immediate database write.

The Coach additionally contains specialist timing windows. Examples in its current logic include contact collection early in a call, and later windows for debt/ledger, hardship and budget. This makes the extraction cadence different from the always-updating visual transcript.

### 5.2 Validation and correction handling

The extraction backend checks an explicit field schema with types, numeric limits, enum values, date handling and supported structured collections. It asks for information the customer actually stated or confirmed, not facts merely suggested by the representative.

Longer transcripts are processed in ordered chunks. Later statements can correct earlier ones; empty extraction results should not wipe previously found data. Supported collections are merged rather than treating every partial discovery as a complete replacement.

Important missing fields are calculated from validated results and existing data, not accepted blindly from the model's missing-field list.

### 5.3 What the AI Populate log actually records

The background filler's correction log records replaced, previously populated values with field name, old value, new value, timestamp and whether the pass was final. This gives reviewers visibility into corrections.

It is **not** an exhaustive database audit of every field write across the entire app. Inline manual edits, voice changes and other tools have their own save/log behavior. The earlier claim that every AI write universally appears in one field-by-field log was too broad.

### 5.4 Voice and conversational commands

The mounted client-profile Live Agent exposes voice interaction through its Talk to Agent controls. It can parse requests such as changing income/debt, saving a dictated note, marking a lead hot, changing a supported status or creating a callback. Date interpretation uses an Eastern Time reference in its prompt, and scheduling is performed through the appointment handler rather than merely writing a date string in chat.

A separate `VoiceFieldUpdater` component implements tab-scoped dictation for overview, debt, bills, hardship and co-signers. However, it was not imported/rendered by the inspected profile or another active host. It is therefore documented as an implemented component, not advertised as a currently reachable Voice Update button. Voice-command access in the current profile is through Live Agent.

These tools are not an unrestricted database console.

---

## 6. Instant email, automatic handoff preparation and behavior-triggered follow-up

### 6.1 Instant credentials and welcome email during a human call

**Where:** Fronter contact script, transfer script and Coach script action button.

The representative can press Send Credentials & Welcome Email at the exact point in the script where the customer agrees to receive it. There is no need to abandon the call view and compose a fresh message.

On the Fronter card, the action invokes `sendFronterCredsEmail`, which:

- Loads the matching master credentials/welcome template from the Coach template collection.
- Uses the configured welcome/personal-message link, removing that link rather than leaving a dead placeholder when absent.
- Sends through the shared Coach template sender, which uses the Gmail tracking engine.
- Writes sent-at/template fields and a contact note.
- Advances a prospect to lead on the successful send path.
- Returns a result for the on-screen feedback.

Coach's script action looks up a credentials template and invokes `sendDebtEmail` for the active DebtLead. That handler can also mint the contact's video invitation token when the selected template needs one.

Prerequisites remain real: a saved contact, an email address, an appropriate template, a valid sender connection and no blocking suppression. One-tap is the interaction model, not a guarantee of inbox delivery.

### 6.2 Fully automatic AI-agent transfer preparation

**Where:** the AI phone agent's transfer stage.

The shared `prepareTransfer` service mirrors several human script tasks:

1. Extract debt and contact information from the conversation.
2. Assemble confirmed debt totals/types and contact changes.
3. If enabled, send the credentials email using the extracted/current address.
4. Generate an AI summary and append it to the notes log.
5. Update the lead and transfer-related fields.
6. Return the prepared result to the call-control path.

This is the strongest example of actual automatic task execution: the transfer flow coordinates a sequence of tasks instead of requiring separate human clicks. Email is conditional on configuration, available data/template and successful transport. An email side effect cannot be rolled back simply because a later update fails.

### 6.3 Engagement-triggered follow-up

**Where:** Fronter tracking flow; Automations & Scoring controls.

The Email Follow-Up Automation consumes created tracking events and calls `processEmailTrackingEvent`.

The processor checks for an email open and enough distinct tracked review/company website domains. The configurable link threshold defaults to two. It uses the scoring settings' event-age/bot-filter window and saved manual click data where applicable. If conditions pass and a follow-up has not already been recorded, it attempts the follow-up email and stores its identifiers.

When that follow-up's own send ID receives an open event and no follow-up call event is saved, it creates a **15-minute Google Calendar call event**. It initially targets roughly 45 minutes later and moves in 15-minute steps when conflicts are found. Conflicts can push it beyond one hour; “always within the hour” would be an inaccurate guarantee.

The processor loads a FronterLead. This is not evidence of a universal identical follow-up rule for every record type.

### 6.4 AI-console welcome sending

The app-wide command agent has an explicit `send_welcome_emails` tool. On a clear request, it can target specified Fronter leads or eligible recently called leads, report emailed/skipped results and respect the tool's ownership restrictions for dialer/fronting users. Default recent-call lookback and batch limits are supplied by that tool.

This is a narrowly permitted outbound operation, not permission for the AI console to send arbitrary SMS, place calls, modify passwords, delete records or edit scripts.

### 6.5 Other automated work

Appointment reminders, missed-appointment recovery, campaign queue processing, lead/knowledge synchronization, script backups, cleanup, reports, keepalives and quote broadcasts form the scheduled/event-driven automation layer. Section 23 names each definition and its boundary.

---

## 7. The complete CRM and client record

### 7.1 Separate records for separate stages

| Record | Business role | Important continuity |
|---|---|---|
| `LeadVaultEntry` | Incoming lead supply and processing provenance | Batch, append/validation/scrub results, distribution destination and downstream IDs |
| `FronterLead` | Prospecting and human/AI qualification | Assigned rep, attempts, transcript/notes, credentials tracking, transfer and migration link |
| `DebtLead` | Closer/client relationship | Financial picture, call history, intent, appointment, closing progress and qualification analysis |
| `Lead` / `InvestorUser` | General CRM and investor experience | Outreach, portal access, activity and investor analytics |
| `EmailMessage` / tracking events | Message-level engagement | Contact, template, sender, send ID/token and event history |

A person can appear in related systems. Stored cross-links and the identity resolver are the continuity mechanism; this is not a claim that every table is automatically and perfectly deduplicated.

### 7.2 The full client-profile tabs

| Tab | Purpose |
|---|---|
| Overview | Identity, contact information, key financial/status values and appointment details |
| Activity | Notes, calls and chronological relationship history |
| Debt | Creditors, debt totals, ledger, accepted/non-accepted detail |
| Bills | Monthly expenses and income |
| Insights | Customer facts and researched context |
| Co-Signers | Associated people, contact/account details and notes |
| Hardship | When, why and financial impact |
| Q&A | Saved questions and answers associated with the lead |
| Transcripts | Conversation history and attached reports |
| Email Activity | Send and engagement timeline |
| Rosie AI | Video/voice qualification analysis |
| Credit Report | Uploaded report and extracted results |
| Closing | Persisted closing checklist/progress |
| Do Nothing Calculator | Cost-of-inaction versus program comparison |
| AI Populate | Supported extraction correction history |

The working live-call card offers a more immediate view of the same relevant customer information. The general Leads contact card separately exposes notes, email, transcript, report/site-access subviews and areas such as SMS, access, research, script, debt and actions.

### 7.3 Operational CRM capabilities

- Lead/prospect lists and pipeline stages.
- Named ownership, assignment timestamps and transfer provenance.
- Notes and attachment surfaces.
- Call attempts, outcomes, durations, transcript and recording references.
- Calendar appointments, callbacks and reminder settings.
- Template-email actions and send history.
- SMS conversations and consent records.
- AI intent/personality information and manual priority flags.
- Search/filter/paging controls in the relevant list screens.
- Batch imports, field mapping, matching and distribution tools.
- Soft-delete metadata and delayed cleanup for supported client records.
- Role-aware views, manager review and operating reports.

List implementations vary. The earlier statement that every list in the application uniformly uses server-side search/count/pagination was not established and should not be treated as a platform-wide guarantee.

### 7.4 Reliable call-outcome coordination

`saveCallOutcome` moves the finished-call save sequence into a server-side handler. It coordinates lead updates, transcript/report persistence, activity, facts, intent snapshots, coaching tips and Q&A, and returns per-step results.

This is more reliable than relying on a chain of browser-side saves after a call. **It is not a demonstrated all-or-nothing database transaction.** The handler performs multiple writes and records step outcomes. “A single server request” and “an atomic multi-record transaction” are not the same thing.

---

## 8. Live-call intelligence, Q&A and coaching

### 8.1 The working loop

**Audio → streaming transcript → question/intent/coaching analysis → script/profile context → suggested answers and validated customer facts → stored record and reports.**

The Live Call workspace combines the debt card, transcript, scripts, pitches, calculator, compliance widget, objection support, appointment preview and end-call workflow. Deepgram supplies the streaming transcription path; mic/transport/provider setup still determines the quality of a real call.

### 8.2 The AI panel's four areas

- **AI:** live Q&A, coach and intent surfaces, with popout support.
- **Common Q&A:** reusable searchable questions/answers.
- **Pitches:** closer-specific material.
- **Signals:** the reference framework for buying signals, including relief/validation, logistics/math, soft objections and micro-commitments.

### 8.3 Q&A rather than generic chat

The Q&A system uses knowledge-base matching before asking a model to compose a response. The supporting implementation includes question detection, relevant knowledge retrieval, common-answer reuse, expansion/research/talking-point actions and per-lead Q&A history.

The learning loop mines finished transcripts into a review queue. An administrator can approve, edit-and-approve or reject proposed Q&A. Approved items become reusable knowledge. This is controlled content improvement, not automatic retraining of a foundation model or approval-free publishing.

### 8.4 The live AI operation families

`liveAssistantAI` dispatches the following implemented modes/paths:

| Family | Modes / paths |
|---|---|
| Guidance and intent | `coach`, `coach_stream`, `intent`, `intent_final`, `hot_call_check` |
| Questions | Default Q&A path, `qa_expand` |
| Fact collection | `extract_facts`, `extract_insights`, `contact`, `budget`, `credit`, `hardship`, `cosigners` |
| Research | `dob_research`, `birth_year_research`, `research_insight`, `internet_search` |
| Conversation support | `handoff`, `generate_smalltalk` |
| Reports/profile | `next_call_briefing`, `full_report`, `call_analysis`, `profile` |

Availability depends on the host, settings, call context and the model/provider paths. Listing a mode is not a claim that it runs on every transcript line.

### 8.5 Post-call and next-call value

The platform can preserve an intent report and playbook with the transcript, generate a next-call briefing, render a quality-analysis diagram, retain useful customer memories and give managers a review surface with comments.

This turns a conversation into reusable operating context: what was learned, what caused hesitation, what to do next and what the next rep should know.

---

## 9. Intent, AI classifications, hot leads and engagement scoring

### 9.1 “AI tags” can mean several different things

1. **Script AI collection tags:** hidden instructions mapping questions to fields.
2. **AI-derived classifications:** intent score, interest/personality/animal type and suggested approach.
3. **Human-directed record flags:** hot-lead/status changes made explicitly through a UI or supported AI command.
4. **Engagement tiers:** hot/engaged/warming classifications computed from tracked activity.
5. **Identity/source tokens:** Protoface IDs, lead numbers and source/distribution metadata. These identify provenance, not buying intent.

They should not be reported as one undifferentiated tagging system.

### 9.2 Call intent and personality

Live and final intent analysis can feed score, interest interpretation, personality/animal type and a next-call approach. The duck/cow framing is an operational coaching shorthand, not a scientifically validated psychological diagnosis.

Hot-call tracking is separate from email engagement: it alerts managers to relevant live phone activity according to its settings. Deal score, enrollment status and explicit closing progress are also distinct values.

### 9.3 Email engagement scoring

The scoring layer considers configured email-family weights and behavioral patterns. Admin controls cover hot/engaged/warming thresholds, migration start score, bot/event-age filtering, follow-up-link requirements and pattern bonuses.

Pattern concepts include reminder combinations, repeat opens, qualifying link combinations, credentials/site behavior and avatar qualification. The exact values are configurable; defaults are not necessarily today's saved settings.

### 9.4 The engagement console

**Where:** Email Engagement, with access from the operations portals and Coach.

- Separate Coach and Fronter system views.
- KPI tiles for sends, opens, clicks, engagement and qualification behavior.
- Click-through lists showing the records behind a metric.
- Ranked follow-up recommendations.
- Campaign/template effectiveness.
- An activity feed.
- Current hot-lead cues and optional sound behavior.
- A permanent historical hot-lead record with first/last hot times, sessions, peak/latest score, reasons and handled status.
- Contact-card opening from the appropriate lead name.

Open/click tracking is observational, not certainty that a human read every word. Mail clients, image proxies, security scanners and missing events can affect the data. Bot filtering improves interpretation but cannot prove human intent in every case.

---

## 10. Closing, financial analysis and credit-report tools

### Closing support

Coach's Closing tab hosts the SmartClose flow. The client record holds closing progress so a later conversation can resume rather than restart. Supporting closing components include the closing script view, objection material and skipped-step notices.

The operating checklist, closing flow and compliance review have different purposes: a clicked completion marker should not be mistaken for verified execution of every required step.

### Financial picture

The debt ledger captures creditor/account-level values and payment schedules. Non-accepted-creditor detail is kept separately. Bills, income, hardship and co-signers give the rep a fuller qualification picture than a single debt total.

The Do Nothing Calculator compares a continuing-payment scenario to a program scenario using entered assumptions. It is a conversation and comparison tool, not a guaranteed settlement outcome, credit result or financial forecast.

### Credit reports

Credit-report upload and analysis connect report images/documents to the client. Extracted creditor information can inform accepted/non-accepted views and the ledger. The report URI and analyzed timestamp retain provenance.

AI extraction and creditor eligibility still require review. A script tag must not invent a creditor eligibility decision or mark a person enrolled merely because they sound interested.

---

## 11. Calling, routing, transfers and manager intervention

### Human calling surfaces

- Coach's compact browser call bar and live coaching workspace.
- Fronter's browser dialer and assigned-line controls.
- Assistant dialer and fast-dial contacts.
- Admin dialer/call-log and predictive-dialer surfaces.
- Super Admin inbound handset/phone panel.

### Shared capabilities

Twilio-backed handlers support browser voice tokens, outbound calls, callback flows, inbound voice handling, call logs and voicemail. The broader floor experience includes mute/hold/transfer UI, queue state, availability/line indicators and call outcome recording where supported by the host.

Transfer-related metadata, handoff scripts and Fronter-to-Coach migration links preserve continuity. The Fronter workflow also contains retry/no-connect views and attempt-based lifecycle rules.

### Manager oversight

Manager-facing live monitoring and call-control code support observing/intervening in calls, alongside transcript review, comments and performance reports. Exact live-control behavior depends on the underlying call mode and transport.

Provider configuration remains essential: enabled numbers, correct webhooks, voice application setup, media permissions, regional dialing permission and reachable bridge services are prerequisites. Code presence does not establish that every queue/pickup/inbound path is healthy today.

---

## 12. Autonomous AI phone agents

The autonomous phone system covers outbound and inbound conversation paths using configured agent scripts, voices, prompts, rebuttals, qualification logic and transfer destinations.

### Technical split

1. **Transport:** Twilio calls/media streams and the external WebSocket bridge, with transcription and speech playback.
2. **Conversation/business logic:** response generation, knowledge/script context, qualification and action decisions.
3. **Call control:** dial, callback/status handling, transfer/routing and end-of-call outcome processing.
4. **Operating controls:** pipeline/batch settings, inbound configuration, provider health/keepalive behavior and credit/cost reporting.

### Important capabilities

- Use stored lead facts to personalize the conversation.
- Transcribe the exchange.
- Apply configured scripted qualification.
- Use configured voices and speech providers.
- Prepare contact/debt information and notes before transfer.
- Optionally send the credentials email before transfer.
- Route to configured primary/fallback destinations in the applicable path.
- Record outcomes and transcript-related data.
- Apply calling-hour safeguards in the dialing handler.
- Provide usage/cost evidence for management.

This is not unlimited 24/7 outbound dialing. The AI dialing code contains local-time call-hour restrictions, and operating policies/provider rules can further restrict use. Script text and model output are not a substitute for legal review of calling practices or offer claims.

---

## 13. Rosie / Digital Chris video qualification and website chat

### Avatar-based qualification

**Where:** public qualification page; Coach → ProtoFace for configuration.

The avatar system supports assistant selection, per-assistant opening lines and voices, fallback/default settings, knowledge-base selection, system-prompt tuning, speech chunk/gap/delay controls and a transfer sales line.

Personal invitation links carry the contact's Protoface token and selected assistant. Sessions track the qualification/routing lifecycle. Analysis can be written back to the lead's Rosie AI area, connecting the website interaction to the later phone call.

The repository contains both hosted/embed-related configuration and a custom agent-driven path using room/media infrastructure. The presence of multiple paths should not be confused with evidence that all modes are active at once.

### Website qualification chat

The homepage chat implements a greeting/debt-slider entry experience followed by qualification conversation and call-offer logic. The Super Admin Website Chat board provides a conversation oversight/human-takeover surface.

The chat and avatar systems are related lead-capture channels, not the same transport. Visitor permissions, browser media setup and external service state affect the avatar's live experience.

---

## 14. Lead acquisition, enrichment, compliance checks and distribution

### Supply pipeline

**Raw input → phone append → phone/carrier validation → DNC/litigator scrub → ready/distribution → human or AI work queue.**

The Lead Vault records batch/source information, identity/contact details, append results, validation outcomes, scrub flags, assignment and downstream IDs.

### Available tools

- CSV/batch upload surfaces and mapping.
- Social/text distress-signal lead discovery through the scraping path.
- Tracerfy phone append.
- Phone-validation providers with key usage tracking.
- DNC/state-DNC/litigator screening through the scrub integration.
- Smart Lead scoring/rejection feedback and configuration.
- Cross-system identity resolution and enrichment.
- Assignment and distribution to Fronter, AI dialer or marketing destinations.
- Protoface token generation/retention during relevant distribution/invitation paths.

External data can be stale or incomplete. Screening is an operational safeguard, not a legal certification or proof that every record is callable. No solar-permit acquisition implementation was established by this review; offering or market narrative is not implementation evidence.

---

## 15. Email templates, campaigns, tracking and marketing

### 15.1 Templates and contact-card actions

Coach and Fronter template managers support named templates, subjects, bodies, personalization, tracking settings, signature behavior and display as contact-card buttons where configured. Coach template types cover manual, night-before, hour-before and custom-automation use.

Using a saved template from the call script reduces inconsistent copy and disconnected send histories. Credential/welcome sends and bulk outreach are intentionally distinct operational paths.

### 15.2 Current transport architecture in code

| Transport / service | Role in the implementation | Important distinction |
|---|---|---|
| Gmail | Shared tracked Coach credentials/template sending, Fronter credentials, connected-account sending | `sendDebtEmail` delegates to the Gmail-backed shared sender; the older report's blanket SMTPfast description was inaccurate |
| SMTPfast | Dedicated outreach/marketing sending paths | Separate provider path; sensitive-link tracking exclusions are applied in relevant templates/sends |
| Mailjet | Existing legacy/rate-drop/template/webhook paths | Presence does not mean it is today's chosen or healthy sending lane |
| Platform email integration | Certain template/test or transactional paths | Must inspect the specific caller before assuming it is the sender for a given flow |

This report does not certify credentials, authorizations, delivery reputation or provider uptime. It does not expose secret values.

### 15.3 Universal Gmail message tracking

The shared message engine supplies per-send tracking tokens and a durable EmailMessage record associated with contact, template, sender/source and send identifiers. It supports duplicate protection and email asset preparation in that lane.

Open/click endpoints and provider callbacks feed tracking records. Contact badges/timelines and engagement reporting consume those records. Reply/bounce fields exist in the model; reliable population still depends on the implemented/provider reconciliation paths, so their mere presence is not proof of complete reply synchronization.

### 15.4 Campaign management

The campaign workspace includes:

- Template library.
- CSV upload and column mapping.
- Recipient normalization, matching/deduplication and exclusions.
- Personalization and test/preview steps.
- Recipient approval before sending.
- Launch/monitor controls.
- Batch size and batch interval.
- Daily limits and sending windows/timezone.
- Pending/sent/failed/skipped recipient outcomes.
- Campaign-level send/open/click/unsubscribe summaries.

The campaign data model preserves imported source/mapping information and the relationship to contact cards, making incorrect mappings diagnosable instead of invisible.

### 15.5 Rate-drop and sequence engines

The rate-drop system has templates, mailer generation, send records and campaign scheduling modes for all-at-once, staggered and repetitive sending. Debt Coach marketing adds sequence/send/report records and a recurring runner.

Suppression/opt-in/unsubscribe handling and commercial-template requirements must be checked on the actual sending path. This documentation is not a legal-compliance certification of every legacy template.

---

## 16. Scheduling, reminders, rescheduling and assistant tasks

### Customer appointments

- Detect agreed appointment information from the conversation.
- Preview/approve relevant appointment information in the call flow.
- Create Google Calendar events through the scheduling handler.
- Store the event ID/link and appointment details on the contact.
- Support confirmation, change request and tokenized public rescheduling.
- Configure night-before and one-hour reminder templates and per-contact reminder flags.
- Expose reminder engagement badges.
- Offer missed-appointment recovery/reschedule behavior.

An extracted appointment candidate is not automatically the same as a confirmed calendar booking. The host's preview/approval/scheduling step matters.

### Assistant operations

The Assistant portal includes Alert Center, My Tasks, Calendar, Fronter Team, Dialer, System Guide and other operational views. Its calendar contact card hosts configurable transfer, reminder, rebook and additional script tabs.

The next-three-hours window helps triage upcoming work. Appointment reminder popups and line-status broadcasting keep the fronting floor and assistant desk aligned.

### Tasks versus calendar events

My Tasks supports saving task records. A calendar-event import helper can create workable task rows for appointments/callbacks and avoid duplicates with a source key. This is a defined import path; the repository does not establish that every imaginable AI command creates a new AssistantTask automatically.

The engagement follow-up rule creates a calendar event. Calling that a task is reasonable in business language, but it should not be confused with inserting an AssistantTask record.

---

## 17. Knowledge management, script generation and continuous improvement

### 17.1 Knowledge sources

The knowledge managers distinguish scripts, customer Q&A, documents, websites and recorded-call material. Supporting tools ingest text/files, scrape URLs, transcribe audio and generate answer variations. An AI KB chat offers conversational ingestion.

This gives human reps, Q&A assistance, training and configured AI agents a shared information supply, while preserving distinct source/review paths.

### 17.2 AI Script Builder

**Where:** Coach → Admin → AI Script Builder.

Input can be an uploaded source, pasted text or a saved script. The interface builds a proposal section by section for:

1. Fronter scripts: opener, discovery, rebuttals and close.
2. AI agent outbound/inbound configuration.
3. Objection/rebuttal material.
4. Common Fronter questions/answers.
5. Main knowledge-base content.

The proposal preview groups what will go where. **Generate does not equal Apply:** the tool explicitly waits for Apply before writing the proposed material. This makes it a controlled script-system authoring tool rather than a text generator disconnected from production configuration.

Applying multiple sections is a multi-write operation, not a demonstrated transactional deployment of every destination. Review the proposal and result before assuming every section is active.

### 17.3 Tuning and learning

The platform includes tuning surfaces for prompts, intent/coaching rules, objections and relevant agent settings. Finished transcripts can generate proposed Q&A for human review before promotion into the reusable knowledge base.

Scheduled synchronization connects debt knowledge, objection material and BOB script access. The mechanism updates/reuses application knowledge; it does not retrain the speech or foundation model itself.

### 17.4 Script backups

The nightly backup handler reads opted-in DebtScript records, creates ScriptBackup copies and removes backups outside its seven-day retention window. This is useful protection for the covered script family.

The Fronter editor also exposes a backup flag, but the inspected backup handler reads DebtScript, not FronterScript. A Fronter checkbox alone is therefore not evidence of completed Fronter backup coverage. This review documents the boundary rather than silently changing behavior.

---

## 18. BOB training, hiring, workforce and performance management

### BOB practice

Coach and Fronter training surfaces provide script practice, scenario/objection material and conversational role play. Coach's personality-difficulty framing uses the duck-to-cow spectrum. Supporting views include mock financial/credit-report material, script panels and call-style assistance.

The Fronter training implementation includes transfer and email-related simulation surfaces. Training simulation should not be described as production email/call execution without checking that host's handler.

### Hiring and onboarding

Interview tools support recording/transcription and AI-assisted review. Training sessions and attendees have dedicated records and scheduling surfaces. Fronter onboarding and agreement/payment-related views support the workforce lifecycle.

### Performance

The platform contains rep reports, manager reports, call QA/audits, time-clock/worked-time records, feedback, bonus-related views and work-report submission. AI usage/cost records support management accountability as well as coaching.

Long recordings/transcripts have historically created storage pressure. Existing cleanup and transcript processing help manage that; they do not establish unlimited duration or storage capacity.

---

## 19. Management, compliance and operating controls

### Manager portal

Employees, live/dialer detail, reports, hot-call settings/alerts, transcripts, compliance monitoring and review support floor management. Role-aware visibility is implemented by the app's existing portal role model.

### Super Admin Command Center

Coach and Fronter boards can be viewed independently or side by side. Additional surfaces cover the Fronter monitor, Website Chat, marketing, engagement, an inbound handset and system status cards.

### Compliance management

The compliance system has rules/knowledge, scanning, issue records, notes, remedies and reviewer surfaces. A live widget and alerts bring findings into the call experience. The case card separates overview, transcript/issues, notes and remedy.

DNC screening, consent records and call-hour safeguards supplement this layer. Their existence is not proof of regulatory compliance across every jurisdiction or campaign.

### Automations & Scoring

**Where:** `/automations`.

The screen contains:

- **Automations & AI rules:** per-item switches/timing controls and operating information.
- **What each one does:** human-readable trigger/action explanations.
- **Scoring:** thresholds, weights, patterns and associated engagement settings.

`AutomationConfig` stores enabled-state, timing overrides and run-bookkeeping data. The gate is enforced inside the cooperating handler; a throttled run skips invocations that arrive too soon.

Changing a minimum interval does **not** rewrite a workflow cron or make it fire faster than the underlying trigger. Last-run bookkeeping is not the same as successful completion of every step. The screen's dead-auto-tag warning is meaningful, not merely an inactive switch.

### App-wide AI console

The command console can query supported application data and perform limited explicitly requested updates. Protected fields/allowed tools bound its writes. A dedicated welcome-email tool is an exception to its otherwise read-only helper-function calling surface.

This is not unlimited admin power, and the presence of a navigation or query capability should not be confused with an ability to change every configuration or delete records.

---

## 20. Investor / offering CRM and document engagement

The investor side combines public offering content, access requests, a gated document experience, investor/contact activity and electronic-signature integration.

Capabilities represented in the implementation include:

- Access-request and portal-control workflows.
- Investor profile/contact management.
- Offering and growth-plan content.
- Session/site activity and document-view/download information.
- Investor analytics and recent activity views.
- Signature-request creation and status handling through the proxy/integration path.
- Accreditation-related document records.
- Offering-specific knowledge and outreach material, including NB Tech content.

Document/route references in promotional or offering pages are not automatically evidence that a corresponding independent screen is registered. The actual router governs reachability.

This is a software capability description, not verification of an offering's legal status, securities compliance, customer engagement, fundraising performance, financial projections or investment returns.

---

## 21. Workspace navigation and feature-location directory

### 21.1 Coach: `/debt-call-coach`

The current tab registry defines 25 tabs, shown according to the existing role flags. Supported tabs can be reordered between two rows and saved per user. A tab deep-link uses `/debt-call-coach?tab=<id>`.

| Tab | ID | Main capability |
|---|---|---|
| Live Call | `live` | Dial/contact workspace, live transcript and AI support |
| Scripts | `scripts` | Interactive authoring, tags, teleprompter and task buttons |
| Closing | `closing` | SmartClose and saved closing progress |
| Calls | `calls` | Call/transcript/report history |
| New Leads | `newleads` | Assigned incoming leads |
| Hot Leads | `hotleads` | Priority leads and upcoming meetings |
| BOB Training | `bob` | Role play and script practice |
| Marketing | `marketing` | Marketing sequences and operations |
| Lead Gen | `leadgen` | Discovery/scraping tools |
| Smart Leads | `smartleads` | Lead scoring and feedback |
| Pipeline | `pipeline` | Stage/deal management |
| Pitches | `pitches` | Closer pitch library |
| Emails | `emails` | Coach templates and contact-card email actions |
| Email Campaigns | `campaigns` | Import, review, launch and monitor |
| Email Engagement | `engagement` | Scoring and ranked follow-up |
| Objections | `objections` | Objection knowledge and management |
| Knowledge Base | `kb` | Approved information/content management |
| AI KB Chat | `kbchat` | Conversational ingestion |
| Prospects | `profile` | AI-built prospect information |
| My Stats | `stats` | Personal calling metrics |
| Compliance | `compliance` | Relevant compliance portal view |
| AI Credits | `aicredits` | Usage breakdown |
| AI Reports | `aireports` | Cost/accountability reports |
| ProtoFace | `protoface` | Avatar/qualification configuration |
| Admin | `admin` | Users, settings and AI Script Builder |

Examples: Scripts → `/debt-call-coach?tab=scripts`; email templates → `/debt-call-coach?tab=emails`; AI Script Builder is inside Admin, not a separate top-level route. Not every role sees every tab.

### 21.2 Fronter: `/fronter`

Main views include **Prospects, Leads, Queued No Connect, Migrated, Closed Deals, Reports, Feedback, BOB Training, HR and Settings**, with admin script/agent/email/opt-in tools and marketing access as defined by that page.

The most important advanced tools are on the **contact card's Script view**, not merely the admin script library: inline fields, AI Review, Debt Confirm, AI Input, Send Email and Completed Steps/transfer continuation.

The floor also supplies availability/line indicators, clocks, quick dial, notes/attachments, hold-audio tools, checklists, tracking badges, meeting/merge/transfer views and Lead Vault management where authorized.

### 21.3 Assistant: `/assistant-portal`

Alert Center; My Tasks; Calendar; Fronter Team; Dialer; System Guide; Marketing; Email Engagement; and the super-admin contact-card editor where available. The calendar card contains the configurable operational scripts.

### 21.4 Management and oversight routes

| Route | Main areas |
|---|---|
| `/manager-portal` | Employees, Hot Call, Transcripts, compliance views |
| `/compliance-portal` | My Compliance, Monitor and Admin |
| `/superadmin-portal` | Coach, Fronter, Fronter Monitor, Website Chat, Split Screen, Marketing, Email Engagement |
| `/admin` | General CRM/investor records, Leads, calendar, analytics/activity, SMS, marketing, knowledge, signature, portal controls and settings |
| `/adminfrontpage` | Admin navigation/entry surface |
| `/email-engagement` | Dedicated engagement console |
| `/automations` | Central automation/scoring controls |
| `/interviews` | Interview workflow |
| `/training` | Training workflow |

### 21.5 Public, client, investor and utility routes

| Route(s) | Purpose |
|---|---|
| `/` | Homepage and qualification chat |
| `/qualify` | Video/voice qualification |
| `/credit` | Credit-report upload flow |
| `/reschedule` | Client rescheduling |
| `/optin`, `/optin/screenshot`, `/email-optin` | Consent/opt-in surfaces |
| `/portal` | Investor portal |
| `/investor-page`, `/offering`, `/growth-plan`, `/DirectD` | Investor/offering content |
| `/request-access` | Access-request surface |
| `/aboutdebt`, `/stories/:slug`, `/privacy`, `/terms` | Information and policies |
| `/work-report`, `/log` | Work/reporting utility surfaces |
| `/live-codebase-explorer` | Codebase explorer surface |
| `/portal-login`, `/admin-login`, `/debt-call-coach-login` | Existing login entry points |

This is a route inventory, not a proposal to change authentication or expose currently restricted content.

---

## 22. Technical architecture, data flows and integration map

### 22.1 Application layers

| Layer | Responsibility | Examples |
|---|---|---|
| React/Vite UI | Workspaces, cards, scripts, dialogs and user actions | Coach, Fronter, Assistant, manager/admin pages |
| Shared frontend utilities/hooks | Script interpretation, token substitution, capture cadence, voice interaction and layout | `scriptSubstitute`, `useAIContactFiller`, `useCoachTabOrder` |
| Backend handlers | External-service calls, validation, orchestration and application actions | `aiContactFiller`, `sendDebtEmail`, `fronterCall`, `saveCallOutcome` |
| Shared backend modules | Single implementations reused across handlers | `emailMessageEngine`, `debtEmailSender`, `aiAgentHelpers`, `automationRules` |
| Entity storage | Durable contacts, transcripts, messages, config, audit-related records and reports | `DebtLead`, `FronterLead`, `EmailMessage`, `ScoringConfig` |
| Workflow layer | Schedules and data-event triggers | Reminders, campaigns, knowledge sync, follow-up, reports |
| External media/services | Telephony, transcription, speech, avatar rooms, email and data enrichment | Twilio, Deepgram, ElevenLabs, LiveKit, Gmail and others |

### 22.2 Key data paths

**Human scripted call**  
Contact → personalized script → live transcript → inline action / assisted extraction → saved contact + notes → send tracking / closing / transfer.

**Autonomous phone transfer**  
Lead/agent config → call transport → conversation → transfer decision → contact/debt extraction + optional credentials + summary → routing + outcome records.

**Behavioral follow-up**  
Tracked email → event record → follow-up processor → qualifying pattern → follow-up email → open of matching follow-up send → calendar call event.

**Lead supply**  
Upload/discovery → vault → append/validate/scrub → assignment/token → Fronter/AI work → migration into Coach where applicable.

**Knowledge improvement**  
Source/script/transcript → extraction/proposal → review/Apply → approved knowledge/script/config → future calls and training.

### 22.3 Key function families

| Domain | Principal handlers |
|---|---|
| Script-driven/CRM actions | `debtConfirm`, `aiInputSummary`, `aiContactFiller`, `saveCallOutcome`, `aiScriptBuilder`, `aiTunerChat` |
| Live intelligence | `liveAssistantAI`, `liveAssistantResearch`, `processTranscriptLearning`, `consolidateTranscript`, `generateManagerReport` |
| Calling | `fronterCall`, `twilioCall`, `twilioCallWithCPA`, `twilioCallCallback`, `twilioCallLogs`, `twilioGetLines`, token handlers |
| Agent call paths | `aiAgentDial`, `aiAgentRespond`, `aiAgentPipeline`, `mediaStreamRelay`, `dialerVoiceHandler`, `bridgeKeepalive` |
| Avatar/qualification | `stephaniAgent`, `vapiQualify`, `vapiWebhook`, `vapiBridgeTwiml`, `protofaceAdmin`, `analyzeRosieSession`, `aiInviteLinks` |
| Email/campaigns | `sendDebtEmail`, `sendFronterCredsEmail`, `sendGmailEmail`, `sendFronterMarketingEmail`, `emailCampaignImport`, `emailCampaignSend`, `runEmailCampaigns` |
| Tracking/scoring | `emailTrackOpen`, `emailTrackClick`, `processEmailTrackingEvent`, `engagementReport`, provider webhook handlers |
| Appointments | `autoScheduleAppointment`, `aiScheduleAgent`, `googleCalendarSync`, `listCalendarEvents`, `confirmAppointment`, `requestApptChange`, `bookReschedule` |
| Supply/enrichment | `scrapeSocialLeads`, `tracerfyBatch`, `validateVaultPhones`, `dncScrubVault`, `distributeVaultLeads`, `resolveLeadIdentity`, `leadCrossEnrich` |
| Knowledge | `kbChatIngest`, `kbExtractFile`, `kbScrapeUrl`, `generateKBVariations`, `syncDebtKB`, `syncObjectionsToKB`, `getScriptsForBob` |
| Operations | `automationOverview`, `complianceEngine`, `complianceAdmin`, `fronterPerformanceAudit`, `aiCostReport`, `backupScripts`, cleanup handlers |
| Investor/messaging | `portalLogin`, `dataRoomAccessRequest`, `signnowProxy`, Sheets-sync handlers, `sendSms`, `smsWebhook`, `smsOptIn` |
| General assistant | `appAgent`, `homeQualifyChat` |

The earlier technical report contains a longer handler-by-handler inventory. This master overview groups capabilities rather than treating a maintenance utility as a customer-facing feature.

### 22.4 Integration roles

Twilio handles calling/SMS. Deepgram handles streaming transcription and relevant speech paths. ElevenLabs supplies voice generation/listing. Anthropic-backed model calls and built-in AI calls support extraction, coaching and generation. LiveKit/Protoface-related services support avatar/media-room paths; Vapi-related handlers support qualification/call events. Gmail and Google Calendar connectors serve company email and scheduling; separate SMTPfast/Mailjet paths serve their relevant outreach/legacy jobs. Tracerfy, phone-lookup providers, LandlineRemover and Apify support lead operations. The signature proxy and sheet synchronization support the investor/reporting side.

This is a role map drawn from code. It intentionally does not assert that a connector is currently authorized, a key is set or a provider account is healthy merely because integration code exists.

### 22.5 Access and data handling

The app uses existing platform-auth and app-specific portal/session paths. Its portal model includes cumulative staff roles, and sensitive administrative operations use relevant backend gates. Entity access rules differ by schema; some historical schemas are permissive. This document does not certify complete tenant isolation or perform a security assessment.

Files and transcripts are referenced by stored fields/URIs according to the relevant path. Structured financial collections should be validated and merged. Secrets should remain out of documentation, client-visible configuration and exported reports.

---

## 23. Automation catalog and real operating boundaries

The following are the **22 workflow definitions found in the repository**. Times are expressed as the definition's schedule/cadence; daily cron times must be interpreted with the workflow's configured timezone, not assumed to be the reader's local time. Active/paused status and recent success were not tested in this documentation pass.

| Workflow | Trigger/cadence in definition | What it invokes / does |
|---|---|---|
| Appointment Reminders | Every 15 minutes | `sendAppointmentReminders` checks eligible reminders |
| Auto-Tag NB Tech Leads | Lead entity events | References `autoTagNbTechLeads`; that target is missing and the app warns about it |
| Bridge Keepalive | Every 10 minutes | Keeps the external call bridge warm |
| Cleanup Expired BOB Sessions | Hourly | Removes expired training-session data |
| Cleanup Soft-Deleted Leads | Daily | Applies delayed deletion cleanup |
| Connector Keepalive | Every four hours | Connector maintenance call |
| Debt Coach Marketing Engine | Every five minutes | Sequence/campaign work in `debtMarketingRun` |
| Debt Coach Marketing Nightly Report | Daily | Marketing summary/report processing |
| Email Follow-Up Automation | Created tracking-event records | Follow-up and calendar-event processor |
| Fronter Meeting Reminders | Every 15 minutes | Internal meeting reminder handler |
| Fronter Performance Audits | Every 10 minutes | Floor QA/audit handler |
| Fronter Quote Broadcaster | Every 15 minutes | Due quote posting |
| NB Tech Campaign Runner | Five-minute interval | Campaign queue processing |
| Nightly AI Cost Report | Daily | Usage/cost report generation |
| Nightly Script Backup | Daily | Opted-in DebtScript backups |
| Rate Drop Mailer Engine | Every five minutes | Due mailer/campaign work |
| Scrape Social Leads 4x Daily | Four scheduled daily ticks | Lead discovery handler |
| Sync Debt KB | Every two hours | Debt knowledge synchronization |
| Sync Investors to Google Sheets | InvestorUser entity events | Investor export/synchronization |
| Sync Leads to Google Sheets | Lead entity events | Lead export/synchronization |
| Sync Objections to KB | Every two hours | Objection-knowledge synchronization |
| Sync Scripts for BOB | Every two hours | BOB script-access/sync handler |

### Runtime switches and timing

The shared automation switch catalog contains timed, event and scoring-rule entries. It includes follow-up, hot alerts, campaign/reporting, bot filtering, migration floor, reminders, scraping, synchronization, backups, cleanup, audits, cost reporting and maintenance.

A switch can stop participating code or a rule from doing work. A timing override can throttle eligible invocations. It is not a generic natural-language workflow designer and does not turn any arbitrary script tag into a new scheduled task.

### What this review did not claim

- It did not run campaigns or send customer mail.
- It did not place live calls or transfers.
- It did not change thresholds, schedules or permissions.
- It did not verify every external callback, provider account or workflow run.
- It did not mark the missing NB Tech auto-tag target as working.
- It did not certify a multi-record transaction or universal audit logging.

---

## 24. Benefits and connected operating scenarios

### Scenario A: a representative stays inside the script

A customer corrects their email. The Fronter edits the inline Email field and presses Update. The script's personalization uses the current record. At the debt question, Debt Confirm extracts the stated figures. AI Input adds the call summary. Send Email sends the master credentials/welcome message. Completed Steps opens the transfer continuation.

**Benefit:** fewer context switches, less duplicate typing and a repeatable handoff. This scenario combines human-triggered actions; it should not be sold as the script independently listening for and executing all those clicks.

### Scenario B: the AI handles the preparation before transfer

The autonomous phone conversation reaches a transfer decision. Shared preparation extracts contact/debt information, optionally sends the credentials email, generates notes and updates the lead before the call-control path routes onward.

**Benefit:** the receiving team gets a more prepared conversation instead of an unexplained phone call. Individual steps can fail or be skipped; the result is not a guaranteed atomic operation.

### Scenario C: engagement becomes a next action

A prospect opens the credentials message and visits enough tracked review/company sites to satisfy the saved rule. The event-driven processor attempts the follow-up email. A later open of that follow-up creates a calendar call event, subject to its checks and availability handling.

**Benefit:** outreach interest becomes actionable follow-up without manually watching every tracking log.

### Scenario D: conversation becomes durable CRM data

The call produces transcript facts, periodic accepted field updates, later corrections, intent information and final reports. The next call can start with the profile, memory and playbook rather than relying on the rep to remember a previous conversation.

**Benefit:** less knowledge loss between calls and better continuity between staff. AI-derived information remains reviewable and dependent on transcription accuracy.

### Scenario E: one source improves scripts and agent knowledge

An administrator supplies a new approved script to the AI Script Builder, reviews proposed scripts, AI agent configuration, rebuttals and knowledge, and applies the chosen proposal through the tool.

**Benefit:** human and autonomous conversation material can be evolved together instead of updating disconnected tools by hand.

### Scenario F: management sees operational evidence

A manager reviews live hot-call cues, transcript/quality information, compliance findings, rep reports and AI usage/cost evidence. An administrator changes supported scoring or automation settings centrally.

**Benefit:** oversight is grounded in recorded actions and conversations rather than a rep's end-of-day memory.

### Overall value proposition

The strongest positioning is **an integrated, script-driven sales and service operating platform with live AI assistance and automated follow-through**. The value comes from the chain connecting scripts, conversations, records, messaging, routing, engagement and management, not from any single chatbot or dashboard tile.

This document makes no quantified conversion, cost-saving or performance promises. Those require measured operational evidence.

---

## 25. Evidence index, corrections and readiness notes

### 25.1 Primary implementation evidence for the previously omitted features

| Claim | Source inspected |
|---|---|
| Task markers and speech-following teleprompter | `src/components/debt/ScriptTeleprompter.jsx` |
| Insert variables, cues, field tags and actions | `src/components/debt/DebtScriptInsertToolbar.jsx` |
| Coach action handlers | `src/components/debt/DebtScriptEditor.jsx` |
| Formatting controls | `src/components/debt/ScriptFormatToolbar.jsx`, `ScriptWysiwygEditor.jsx`, `ScriptRichText.jsx` |
| Fronter script actions and continuation split | `src/components/fronter/FronterContactCard.jsx`, `FronterContactScript.jsx`, `FronterMergePopup.jsx` |
| Inline contact updates | `src/components/fronter/FronterInlineField.jsx`, `FronterScriptFieldPicker.jsx` |
| AI-tag catalogs | `src/lib/debtContactFields.js`, `debtContactDetailFields.js`, `fronterContactFields.js` |
| Live field substitution | `src/lib/scriptSubstitute.js` |
| Five-minute incremental capture and final pass | `src/hooks/useAIContactFiller.js` |
| Field validation, script-tag context and collection merge | `base44/functions/aiContactFiller/entry.ts`, `base44/shared/debtFieldCollections.ts` |
| Specialist extraction and call-end orchestration | `src/components/debt/DebtLiveCall.jsx` |
| Voice and natural-language updates | `src/components/debt/VoiceFieldUpdater.jsx`, `LiveProfileAgent.jsx` |
| Debt extraction and call summaries | `base44/functions/debtConfirm/entry.ts`, `aiInputSummary/entry.ts` |
| Instant template sending | `base44/functions/sendDebtEmail/entry.ts`, `sendFronterCredsEmail/entry.ts`, `base44/shared/debtEmailSender.ts` |
| Autonomous handoff preparation | `base44/shared/aiAgentHelpers.ts`, `base44/functions/mediaStreamRelay/entry.ts` |
| Tracking-triggered follow-up and calendar event | `base44/functions/processEmailTrackingEvent/entry.ts`, Email Follow-Up Automation workflow |
| Narrow AI-console email capability | `base44/functions/appAgent/entry.ts` |
| Script-system generation and approval | `src/components/debt/AIScriptBuilderTab.jsx`, `AIScriptProposalPreview.jsx`, `base44/functions/aiScriptBuilder/entry.ts` |
| Runtime switches and scoring controls | `base44/shared/automationRules.ts`, `scoringConfig.ts`, `src/pages/AutomationCenter.jsx` |
| Coordinated call persistence | `base44/functions/saveCallOutcome/entry.ts` |
| Task import from appointments/callbacks | `src/components/assistant/tasks/importCalendarEvents.js` |
| Actual route/tab inventory | `src/App.jsx`, `src/lib/coachTabs.js`, portal page shells |

### 25.2 Corrections to the earlier overviews

1. **Scripts were under-described.** They contain actionable controls, collection tags, personalization, speech sync, formatting, inline Fronter fields and transfer/closing continuation, not just stored reading material.
2. **Instant and automatic are different.** Human script email buttons are one-click actions; AI-agent transfer preparation and tracking-event follow-up are examples of automatic orchestration.
3. **Coach template email uses Gmail in the inspected path.** The older blanket SMTPfast statement was incorrect for `sendDebtEmail` and the shared Coach sender.
4. **One save handler is not a database transaction.** The outcome handler coordinates several writes and reports steps; “atomic and impossible to lose a partial result” was too strong.
5. **Correction logging is not universal auditing.** The filler's AI Populate log captures relevant replacements, not every write from every tool.
6. **Editor catalogs do not override validation.** Tag availability and server-writable fields are not automatically identical in every mode.
7. **Fronter automatic capture and script-aware review differ.** The selected script is passed by explicit card review; the inspected generic dialer filler does not supply the same script context.
8. **Backup coverage differs by record family.** The inspected nightly job backs up opted-in DebtScript records, not every Fronter script merely because its editor has a checkbox.
9. **A follow-up calendar call is not guaranteed within an hour.** The initial target is around 45 minutes, with conflict shifts afterward.
10. **Knowledge improvement is not model retraining.** Approved content is added to application knowledge; the system does not thereby train a new foundation model.
11. **Workflow presence is not live success.** The missing `autoTagNbTechLeads` target is explicitly identified as non-working in the automation catalog.
12. **Counts are source snapshots.** Current physical counts are 139 handler entries, 121 entity schemas, 22 workflow definitions, 43 shared modules, 485 JSX components and 36 route declarations. Earlier counts should not be mixed with this snapshot.
13. **A standalone component is not a reachable feature.** The profile mounts Live Agent with voice support; the separate VoiceFieldUpdater implementation was not mounted in the inspected hosts. The location directory reflects the reachable Live Agent rather than inventing a Voice Update button.

### 25.3 Readiness and limits

**Reviewed:** source wiring for the named capability families, exact script markers, inline field save path, action handlers, capture cadence, AI-agent preparation, follow-up conditions, scheduling behavior, scope of validation/logging, central switch semantics and the repository inventory.

**Not live-tested in this documentation pass:** customer email delivery, calling/pickup/transfer/media playback, second-user role behavior, avatar conversation/room connection, production workflow activity, campaign import/send, signature delivery, provider credentials and security isolation.

Historical issues in the earlier report remain historical reports unless a specific fix/test establishes their present status. This overview does not silently mark them fixed or still failing.

**No calling, emailing, records, permissions, routing, schedules or business behavior were changed to produce this report.**

---

## Final summary

The platform's advanced capabilities are the interactive script engine; field- and section-aware AI collection; on-the-fly record editing; instant tracked email; AI-prepared handoffs; behavior-driven follow-up; call intelligence and cross-call memory; connected lead supply, scheduling, training, compliance and management tools; and central operating controls.

The precise technical story is not “AI does everything automatically.” It is **a connected operating system in which scripts guide actions, AI assists conversations and structured capture, explicit triggers coordinate follow-through, and records preserve the context for the next person and the next call**.