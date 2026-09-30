/**
 * AboutDebt.jsx — Comprehensive guide explaining every feature of the
 * Debt Settlement Call Coach platform, how roles work, and how it all fits together.
 * Public page — no auth required.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const PINK = '#f472b6';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'roles', label: 'Roles & Access', icon: '👥' },
  { id: 'live', label: 'Live Call Workspace', icon: '📞' },
  { id: 'ai', label: 'AI Tools', icon: '🤖' },
  { id: 'bob', label: 'BOB Training', icon: '🎯' },
  { id: 'pitches', label: 'Closer Pitches', icon: '🎤' },
  { id: 'kb', label: 'Knowledge Base', icon: '🧠' },
  { id: 'profiles', label: 'User Profiles', icon: '👤' },
  { id: 'calls', label: 'Call History', icon: '📋' },
  { id: 'compliance', label: 'Compliance Module', icon: '🛡' },
  { id: 'manager', label: 'Manager Portal', icon: '🎛' },
  { id: 'admin', label: 'Admin & User Mgmt', icon: '⚙️' },
  { id: 'together', label: 'How It All Works', icon: '🔗' },
];

export default function AboutDebt() {
  const [active, setActive] = useState('overview');
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, color: '#e8e0d0' }}>
      {/* Hero */}
      <div style={{ padding: isMobile ? '40px 16px 28px' : '60px 32px 40px', borderBottom: `1px solid ${GOLD}22`, background: `linear-gradient(180deg, ${DARK}, #0d1b2a)` }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: GOLD, fontSize: isMobile ? '10px' : '12px', letterSpacing: isMobile ? '2px' : '4px', textTransform: 'uppercase', marginBottom: '12px' }}>Complete Platform Guide</div>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'normal', margin: '0 0 16px', lineHeight: 1.2 }}>
            💳 Debt Settlement Call Coach
          </h1>
          <p style={{ fontSize: isMobile ? '14px' : '16px', color: '#8a9ab8', lineHeight: 1.7, maxWidth: '700px', margin: '0 auto' }}>
            An AI-driven lead management and dialer platform that combines live call coaching, real-time speech analysis,
            roleplay training, compliance monitoring, and multi-role management — all built for debt settlement call centers.
          </p>
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/debt-call-coach-login" style={{ background: `linear-gradient(135deg, ${GOLD}, #22c55e)`, color: DARK, padding: '12px 28px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Login →</Link>
            <a href="#overview" style={{ background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', padding: '12px 28px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)' }}>Explore Guide</a>
          </div>
        </div>
      </div>

      {/* Layout: sidebar + content */}
      <div style={isMobile ? { display: 'flex', flexDirection: 'column' } : { display: 'grid', gridTemplateColumns: '240px 1fr', gap: '0', maxWidth: '1200px', margin: '0 auto', minHeight: '60vh' }}>
        {/* Sidebar nav — horizontal scrollable chips on mobile, vertical sidebar on desktop */}
        <div style={isMobile ? {
          position: 'sticky', top: 0, zIndex: 10, background: DARK,
          borderBottom: `1px solid ${GOLD}22`,
          display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 12px',
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        } : {
          borderRight: '1px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'sticky', top: 0, height: 'fit-content',
        }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => { setActive(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              style={isMobile ? {
                flexShrink: 0, whiteSpace: 'nowrap', padding: '8px 14px',
                background: active === s.id ? `${GOLD}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active === s.id ? GOLD + '55' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '20px', color: active === s.id ? GOLD : '#8a9ab8',
                cursor: 'pointer', fontSize: '12px', fontWeight: active === s.id ? 'bold' : 'normal',
                display: 'flex', gap: '6px', alignItems: 'center', fontFamily: 'Georgia, serif',
              } : {
                width: '100%', padding: '10px 20px', background: active === s.id ? `${GOLD}12` : 'transparent',
                border: 'none', borderLeft: `3px solid ${active === s.id ? GOLD : 'transparent'}`,
                color: active === s.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px',
                fontWeight: active === s.id ? 'bold' : 'normal', textAlign: 'left', display: 'flex', gap: '8px', alignItems: 'center',
                fontFamily: 'Georgia, serif',
              }}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: isMobile ? '24px 16px' : '40px 32px', maxWidth: isMobile ? '100%' : '800px' }}>
          <Section id="overview" title="🏠 Platform Overview" color={GOLD}>
            <p>
              The Debt Settlement Call Coach is a complete call center platform built specifically for debt settlement sales teams.
              It replaces the traditional "headset + notepad" workflow with an AI-powered workspace that listens to every call in real time,
              coaches the agent live, builds the client profile automatically, and ensures regulatory compliance — all while managers
              monitor from a dedicated portal.
            </p>
            <p>
              The platform integrates three external AI services:
            </p>
            <ul>
              <li><strong style={{ color: BLUE }}>Deepgram</strong> — real-time speech-to-text with speaker diarization (separating agent vs. customer) and sentiment analysis</li>
              <li><strong style={{ color: PURPLE }}>Anthropic (Claude)</strong> — the AI brain powering live coaching, Q&A, intent scoring, and fact extraction</li>
              <li><strong style={{ color: GOLD }}>Twilio</strong> — outbound dialing, call recording, and WebRTC-based call monitoring</li>
            </ul>
            <p>
              Every call is transcribed, analyzed, and saved. Every client interaction is captured as a structured profile.
              Every compliance violation is flagged. And every role — from dialer to super admin — has exactly the access they need.
            </p>
          </Section>

          <Section id="roles" title="👥 Roles & Access Hierarchy" color={GOLD}>
            <p>The platform uses a strict 5-level role hierarchy. Each role unlocks additional capabilities:</p>
            <RoleCard color={RED} name="Super Admin" icon="👑" level="Level 5 — Highest">
              Full control over everything. Can manage all users, roles, compliance settings, knowledge base, and system configuration.
              The only role that can create other admins.
            </RoleCard>
            <RoleCard color={GOLD} name="Admin" icon="⚙️" level="Level 4">
              Full feature access including user management, compliance administration, knowledge base editing, and all manager features.
              Cannot manage other admins or change system-level settings.
            </RoleCard>
            <RoleCard color={PURPLE} name="Super Manager" icon="🛡️" level="Level 3">
              Full manager features plus compliance monitoring — can view all dialers' compliance records, toggle compliance monitoring on/off
              per user, and inspect any compliance ticket. Cannot manage users or edit the knowledge base.
            </RoleCard>
            <RoleCard color={BLUE} name="Manager" icon="🎛️" level="Level 2">
              Can monitor live calls (listen, whisper, barge, takeover), view all dialer transcripts and profiles, leave coaching comments,
              and generate reports. Cannot manage users or access compliance admin.
            </RoleCard>
            <RoleCard color="#8a9ab8" name="Dialer" icon="📞" level="Level 1 — Base">
              The front-line agent role. Can make live calls, use AI coaching tools, train with BOB, view their own leads and profiles,
              and manage their own compliance remediation. Sees only their own data — leads, transcripts, and compliance records.
            </RoleCard>
            <InfoBox color={BLUE}>
              <strong>Lead Visibility:</strong> Dialers only see leads assigned to them (via the <code>debtCoachOwner</code> field).
              Managers and above see all leads, transcripts, and call data across the entire team.
            </InfoBox>
          </Section>

          <Section id="live" title="📞 Live Call Workspace" color={RED}>
            <p>
              The Live Call tab is the heart of the platform — a real-time coaching workspace that runs during every call.
              The agent puts on their headset, selects their microphone, clicks "Start Live Call," and the system takes over:
            </p>

            <FeatureCard color={BLUE} title="🎙️ Dual-Channel Audio Capture">
              The platform supports two audio modes:
              <ul>
                <li><strong>Single mic with diarization</strong> — one microphone captures both sides of the call; Deepgram's AI separates speakers</li>
                <li><strong>Dual-channel (Rodecaster)</strong> — agent mic on channel 0, customer audio on channel 1, for perfect speaker separation</li>
              </ul>
              An audio test mode shows live level meters for both inputs before the call starts.
            </FeatureCard>

            <FeatureCard color={GOLD} title="💳 Lead Contact Card">
              Every call is tied to a lead. The agent can select an existing lead or create a new one (auto-numbered #00001, #00002…).
              The contact card shows the client's name, phone, status, debt amount, creditor count, and AI-generated profile.
              The card is editable live and auto-saves to the database. A floating "Client Profile" button opens the full profile modal.
            </FeatureCard>

            <FeatureCard color={PURPLE} title="📝 Live Transcript Panel">
              As the call progresses, every spoken line appears in real time with:
              <ul>
                <li>Speaker labels (Agent vs. Customer) with color coding</li>
                <li>Timestamps and sentiment indicators</li>
                <li>Click any line to send it to the AI Q&A tool</li>
                <li>Scripts tab — view approved scripts side-by-side with the live transcript</li>
              </ul>
              The transcript auto-saves every 5 seconds, so nothing is lost if the connection drops.
            </FeatureCard>

            <FeatureCard color={GOLD} title="📊 Do-Nothing Calculator">
              In "Close" mode, a calculator appears that compares the cost of continuing minimum payments vs. enrolling in the
              debt settlement program. It pulls real numbers from the client's debt ledger and shows estimated savings, payoff timelines,
              and customer-facing talking points.
            </FeatureCard>

            <FeatureCard color={BLUE} title="🖥️ Detachable Panel Layout">
              All three main panels (Lead Card, Transcript, AI Assistant) can be popped out into floating windows.
              The agent arranges them across their monitors, clicks "Save Layout," and the positions are remembered in localStorage
              for the next call. This lets agents work on multi-monitor setups with the transcript on one screen, the AI on another, etc.
            </FeatureCard>

            <FeatureCard color={AMBER} title="⏰ Profile Timer">
              The agent can set a countdown timer on any client profile. When it expires, a popup reminder appears with an
              "Open Profile" button — ensuring follow-ups are never missed. Timers persist across page refreshes.
            </FeatureCard>

            <FeatureCard color={RED} title="🛡️ Live Compliance Widget">
              During the call, a real-time compliance scorecard shows the agent's compliance score (0-100), compliant hooks count,
              total violations, and critical violations. This updates every 90 seconds as the compliance engine evaluates the transcript.
            </FeatureCard>
          </Section>

          <Section id="ai" title="🤖 AI Tools (Live Call Intelligence)" color={PURPLE}>
            <p>
              The AI Assistant panel runs four independent AI engines during every live call. Managers can toggle each one on/off
              per dialer through the AI Settings control, giving fine-grained control over what assistance each agent receives.
            </p>

            <FeatureCard color={BLUE} title="❓ Live Q&A Engine">
              When the customer asks a question (detected by question words like "what," "how," "why," "can I"), the AI automatically
              searches the debt settlement knowledge base and generates an instant answer. The agent sees the question and answer
              in the AI panel without lifting a finger. Consecutive customer lines are buffered and flushed as one combined question
              for better context. All Q&A is saved to the lead's history.
            </FeatureCard>

            <FeatureCard color={GOLD} title="🧠 Live Coach">
              The coach monitors the transcript for objection keywords ("skeptical," "scam," "too much," "can't afford," "credit score," etc.)
              and proactively generates coaching tips — suggested rebuttals, talking points, and strategies. It also fires every 20 seconds
              even without objections, providing continuous guidance. Tips are saved per call for manager review.
            </FeatureCard>

            <FeatureCard color={PINK} title="📈 Intent Scoring Engine">
              Every 30 seconds, the AI analyzes the recent transcript and produces an intent score (0-100) indicating how likely the
              customer is to enroll. The customer is classified as a "Duck" (ready to enroll, high intent) or a "Cow" (needs more work, low intent).
              The score is tracked over time, creating intent snapshots that show how the call progressed. The final score is saved to the lead.
            </FeatureCard>

            <FeatureCard color={PURPLE} title="👤 Auto-Profile Builder">
              Every 60 seconds, the AI extracts structured profile data from the conversation — employment status, income, debt details,
              hardship information, co-signers, contact info, monthly bills, and creditor details. This data auto-populates the client's
              profile, debt ledger, and bills — no manual data entry required. The agent can review and edit everything in the Client Profile modal.
            </FeatureCard>

            <FeatureCard color={AMBER} title="🧾 Auto-Fact Extraction & Memory System">
              After each call, a dedicated fact extraction pass identifies key facts mentioned by the customer — personal details, family situations,
              financial commitments, objections, hot buttons, and follow-up items. These are saved as <strong>LeadMemory</strong> records with
              importance levels and follow-up dates. On the next call with the same lead, these memories are surfaced in the AI Coach so the agent
              can reference prior conversations: "Last time you mentioned your daughter's tuition…"
            </FeatureCard>

            <FeatureCard color={GOLD} title="📄 Post-Call Report">
              When the call ends, the AI generates a comprehensive post-call report summarizing the conversation, the customer's situation,
              intent analysis, recommended next steps, and coaching notes. This is saved alongside the transcript for managers to review.
            </FeatureCard>
          </Section>

          <Section id="bob" title="🎯 BOB Training Simulator" color={GOLD}>
            <p>
              <strong>B.O.B.</strong> (Battle Obstacle Boss) is a voice-powered roleplay training simulator. New agents practice calls
              against an AI customer that adapts its personality, difficulty, and behavior based on the selected persona and scenario.
            </p>

            <FeatureCard color={GOLD} title="🎭 Persona Blends">
              BOB can be configured as different customer types — from easy ducks to difficult cows — using a slider that blends
              personality traits. The persona determines how the AI customer responds: skeptical, eager, confused, hostile, or cooperative.
              Intensity levels (1-5) control how challenging the conversation is.
            </FeatureCard>

            <FeatureCard color={BLUE} title="📞 Call Modes">
              <ul>
                <li><strong>Open Mode</strong> — practice the initial discovery and qualification call</li>
                <li><strong>Close Mode</strong> — practice the closing/enrollment conversation</li>
              </ul>
              The simulator uses the same Deepgram + AI pipeline as live calls, so training feels real.
            </FeatureCard>

            <FeatureCard color={PURPLE} title="🧠 BOB's Brain">
              A knowledge base tab where managers can upload reference calls, scripts, and training materials that BOB uses to
              generate realistic customer responses. The more content in BOB's Brain, the more authentic the training.
            </FeatureCard>

            <FeatureCard color={AMBER} title="📊 Training Log">
              Every training session is logged with transcript, duration, recording, and whether an "appointment was booked."
              Managers can review training sessions to coach new hires before they go live.
            </FeatureCard>

            <FeatureCard color={GOLD} title="🔄 Auto-Sync">
              BOB automatically checks for script updates every 2 hours, ensuring training materials are always current.
            </FeatureCard>
          </Section>

          <Section id="pitches" title="🎤 Closer Pitches Library" color={PINK}>
            <p>
              The Pitches tab is a library of real closer pitches organized by closer name. Managers upload MP3 recordings of
              their best closers, and the AI automatically:
            </p>
            <ul>
              <li>Transcribes the recording (supports files up to 100MB via chunked transcription)</li>
              <li>Extracts distinct pitches by type: Opener, Discovery, Pitch, Rebuttal, Closer, Full Call</li>
              <li>Captures the actual language and approach the closer used</li>
              <li>Saves each pitch with the closer's name (derived from the filename)</li>
            </ul>
            <p>
              During live calls, a compact pitch panel lets agents reference any closer's pitches by type — so a new dialer can
              see exactly how the top closer handles a bankruptcy objection, for example. Pitches can also be added manually.
            </p>
          </Section>

          <Section id="kb" title="🧠 Knowledge Base" color={BLUE}>
            <p>
              The Knowledge Base is the AI's brain. It contains everything the AI tools reference during live calls — scripts,
              Q&A pairs, documents, website content, call recordings, and coaching hotpoints. Organized into categories:
            </p>
            <ul>
              <li><strong style={{ color: BLUE }}>debt_agent</strong> — agent scripts and talking points</li>
              <li><strong style={{ color: GOLD }}>debt_customer</strong> — customer Q&A pairs</li>
              <li><strong style={{ color: PURPLE }}>debt_doc</strong> — uploaded documents (PDF, etc.) extracted by AI</li>
              <li><strong style={{ color: AMBER }}>debt_web</strong> — website content scraped and ingested</li>
              <li><strong style={{ color: PINK }}>debt_call</strong> — call recordings transcribed and indexed</li>
              <li><strong style={{ color: GOLD }}>debt_kb</strong> — general knowledge entries</li>
              <li><strong style={{ color: BLUE }}>debt_faq</strong> — frequently asked questions</li>
              <li><strong style={{ color: RED }}>debt_hotpoints</strong> — coaching triggers and strategies</li>
            </ul>
            <p>
              Each entry can have multiple answer variations (the AI generates alternative phrasings), tags, and source tracking.
              Dialers have read-only access; managers and above can add, edit, and import entries.
            </p>
            <FeatureCard color={PURPLE} title="💬 AI KB Chat (Managers+)">
              A conversational interface where managers can add knowledge by chatting — type or speak a Q&A pair, upload a document,
              or paste a URL, and the AI ingests it into the knowledge base automatically. Supports image and audio uploads too.
            </FeatureCard>
          </Section>

          <Section id="profiles" title="👤 User Profiles & Client Data" color={GOLD}>
            <p>
              The User Profiles tab shows every lead with their complete client profile — a draggable, resizable modal with 9 tabs:
            </p>
            <ul>
              <li><strong>⚠️ Hardship</strong> — when/why/how the financial hardship started (auto-extracted from calls)</li>
              <li><strong>📋 Overview</strong> — contact info, employment, income, credit score, quick stats (debt, payments, DTI)</li>
              <li><strong>👥 Co-Signers</strong> — co-signer details (auto-extracted, editable, add/remove)</li>
              <li><strong>💳 Debt</strong> — full creditor ledger with balances, limits, rates, payments, and credit utilization</li>
              <li><strong>🧾 Bills</strong> — monthly expense breakdown (rent, auto, insurance, groceries, utilities, etc.)</li>
              <li><strong>❓ Q&A</strong> — every question the customer asked across all calls, with AI answers</li>
              <li><strong>📝 Transcripts</strong> — all saved call transcripts, expandable with follow-up reports</li>
              <li><strong>📷 Credit Report</strong> — uploaded credit report photo with AI analysis</li>
              <li><strong>📊 Calculator</strong> — the Do-Nothing Calculator for this specific client</li>
            </ul>
            <p>
              Everything auto-populates from live calls — the agent rarely needs to type anything manually. But every field is editable,
              and the Save button persists changes to the database.
            </p>
          </Section>

          <Section id="calls" title="📋 Call History" color={BLUE}>
            <p>
              The Calls tab is a unified view of all call data. It shows:
            </p>
            <ul>
              <li>Every saved call transcript with date, duration, call mode (open/close), and intent score</li>
              <li>Links to the full transcript and follow-up report</li>
              <li>Manager commentary on each call</li>
              <li>Filtering by agent, lead, date range, and call mode</li>
            </ul>
            <p>
              Dialers see only their own calls; managers and above see all calls across the team. This is where coaching happens
              after the fact — a manager reviews a call, reads the transcript, and leaves a comment for the agent.
            </p>
          </Section>

          <Section id="compliance" title="🛡️ Compliance Module" color={RED}>
            <p>
              The Compliance Module is a real-time and post-call system that enforces script fidelity and regulatory rules.
              It ensures agents say what they're supposed to say — and don't make claims they shouldn't.
            </p>

            <FeatureCard color={RED} title="🔍 What It Monitors">
              <ul>
                <li><strong>Regulatory Disclosures</strong> — required legal language that must be read</li>
                <li><strong>Factual Misrepresentation</strong> — claims that contradict ground truth (e.g., claiming an 85% success rate when it's actually 78%)</li>
                <li><strong>Script Deviation</strong> — going off-script from approved language</li>
                <li><strong>Unapproved Claims</strong> — making promises not in the approved materials</li>
                <li><strong>Missing Disclosures</strong> — forgetting to mention required information</li>
                <li><strong>Rate Misrepresentation</strong> — quoting incorrect rates or fees</li>
              </ul>
            </FeatureCard>

            <FeatureCard color={AMBER} title="📊 Compliance Records (Tickets)">
              Every evaluated call creates a ComplianceRecord with a unique ID (CMP-2026-00001). Each record tracks:
              <ul>
                <li>Compliance score (0-100) — higher is better</li>
                <li>Compliant hooks count — how many times the agent followed the script correctly</li>
                <li>Violations by severity: Critical, Medium, Low</li>
                <li>Status: Open → Under Review → Remedied → Closed</li>
                <li>Sensitivity level: Strict, Balanced, or Flexible (per user)</li>
              </ul>
            </FeatureCard>

            <FeatureCard color={PURPLE} title="🛠️ Compliance Knowledge Base">
              Admins build the rule set in the Compliance KB. Each rule can be:
              <ul>
                <li>A regulatory disclosure that must be read</li>
                <li>A factual ground truth (e.g., "actual success rate = 78%") with a threshold</li>
                <li>An approved script section</li>
                <li>A custom natural-language rule</li>
              </ul>
              The AI Agent chat lets admins create rules by simply describing them in plain English:
              <em> "Flag any agent who mentions a success rate above 85% as critical"</em> — and the AI creates the rule automatically.
            </FeatureCard>

            <FeatureCard color={BLUE} title="📚 Remediation Workflow">
              When a violation is found, managers can assign remedy materials (PDFs, audio, video, links, or text).
              The agent must:
              <ul>
                <li>Acknowledge the remedy</li>
                <li>Complete a quiz (auto-generated by AI from the material)</li>
                <li>Pass the quiz to mark the violation as remedied</li>
              </ul>
              This creates a full audit trail: violation → training → quiz → resolution.
            </FeatureCard>

            <FeatureCard color={GOLD} title="💬 Compliance Notes Thread">
              Every compliance record has a notes thread where managers and the agent can discuss the violation.
              System messages mark status changes (opened, reviewed, remedied, closed).
            </FeatureCard>

            <FeatureCard color={RED} title="🔔 Real-Time Alerts">
              During live calls, when the compliance engine detects a violation, a toast popup appears with an "Inspect Call" button.
              The agent sees their compliance score drop in real time. Managers see the alert in their portal immediately.
            </FeatureCard>

            <InfoBox color={RED}>
              <strong>Role Access:</strong>
              <ul>
                <li><strong>Dialer & Manager:</strong> "My Compliance" — see their own records, acknowledge remedies, take quizzes</li>
                <li><strong>Super Manager:</strong> + "Monitor" — toggle compliance per user, inspect any dialer's records, assign remedies</li>
                <li><strong>Admin & Super Admin:</strong> + "Admin" — manage the Compliance KB, approve scripts, view aggregate reports, use the AI Agent</li>
              </ul>
            </InfoBox>
          </Section>

          <Section id="manager" title="🎛️ Manager Portal" color={BLUE}>
            <p>
              The Manager Portal is a separate workspace for managers and above. Accessed via the "Manager Portal" button in the coach header.
              It provides real-time visibility into every active dialer and their calls.
            </p>

            <FeatureCard color={BLUE} title="👥 Dialers Tab — Live Dashboard">
              Shows every active dialer with their current status:
              <ul>
                <li><strong style={{ color: '#4ade80' }}>🟢 Logged In</strong> — available, not on a call</li>
                <li><strong style={{ color: RED }}>🔴 On Call</strong> — currently in a live call (shows lead name, phone, call mode, duration)</li>
                <li><strong style={{ color: '#6b7280' }}>⚫ Offline</strong> — logged out</li>
              </ul>
              The dashboard refreshes every 5 seconds. Clicking a dialer shows their full contact card and current call details.
            </FeatureCard>

            <FeatureCard color={PURPLE} title="🎧 Call Monitoring (Listen / Whisper / Barge / Takeover)">
              When a dialer is on a call, the manager can:
              <ul>
                <li><strong>Listen</strong> — silently hear both sides of the call via WebRTC</li>
                <li><strong>Whisper</strong> — speak only to the agent (the customer can't hear)</li>
                <li><strong>Barge</strong> — join the call and speak to both the agent and customer</li>
                <li><strong>Takeover</strong> — end the agent's call and take over the conversation directly</li>
              </ul>
              This uses a WebRTC peer connection between the manager's browser and the dialer's browser, established through
              SDP offer/answer exchange via the <code>managerCallControl</code> backend function.
            </FeatureCard>

            <FeatureCard color={GOLD} title="📝 Transcripts Tab">
              Browse all call transcripts across the team. Filter by agent, lead, date, or call mode.
              Leave coaching comments on any transcript. View the full transcript with speaker labels, timestamps, and sentiment.
            </FeatureCard>

            <FeatureCard color={AMBER} title="📊 Dialer Reports">
              Generate reports by date range:
              <ul>
                <li><strong>Call Measurement</strong> — call counts, durations, talk time per agent</li>
                <li><strong>Intent Reports</strong> — intent score trends, duck/cow classifications per agent</li>
                <li><strong>Q&A Reports</strong> — questions asked, answer quality, knowledge gaps</li>
              </ul>
            </FeatureCard>

            <FeatureCard color={GOLD} title="⚙️ AI Settings Per Dialer">
              Managers can toggle each AI tool on/off for each dialer individually:
              <ul>
                <li>Live AI Assistant (master toggle)</li>
                <li>Live Q&A</li>
                <li>Live Coach</li>
                <li>Live Intent</li>
              </ul>
              This lets managers customize the AI experience per agent — maybe a new hire gets all tools, while a veteran just gets Q&A.
            </FeatureCard>
          </Section>

          <Section id="admin" title="⚙️ Admin Panel & User Management" color={GOLD}>
            <p>
              The Admin tab (visible only to Admins and Super Admins) is the user management center. From here, admins can:
            </p>

            <FeatureCard color={GOLD} title="👤 Create Users">
              Create new dialer, manager, or super manager accounts. Set their username, password, role, and initial permissions.
              Optionally send an invitation email. New users are prompted to reset their password on first login.
            </FeatureCard>

            <FeatureCard color={BLUE} title="🔐 Permission Management">
              Each dialer can have granular permissions (stored as JSON) controlling which features they can access.
              Managers and above have full access by default. The permission system supports:
              <ul>
                <li><code>liveAIAssistant</code> — master AI toggle</li>
                <li><code>liveQA</code> — Q&A engine access</li>
                <li><code>liveCoach</code> — coaching tips access</li>
                <li><code>liveIntent</code> — intent scoring access</li>
              </ul>
            </FeatureCard>

            <FeatureCard color={PURPLE} title="🎭 Role Assignment">
              Change any user's role at any time. The role hierarchy is enforced server-side — a manager cannot promote someone to admin.
            </FeatureCard>

            <FeatureCard color={AMBER} title="🔄 Password Management">
              Reset any user's password (forces them to reset on next login), or change passwords directly. Admins can also
              change their own password from the login page.
            </FeatureCard>

            <FeatureCard color={RED} title="🗑️ Account Management">
              Activate/deactivate accounts (deactivated users can't log in), or permanently delete users.
              All actions are logged and tied to the admin who performed them.
            </FeatureCard>

            <FeatureCard color={GOLD} title="🛡️ Compliance Settings Per User">
              Admins and Super Managers can toggle compliance monitoring on/off for each user, set their sensitivity level
              (strict/balanced/flexible), and view which calls have been evaluated.
            </FeatureCard>
          </Section>

          <Section id="together" title="🔗 How It All Works Together" color={GOLD}>
            <p>
              Here's the full lifecycle of a call, showing how every piece connects:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <FlowStep num="1" color={BLUE} title="Agent Logs In">
                The dialer signs in at the login page. A <strong>DialerSession</strong> record is created tracking their status as "logged_in."
                Any previous sessions are marked offline. The dashboard loads with role-appropriate tabs.
              </FlowStep>

              <FlowStep num="2" color={GOLD} title="Agent Selects a Lead">
                In the Live Call tab, the agent picks an existing lead or creates a new one. The lead's complete history — prior calls,
                transcripts, Q&A, memories, debt ledger, bills, hardship, co-signers — loads into the Client Profile modal.
                If this is a follow-up call, the AI Coach surfaces key memories from prior conversations.
              </FlowStep>

              <FlowStep num="3" color={RED} title="Call Starts — AI Pipeline Activates">
                The agent clicks "Start Live Call." Deepgram opens a WebSocket connection. The agent's headset mic streams audio in real time.
                The transcript appears line by line with speaker labels and sentiment. The DialerSession updates to "on_call" so managers
                can see the agent is busy.
              </FlowStep>

              <FlowStep num="4" color={PURPLE} title="Four AI Engines Run in Parallel">
                As the conversation flows:
                <ul>
                  <li><strong>Q&A</strong> answers customer questions instantly from the KB</li>
                  <li><strong>Coach</strong> generates rebuttals when objections are detected</li>
                  <li><strong>Intent</strong> scores the customer's likelihood to enroll every 30s</li>
                  <li><strong>Profile Builder</strong> extracts debt info, bills, hardship, co-signers, and contact details automatically</li>
                </ul>
                The agent focuses on the conversation — the AI handles the data entry.
              </FlowStep>

              <FlowStep num="5" color={RED} title="Compliance Engine Evaluates">
                Every 90 seconds, the compliance engine sends the recent transcript to the AI, which checks it against the Compliance KB rules.
                If a violation is found, a ComplianceRecord is created with the flagged text, expected text, severity, and AI explanation.
                A toast alert appears. The agent's live compliance score updates in the widget.
              </FlowStep>

              <FlowStep num="6" color={BLUE} title="Manager Monitors (Optional)">
                In the Manager Portal, a manager sees the agent is "on_call." They can listen in, whisper coaching advice, barge into the call,
                or take over entirely — all through a WebRTC connection. The manager can also see the live transcript and compliance score.
              </FlowStep>

              <FlowStep num="7" color={GOLD} title="Call Ends — Everything Saves">
                The agent clicks "End Call." The system:
                <ul>
                  <li>Saves the full transcript to <strong>DebtCallTranscript</strong></li>
                  <li>Saves all Q&A pairs to <strong>DebtQAHistory</strong></li>
                  <li>Saves coaching tips to <strong>DebtCoachTip</strong></li>
                  <li>Saves intent snapshots to <strong>DebtIntentSnapshot</strong></li>
                  <li>Extracts key facts to <strong>LeadMemory</strong></li>
                  <li>Updates the lead's profile, intent score, animal type, and call count</li>
                  <li>Generates a post-call report</li>
                  <li>Resets the DialerSession to "logged_in"</li>
                </ul>
              </FlowStep>

              <FlowStep num="8" color={AMBER} title="Post-Call Review & Coaching">
                The manager reviews the call in the Calls tab or Transcripts tab. They read the transcript, check the compliance score,
                leave a coaching comment, and assign remedy materials if there were violations. The agent acknowledges the remedy,
                takes a quiz, and the violation is closed — creating a full audit trail.
              </FlowStep>

              <FlowStep num="9" color={GOLD} title="Next Call — Memory Surfaces">
                When the agent calls this lead again, the LeadMemory records from prior calls appear in the AI Coach.
                The agent can reference specific details: "Last time you mentioned your daughter's tuition was stressing you out —
                how's that looking now?" This creates continuity and builds rapport across calls.
              </FlowStep>
            </div>

            <InfoBox color={GOLD}>
              <strong>The result:</strong> Every call is coached live, every client profile is built automatically, every compliance
              violation is caught, and every conversation is saved — creating a continuously improving knowledge base that makes
              the next call better than the last.
            </InfoBox>
          </Section>

          {/* Footer */}
          <div style={{ marginTop: '60px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <Link to="/debt-call-coach-login" style={{ color: GOLD, textDecoration: 'none', fontSize: '14px' }}>→ Go to Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────────

function Section({ id, title, color, children }) {
  return (
    <div id={id} style={{ marginBottom: '48px', scrollMarginTop: '20px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'normal', color, marginBottom: '16px', paddingBottom: '8px', borderBottom: `1px solid ${color}22` }}>{title}</h2>
      <div style={{ color: '#c4cdd8', fontSize: '14px', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

function FeatureCard({ color, title, children }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${color}22`, borderRadius: '6px', padding: '16px 20px', margin: '16px 0' }}>
      <div style={{ color, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>{title}</div>
      <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function RoleCard({ color, name, icon, level, children }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`, borderRadius: '4px', padding: '14px 18px', margin: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ color, fontSize: '15px', fontWeight: 'bold' }}>{name}</span>
        <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '1px' }}>{level}</span>
      </div>
      <div style={{ color: '#8a9ab8', fontSize: '13px', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function InfoBox({ color, children }) {
  return (
    <div style={{ background: `${color}0d`, border: `1px solid ${color}33`, borderRadius: '6px', padding: '14px 18px', margin: '16px 0', color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

function FlowStep({ num, color, title, children }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: `${color}18`, border: `2px solid ${color}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color, fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
        <div style={{ color: '#8a9ab8', fontSize: '13px', lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  );
}