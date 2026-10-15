import React, { useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ComposedChart, ReferenceLine
} from 'recharts';
import {
  TrendingUp, Users, Phone, DollarSign, Zap, Target,
  CheckCircle2, AlertCircle, Brain, Headphones, FileText,
  Calendar, Award, Rocket, Activity, Crown, Shield
} from 'lucide-react';

// ── Revenue Ramp Data ──────────────────────────────────────────────────
const weeklyRevenue = [
  { week: 'W1', label: 'Week 1', revenue: 2000, transfers: 8, enrolled: 1, phase: 'Foundation' },
  { week: 'W2', label: 'Week 2', revenue: 2000, transfers: 10, enrolled: 1, phase: 'Foundation' },
  { week: 'W3', label: 'Week 3', revenue: 3000, transfers: 15, enrolled: 2, phase: 'Foundation' },
  { week: 'W4', label: 'Week 4', revenue: 6000, transfers: 20, enrolled: 3, phase: 'Foundation' },
  { week: 'W5', label: 'Week 5', revenue: 4000, transfers: 22, enrolled: 3, phase: 'Scale' },
  { week: 'W6', label: 'Week 6', revenue: 6000, transfers: 25, enrolled: 4, phase: 'Scale' },
  { week: 'W7', label: 'Week 7', revenue: 8000, transfers: 28, enrolled: 5, phase: 'Scale' },
  { week: 'W8', label: 'Week 8', revenue: 15000, transfers: 35, enrolled: 8, phase: 'Scale' },
  { week: 'W9', label: 'Week 9', revenue: 10000, transfers: 38, enrolled: 7, phase: 'Optimize' },
  { week: 'W10', label: 'Week 10', revenue: 12000, transfers: 42, enrolled: 9, phase: 'Optimize' },
  { week: 'W11', label: 'Week 11', revenue: 18000, transfers: 45, enrolled: 12, phase: 'Optimize' },
  { week: 'W12', label: 'Week 12', revenue: 35000, transfers: 55, enrolled: 18, phase: 'Optimize' },
  { week: 'W13', label: 'Week 13', revenue: 25000, transfers: 60, enrolled: 16, phase: 'Dominance' },
  { week: 'W14', label: 'Week 14', revenue: 30000, transfers: 68, enrolled: 20, phase: 'Dominance' },
  { week: 'W15', label: 'Week 15', revenue: 40000, transfers: 75, enrolled: 26, phase: 'Dominance' },
  { week: 'W16', label: 'Week 16', revenue: 50000, transfers: 85, enrolled: 32, phase: 'Dominance' },
  { week: 'W17', label: 'Wk 17 (proj)', revenue: 62000, transfers: 95, enrolled: 38, phase: 'Projection' },
  { week: 'W18', label: 'Wk 18 (proj)', revenue: 75000, transfers: 105, enrolled: 45, phase: 'Projection' },
];

const monthlyRevenue = [
  { month: 'Month 1', label: 'Days 1-30', revenue: 13000, target: 15000, enrolled: 7, transfers: 53 },
  { month: 'Month 2', label: 'Days 31-60', revenue: 33000, target: 35000, enrolled: 20, transfers: 110 },
  { month: 'Month 3', label: 'Days 61-90', revenue: 75000, target: 80000, enrolled: 46, transfers: 180 },
  { month: 'Month 4', label: 'Days 91-120', revenue: 145000, target: 150000, enrolled: 94, transfers: 288 },
];

// ── Role Definitions ──────────────────────────────────────────────────
const partnerA = {
  name: 'Christopher Bongiorno',
  role: 'P1 — Pipeline & Tech Lead',
  credentials: 'IAPDA Licensed Certified Debt Advisor Sr.',
  icon: Brain,
  color: '#0ea5e9',
  focus: [
    'AI Intent Engine prompt tuning & optimization',
    'Script optimization with Philippines fronter team',
    'Transfer flow efficiency & warm handoff protocols',
    'Real-time Live Q&A execution during live pitches',
    'Tech-stack integration & automation deployment',
    'Lead routing rules & priority distribution',
    'Performance analytics & funnel optimization',
  ],
};

const partnerB = {
  name: 'Stephani Scheidt',
  role: 'P2 — Quality & Closing Lead',
  credentials: 'Soon to be licensed (in progress)',
  icon: Crown,
  color: '#a78bfa',
  focus: [
    'Closing high-ticket files ($30k+ unsecured debt)',
    'Objection handling mastery & rebuttal frameworks',
    'Contract execution velocity & e-sign acceleration',
    'Client retention & post-enrollment onboarding',
    'Compliance verification & state registration checks',
    'Pricing tables, fee structures & escrow workflows',
    'Dead lead reactivation & warm-no-close recovery',
  ],
};

// ── Week-by-Week Plan Data ─────────────────────────────────────────────
const weekPlan = [
  {
    week: 1, phase: 'Foundation', days: 'Days 1-7',
    goal: 'Infrastructure Setup & Tech-Stack Integration',
    targetRevenue: 2000, targetTransfers: 8,
    p1: [
      'Sync with overseas operations team — establish warm transfer protocol',
      'Standardize client handoff scripts with mandatory data points (Total Debt, Hardship Type, Income, Creditor List)',
      'Configure pass-through parameters in the AI agent pipeline',
      'Verify Twilio line assignments and bridge connectivity for live transfers',
    ],
    p2: [
      'Master internal pricing tables and fee structures (15%-25%)',
      'Complete escrow account setup workflows training',
      'Build budget calculator proficiency for live call use',
      'Verify state registration compliance for operating states',
    ],
    joint: [
      'Complete licensing compliance verification',
      'Secure back-office portal credentials',
      'Run 3 test transfers end-to-end (no dropped calls, no missing data)',
    ],
    deliverable: 'Seamless test transfers completed without dropped calls or missing client data',
    aiTools: ['AI Agent Pipeline config', 'Twilio bridge connectivity', 'Transfer protocol validation'],
  },
  {
    week: 2, phase: 'Foundation', days: 'Days 8-14',
    goal: 'Philippines Fronter Alignment & Script Calibration',
    targetRevenue: 2000, targetTransfers: 10,
    p1: [
      'Conduct 2 training sessions with offshore fronter team',
      'Implement strict screening criteria: min $10k-$15k unsecured debt, active hardship, steady income',
      'Calibrate AI agent system prompt for qualification flow',
      'Set up Fronter Monitor panel for real-time call oversight',
    ],
    p2: [
      'Build 1-page "Pre-Call Briefing Sheet" that auto-updates when transfers drop into queue',
      'Document mandatory data capture checklist for fronters',
      'Create objection handling quick-reference card for top 10 objections',
      'Prepare compliance script for debt advisor disclosures',
    ],
    joint: [
      'Run practice closings using Live Q&A assistant',
      'Verify response latency and accuracy on complex questions (credit impact, legal action threats, tax implications)',
      'Record 5 mock calls for calibration review',
    ],
    deliverable: 'Fronter team achieves 80%+ transfer qualification rate',
    aiTools: ['Live Q&A Copilot', 'Fronter Monitor', 'AI Agent system prompt tuning', 'Script calibration'],
  },
  {
    week: 3, phase: 'Foundation', days: 'Days 15-21',
    goal: 'Intent Engine Calibration & Live Closing Launch',
    targetRevenue: 3000, targetTransfers: 15,
    p1: [
      'Go live with transfer inbound calls',
      'Continuously monitor Intent Engine during live calls for sentiment triggers',
      'Track hesitation around monthly escrow payments and spouse consultation objections',
      'Fine-tune Intent Engine prompts in real-time between calls',
    ],
    p2: [
      'Focus on rapid trust-building within first 60 seconds of transfer handoff ("warm bridge")',
      'Execute closing framework on every qualified transfer',
      'Document deal-killer patterns for weekly review',
      'Handle all e-sign and contract execution during live calls',
    ],
    joint: [
      'Aim for 8-10 live transfers per day per closer',
      'Run daily 15-minute debriefs at market close',
      'Review Intent Engine flags where deals stalled',
    ],
    deliverable: 'Minimum 3-5 enrolled files in the first full live week',
    aiTools: ['Intent Engine monitoring', 'Live Q&A Copilot', 'Real-time sentiment tracking', 'Daily debrief analytics'],
  },
  {
    week: 4, phase: 'Foundation', days: 'Days 22-28',
    goal: 'First Month Review & Process Refinement',
    targetRevenue: 6000, targetTransfers: 20,
    p1: [
      'Audit call transfer drop rates and refine Philippines handoff timing',
      'Fine-tune Intent Engine prompts to trigger real-time objection prompts faster',
      'Analyze AI agent call transcripts for qualification gaps',
      'Optimize bridge TTS latency for smoother handoffs',
    ],
    p2: [
      'Audit closed vs. lost files — identify primary deal killers',
      'Categorize: affordability, fear of legal notices, spouse objections, timing',
      'Review initial enrollments for escrow setup compliance',
      'Confirm initial ACH deposits are scheduled and verified',
    ],
    joint: [
      'Full Month 1 performance review',
      'Calibrate screening criteria based on conversion data',
      'Set Month 2 targets and capacity plan',
    ],
    deliverable: 'Phase 1 complete: $150,000+ enrolled unsecured debt target',
    aiTools: ['Call transcript analysis', 'Drop rate analytics', 'Conversion funnel audit', 'Intent Engine refinement'],
  },
  {
    week: 5, phase: 'Scale', days: 'Days 29-35',
    goal: 'Warm Handoff Speed & High-Debt Priority Routing',
    targetRevenue: 4000, targetTransfers: 22,
    p1: [
      'Implement high-priority routing rules — $30k+ debt transfers go to primary closer available',
      'Configure AI agent to tag high-debt leads for priority queue',
      'Reduce transfer-to-pitch time to under 90 seconds',
      'Set up automated lead scoring for transfer prioritization',
    ],
    p2: [
      'Integrate real-time state law and creditor-specific guidance into Live Q&A workflow',
      'Build creditor-specific objection handling for aggressive issuers (Chase, Capital One, Discover)',
      'Prepare compliance scripts for state-specific disclosures',
      'Create high-debt closing framework ($30k+ tier)',
    ],
    joint: [
      'Target reducing transfer-to-pitch time to under 90 seconds',
      'Increase to 10-12 transfers per closer per day',
      'Daily review of routing effectiveness',
    ],
    deliverable: 'High-debt priority routing live; transfer-to-pitch under 90 seconds',
    aiTools: ['AI lead scoring', 'Priority routing automation', 'Creditor-specific Q&A', 'Real-time compliance guidance'],
  },
  {
    week: 6, phase: 'Scale', days: 'Days 36-42',
    goal: 'Intent-Driven Objection Handling',
    targetRevenue: 6000, targetTransfers: 25,
    p1: [
      'Review Intent Engine analytics — identify top 3 soft objections mid-call',
      'Update Live Q&A cards with high-converting rebuttals',
      'Create AI-generated intent prompt library for common objections',
      'Deploy objection detection triggers in real-time',
    ],
    p2: [
      'Deploy "One-Call Close" frameworks utilizing hardship narratives',
      'Build 36-to-48 month savings comparisons against minimum payments',
      'Create visual financial plan templates for live call use',
      'Master rapid-fire objection handling sequences',
    ],
    joint: [
      'Execute daily roleplay on high-conflict objections using AI-generated intent prompts',
      'Record and review 3 live calls per day for coaching',
      'Track conversion rate by objection type',
    ],
    deliverable: 'Closing conversion rate on qualified transfers reaches 25%+',
    aiTools: ['Intent Engine analytics', 'AI rebuttal generation', 'Live Q&A card updates', 'Objection detection triggers'],
  },
  {
    week: 7, phase: 'Scale', days: 'Days 43-49',
    goal: 'E-Sign & Doc Execution Acceleration',
    targetRevenue: 8000, targetTransfers: 28,
    p1: [
      'Automate e-sign document delivery during live call — client signs while on phone',
      'Integrate SignNow/DocuSign with live call workflow',
      'Set up automated contract population from call data',
      'Configure post-sign confirmation and ACH scheduling automation',
    ],
    p2: [
      'Establish "Stay-In-Touch" protocol for clients needing secondary verification',
      'Build bank linking assistance script for escrow setup',
      'Create Day 1 post-enrollment onboarding sequence',
      'Handle complex multi-creditor contract execution',
    ],
    joint: [
      'Increase daily transfer capacity to 12-15 calls per closer per day',
      'Track e-sign completion rate during live calls',
      'Optimize contract delivery speed',
    ],
    deliverable: 'E-sign during live calls operational; 12-15 transfers/day capacity',
    aiTools: ['Automated e-sign delivery', 'Contract auto-population', 'Post-sign automation', 'ACH scheduling integration'],
  },
  {
    week: 8, phase: 'Scale', days: 'Days 50-56',
    goal: 'Month 2 Scaling & Pipeline Audit',
    targetRevenue: 15000, targetTransfers: 35,
    p1: [
      'Provide feed-forward data to Philippines operations management',
      'Reward top-performing fronters who deliver highest-converting calls',
      'Build fronter performance leaderboard with AI analytics',
      'Scale AI agent calling capacity for lead generation',
    ],
    p2: [
      'Conduct follow-up campaigns on "warm no-closes" from Weeks 5-7',
      'Deploy automated text/email re-engagement sequences',
      'Build recovery script for re-engagement calls',
      'Track re-engagement conversion rate',
    ],
    joint: [
      'Full Month 2 performance review',
      'Audit pipeline health and conversion funnel',
      'Set Month 3 scaling targets',
    ],
    deliverable: 'Phase 2 complete: $350,000-$500,000 enrolled debt for the month',
    aiTools: ['Fronter performance analytics', 'AI lead generation scaling', 'Automated re-engagement', 'Pipeline health dashboard'],
  },
  {
    week: 9, phase: 'Optimize', days: 'Days 57-63',
    goal: 'Average Ticket Elevation ($35k+ Deals)',
    targetRevenue: 10000, targetTransfers: 38,
    p1: [
      'Adjust offshore screening parameters for high-balance credit cards and personal loans',
      'Configure AI agent to prioritize $35k+ debt leads',
      'Build high-ticket lead scoring algorithm',
      'Optimize transfer routing for maximum deal size',
    ],
    p2: [
      'Implement custom financial plan visuals (PDF summaries generated from live call data)',
      'Text/email PDF summaries to client while closing',
      'Build high-ticket closing framework with premium positioning',
      'Master full debt load enrollment vs partial balance',
    ],
    joint: [
      'Focus on enrolling full debt loads rather than partial balances',
      'Maximize settlement leverage through complete enrollment',
      'Track average deal size growth',
    ],
    deliverable: 'Average enrolled debt per file reaches $35k+',
    aiTools: ['High-ticket lead scoring', 'Auto-generated PDF financial plans', 'AI agent prioritization', 'Deal size analytics'],
  },
  {
    week: 10, phase: 'Optimize', days: 'Days 64-70',
    goal: 'Retention & First-Deposit Protection',
    targetRevenue: 12000, targetTransfers: 42,
    p1: [
      'Set up automated Intent Engine monitoring on follow-up calls',
      'Detect buyer\'s remorse keywords ("spouse changed mind", "bank called", "scared")',
      'Configure automated alert system for at-risk enrollments',
      'Build retention analytics dashboard',
    ],
    p2: [
      'Implement mandatory Day 3 and Day 7 onboarding check-in call/SMS sequence',
      'Build retention script for buyer\'s remorse recovery',
      'Create first-deposit confirmation workflow',
      'Handle all retention calls personally',
    ],
    joint: [
      'Track post-enrollment drop-off rate',
      'Target under 5% drop-off rate',
      'Daily review of at-risk accounts',
    ],
    deliverable: 'Post-enrollment drop-off rate under 5%',
    aiTools: ['Intent Engine retention monitoring', 'Buyer\'s remorse detection', 'Automated alert system', 'Retention analytics'],
  },
  {
    week: 11, phase: 'Optimize', days: 'Days 71-77',
    goal: 'Multi-Call Recovery & "Dead Lead" Reactivation',
    targetRevenue: 18000, targetTransfers: 45,
    p1: [
      'Work with Philippines campaign managers on "re-engagement queue"',
      'Target transfers that disconnected or didn\'t close on first attempt',
      'Build AI-powered lead reactivation campaigns',
      'Configure automated re-dial scheduling for dead leads',
    ],
    p2: [
      'Implement targeted 2-touch closing pitches for rising credit card interest rates',
      'Build inflationary pressure narrative for re-engagement',
      'Create urgency-driven closing framework for reactivated leads',
      'Track reactivation conversion rate',
    ],
    joint: [
      'Re-engage past non-closes to add 10-15% incremental deal volume',
      'Daily dead-lead review and assignment',
      'Track reactivation ROI',
    ],
    deliverable: '10-15% incremental deal volume from dead lead reactivation',
    aiTools: ['AI lead reactivation campaigns', 'Automated re-dial scheduling', 'Re-engagement analytics', 'Dead lead scoring'],
  },
  {
    week: 12, phase: 'Optimize', days: 'Days 78-84',
    goal: 'Month 3 Performance Review & System Polish',
    targetRevenue: 35000, targetTransfers: 55,
    p1: [
      'Conduct full tech stack audit',
      'Ensure Live Q&A accuracy above 95%',
      'Verify Intent Engine alerts are seamless',
      'Optimize all automation workflows',
    ],
    p2: [
      'Refine closing scripts based on 60 days of Intent Engine metrics',
      'Update objection handling library with new patterns',
      'Polish high-ticket closing framework',
      'Finalize retention protocols',
    ],
    joint: [
      'Full Month 3 performance review',
      'Audit all systems and workflows',
      'Set Month 4 dominance targets',
    ],
    deliverable: 'Phase 3 complete: $600,000-$800,000 enrolled debt for the month',
    aiTools: ['Full tech stack audit', 'Live Q&A accuracy verification', 'Intent Engine optimization', 'System-wide polish'],
  },
  {
    week: 13, phase: 'Dominance', days: 'Days 85-91',
    goal: 'Operational Efficiency & Capacity Maxing',
    targetRevenue: 25000, targetTransfers: 60,
    p1: [
      'Standardize daily schedule optimization',
      'Optimize transfer queue management to eliminate idle time',
      'Maximize AI agent calling throughput',
      'Build real-time capacity dashboard',
    ],
    p2: [
      'Morning block (8:30-11:30): High-intent follow-ups, pending e-signs, escrow confirmations',
      'Mid-day to evening (11:30-6:30): Non-stop live transfer closing window',
      'Maximize closing velocity during peak hours',
      'Handle all pending contract execution',
    ],
    joint: [
      'Standardize daily schedules for both closers',
      'Eliminate idle time between calls',
      'Track and optimize calls-per-hour metric',
    ],
    deliverable: 'Zero idle time between transfers; maximum daily capacity achieved',
    aiTools: ['Transfer queue optimization', 'AI agent throughput maxing', 'Real-time capacity dashboard', 'Schedule automation'],
  },
  {
    week: 14, phase: 'Dominance', days: 'Days 92-98',
    goal: 'Philippines Team Performance Incentives',
    targetRevenue: 30000, targetTransfers: 68,
    p1: [
      'Work with management to implement performance incentives/bonuses for top 3 offshore fronters',
      'Build fronter leaderboard with conversion-based rankings',
      'Configure AI analytics for fronter performance attribution',
      'Create incentive payout tracking system',
    ],
    p2: [
      'Lead weekly 15-minute alignment call with offshore team lead',
      'Review transfer quality and adjust pitch angles',
      'Provide coaching feedback to top-performing fronters',
      'Build fronter-closer relationship protocols',
    ],
    joint: [
      'Implement incentive structure for top performers',
      'Weekly alignment call with Philippines team',
      'Track incentive program ROI',
    ],
    deliverable: 'Performance incentive system live; fronter quality improving',
    aiTools: ['Fronter performance attribution', 'Conversion-based rankings', 'Incentive tracking automation', 'AI coaching feedback'],
  },
  {
    week: 15, phase: 'Dominance', days: 'Days 99-105',
    goal: 'Cross-Selling & Multi-Solution Matching',
    targetRevenue: 40000, targetTransfers: 75,
    p1: [
      'Build AI-powered solution matching algorithm based on creditor mix, hardship, and state',
      'Configure multi-solution routing for complex debt profiles',
      'Optimize AI agent for solution-specific qualification',
      'Track solution matching accuracy',
    ],
    p2: [
      'Master all partner program matching criteria',
      'Maximize conversion on tough states or complex debt profiles',
      'Handle high-balance consolidation loan referrals',
      'Build multi-solution closing framework',
    ],
    joint: [
      'Ensure complete proficiency in matching clients to best partner program',
      'Maximize conversion on complex debt profiles',
      'Track solution mix and conversion by type',
    ],
    deliverable: 'Multi-solution matching live; complex profile conversion maximized',
    aiTools: ['AI solution matching', 'Multi-solution routing', 'Creditor mix analysis', 'Solution-specific qualification'],
  },
  {
    week: 16, phase: 'Dominance', days: 'Days 106-112',
    goal: 'The $1M+ Monthly Pace & Future Expansion Blueprint',
    targetRevenue: 50000, targetTransfers: 85,
    p1: [
      'Audit total 120-day production, net enrolled volume, average contract size',
      'Package Intent Engine prompt strategies into scalable playbook',
      'Build transfer workflow templates for new closer onboarding',
      'Create tech-stack documentation for team expansion',
    ],
    p2: [
      'Package closing frameworks into scalable playbook',
      'Build objection handling library for training new closers',
      'Create retention protocol documentation',
      'Develop closer training curriculum',
    ],
    joint: [
      'Audit 90-day retention rate',
      'Package complete playbook for scalable team',
      'Presentation to leadership showing production numbers',
      'Strategy to hire/train 2-4 additional closers under unit',
    ],
    deliverable: 'Phase 4 complete: $1,000,000+ enrolled debt in Month 4; expansion playbook ready',
    aiTools: ['Full production audit', 'Playbook packaging', 'Training curriculum development', 'Expansion strategy documentation'],
  },
];

// ── Phase Summaries ────────────────────────────────────────────────────
const phases = [
  {
    phase: 1, name: 'Foundation', days: 'Days 1-30', color: '#0ea5e9',
    target: '$150,000+ Enrolled Debt',
    goal: 'Establish flawless transfer synchronization with Philippines front-line, tune real-time call tools, and establish consistent closing rhythm',
    icon: Shield,
  },
  {
    phase: 2, name: 'Scale', days: 'Days 31-60', color: '#8b5cf6',
    target: '$350,000-$500,000 Monthly',
    goal: 'Scale call volume, optimize conversion rate utilizing Intent Engine prompts, and double monthly enrolled volume',
    icon: TrendingUp,
  },
  {
    phase: 3, name: 'Optimize', days: 'Days 61-90', color: '#f59e0b',
    target: '$600,000-$800,000 Monthly',
    goal: 'Maximize average contract size, minimize post-sale cancellation, and establish systematic efficiency',
    icon: Target,
  },
  {
    phase: 4, name: 'Dominance', days: 'Days 91-120', color: '#ef4444',
    target: '$1,000,000+ Monthly',
    goal: 'Reach top-producer tier, achieve $1M+ monthly enrolled debt pipeline, and prepare for team expansion',
    icon: Crown,
  },
];

// ── Why Two People Are Critical ────────────────────────────────────────
const synergyReasons = [
  {
    icon: Phone,
    title: 'Simultaneous Live Call Capacity',
    reason: 'With 15-30 live transfers per day, a single closer physically cannot take every call. Two closers ensure zero missed transfers during peak hours, doubling the live answer rate from ~50% to 95%+.',
    metric: '95%+ live answer rate',
  },
  {
    icon: Brain,
    title: 'Tech vs. Closing Split Focus',
    reason: 'AI prompt tuning, Intent Engine calibration, and bridge debugging require deep technical focus that breaks a closer\'s flow state. P1 owns the tech while P2 stays in closing rhythm — neither role suffers from context-switching.',
    metric: 'Zero context-switching penalty',
  },
  {
    icon: DollarSign,
    title: 'High-Debt Priority Routing',
    reason: 'When a $30k+ transfer drops in, P2 (closing specialist) takes it immediately while P1 continues managing the tech pipeline. Without this split, high-value calls get delayed or missed entirely.',
    metric: '$30k+ deals never wait',
  },
  {
    icon: Activity,
    title: 'Real-Time Intent Monitoring',
    reason: 'P1 monitors the Intent Engine during P2\'s live pitches, feeding real-time objection prompts and sentiment alerts. This live coaching layer is impossible with a solo closer who is mid-pitch.',
    metric: 'Live AI coaching during every pitch',
  },
  {
    icon: Users,
    title: 'Philippines Team Management',
    reason: 'Training, calibrating, and incentivizing the offshore fronter team is a full-time job. P1 owns this relationship while P2 focuses on closing quality — both functions scale independently.',
    metric: 'Dedicated fronter management',
  },
  {
    icon: FileText,
    title: 'Retention & Recovery Coverage',
    reason: 'Post-enrollment retention calls, dead lead reactivation, and warm-no-close follow-ups require consistent daily attention. P2 owns this while P1 keeps the new-transfer pipeline flowing.',
    metric: 'Zero retention gaps',
  },
];

// ── Revenue Chart Component ────────────────────────────────────────────
function RevenueRampChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-semibold">Weekly Revenue Ramp — 120 Days + Projection</h3>
      <p className="mb-4 text-sm text-muted-foreground">From $2K/week to $50K/week, with major upward trend post-Day 120</p>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={weeklyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-35} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={value => [`$${value.toLocaleString()}`, 'Revenue']}
          />
          <ReferenceLine x="Wk 16 (proj)" stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Day 120', fill: '#ef4444', fontSize: 10, position: 'top' }} />
          <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fill="url(#revGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Transfer Volume Chart ──────────────────────────────────────────────
function TransferVolumeChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-semibold">Live Transfer Volume — Weekly</h3>
      <p className="mb-4 text-sm text-muted-foreground">Target: 15-30 live transfers per day by Month 4</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={weeklyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-35} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => [value, name === 'transfers' ? 'Transfers' : 'Enrolled']}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="transfers" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Transfers" />
          <Bar dataKey="enrolled" fill="#10b981" radius={[4, 4, 0, 0]} name="Enrolled" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Monthly Revenue Comparison ─────────────────────────────────────────
function MonthlyRevenueChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-semibold">Monthly Revenue — Target vs Projected</h3>
      <p className="mb-4 text-sm text-muted-foreground">$13K → $33K → $75K → $145K enrolled debt pipeline</p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={value => [`$${value.toLocaleString()}`, '']}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="target" fill="#334155" radius={[4, 4, 0, 0]} name="Target" />
          <Bar dataKey="revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Projected" />
          <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} name="Trend" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Role Card Component ───────────────────────────────────────────────
function RoleCard({ partner, accent }) {
  const Icon = partner.icon;
  return (
    <div className="rounded-xl border-2 p-6" style={{ borderColor: partner.color + '40', backgroundColor: partner.color + '08' }}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: partner.color + '20' }}>
          <Icon className="h-6 w-6" style={{ color: partner.color }} />
        </div>
        <div>
          <h3 className="text-lg font-bold">{partner.name}</h3>
          <p className="text-sm font-medium" style={{ color: partner.color }}>{partner.role}</p>
          <p className="text-xs text-muted-foreground">{partner.credentials}</p>
        </div>
      </div>
      <div className="space-y-2">
        {partner.focus.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: partner.color }} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Week Card Component ───────────────────────────────────────────────
function WeekCard({ week }) {
  const [expanded, setExpanded] = useState(false);
  const phaseColor = phases.find(p => p.name === week.phase)?.color || '#0ea5e9';
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: phaseColor }}>
            {week.week}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: phaseColor + '20', color: phaseColor }}>
                {week.phase}
              </span>
              <span className="text-xs text-muted-foreground">{week.days}</span>
            </div>
            <h4 className="mt-1 font-semibold">{week.goal}</h4>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-sm font-bold text-emerald-400">${week.targetRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{week.targetTransfers} transfers</p>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* P1 Responsibilities */}
          <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-3">
            <p className="mb-2 text-xs font-bold text-sky-400">P1 — CHRISTOPHER (Pipeline & Tech)</p>
            <ul className="space-y-1.5">
              {week.p1.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* P2 Responsibilities */}
          <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3">
            <p className="mb-2 text-xs font-bold text-violet-400">P2 — STEPHANI (Quality & Closing)</p>
            <ul className="space-y-1.5">
              {week.p2.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Joint */}
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
            <p className="mb-2 text-xs font-bold text-emerald-400">JOINT — BOTH PARTNERS</p>
            <ul className="space-y-1.5">
              {week.joint.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* AI Tools */}
          <div className="flex flex-wrap gap-2">
            {week.aiTools.map((tool, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-400">
                <Zap className="h-3 w-3" /> {tool}
              </span>
            ))}
          </div>
          {/* Deliverable */}
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-bold text-primary">WEEK {week.week} DELIVERABLE</p>
              <p className="text-sm">{week.deliverable}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Phase Summary Card ────────────────────────────────────────────────
function PhaseCard({ phase }) {
  const Icon = phase.icon;
  return (
    <div className="rounded-xl border-2 p-5" style={{ borderColor: phase.color + '40' }}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: phase.color + '20' }}>
          <Icon className="h-5 w-5" style={{ color: phase.color }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Phase {phase.phase}</p>
          <h3 className="text-lg font-bold" style={{ color: phase.color }}>{phase.name}</h3>
        </div>
      </div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{phase.days}</p>
      <p className="mb-3 text-sm">{phase.goal}</p>
      <div className="rounded-lg px-3 py-2" style={{ backgroundColor: phase.color + '10' }}>
        <p className="text-xs text-muted-foreground">Target</p>
        <p className="font-bold" style={{ color: phase.color }}>{phase.target}</p>
      </div>
    </div>
  );
}

// ── Synergy Card ───────────────────────────────────────────────────────
function SynergyCard({ reason }) {
  const Icon = reason.icon;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h4 className="font-semibold">{reason.title}</h4>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{reason.reason}</p>
      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5">
        <Award className="h-4 w-4 text-emerald-400" />
        <p className="text-sm font-medium text-emerald-400">{reason.metric}</p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function GrowthPlan120Day() {
  const [activePhase, setActivePhase] = useState('all');
  const filteredWeeks = activePhase === 'all' ? weekPlan : weekPlan.filter(w => w.phase === activePhase);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Rocket className="h-4 w-4" />
            120-Day Strategic Growth Plan
          </div>
          <h1 className="text-3xl font-bold md:text-4xl">Fronter Network Scale & Rollout Plan</h1>
          <p className="mt-2 text-muted-foreground">AI-Powered Debt Call Coach · Philippines Fronter Network · Multi-Company Rollout</p>
        </div>

        {/* Partners */}
        <div className="grid gap-4 md:grid-cols-2">
          <RoleCard partner={partnerA} />
          <RoleCard partner={partnerB} />
        </div>

        {/* Why Two People */}
        <div>
          <h2 className="mb-1 text-2xl font-bold">Why This Partnership Is Non-Negotiable</h2>
          <p className="mb-4 text-muted-foreground">The two-person dynamic is the single most critical factor in hitting $50K/week by Day 120. Here's why a solo operator cannot achieve this scale:</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {synergyReasons.map((reason, i) => (
              <SynergyCard key={i} reason={reason} />
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueRampChart />
          <MonthlyRevenueChart />
        </div>
        <TransferVolumeChart />

        {/* Phase Summaries */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">Four-Phase Roadmap</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {phases.map(phase => (
              <PhaseCard key={phase.phase} phase={phase} />
            ))}
          </div>
        </div>

        {/* Week-by-Week Plan */}
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Week-by-Week Execution Plan</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActivePhase('all')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${activePhase === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                All Weeks
              </button>
              {phases.map(phase => (
                <button
                  key={phase.phase}
                  onClick={() => setActivePhase(phase.name)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${activePhase === phase.name ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  style={activePhase === phase.name ? { backgroundColor: phase.color } : {}}
                >
                  {phase.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {filteredWeeks.map(week => (
              <WeekCard key={week.week} week={week} />
            ))}
          </div>
        </div>

        {/* Key Metrics Dashboard */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">120-Day Key Metrics Dashboard</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Enrolled Debt (120 days)', value: '$266,000+', icon: DollarSign, color: '#10b981' },
              { label: 'Total Live Transfers', value: '636+', icon: Phone, color: '#0ea5e9' },
              { label: 'Total Enrolled Files', value: '167+', icon: FileText, color: '#8b5cf6' },
              { label: 'Peak Weekly Revenue', value: '$50,000', icon: TrendingUp, color: '#f59e0b' },
              { label: 'Peak Daily Transfers', value: '30+', icon: Activity, color: '#ef4444' },
              { label: 'Avg Deal Size (Month 4)', value: '$35k+', icon: Target, color: '#a78bfa' },
              { label: 'Retention Rate Target', value: '95%+', icon: Shield, color: '#10b981' },
              { label: 'Post-120-Day Trend', value: '↑ 50% MoM', icon: Rocket, color: '#0ea5e9' },
            ].map((metric, i) => {
              const Icon = metric.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-5 w-5" style={{ color: metric.color }} />
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: metric.color }}>{metric.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Company Rollout */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">Multi-Company Rollout Strategy</h2>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Beyond internal operations, the Debt Call Coach platform will be rolled out to other debt consolidation companies as a managed service:</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-4">
                <p className="mb-2 text-xs font-bold text-sky-400">MONTH 1-2</p>
                <h4 className="mb-1 font-semibold">Internal Proof of Concept</h4>
                <p className="text-sm text-muted-foreground">Validate the full pipeline internally — AI agents, Philippines fronters, live Q&A, Intent Engine. Document every workflow.</p>
              </div>
              <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-4">
                <p className="mb-2 text-xs font-bold text-violet-400">MONTH 3</p>
                <h4 className="mb-1 font-semibold">Playbook Packaging</h4>
                <p className="text-sm text-muted-foreground">Package the complete system — scripts, AI prompts, transfer protocols, closing frameworks — into a repeatable, sellable playbook.</p>
              </div>
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
                <p className="mb-2 text-xs font-bold text-emerald-400">MONTH 4+</p>
                <h4 className="mb-1 font-semibold">External Company Onboarding</h4>
                <p className="text-sm text-muted-foreground">Begin onboarding external debt consolidation companies as managed clients. P1 handles tech deployment, P2 handles training & closing methodology transfer.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This plan is built on the Debt Call Coach platform's AI agent pipeline, Intent Engine, Live Q&A Copilot,
            and Philippines fronter network. Every metric is achievable only with both partners executing their roles in parallel.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Christopher Bongiorno (IAPDA Licensed) · Stephani Scheidt (In Progress) · 120-Day Target: $1M+ Monthly Enrolled Debt
          </p>
        </div>
      </div>
    </div>
  );
}