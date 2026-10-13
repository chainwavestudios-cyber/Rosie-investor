/**
 * WorkReportPage.jsx — Bi-weekly productivity report for employer review.
 * Shows daily time logs across lead scraping, BOB training & AI, and fronter
 * portal development with results and key metrics. Mock data for demonstration.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const RED = '#ef4444';

// ── Mock daily work log (12 working days, 6 days/week × 2 weeks) ──
const WORK_DAYS = [
  { date: '2026-09-29', day: 'Tue', scraping: 3.5, bob: 3.0, portal: 4.5, notes: 'Built Apify Twitter scraper skeleton; BOB persona engine (Duck/Owl/Cow); fronter lead import modal' },
  { date: '2026-09-30', day: 'Wed', scraping: 4.0, bob: 3.5, portal: 4.0, notes: 'Social lead enrichment pipeline; BOB voice synthesis integration; FronterContactCard component' },
  { date: '2026-10-01', day: 'Thu', scraping: 2.5, bob: 3.0, portal: 4.5, notes: 'Debt distress keyword targeting; 4 open BOB simulations; dialer session management' },
  { date: '2026-10-02', day: 'Fri', scraping: 3.0, bob: 3.0, portal: 5.5, notes: 'LeadCrossEnrich backend function; BOB scenario builder; FronterLeadsTab with status filters' },
  { date: '2026-10-03', day: 'Sat', scraping: 4.5, bob: 2.5, portal: 3.5, notes: 'ScrapeSocialLeads scheduled 4x daily; 5 open + 2 close BOB simulations; Twilio line assignment' },
  { date: '2026-10-04', day: 'Sun', off: true },
  { date: '2026-10-05', day: 'Mon', scraping: 3.0, bob: 3.5, portal: 5.0, notes: 'Lead identity resolution; 6 open BOB simulations + transcript review; FronterAIPanel live transcript' },
  { date: '2026-10-06', day: 'Tue', scraping: 2.5, bob: 4.0, portal: 4.0, notes: 'Smart lead filtering & scoring; 5 open + 3 close BOB simulations; FronterCallCard floating window' },
  { date: '2026-10-07', day: 'Wed', scraping: 3.5, bob: 3.5, portal: 4.5, notes: 'Credit report OCR extraction; 4 open + 4 close BOB simulations; FronterContactCard with debt ledger' },
  { date: '2026-10-08', day: 'Thu', scraping: 3.0, bob: 3.0, portal: 5.0, notes: 'ScreenDebtFit qualification AI; BOB objection engine tuning; FronterHeadsUpPopup real-time alerts' },
  { date: '2026-10-09', day: 'Fri', scraping: 4.0, bob: 3.5, portal: 4.5, notes: 'Lead scraping rate-limit handling; 5 open + 5 close BOB simulations; FronterMonitorPanel for admins' },
  { date: '2026-10-10', day: 'Sat', scraping: 2.5, bob: 3.0, portal: 4.5, notes: 'ScrapedLead deduplication; 4 open + 4 close BOB simulations; FronterPerformanceReport audit system' },
  { date: '2026-10-11', day: 'Sun', off: true },
];

// ── Project results (mock metrics) ──
const RESULTS = {
  scraping: {
    label: 'Lead Internet Scraping',
    color: BLUE,
    icon: '🔍',
    metrics: [
      { label: 'Total Leads Scraped', value: '4,832' },
      { label: 'Qualified Debt-Lead Matches', value: '1,247' },
      { label: 'Scraping Sources Online', value: '6' },
      { label: 'Auto-Enrichment Success Rate', value: '78%' },
      { label: 'Duplicate Filter Accuracy', value: '94%' },
      { label: 'Avg Leads / Day', value: '403' },
    ],
    deliverables: [
      'Apify-based Twitter/X scraper for debt-distress keywords (deployed, 4x daily)',
      'Social lead enrichment pipeline with AI qualification (screenDebtFit)',
      'Lead identity resolution system (resolveLeadIdentity backend function)',
      'ScrapedLead entity with auto-deduplication and rate-limit handling',
      'Smart lead filtering & scoring with intent signals',
      'Credit report OCR extraction (analyzeCreditReport)',
    ],
  },
  bob: {
    label: 'BOB Training & AI Development',
    color: PURPLE,
    icon: '🤖',
    metrics: [
      { label: 'Open Simulations Run', value: '47' },
      { label: 'Close Simulations Run', value: '28' },
      { label: 'Avg Open Sim Duration', value: '18m 36s' },
      { label: 'Avg Close Sim Duration', value: '53m 17s' },
      { label: 'Total Training Time', value: '39.4h' },
      { label: 'AI Personas Built', value: '3' },
    ],
    deliverables: [
      'BOB cold-call training simulator with live Twilio voice integration',
      'Three AI customer personas — Duck (passive), Owl (analytical), Cow (stubborn)',
      'BOB scenario builder with preset debt-relief cold-call situations',
      'BOB objection engine with dynamic rebuttal generation',
      '47 open-call simulations conducted (avg 18m 36s each)',
      '28 close-call simulations conducted (avg 53m 17s each)',
      'BOB transcript persistence with recording retention & auto-cleanup',
      'BOB brain scanner for knowledge-base ingestion and training',
      'BOB callback scheduling for follow-up training sessions',
      'Manual objection injection panel for targeted coaching',
      'BOB training log entity for progress tracking and analytics',
      'Pop-out coaching panel with real-time AI feedback during simulations',
    ],
  },
  portal: {
    label: 'Fronter Portal — Human Verification',
    color: GOLD,
    icon: '🖥️',
    metrics: [
      { label: 'Components Built', value: '47' },
      { label: 'Backend Functions', value: '23' },
      { label: 'Entities Designed', value: '18' },
      { label: 'Workflows Automated', value: '9' },
      { label: 'Bug Fixes Applied', value: '64' },
      { label: 'Avg Session Length', value: '5.2h' },
    ],
    deliverables: [
      'Full fronter dialer system with Twilio WebRTC integration',
      'FronterContactCard — unified lead management with debt ledger, notes, checklist',
      'FronterLeadsTab with prospect/lead status filtering and search',
      'FronterCallCard — floating window with Contact, Q&A, and Script sections',
      'FronterAIPanel — live transcript AI assistant with KB-backed Q&A',
      'FronterMonitorPanel — admin dashboard for live call monitoring (listen/barge)',
      'FronterPerformanceReport — automated AI audit system with AM/PM reports',
      'FronterHeadsUpPopup — real-time transfer alerts with 3-second polling',
      'FronterTimeEntry — clock in/out with lunch and AM/PM break tracking',
      'FronterActivityLog — full navigation and session activity logging',
      'FronterBobTrainer — cold-call training simulator with AI personas',
      'AI Fronting Agent — automated voice agent with Twilio + Deepgram + Anthropic',
      '45-minute inactivity auto-logout with retroactive clock-out',
      'Email tracking notification badges (open/click popups)',
      'FronterOnboarding — agreement signing and password reset flow',
      'FronterChatBox + FronterChatroom — real-time team communication',
      'FronterClosedDealsTab with celebration confetti popups',
      'FronterEmergencyScript — Alt+S quick-access emergency script',
    ],
  },
};

const fmtHours = (h) => `${h.toFixed(1)}h`;

export default function WorkReportPage() {
  const [expanded, setExpanded] = useState({ scraping: true, bob: true, portal: true });

  const workingDays = WORK_DAYS.filter(d => !d.off);
  const totalHours = workingDays.reduce((s, d) => s + d.scraping + d.bob + d.portal, 0);
  const totalScraping = workingDays.reduce((s, d) => s + d.scraping, 0);
  const totalBob = workingDays.reduce((s, d) => s + d.bob, 0);
  const totalPortal = workingDays.reduce((s, d) => s + d.portal, 0);
  const avgPerDay = totalHours / workingDays.length;
  const maxDaily = Math.max(...workingDays.map(d => d.scraping + d.bob + d.portal));

  const startDate = workingDays[0].date;
  const endDate = workingDays[workingDays.length - 1].date;

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const cat = (key) => RESULTS[key];

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ── Report Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ color: GOLD, fontSize: '12px', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '8px' }}>Bi-Weekly Development Report</div>
          <h1 style={{ color: '#e8e0d0', fontSize: '32px', fontWeight: 'normal', margin: '0 0 6px' }}>RoieAI Investor Platform — Engineering Work Log</h1>
          <p style={{ color: '#8a9ab8', fontSize: '14px', margin: '0 0 4px' }}>{fmtDate(startDate)} — {fmtDate(endDate)}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>Prepared by: Lead Developer · Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* ── Summary Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>
          {[
            { label: 'Total Hours Logged', value: fmtHours(totalHours), color: GOLD, sub: `${workingDays.length} working days` },
            { label: 'Avg Hours / Day', value: fmtHours(avgPerDay), color: BLUE, sub: '6 days / week schedule' },
            { label: 'Days Worked', value: `${workingDays.length} / 14`, color: PURPLE, sub: '2-week period' },
            { label: 'Longest Single Day', value: fmtHours(maxDaily), color: AMBER, sub: 'Peak productivity day' },
          ].map((c, i) => (
            <div key={i} style={{ background: '#0d1b2a', border: `1px solid ${c.color}33`, borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
              <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{c.label}</div>
              <div style={{ color: c.color, fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>{c.value}</div>
              <div style={{ color: '#4a5568', fontSize: '11px' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Category Time Breakdown Bar ── */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '24px', marginBottom: '40px' }}>
          <h2 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'normal', margin: '0 0 16px' }}>📊 Time Distribution by Project</h2>
          <div style={{ display: 'flex', height: '36px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
            {['scraping', 'bob', 'portal'].map(key => {
              const c = cat(key);
              const hrs = key === 'scraping' ? totalScraping : key === 'bob' ? totalBob : totalPortal;
              const pct = (hrs / totalHours) * 100;
              return (
                <div key={key} style={{ width: `${pct}%`, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: DARK, transition: 'width 0.3s' }}>
                  {pct.toFixed(0)}%
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {['scraping', 'bob', 'portal'].map(key => {
              const c = cat(key);
              const hrs = key === 'scraping' ? totalScraping : key === 'bob' ? totalBob : totalPortal;
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
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: BLUE, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Scraping</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: PURPLE, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>BOB Training</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Portal Dev</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#e8e0d0', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Key Work Completed</th>
                </tr>
              </thead>
              <tbody>
                {WORK_DAYS.map((d, i) => {
                  const total = d.off ? 0 : d.scraping + d.bob + d.portal;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ color: '#e8e0d0', fontSize: '12px' }}>{fmtDate(d.date)}</div>
                        <div style={{ color: '#4a5568', fontSize: '10px' }}>{d.day}</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: d.off ? '#4a5568' : BLUE, fontSize: '12px' }}>{d.off ? '—' : fmtHours(d.scraping)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: d.off ? '#4a5568' : PURPLE, fontSize: '12px' }}>{d.off ? '—' : fmtHours(d.bob)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: d.off ? '#4a5568' : GOLD, fontSize: '12px' }}>{d.off ? '—' : fmtHours(d.portal)}</td>
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
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: BLUE, fontSize: '14px', fontWeight: 'bold' }}>{fmtHours(totalScraping)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: PURPLE, fontSize: '14px', fontWeight: 'bold' }}>{fmtHours(totalBob)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: GOLD, fontSize: '14px', fontWeight: 'bold' }}>{fmtHours(totalPortal)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>{fmtHours(totalHours)}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '11px' }}>Avg {fmtHours(avgPerDay)}/day over {workingDays.length} working days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Project Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
          {['scraping', 'bob', 'portal'].map(key => {
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
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>{key === 'scraping' ? totalScraping : key === 'bob' ? totalBob : totalPortal}h invested · {c.deliverables.length} deliverables</div>
                  </div>
                  <span style={{ color: '#4a5568', fontSize: '14px' }}>{isExpanded ? '▾' : '▸'}</span>
                </div>

                {isExpanded && (
                  <div style={{ padding: '20px 24px' }}>
                    {/* Metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                      {c.metrics.map((m, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px', textAlign: 'center' }}>
                          <div style={{ color: c.color, fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>{m.value}</div>
                          <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>

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
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Summary Statement ── */}
        <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}22`, borderRadius: '8px', padding: '28px', marginBottom: '32px' }}>
          <h2 style={{ color: GOLD, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>📋 Executive Summary</h2>
          <p style={{ color: '#8a9ab8', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
            Over the two-week period of {fmtDate(startDate)} to {fmtDate(endDate)}, a total of <strong style={{ color: GOLD }}>{fmtHours(totalHours)}</strong> were invested across
            three core development tracks. The lead scraping infrastructure processed over <strong style={{ color: BLUE }}>4,800 raw leads</strong> with a 78% AI enrichment success rate.
            The BOB training system was both built and actively used — <strong style={{ color: PURPLE }}>47 open-call simulations</strong> (avg 18m 36s) and
            <strong style={{ color: PURPLE }}> 28 close-call simulations</strong> (avg 53m 17s) were completed, totaling over 39 hours of live AI-driven training.
            The fronter portal — the human verification layer — was built from the ground up with <strong style={{ color: GOLD }}>47 components, 23 backend functions, and 18 database entities</strong>,
            including a full Twilio-powered dialer, live AI assistant, admin monitoring panel, automated performance audits, and time tracking. Work was conducted 6 days per week
            at an average of <strong style={{ color: GOLD }}>{fmtHours(avgPerDay)} per day</strong>, with peak days exceeding 11 hours.
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