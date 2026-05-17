/**
 * NBTechKBImporter.jsx
 * Drop this into src/components/admin/ and render it anywhere in your admin panel.
 * It bulk-creates all NB Tech KB entries into base44 KnowledgeBase entity.
 * After running, delete or hide this component.
 */

import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const BLUE = '#4f9cf9';
const DARK = '#0a0f1e';

const NB_TECH_KB_ENTRIES = [
  {
    category: "nbtech_kb",
    question: "What is the current offering — price per share, total raise, and share structure?",
    answer: "NB Tech Acquisitions Corp. is offering common stock at $0.16 per share under Regulation D Rule 506(c). The maximum offering is $10,000,000 (62,500,000 shares) and the minimum offering is $100,000 (625,000 shares). The minimum individual investment is $25,000 (156,250 shares) and the maximum per investor is $500,000 (3,125,000 shares). There are currently 18,257,000 shares issued and outstanding, with 1,000,000,000 authorized. Upon maximum placement, 80,757,500 total shares will be outstanding. This is a best-efforts, non-underwritten equity offering — NOT a promissory note. Investors receive common equity shares of NB Tech Acquisitions Corp., a Nevada corporation."
  },
  {
    category: "nbtech_kb",
    question: "What is the 21:1 share conversion and how does it relate to the Nightowl merger / NewCo IPO?",
    answer: "NB Tech is acquiring Nightowl SP, LLC and merging both companies into a newly formed Nevada corporation called 'NewCo' (NGMC), with the goal of listing on the Nasdaq Capital Market. The proposed share conversion ratio is 21:1 — every 21 shares of NB Tech common stock converts into 1 share of NewCo. At $0.16/share, this implies an equivalent NewCo cost basis of approximately $3.36 per NewCo share (21 × $0.16). The indicative Nasdaq IPO target price for NewCo is $7.00 per share — implying a potential 2x+ return on the NewCo basis for current NB Tech investors. This conversion is subject to completion of the acquisition, regulatory approval, and S-1 effectiveness. There is no guarantee the merger or listing will occur at any specific price or at all."
  },
  {
    category: "nbtech_kb",
    question: "What is the Nasdaq listing strategy and full timeline?",
    answer: "NB Tech and Nightowl are merging into NewCo (NGMC) to list on Nasdaq Capital Market. Roadmap: Weeks 1–2 (Early March 2026) — finalize Nightowl acquisition, appoint PCAOB auditors and securities counsel; Weeks 1–6 (March–Mid April) — fast-track PCAOB audit, begin S-1 drafting concurrently; Weeks 6–12 (Mid April–June) — file S-1 by late May/early June, launch institutional broker-dealer raise in parallel during SEC review; Weeks 12–18 (June–August) — SEC comment cycles (1–2 rounds targeted), submit Nasdaq listing application mid-summer; Weeks 18–22 (Late August) — submit FINRA ticker symbol, S-1 declared effective; September 2026 — stock begins trading on Nasdaq. Goal: Nasdaq trading live by September 2026. Lead Broker-Dealer: Siebert Williams Shank & Co., LLC (LOI signed March 16, 2026 — minimum raise $15M, target up to $100M). PCAOB Auditor: Astra Audit & Advisory. SEC Attorney: TroyGould Attorneys. IR/PR Firm: MicroCap Advisory."
  },
  {
    category: "nbtech_kb",
    question: "What is the Siebert Williams Shank Letter of Intent and why does it matter?",
    answer: "Siebert Williams Shank & Co., LLC — a registered FINRA/NYSE broker-dealer established in 1967 with approximately 150 employees, ~$80M in annual revenue, and ~$18B in client assets — signed a non-binding Letter of Intent (LOI) dated March 16, 2026, to act as exclusive financial advisor, placement agent, and underwriter for NewCo's Nasdaq IPO. The LOI contemplates a minimum raise of $15 million and a target raise of up to $100 million in connection with the IPO. The LOI is non-binding and subject to due diligence, regulatory approvals, and definitive agreements. This represents real, institutional-grade validation of the Nasdaq pathway — Siebert is an established broker-dealer, not a startup or unregistered firm."
  },
  {
    category: "nbtech_kb",
    question: "What is Nightowl and what does it bring to the combined company?",
    answer: "Nightowl SP, LLC is a 20+ year old, American-owned consumer security and surveillance brand. Key metrics: ~$49 million in annual revenue (unaudited), 40% gross margin, 300+ active SKUs/platforms, 45 employees and contractors, 7-person executive team, in-house engineering and system architecture, vertically integrated sourcing and fulfillment, patents and IP. Retail distribution through: Best Buy, Walmart, Amazon, and Home Depot. Nightowl currently needs: cloud migration, AI features, modernized mobile app, data privacy controls, and a recurring revenue ecosystem. NB Tech's Magnus AI platform delivers all of these. Ron Ferris (Nightowl founder) will remain as Chief Revenue Officer with equity in NewCo post-acquisition."
  },
  {
    category: "nbtech_kb",
    question: "What is Magnus AI and what does NB Tech bring to the merger?",
    answer: "Magnus AI is NB Tech's full cloud and software platform — already funded and built. Capabilities include AI architecture, model training and deployment, enterprise-grade cloud infrastructure, and scalable SaaS and data platforms. Post-merger, Magnus AI delivers to Nightowl: cloud migration, AI-powered smart detection and alerts (identifies humans, vehicles, real threats — eliminates false alarms), privacy dashboards with granular user controls, subscription-based storage and analytics, rebuilt mobile app and ecosystem, facial recognition and identity-based access control, predictive security (learns routines, anticipates risks), and active deterrence (automated lights, sirens, voice warnings). The combined entity is positioned to become the #1 privacy-first, American-made security platform in the U.S."
  },
  {
    category: "nbtech_kb",
    question: "What are the financial projections for NewCo (NB Tech + Nightowl combined)?",
    answer: "Projected financials (management estimates — hypothetical, not guaranteed): 2025: Gross Sales $49M, Net Revenue $35.2M, Gross Profit $11.2M, Net Income ($1.4M loss). 2026: Gross Sales $64M, Net Revenue $48.4M, Gross Profit $24.8M, Net Income $5.7M profit. 2027: Gross Sales $109.7M, Net Revenue $85.8M, Gross Profit $49.6M, Net Income $18.1M. 2028: Gross Sales $150.2M, Net Revenue $119.2M, Gross Profit $74.2M, Net Income $34M. 2029: Gross Sales $206.4M, Net Revenue $166.1M, Gross Profit $108.4M, Net Income $55.2M. CAGR 2026–2029: ~48–50%. Gross margin expands from 23% (2025) to 53% (2029) driven by high-margin Magnus AI SaaS and subscription revenue layered on top of Nightowl's hardware base."
  },
  {
    category: "nbtech_kb",
    question: "What is the valuation — DCF analysis and comparable companies?",
    answer: "DCF Analysis (January 2026) implies an enterprise value of $605M for NewCo, based on: 48–50% CAGR (2026–2029), EBITDA margin expansion from low-teens to 35–45%, WACC of 11–14%, exit multiple of 18–24x, terminal growth rate 5–7%. Comparable Company Analysis (CCA) based on forward 2026 metrics — peer median EV/Rev 2.7x, EV/EBITDA 11.6x — implies Nightowl EV of ~$195M (lower than DCF because public peers are mature; NewCo is in high-growth phase). Nasdaq IPO targets: $7.00/share at ~$105M initial market cap (listing year), growing to ~$180M (Year 1) and $300M+ (Years 2–3). These are projections and targets only — there is no guarantee of achieving any specific valuation."
  },
  {
    category: "nbtech_kb",
    question: "What is the immediate EBITDA improvement identified post-merger without any revenue growth?",
    answer: "Management identified approximately $3.3M in annualized EBITDA improvement from cost reductions alone, requiring no sales increase: (1) Eliminating redundant operational roles between Magnus AI and Nightowl — middle management consolidation +$500K, marketing consolidation +$500K = +$1,000,000 total. (2) Removing redundant external vendors/outsourced functions — Magnus AI already handles internally what Nightowl pays externally for (cloud, software, AI, engineering) = +$1,000,000. (3) Vietnamese Subsidiary contribution — Nightowl's Vietnam-based manufacturing oversight company generates $500,000 annually in internal profit = +$500,000. (4) Interest expense elimination — retiring Nightowl's $8.3M founder note removes $788,500 in annual interest (9.5% rate) = +$788,500. Total: ~$3.3M annualized EBITDA improvement immediately post-merger."
  },
  {
    category: "nbtech_kb",
    question: "What is the full cap table and ownership structure of NB Tech Acquisitions Corp.?",
    answer: "Authorized shares: 1,000,000,000. Currently issued and outstanding: 18,257,000 common shares. CEO Eric Liboiron holds 11,000,000 shares = 60.30% of current outstanding. Eric Liboiron also holds a $400,000 convertible promissory note that converts into 400,000,000 shares of Class B common stock (10 votes per share = 4 billion votes, maintaining permanent voting control). Upon maximum offering (62,500,000 new shares sold): existing shareholders = 18,257,000 shares (22.61%); new investors = 62,500,000 shares (77.39%); total outstanding = 80,757,500. Management economic ownership post-max-offering: ~13.62%. Note: Class B structure means investors do NOT get voting control regardless of how many shares are sold. This is standard founder-control structure."
  },
  {
    category: "nbtech_kb",
    question: "What voting rights do investors in this offering receive?",
    answer: "Standard common stock investors in this offering receive 1 vote per share. Eric Liboiron holds a $400,000 convertible promissory note that converts into 400,000,000 shares of Class B common stock, each with 10 votes per share — equivalent to 4,000,000,000 votes total. Even if all 62,500,000 shares offered in this round were sold, new investors would have 62,500,000 votes combined versus Liboiron's 4 billion Class B votes. Investors should understand they will not have the ability to control the company or carry a majority vote for company directors. This is disclosed risk — accredited investors who understand private placements recognize this is a common founder-control structure."
  },
  {
    category: "nbtech_kb",
    question: "What is the minimum investment, how do I invest, and what documents are required?",
    answer: "Minimum investment: $25,000 (156,250 shares at $0.16/share). Maximum per investor: $500,000 (3,125,000 shares). The company may waive the minimum at its discretion. Payment methods: check payable to 'NB TECH ACQUISITIONS CORP.', wire transfer, ACH, credit card, or retirement account (self-directed IRA). Required documents: (1) Completed Investor Suitability Questionnaire / Accredited Investor Questionnaire; (2) Executed Subscription Agreement; (3) Payment. Funds are held in an Investment Holding Account with Transfer Online, Inc. until the minimum offering ($100,000) is reached, after which all proceeds go directly to the company. Subscriptions are irrevocable once tendered (except Florida, Georgia, Pennsylvania residents per NASAA legends). Contact: info@nbtecha.com | (949) 204-0288 | 620 Newport Center Drive, Suite 1100, Newport Beach, CA 92660."
  },
  {
    category: "nbtech_kb",
    question: "Who qualifies as an accredited investor for this offering?",
    answer: "This is a Regulation D Rule 506(c) offering — ALL investors must be verified accredited investors. Individuals qualify if they have: (1) Individual or joint net worth with spouse exceeding $1,000,000 (excluding primary residence equity), OR (2) Individual income exceeding $200,000 in each of the two most recent years with reasonable expectation of the same in the current year, OR (3) Joint income with spouse exceeding $300,000 in each of the two most recent years with same current-year expectation. Entities qualify if: total assets exceed $5,000,000 (not formed for purpose of this investment), or all equity owners are individually accredited. Institutional investors (banks, insurance companies, registered investment companies, SBICs, large employee benefit plans) also qualify. By signing the Subscription Agreement, investors grant permission for the company to review publicly available OFAC data for verification."
  },
  {
    category: "nbtech_kb",
    question: "Can I resell or transfer my NB Tech shares? What happens to them at the IPO?",
    answer: "Shares are restricted securities — they CANNOT be freely resold. There is currently NO public market for NB Tech shares. Shares may only be transferred if: (a) registered under the Securities Act and applicable state laws, or (b) a valid exemption is available (typically requires a legal opinion). Share certificates bear restrictive legends. The company is not obligated to ever register shares. The liquidity pathway is the proposed NewCo Nasdaq listing: NB Tech shareholders convert 21:1 into NewCo (NGMC) shares, which would then trade publicly on Nasdaq. If the Nasdaq listing occurs at the $7.00 target, investors' $0.16/share cost basis converts to ~$3.36/share NewCo basis, against a $7.00 IPO price. If the listing does not occur, investors should expect indefinite illiquidity. Shares cannot be pledged as loan collateral due to transfer restrictions."
  },
  {
    category: "nbtech_kb",
    question: "What are the use of proceeds from the NB Tech offering?",
    answer: "Maximum offering ($10,000,000): Offering expenses $100,000 (1%); Brokerage commissions up to $1,000,000 (10%); Total net to company: $8,900,000 (89%). Of the $8.9M going to the company: Acquiring equity/interests in technology companies $5,000,000 (56%); Adaptive marketing strategies $2,000,000 (22%); Development for fully owned companies $1,000,000 (11%); Corporate Year-1 expenses $900,000 (10%). Minimum offering ($100,000): Offering expenses $1,000 (1%); Commissions $10,000 (10%); Total to company: $89,000 (89%). Primary investment focus: AI technology acquisitions (especially AI models and cryptographic technologies), R&D, licensing and partnership strategies, and the Nightowl merger pathway. Management retains discretion to reallocate proceeds in the company's best interest."
  },
  {
    category: "nbtech_kb",
    question: "Who are the key executives at NB Tech and Nightowl, and what are their backgrounds?",
    answer: "NB Tech Acquisitions: Eric Liboiron (CEO/President/Director/Chairman) — 20+ years launching companies from fashion retail to international logistics, founded Zero404 virtual business incubator, McGill University BComm. Savanna Spieckerman (Chief Compliance Officer) — BS Business Administration and Data Analytics, Project Management Certification, multifamily housing sector background. Stan Watkins (VP Business Development) — USC degree, Fortune 100 consulting across 200+ industries, Nevada State Consultant during 2008 mortgage crisis, joined NB Tech June 2024. Nathaniel Blood (VP Investor Relations) — UNLV pre-law/biochemistry, founded real estate firm ($100 to $8M+ in 2 years), trained 4,000+ agents. Rhys Parry (CTO) — pioneer in Kubernetes, serverless cloud, DevOps. Dr. Abdul Jabbar (Senior AI/ML Specialist) — PhD Computer Science, University of Newcastle Australia 2020, formerly Allen Institute for AI. Nightowl leadership: Ivan Klarich (Transitional CEO), Ron Ferris (Founder, becomes CRO), F.W. Pearce (CFO), Benoit Chirouter (VP Engineering/System Architect), Christopher Mancuso (VP Retail Sales), Keiki Rodriguez-Tanamachi (VP Global Operations)."
  },
  {
    category: "nbtech_kb",
    question: "What is the management compensation structure?",
    answer: "Current and 12-month projected salaries: Eric Liboiron (CEO) — Current: $250,000/year; Projected next 12 months: $650,000/year. Savanna Spieckerman (CCO) — Current: $120,000/year; Projected: $400,000/year. Stan Watkins (VP Business Development) — Current: $100,000/year; Projected: $400,000/year. Nathaniel Blood (VP Investor Relations) — Current: $100,000/year; Projected: $400,000/year. Salary increases are conditional on business profitability and revenue growth. Each manager is also entitled to expense reimbursement and, as shareholders, participates in profit distributions if/when declared. Management currently owns approximately 60.30% of outstanding shares (Eric Liboiron alone holds 60.30%)."
  },
  {
    category: "nbtech_kb",
    question: "What technologies does NB Tech develop and acquire? What is in their IP portfolio?",
    answer: "NB Tech focuses on code-based technology assets across: (1) Artificial Intelligence and Predictive Analytics — AI platforms for real-time and historical data, predictive modeling, automated decision-making across healthcare, finance, and e-commerce sectors. (2) Blockchain and Digital Currency Solutions — decentralized transaction platforms, identity management; portfolio includes Documint and ZRO4 tokens (fintech and Web3). (3) Mobile Application Development — AR, AI, and blockchain-powered apps through the Mobile App Fund. (4) Cryptographic Technologies — encryption algorithms, secure communication protocols, data privacy solutions. (5) Magnus AI — full cloud/SaaS/AI platform being integrated with Nightowl. Portfolio companies include: Zero404 (virtual business incubator), Vlokr, CodeFront. Key advantage: 70% of Canadian development costs subsidized by the Canadian government. Leadership has ties to military intelligence and defense for government contract opportunities."
  },
  {
    category: "nbtech_kb",
    question: "What are the main risks an investor needs to understand before investing?",
    answer: "Critical disclosed risks: (1) Highly speculative — only invest money you can afford to lose entirely. (2) Growth stage company — operations commenced August 2021, still scaling; no guarantee of profitability. (3) No dividends paid and no near-term plans to pay them. (4) No public market for shares — indefinite holding period may be required. (5) Dilution — future share issuances will dilute your ownership percentage. (6) Management voting control — Eric Liboiron's Class B convertible note gives him effective permanent voting control regardless of shares sold. (7) Offering price is arbitrary — not based on assets, earnings, or book value. (8) Key person risk — significant dependence on Eric Liboiron and Savanna Spieckerman (key person insurance held for both). (9) Nightowl acquisition is not yet complete and the Nasdaq listing is not guaranteed. (10) Nightowl's $49M revenue is currently unaudited. (11) PCAOB audit required before S-1 filing — 4-month estimated timeline. (12) Siebert LOI is non-binding. (13) All financial projections are hypothetical — not reviewed by independent accountants. (14) Competitive risk from large corporations and VC-funded startups."
  },
  {
    category: "nbtech_kb",
    question: "What is NB Tech's full 4-pillar growth strategy post-Nightowl merger?",
    answer: "Four-pillar growth strategy: (1) Made in America — establish U.S.-based board assembly and firmware installation supply chain to eliminate China-based supply vulnerabilities, enable government and enterprise contracts, generate OEM licensing revenue, and market to privacy-conscious consumers as American-made hardware. (2) Premium Brand Repositioning — shift Nightowl from discount security brand to premium, privacy-first, American-made brand targeting 50–75 million freedom-oriented U.S. adults ($50B+ TAM growing at 25–40% CAGR). Build DTC channel through values-aligned influencers for higher margins. (3) Rollup Acquisition Strategy — acquire and consolidate independent security installation partners nationwide, roll up under a Nightowl-branded franchise model, add alarm systems to cross-sell, increase ARPU and LTV, expand commercial penetration (law firms, medical, gun ranges, car dealerships, home builders). (4) Magnus AI Integration — cloud migration, AI smart alerts and anomaly detection, privacy dashboards with granular controls, subscription-based storage and monitoring, rebuilt mobile app. Also: targeted Costco big-box expansion."
  },
  {
    category: "nbtech_kb",
    question: "What is the total addressable market for the combined NB Tech / Nightowl entity?",
    answer: "Three primary market segments: (1) Freedom-Oriented/Privacy-First Consumer Market: 50–75 million U.S. adults prioritize privacy, sovereignty, and non-Chinese-made technology. 20–30 million households represent $8B–$40B consumer TAM. Total freedom-oriented, privacy-first technology segment estimated at $50B+ growing at 25–40% CAGR. (2) Business and Commercial Security Market: National TAM of $13.5 billion. Target customers: law firms, medical practices, gun ranges/FFL retailers, manufacturers, contractors, retailers, gyms, car dealerships, home builders. Average commercial spend: $2,000–$25,000+ hardware/install; $200–$3,600 annually for software/monitoring; $30,000–$150,000 annually for multi-site customers. (3) AI/Tech Valuation Multiple Expansion: Integrating Magnus AI shifts NewCo from hardware company (peer median 2.7x EV/Rev) toward AI/SaaS platform (small-cap AI peers average 5–60x P/S). This multiple expansion is the core value creation thesis beyond revenue growth."
  },
  {
    category: "nbtech_kb",
    question: "What is NightOwl's current product line?",
    answer: "Nightowl products span: Wired Systems (NVR-based recorders up to 24-channel retail, up to 32-channel light commercial); Wireless Systems (indoor/outdoor, up to 12-channel with 8 POE + 4 WiFi); Outdoor cameras (solar-powered, weatherproof); Smart Doorbells (AC wired replacement model, Hybrid battery/wireless model); NVR recorders (BTN8 low-cost model on Costco.com with up to 12 channels, retail 24-channel, light commercial 32-channel). All cameras support night vision; most support 2-way audio; all outdoor units have spotlight deterrence. In development: first door lock (Q4), IK10 vandal-proof commercial cameras, panoramic camera, thermo-camera (vision + thermal sensor), 2x PoE Pan/Tilt cameras (optical 5x and 20x). Technology: proprietary P2P communication protocol (via 15-year Taiwanese technology partner). Data security: free local storage, US-hosted servers, Night Owl Guarantee (data never sold to third parties). Manufacturing: Vietnam."
  },
  {
    category: "nbtech_kb",
    question: "What are the Nasdaq Capital Market qualification requirements and how does NewCo plan to meet them?",
    answer: "Nasdaq Capital Market (NCM) requirements under Rule 5505. General requirements: Bid price minimum $4.00/share; at least 1,000,000 publicly held shares; minimum $15M market value of public float; minimum 300 round-lot shareholders (each owning 100+ shares). Must meet ONE of three financial standards: (A) Equity Standard — $5M+ stockholders' equity, 2-year operating history required. (B) Market Value Standard — $4M+ equity, $50M+ market value of listed securities. (C) Net Income Standard — $4M+ equity, $5M+ market value of listed securities, net income ≥$750,000 in latest fiscal year or 2 of last 3 years. NewCo's qualifying path: Siebert LOI targets minimum $15M raise at $7.00/share (~$105M initial market cap), which would satisfy Market Value Standard. Nightowl's 20+ year operating history and $49M revenue satisfies Equity Standard operating history requirement. Post-merger net income profitability in 2026 ($5.7M projected) satisfies Net Income Standard. PCAOB audit completion (~4 months) is required before S-1 filing."
  },
  {
    category: "nbtech_kb",
    question: "Does the company pay dividends? What is the return of profits policy?",
    answer: "No dividends have ever been paid and there are no current plans to distribute profits. The company intends to retain future earnings to fund operations and expansion. In the future, if management decides to distribute profits, shareholders will receive distributions proportionate to their shares — but this is entirely at management's discretion and depends on operational results, financial condition, and capital requirements. The primary return thesis for investors is capital appreciation through the Nightowl merger and Nasdaq listing pathway, not income from dividends."
  },
  {
    category: "nbtech_kb",
    question: "What is the governing law, transfer agent, and legal structure?",
    answer: "NB Tech Acquisitions Corp. is a Nevada corporation. The Subscription Agreement is governed by Nevada law. Transfer Agent and Registrar: Colonial Stock Transfer Company, Inc. (shareholders have direct portal access to view their holdings). The company is NOT currently party to any material litigation. Principal business address: 620 Newport Center Drive, Suite 1100, Newport Beach, California 92660. Phone: (949) 204-0288. Email: info@nbtecha.com. Website: www.nbtechacquisitions.com. Minimum offering proceeds ($100,000) are held in an Investment Holding Account at Transfer Online, Inc. until the minimum is reached. The offering is not underwritten — it is sold on a best-efforts basis."
  },
  {
    category: "nbtech_kb",
    question: "Who are the comparable AI and security companies used to benchmark NewCo's valuation?",
    answer: "Security/Surveillance Comparable Companies (CCA analysis): Arlo Technologies — EV $1.24B, TTM Rev $510M, EV/Rev 2.4x; ADT Inc — EV $14.28B, TTM Rev $5.11B, EV/Rev 2.8x, EV/EBITDA 5.4x; Alarm.com — EV $2.49B, TTM Rev $990M, EV/Rev 2.5x, EV/EBITDA 11.1x; Resideo — EV $8.42B, TTM Rev $7.43B, EV/Rev 1.1x, EV/EBITDA 12x; Ubiquiti — EV $33.21B, TTM Rev $2.76B, EV/Rev 12.1x, EV/EBITDA 35x; Motorola Solutions — EV $75.84B, TTM Rev $11.31B, EV/Rev 6.7x, EV/EBITDA 22.1x. Peer median: EV/Rev 2.7x, EV/EBITDA 11.6x → Implied Nightowl EV ~$195M on forward 2026 metrics. AI Small-Cap Comparables: SoundHound (P/S 59x, $125M cap), BigBear.ai (P/S 13x, $206M), Innodata (P/S 13x, $228M). As Magnus AI revenue grows, multiple expansion toward AI peers becomes the incremental value thesis."
  },
  {
    category: "nbtech_kb",
    question: "Can I invest through a self-directed IRA or retirement account?",
    answer: "Yes. The PPM specifically states investors may invest via check, wire transfer, retirement account, ACH, or credit card. Self-directed IRAs that permit private placements (Regulation D investments) are commonly used for this type of offering. Investors should consult their own tax advisor and IRA custodian before investing retirement funds, as there are specific IRS rules around prohibited transactions, Unrelated Business Taxable Income (UBTI), and valuation requirements for private placement assets held in IRAs. The company does not provide tax advice. The company's subscription agreement explicitly notes that the offering may have tax consequences and investors must retain their own professional advisors."
  },
  {
    category: "nbtech_kb",
    question: "What is the company's policy on side letters and special investor arrangements?",
    answer: "The company reserves the right to enter into side letters with investors without shareholder approval or disclosure to other investors. Side letters may grant: discounts on share price, stock options, warrants, early exit rights, or other special incentives not available to standard subscription investors. The company is not obligated to disclose the existence, identity of parties, or terms of any side letters. Potential counterparties may include individuals, broker-dealers, insurance companies, private funds, trusts, pension plans, banks, government entities, and sovereign wealth funds. Investors should be aware that some participants in the offering may receive more favorable economics or terms than those available through the standard subscription process."
  },
  {
    category: "nbtech_kb",
    question: "What is the investment thesis in plain language — why invest now vs. waiting?",
    answer: "The thesis: NB Tech investors at $0.16/share are buying pre-merger, pre-IPO equity in a company that has already lined up: a $49M-revenue acquisition target (Nightowl), a signed LOI with a real FINRA broker-dealer (Siebert) for up to $100M IPO raise, a PCAOB auditor, SEC attorney, and a specific Nasdaq listing pathway. The 21:1 conversion means every dollar invested today at $0.16 translates to a NewCo cost basis of ~$3.36/share. If NewCo lists at the $7.00 target, that's roughly a 2x return on the NewCo basis — achieved through the merger structure, not through NB Tech growing organically to a $7.00 stock. Waiting means waiting until after the S-1 is filed and the IPO occurs, at which point the entry price would be $7.00/share (or market). The risk of investing now: the merger may not close, the listing may not happen, or it may price below $7.00. Only accredited investors who can afford to lose their entire investment should participate."
  }
];

const inp = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '4px',
  padding: '8px 12px',
  color: '#e8e0d0',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Georgia, serif'
};

export default function NBTechKBImporter() {
  const [status, setStatus]   = useState('idle'); // idle | running | done | error
  const [progress, setProgress] = useState(0);
  const [log, setLog]         = useState([]);
  const [errors, setErrors]   = useState([]);
  const [deleteFirst, setDeleteFirst] = useState(false);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const runImport = async () => {
    setStatus('running');
    setProgress(0);
    setLog([]);
    setErrors([]);

    // Optionally delete existing nbtech_kb entries first
    if (deleteFirst) {
      addLog('🗑 Deleting existing nbtech_kb and nbtech_faq entries…');
      try {
        const existing = await base44.entities.KnowledgeBase.list('-created_date', 500);
        const toDelete = (existing || []).filter(e => e.category === 'nbtech_kb' || e.category === 'nbtech_faq');
        for (const e of toDelete) {
          await base44.entities.KnowledgeBase.delete(e.id);
        }
        addLog(`✓ Deleted ${toDelete.length} existing entries`);
      } catch (err) {
        addLog(`⚠ Delete pass failed: ${err.message}`);
      }
    }

    const total = NB_TECH_KB_ENTRIES.length;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < total; i++) {
      const entry = NB_TECH_KB_ENTRIES[i];
      try {
        await base44.entities.KnowledgeBase.create({
          ...entry,
          created_date: new Date().toISOString()
        });
        successCount++;
        addLog(`✓ [${i + 1}/${total}] ${entry.question.slice(0, 60)}…`);
      } catch (err) {
        errorCount++;
        setErrors(prev => [...prev, `[${i + 1}] ${entry.question.slice(0, 50)}: ${err.message}`]);
        addLog(`✗ [${i + 1}/${total}] FAILED: ${entry.question.slice(0, 50)}`);
      }
      setProgress(Math.round(((i + 1) / total) * 100));
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    addLog(`\n🏁 Import complete: ${successCount} succeeded, ${errorCount} failed out of ${total} entries.`);
    setStatus(errorCount === 0 ? 'done' : 'error');
  };

  const progressColor = status === 'done' ? '#4ade80' : status === 'error' ? '#f59e0b' : BLUE;

  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}44`, borderRadius: '8px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ color: BLUE, fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
          🔷 NB Tech KB Bulk Importer
        </div>
        <h2 style={{ color: '#e8e0d0', margin: '0 0 8px', fontSize: '20px', fontWeight: 'normal' }}>
          NB Tech Acquisitions Knowledge Base
        </h2>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 16px' }}>
          Imports {NB_TECH_KB_ENTRIES.length} comprehensive Q&A entries drawn from the full PPM, Nightowl merger deck, 
          and Confidential Private Placement Summary. All entries use category <code style={{ color: BLUE }}>nbtech_kb</code>.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <input
            type="checkbox"
            id="deleteFirst"
            checked={deleteFirst}
            onChange={e => setDeleteFirst(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor="deleteFirst" style={{ color: '#8a9ab8', fontSize: '12px', cursor: 'pointer' }}>
            Delete existing <code>nbtech_kb</code> / <code>nbtech_faq</code> entries before importing (recommended for fresh import)
          </label>
        </div>
        <button
          onClick={runImport}
          disabled={status === 'running'}
          style={{
            background: status === 'running' ? 'rgba(79,156,249,0.2)' : `linear-gradient(135deg,${BLUE},#3b82f6)`,
            color: status === 'running' ? '#4f9cf9' : DARK,
            border: 'none',
            borderRadius: '4px',
            padding: '12px 28px',
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          {status === 'running' ? `Importing… ${progress}%` : status === 'done' ? '✓ Done — Run Again?' : '🚀 Import All NB Tech KB Entries'}
        </button>
      </div>

      {/* Progress Bar */}
      {(status === 'running' || status === 'done' || status === 'error') && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#8a9ab8', fontSize: '11px' }}>Progress</span>
            <span style={{ color: progressColor, fontSize: '11px', fontWeight: 'bold' }}>{progress}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: progressColor, borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
          {status === 'done' && (
            <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '10px', fontWeight: 'bold' }}>
              ✅ All {NB_TECH_KB_ENTRIES.length} entries imported successfully! Switch to 🔷 NB Tech KB in BOB to see them.
            </div>
          )}
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '14px', maxHeight: '300px', overflowY: 'auto' }}>
          <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Import Log</div>
          {log.map((line, i) => (
            <div key={i} style={{ color: line.startsWith('✓') ? '#4ade80' : line.startsWith('✗') ? '#ef4444' : line.startsWith('🏁') ? BLUE : '#8a9ab8', fontSize: '11px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ marginTop: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '14px' }}>
          <div style={{ color: '#ef4444', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Errors ({errors.length})</div>
          {errors.map((e, i) => <div key={i} style={{ color: '#f87171', fontSize: '11px', lineHeight: 1.6 }}>{e}</div>)}
        </div>
      )}

      {/* Entry Preview */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Preview — {NB_TECH_KB_ENTRIES.length} Entries to Import
        </div>
        {NB_TECH_KB_ENTRIES.map((entry, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: BLUE, fontSize: '10px', background: `${BLUE}18`, padding: '2px 6px', borderRadius: '2px' }}>{entry.category}</span>
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{entry.question}</div>
            <div style={{ color: '#6b7280', fontSize: '11px', lineHeight: 1.5 }}>{entry.answer.slice(0, 150)}…</div>
          </div>
        ))}
      </div>
    </div>
  );
}