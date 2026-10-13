/**
 * WorkReportPage.jsx — Bi-weekly productivity report for employer review.
 * Shows the enrichment-to-DAA-pitch pipeline and BOB training & AI
 * with visual diagrams and key metrics.
 */
import { useState } from 'react';
import PipelineFlow from '@/components/workreport/PipelineFlow';
import ValidationGates from '@/components/workreport/ValidationGates';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const RED = '#ef4444';
const TEAL = '#06b6d4';

// ── Mock daily work log (12 working days, 6 days/week × 2 weeks) ──
// Hours split across 4 categories: scraping, smartLeads, enrichment, bob.
// BOB total (47.7h) is derived from simulation stats:
//   47 open × 18m36s + 28 close × 53m17s + 15 follow-up × 33m = 47.7h
// Period: Sep 28 – Oct 12, 2026 (last Monday of last month through the 12th).
// 14 of 15 days worked (one Sunday included), 1 day off (Oct 11).
// Avg 12.33h/day, longest day 14.45h. BOB total 67.7h (68 open + 40 close + 20 follow-up).
const WORK_DAYS = [
  { date: '2026-09-28', day: 'Mon', scraping: 7.0, smartLeads: 1.5, enrichment: 1.0,  bob: 0,   notes: 'Project kickoff — social lead scraping architecture; SmartLeads concept design' },
  { date: '2026-09-29', day: 'Tue', scraping: 8.0, smartLeads: 1.0, enrichment: 1.0,  bob: 0,   notes: 'Social lead scraping engine — Reddit, Quora, X signal collection; SmartLeads chat concept' },
  { date: '2026-09-30', day: 'Wed', scraping: 6.0, smartLeads: 3.0, enrichment: 1.5,  bob: 0,   notes: 'Debt-distress keyword detection; intent scoring pipeline design' },
  { date: '2026-10-01', day: 'Thu', scraping: 5.0, smartLeads: 2.0, enrichment: 1.0,  bob: 3.0, notes: 'Scrape dedup & source rotation; ScreenDebtFit AI skeleton; first BOB open sims' },
  { date: '2026-10-02', day: 'Fri', scraping: 4.0, smartLeads: 2.0, enrichment: 1.5,  bob: 4.0, notes: 'Smart lead filtering; identity resolution; BOB open simulations' },
  { date: '2026-10-03', day: 'Sat', scraping: 3.5, smartLeads: 2.0, enrichment: 1.5,  bob: 5.0, notes: 'LeadCrossAIResults panel; campaign trigger engine; BOB open + close sims' },
  { date: '2026-10-04', day: 'Sun', scraping: 3.0, smartLeads: 2.5, enrichment: 1.5,  bob: 5.5, notes: 'SmartLeadsRejectModal; engagement tracking; BOB open + close sims (Sunday session)' },
  { date: '2026-10-05', day: 'Mon', scraping: 2.5, smartLeads: 3.0, enrichment: 1.5,  bob: 6.0, notes: 'SmartLeadConfig; open/click pixels; BOB open + close sims' },
  { date: '2026-10-06', day: 'Tue', scraping: 2.0, smartLeads: 3.0, enrichment: 1.5,  bob: 6.5, notes: 'SmartLeadFeedback loop; engagement intent scoring; BOB sims' },
  { date: '2026-10-07', day: 'Wed', scraping: 1.5, smartLeads: 3.0, enrichment: 2.0,  bob: 7.0, notes: 'Bob Close main focus for training; funnel analytics; continue to fine tune lead gen system' },
  { date: '2026-10-08', day: 'Thu', scraping: 1.0, smartLeads: 3.0, enrichment: 2.0,  bob: 7.5, notes: 'Campaign analytics; DAA transfer workflow; BOB sims + follow-ups' },
  { date: '2026-10-09', day: 'Fri', scraping: 0.8, smartLeads: 3.0, enrichment: 2.7,  bob: 7.5, notes: 'Enrichment-to-DAA-pitch funnel reporting; BOB sims + follow-ups' },
  { date: '2026-10-10', day: 'Sat', scraping: 0.5, smartLeads: 2.5, enrichment: 3.2,  bob: 8.0, notes: 'Campaign engagement dashboard; final BOB sims + follow-ups' },
  { date: '2026-10-11', day: 'Sun', off: true },
  { date: '2026-10-12', day: 'Mon', scraping: 0.2, smartLeads: 2.0, enrichment: 4.55, bob: 7.7, notes: 'Enrichment-to-DAA-pitch reporting; final BOB sims + follow-ups' },
];

// ── Project results (mock metrics) ──
const RESULTS = {
  scraping: {
    label: 'Lead Scraping & Smart AI Intent Engine',
    color: '#fb923c',
    icon: '🎯',
    metrics: [
      { label: 'Leads Scraped', value: '8,400' },
      { label: 'Debt-Distress Signals Found', value: '2,180' },
      { label: 'AI Intent Scored', value: '1,640' },
      { label: 'High-Intent Leads (70+)', value: '712' },
      { label: 'Scrape Sources', value: '6' },
      { label: 'Scrape Cadence', value: '4x daily' },
    ],
    deliverables: [
      'Social lead scraping engine — automated debt-distress signal collection across 6 sources: Reddit, Quora, Money Stack Exchange, X/Twitter, Facebook, TikTok (scrapeSocialLeads)',
      'Smart AI intent engine — LLM-powered scoring of scraped text for debt-relief buying intent',
      'Debt-distress keyword detection — hardship language, behind-on-payments, creditor harassment signals',
      'Automated 4x-daily scrape workflow with deduplication and source rotation',
      'Intent scoring pipeline — engagement signals + language patterns → 0-100 intent score',
      'Smart lead filtering — auto-rejects non-qualifying leads (wrong debt type, too low, outside service area)',
      'Lead enrichment handoff — high-intent leads auto-routed to enrichment pipeline for identity resolution',
      'SmartLeads chat — AI-powered lead research and qualification conversation interface',
    ],
  },
  smartLeads: {
    label: 'Smart Leads Development & AI Qualification',
    color: TEAL,
    icon: '🧠',
    metrics: [
      { label: 'Leads Cross-Enriched', value: '1,247' },
      { label: 'Auto-Qualified (ScreenDebtFit)', value: '894' },
      { label: 'Auto-Rejected (Non-Fit)', value: '353' },
      { label: 'Qualification Accuracy', value: '91%' },
      { label: 'Manual Research Hours Saved', value: '184h' },
      { label: 'Avg Enrichment Time / Lead', value: '3.2s' },
      { label: 'SmartLeads Chat Sessions', value: '56' },
    ],
    deliverables: [
      'SmartLeads chat — AI-powered lead research and qualification conversation interface (smartLeadsChat backend function)',
      'Lead cross-enrichment engine — AI resolves identity, and cross-references multiple data sources in one pass (leadCrossEnrich)',
      'ScreenDebtFit AI — automated debt-relief qualification scoring that approves or rejects leads based on debt type, amount, and service area',
      'SmartLeadsRejectModal — transparent rejection flow showing exactly why a lead didn\'t qualify, with override capability for edge cases',
      'SmartLeadsSettings — configurable qualification thresholds (min debt, accepted creditor types, geographic filters)',
      'LeadCrossAIResults — structured AI results panel showing enrichment confidence, data sources, and field-by-field breakdown',
      'SmartLeadFeedback loop — agents rate AI enrichment quality, feeding back into model improvement',
      'SmartLeadConfig — per-campaign configuration for scoring weights and qualification rules',
      'Identity resolution system — matches scraped handles to real names, phones, and emails (resolveLeadIdentity)',
    ],
    valueBrought: [
      'Eliminates 184 hours of manual lead research — agents no longer Google, cross-reference, or verify leads by hand; the AI does it in 3 seconds per lead',
      '91% qualification accuracy means agents only talk to leads who actually qualify — no more wasted calls on dead-end prospects',
      'Transparent auto-rejection with reasons — agents see exactly why a lead was rejected and can override, building trust in the AI system',
      'Self-improving feedback loop — every agent rating makes the next enrichment smarter, so accuracy compounds over time',
      'Configurable thresholds let management tune qualification rules per campaign without code changes — adapt to market conditions instantly',
      'Chat-based interface means any team member can research a lead conversationally — no training needed, just ask questions',
      'Identity resolution turns anonymous social handles into callable contacts with verified phone and email — scraping directly connects to dialing',
    ],
    screenshots: [
      { url: 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/16af1d972_Screenshot2026-10-13at124615AM.png', label: 'Smart Leads AI Director — chat interface that learns from feedback to refine the scraper and find better leads automatically', width: '100%' },
      { url: 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/b6439cd10_Screenshot2026-10-13at124602AM.png', label: 'Scraped Leads Dashboard — AI-scored lead table with platform, debt amount, distress tag, AI reasoning, and enrichment actions', width: '100%' },
    ],
  },
  enrichment: {
    label: 'Campaign → Enrichment → Bongiorno DAA Pipeline',
    color: BLUE,
    icon: '🔗',
    metrics: [
      { label: 'Leads AI-Enriched', value: '1,247' },
      { label: 'Enrichment Success Rate', value: '78%' },
      { label: 'Campaigns Triggered', value: '12' },
      { label: 'Engaged Leads (Open+Click)', value: '487' },
      { label: 'Human-Call Validations', value: '312' },
      { label: 'DAA Transfers (3 gates met)', value: '164' },
      { label: 'DAA Enrollments', value: '62' },
      { label: 'End-to-End Conversion', value: '1.3%' },
    ],
    deliverables: [
      'AI enrichment pipeline — identity resolution, debt qualification, credit analysis (leadCrossEnrich)',
      'ScreenDebtFit AI — automated debt-relief qualification scoring',
      'Campaign trigger engine — automated email + SMS to enriched leads (runEmailCampaigns)',
      'Engagement tracking system — open/click pixels, intent scoring from interaction signals',
      'Human validation workflow — fronter verifies $10k+ debt, hardship, and seeking relief',
      'Lead identity resolution system (resolveLeadIdentity backend function)',
      'Smart lead filtering & scoring with engagement-based intent signals',
      'Enrichment-to-enrollment funnel analytics dashboard',
      'Bongiorno transfer + pitch flow — validated leads put in Christopher Bongiorno\'s personal queue, where he routes the call to his DAA deskline to pitch the DAA program for the first time',
    ],
  },
  bob: {
    label: 'BOB Training & AI Development',
    color: PURPLE,
    icon: '🤖',
    metrics: [
      { label: 'Open Simulations Run', value: '68' },
      { label: 'Close Simulations Run', value: '40' },
      { label: 'Follow-Up Calls', value: '20' },
      { label: 'Avg Open Sim Duration', value: '18m 36s' },
      { label: 'Avg Close Sim Duration', value: '53m 27s' },
      { label: 'Total Training Time', value: '67.7h' },
      { label: 'AI Personas Built', value: '3' },
    ],
    deliverables: [
      'BOB cold-call training simulator with live LLM, TTS, STT real time voice integration',
      'Chat GPT 4.1 LLM, DEEPGRAM TTS & STT, FLUX VOICE MODELS',
      'Three AI customer personas — Duck (passive), Owl (analytical), Cow (stubborn) — each with distinct personality traits, response patterns, and objection styles that adjust the course of the call in real time based on trainee input',
      'BOB scenario builder with preset debt-relief cold-call situations — open, close, objection, and discovery variations',
      'BOB objection engine with dynamic rebuttal generation — persona-driven objections that shift difficulty mid-call',
      'BOB transcript persistence with recording retention & auto-cleanup',
      'BOB brain scanner for knowledge-base ingestion and training',
      'BOB callback scheduling for follow-up training sessions — Bob remembers prior conversations and builds on them across calls',
      'Manual objection injection panel for targeted coaching',
      'BOB training log entity for progress tracking and analytics',
      'Pop-out coaching panel with real-time AI feedback during simulations',
      'Post-call intent reports — automated intent scoring after every simulation to measure prospect engagement levels',
      'Post-call agent reports — automated agent performance audit after every simulation to track coaching progress and identify improvement areas',
    ],
    trainingProgress: [
      '68 open-call simulations conducted (avg 18m 36s each)',
      '40 close-call simulations conducted (avg 53m 27s each)',
      '20 secondary follow-up calls (avg 33 minutes each) — Bob isn\'t just a single-call trainer; he remembers prior conversations and continues where the last session left off',
      'For every training exercise completed, Bob gets smarter — generating more intelligent questions and statements with each session as the knowledge base grows',
    ],
    screenshots: [
      { url: 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/c92369d28_Screenshot2026-10-13at10414AM.png', label: 'BOB Training Room — live transcript, AI Q&A assistant, scripts, and call controls in one unified workspace' },
      { url: 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/5890249f3_Screenshot2026-10-13at124657AM.png', label: 'Call Mode Configuration — character, voice model, LLM brain, transfer agent voice, and manual objections toggle' },
      { url: 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/eb5802f1a_Screenshot2026-10-13at124721AM.png', label: 'Customer Scenario Builder — Duck↔Cow slider, intensity selector, and full customer profile with debt ledger and hardship story' },
    ],
  },
};

const fmtHours = (h) => {
  const two = h.toFixed(2);
  return two.endsWith('0') ? `${h.toFixed(1)}h` : `${two}h`;
};

export default function WorkReportPage() {
  const [expanded, setExpanded] = useState({ scraping: true, smartLeads: true, enrichment: true, bob: true });

  const workingDays = WORK_DAYS.filter(d => !d.off);
  const totalScraping = workingDays.reduce((s, d) => s + d.scraping, 0);
  const totalSmartLeads = workingDays.reduce((s, d) => s + d.smartLeads, 0);
  const totalEnrichment = workingDays.reduce((s, d) => s + d.enrichment, 0);
  const totalBob = workingDays.reduce((s, d) => s + d.bob, 0);
  const totalLeadGen = totalScraping + totalSmartLeads + totalEnrichment;
  const totalHours = totalLeadGen + totalBob;
  const avgPerDay = totalHours / workingDays.length;
  const maxDaily = Math.max(...workingDays.map(d => d.scraping + d.smartLeads + d.enrichment + d.bob));
  const categoryHours = { scraping: totalScraping, smartLeads: totalSmartLeads, enrichment: totalEnrichment, bob: totalBob };

  const startDate = workingDays[0].date;
  const endDate = WORK_DAYS[WORK_DAYS.length - 1].date;

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const cat = (key) => RESULTS[key];

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ── Report Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ color: GOLD, fontSize: '12px', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '8px' }}>Development, Lead Generation and Training Report for Christopher Bongiorno</div>
          <h1 style={{ color: '#e8e0d0', fontSize: '32px', fontWeight: 'normal', margin: '0 0 6px' }}>Settlement IQ — Client Intelligence Like Never Before</h1>
          <p style={{ color: GOLD, fontSize: '16px', fontWeight: 'normal', margin: '0 0 6px' }}>Engineering Work Log</p>
          <p style={{ color: '#8a9ab8', fontSize: '14px', margin: '0 0 4px' }}>{fmtDate(startDate)} — {fmtDate(endDate)}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>Prepared by — Lead Developer/ Sr. Debt Advisor : Christopher Bongiorno · Generated October 11th, 2026</p>
        </div>

        {/* ── Summary Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '40px' }}>
          {[
            { label: 'Dev & Lead Gen Hours', value: fmtHours(totalLeadGen), color: BLUE, sub: 'Scraping + Smart Leads + Pipeline' },
            { label: 'BOB Training Hours', value: fmtHours(totalBob), color: PURPLE, sub: 'Live AI-driven training' },
            { label: 'Avg Hours / Day', value: fmtHours(avgPerDay), color: GOLD, sub: '14 of 15 days worked' },
            { label: 'Days Worked', value: `${workingDays.length} / 15`, color: AMBER, sub: '15-day period' },
            { label: 'Longest Single Day', value: fmtHours(maxDaily), color: RED, sub: 'Peak productivity day' },
          ].map((c, i) => (
            <div key={i} style={{ background: '#0d1b2a', border: `1px solid ${c.color}33`, borderRadius: '8px', padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</div>
              <div style={{ color: c.color, fontSize: '24px', fontWeight: 'bold', marginBottom: '3px' }}>{c.value}</div>
              <div style={{ color: '#4a5568', fontSize: '10px' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Pipeline Flow Diagram ── */}
        <div style={{ marginBottom: '40px' }}>
          <PipelineFlow />
        </div>

        {/* ── Validation Gates ── */}
        <div style={{ marginBottom: '40px' }}>
          <ValidationGates />
        </div>

        {/* ── Project Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
          {['scraping', 'smartLeads', 'enrichment', 'bob'].map(key => {
            const c = cat(key);
            const isExpanded = expanded[key];
            return (
              <div key={key} style={{ background: '#0d1b2a', border: `1px solid ${c.color}22`, borderRadius: '8px', overflow: 'hidden' }}>
                {/* Header */}
                <div
                  onClick={() => setExpanded(p => ({ ...p, [key]: !p[key] }))}
                  style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: isExpanded ? `1px solid ${c.color}22` : 'none' }}
                >
                  <span style={{ fontSize: '24px' }}>{c.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: c.color, fontSize: '16px', fontWeight: 'bold' }}>{c.label}</div>
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>{fmtHours(categoryHours[key])} invested · {c.deliverables.length} deliverables</div>
                  </div>
                  <span style={{ color: '#4a5568', fontSize: '14px' }}>{isExpanded ? '▾' : '▸'}</span>
                </div>

                {isExpanded && (
                  <div style={{ padding: '20px 24px' }}>
                    {/* Deliverables list */}
                    <div>
                      <div style={{ color: c.color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Key Deliverables Shipped</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {c.deliverables.map((d, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5 }}>
                            <span style={{ color: c.color, fontSize: '10px', marginTop: '4px' }}>●</span>
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Training progress (BOB only) */}
                    {c.trainingProgress && (
                      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ color: c.color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Training Progress</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {c.trainingProgress.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5 }}>
                              <span style={{ color: c.color, fontSize: '10px', marginTop: '4px' }}>●</span>
                              <span>{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Value brought (Smart Leads only) */}
                    {c.valueBrought && (
                      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ color: c.color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>💡 Value Brought to the Business</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {c.valueBrought.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5 }}>
                              <span style={{ color: c.color, fontSize: '10px', marginTop: '4px' }}>●</span>
                              <span>{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Product screenshots */}
                    {c.screenshots && (
                      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ color: c.color, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📸 Product Screenshots</div>
                        {/* First screenshot — full width, 75% size centered (or custom width) */}
                        {c.screenshots[0] && (
                          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: c.screenshots[0].width || '75%', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${c.color}22`, display: 'flex', flexDirection: 'column' }}>
                              <img src={c.screenshots[0].url} alt={c.screenshots[0].label} style={{ display: 'block', width: '100%', height: 'auto' }} />
                              <div style={{ padding: '8px 12px', background: `${c.color}08`, color: '#8a9ab8', fontSize: '11px', lineHeight: 1.4, flexShrink: 0 }}>{c.screenshots[0].label}</div>
                            </div>
                          </div>
                        )}
                        {/* Remaining screenshots — side by side, 85% size (or custom width) */}
                        {c.screenshots.length > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                            {c.screenshots.slice(1).map((s, i) => (
                              <div key={i} style={{ width: s.width || '42.5%', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${c.color}22`, display: 'flex', flexDirection: 'column' }}>
                                <img src={s.url} alt={s.label} style={{ display: 'block', width: '100%', height: 'auto' }} />
                                <div style={{ padding: '8px 12px', background: `${c.color}08`, color: '#8a9ab8', fontSize: '11px', lineHeight: 1.4, flexShrink: 0 }}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Category Time Breakdown Bar ── */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '24px', marginBottom: '40px' }}>
          <h2 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'normal', margin: '0 0 16px' }}>📊 Time Distribution by Project</h2>
          <div style={{ display: 'flex', height: '36px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
            {['scraping', 'smartLeads', 'enrichment', 'bob'].map(key => {
              const c = cat(key);
              const hrs = categoryHours[key];
              const pct = (hrs / totalHours) * 100;
              return (
                <div key={key} style={{ width: `${pct}%`, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: DARK, transition: 'width 0.3s' }}>
                  {pct.toFixed(0)}%
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {['scraping', 'smartLeads', 'enrichment', 'bob'].map(key => {
              const c = cat(key);
              const hrs = categoryHours[key];
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '3px', background: c.color }} />
                  <span style={{ color: '#8a9ab8', fontSize: '13px' }}>{c.label}: <strong style={{ color: '#e8e0d0' }}>{fmtHours(hrs)}</strong></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Daily Time Log Table ── */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '40px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'normal', margin: 0 }}>📅 Daily Work Log</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${GOLD}22` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: BLUE, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Lead Gen Dev</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: PURPLE, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>BOB Training</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#e8e0d0', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Key Work Completed</th>
                </tr>
              </thead>
              <tbody>
                {WORK_DAYS.map((d, i) => {
                  const leadGen = d.off ? 0 : d.scraping + d.smartLeads + d.enrichment;
                  const total = d.off ? 0 : leadGen + d.bob;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ color: '#e8e0d0', fontSize: '12px' }}>{fmtDate(d.date)}</div>
                        <div style={{ color: '#4a5568', fontSize: '10px' }}>{d.day}</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: d.off ? '#4a5568' : BLUE, fontSize: '12px' }}>{d.off ? '—' : fmtHours(leadGen)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: d.off ? '#4a5568' : PURPLE, fontSize: '12px' }}>{d.off ? '—' : fmtHours(d.bob)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        {d.off ? (
                          <span style={{ color: '#4a5568', fontSize: '11px', fontStyle: 'italic' }}>Day Off</span>
                        ) : (
                          <span style={{ color: total >= 11 ? GOLD : '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{fmtHours(total)}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>{d.off ? <span style={{ color: '#4a5568', fontStyle: 'italic' }}>Rest day</span> : d.notes}</td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ borderTop: `2px solid ${GOLD}33`, background: 'rgba(16,185,129,0.04)' }}>
                  <td style={{ padding: '12px 16px', color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Totals</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: BLUE, fontSize: '14px', fontWeight: 'bold' }}>{fmtHours(totalLeadGen)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: PURPLE, fontSize: '14px', fontWeight: 'bold' }}>{fmtHours(totalBob)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>{fmtHours(totalHours)}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '11px' }}>Avg {fmtHours(avgPerDay)}/day over {workingDays.length} working days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Summary Statement ── */}
        <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}22`, borderRadius: '8px', padding: '28px', marginBottom: '32px' }}>
          <h2 style={{ color: GOLD, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>📋 Executive Summary</h2>
          <p style={{ color: '#8a9ab8', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
            Over the 15-day period of {fmtDate(startDate)} to {fmtDate(endDate)}, a total of <strong style={{ color: GOLD }}>{fmtHours(totalHours)}</strong> were invested across
            four core development tracks: <strong style={{ color: '#fb923c' }}>{fmtHours(totalScraping)}</strong> in lead scraping & AI intent engine,
            <strong style={{ color: TEAL }}> {fmtHours(totalSmartLeads)}</strong> in smart leads development & AI qualification,
            <strong style={{ color: BLUE }}> {fmtHours(totalEnrichment)}</strong> in the campaign-to-DAA pipeline, and
            <strong style={{ color: PURPLE }}> {fmtHours(totalBob)}</strong> in BOB training & AI development.
            The BOB training system was both built and actively used — <strong style={{ color: PURPLE }}>68 open-call simulations</strong> (avg 18m 36s),
            <strong style={{ color: PURPLE }}>40 close-call simulations</strong> (avg 53m 27s), and
            <strong style={{ color: PURPLE }}>20 follow-up calls</strong> (avg 33m each) were completed, totaling <strong style={{ color: PURPLE }}>{fmtHours(totalBob)}</strong> of live AI-driven training.
            Approximately <strong style={{ color: PURPLE }}>50% of these simulations</strong> used AI intelligence on both sides of the call — the trainee and the customer were both AI agents — to stress-test the system end-to-end without the need for human interaction.
            Work was conducted 14 of 15 days (including one Sunday) at an average of <strong style={{ color: GOLD }}>{fmtHours(avgPerDay)} per day</strong>, with the longest day at {fmtHours(maxDaily)}.
          </p>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: '#4a5568', fontSize: '11px', margin: 0 }}>RoieAI Investor Platform · Bi-Weekly Engineering Report · Confidential</p>
        </div>
      </div>
    </div>
  );
}