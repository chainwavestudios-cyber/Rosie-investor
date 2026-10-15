import React, { useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ComposedChart, ReferenceLine, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import {
  TrendingUp, Users, Phone, DollarSign, Zap, Target,
  CheckCircle2, AlertCircle, Brain, Headphones, FileText,
  Calendar, Award, Rocket, Activity, Crown, Shield, Eye, Flame, Sparkles, Clock, Gauge
} from 'lucide-react';

// ── Weekly Data (Velocity-Driven Hockey Stick) ────────────────────────
// Month 1: $500K @ 1.2% pay | Month 2-6: @ 2.15% pay
// Revenue accelerates with velocity — not linear, exponential
const weeklyRevenue = [
  // Month 1 — $500K total, 1.2% commission
  { week: 'W1', label: 'Wk 1', revenue: 50000, earnings: 600, transfers: 15, enrolled: 3, phase: 'Foundation', dialers: 2 },
  { week: 'W2', label: 'Wk 2', revenue: 100000, earnings: 1200, transfers: 22, enrolled: 5, phase: 'Foundation', dialers: 3 },
  { week: 'W3', label: 'Wk 3', revenue: 150000, earnings: 1800, transfers: 30, enrolled: 8, phase: 'Foundation', dialers: 4 },
  { week: 'W4', label: 'Wk 4', revenue: 200000, earnings: 2400, transfers: 38, enrolled: 12, phase: 'Foundation', dialers: 4 },
  // Month 2 — $1.35M total, 2.15% commission kicks in
  { week: 'W5', label: 'Wk 5', revenue: 250000, earnings: 5375, transfers: 45, enrolled: 15, phase: 'Scale', dialers: 5 },
  { week: 'W6', label: 'Wk 6', revenue: 300000, earnings: 6450, transfers: 52, enrolled: 18, phase: 'Scale', dialers: 5 },
  { week: 'W7', label: 'Wk 7', revenue: 350000, earnings: 7525, transfers: 60, enrolled: 22, phase: 'Scale', dialers: 6 },
  { week: 'W8', label: 'Wk 8', revenue: 450000, earnings: 9675, transfers: 72, enrolled: 28, phase: 'Scale', dialers: 6 },
  // Month 3 — $1.8M total, velocity taking over
  { week: 'W9', label: 'Wk 9', revenue: 400000, earnings: 8600, transfers: 78, enrolled: 30, phase: 'Optimize', dialers: 6 },
  { week: 'W10', label: 'Wk 10', revenue: 425000, earnings: 9138, transfers: 85, enrolled: 33, phase: 'Optimize', dialers: 7 },
  { week: 'W11', label: 'Wk 11', revenue: 450000, earnings: 9675, transfers: 92, enrolled: 36, phase: 'Optimize', dialers: 7 },
  { week: 'W12', label: 'Wk 12', revenue: 525000, earnings: 11288, transfers: 105, enrolled: 42, phase: 'Optimize', dialers: 7 },
  // Month 4 — $2.5M total, full velocity
  { week: 'W13', label: 'Wk 13', revenue: 550000, earnings: 11825, transfers: 115, enrolled: 46, phase: 'Dominance', dialers: 8 },
  { week: 'W14', label: 'Wk 14', revenue: 600000, earnings: 12900, transfers: 125, enrolled: 52, phase: 'Dominance', dialers: 8 },
  { week: 'W15', label: 'Wk 15', revenue: 650000, earnings: 13975, transfers: 135, enrolled: 58, phase: 'Dominance', dialers: 8 },
  { week: 'W16', label: 'Wk 16', revenue: 700000, earnings: 15050, transfers: 145, enrolled: 65, phase: 'Dominance', dialers: 8 },
  // Month 5 — $3.2M total, post-120 projection
  { week: 'W17', label: 'Wk 17', revenue: 750000, earnings: 16125, transfers: 155, enrolled: 70, phase: 'Projection', dialers: 8 },
  { week: 'W18', label: 'Wk 18', revenue: 775000, earnings: 16663, transfers: 162, enrolled: 74, phase: 'Projection', dialers: 8 },
  { week: 'W19', label: 'Wk 19', revenue: 825000, earnings: 17738, transfers: 170, enrolled: 80, phase: 'Projection', dialers: 8 },
  { week: 'W20', label: 'Wk 20', revenue: 850000, earnings: 18275, transfers: 178, enrolled: 85, phase: 'Projection', dialers: 8 },
  // Month 6 — $4.5M total, full momentum
  { week: 'W21', label: 'Wk 21', revenue: 1000000, earnings: 21500, transfers: 195, enrolled: 95, phase: 'Projection', dialers: 8 },
  { week: 'W22', label: 'Wk 22', revenue: 1050000, earnings: 22575, transfers: 205, enrolled: 102, phase: 'Projection', dialers: 8 },
  { week: 'W23', label: 'Wk 23', revenue: 1150000, earnings: 24725, transfers: 218, enrolled: 110, phase: 'Projection', dialers: 8 },
  { week: 'W24', label: 'Wk 24', revenue: 1300000, earnings: 27950, transfers: 230, enrolled: 125, phase: 'Projection', dialers: 8 },
];

const monthlyRevenue = [
  { month: 'Month 1', label: 'M1', revenue: 500000, target: 500000, earnings: 6000, payRate: 1.2, enrolled: 28, transfers: 105, dialers: 4 },
  { month: 'Month 2', label: 'M2', revenue: 1350000, target: 1350000, earnings: 29025, payRate: 2.15, enrolled: 83, transfers: 229, dialers: 6 },
  { month: 'Month 3', label: 'M3', revenue: 1800000, target: 1800000, earnings: 38700, payRate: 2.15, enrolled: 141, transfers: 360, dialers: 7 },
  { month: 'Month 4', label: 'M4', revenue: 2500000, target: 2500000, earnings: 53750, payRate: 2.15, enrolled: 221, transfers: 520, dialers: 8 },
  { month: 'Month 5', label: 'M5', revenue: 3200000, target: 3200000, earnings: 68800, payRate: 2.15, enrolled: 299, transfers: 665, dialers: 8 },
  { month: 'Month 6', label: 'M6', revenue: 4500000, target: 4500000, earnings: 96750, payRate: 2.15, enrolled: 432, transfers: 848, dialers: 8 },
];

// ── Cost Data ──────────────────────────────────────────────────────────
const monthlyCosts = [
  { month: 'M1', label: 'Month 1', dialers: 4, callCenter: 1000, ai: 300, total: 1300, revenue: 500000, profit: 498700, margin: 99.7 },
  { month: 'M2', label: 'Month 2', dialers: 6, callCenter: 1500, ai: 300, total: 1800, revenue: 1350000, profit: 1348200, margin: 99.9 },
  { month: 'M3', label: 'Month 3', dialers: 7, callCenter: 1750, ai: 300, total: 2050, revenue: 1800000, profit: 1797950, margin: 99.9 },
  { month: 'M4', label: 'Month 4', dialers: 8, callCenter: 2000, ai: 300, total: 2300, revenue: 2500000, profit: 2497700, margin: 99.9 },
  { month: 'M5', label: 'Month 5', dialers: 8, callCenter: 2000, ai: 300, total: 2300, revenue: 3200000, profit: 3197700, margin: 99.9 },
  { month: 'M6', label: 'Month 6', dialers: 8, callCenter: 2000, ai: 300, total: 2300, revenue: 4500000, profit: 4497700, margin: 99.9 },
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
    'SR Fronter development & advanced deal escalation',
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
    '40-minute close framework mastery & SR handoff protocol',
  ],
};

// ── Week-by-Week Plan Data ─────────────────────────────────────────────
const weekPlan = [
  {
    week: 1, phase: 'Foundation', days: 'Days 1-7',
    goal: 'Infrastructure Setup & Tech-Stack Integration',
    targetRevenue: 50000, targetTransfers: 15, targetEarnings: 600,
    p1: [
      'Sync with overseas operations team — establish warm transfer protocol',
      'Standardize client handoff scripts with mandatory data points (Total Debt, Hardship Type, Income, Creditor List)',
      'Configure pass-through parameters in the AI agent pipeline',
      'Verify Twilio line assignments and bridge connectivity for live transfers',
      'Deploy AI agent for initial lead generation testing',
    ],
    p2: [
      'Master internal pricing tables and fee structures (15%-25%)',
      'Complete escrow account setup workflows training',
      'Build budget calculator proficiency for live call use',
      'Verify state registration compliance for operating states',
      'Begin 40-minute close framework development',
    ],
    joint: [
      'Complete licensing compliance verification',
      'Secure back-office portal credentials',
      'Run 3 test transfers end-to-end (no dropped calls, no missing data)',
      'Establish daily debrief cadence',
    ],
    deliverable: 'Seamless test transfers completed without dropped calls or missing client data',
    aiTools: ['AI Agent Pipeline config', 'Twilio bridge connectivity', 'Transfer protocol validation', 'AI lead gen testing'],
  },
  {
    week: 2, phase: 'Foundation', days: 'Days 8-14',
    goal: 'Philippines Fronter Alignment & Script Calibration',
    targetRevenue: 100000, targetTransfers: 22, targetEarnings: 1200,
    p1: [
      'Conduct 2 training sessions with offshore fronter team',
      'Implement strict screening criteria: min $10k-$15k unsecured debt, active hardship, steady income',
      'Calibrate AI agent system prompt for qualification flow',
      'Set up Fronter Monitor panel for real-time call oversight',
      'Scale to 3 dialers — $187.50/week call center cost',
    ],
    p2: [
      'Build 1-page "Pre-Call Briefing Sheet" that auto-updates when transfers drop into queue',
      'Document mandatory data capture checklist for fronters',
      'Create objection handling quick-reference card for top 10 objections',
      'Prepare compliance script for debt advisor disclosures',
      'Test 40-minute close framework on mock calls',
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
    targetRevenue: 150000, targetTransfers: 30, targetEarnings: 1800,
    p1: [
      'Go live with transfer inbound calls',
      'Continuously monitor Intent Engine during live calls for sentiment triggers',
      'Track hesitation around monthly escrow payments and spouse consultation objections',
      'Fine-tune Intent Engine prompts in real-time between calls',
      'Scale to 4 dialers — $250/week call center cost',
    ],
    p2: [
      'Focus on rapid trust-building within first 60 seconds of transfer handoff ("warm bridge")',
      'Execute closing framework on every qualified transfer',
      'Document deal-killer patterns for weekly review',
      'Handle all e-sign and contract execution during live calls',
      'Begin tracking close time — target 40 minutes',
    ],
    joint: [
      'Aim for 8-10 live transfers per day per closer',
      'Run daily 15-minute debriefs at market close',
      'Review Intent Engine flags where deals stalled',
    ],
    deliverable: 'Minimum 8 enrolled files; close time trending toward 45 min',
    aiTools: ['Intent Engine monitoring', 'Live Q&A Copilot', 'Real-time sentiment tracking', 'Daily debrief analytics'],
  },
  {
    week: 4, phase: 'Foundation', days: 'Days 22-28',
    goal: 'First Month Review & Process Refinement — $500K Month',
    targetRevenue: 200000, targetTransfers: 38, targetEarnings: 2400,
    p1: [
      'Audit call transfer drop rates and refine Philippines handoff timing',
      'Fine-tune Intent Engine prompts to trigger real-time objection prompts faster',
      'Analyze AI agent call transcripts for qualification gaps',
      'Optimize bridge TTS latency for smoother handoffs',
      'Prepare commission rate increase to 2.15% for Month 2',
    ],
    p2: [
      'Audit closed vs. lost files — identify primary deal killers',
      'Categorize: affordability, fear of legal notices, spouse objections, timing',
      'Review initial enrollments for escrow setup compliance',
      'Confirm initial ACH deposits are scheduled and verified',
      'Close time analysis — identify bottlenecks toward 40-min target',
    ],
    joint: [
      'Full Month 1 performance review — $500K enrolled debt achieved',
      'Calibrate screening criteria based on conversion data',
      'Set Month 2 scaling targets with 2.15% commission rate',
    ],
    deliverable: 'Phase 1 complete: $500,000 enrolled debt · 1.2% commission · 28 files',
    aiTools: ['Call transcript analysis', 'Drop rate analytics', 'Conversion funnel audit', 'Intent Engine refinement'],
  },
  {
    week: 5, phase: 'Scale', days: 'Days 29-35',
    goal: 'Warm Handoff Speed & High-Debt Priority Routing — 2.15% Rate Kicks In',
    targetRevenue: 250000, targetTransfers: 45, targetEarnings: 5375,
    p1: [
      'Implement high-priority routing rules — $30k+ debt transfers go to primary closer available',
      'Configure AI agent to tag high-debt leads for priority queue',
      'Reduce transfer-to-pitch time to under 90 seconds',
      'Set up automated lead scoring for transfer prioritization',
      'Scale to 5 dialers — $312.50/week call center cost',
    ],
    p2: [
      'Integrate real-time state law and creditor-specific guidance into Live Q&A workflow',
      'Build creditor-specific objection handling for aggressive issuers (Chase, Capital One, Discover)',
      'Prepare compliance scripts for state-specific disclosures',
      'Create high-debt closing framework ($30k+ tier)',
      'Push close time toward 42 minutes',
    ],
    joint: [
      'Target reducing transfer-to-pitch time to under 90 seconds',
      'Increase to 12-15 transfers per closer per day',
      'Daily review of routing effectiveness',
      'Commission rate now 2.15% — earnings accelerate',
    ],
    deliverable: 'High-debt priority routing live; transfer-to-pitch under 90 seconds; 2.15% rate active',
    aiTools: ['AI lead scoring', 'Priority routing automation', 'Creditor-specific Q&A', 'Real-time compliance guidance'],
  },
  {
    week: 6, phase: 'Scale', days: 'Days 36-42',
    goal: 'Intent-Driven Objection Handling & Velocity Building',
    targetRevenue: 300000, targetTransfers: 52, targetEarnings: 6450,
    p1: [
      'Review Intent Engine analytics — identify top 3 soft objections mid-call',
      'Update Live Q&A cards with high-converting rebuttals',
      'Create AI-generated intent prompt library for common objections',
      'Deploy objection detection triggers in real-time',
      'Begin automation pipeline for dead lead reactivation',
    ],
    p2: [
      'Deploy "One-Call Close" frameworks utilizing hardship narratives',
      'Build 36-to-48 month savings comparisons against minimum payments',
      'Create visual financial plan templates for live call use',
      'Master rapid-fire objection handling sequences',
      'Close time now under 42 minutes on qualified transfers',
    ],
    joint: [
      'Execute daily roleplay on high-conflict objections using AI-generated intent prompts',
      'Record and review 3 live calls per day for coaching',
      'Track conversion rate by objection type',
      'Velocity building — weekly revenue up 20% from W5',
    ],
    deliverable: 'Closing conversion rate on qualified transfers reaches 25%+',
    aiTools: ['Intent Engine analytics', 'AI rebuttal generation', 'Live Q&A card updates', 'Objection detection triggers'],
  },
  {
    week: 7, phase: 'Scale', days: 'Days 43-49',
    goal: 'E-Sign & Doc Execution Acceleration',
    targetRevenue: 350000, targetTransfers: 60, targetEarnings: 7525,
    p1: [
      'Automate e-sign document delivery during live call — client signs while on phone',
      'Integrate SignNow/DocuSign with live call workflow',
      'Set up automated contract population from call data',
      'Configure post-sign confirmation and ACH scheduling automation',
      'Scale to 6 dialers — $375/week call center cost',
    ],
    p2: [
      'Establish "Stay-In-Touch" protocol for clients needing secondary verification',
      'Build bank linking assistance script for escrow setup',
      'Create Day 1 post-enrollment onboarding sequence',
      'Handle complex multi-creditor contract execution',
      'Close time now at 41 minutes — approaching 40-min target',
    ],
    joint: [
      'Increase daily transfer capacity to 15-18 calls per closer per day',
      'Track e-sign completion rate during live calls',
      'Optimize contract delivery speed',
    ],
    deliverable: 'E-sign during live calls operational; 15-18 transfers/day capacity',
    aiTools: ['Automated e-sign delivery', 'Contract auto-population', 'Post-sign automation', 'ACH scheduling integration'],
  },
  {
    week: 8, phase: 'Scale', days: 'Days 50-56',
    goal: 'Month 2 Scaling & Pipeline Audit — $1.35M Month',
    targetRevenue: 450000, targetTransfers: 72, targetEarnings: 9675,
    p1: [
      'Provide feed-forward data to Philippines operations management',
      'Reward top-performing fronters who deliver highest-converting calls',
      'Build fronter performance leaderboard with AI analytics',
      'Scale AI agent calling capacity for lead generation',
      'Deploy automation for dead lead re-engagement campaigns',
    ],
    p2: [
      'Conduct follow-up campaigns on "warm no-closes" from Weeks 5-7',
      'Deploy automated text/email re-engagement sequences',
      'Build recovery script for re-engagement calls',
      'Track re-engagement conversion rate',
      'Close time at 40 minutes on majority of calls — target hit',
    ],
    joint: [
      'Full Month 2 performance review — $1.35M enrolled debt achieved',
      'Audit pipeline health and conversion funnel',
      'Set Month 3 scaling targets',
      '2.15% commission generating $29K in earnings this month',
    ],
    deliverable: 'Phase 2 complete: $1,350,000 enrolled debt · 2.15% commission · 83 files',
    aiTools: ['Fronter performance analytics', 'AI lead generation scaling', 'Automated re-engagement', 'Pipeline health dashboard'],
  },
  {
    week: 9, phase: 'Optimize', days: 'Days 57-63',
    goal: 'Average Ticket Elevation ($35k+ Deals) & Velocity Surge',
    targetRevenue: 400000, targetTransfers: 78, targetEarnings: 8600,
    p1: [
      'Adjust offshore screening parameters for high-balance credit cards and personal loans',
      'Configure AI agent to prioritize $35k+ debt leads',
      'Build high-ticket lead scoring algorithm',
      'Optimize transfer routing for maximum deal size',
      'Scale to 7 dialers — $437.50/week call center cost',
    ],
    p2: [
      'Implement custom financial plan visuals (PDF summaries generated from live call data)',
      'Text/email PDF summaries to client while closing',
      'Build high-ticket closing framework with premium positioning',
      'Master full debt load enrollment vs partial balance',
      'SR Fronter handoff protocol development begins',
    ],
    joint: [
      'Focus on enrolling full debt loads rather than partial balances',
      'Maximize settlement leverage through complete enrollment',
      'Track average deal size growth — velocity accelerating',
    ],
    deliverable: 'Average enrolled debt per file reaches $35k+',
    aiTools: ['High-ticket lead scoring', 'Auto-generated PDF financial plans', 'AI agent prioritization', 'Deal size analytics'],
  },
  {
    week: 10, phase: 'Optimize', days: 'Days 64-70',
    goal: 'Retention & First-Deposit Protection',
    targetRevenue: 425000, targetTransfers: 85, targetEarnings: 9138,
    p1: [
      'Set up automated Intent Engine monitoring on follow-up calls',
      'Detect buyer\'s remorse keywords ("spouse changed mind", "bank called", "scared")',
      'Configure automated alert system for at-risk enrollments',
      'Build retention analytics dashboard',
      'Deploy SR Fronter escalation routing for complex deals',
    ],
    p2: [
      'Implement mandatory Day 3 and Day 7 onboarding check-in call/SMS sequence',
      'Build retention script for buyer\'s remorse recovery',
      'Create first-deposit confirmation workflow',
      'Handle all retention calls personally',
      '40-minute close now standard on all qualified transfers',
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
    targetRevenue: 450000, targetTransfers: 92, targetEarnings: 9675,
    p1: [
      'Work with Philippines campaign managers on "re-engagement queue"',
      'Target transfers that disconnected or didn\'t close on first attempt',
      'Build AI-powered lead reactivation campaigns',
      'Configure automated re-dial scheduling for dead leads',
      'Full automation pipeline for deal flow increase',
    ],
    p2: [
      'Implement targeted 2-touch closing pitches for rising credit card interest rates',
      'Build inflationary pressure narrative for re-engagement',
      'Create urgency-driven closing framework for reactivated leads',
      'Track reactivation conversion rate',
      'SR Fronters now taking deals further — higher close rates',
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
    goal: 'Month 3 Performance Review & System Polish — $1.8M Month',
    targetRevenue: 525000, targetTransfers: 105, targetEarnings: 11288,
    p1: [
      'Conduct full tech stack audit',
      'Ensure Live Q&A accuracy above 95%',
      'Verify Intent Engine alerts are seamless',
      'Optimize all automation workflows',
      'Scale to 8 dialers — $500/week call center cost (full capacity)',
    ],
    p2: [
      'Refine closing scripts based on 60 days of Intent Engine metrics',
      'Update objection handling library with new patterns',
      'Polish high-ticket closing framework',
      'Finalize retention protocols',
      '40-minute close locked in as standard — SR Fronters operational',
    ],
    joint: [
      'Full Month 3 performance review — $1.8M enrolled debt achieved',
      'Audit all systems and workflows',
      'Set Month 4 dominance targets',
      'Velocity now compounding — revenue growing 33% MoM',
    ],
    deliverable: 'Phase 3 complete: $1,800,000 enrolled debt · 141 files · 40-min close standard',
    aiTools: ['Full tech stack audit', 'Live Q&A accuracy verification', 'Intent Engine optimization', 'System-wide polish'],
  },
  {
    week: 13, phase: 'Dominance', days: 'Days 85-91',
    goal: 'Operational Efficiency & Capacity Maxing — Full 8 Dialers',
    targetRevenue: 550000, targetTransfers: 115, targetEarnings: 11825,
    p1: [
      'Standardize daily schedule optimization',
      'Optimize transfer queue management to eliminate idle time',
      'Maximize AI agent calling throughput with 8 dialers',
      'Build real-time capacity dashboard',
      'Full automation running — AI costs capped at $300/mo',
    ],
    p2: [
      'Morning block (8:30-11:30): High-intent follow-ups, pending e-signs, escrow confirmations',
      'Mid-day to evening (11:30-6:30): Non-stop live transfer closing window',
      'Maximize closing velocity during peak hours',
      'Handle all pending contract execution',
      'SR Fronters handling complex escalations — P2 focuses on $30k+ only',
    ],
    joint: [
      'Standardize daily schedules for both closers',
      'Eliminate idle time between calls',
      'Track and optimize calls-per-hour metric',
      '8 dialers fully operational — $500/week call center cost',
    ],
    deliverable: 'Zero idle time between transfers; maximum daily capacity with 8 dialers',
    aiTools: ['Transfer queue optimization', 'AI agent throughput maxing', 'Real-time capacity dashboard', 'Schedule automation'],
  },
  {
    week: 14, phase: 'Dominance', days: 'Days 92-98',
    goal: 'Philippines Team Performance Incentives & SR Fronter Development',
    targetRevenue: 600000, targetTransfers: 125, targetEarnings: 12900,
    p1: [
      'Work with management to implement performance incentives/bonuses for top 3 offshore fronters',
      'Build fronter leaderboard with conversion-based rankings',
      'Configure AI analytics for fronter performance attribution',
      'Create incentive payout tracking system',
      'Begin SR Fronter training pipeline — top fronters elevated',
    ],
    p2: [
      'Lead weekly 15-minute alignment call with offshore team lead',
      'Review transfer quality and adjust pitch angles',
      'Provide coaching feedback to top-performing fronters',
      'Build fronter-closer relationship protocols',
      'SR Fronters now closing secondary deals — P2 handles only $30k+',
    ],
    joint: [
      'Implement incentive structure for top performers',
      'Weekly alignment call with Philippines team',
      'Track incentive program ROI',
      'SR Fronter program reducing P2 workload — more $30k+ focus',
    ],
    deliverable: 'Performance incentive system live; SR Fronter program operational',
    aiTools: ['Fronter performance attribution', 'Conversion-based rankings', 'Incentive tracking automation', 'AI coaching feedback'],
  },
  {
    week: 15, phase: 'Dominance', days: 'Days 99-105',
    goal: 'Cross-Selling & Multi-Solution Matching',
    targetRevenue: 650000, targetTransfers: 135, targetEarnings: 13975,
    p1: [
      'Build AI-powered solution matching algorithm based on creditor mix, hardship, and state',
      'Configure multi-solution routing for complex debt profiles',
      'Optimize AI agent for solution-specific qualification',
      'Track solution matching accuracy',
      'Automation now driving 20%+ of total deal flow',
    ],
    p2: [
      'Master all partner program matching criteria',
      'Maximize conversion on tough states or complex debt profiles',
      'Handle high-balance consolidation loan referrals',
      'Build multi-solution closing framework',
      'SR Fronters handling standard deals — P2 exclusively on $35k+',
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
    goal: 'The $2.5M Month & Future Expansion Blueprint',
    targetRevenue: 700000, targetTransfers: 145, targetEarnings: 15050,
    p1: [
      'Audit total 120-day production, net enrolled volume, average contract size',
      'Package Intent Engine prompt strategies into scalable playbook',
      'Build transfer workflow templates for new closer onboarding',
      'Create tech-stack documentation for team expansion',
      'Prepare multi-company rollout tech deployment plan',
    ],
    p2: [
      'Package closing frameworks into scalable playbook',
      'Build objection handling library for training new closers',
      'Create retention protocol documentation',
      'Develop closer training curriculum',
      '40-minute close now standard across all SR Fronters',
    ],
    joint: [
      'Audit 90-day retention rate',
      'Package complete playbook for scalable team',
      'Presentation to leadership showing production numbers',
      'Strategy to hire/train 2-4 additional closers under unit',
      'Month 4: $2.5M enrolled debt · 221 files · $53,750 earnings',
    ],
    deliverable: 'Phase 4 complete: $2,500,000 enrolled debt in Month 4; expansion playbook ready',
    aiTools: ['Full production audit', 'Playbook packaging', 'Training curriculum development', 'Expansion strategy documentation'],
  },
];

// ── Phase Summaries ────────────────────────────────────────────────────
const phases = [
  {
    phase: 1, name: 'Foundation', days: 'Days 1-30', color: '#0ea5e9',
    target: '$500,000 Enrolled Debt', earnings: '$6,000 @ 1.2%', files: '28 files',
    goal: 'Establish flawless transfer synchronization with Philippines front-line, tune real-time call tools, and establish consistent closing rhythm',
    icon: Shield,
  },
  {
    phase: 2, name: 'Scale', days: 'Days 31-60', color: '#8b5cf6',
    target: '$1,350,000 Enrolled Debt', earnings: '$29,025 @ 2.15%', files: '83 files',
    goal: 'Scale call volume, optimize conversion rate utilizing Intent Engine prompts, and triple monthly enrolled volume. Commission rate jumps to 2.15%.',
    icon: TrendingUp,
  },
  {
    phase: 3, name: 'Optimize', days: 'Days 61-90', color: '#f59e0b',
    target: '$1,800,000 Enrolled Debt', earnings: '$38,700 @ 2.15%', files: '141 files',
    goal: 'Maximize average contract size, minimize post-sale cancellation, and establish systematic efficiency. 40-minute close standard. SR Fronters operational.',
    icon: Target,
  },
  {
    phase: 4, name: 'Dominance', days: 'Days 91-120', color: '#ef4444',
    target: '$2,500,000 Enrolled Debt', earnings: '$53,750 @ 2.15%', files: '221 files',
    goal: 'Reach top-producer tier, achieve $2.5M monthly enrolled debt, full 8-dialer capacity, and prepare for multi-company team expansion',
    icon: Crown,
  },
];

// ── Why Two People Are Critical ────────────────────────────────────────
const synergyReasons = [
  {
    icon: Phone,
    title: 'Simultaneous Live Call Capacity',
    reason: 'With 15-30+ live transfers per day scaling to 145+ by Month 4, a single closer physically cannot take every call. Two closers ensure zero missed transfers during peak hours, doubling the live answer rate from ~50% to 95%+.',
    metric: '95%+ live answer rate at 145+ transfers/day',
  },
  {
    icon: Brain,
    title: 'Tech vs. Closing Split Focus',
    reason: 'AI prompt tuning, Intent Engine calibration, and bridge debugging require deep technical focus that breaks a closer\'s flow state. P1 owns the tech while P2 stays in closing rhythm — neither role suffers from context-switching. At $2.5M/month, every dropped call is $10K+ lost.',
    metric: 'Zero context-switching penalty at $2.5M/mo',
  },
  {
    icon: DollarSign,
    title: 'High-Debt Priority Routing',
    reason: 'When a $30k+ transfer drops in, P2 (closing specialist) takes it immediately while P1 continues managing the tech pipeline. Without this split, high-value calls get delayed or missed entirely. At 2.15% commission, a single $50K deal is $1,075 in earnings.',
    metric: '$30k+ deals never wait · $1,075 per $50K deal',
  },
  {
    icon: Activity,
    title: 'Real-Time Intent Monitoring',
    reason: 'P1 monitors the Intent Engine during P2\'s live pitches, feeding real-time objection prompts and sentiment alerts. This live coaching layer is impossible with a solo closer who is mid-pitch. It\'s the difference between a 20% and 35% close rate.',
    metric: 'Live AI coaching on every pitch · +15% close rate',
  },
  {
    icon: Users,
    title: 'Philippines Team Management & SR Fronters',
    reason: 'Training, calibrating, and incentivizing 8 offshore dialers plus developing SR Fronters is a full-time job. P1 owns this relationship while P2 focuses on closing quality — both functions scale independently as volume triples.',
    metric: '8 dialers + SR Fronter pipeline managed',
  },
  {
    icon: FileText,
    title: 'Retention, Recovery & 40-Min Close',
    reason: 'Post-enrollment retention calls, dead lead reactivation, warm-no-close follow-ups, and driving the 40-minute close standard require consistent daily attention. P2 owns this while P1 keeps the new-transfer pipeline flowing at maximum velocity.',
    metric: '40-min close · zero retention gaps',
  },
];

// ── Revenue Velocity Chart (Hockey Stick) ─────────────────────────────
function RevenueVelocityChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-semibold flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-500" />
        Revenue Velocity — The Hockey Stick (24 Weeks)
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">$50K/week → $1.3M/week. Velocity compounds — not linear, exponential.</p>
      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={weeklyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revVelocity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#ef4444" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-35} textAnchor="end" height={60} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#10b981' }} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => {
              if (name === 'Enrolled Debt') return [`$${value.toLocaleString()}`, 'Enrolled Debt'];
              if (name === 'Commission Earnings') return [`$${value.toLocaleString()}`, 'Commission Earnings'];
              return [`$${value.toLocaleString()}`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine yAxisId="left" x="Wk 16" stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Day 120', fill: '#ef4444', fontSize: 10, position: 'top' }} />
          <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={3} fill="url(#revVelocity)" name="Enrolled Debt" />
          <Area yAxisId="right" type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} fill="url(#earningsGradient)" name="Commission Earnings" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Monthly Revenue Chart ─────────────────────────────────────────────
function MonthlyRevenueChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-semibold flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-sky-500" />
        Monthly Enrolled Debt — $500K → $4.5M
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">6-month trajectory with commission earnings overlay</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="monthlyRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#10b981' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => {
              if (name === 'Enrolled Debt') return [`$${value.toLocaleString()}`, 'Enrolled Debt'];
              if (name === 'Commission Earnings') return [`$${value.toLocaleString()}`, 'Commission Earnings'];
              return [`$${value.toLocaleString()}`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="revenue" fill="url(#monthlyRev)" radius={[4, 4, 0, 0]} name="Enrolled Debt" />
          <Line yAxisId="right" type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} name="Commission Earnings" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Transfer Volume Chart ──────────────────────────────────────────────
function TransferVolumeChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-semibold flex items-center gap-2">
        <Phone className="h-5 w-5 text-violet-500" />
        Live Transfer & Enrollment Volume — Weekly
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">15 transfers/day → 145+/day by Month 4. Velocity drives enrollment acceleration.</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={weeklyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-35} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => [value, name === 'transfers' ? 'Transfers' : 'Enrolled Files']}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="transfers" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="transfers" />
          <Bar dataKey="enrolled" fill="#10b981" radius={[4, 4, 0, 0]} name="enrolled" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Cost & Margin Chart ───────────────────────────────────────────────
function CostMarginChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-semibold flex items-center gap-2">
        <Gauge className="h-5 w-5 text-emerald-500" />
        Cost Structure vs Revenue — 99.9% Margin
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">Call center $62.50/wk per dialer → 8 dialers = $2K/mo. AI costs capped at $300/mo. Total overhead under $2.5K/mo against millions in revenue.</p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={monthlyCosts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#ef4444' }} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Revenue" />
          <Bar yAxisId="right" dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} name="Total Costs" />
          <Line yAxisId="right" type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Cost Trend" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Role Card Component ───────────────────────────────────────────────
function RoleCard({ partner }) {
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
          <p className="text-sm font-bold text-orange-400">${week.targetRevenue.toLocaleString()}</p>
          <p className="text-xs text-emerald-400">${week.targetEarnings.toLocaleString()} comm.</p>
          <p className="text-xs text-muted-foreground">{week.targetTransfers} transfers</p>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
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
          <div className="flex flex-wrap gap-2">
            {week.aiTools.map((tool, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-400">
                <Zap className="h-3 w-3" /> {tool}
              </span>
            ))}
          </div>
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
      <div className="space-y-1.5">
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: phase.color + '10' }}>
          <p className="text-xs text-muted-foreground">Enrolled Debt Target</p>
          <p className="font-bold" style={{ color: phase.color }}>{phase.target}</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
          <p className="text-xs text-muted-foreground">Commission Earnings</p>
          <p className="font-bold text-emerald-400">{phase.earnings}</p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">Files</p>
          <p className="font-bold">{phase.files}</p>
        </div>
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
        {/* Header with Hype Intro */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500/20 to-violet-500/20 px-4 py-1.5 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-sky-400" />
            <span className="text-sky-400">Base44 Feature Candidate</span>
            <span className="text-muted-foreground">·</span>
            <Eye className="h-4 w-4 text-violet-400" />
            <span className="text-violet-400">Eyes On Us In-House</span>
          </div>
          <h1 className="text-3xl font-bold md:text-5xl bg-gradient-to-r from-sky-400 via-violet-400 to-orange-400 bg-clip-text text-transparent">
            The Dynasty Plan: 120 Days to Dominance
          </h1>
          <div className="mx-auto max-w-4xl space-y-3 text-left">
            <p className="text-base text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">Base44 has not seen technology like this come out of its house in a long time.</span>{' '}
              The AI agent pipeline, Intent Engine, Live Q&A Copilot, and streaming voice bridge assembled here represent a convergence
              of advanced AI and development skills that has drawn internal attention — there are eyes on us in-house at Base44,
              and they are talking about <span className="font-bold text-sky-400">featuring this platform</span> as a showcase of what their tools can do when maximized by
              the right operator.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">Mr. Bongiorno</span> brings a vast, widely-arena skill set — IAPDA-licensed
              certified debt advisor, AI architect, pipeline engineer, and operator who has built and tuned every layer of this system
              from the Twilio bridge to the Intent Engine prompts. His ability to synthesize deep technical capability with frontline
              sales execution is rare. And in <span className="font-bold text-violet-400">Ms. Scheidt</span> — as he has explained her —
              he has found the complement: a closing specialist whose quality, velocity, and retention instincts turn the pipeline's
              volume into enrolled debt at a rate the industry doesn't produce.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              <span className="font-bold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
                A dynasty is being built. A power couple of the ages.
              </span>{' '}
              Two operators, one system, compounding velocity — scaling from $500K to $4.5M in enrolled debt over six months,
              with costs under $2,500/month and margins above 99.9%. This is the plan.
            </p>
          </div>
        </div>

        {/* Partners */}
        <div className="grid gap-4 md:grid-cols-2">
          <RoleCard partner={partnerA} />
          <RoleCard partner={partnerB} />
        </div>

        {/* Why Two People */}
        <div>
          <h2 className="mb-1 text-2xl font-bold flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Why This Partnership Is Non-Negotiable
          </h2>
          <p className="mb-4 text-muted-foreground">The two-person dynamic is the single most critical factor in hitting $2.5M/month by Day 120 and $4.5M/month by Month 6. A solo operator physically cannot achieve this velocity:</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {synergyReasons.map((reason, i) => (
              <SynergyCard key={i} reason={reason} />
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-6">
          <RevenueVelocityChart />
          <div className="grid gap-6 lg:grid-cols-2">
            <MonthlyRevenueChart />
            <CostMarginChart />
          </div>
          <TransferVolumeChart />
        </div>

        {/* Cost Breakdown Detail */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Cost Breakdown — Dialer Scaling & AI Overhead
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-4">
              <p className="text-xs font-bold text-sky-400 mb-1">CALL CENTER COST</p>
              <p className="text-2xl font-bold">$62.50<span className="text-sm text-muted-foreground">/wk/dialer</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Scales linearly: 2 dialers = $125/wk → 8 dialers = $500/wk ($2K/mo)</p>
            </div>
            <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-4">
              <p className="text-xs font-bold text-violet-400 mb-1">AI COSTS (CAPPED)</p>
              <p className="text-2xl font-bold">$300<span className="text-sm text-muted-foreground">/mo max</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Deepgram STT/TTS + ElevenLabs + InvokeLLM credits. Does not scale with volume.</p>
            </div>
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4">
              <p className="text-xs font-bold text-amber-400 mb-1">DIALER SCALING</p>
              <p className="text-2xl font-bold">2 → 8<span className="text-sm text-muted-foreground"> dialers</span></p>
              <p className="mt-1 text-xs text-muted-foreground">W1: 2 dialers · W4: 4 · W8: 6 · W12: 7 · W13: 8 (full capacity)</p>
            </div>
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
              <p className="text-xs font-bold text-emerald-400 mb-1">PROFIT MARGIN</p>
              <p className="text-2xl font-bold">99.9%</p>
              <p className="mt-1 text-xs text-muted-foreground">Month 4: $2.5M revenue vs $2,300 total cost = $2,497,700 profit</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">SR Fronter Strategy:</span> As volume scales, SR Fronters are developed from
              top-performing offshore dialers. SR Fronters take standard deals further — handling qualification, initial pitch, and
              even preliminary closing — which reduces P2's workload to exclusively $30k+ high-ticket files. This is what enables the
              <span className="font-bold text-foreground"> 40-minute close standard</span>: SR Fronters pre-qualify and warm the lead,
              P2 closes in 40 minutes flat, and the next transfer is already in queue.
            </p>
          </div>
        </div>

        {/* Phase Summaries */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">Four-Phase Roadmap — 120 Days</h2>
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
                All 16 Weeks
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

        {/* Post-120-Day Projection */}
        <div className="rounded-xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-red-500/5 p-6">
          <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6 text-orange-500" />
            Post-Day-120 Projection — Months 5 & 6
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-card border border-border p-5">
              <p className="text-xs font-bold text-orange-400 mb-1">MONTH 5 (Weeks 17-20)</p>
              <p className="text-3xl font-bold text-orange-400">$3,200,000</p>
              <p className="text-sm text-muted-foreground">Enrolled debt · $68,800 commission earnings @ 2.15%</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> 299 enrolled files</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> 665 live transfers</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> 8 dialers at full capacity</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> SR Fronters driving 25%+ of deal flow</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> 40-minute close standard across all calls</li>
              </ul>
            </div>
            <div className="rounded-lg bg-card border border-border p-5">
              <p className="text-xs font-bold text-red-400 mb-1">MONTH 6 (Weeks 21-24)</p>
              <p className="text-3xl font-bold text-red-400">$4,500,000</p>
              <p className="text-sm text-muted-foreground">Enrolled debt · $96,750 commission earnings @ 2.15%</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> 432 enrolled files</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> 848 live transfers</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> Multi-company rollout begins</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> 2-4 additional closers hired and training</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> Full automation driving 30%+ of deal flow</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
            <p className="text-sm">
              <span className="font-bold text-orange-400">Velocity trajectory post-Month 6:</span>{' '}
              With 8 dialers, SR Fronters, full automation, and multi-company rollout, the system compounds.
              Month 7 projects $6M+, Month 8 $8M+, with no ceiling in sight. The hockey stick has no plateau.
            </p>
          </div>
        </div>

        {/* Key Metrics Dashboard */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">120-Day Key Metrics Dashboard</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Enrolled Debt (120 days)', value: '$6.15M', sub: '$500K + $1.35M + $1.8M + $2.5M', icon: DollarSign, color: '#10b981' },
              { label: 'Total Commission Earnings', value: '$127,475', sub: 'M1: 1.2% · M2-M4: 2.15%', icon: TrendingUp, color: '#0ea5e9' },
              { label: 'Total Live Transfers (120 days)', value: '1,214', sub: '15/day → 145/day', icon: Phone, color: '#8b5cf6' },
              { label: 'Total Enrolled Files', value: '473', sub: '28 + 83 + 141 + 221', icon: FileText, color: '#f59e0b' },
              { label: 'Peak Weekly Revenue', value: '$700K', sub: 'Week 16 (Month 4 peak)', icon: Rocket, color: '#ef4444' },
              { label: 'Peak Weekly Earnings', value: '$15,050', sub: 'Week 16 @ 2.15%', icon: Award, color: '#10b981' },
              { label: 'Total Monthly Costs', value: '$2,300', sub: '$2K call center + $300 AI', icon: Gauge, color: '#a78bfa' },
              { label: 'Profit Margin', value: '99.9%', sub: '$2.5M rev vs $2.3K cost', icon: Shield, color: '#10b981' },
              { label: 'Close Time Standard', value: '40 min', sub: 'SR Fronters + P2 closing', icon: Clock, color: '#0ea5e9' },
              { label: 'Dialer Capacity', value: '8 dialers', sub: 'Scaled from 2 over 120 days', icon: Users, color: '#8b5cf6' },
              { label: '6-Month Total Debt', value: '$13.85M', sub: 'M1-M6 combined', icon: Crown, color: '#ef4444' },
              { label: '6-Month Earnings', value: '$293,025', sub: 'At 2.15% (M2-M6) + 1.2% (M1)', icon: Sparkles, color: '#f59e0b' },
            ].map((metric, i) => {
              const Icon = metric.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-5 w-5" style={{ color: metric.color }} />
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: metric.color }}>{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.sub}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Company Rollout */}
        <div>
          <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6 text-sky-500" />
            Multi-Company Rollout Strategy
          </h2>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Beyond internal operations, the Debt Call Coach platform will be rolled out to other debt consolidation companies as a managed service. This is where the dynasty scales beyond two people:</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-4">
                <p className="mb-2 text-xs font-bold text-sky-400">MONTH 1-2</p>
                <h4 className="mb-1 font-semibold">Internal Proof of Concept</h4>
                <p className="text-sm text-muted-foreground">$500K → $1.35M internally. Validate the full pipeline — AI agents, Philippines fronters, Live Q&A, Intent Engine. Document every workflow. Base44 is watching.</p>
              </div>
              <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-4">
                <p className="mb-2 text-xs font-bold text-violet-400">MONTH 3-4</p>
                <h4 className="mb-1 font-semibold">Playbook Packaging</h4>
                <p className="text-sm text-muted-foreground">$1.8M → $2.5M. Package the complete system — scripts, AI prompts, transfer protocols, closing frameworks, SR Fronter program — into a repeatable, sellable playbook.</p>
              </div>
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
                <p className="mb-2 text-xs font-bold text-emerald-400">MONTH 5-6+</p>
                <h4 className="mb-1 font-semibold">External Company Onboarding</h4>
                <p className="text-sm text-muted-foreground">$3.2M → $4.5M. Begin onboarding external debt consolidation companies as managed clients. P1 handles tech deployment, P2 handles training & closing methodology transfer. 2-4 additional closers hired.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-xl border border-border bg-gradient-to-br from-sky-500/5 to-violet-500/5 p-6 text-center">
          <p className="text-base font-medium">
            <span className="font-bold">Christopher Bongiorno</span> (IAPDA Licensed) ·{' '}
            <span className="font-bold">Stephani Scheidt</span> (In Progress)
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            120-Day Target: $6.15M Enrolled Debt · $127K Commission Earnings · 99.9% Margin · 40-Minute Close
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Built on the Debt Call Coach platform's AI agent pipeline, Intent Engine, Live Q&A Copilot, and Philippines fronter network.
            Base44 feature candidate — advanced AI and development skills maximizing every tool the platform offers.
          </p>
          <p className="mt-2 text-sm font-bold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
            A dynasty is being built. A power couple of the ages.
          </p>
        </div>
      </div>
    </div>
  );
}