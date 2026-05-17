import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

// ── NB Tech Price Scenarios (hardcoded context for Q&A / Coach / Intent) ──────
const NB_PRICE_SCENARIOS = `
NB TECH ACQUISITIONS — 7 INVESTOR RETURN SCENARIOS (6 Month / 1 Year / 18 Month)
Current offering: $0.16/share NB Tech common stock. 21:1 conversion → NewCo shares. Implied NewCo basis ~$3.36/share. Target Nasdaq IPO: $7.00/share. All scenarios are speculative forward-looking projections.

SCENARIO 1 — BASE CASE (Normal execution, Nasdaq listing Sept 2026)
• 6 Months: Lists at $7.00 → 2.08x on NewCo basis ($3.36 in, $7.00 out)
• 1 Year: Post-listing stabilizes at $9.50 (revenue growth visible) → 2.83x
• 18 Months: Magnus AI SaaS kicking in, stock at $14.00 → 4.17x

SCENARIO 2 — CONSERVATIVE (Audit/SEC delays, listing Q1 2027)
• 6 Months: Pre-listing, illiquid at $0.16 NB Tech (no change)
• 1 Year: Lists at $5.50 (below target) → 1.64x on NewCo basis
• 18 Months: Post-listing growth to $7.80 → 2.32x

SCENARIO 3 — BULL CASE (Siebert raise oversubscribed, AI sector momentum)
• 6 Months: Lists at $7.00, pops to $11.00 → 3.27x
• 1 Year: Revenue guidance + Magnus SaaS MRR visible → $16.50 → 4.91x
• 18 Months: Installer rollup acquisitions announced → $22.00 → 6.55x

SCENARIO 4 — AGGRESSIVE GROWTH (Magnus AI subscriptions materialize early)
• 6 Months: Lists at $7.00 → re-rates to $13.00 (P/S 5x on $64M fwd rev) → 3.87x
• 1 Year: Subscription MRR $500K/month ($6M ARR), stock at $19.00 → 5.65x
• 18 Months: Revenue $85M+, gross margin to 40%+, stock at $28.00 → 8.33x

SCENARIO 5 — REVENUE EXPLOSION (NightOwl Costco + commercial rollout)
• 6 Months: Lists $7.00 → $10.00 on Costco national rollout → 2.98x
• 1 Year: Revenue run rate $110M → stock at $24.00 → 7.14x
• 18 Months: Multi-site commercial contracts, recurring > hardware → $38.00 → 11.31x

SCENARIO 6 — SECTOR TAILWIND (Privacy-first/American-made becomes legislative mandate)
• 6 Months: Lists $7.00 → $12.00 on NDAA/procurement mandate → 3.57x
• 1 Year: Government contract, stock gaps to $21.00 → 6.25x
• 18 Months: Category-defining brand in $13.5B commercial security TAM → $35.00 → 10.42x

SCENARIO 7 — WORST CASE (Merger falls through or listing fails)
• 6 Months: No listing, stays private at $0.16 (illiquid) → 1.0x
• 1 Year: Bridge capital at $0.20–$0.25 → modest appreciation → 1.25–1.56x
• 18 Months: Alternative exit (OTC/reverse merger/acquisition) → $0.30–$0.50 → 1.88–3.13x

DOLLAR EXAMPLE — $25,000 minimum investment at $0.16/share:
• Shares acquired: 156,250 NB Tech shares → 7,440 NewCo shares (÷21)
• At $5.50 conservative: $40,920 (+$15,920)
• At $7.00 IPO target: $52,080 (+$27,080)
• At $11.00 bull pop: $81,840 (+$56,840)
• At $22.00 (18mo bull): $163,680 (+$138,680)
• At $38.00 (revenue explosion): $282,720 (+$257,720)
All figures pre-tax, hypothetical, not guaranteed.
`;

const NB_KEYWORD_CONTEXT = `
NB TECH KEY FACTS FOR CALL HANDLING:
• Share price: $0.16/share | Min investment: $25,000 (156,250 shares) | Max: $500,000
• Currently 18,257,000 shares issued | 1,000,000,000 authorized
• 21:1 conversion NB Tech → NewCo shares | Implied NewCo basis: ~$3.36/share
• Target Nasdaq IPO: $7.00/share | Initial market cap: ~$105M
• Siebert Williams Shank LOI (March 16, 2026) — min raise $15M, target $100M
• Nightowl: $49M annual revenue, 20+ years, Best Buy/Walmart/Amazon/Home Depot distribution
• Magnus AI: NB Tech's cloud+AI platform — cloud migration, AI alerts, privacy dashboards, subscriptions
• PCAOB Auditor: Astra Audit & Advisory | SEC Attorney: TroyGould | IR/PR: MicroCap Advisory
• Immediate EBITDA improvement post-merger: ~$3.3M (no revenue growth needed)
• Projected 2026 net income: $5.7M | 2027: $18.1M | 2028: $34M | 2029: $55.2M
• DCF implied enterprise value: $605M | CCA implied: ~$195M
• Eric Liboiron: CEO, 11M shares, $400K convertible note → 400M Class B shares (10 votes/share)
• Reg D Rule 506(c) — accredited investors only | Incorporated Nevada
• Payment: check, wire, ACH, credit card, or self-directed IRA
• Nightowl products: cameras, NVR, doorbells — all American-owned, manufactured Vietnam
• Privacy-first TAM: $50B+ growing 25-40% CAGR | Commercial security TAM: $13.5B
• Comparable security companies: Arlo (2.4x EV/Rev), ADT (2.8x), Alarm.com (2.5x), Ubiquiti (12x)
`;

// ── Tidbits Library ──────────────────────────────────────────────────────────
const TIDBITS = {
  'NB Tech Overview': [
    "NB Tech acquires and develops code-based AI, blockchain, and cryptography assets — think of them as Silicon Valley's access point for accredited investors who've historically been locked out. They started August 2021, already have a portfolio, and 70% of their Canadian development costs are subsidized by the Canadian government. That's a structural cost advantage most competitors don't have.",
    "The team runs deep — Eric Liboiron has 20+ years launching companies, they've assembled a PhD-level AI team, and Stan Watkins brings Fortune 100 consulting experience across 200+ industries. Savanna Spieckerman handles compliance with a background in data analytics. This isn't a startup with an idea — it's an operating team.",
    "The investment model is uniquely structured: unlike VC funds that lock investors into illiquid positions, NB Tech generates early cash flow through licensing while retaining full IP ownership. Multiple revenue streams — licensing, royalties, ownership of commercializing companies, and exits through sales or JVs.",
  ],
  'The 21:1 Conversion & IPO Math': [
    "Here's the math that matters: $0.16/share NB Tech, 21-to-1 into NewCo. Your implied NewCo cost basis is about $3.36/share. The Nasdaq IPO target is $7.00. That's more than doubling your basis at the opening bell — before any post-IPO price movement. The institutional investors coming in through Siebert will be paying $7. You paid the equivalent of $3.36.",
    "Dollar example on the $25,000 minimum: that buys you 156,250 NB Tech shares, which convert to approximately 7,440 NewCo shares. At the $7.00 IPO target, that's $52,080 — a $27,080 gain on your $25,000 investment. If it runs to $11 on AI sector momentum, you're looking at $81,840. These are projections, not guarantees — but that's the structure.",
    "The 21-to-1 ratio exists specifically because this is a pre-merger, pre-IPO entry point. By the time Siebert's institutional book comes in at $7.00, the conversion math has already built your upside into the structure. The ratio is the mechanism — your $0.16 buys a $3.36-equivalent NewCo position.",
  ],
  'The Nightowl Acquisition': [
    "Nightowl has been in business for over 20 years, $49 million in annual revenue — Best Buy, Walmart, Amazon, Home Depot. They have the distribution, the brand recognition, the repeat customer base. What they don't have is the technology stack for the next decade. NB Tech's Magnus AI delivers that. Neither company could build this combination from scratch as fast or as cheaply.",
    "Ron Ferris, the founder of Nightowl, isn't just selling and walking away. He's staying on as Chief Revenue Officer with equity in the combined company. When the founder retains skin in the game post-acquisition, that's a signal about his belief in the upside. He knows his business better than anyone — and he chose this path.",
    "The post-merger EBITDA improvement is $3.3 million annually — without growing revenue by a single dollar. That comes from eliminating redundant overhead between Magnus AI and Nightowl, retiring the $8.3M founder note (saves $788K in annual interest), capturing the Vietnamese subsidiary profit, and tech stack consolidation. Day-one improvement, no new sales required.",
  ],
  'Magnus AI & Technology': [
    "Magnus AI is NB Tech's full cloud and software platform — already funded and built. It delivers AI-powered smart detection (humans, vehicles, real threats — eliminates false alerts), privacy dashboards with granular data controls, subscription-based storage and monitoring, edge AI processing (local, not cloud-dependent), and a rebuilt mobile app ecosystem. This isn't a roadmap — it's built.",
    "The AI capabilities going into Nightowl products: facial recognition for known vs. unknown individuals, predictive security that learns household routines and anticipates risks, active deterrence with automated lights/sirens/voice warnings, identity-based door unlocking, zoned home security architecture, and emergency overrides. This is what transforms a hardware company into a platform.",
    "NB Tech's Canadian development team operates at 70% subsidized cost — funded by the Canadian government. Rhys Parry leads cloud infrastructure as CTO (Kubernetes, serverless, DevOps pioneer), and Dr. Abdul Jabbar heads AI/ML (PhD Computer Science, University of Newcastle, formerly Allen Institute for AI). This is credentialed technical depth.",
  ],
  'Siebert LOI & Nasdaq Timeline': [
    "Siebert Williams Shank has been around since 1967. FINRA and NYSE registered. About $18 billion in client assets, roughly $80 million in annual revenue, 150 employees. They signed the LOI on March 16, 2026. Minimum raise commitment: $15 million. Target: up to $100 million. That's real institutional validation — not a letter from a no-name boutique.",
    "The Nasdaq timeline: PCAOB audit completes in approximately 4 months, S-1 files concurrent with that, SEC review takes 1-2 rounds of comments (7-10 day turnaround targeted), Nasdaq listing application submitted mid-summer, S-1 declared effective late August, trading begins September 2026. The full team is retained: TroyGould as SEC counsel, Astra Audit as PCAOB auditor, MicroCap Advisory for IR/PR.",
    "To qualify for the Nasdaq Capital Market, NewCo needs: bid price minimum $4/share, at least 1 million publicly held shares, minimum $15M market value of public float, minimum 300 round-lot shareholders. The Siebert raise targeting $15M+ at $7.00/share satisfies the market value standard. Nightowl's 20+ year operating history satisfies the equity standard. The audit and S-1 are the execution steps.",
  ],
  'Revenue & Financials': [
    "Projected revenue trajectory for NewCo: $49M gross sales in 2025 (Nightowl baseline), $64M in 2026, $110M in 2027, $150M in 2028, and over $200M in 2029. That's roughly 48-50% CAGR from 2026 to 2029. The gross margin expands from 23% today to 53% by 2029 — that expansion is the Magnus AI SaaS layer on top of hardware revenue.",
    "The DCF analysis implies $605M enterprise value for the combined entity. Comparable company analysis — using the peer median of 2.7x EV/Rev and 11.6x EV/EBITDA — implies a NightOwl EV around $195M on 2026 forward metrics. The gap between those two numbers is the AI growth premium. As Magnus AI revenue grows, the multiple re-rates toward AI/SaaS peers.",
    "Revenue profitability in 2026: $5.7M net income on $48.4M net revenue. By 2029: $55.2M net income on $166.1M net revenue. The key driver of margin expansion is the shift from pure hardware (23% gross margin) to a blended hardware + SaaS/subscription model (53% gross margin projected). Every Magnus AI subscription added is pure software margin.",
  ],
  'Market Opportunity': [
    "The privacy-first, American-made security market is estimated at over $50 billion, growing at 25 to 40 percent annually. And they're not just competing in it — they're positioned to define the category. Chinese-made surveillance cameras are getting legislatively banned. Hikvision and Dahua are on federal ban lists. Nightowl fills that vacuum as the only scaled American-owned alternative with retail distribution.",
    "The commercial security TAM is $13.5 billion nationally. Target customers: law firms, medical practices, gun ranges/FFL retailers, manufacturers, contractors, retailers, gyms, car dealerships, home builders. Average commercial customer spends $2,000 to $25,000 on hardware/installation, plus $200 to $3,600 annually on software. Multi-site customers average $30,000 to $150,000 per year.",
    "50 to 75 million American adults prioritize privacy, sovereignty, and non-surveillance technology. 20 to 30 million households represent an $8B to $40B consumer TAM. These consumers are actively rejecting Chinese-made surveillance products and choosing premium, privacy-first alternatives. NightOwl is already the American-made brand — Magnus AI makes it the privacy-first platform.",
  ],
  'Investment Terms & Process': [
    "The minimum is $25,000 for 156,250 shares. Maximum per investor: $500,000. You can invest by check, wire transfer, ACH, credit card, or even a self-directed IRA. Regulation D Rule 506(c) — this offering is restricted to accredited investors only. The company reserves the right to waive the minimum at its discretion.",
    "Accredited investor means either a net worth over $1 million excluding your primary residence, or individual income over $200,000 in each of the last two years — or $300,000 joint with a spouse — with the same expectation this year. Once verified, the process is: sign the Investor Suitability Questionnaire, execute the Subscription Agreement, send payment.",
    "This is common equity — not a promissory note, not a debt instrument. You receive shares of NB Tech Acquisitions Corp., which convert 21-to-1 into NewCo shares upon the merger. Shares are restricted — no public market until the Nasdaq listing. The path to liquidity is the IPO. Hold period could be 6 months if the timeline holds, longer if there are delays.",
  ],
  'Risk & Objections': [
    "The honest risk profile: growth-stage, speculative investment. Operations started August 2021. The Nasdaq listing and merger are not guaranteed. The Nightowl $49M revenue is unaudited. Only accredited investors who can afford to lose their entire investment should be in. That's not a disclaimer — that's the reality of pre-IPO private placements.",
    "On the holding period question: if the September 2026 Nasdaq timeline holds, investors who get in now could have liquid shares within approximately 6 months. If the audit hits delays or the SEC takes more comment rounds, it could slip into Q1 or Q2 2027. This is not a short-term instrument — it's structured like a pre-IPO placement.",
    "The voting structure is worth understanding: Eric Liboiron holds a $400,000 convertible note that converts into 400 million Class B shares at 10 votes per share — that's 4 billion votes. New investors receive standard common stock at 1 vote per share. Investors will not control the company. This is standard founder-control structure, and it's disclosed in the PPM.",
  ],
  'Competitor Comparison': [
    "Security company comparable valuations: Arlo Technologies — $1.24B enterprise value at 2.4x EV/Rev. ADT — $14.28B at 2.8x EV/Rev. Alarm.com — $2.49B at 2.5x EV/Rev. Ubiquiti — $33.21B at 12.1x EV/Rev. At just the peer median of 2.7x on Nightowl's $64M 2026 revenue, that's a $173M enterprise value. At $110M 2027 revenue, that's $297M.",
    "The AI multiple expansion story: small-cap AI companies like SoundHound trade at 59x price-to-sales. BigBear.ai at 13x. Innodata at 13x. Even at a conservative 5x P/S as Magnus AI SaaS revenue grows, you're looking at dramatically higher valuations than the hardware peer group. The IPO at $7.00 would price the combined entity at roughly 2.7x 2026 revenue — in line with conservative comps.",
    "The Hikvision and Dahua federal ban created a $3-5 billion vacuum in the American security market — enterprise, government, and privacy-conscious consumer all rejecting Chinese-made hardware. Nightowl is the only scaled, American-owned security brand with major retail distribution. The timing of this merger with the privacy-first positioning is not coincidental.",
  ],
  'Price Scenarios & Returns': [
    "Base case scenario: NB Tech investor buys at $0.16, converts 21-to-1 to a $3.36 NewCo basis. Nasdaq lists at $7.00 target in September 2026 — that's 2.08x on the NewCo basis in roughly 6 months. If the stock stabilizes at $9.50 after 12 months of trading, that's 2.83x. By 18 months, with Magnus AI SaaS revenue visible, analyst targets point to $14.00, which is 4.17x the NewCo basis.",
    "Bull case: the Siebert raise gets oversubscribed and AI/security sector momentum carries the stock. Lists at $7.00, pops to $11.00 at open — 3.27x NewCo basis on day one. At 12 months with revenue guidance and subscription MRR becoming visible, $16.50 to $19.00 is achievable — 4.91x to 5.65x. The installer rollup announcement at 18 months could push to $22.00 or higher — 6.55x.",
    "Revenue explosion scenario: Costco national rollout alone can drive 500,000+ units annually. At 1 year post-IPO with $110M revenue run rate, comparable company multiples support a $24.00 stock — 7.14x NewCo basis. At 18 months with multi-site commercial contracts and recurring revenue exceeding hardware, $38.00 is the aggressive scenario — 11.31x. On a $25,000 investment, that's $282,720.",
  ],
};

// ── Report generator ──────────────────────────────────────────────────────────
function generateHTMLReport({ lead, transcript, qaLog, coachTips, intentResult, callStartTime, callEndTime, kbName, selectedKbName }) {
  const duration = callStartTime && callEndTime ? Math.round((callEndTime - callStartTime) / 1000) : 0;
  const mins = Math.floor(duration / 60); const secs = duration % 60;

  // Speaking time analysis (by word count — diarized speaker 0 = agent, speaker 1 = prospect)
  const speaker0 = transcript.filter(t => t.speaker === 0 || t.speaker === null || t.speaker === undefined);
  const speaker1 = transcript.filter(t => t.speaker === 1);
  const s0words = speaker0.reduce((a, t) => a + t.text.split(' ').length, 0);
  const s1words = speaker1.reduce((a, t) => a + t.text.split(' ').length, 0);
  const totalWords = (s0words + s1words) || 1;
  const agentPct = Math.round((s0words / totalWords) * 100);
  const prospectPct = 100 - agentPct;

  const intentScore = intentResult?.intentScore;
  const intentLabel = intentScore == null ? 'Not measured'
    : intentScore >= 75 ? '🟢 Strong Buying Intent'
    : intentScore >= 50 ? '🟡 Moderate Interest'
    : intentScore >= 25 ? '🟠 Low Interest' : '🔴 Resistant';

  const closeSignals = transcript.filter(t =>
    /minimum|send me|wire|sign up|how do i get|how much|what.s the next step|get involved|interested|where do i send|portal|ppm|deck/i.test(t.text)
  );

  const now = new Date();
  const dateStr = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const leadName = lead ? (lead.firstName ? `${lead.firstName} ${lead.lastName || ''}`.trim() : lead.name || 'Unknown') : 'Training Session';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>AI Assistant Call Report — ${leadName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,serif;background:#fff;color:#1a1a2e;padding:40px;font-size:13px;line-height:1.6}
h1{font-size:22px;color:#0a0f1e;margin-bottom:4px}
.sub{color:#b8933a;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
.date{color:#6b7280;font-size:11px;margin-bottom:28px}
.section{margin-bottom:24px}
.section-title{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8933a;border-bottom:2px solid #b8933a;padding-bottom:6px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.stat{background:#f8f9fa;border:1px solid #e5e7eb;border-radius:6px;padding:14px;text-align:center}
.stat-val{font-size:24px;font-weight:bold;color:#0a0f1e}
.stat-lbl{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
.box{background:#f8f9fa;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:12px}
.intent-bar{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;margin:10px 0}
.intent-fill{height:100%;background:linear-gradient(90deg,#ef4444,#f59e0b,#4ade80);border-radius:5px}
.qa-item{background:#f0fdf4;border:1px solid #86efac;border-left:4px solid #22c55e;border-radius:4px;padding:12px;margin-bottom:10px}
.qa-q{color:#166534;font-size:11px;font-weight:bold;margin-bottom:6px}
.qa-a{color:#374151;font-size:12px;line-height:1.6}
.coach-item{background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:4px;padding:10px;margin-bottom:8px;font-size:12px;color:#374151;line-height:1.5}
.close-item{background:#eff6ff;border:1px solid #93c5fd;border-radius:4px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:#1e40af}
.t-line{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #f3f4f6}
.t-spk{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;min-width:80px;flex-shrink:0}
.t-spk-0{color:#3b82f6}.t-spk-1{color:#b8933a}
.t-txt{font-size:12px;color:#374151;flex:1}
.t-time{font-size:10px;color:#9ca3af;min-width:64px;text-align:right;flex-shrink:0}
.bar-wrap{display:flex;gap:16px;align-items:center}
.bar{flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;display:flex}
.kpi-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}
.kpi-row div{padding:8px 12px;background:#f8f9fa;border:1px solid #e5e7eb;border-radius:4px;display:flex;justify-content:space-between}
.kpi-row strong{color:#0a0f1e}
footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:10px}
@media print{body{padding:20px}.grid{grid-template-columns:repeat(3,1fr)}}
</style>
</head>
<body>
<h1>AI Assistant — Call Report</h1>
<div class="sub">Live Intelligence System · Call Analysis</div>
<div class="date">${dateStr} · Lead: ${leadName}${kbName || selectedKbName ? ` · KB: ${kbName || selectedKbName}` : ''}</div>

<div class="section">
<div class="section-title">Call Analytics</div>
<div class="grid">
<div class="stat"><div class="stat-val">${mins}m ${secs}s</div><div class="stat-lbl">Duration</div></div>
<div class="stat"><div class="stat-val">${transcript.length}</div><div class="stat-lbl">Transcript Lines</div></div>
<div class="stat"><div class="stat-val">${closeSignals.length}</div><div class="stat-lbl">Close Signals</div></div>
<div class="stat"><div class="stat-val">${agentPct}%</div><div class="stat-lbl">Agent Speaking</div></div>
<div class="stat"><div class="stat-val">${prospectPct}%</div><div class="stat-lbl">Prospect Speaking</div></div>
<div class="stat"><div class="stat-val">${qaLog.length}</div><div class="stat-lbl">Q&A Answered</div></div>
</div>
<div class="box">
<div class="bar-wrap" style="margin-bottom:10px">
<span style="color:#3b82f6;font-size:11px;min-width:60px">Agent ${agentPct}%</span>
<div class="bar"><div style="width:${agentPct}%;background:#3b82f6"></div><div style="width:${prospectPct}%;background:#b8933a"></div></div>
<span style="color:#b8933a;font-size:11px;min-width:80px;text-align:right">Prospect ${prospectPct}%</span>
</div>
<div style="font-size:11px;color:#6b7280">${agentPct > 65 ? '⚠ Agent dominated the conversation. Aim for prospect talking 40-60% of the time.' : agentPct < 30 ? '⚠ Agent needs to take more control of the narrative.' : '✓ Good speaking time balance — prospect was engaged.'}</div>
</div>
</div>

<div class="section">
<div class="section-title">Intent Evaluation</div>
<div class="box">
<div style="font-size:16px;font-weight:bold;margin-bottom:8px">${intentLabel}</div>
${intentScore != null ? `<div class="intent-bar"><div class="intent-fill" style="width:${intentScore}%"></div></div><div style="font-size:12px;color:#6b7280">Score: ${intentScore}/100 — ${intentScore >= 75 ? 'Move to close immediately' : intentScore >= 50 ? 'Keep building rapport and address concerns' : 'Qualify further or set a callback'}</div>` : '<div style="font-size:12px;color:#6b7280">Intent tracking was not active during this call. Enable the Intent toggle in the AI Assistant before your next call for full analysis.</div>'}
</div>
${closeSignals.length > 0 ? `<div style="font-size:10px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Close Signals Detected (${closeSignals.length})</div>
${closeSignals.slice(0, 5).map(s => `<div class="close-item">🎯 "${s.text.slice(0, 120)}"<span style="float:right;color:#9ca3af">${new Date(s.time).toLocaleTimeString()}</span></div>`).join('')}` : '<div style="font-size:12px;color:#6b7280;padding:10px;background:#f8f9fa;border-radius:4px">No close signals detected. Focus on recognizing prospect buying signals: questions about minimums, next steps, process, or wire instructions.</div>'}
</div>

${qaLog.length > 0 ? `<div class="section">
<div class="section-title">Q&A Log — ${qaLog.length} Questions Handled</div>
${qaLog.map(item => `<div class="qa-item"><div class="qa-q">Q: ${item.question || item.q || ''}</div><div class="qa-a">A: ${item.answer || item.a || 'Not recorded'}</div></div>`).join('')}
</div>` : ''}

${coachTips.length > 0 ? `<div class="section">
<div class="section-title">Coach Tips — ${coachTips.length} Tips During Call</div>
${coachTips.map(t => `<div class="coach-item">💡 ${typeof t === 'string' ? t : t.text || t.tip || JSON.stringify(t)}</div>`).join('')}
</div>` : ''}

<div class="section">
<div class="section-title">Full Transcript — ${transcript.length} Lines</div>
${transcript.length === 0 ? '<div style="color:#9ca3af;font-size:12px;padding:20px;text-align:center">No transcript recorded. Ensure the AI Assistant is connected and the audio stream is active during the call.</div>' :
  transcript.map(t => `<div class="t-line">
<span class="t-spk ${t.speaker === 1 ? 't-spk-1' : 't-spk-0'}">${t.speaker === 1 ? '👤 Prospect' : t.speaker === 0 ? '🎙 Agent' : '🎙 Agent'}</span>
<span class="t-txt">${t.text}</span>
<span class="t-time">${new Date(t.time).toLocaleTimeString()}</span>
</div>`).join('')}
</div>

<footer>Generated by AI Live Assistant · ${dateStr} · ${leadName}${kbName ? ` · KB: ${kbName}` : ''}</footer>
</body>
</html>`;
}

function downloadReport(html, leadName) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CallReport_${(leadName || 'Session').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}


// ── Much broader question detection ──────────────────────────────────────────
const QUESTION_PATTERNS = [
  // Pattern 1: explicit question mark (broad)
  /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|describe|show me|walk me through|give me)\b.{4,120}\?/gi,
  // Pattern 2: common question openers WITHOUT ? (transcription often drops punctuation)
  /\b(what('?s| is| are| was| were| does| do| happens| would| will| are| can)|how (much|many|does|do|long|soon|often|would|can)|what.s the (minimum|return|catch|risk|difference|process|timeline|structure|deal|rate)|how do (i|you|we)|is (there|it|this) (a|any|an)|can (i|you|we)|what (are|is) the (minimum|return|risk|catch|process|fees|terms)|when (can|does|will|would)|who (is|are|runs|manages|owns)|tell me (about|more|how)|walk me through|what happens (if|when))\b.{4,100}/gi,
];

const TOPIC_FRAGMENTS = [
  /\b(minimum|invest(ment|ing)?|return|ROI|interest rate|conversion|uplisting?|nasdaq|discount|share price|revenue|margin|EBITDA|valuation|enterprise value|cap table|capital structure|use of proceeds|timeline|roadmap|team|founder|CEO|CTO|attorney|broker|auditor|accredited|Reg D|506c|risk|exit|liquidity|lock.?up|nightowl|magnus|AI platform|commercial market|TAM|addressable market|comparable|comps|patent|drone|product|camera|NVR|recorder|doorbell)\b/gi,
];

function extractQuestions(text) {
  const found = new Set();
  for (const pattern of QUESTION_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => { const q = m[0].trim(); if (q.length > 8 && q.length < 200) found.add(q); });
  }
  return [...found];
}

function hasTopicFragment(text) {
  return TOPIC_FRAGMENTS.some(p => { p.lastIndex = 0; return p.test(text); });
}

function Dot({ active, color, size = 6 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: active ? color : '#4a5568', boxShadow: active ? `0 0 6px ${color}` : 'none', animation: active ? 'aipulse 2s ease-in-out infinite' : 'none' }} />;
}

function SectionHeader({ label, color, active, onToggle, collapsed, onCollapse }) {
  return (
    <div onClick={onCollapse} style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.3)', borderBottom: `1px solid ${active ? color + '33' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}>
      <Dot active={active} color={color} />
      <span style={{ color: active ? color : '#6b7280', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>{label}</span>
      <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{ background: active ? `${color}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? color + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: '20px', color: active ? color : '#4a5568', padding: '2px 9px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>{active ? 'ON' : 'OFF'}</button>
      <span style={{ color: '#4a5568', fontSize: '11px' }}>{collapsed ? '▸' : '▾'}</span>
    </div>
  );
}

function DragHandle({ onDragStart }) {
  return (
    <div onMouseDown={onDragStart} style={{ height: 5, background: 'rgba(255,255,255,0.04)', cursor: 'row-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
      <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
    </div>
  );
}

function Btn({ onClick, disabled, children, color = '#8a9ab8', bg = 'rgba(255,255,255,0.05)', border = 'rgba(255,255,255,0.1)', style: s = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', padding: '3px 10px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap', ...s }}>{children}</button>;
}

// ── Q&A Section ───────────────────────────────────────────────────────────────
function QASection({ transcript, transcriptRef, kbEntries, active, qaKeywords, manualQ, setManualQ, collapsed, qaOnly }) {
  const [questions, setQuestions] = useState([]);
  const [asking,    setAsking]    = useState(false);
  const [addInfoId, setAddInfoId] = useState(null);
  const [splitPct,  setSplitPct]  = useState(50);
  const [talkingPointsId, setTalkingPointsId] = useState(null);
  const [researchId,      setResearchId]      = useState(null);

  const seenQ         = useRef(new Set());
  const lastAutoRef   = useRef(0);
  const qListRef      = useRef(null);
  const aListRef      = useRef(null);
  const containerRef  = useRef(null);
  const splitDragging = useRef(false);

  // Clear dedup cache whenever Q&A is re-enabled so existing transcript gets re-scanned
  useEffect(() => {
    if (active) {
      seenQ.current.clear();
    }
  }, [active]);

  const buildKeywordRegex = useCallback(() => {
    if (!qaKeywords?.trim()) return null;
    const terms = qaKeywords.split(',').map(k => k.trim()).filter(Boolean);
    if (!terms.length) return null;
    const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
  }, [qaKeywords]);

  // Track auto-dismiss timers: id -> setTimeout handle
  const autoDismissTimers = useRef({});

  const scheduleAutoDismiss = (id) => {
    // Auto-clear unanswered detected questions after 30 seconds
    autoDismissTimers.current[id] = setTimeout(() => {
      setQuestions(prev => prev.filter(x => x.id !== id || x.answered || x.answering || x.manual));
      delete autoDismissTimers.current[id];
    }, 30000);
  };

  const cancelAutoDismiss = (id) => {
    if (autoDismissTimers.current[id]) {
      clearTimeout(autoDismissTimers.current[id]);
      delete autoDismissTimers.current[id];
    }
  };

  // Clear all timers on unmount
  useEffect(() => () => {
    Object.values(autoDismissTimers.current).forEach(t => clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!transcript.length) return;
    const last = transcript[transcript.length - 1];
    if (!last?.text) return;

    // ── Process ALL speakers for Q&A detection ──
    // Both the prospect AND agent speech can contain questions or topic fragments
    // that need answering. Removing the speaker filter ensures nothing is missed.
    // (Diarization assigns speaker numbers inconsistently across calls anyway.)

    const detected = extractQuestions(last.text);
    detected.forEach(q => {
      if (!seenQ.current.has(q)) {
        seenQ.current.add(q);
        const id = Date.now() + Math.random();
        setQuestions(prev => [...prev, { id, text: q, time: new Date(), answer: '', answering: false, answered: false, auto: false, manual: false }]);
        // Extended dismiss window — 30s so user has time to see and act on the question
        scheduleAutoDismiss(id);
      }
    });

    const now = Date.now();
    if (active && now - lastAutoRef.current > 2500) {
      const kwRegex = buildKeywordRegex();
      const hit = (kwRegex && kwRegex.test(last.text)) || hasTopicFragment(last.text);
      if (hit && detected.length === 0) {
        lastAutoRef.current = now;
        const autoId = Date.now() + Math.random();
        const autoQ  = last.text.trim().slice(0, 150);
        if (!seenQ.current.has(autoQ)) {
          seenQ.current.add(autoQ);
          setQuestions(prev => [...prev, { id: autoId, text: autoQ, time: new Date(), answer: '', answering: true, answered: false, auto: true, manual: false }]);
          // Auto answers fire immediately — no dismiss timer needed
          base44.functions.invoke('liveAssistantAI', { question: autoQ, transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'qa' })
            .then(res => {
              const answer = res?.data?.answer || 'No matching information found.';
              setQuestions(prev => prev.map(x => x.id === autoId ? { ...x, answering: false, answered: true, answer, source: res?.data?.source } : x));
            })
            .catch(e => setQuestions(prev => prev.map(x => x.id === autoId ? { ...x, answering: false, answer: `Error: ${e.message}` } : x)));
        }
      }
    }
  }, [transcript, active, buildKeywordRegex]);

  useEffect(() => { if (qListRef.current) qListRef.current.scrollTop = qListRef.current.scrollHeight; }, [questions]);

  useEffect(() => {
    const onMove = (e) => {
      if (!splitDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSplitPct(Math.max(15, Math.min(85, Math.round(((e.clientY - rect.top) / rect.height) * 100))));
    };
    const onUp = () => { splitDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const answerQ = async (id) => {
    const q = questions.find(x => x.id === id);
    if (!q || q.answering) return;
    cancelAutoDismiss(id); // user clicked Answer — keep it
    setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: true } : x));
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { question: q.text, transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'qa' });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answered: true, answer: res?.data?.answer || 'No matching information found.' } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answer: `Error: ${e.message}` } : x));
    }
  };

  const getMoreInfo = async (id) => {
    const q = questions.find(x => x.id === id);
    if (!q || !q.answered) return;
    setAddInfoId(id);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { question: `Give me more detailed information about: ${q.text}`, transcript: transcriptRef.current.slice(-12), kbEntries, previousAnswer: q.answer, mode: 'qa_expand' });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answer: x.answer + '\n\n— Additional Detail —\n' + (res?.data?.answer || 'No additional information found.') } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answer: x.answer + `\n\nError: ${e.message}` } : x));
    }
    setAddInfoId(null);
  };

  const getTalkingPoints = async (id) => {
    const q = questions.find(x => x.id === id);
    if (!q || !q.answered) return;
    setTalkingPointsId(id);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        question: `Generate 4-6 punchy talking points a sales rep should say out loud RIGHT NOW to address: "${q.text}". Each point should be 1-2 sentences, persuasive, and ready to speak. Format as a numbered list.`,
        transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'talking_points',
      });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, talkingPoints: res?.data?.answer || 'No talking points generated.' } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, talkingPoints: `Error: ${e.message}` } : x));
    }
    setTalkingPointsId(null);
  };

  const getInternetResearch = async (id) => {
    const q = questions.find(x => x.id === id);
    if (!q || !q.answered) return;
    setResearchId(id);
    try {
      const res = await base44.functions.invoke('liveAssistantResearch', {
        name: q.text,
        email: '',
        phone: '',
        location: '',
        notes: `Research context for investor Q&A: ${q.text}. Answer: ${q.answer}`,
      });
      const data = res?.data;
      const summary = data?.summary || data?.report || data?.answer || JSON.stringify(data || 'No research found.');
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, research: summary } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, research: `Research error: ${e.message}` } : x));
    }
    setResearchId(null);
  };

  const askManual = async () => {
    if (!manualQ.trim() || asking) return;
    const q = manualQ.trim(); setManualQ(''); setAsking(true);
    const id = Date.now() + Math.random();
    setQuestions(prev => [...prev, { id, text: q, time: new Date(), answer: '', answering: true, answered: false, auto: false, manual: true }]);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { question: q, transcript: transcriptRef.current.slice(-12), kbEntries, mode: 'qa' });
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answered: true, answer: res?.data?.answer || 'No matching information found.' } : x));
    } catch (e) {
      setQuestions(prev => prev.map(x => x.id === id ? { ...x, answering: false, answer: `Error: ${e.message}` } : x));
    }
    setAsking(false);
  };

  const dismissQ = (id) => setQuestions(prev => prev.filter(x => x.id !== id));

  const answered   = questions.filter(q => q.answered || q.answering);
  const unanswered = questions.filter(q => !q.answered && !q.answering);

  const AskBar = () => (
    <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '6px', flexShrink: 0 }}>
      <input value={manualQ} onChange={e => setManualQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') askManual(); }} placeholder="Ask anything about this deal…"
        style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' }} />
      <Btn onClick={askManual} disabled={!manualQ.trim() || asking} bg={manualQ.trim() && !asking ? 'linear-gradient(135deg,#b8933a,#d4aa50)' : undefined} color={manualQ.trim() && !asking ? '#0a0f1e' : undefined} s={{ padding: '6px 14px', fontSize: '11px' }}>{asking ? '⏳' : 'Ask →'}</Btn>
    </div>
  );

  const QuestionCard = ({ q, compact = false }) => (
    <div key={q.id} style={{ background: q.manual ? 'rgba(184,147,58,0.04)' : q.auto ? 'rgba(96,165,250,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${q.answered ? 'rgba(74,222,128,0.2)' : q.auto ? 'rgba(96,165,250,0.18)' : q.manual ? 'rgba(184,147,58,0.2)' : 'rgba(245,158,11,0.18)'}`, borderRadius: '5px', overflow: 'hidden' }}>
      <div style={{ padding: compact ? '5px 10px' : '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: (!compact && (q.answered || q.answering)) ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {q.manual && <span style={{ fontSize: '8px', background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '3px', padding: '1px 5px' }}>MANUAL</span>}
          {q.auto   && <span style={{ fontSize: '8px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '3px', padding: '1px 5px' }}>AUTO</span>}
          {!q.manual && !q.auto && <span style={{ fontSize: '8px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '3px', padding: '1px 5px' }}>DETECTED</span>}
        </div>
        <div style={{ flex: 1, color: q.answered ? '#8a9ab8' : '#e8e0d0', fontSize: '12px', lineHeight: 1.4 }}>{q.text}</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          {!q.answered && !q.answering && <Btn onClick={() => answerQ(q.id)} color="#f59e0b" bg="rgba(245,158,11,0.15)" border="rgba(245,158,11,0.35)">Answer</Btn>}
          {q.answering && <span style={{ color: '#60a5fa', fontSize: '12px' }}>⏳</span>}
          {q.answered  && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓</span>}
          <button onClick={() => dismissQ(q.id)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      </div>
      {!compact && (q.answered || q.answering) && (
        <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.15)' }}>
          {q.answering
            ? <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, animation: 'aipulse 0.8s infinite' }} />Searching knowledge base…</div>
            : <div>
                <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: '6px' }}>💡 {q.answer}</div>
                <Btn onClick={() => getMoreInfo(q.id)} disabled={addInfoId === q.id} color="#60a5fa" bg="rgba(96,165,250,0.08)" border="rgba(96,165,250,0.2)" s={{ fontSize: '9px', padding: '2px 8px' }}>{addInfoId === q.id ? '⏳ Loading…' : '+ Additional Information'}</Btn>
              </div>
          }
        </div>
      )}
    </div>
  );

  if (collapsed) return null;

  // ── Q&A ONLY MODE ─────────────────────────────────────────────────────────
  if (qaOnly) {
    return (
      <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <AskBar />

        {/* Questions pane */}
        <div style={{ height: `${splitPct}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 40 }}>
          <div style={{ padding: '5px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>❓ Questions ({questions.length})</span>
            {questions.length > 0 && <Btn onClick={() => { setQuestions([]); seenQ.current.clear(); }} color="#ef4444" s={{ padding: '2px 8px', fontSize: '9px' }}>Clear All</Btn>}
          </div>
          <div ref={qListRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {questions.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px' }}>{active ? '🎙 Listening for questions — or type one above' : 'Enable Q&A and start audio stream'}</div>}
            {questions.map(q => <QuestionCard key={q.id} q={q} compact={true} />)}
          </div>
        </div>

        {/* Draggable split divider */}
        <div onMouseDown={e => { splitDragging.current = true; e.preventDefault(); }}
          style={{ height: 6, background: 'rgba(245,158,11,0.08)', cursor: 'row-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid rgba(245,158,11,0.15)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}>
          <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(245,158,11,0.3)' }} />
        </div>

        {/* Answers pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 40 }}>
          <div style={{ padding: '5px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ color: '#4ade80', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>💡 Answers ({answered.length})</span>
            {answered.length > 0 && <Btn onClick={() => setQuestions(prev => prev.filter(q => !q.answered && !q.answering))} color="#ef4444" s={{ padding: '2px 8px', fontSize: '9px' }}>Clear Answers</Btn>}
          </div>
          <div ref={aListRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {answered.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px' }}>Answers appear here when questions are answered</div>}
            {answered.map(q => (
              <div key={q.id} style={{ background: 'rgba(74,222,128,0.03)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ padding: '5px 10px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f59e0b', fontSize: '10px', flex: 1, fontStyle: 'italic' }}>Re: "{q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}"</span>
                  {q.answered && !q.answering && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <Btn onClick={() => getMoreInfo(q.id)} disabled={addInfoId === q.id} color="#60a5fa" bg="rgba(96,165,250,0.1)" border="rgba(96,165,250,0.25)" s={{ padding: '2px 8px', fontSize: '9px' }}>{addInfoId === q.id ? '⏳ More…' : '+ More Info'}</Btn>
                      <Btn onClick={() => getTalkingPoints(q.id)} disabled={talkingPointsId === q.id} color="#4ade80" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.25)" s={{ padding: '2px 8px', fontSize: '9px' }}>{talkingPointsId === q.id ? '⏳ Points…' : '💬 Talking Points'}</Btn>
                      <Btn onClick={() => getInternetResearch(q.id)} disabled={researchId === q.id} color="#a78bfa" bg="rgba(167,139,250,0.1)" border="rgba(167,139,250,0.25)" s={{ padding: '2px 8px', fontSize: '9px' }}>{researchId === q.id ? '⏳ Searching…' : '🔍 Internet Research'}</Btn>
                    </div>
                  )}
                  <button onClick={() => setQuestions(prev => prev.filter(x => x.id !== q.id))} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {q.answering
                    ? <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, animation: 'aipulse 0.8s infinite' }} />Searching knowledge base…</div>
                    : <div>
                        <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{q.answer}</div>
                        {q.talkingPoints && (
                          <div style={{ marginTop: '10px', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '4px', padding: '8px 12px' }}>
                            <div style={{ color: '#4ade80', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>💬 Talking Points</div>
                            <div style={{ color: '#c4e8c8', fontSize: '12px', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{q.talkingPoints}</div>
                          </div>
                        )}
                        {q.research && (
                          <div style={{ marginTop: '8px', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '8px 12px' }}>
                            <div style={{ color: '#a78bfa', fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>🔍 Internet Research</div>
                            <div style={{ color: '#c4b8f0', fontSize: '12px', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{typeof q.research === 'string' ? q.research : JSON.stringify(q.research, null, 2)}</div>
                          </div>
                        )}
                      </div>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── NORMAL STACKED MODE ───────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <AskBar />
      <div ref={qListRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {questions.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px' }}>{active ? '🎙 Listening — questions auto-detected or type one above' : 'Enable Q&A and start the audio stream'}</div>}
        {questions.map(q => <QuestionCard key={q.id} q={q} compact={false} />)}
      </div>
    </div>
  );
}

// ── Coach Section ─────────────────────────────────────────────────────────────
function CoachSection({ transcript, kbEntries, coachRules, active, collapsed }) {
  const [tips, setTips] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const lastFired = useRef(0);
  const listRef   = useRef(null);

  useEffect(() => {
    if (!active || !transcript.length || collapsed) return;
    const now = Date.now();
    if (now - lastFired.current < 4000) return;
    lastFired.current = now;
    if (streaming) return;
    setStreaming(true);
    const tipId = Date.now();
    setTips(prev => [...prev, { id: tipId, text: '', streaming: true, time: new Date() }]);
    base44.functions.invoke('liveAssistantAI', { transcript: transcript.slice(-15), kbEntries, mode: 'coach_stream', coachRules })
      .then(res => setTips(prev => prev.map(t => t.id === tipId ? { ...t, text: res?.data?.answer || '', streaming: false } : t)))
      .catch(e => setTips(prev => prev.map(t => t.id === tipId ? { ...t, text: `Error: ${e.message}`, streaming: false } : t)))
      .finally(() => { setStreaming(false); setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 100); });
  }, [transcript, active, collapsed]);

  if (collapsed) return null;
  return (
    <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
      {tips.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>{active ? 'Listening — tips fire automatically…' : 'Enable Coach to receive live tips'}</div>}
      {[...tips].reverse().map((tip, i) => (
        <div key={tip.id} style={{ background: i === 0 ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ color: '#4a5568', fontSize: '8px', marginBottom: '5px' }}>{tip.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          {tip.streaming ? <div style={{ color: '#6b7280', fontSize: '11px', display: 'flex', gap: 6, alignItems: 'center' }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', animation: 'aipulse 0.8s infinite' }} />Thinking…</div> : <div style={{ color: i === 0 ? '#e8e0d0' : '#8a9ab8', fontSize: '12px', lineHeight: 1.7 }}>{tip.text}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Intent Section ────────────────────────────────────────────────────────────
function IntentSection({ transcript, active, collapsed }) {
  const [segments, setSegments] = useState([]);
  const listRef = useRef(null);
  useEffect(() => {
    if (!transcript.length || collapsed) return;
    const last = transcript[transcript.length - 1];
    if (last.sentiment) setSegments(prev => [...prev.slice(-80), { text: last.text, sentiment: last.sentiment, time: new Date() }]);
  }, [transcript, collapsed]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [segments]);
  const sentColor = { positive: '#4ade80', negative: '#ef4444', neutral: '#8a9ab8' };
  const posCount = segments.filter(s => s.sentiment === 'positive').length;
  const negCount = segments.filter(s => s.sentiment === 'negative').length;
  const neuCount = segments.filter(s => s.sentiment === 'neutral').length;
  const total = segments.length || 1;
  if (collapsed) return null;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {segments.length === 0 ? <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px' }}>{active ? 'Waiting for sentiment data…' : 'Enable Intent to track live sentiment'}</div> : (
        <>
          <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
            {[['😊','Positive',posCount,'#4ade80'],['😟','Negative',negCount,'#ef4444'],['😐','Neutral',neuCount,'#8a9ab8']].map(([icon,label,count,color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ fontSize: '13px' }}>{icon}</span><div><div style={{ color, fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1 }}>{count}</div><div style={{ color: '#4a5568', fontSize: '8px' }}>{Math.round((count/total)*100)}% {label}</div></div></div>
            ))}
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(posCount/total)*100}%`, background: '#4ade80', transition: 'width 0.4s' }} />
              <div style={{ width: `${(neuCount/total)*100}%`, background: '#8a9ab8', transition: 'width 0.4s' }} />
              <div style={{ width: `${(negCount/total)*100}%`, background: '#ef4444', transition: 'width 0.4s' }} />
            </div>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[...segments].reverse().slice(0,40).map((s,i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: sentColor[s.sentiment]||'#4a5568', flexShrink: 0, marginTop: 4 }} />
                <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0, minWidth: '56px' }}>{s.time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}</span>
                <span style={{ color: sentColor[s.sentiment], fontSize: '9px', flexShrink: 0, minWidth: '48px', textTransform: 'uppercase', fontWeight: 'bold' }}>{s.sentiment}</span>
                <span style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.4 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAssistantPopup({
  lead, transcript, transcriptRef, kbEntries, portalCfg, engagementScore,
  qaActive, coachActive, intentActive,
  onToggleQA, onToggleCoach, onToggleIntent,
  onClose, onIntentResult,
  allKbEntries, kbNames, selectedKbName, onKbChange,
  activeScript, scripts,
}) {
  const [pos,    setPos]    = useState({ x: 20, y: Math.max(20, window.innerHeight - 540) });
  const [showScript, setShowScript] = useState(false);
  const [width,  setWidth]  = useState(Math.min(860, window.innerWidth - 40));
  const [height, setHeight] = useState(520);
  const [qaH,    setQaH]    = useState(42);
  const [coachH, setCoachH] = useState(33);
  const [qaCollapsed,     setQaCollapsed]     = useState(false);
  const [coachCollapsed,  setCoachCollapsed]  = useState(false);
  const [intentCollapsed, setIntentCollapsed] = useState(false);
  const [qaOnly,  setQaOnly]  = useState(false);
  const [manualQ, setManualQ] = useState('');

  const draggingPanel = useRef(false);
  const dragStart     = useRef({ mx:0,my:0,px:0,py:0 });
  const resizingTop   = useRef(false);
  const resizeTopY    = useRef(0); const resizeTopH = useRef(0); const resizeTopPY = useRef(0);
  const resizingDiv   = useRef(null);
  const divStartY     = useRef(0); const divStartH = useRef(0);

  useEffect(() => {
    const onMove = (e) => {
      if (draggingPanel.current) setPos({ x: Math.max(0,Math.min(window.innerWidth-width, dragStart.current.px+e.clientX-dragStart.current.mx)), y: Math.max(0,Math.min(window.innerHeight-height, dragStart.current.py+e.clientY-dragStart.current.my)) });
      if (resizingTop.current) { const dy=resizeTopY.current-e.clientY; const newH=Math.max(200,Math.min(window.innerHeight*0.92,resizeTopH.current+dy)); setHeight(newH); setPos(p=>({...p,y:Math.max(0,resizeTopPY.current-(newH-resizeTopH.current))})); }
      if (resizingDiv.current) { const dy=e.clientY-divStartY.current; const pct=(dy/(height-56))*100; if(resizingDiv.current==='qa-coach') setQaH(prev=>Math.max(10,Math.min(78,divStartH.current+pct))); else setCoachH(prev=>Math.max(10,Math.min(78,divStartH.current+pct))); }
    };
    const onUp = () => { draggingPanel.current=false; resizingTop.current=false; resizingDiv.current=null; };
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
    return () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
  }, [width, height]);

  return (
    <div style={{ position:'fixed', left:pos.x, top:pos.y, width, height, background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.4)', borderRadius:'8px', boxShadow:'0 12px 60px rgba(0,0,0,0.9)', zIndex:20000, display:'flex', flexDirection:'column', fontFamily:'Georgia, serif', overflow:'hidden' }}>
      <style>{`@keyframes aipulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* Top resize handle */}
      <div onMouseDown={e=>{resizingTop.current=true;resizeTopY.current=e.clientY;resizeTopH.current=height;resizeTopPY.current=pos.y;e.preventDefault();}} style={{height:5,background:'rgba(255,255,255,0.03)',cursor:'n-resize',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(184,147,58,0.2)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
        <div style={{width:48,height:3,borderRadius:2,background:'rgba(255,255,255,0.12)'}} />
      </div>

      {/* Title bar */}
      <div onMouseDown={e=>{if(e.target.closest('button,select,input'))return;draggingPanel.current=true;dragStart.current={mx:e.clientX,my:e.clientY,px:pos.x,py:pos.y};e.preventDefault();}} style={{padding:'6px 14px',background:'rgba(0,0,0,0.35)',borderBottom:'1px solid rgba(184,147,58,0.2)',display:'flex',alignItems:'center',gap:'10px',flexShrink:0,cursor:'grab',userSelect:'none'}}>
        <span style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',flexShrink:0}}>🧠 AI Assistant</span>

        {kbNames&&kbNames.length>0&&(
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <span style={{color:'#4a5568',fontSize:'9px',textTransform:'uppercase',letterSpacing:'1px'}}>📚</span>
            <select value={selectedKbName||''} onChange={e=>onKbChange?.(e.target.value)} style={{background:'rgba(184,147,58,0.1)',border:'1px solid rgba(184,147,58,0.35)',borderRadius:'4px',padding:'2px 8px',color:'#b8933a',fontSize:'10px',outline:'none',cursor:'pointer',maxWidth:'200px'}}>
              <option value="">Default KB ({(allKbEntries||kbEntries).filter(e=>!e.kbName||e.kbName==='').length})</option>
              {(kbNames||[]).map(n=><option key={n} value={n}>{n} ({(allKbEntries||[]).filter(e=>e.kbName===n).length})</option>)}
            </select>
          </div>
        )}

        <div style={{flex:1}} />

        <button onClick={()=>setQaOnly(p=>!p)} style={{background:qaOnly?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.05)',color:qaOnly?'#f59e0b':'#6b7280',border:`1px solid ${qaOnly?'rgba(245,158,11,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:'4px',padding:'3px 10px',cursor:'pointer',fontSize:'10px',fontWeight:'bold'}}>
          {qaOnly?'❓ Q&A Only ✓':'❓ Q&A Only'}
        </button>

        {(scripts?.length > 0 || activeScript) && (
          <button onClick={()=>setShowScript(p=>!p)} style={{background:showScript?'rgba(96,165,250,0.2)':'rgba(255,255,255,0.05)',color:showScript?'#60a5fa':'#6b7280',border:`1px solid ${showScript?'rgba(96,165,250,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:'4px',padding:'3px 10px',cursor:'pointer',fontSize:'10px',fontWeight:'bold'}}>
            📋 Script{showScript?' ✓':''}
          </button>
        )}

        <span style={{color:'#4a5568',fontSize:'9px'}}>⠿ drag · resize top</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:'18px',lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
      </div>

      {/* Script Panel */}
      {showScript && activeScript && (
        <div style={{borderBottom:'1px solid rgba(96,165,250,0.25)',background:'rgba(96,165,250,0.04)',maxHeight:'220px',overflow:'hidden',display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'5px 14px',background:'rgba(0,0,0,0.2)',borderBottom:'1px solid rgba(96,165,250,0.15)',display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
            <span style={{color:'#60a5fa',fontSize:'9px',fontWeight:'bold',letterSpacing:'1px',textTransform:'uppercase',flex:1}}>📋 Script — {activeScript.name||activeScript.title||'Active Script'}</span>
            <button onClick={()=>setShowScript(false)} style={{background:'none',border:'none',color:'#4a5568',cursor:'pointer',fontSize:'13px',lineHeight:1}}>×</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'10px 14px',color:'#c4cdd8',fontSize:'12px',lineHeight:1.75,whiteSpace:'pre-wrap',fontFamily:'Georgia,serif'}}>
            {activeScript.content||'No content in this script.'}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {qaOnly&&(
          <>
            <SectionHeader label="❓ Q&A" color="#f59e0b" active={qaActive} onToggle={onToggleQA} collapsed={false} onCollapse={()=>{}} />
            <QASection transcript={transcript} transcriptRef={transcriptRef} kbEntries={kbEntries} active={qaActive} qaKeywords={portalCfg?.intentTriggerKeywords} manualQ={manualQ} setManualQ={setManualQ} collapsed={false} qaOnly={true} />
          </>
        )}

        {!qaOnly&&(
          <>
            <div style={{display:'flex',flexDirection:'column',overflow:'hidden',flex:qaCollapsed?'0 0 auto':qaH,minHeight:qaCollapsed?0:80}}>
              <SectionHeader label="❓ Q&A" color="#f59e0b" active={qaActive} onToggle={onToggleQA} collapsed={qaCollapsed} onCollapse={()=>setQaCollapsed(p=>!p)} />
              <QASection transcript={transcript} transcriptRef={transcriptRef} kbEntries={kbEntries} active={qaActive} qaKeywords={portalCfg?.intentTriggerKeywords} manualQ={manualQ} setManualQ={setManualQ} collapsed={qaCollapsed} qaOnly={false} />
            </div>

            {!qaCollapsed&&!coachCollapsed&&<DragHandle onDragStart={e=>{resizingDiv.current='qa-coach';divStartY.current=e.clientY;divStartH.current=qaH;e.preventDefault();}} />}

            <div style={{display:'flex',flexDirection:'column',overflow:'hidden',flex:coachCollapsed?'0 0 auto':coachH,minHeight:coachCollapsed?0:60}}>
              <SectionHeader label="🎯 Coach" color="#a78bfa" active={coachActive} onToggle={onToggleCoach} collapsed={coachCollapsed} onCollapse={()=>setCoachCollapsed(p=>!p)} />
              <CoachSection transcript={transcript} kbEntries={kbEntries} coachRules={{focusAreas:portalCfg?.coachFocusAreas,style:portalCfg?.coachStyle,additionalContext:portalCfg?.coachAdditionalContext}} active={coachActive} collapsed={coachCollapsed} />
            </div>

            {!coachCollapsed&&!intentCollapsed&&<DragHandle onDragStart={e=>{resizingDiv.current='coach-intent';divStartY.current=e.clientY;divStartH.current=coachH;e.preventDefault();}} />}

            <div style={{display:'flex',flexDirection:'column',overflow:'hidden',flex:intentCollapsed?'0 0 auto':Math.max(10,100-qaH-coachH),minHeight:intentCollapsed?0:60}}>
              <SectionHeader label="🦆 Intent" color="#60a5fa" active={intentActive} onToggle={onToggleIntent} collapsed={intentCollapsed} onCollapse={()=>setIntentCollapsed(p=>!p)} />
              <IntentSection transcript={transcript} active={intentActive} collapsed={intentCollapsed} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}