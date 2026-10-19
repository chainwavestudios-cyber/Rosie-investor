import { useState } from 'react';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const CYAN = '#22d3ee';
const AMBER = '#f59e0b';

const SECTIONS = [
  {
    id: 'overview', icon: '🏠', color: GOLD, title: 'Platform Overview',
    body: `This is the RoieAI operations platform — an AI-driven lead management, dialer, and debt-settlement enrollment system. It connects Twilio (telephony), Deepgram (speech-to-text), ElevenLabs (text-to-speech), and Anthropic/Google LLMs to run both human and AI sales agents.

The assistant (you) has Super Admin access across every system. You can confirm appointments, transfer calls, manage the fronter team, monitor live calls, and respond to customer engagement alerts.

Key portals:
• /debt-call-coach — the dialer/coach workspace (enrollment calls)
• /fronter — the fronter workspace (outbound lead qualification)
• /manager-portal — team management, transcripts, compliance
• /assistant-portal — this dashboard (your right-hand command center)
• /compliance-portal — compliance monitoring & records
• /interviews & /training — hiring and onboarding`
  },
  {
    id: 'debtcoach', icon: '🎯', color: BLUE, title: 'Debt Call Coach (/debt-call-coach)',
    body: `The Debt Call Coach is where enrolled leads are worked to completion. After a fronter transfers a prospect, a DebtLead is auto-created and assigned to a coach.

Core flow: Prospect → Contacted → Qualified → Enrolled (or Declined/Callback).
• Each lead has a full contact card: debt amount, creditors, income, hardship, credit score, and a closing checklist.
• Coaches use a Twilio softphone dialer with live Deepgram transcription and an AI assistant that suggests next questions and auto-fills the contact card from the conversation.
• Appointments are booked into Google Calendar; reminder emails (night-before, 1-hour-before) send automatically and track opens/clicks.
• Hot leads can be tagged for priority follow-up. Deal score (0–100) tracks enrollment progress.
• Leads migrated from fronter are flagged and shown in a dedicated "Migrated" sub-tab.`
  },
  {
    id: 'fronter', icon: '📞', color: GOLD, title: 'Fronter System (/fronter)',
    body: `Fronters make the first outbound calls to raw leads, qualify them, and warm-transfer interested prospects to a coach.

• Leads are imported into the Lead Vault, validated (Tracerfy phone-append → Twilio carrier lookup → LandlineRemover DNC/litigator scrub), then distributed to fronters.
• Each fronter has an assigned Twilio line, a script window, a contact card, and a live Deepgram-transcribed dialer with mute/hold/transfer/merge.
• BOB is the AI training partner fronters practice against (role-play scenarios with feedback).
• Fronter performance reports are auto-generated (script adherence, objection handling, transfer rate).
• Heads-up alerts let fronters flag a hot prospect for a coach to grab immediately.
• Call cutoff: 8am–8pm local to the prospect's area code (super admins can override).`
  },
  {
    id: 'ai', icon: '🤖', color: PURPLE, title: 'AI Systems',
    body: `Several AI agents and models run across the platform:

• AI Voice Agent — answers inbound (and makes outbound) calls via a Media Stream bridge to Deepgram (STT) + ElevenLabs (TTS) + an LLM. Configured in AIAgentConfig (greeting, system prompt, STT/TTS engines, transfer targets, knowledge bases). Strictly no Twilio native Gather/Voice AI — only Deepgram + ElevenLabs + LLM.
• BOB Trainer — role-play partner for fronters; pulls scripts from FronterScript and knowledge bases.
• AI Contact Filler — listens to live transcripts and auto-populates lead contact cards.
• Live Assistant — in-call AI that suggests questions and research for coaches.
• InvokeLLM (platform) — the core LLM integration used for analysis, reports, and enrichment. Supports models: automatic, Gemini 3 Flash/Pro, GPT-5 variants, Claude Sonnet/Opus. Only Gemini models support live web search.
• Credit Report Analyzer — reads uploaded credit report photos and extracts tradelines/debt.
• Performance Audit — generates fronter coaching reports from transcripts.`
  },
  {
    id: 'alerts', icon: '🔔', color: AMBER, title: 'Alerts & Engagement Tracking',
    body: `Customer engagement is tracked end-to-end so you can act on it:

• Email opens & link clicks — every reminder email is tracked (EmailTrackingEvent). The DebtLead stores apptEmailOpenedAt, apptBbbClickedAt, apptTrustpilotClickedAt, apptWebsiteClickedAt.
• Audio message — personalMessageAudioPlayedAt fires when a prospect finishes watching their personal audio message on the external site.
• Hot call alerts — high-intent calls trigger HotCallAlert records in real time.
• Fronter heads-up — fronters flag prospects needing immediate coach attention (FronterHeadsUp).
• Reschedule requests — appointmentChangeRequested flags prospects who asked to rebook.
The Alert Center (this portal) aggregates all of these in one live feed.`
  },
  {
    id: 'telephony', icon: '☎️', color: CYAN, title: 'Telephony (Twilio)',
    body: `Twilio powers all calling. Multiple outbound lines are configured (TWILIO_FROM_NUMBER … TWILIO_FROM_NUMBER_6), each assignable to a fronter via FronterLineAssignment.

• Outbound dialing uses the Twilio Voice SDK (browser softphone) with a TwiML app that bridges to Deepgram media streams for AI calls.
• Calls support mute, hold, cold transfer, and warm merge (conference in a coach).
• Managers can listen / whisper / barge on any active fronter call (managerCallControl).
• Voicemail drops and inbound voicemail are handled by voicemailWebhook.
• Call recordings are stored privately and replayable via signed URLs.
• Twilio geo-permissions must be updated for non-US/Canada outbound.`
  },
  {
    id: 'calendar', icon: '📅', color: BLUE, title: 'Calendar & Appointments',
    body: `Appointments book into Google Calendar via the googlecalendar connector (Business Google Calendar).

• autoScheduleAppointment / aiScheduleAgent find open slots and create events.
• confirmAppointment marks a DebtLead's appointment confirmed.
• Reminder emails (night-before, 1-hour-before) send automatically via workflows; opens & clicks are tracked.
• Reschedule flow: prospects get a secure link (rescheduleToken) to pick a new slot (bookReschedule).
• noMissedMeetings guards against no-shows; sendMissedApptReschedule rebooks them.`
  },
  {
    id: 'vault', icon: '🔐', color: GOLD, title: 'Lead Vault & Validation Pipeline',
    body: `Raw leads enter the Lead Vault (LeadVaultEntry) and run through a validation pipeline before distribution:

1. Tracerfy phone-append — finds mobile/landline numbers for a contact (tracerfyBatch).
2. Twilio/Omkar validation — verifies carrier & line type (validateVaultPhones).
3. LandlineRemover scrub — checks federal/state DNC and litigator status (dncScrubVault).
4. Distribution — clean, callable leads are assigned to fronter or the AI dialer (distributeVaultLeads).
Leads flagged DNC or litigator are excluded from distribution.`
  },
];

const FUNCTIONS = [
  ['aiAgentDial', 'Initiates an outbound AI agent call'],
  ['aiAgentPipeline', 'Runs the full AI agent call pipeline (STT → LLM → TTS)'],
  ['aiAgentRespond', 'Generates the AI agent\'s next response in a live call'],
  ['aiContactFiller', 'Auto-populates lead contact card from call transcript'],
  ['aiScheduleAgent', 'AI-powered appointment scheduling'],
  ['aiTunerChat', 'Tunes/adjusts AI agent configuration via chat'],
  ['analyzeCreditReport', 'Extracts tradelines & debt from a credit report image'],
  ['appointmentVoiceHandler', 'Handles inbound appointment IVR calls'],
  ['autoScheduleAppointment', 'Books an appointment into Google Calendar'],
  ['confirmAppointment', 'Marks a DebtLead appointment as confirmed'],
  ['bookReschedule', 'Books a rescheduled appointment from a secure link'],
  ['debtCoachAuth', 'Debt Call Coach login / user management / voice login'],
  ['distributeVaultLeads', 'Distributes validated vault leads to fronters/AI'],
  ['dncScrubVault', 'DNC & litigator scrub via LandlineRemover'],
  ['tracerfyBatch', 'Phone-append batch via Tracerfy'],
  ['validateVaultPhones', 'Carrier/line-type validation via Twilio/Omkar'],
  ['fronterCall', 'Fronter dialer actions (hold, transfer, merge)'],
  ['fronterClientToken', 'Issues Twilio Voice SDK token for a fronter/admin'],
  ['fronterPerformanceAudit', 'Generates fronter coaching report from transcripts'],
  ['generateManagerReport', 'Generates a manager-level performance report'],
  ['googleCalendarSync', 'Syncs appointments to Google Calendar'],
  ['listCalendarEvents', 'Lists upcoming Google Calendar events'],
  ['managerCallControl', 'Listen / whisper / barge on a live fronter call'],
  ['sendAppointmentReminders', 'Sends night-before & 1-hour reminder emails'],
  ['sendMissedApptReschedule', 'Rebooks a no-show appointment'],
  ['sendDebtEmail / sendLeadEmail / sendCustomEmail', 'Send tracked email to leads'],
  ['sendGmailEmail', 'Send via the connected Gmail connector'],
  ['sendSms / smsOptIn / smsWebhook', 'SMS sending & opt-in handling'],
  ['twilioCall / twilioCallWithCPA', 'Outbound Twilio call (with CPA detection)'],
  ['twilioClientToken / twilioClientToken2', 'Twilio Voice SDK tokens'],
  ['twilioGetLines', 'Lists available Twilio outbound lines'],
  ['voicemailWebhook', 'Handles inbound voicemail & recordings'],
  ['processEmailTrackingEvent', 'Records email open/click tracking events'],
  ['emailTrackOpen / emailTrackClick', 'Tracking pixel endpoints for emails'],
  ['liveAssistantAI / liveAssistantResearch', 'In-call AI assistant for coaches'],
  ['scrapeSocialLeads', 'Scrapes debt-distress leads via Apify'],
  ['leadCrossEnrich', 'Cross-enriches lead data'],
  ['screenDebtFit', 'Screens a lead for debt-program fit'],
  ['syncToSheets / syncLeadToSheets / syncInvestorToSheets', 'Sync data to Google Sheets'],
  ['complianceEngine / complianceAdmin', 'Compliance monitoring & admin'],
  ['cleanupDeletedLeads / cleanupBobSessions', 'Maintenance / cleanup jobs'],
];

export default function SystemGuide() {
  const [open, setOpen] = useState('overview');
  const [q, setQ] = useState('');
  const filtered = FUNCTIONS.filter(f => f[0].toLowerCase().includes(q.toLowerCase()) || f[1].toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>📚 System Guide</div>
      <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '16px' }}>Everything you need to know about the platform — systems, AI, telephony, and every backend function.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
        {SECTIONS.map(s => {
          const isOpen = open === s.id;
          return (
            <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isOpen ? s.color + '55' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', overflow: 'hidden' }}>
              <button onClick={() => setOpen(isOpen ? '' : s.id)} style={{ width: '100%', background: 'transparent', border: 'none', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                <span style={{ fontSize: '18px' }}>{s.icon}</span>
                <span style={{ color: isOpen ? s.color : '#e8e0d0', fontSize: '14px', fontWeight: 'bold', flex: 1 }}>{s.title}</span>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <div style={{ padding: '0 16px 16px 46px', color: '#8a9ab8', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{s.body}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}>⚙️ Backend Functions ({filtered.length})</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search functions…" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {filtered.map(([name, desc]) => (
          <div key={name} style={{ display: 'flex', gap: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <code style={{ color: CYAN, fontSize: '12px', fontWeight: 'bold', minWidth: '200px', flexShrink: 0 }}>{name}</code>
            <span style={{ color: '#8a9ab8', fontSize: '12px' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}