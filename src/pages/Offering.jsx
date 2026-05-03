import { useEffect } from "react";

const cssStyles = `  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --navy: #1a2744;
    --navy-light: #243460;
    --gold: #D4AF37;
    --gold-light: #E8C96A;
    --cream: #faf8f4;
    --white: #ffffff;
    --gray-100: #f4f4f2;
    --gray-200: #e8e6e0;
    --gray-400: #999690;
    --gray-600: #666360;
    --gray-800: #333230;
    --text: #1e1c18;
    --page-w: 816px;
    --page-h: 1056px;
    --margin: 72px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #2a2a2a;
    font-family: 'Source Serif 4', Georgia, serif;
    color: var(--text);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px;
    gap: 32px;
  }

  /* ── NAV ── */
  #page-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    background: var(--navy);
    color: #fff;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,.4);
  }
  #page-nav span { color: var(--gold); font-weight: 500; }
  #page-nav select {
    background: var(--navy-light);
    color: #fff;
    border: 1px solid rgba(255,255,255,.2);
    border-radius: 4px;
    padding: 3px 8px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  #page-nav button {
    background: var(--gold);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 4px 10px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  #page-nav button:hover { background: var(--gold-light); }
  .nav-title { flex: 1; color: rgba(255,255,255,.6); font-size: 11px; }

  /* ── PAGE SHELL ── */
  .page {
    width: var(--page-w);
    min-height: var(--page-h);
    background: var(--white);
    position: relative;
    box-shadow: 0 8px 40px rgba(0,0,0,.5);
    display: flex;
    flex-direction: column;
    scroll-margin-top: 60px;
  }

  /* ── HEADER BAND ── */
  .page-header {
    background: var(--navy);
    padding: 12px var(--margin);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .page-header .doc-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: rgba(255,255,255,.5);
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .page-header .page-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: var(--gold);
    letter-spacing: .08em;
  }

  /* ── BODY ── */
  .page-body {
    flex: 1;
    padding: 40px var(--margin) 48px;
  }

  /* ── FOOTER ── */
  .page-footer {
    border-top: 1px solid var(--gray-200);
    padding: 10px var(--margin);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .page-footer .footer-left {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    color: var(--gray-400);
    letter-spacing: .05em;
    text-transform: uppercase;
  }
  .page-footer .footer-right {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    color: var(--gold);
  }

  /* ── SECTION LABEL (dark band) ── */
  .section-label {
    background: var(--navy);
    color: #fff;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: .12em;
    text-transform: uppercase;
    padding: 7px 14px;
    margin-bottom: 20px;
    display: inline-block;
    width: 100%;
  }
  .section-label.gold {
    background: var(--gold);
  }
  .section-label.navy-light {
    background: var(--navy-light);
  }

  /* ── TYPOGRAPHY ── */
  h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 26px;
    font-weight: 700;
    color: var(--navy);
    line-height: 1.25;
    margin-bottom: 12px;
  }
  h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 18px;
    font-weight: 600;
    color: var(--navy);
    line-height: 1.3;
    margin-bottom: 10px;
    margin-top: 20px;
  }
  h2:first-child { margin-top: 0; }
  h3 {
    font-family: 'Source Serif 4', serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--navy);
    margin-bottom: 6px;
    margin-top: 16px;
  }
  h3:first-child { margin-top: 0; }
  p {
    font-size: 11.5px;
    line-height: 1.72;
    color: var(--text);
    margin-bottom: 10px;
  }
  p:last-child { margin-bottom: 0; }
  strong { font-weight: 600; }
  em { font-style: italic; }

  ul, ol {
    padding-left: 18px;
    margin-bottom: 10px;
  }
  li {
    font-size: 11.5px;
    line-height: 1.68;
    margin-bottom: 4px;
    color: var(--text);
  }
  li strong { color: var(--navy); }

  .caps-block {
    font-size: 10.5px;
    line-height: 1.7;
    text-align: justify;
    color: var(--text);
    margin-bottom: 10px;
  }

  /* ── BULLET DOT LIST ── */
  .dot-list { list-style: none; padding-left: 0; }
  .dot-list li {
    padding-left: 16px;
    position: relative;
    margin-bottom: 6px;
  }
  .dot-list li::before {
    content: '·';
    position: absolute;
    left: 0;
    color: var(--gold);
    font-size: 16px;
    line-height: 1.3;
  }

  /* ── CALL-OUT BOX ── */
  .callout {
    border-left: 3px solid var(--gold);
    background: #fdfbf0;
    padding: 12px 16px;
    margin: 14px 0;
    border-radius: 0 4px 4px 0;
  }
  .callout p { margin-bottom: 0; font-size: 11px; }
  .callout.navy {
    border-left-color: var(--navy);
    background: #f0f3fa;
  }
  .callout.green {
    border-left-color: #2e7d32;
    background: #f1f8f2;
  }

  /* ── INFO BOX ── */
  .info-box {
    border: 1.5px solid var(--navy);
    padding: 14px 16px;
    margin: 14px 0;
    border-radius: 2px;
  }
  .info-box-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--navy);
    margin-bottom: 8px;
    font-weight: 500;
  }

  /* ── TABLES ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    margin: 12px 0;
  }
  thead tr {
    background: var(--navy);
    color: #fff;
  }
  thead th {
    padding: 8px 10px;
    text-align: left;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: .06em;
    text-transform: uppercase;
    font-weight: 500;
  }
  tbody tr:nth-child(even) { background: var(--gray-100); }
  tbody tr:nth-child(odd) { background: var(--white); }
  tbody td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--gray-200);
    line-height: 1.5;
    color: var(--text);
  }
  tfoot tr { background: var(--navy-light); }
  tfoot td {
    padding: 8px 10px;
    color: #fff;
    font-weight: 600;
    font-size: 11px;
  }
  .td-highlight { color: var(--gold); font-weight: 600; }

  /* ── TWIN BOXES ── */
  .twin-boxes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 14px 0;
  }
  .twin-box {
    border: 1.5px solid var(--navy);
    padding: 12px 14px;
    border-radius: 2px;
  }
  .twin-box-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--white);
    background: var(--navy);
    padding: 4px 8px;
    margin: -12px -14px 10px;
    display: block;
  }
  .twin-box p, .twin-box li { font-size: 10.5px; }

  /* ── KV PAIRS ── */
  .kv-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 14px;
    margin: 12px 0;
    font-size: 11px;
  }
  .kv-key {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9.5px;
    color: var(--navy);
    font-weight: 500;
    letter-spacing: .04em;
    white-space: nowrap;
    padding: 3px 0;
  }
  .kv-val {
    color: var(--text);
    padding: 3px 0;
    border-bottom: 1px dashed var(--gray-200);
    font-size: 11px;
  }

  /* ── STAT CARDS ── */
  .stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 14px 0;
  }
  .stat-card {
    background: var(--navy);
    color: #fff;
    padding: 14px 12px;
    border-radius: 2px;
    text-align: center;
  }
  .stat-card .stat-val {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--gold);
    display: block;
    line-height: 1.1;
  }
  .stat-card .stat-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: rgba(255,255,255,.65);
    margin-top: 4px;
    display: block;
  }

  /* ── PIE / DONUT CHART ── */
  .chart-wrap { margin: 14px 0; }
  .chart-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--navy);
    margin-bottom: 8px;
    font-weight: 500;
  }
  .chart-flex {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .chart-legend { flex: 1; }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 10.5px;
  }
  .legend-dot {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* ── ORG CHART ── */
  .org-chart {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    margin: 16px 0;
    font-size: 10.5px;
  }
  .org-row {
    display: flex;
    gap: 10px;
    justify-content: center;
    position: relative;
  }
  .org-row::before {
    content: '';
    position: absolute;
    top: -18px; left: 50%;
    width: 1px; height: 18px;
    background: var(--navy);
    transform: translateX(-50%);
  }
  .org-row:first-child::before { display: none; }
  .org-node {
    border: 1.5px solid var(--navy);
    padding: 7px 12px;
    border-radius: 2px;
    text-align: center;
    background: var(--white);
    min-width: 120px;
    position: relative;
  }
  .org-node::after {
    content: '';
    position: absolute;
    bottom: -18px; left: 50%;
    width: 1px; height: 18px;
    background: var(--navy);
    transform: translateX(-50%);
  }
  .org-node:not(:has(~ .org-connector))::after { display: none; }
  .org-node.highlight { background: var(--navy); color: #fff; }
  .org-node.highlight strong { color: var(--gold); }
  .org-node strong { display: block; font-size: 10px; }
  .org-node small {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    color: var(--gray-400);
    letter-spacing: .05em;
  }
  .org-connector {
    width: 1px; height: 20px;
    background: var(--navy);
    margin: 0 auto;
  }
  .org-h-line {
    height: 1px;
    background: var(--navy);
    width: 80%;
    margin: 0 auto;
  }

  /* ── WATERFALL BAR ── */
  .waterfall {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin: 12px 0;
  }
  .wf-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10.5px;
  }
  .wf-label {
    width: 180px;
    color: var(--gray-600);
    font-size: 10px;
    text-align: right;
    flex-shrink: 0;
  }
  .wf-bar-wrap {
    flex: 1;
    background: var(--gray-100);
    height: 20px;
    border-radius: 2px;
    overflow: hidden;
  }
  .wf-bar {
    height: 100%;
    background: var(--navy);
    display: flex;
    align-items: center;
    padding-left: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5px;
    color: #fff;
    letter-spacing: .04em;
  }
  .wf-bar.gold { background: var(--gold); }
  .wf-val {
    width: 70px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: var(--navy);
    font-weight: 500;
    flex-shrink: 0;
  }

  /* ── MILESTONE TIMELINE ── */
  .timeline {
    position: relative;
    padding-left: 20px;
    margin: 12px 0;
  }
  .timeline::before {
    content: '';
    position: absolute;
    left: 7px; top: 0; bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, var(--navy), var(--gold));
  }
  .tl-item {
    position: relative;
    margin-bottom: 12px;
    padding-left: 16px;
  }
  .tl-item::before {
    content: '';
    position: absolute;
    left: -13px; top: 4px;
    width: 9px; height: 9px;
    border-radius: 50%;
    background: var(--gold);
    border: 2px solid var(--white);
    box-shadow: 0 0 0 1px var(--gold);
  }
  .tl-date {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: var(--gold);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin-bottom: 2px;
  }
  .tl-content { font-size: 11px; }

  /* ── SEPARATOR ── */
  .rule {
    border: none;
    border-top: 1px solid var(--gray-200);
    margin: 16px 0;
  }
  .rule-thick {
    border: none;
    border-top: 2px solid var(--navy);
    margin: 16px 0;
  }

  /* ── HIGHLIGHT TEXT ── */
  .hl-orange { color: var(--gold); font-weight: 600; }
  .hl-navy { color: var(--navy); font-weight: 600; }

  /* ── NOTICE BLOCK ── */
  .notice-block {
    background: var(--gray-100);
    border: 1px solid var(--gray-200);
    padding: 12px 14px;
    margin: 10px 0;
    font-size: 10.5px;
    line-height: 1.65;
  }

  /* ── CAPS LEGAL ── */
  .legal-caps {
    font-size: 10px;
    line-height: 1.7;
    text-align: justify;
    margin-bottom: 10px;
  }

  /* ── INTENTIONALLY BLANK ── */
  .blank-page {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--gray-400);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  /* ── OWNERSHIP DONUT ── */
  .donut-wrap {
    display: flex;
    align-items: center;
    gap: 24px;
    margin: 14px 0;
    padding: 16px;
    background: var(--gray-100);
    border-radius: 2px;
  }
  svg.donut { flex-shrink: 0; }

  /* ── RISK BOX ── */
  .risk-box {
    background: #fff3f0;
    border: 1.5px solid #e53935;
    padding: 12px 14px;
    margin: 12px 0;
    border-radius: 2px;
  }
  .risk-box p { font-size: 10.5px; margin-bottom: 0; }

  /* ── PORTAL TABLE ── */
  .portal-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    margin: 10px 0;
  }
  .portal-table th {
    background: var(--navy);
    color: #fff;
    padding: 7px 10px;
    text-align: left;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: .07em;
  }
  .portal-table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--gray-200);
    vertical-align: top;
    font-size: 10.5px;
  }
  .portal-table tr:nth-child(even) td { background: var(--gray-100); }

  /* ── PAGE 1 cover ── */
  .page-cover {
    background: linear-gradient(160deg, var(--navy) 0%, var(--navy-light) 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px var(--margin);
    text-align: center;
    gap: 20px;
    min-height: var(--page-h);
  }
  .cover-confidential {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--gold);
    border: 1px solid var(--gold);
    padding: 4px 14px;
  }
  .cover-h1 {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
  }
  .cover-sub {
    font-family: 'Source Serif 4', serif;
    font-size: 14px;
    color: rgba(255,255,255,.7);
  }
  .cover-divider {
    width: 80px; height: 2px;
    background: var(--gold);
  }
  .cover-class {
    font-family: 'Source Serif 4', serif;
    font-size: 13px;
    color: rgba(255,255,255,.85);
    font-style: italic;
  }
`;

const htmlContent = `{/* NAV */}
<div id="page-nav">
  <span>ROSIE AI LLC</span>
  <span className="nav-title">Confidential Private Placement Memorandum · 506(c)</span>
  <label htmlFor="page-jump" style="color:rgba(255,255,255,.5);font-size:10px;">Go to page:</label>
  <select id="page-jump" onChange={(e) => { const el = document.getElementById('p' + e.target.value); if(el) el.scrollIntoView({behavior:'smooth'}); }}>
  </select>
  <button onClick={() => { window.print() }}>Print / Save PDF</button>
</div>



{/* ═══════════════════════════════════════════════════════════
     PAGE 1 — COVER (PDF page 1 — we include this as page 1)
     ═══════════════════════════════════════════════════════════ */}
<div className="page" id="p1">
  <div className="page-cover">
    <div className="cover-confidential">Confidential — Accredited Investors Only</div>
    <div className="cover-h1">Confidential Private<br />Placement Memorandum</div>
    <div className="cover-sub">Rosie AI, LLC &nbsp;|&nbsp; 506(c) PPM</div>
    <div className="cover-divider"></div>
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="68" fill="none" stroke="rgba(232,119,34,.3)" stroke-width="2"/>
      <circle cx="70" cy="70" r="52" fill="rgba(232,119,34,.08)" stroke="rgba(232,119,34,.4)" stroke-width="1.5"/>
      <text x="70" y="64" text-anchor="middle" font-family="'Playfair Display',serif" font-size="28" font-weight="700" fill="#D4AF37">R</text>
      <text x="70" y="88" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="9" fill="rgba(255,255,255,.6)" letter-spacing="3">ROSIE AI</text>
      <text x="70" y="102" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="7" fill="rgba(255,255,255,.4)" letter-spacing="2">AUTOMATION PLATFORM</text>
    </svg>
    <div className="cover-class">Class B Units of Limited Liability<br />Company Membership Interests</div>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 1</span>
  </div>
</div>

{/* ═══════════════════════════════════════════════════════════
     PAGE 2 — NOTICES
     ═══════════════════════════════════════════════════════════ */}
<div className="page" id="p2">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span>
    <span className="page-num">Page 2</span>
  </div>
  <div className="page-body">
    <div className="section-label">Notices</div>
    <p>The Company is a limited liability company in the State of Wyoming. This Memorandum relates to the offering of units of Class B membership interests (CLASS B UNITS) of the Company.</p>
    <h3>Reliance on this Memorandum</h3>
    <p>The CLASS B UNITS are offered only on the basis of the information contained in this Memorandum. Any further information or representations given or made by any dealer, broker or other person should be disregarded and accordingly, should not be relied upon. No person has been authorized to give any information or to make any representations in connection with the offering of the CLASS B UNITS other than those contained in this Memorandum and, if given or made, such information or representations must not be relied on as having been authorized by the Company.</p>
    <p className="legal-caps">THIS MEMORANDUM IS PROVIDED ON A CONFIDENTIAL BASIS SOLELY FOR THE INFORMATION OF THOSE PERSONS TO WHOM IT IS TRANSMITTED BY THE UNDERSIGNED SO THAT THEY MAY CONSIDER THE FUND'S OFFERING AND IS NOT TO BE REPRODUCED OR USED FOR ANY OTHER PURPOSE. PROSPECTIVE INVESTORS IN CLASS B UNITS ARE NOT TO CONSTRUE THE CONTENTS OF THIS MEMORANDUM AS LEGAL ADVICE. EACH PROSPECTIVE INVESTOR SHOULD CONSULT THE INVESTOR'S OWN ADVISERS CONCERNING LEGAL, TAX, ERISA AND RELATED MATTERS CONCERNING AN INVESTMENT IN THE CLASS B UNITS.</p>
    <p className="legal-caps">THE OFFER AND SALE OF CLASS B UNITS HEREBY HAS NOT BEEN REGISTERED WITH THE SEC OR THE SECURITIES COMMISSION OF ANY STATE IN RELIANCE UPON AN EXEMPTION FROM REGISTRATION UNDER THE 1933 ACT, AND ACCORDINGLY, MAY NOT BE OFFERED OR RESOLD EXCEPT UNDER AN EFFECTIVE REGISTRATION STATEMENT UNDER THE 1933 ACT OR UNDER AN AVAILABLE EXEMPTION FROM, OR IN A TRANSACTION NOT SUBJECT TO, THE REGISTRATION REQUIREMENTS OF THE 1933 ACT AND IN ACCORDANCE WITH APPLICABLE STATE SECURITIES LAWS.</p>
    <p className="legal-caps">THE CLASS B UNITS ARE BEING OFFERED IN RELIANCE ON AN EXEMPTION FROM THE REGISTRATION REQUIREMENTS OF THE 1933 ACT. THE CLASS B UNITS MAY BE SOLD ONLY TO "ACCREDITED INVESTORS" WHO MEET MINIMUM NET WORTH THRESHOLDS AND TO "QUALIFIED CLIENTS."</p>
    <p className="legal-caps">THE CLASS B UNITS ARE SUBJECT TO LEGAL RESTRICTIONS ON THE TRANSFER AND RESALE AND INVESTORS SHOULD NOT ASSUME THEY WILL BE ABLE TO RESELL THE CLASS B UNITS. INVESTING IN THE CLASS B UNITS INVOLVES RISK, AND INVESTORS SHOULD BE ABLE TO BEAR THE LOSS OF THEIR INVESTMENT IN THE CLASS B UNITS. SEE "RISK FACTORS" BELOW.</p>
    <p className="legal-caps">THE COMPANY MAKES THE STATEMENTS IN THIS CONFIDENTIAL ACCREDITED INVESTOR PACKAGE AS OF THE DATE HEREOF, UNLESS STATED OTHERWISE. NEITHER THE DELIVERY OF THIS CONFIDENTIAL ACCREDITED INVESTOR PACKAGE, NOR ANY SALE MADE HEREUNDER AS OF A DATE AFTER THE DATE OF THIS CONFIDENTIAL ACCREDITED INVESTOR PACKAGE, SHALL CREATE ANY IMPLICATION THAT THE INFORMATION CONTAINED HEREIN OR THE AFFAIRS OF THE COMPANY HAVE NOT CHANGED SINCE THE DATE HEREOF.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 2</span>
  </div>
</div>

{/* PAGE 3 */}
<div className="page" id="p3">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span>
    <span className="page-num">Page 3</span>
  </div>
  <div className="page-body">
    <p className="legal-caps">THE FORWARD-LOOKING STATEMENTS INCLUDED IN THIS MEMORANDUM ARE NOT HISTORICAL FACTS OR GUARANTEES OF PERFORMANCE, BUT RATHER ARE BASED UPON CURRENT EXPECTATIONS, ESTIMATES AND PROJECTIONS ABOUT THE COMPANY, ITS INDUSTRY, BELIEFS AND ASSUMPTIONS. WORDS SUCH AS "ANTICIPATES", "EXPECTS", "PROJECTS," "INTENDS", "PLANS", "BELIEVES", "SEEKS", "HOPES" AND "ESTIMATES," AND VARIATIONS OF THESE WORDS AND SIMILAR EXPRESSIONS, OR FUTURE OR CONDITIONAL VERBS SUCH AS "WILL", "SHALL", "WOULD", "SHOULD", "COULD" OR "MAY", ARE INTENDED TO IDENTIFY FORWARD-LOOKING STATEMENTS. THESE STATEMENTS ARE NOT GUARANTEES OF FUTURE PERFORMANCE AND ARE SUBJECT TO RISKS, UNCERTAINTIES AND OTHER FACTORS, SOME OF WHICH ARE BEYOND THE COMPANY'S CONTROL, ARE DIFFICULT TO PREDICT, AND COULD CAUSE ACTUAL RESULTS TO DIFFER MATERIALLY FROM THOSE EXPRESSED OR FORECASTED IN THE FORWARD-LOOKING STATEMENTS. THESE RISKS AND UNCERTAINTIES INCLUDE (BUT ARE NOT LIMITED TO) THOSE DESCRIBED IN SECTION "RISK FACTORS" AND ELSEWHERE IN THIS MEMORANDUM. GIVEN THESE UNCERTAINTIES, PROSPECTIVE INVESTORS ARE CAUTIONED NOT TO PLACE UNDUE RELIANCE ON SUCH FORWARD-LOOKING STATEMENTS. THESE FORWARD-LOOKING STATEMENTS ARE BASED ON CURRENT EXPECTATIONS, AND THE COMPANY ASSUMES NO OBLIGATIONS TO UPDATE THIS INFORMATION.</p>
    <p className="legal-caps">PROSPECTIVE INVESTORS ARE FURTHER ADVISED THAT STATEMENTS OR ESTIMATES OF PAST PERFORMANCE OF PEER COMPANIES DO NOT CONSTITUTE REPRESENTATIONS, WARRANTIES OR GUARANTEES THAT THE COMPANY WILL REPLICATE THAT PAST PERFORMANCE IN ITS FUTURE OPERATIONS. THE COMPANY IS IN THE START UP DEVELOPMENTAL STAGE, HAS GENERATED NO REVENUES AND DOES NOT HAVE ANY PAST PERFORMANCE AS OF THE DATE HEREOF.</p>
    <p>The information contained herein is confidential and private. It is for the exclusive use of persons selected by Rosie AI, LLC.</p>
    <div className="notice-block" style="text-align:center;margin-top:30px;">
      <strong style="font-size:13px;color:var(--navy);">FOR ACCREDITED INVESTORS ONLY</strong>
    </div>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 3</span>
  </div>
</div>

{/* PAGE 4 — SUMMARY OF TERMS (with section from PDF page 4 EXCLUDING the "Focus of the Offering" bullet section) */}
<div className="page" id="p4">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span>
    <span className="page-num">Page 4</span>
  </div>
  <div className="page-body">
    <div className="section-label">Summary of the Terms</div>
    <h3>The Company</h3>
    <p>Rosie AI, LLC (the "Company") is a Wyoming Limited Liability Company that has developed a production-ready, multi-tenant AI lead intelligence and autonomous outreach platform. The platform is fully functional, consisting of 150+ backend functions and 136 data entities, and has achieved a 92/100 Security Audit Score verified by a triple-AI certification process (Claude, GPT-4o, and Gemini 1.5 Pro). The Company is raising capital to fund the transition from its current production build to an enterprise-ready system capable of supporting thousands of concurrent organizations with 99.99% uptime.</p>
    <h3>Investment Structure &amp; Ownership</h3>
    <p>The Company is seeking to deploy USD $500,000 in capital to achieve institutional scale.</p>
    <div className="stat-row">
      <div className="stat-card"><span className="stat-val">$500K</span><span className="stat-label">Total Raise</span></div>
      <div className="stat-card"><span className="stat-val">21.5%</span><span className="stat-label">Investor Ownership</span></div>
      <div className="stat-card"><span className="stat-val">$0.25</span><span className="stat-label">Price Per Unit</span></div>
    </div>
    <ul className="dot-list">
      <li><strong>Investor Ownership:</strong> Total equity allocated to the investor class is 21.5% of the Company.</li>
      <li><strong>Managing Partner Stephani Scheidt:</strong> Leads the B2B sales engine, partnership cultivation, and SaaS recurring revenue optimization.</li>
      <li><strong>Engineering Unit:</strong> Execution is supported by a specialized team of three engineers based in the Philippines, covering backend/pipeline architecture, React 18 UI/UX development, and external API/data system integrations.</li>
      <li><strong>Bonus Round:</strong> The first $150,000 raised triggers the Bonus Round. For every $1,000 invested, investors receive 1,000 additional Class B Units at no cost, lowering their average cost per unit to $0.200. 150,000 Bonus Units total.</li>
      <li><strong>Return Model:</strong> Two revenue streams — (1) organizational subscriptions averaging $500–$820/month and (2) a la carte AI credits marketplace launching September 2026 ($5–$100+ packages). Cash-flow break-even at ~15 orgs ($10,100/month fixed). Class B distributions activate at $20,000/month blended MRR (projected Q4 2026). Blended ARR target: $27.5M by end of 2028.</li>
      <li><strong>Chief Technology Engineer:</strong> Responsible for architecting the multi-tenant SaaS framework, enterprise security protocols, and elastic infrastructure scaling.</li>
      <li><strong>Unit Price:</strong> $0.25 per Class B Unit (2,000,000 paid units × $0.25 = $500,000 raise). Bonus Units carry no cost basis.</li>
      <li><strong>Governance:</strong> Management retains operational control. Investors benefit from the high-leverage offshore engineering model.</li>
    </ul>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 4</span>
  </div>
</div>

{/* PAGE 5 — FOCUS OF THE OFFERING / OFFERING FUNDING MODEL */}
<div className="page" id="p5">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span>
    <span className="page-num">Page 5</span>
  </div>
  <div className="page-body">
    <div className="section-label">Focus of the Offering</div>
    <p>The primary objective of Rosie AI, LLC (a Wyoming Limited Liability Company) is to deploy USD $500,000 in capital to finalize the migration of our platform from a high-performance production build to a robust, enterprise-ready multi-tenant system.</p>
    <p>The platform is currently fully functional, boasting 150+ backend functions and 136 data entities. This capital raise is specifically designed to fund the engineering and infrastructure required to scale the system to support hundreds of concurrent organizations.</p>
    <h3>Offering Strategies</h3>
    <p>The Company's strategy is built on the fundamental shift from static data to real-time AI orchestration. While legacy competitors provide "stale" lists that require human labor to execute, Rosie AI detects live intent and performs the outreach autonomously.</p>
    <p><strong>The Multi-Tenant Migration</strong> — Our strategy involves hardening the existing architecture into a scalable SaaS model, including enterprise-grade infrastructure with 99.99% uptime, multi-tenant isolation for institutional clients, and subscription-based recurring revenue.</p>
    <p><strong>The International Team Advantage</strong> — We utilize a specialized engineering team based in the Philippines at a 92% cost saving compared to traditional U.S.-based engineering teams, ensuring the majority of the $500,000 raise is directed toward growth and system scaling.</p>
    <div className="section-label navy-light" style="margin-top:18px;">The Offering Funding Model</div>
    <p>The Company will use the USD $500,000 in capital to drive a high-velocity growth cycle. The Rosie AI model is designed for rapid capital efficiency, with profitability projected at just 15 paying organizations.</p>
    <h3>Capital Allocation (Use of Proceeds):</h3>
    <div className="waterfall">
      <div className="wf-row"><span className="wf-label">Customer Acquisition</span><div className="wf-bar-wrap"><div className="wf-bar gold" style="width:30%">30%</div></div><span className="wf-val">$150,000</span></div>
      <div className="wf-row"><span className="wf-label">1st Year Personnel Costs</span><div className="wf-bar-wrap"><div className="wf-bar" style="width:21.5%">21.5%</div></div><span className="wf-val">$107,400</span></div>
      <div className="wf-row"><span className="wf-label">Product Development</span><div className="wf-bar-wrap"><div className="wf-bar gold" style="width:20%">20%</div></div><span className="wf-val">$100,000</span></div>
      <div className="wf-row"><span className="wf-label">Infrastructure Scaling</span><div className="wf-bar-wrap"><div className="wf-bar" style="width:10%">10%</div></div><span className="wf-val">$50,000</span></div>
      <div className="wf-row"><span className="wf-label">Operations &amp; Legal</span><div className="wf-bar-wrap"><div className="wf-bar" style="width:10%">10%</div></div><span className="wf-val">$50,000</span></div>
      <div className="wf-row"><span className="wf-label">Working Capital Reserve</span><div className="wf-bar-wrap"><div className="wf-bar gold" style="width:8.5%">8.5%</div></div><span className="wf-val">$42,600</span></div>
    </div>
    <div className="callout">
      <p><strong>Profit Waterfall and Growth:</strong> Once the platform surpasses $10,100/month in revenue (approximately 15 paying organizations at $700 avg MRR), excess cash flow is distributed to shareholders per the Operating Agreement waterfall tiers.</p>
    </div>
    <p><strong>Growth Trajectory:</strong> 50 paying orgs by Q4 2026 → 250 by end of 2027 ($2.25M ARR) → 2,000 by end of 2028 ($19.7M ARR).</p>
    <p>Investors in this offering will collectively own 21.4% of the Company, positioning them to benefit directly from this expansion.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 5</span>
  </div>
</div>

{/* PAGE 6 — REVENUE PROJECTIONS & GROWTH MILESTONES */}
<div className="page" id="p6">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span>
    <span className="page-num">Page 6</span>
  </div>
  <div className="page-body">
    <div className="section-label">Revenue Projections &amp; Growth Milestones</div>
    <p>Rosie AI generates revenue through two complementary streams: (1) recurring organizational subscriptions and (2) a la carte AI services credits marketplace, launching September 2026. The combined model creates both predictable MRR and high-margin usage-based upside. Milestones below reflect blended revenue from both streams.</p>
    <div className="section-label navy-light" style="font-size:9px;padding:5px 10px;">Stream 1 · Organizational Subscriptions (Active Now)</div>
    <table>
      <thead>
        <tr><th>Milestone</th><th># Orgs</th><th>Avg MRR/Org</th><th>Sub. MRR</th><th>Credit MRR</th><th>Total MRR</th><th>ARR</th></tr>
      </thead>
      <tbody>
        <tr><td>Month 2 (Sept 2026)</td><td>10</td><td>$500</td><td>$5,000</td><td>$2,000</td><td>$7,000</td><td>$84K</td></tr>
        <tr><td>Month 4 (Q4 2026)</td><td>25</td><td>$600</td><td>$15,000</td><td>$8,000</td><td>$23,000</td><td>$276K</td></tr>
        <tr><td>Month 6 (Q2 2027)</td><td>50</td><td>$650</td><td>$32,500</td><td>$18,000</td><td>$50,500</td><td>$606K</td></tr>
        <tr><td>Month 12 (Q2 2027)</td><td>125</td><td>$700</td><td>$87,500</td><td>$45,000</td><td>$132,500</td><td>$1.59M</td></tr>
        <tr><td>Month 18 (Dec 2027)</td><td>250</td><td>$750</td><td>$187,500</td><td>$90,000</td><td>$277,500</td><td>$3.33M</td></tr>
        <tr><td>Month 24 (Jun 2028)</td><td>750</td><td>$800</td><td>$600,000</td><td>$250,000</td><td>$850,000</td><td>$10.2M</td></tr>
        <tr style="background:#1a2744;color:#fff;"><td><strong style="color:#D4AF37">Month 30 (Dec 2028)</strong></td><td><strong style="color:#fff">2,000</strong></td><td><strong style="color:#fff">$820</strong></td><td><strong style="color:#fff">$1,640,000</strong></td><td><strong style="color:#fff">$650,000</strong></td><td><strong style="color:#D4AF37">$2,290,000</strong></td><td><strong style="color:#D4AF37">$27.5M</strong></td></tr>
      </tbody>
    </table>
    <div className="section-label navy-light" style="font-size:9px;padding:5px 10px;margin-top:14px;">Stream 2 · A La Carte AI Credits Marketplace (Launching September 2026)</div>
    <table>
      <thead><tr><th>Credit Package</th><th>Price</th><th>Credits</th><th>Services Included</th><th>Est. Sessions</th></tr></thead>
      <tbody>
        <tr><td>Starter Pack</td><td>$5</td><td>500 cr</td><td>AI Voice, Predictive Dialer, Email Automation, Apify scraping</td><td>~25–55</td></tr>
        <tr><td>Growth Pack</td><td>$25</td><td>2,750 cr</td><td>All services · full platform access</td><td>~60–120</td></tr>
        <tr><td>Pro Pack</td><td>$50</td><td>6,000 cr</td><td>All services · priority processing queue</td><td>~130–260</td></tr>
        <tr><td>Scale Pack</td><td>$100</td><td>13,000 cr</td><td>All services · dedicated throughput allocation</td><td>Unlimited tiers</td></tr>
        <tr><td>Custom</td><td>Custom</td><td>Custom</td><td>Enterprise volume pricing · negotiated per org</td><td>Unlimited</td></tr>
      </tbody>
    </table>
    <p style="font-size:9.5px;color:var(--gray-600);">Credit consumption rates (approximate): AI Voice Agent = 50 cr/min | Predictive Dialer = 30 cr/min | Email Automation = 10 cr/email | Apify Web Scraping = 20 cr/1,000 records | Rates subject to change.</p>
    <h3>Distribution Threshold &amp; Revenue Share</h3>
    <div className="kv-grid">
      <span className="kv-key">Fixed Monthly Operating Cost</span><span className="kv-val">$10,100</span>
      <span className="kv-key">Cash-Flow Break-Even</span><span className="kv-val">~15 Organizations (~$700 avg sub MRR)</span>
      <span className="kv-key">Class B Distributions Activate</span><span className="kv-val hl-orange">$20,000+/mo Total MRR (all streams)</span>
      <span className="kv-key">Orgs Required (blended)</span><span className="kv-val">~20–25 Organizations</span>
      <span className="kv-key">Projected Distribution Start</span><span className="kv-val">Q4 2026</span>
    </div>
    <p style="font-size:9.5px;color:var(--gray-600);margin-top:8px;">Note: Total MRR figures include both subscription and credit stream revenue. Credit revenue projections are conservative estimates based on current market benchmarks for AI usage-based SaaS platforms.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 6</span>
  </div>
</div>

{/* PAGE 7 — DUAL REVENUE MODEL */}
<div className="page" id="p7">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Revenue Streams &amp; A La Carte Services Marketplace</span>
    <span className="page-num">Page 7</span>
  </div>
  <div className="page-body">
    <div className="section-label">Dual Revenue Model: Subscriptions + A La Carte Credit Marketplace</div>
    <p>Rosie AI generates revenue through two distinct but complementary channels. The first — organizational subscriptions — provides predictable, recurring monthly revenue (MRR) from B2B clients paying a flat platform fee. The second — a la carte AI services credits — is a usage-based marketplace launching September 2026 that allows any user, subscriber or not, to purchase credit packages and consume individual AI services on demand. Together these two streams significantly increase revenue per user, lower the barrier to entry for new clients, and create a high-margin, scalable second revenue engine.</p>
    <div className="section-label navy-light" style="font-size:9px;padding:5px 10px;margin-top:10px;">Stream 1 · Organizational Subscriptions (Active)</div>
    <p>B2B organizations pay a monthly platform subscription fee (averaging $500–$820/month scaling with platform maturity) for full access to Rosie AI's lead intelligence engine, autonomous outreach pipelines, intent scoring, and analytics dashboard. This is the core recurring revenue base and the primary driver of MRR through 2026. At 15 paying organizations, the platform reaches cash-flow break-even on its baseline operating costs.</p>
    <div className="section-label navy-light" style="font-size:9px;padding:5px 10px;margin-top:10px;">Stream 2 · A La Carte AI Services Credits Marketplace (Launching September 2026)</div>
    <p>Beginning September 2026, Rosie AI will open its AI services infrastructure as a self-serve, credit-based marketplace. Users purchase credit packages in denominations of $5, $25, $50, $100, or custom enterprise volumes. Credits are consumed when using any of the following AI services on demand, with no subscription required:</p>
    <div className="callout"><p><strong>AI Voice Agents:</strong> Autonomous inbound and outbound AI voice calls powered by the v6 Engine. Handles appointment setting, lead qualification, at $0.01/min all-in cost.</p></div>
    <div className="callout navy"><p><strong>Predictive Dialer:</strong> Intelligent automated dialing system that pre-qualifies contacts before connecting a live agent or AI handler. Maximizes contact rates and reduces wasted dial time across Solar, Roofing, and other verticals.</p></div>
    <div className="callout"><p><strong>Email Automation:</strong> AI-composed, personalized email sequences triggered by real-time intent signals. Supports multi-step drip campaigns, response detection, and automatic follow-up with no human intervention.</p></div>
    <div className="callout navy"><p><strong>Apify Web Scraping:</strong> On-demand data extraction via the Company's proprietary Apify actor network. Pull municipal permit filings, social signals, job postings, and competitive intelligence at scale.</p></div>
    <table style="margin-top:10px;">
      <thead><tr><th>Package</th><th>Price</th><th>Credits Incl.</th><th>Bonus Credits</th><th>Effective Rate</th><th>Best For</th></tr></thead>
      <tbody>
        <tr><td>Starter</td><td>$5</td><td>500</td><td>+100</td><td>$0.010/cr</td><td>Trial / light usage</td></tr>
        <tr><td>Growth</td><td>$25</td><td>2,500</td><td>+250</td><td>$0.0091/cr</td><td>Growing teams</td></tr>
        <tr><td>Pro</td><td>$50</td><td>5,000</td><td>+1,000</td><td>$0.0083/cr</td><td>Active campaigns</td></tr>
        <tr><td>Scale</td><td>$100</td><td>10,000</td><td>+3,000</td><td>$0.0077/cr</td><td>High-volume orgs</td></tr>
        <tr><td>Custom</td><td>Custom</td><td>Custom</td><td>Custom</td><td>Negotiated</td><td>Enterprise clients</td></tr>
      </tbody>
    </table>
    <h3>Revenue Impact of the Credit Marketplace</h3>
    <p>The credit marketplace is projected to generate meaningful incremental revenue beginning Q4 2026 — even at conservative attachment rates. If just 40% of organizational subscribers purchase one $25 credit pack per month, 50 organizations generates $500/month in additional credit revenue. At 250 organizations with higher average spend, credit revenue alone is projected to reach $90,000/month by December 2027. Non-subscriber credit purchasers (walk-in users) represent additional upside not reflected in the organizational subscription projections.</p>
    <div className="callout green"><p><strong>Strategic Advantage:</strong> The credit marketplace lowers the barrier to entry for prospective clients — a $5 Starter Pack lets any business trial Rosie AI's AI services before committing to a subscription, creating a self-funding sales funnel. This flywheel effect is expected to accelerate organizational subscription conversion rates from Q4 2026 forward.</p></div>
    <p style="font-size:9px;color:var(--gray-400);margin-top:8px;">All credit pricing, consumption rates, and service availability are subject to change at the Managing Partner's discretion. Credit packages are non-refundable once consumed.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 7</span>
  </div>
</div>

{/* PAGE 8 — OPERATIONAL COST STRUCTURE */}
<div className="page" id="p8">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Operational Cost Structure &amp; Capital Deployment</span>
    <span className="page-num">Page 8</span>
  </div>
  <div className="page-body">
    <div className="section-label">Operational Cost Scaling and Capital vs. Operating Expense Distinction</div>
    <p>The operating cost schedule on the preceding page reflects the Company's baseline fixed costs as of the date of this Memorandum. These figures represent the lean, early-stage cost structure required to sustain the platform and core team during the initial growth phase. Investors should clearly understand that as Rosie AI scales its revenue, expands its client base, and completes the migration into a full enterprise-grade, multi-tenant system, operating costs will increase materially and proportionally. This is the natural and expected trajectory of a high-growth SaaS business.</p>
    <h3>Categories of Anticipated Cost Growth</h3>
    <ul className="dot-list">
      <li><strong>Personnel.</strong> The $10,100/month baseline includes modest compensation for the Managing Partner, Chief Technology Engineer, and three offshore engineers. As the Company generates sustainable revenue, compensation will scale to market rates for each role, and additional engineers, a U.S.-based sales lead, and support staff will be added. Personnel costs are the single largest variable and will grow significantly as the platform matures.</li>
      <li><strong>Infrastructure.</strong> Server, database, and cloud costs scale directly with the number of active client organizations and data volume processed. Multi-region deployment, read replicas, and enterprise-grade uptime infrastructure will materially increase hosting costs beyond current baseline figures.</li>
      <li><strong>AI and API Usage.</strong> Third-party AI API costs and communication platform costs (Twilio, iMessage, WhatsApp) are usage-based and will increase in direct proportion to outreach volume and client count.</li>
      <li><strong>Compliance and Security.</strong> SOC2 certification, ongoing legal counsel, security audits, and regulatory compliance costs will grow as the Company pursues enterprise contracts requiring institutional-grade data governance.</li>
    </ul>
    <h3>Invested Capital vs. Recurring Operating Costs: A Critical Distinction</h3>
    <div className="twin-boxes">
      <div className="twin-box">
        <span className="twin-box-title">(a) Invested Capital · Use of Proceeds ($500,000 raise)</span>
        <p>The $500,000 raised through this Offering is growth capital — a one-time injection used to fund the enterprise migration, customer acquisition, and first-year personnel costs while revenue scales to self-sustaining levels. The $107,400 first-year personnel allocation in the Use of Proceeds is not a recurring operating expense; it is investor capital bridging the team during the critical build-out phase. Once platform revenue covers payroll, that cost transitions from Invested Capital to an Operating Cost funded by the business. Investors should not conflate the one-time deployment of their capital with the Company's ongoing cost structure.</p>
      </div>
      <div className="twin-box">
        <span className="twin-box-title">(b) Recurring Operating Costs · Funded from Revenue</span>
        <p>The $10,100/month in the cost schedule is the stabilized platform burn rate at current scale. This will grow as revenue grows. Investors should expect that as the Company scales toward 250 and then 2,000 paying organizations, monthly operating costs may reach $50,000 to $200,000+ per month, reflecting a much larger and more sophisticated operation. The Managing Partner will manage cost growth to maintain positive unit economics at every stage.</p>
      </div>
    </div>
    <h3>Distribution Threshold as Costs Scale</h3>
    <p>The $20,000/month MRR Distribution Threshold is calibrated to today's cost structure. As operating costs grow with the platform, the Managing Partner retains authority to adjust the operational reserve retained before distributions are made, ensuring growth is never starved by premature profit-sharing. The economic intent remains constant: protect operational integrity first, then share profits. An updated operating cost schedule will be provided annually via the Investor Portal.</p>
    <div className="callout">
      <p>Investors are strongly urged to read this section in conjunction with the Risk Factors section of this Memorandum.</p>
    </div>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 8</span>
  </div>
</div>

{/* PAGE 9 — HOW TO SUBSCRIBE */}
<div className="page" id="p9">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span>
    <span className="page-num">Page 9</span>
  </div>
  <div className="page-body">
    <div className="section-label">How to Subscribe</div>
    <h3>Subscribing Via Email</h3>
    <p>Download the fillable Subscription document and Investor Questionnaire inside the Investor Portal. Save the PDF, print and sign the PDF and return it via email to: <strong>Investors@rosieai.tech</strong></p>
    <h3>Using SignNow</h3>
    <p>If you wish to subscribe via SignNow, please request documents in the investor portal. We will need your email address, vesting name, and full address. We will send you an encrypted, secure link via SignNow where you will be able to digitally fill in your Subscription Documents and Investor Questionnaire. Once you have electronically signed, the Managing Partner will counter-sign once funds are received.</p>
    <p>You can also request a DocuSign inside the Investor Portal.</p>
    <h3>Investor Portal Access</h3>
    <p>Your subscription documents, investor questionnaire, capital contribution confirmation, and all other related documents for your subscription will reside at our Investor Portal, which grants you 24/7 access to information regarding your account.</p>
    <div className="info-box" style="margin-top:20px;text-align:center;">
      <div className="info-box-title">Investor Portal URL</div>
      <p style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--navy);font-weight:500;">https://investors.rosieai.tech/portal</p>
    </div>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 9</span>
  </div>
</div>

{/* PAGE 10 — INTENTIONALLY BLANK */}
<div className="page" id="p10">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span>
    <span className="page-num">Page 10</span>
  </div>
  <div className="page-body" style="display:flex;align-items:center;justify-content:center;flex:1;">
    <span style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;color:var(--gray-400);text-transform:uppercase;">This Page Left Intentionally Blank</span>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 10</span>
  </div>
</div>

{/* PAGE 11 — INTRODUCTION */}
<div className="page" id="p11">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Introduction</span>
    <span className="page-num">Page 11</span>
  </div>
  <div className="page-body">
    <div className="section-label">Rosie AI, LLC · Introduction</div>
    <h3>Who We Are</h3>
    <p>Originally organized to solve the systemic inefficiencies in the global sales and marketing stack, the team at Rosie AI, LLC realized that their collective competencies in AI orchestration, data engineering, and autonomous systems were best suited to address industry challenges relating to lead discovery, intent scoring, and outbound execution.</p>
    <p>The identified challenges — rising Customer Acquisition Costs (CAC), declining conversion rates, and stale data — are the core opportunities addressed by this program.</p>
    <p>Rosie AI is a high-leverage technology company engineered to replace legacy SDR (Sales Development Representative) infrastructure with a fully autonomous, production-ready revenue engine. For purposes of this offering, the Company operates as a unified Wyoming LLC focused on the following core pillars:</p>
    <ul className="dot-list">
      <li><strong>The Technical Engine:</strong> A distributed SaaS platform composed of 150+ backend functions, 136 data entities, and 11 queue systems. The system is built on a modern stack including React 18, Deno Edge Functions, and Supabase.</li>
      <li><strong>The Discovery Ecosystem:</strong> Seven active, real-time ingestion pipelines that monitor social signals (Reddit, YouTube, X), professional shifts (LinkedIn), and high-alpha real-world data (municipal and utility permits).</li>
      <li><strong>The Execution Layer:</strong> An autonomous outreach system utilizing iMessage, WhatsApp, and AI-driven voice agents at a 7x cost advantage over traditional telephony.</li>
    </ul>
    <h3>What We Have Proven True</h3>
    <p>Not all lead data is equal. In the modern sales environment, "stale" database access is a liability. After architecting a system that detects live intent and qualifies it with 91%+ AI scoring accuracy, Rosie AI has proven that autonomous agents can outperform human SDR teams at a fraction of the cost.</p>
    <p>Our high-leverage operational model — pairing U.S.-based leadership with a specialized offshore engineering unit — achieves a 92% cost saving compared to traditional venture-backed software firms.</p>
    <h3>What's Next</h3>
    <p>Rosie AI is now positioned to deploy USD $500,000 to fund the migration from our currently functional production build to an enterprise-ready, multi-tenant system. This transition will enable the platform to support thousands of concurrent organizations with 99.99% uptime.</p>
    <p>By hardening our "self-healing" infrastructure and expanding our proprietary permit data pipelines, we provide B2B organizations and contractors the processing power and AI intelligence necessary to increase sales velocity and scale revenue without increasing headcount.</p>
    <p>Rosie AI, LLC was formed as a Wyoming Limited Liability Company, established specifically for the purpose of developing, deploying, and scaling the Rosie AI orchestration platform and its associated revenue-generation technologies.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 11</span>
  </div>
</div>

{/* PAGE 12 — UNIQUE POSITIONING */}
<div className="page" id="p12">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Unique Positioning</span>
    <span className="page-num">Page 12</span>
  </div>
  <div className="page-body">
    <div className="section-label">Unique Positioning</div>
    <h3>The Sales Inefficiency Crisis</h3>
    <p>The global B2B sales stack is facing a structural breaking point. Traditional outreach models — relying on human SDRs, manual dialing, and cold emailing — are seeing a sharp decline in effectiveness. As Customer Acquisition Costs (CAC) continue to rise, legacy systems are failing to provide the ROI required for modern enterprise growth. Rosie AI addresses this by replacing high-overhead human workflows with autonomous AI agents, reducing the cost of sales execution by over 90%.</p>
    <h3>The Death of Static Data</h3>
    <p>The value of traditional lead databases (such as ZoomInfo or Apollo) is eroding due to "data decay." Static records often have a staleness rate exceeding 40% within the first six months. Rosie AI shifts the paradigm from Static Data to Real-Time Signal Ingestion. By monitoring live intent signals — including municipal permit filings, professional shifts, and social pain points — the platform identifies high-intent leads at the exact moment of need, ensuring a "first-mover" advantage that static databases cannot replicate.</p>
    <h3>A High-Alpha, Tech-Enabled Asset</h3>
    <p>Rosie AI represents a non-correlated technological asset designed to deliver stable returns irrespective of broad market volatility. Unlike traditional SaaS companies with bloated domestic headcounts, Rosie AI utilizes a high-leverage offshore engineering model that maintains a lean burn rate while delivering enterprise-grade output. This operational efficiency creates a "technical alpha" where the platform's performance is driven by proprietary pipeline intelligence (such as the Permit Data Pipeline) rather than fluctuating market sentiment or ad-spend cycles.</p>
    <h3>Operational Resilience &amp; Scalability</h3>
    <p>The Company limits exposure and manages risk by deploying its AI orchestration across diverse verticals, including Solar, Roofing, and SaaS. By utilizing "self-healing" infrastructure and multi-model AI routing, Rosie AI ensures that its autonomous revenue engine remains operational and effective even as individual platform policies or data sources evolve. This positioning allows for a scalable, multi-tenant subscription model that provides predictable recurring revenue and significant asset appreciation for the investor class.</p>
    <div className="stat-row" style="margin-top:20px;">
      <div className="stat-card"><span className="stat-val">91%+</span><span className="stat-label">AI Scoring Accuracy</span></div>
      <div className="stat-card"><span className="stat-val">92%</span><span className="stat-label">Cost Saving vs. US Firms</span></div>
      <div className="stat-card"><span className="stat-val">$300B+</span><span className="stat-label">Total Addressable Market</span></div>
    </div>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 12</span>
  </div>
</div>

{/* PAGE 13 — OPERATIONAL RESILIENCE (CONT.) */}
<div className="page" id="p13">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Unique Positioning (Continued)</span>
    <span className="page-num">Page 13</span>
  </div>
  <div className="page-body">
    <div className="section-label">Operational Resilience &amp; Scalability</div>
    <p>The Company limits exposure and manages risk by deploying its AI orchestration across diverse verticals, including Solar, Roofing, and SaaS. By utilizing "self-healing" infrastructure and multi-model AI routing, Rosie AI ensures that its autonomous revenue engine remains operational and effective even as individual platform policies or data sources evolve. This positioning allows for a scalable, multi-tenant subscription model that provides predictable recurring revenue and significant asset appreciation for the investor class.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 13</span>
  </div>
</div>

{/* PAGE 14 — LEADERSHIP & SYSTEM ARCHITECTS */}
<div className="page" id="p14">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Leadership and System Architects</span>
    <span className="page-num">Page 14</span>
  </div>
  <div className="page-body">
    <div className="section-label">Rosie AI, LLC · Leadership and System Architects</div>
    <p>The Company's operational structure is engineered for Extreme Capital Efficiency. By pairing senior U.S.-based strategic leadership with a specialized offshore engineering unit, Rosie AI delivers enterprise-grade software execution at a 92% cost saving compared to traditional venture-backed startups.</p>
    <p>For an in-depth discussion regarding our multi-tenant architecture, AI orchestration pipelines, and proprietary data ingestion systems, please refer to the Rosie AI Technical Appendix &amp; Platform Audit.</p>
    <ul className="dot-list">
      <li>Rosie AI, LLC · Sponsor, Manager, and Platform Architect.</li>
      <li>The Engineering Unit (PH) · Integrated Execution Layer (Backend, Frontend, and Integrations).</li>
    </ul>
    <h3>Core Leadership</h3>
    <div className="callout" style="margin-bottom:12px;">
      <p><strong>Stephani Scheidt | Managing Partner</strong><br />Stephani leads the Company's B2B revenue engine and strategic growth initiatives. With a focus on high-intent prospecting and SaaS recurring revenue optimization, she orchestrates the full-cycle sales engine — from initial lead discovery via the Rosie AI platform to closing high-value enterprise contracts. Her expertise lies in cultivating strategic alliances and managing high-performance external teams to scale market penetration without increasing fixed overhead.</p>
    </div>
    <div className="callout navy">
      <p><strong>Chief Technology Engineer</strong><br />Our CTE is the primary architect of the Rosie AI "v6 Engine." He oversees the development of the 150+-function backend and the 136-entity data model. His responsibilities include implementing SOC2-compliant data isolation protocols, architecting elastic infrastructure for high-concurrency workloads, and managing the multi-model LLM orchestration layer. Zhang bridges the gap between startup agility and corporate stability through robust API integrations and "self-healing" system logic.</p>
    </div>
    <h3>Specialized Engineering Unit (Philippines)</h3>
    <p>The Company's technical execution is powered by a specialized offshore unit, each role mapped directly to critical system components. This team delivers world-class output at a fraction of typical startup costs, with a total engineering team cost of <strong>$8,950/month</strong>.</p>
    <ul className="dot-list">
      <li><strong>PH · Backend Engineer (Pipeline Architecture):</strong> Responsible for building secure, type-safe server-side applications using Deno and TypeScript. Focuses on scalable PostgreSQL management via Supabase and the design of robust background processing queues to handle high-volume data ingestion.</li>
      <li><strong>PH · Frontend Engineer (UI / UX Development):</strong> Architects interactive, component-based interfaces using React 18. Focuses on creating high-performance, real-time analytics dashboards and campaign management tools that allow enterprise clients to visualize lead intelligence and conversion metrics.</li>
      <li><strong>PH · Integrations Engineer (APIs &amp; Data Pipeline):</strong> The "glue" of the tech stack. Develops custom web scrapers and automation actors via Apify to extract high-quality data at scale. Manages the enrichment waterfall (Apollo/Hunter) and ensures real-time data synchronization across all outreach channels.</li>
    </ul>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 14</span>
  </div>
</div>

{/* PAGE 15 — LEADERSHIP CONT. */}
<div className="page" id="p15">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Leadership and System Architects (Cont.)</span>
    <span className="page-num">Page 15</span>
  </div>
  <div className="page-body">
    <div className="section-label">Rosie AI, LLC · Leadership and System Architects (Cont.)</div>
    <h3>Revenue and Growth Execution</h3>
    <p>The Company maintains a lean "Home Office" leadership core that supervises the automated outbound pipelines. These pipelines are specifically designed to target high-alpha verticals — such as Solar, Roofing, and SaaS — where the platform's real-time intent detection (e.g., municipal permit scraping) provides a significant competitive advantage over static lead providers.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 15</span>
  </div>
</div>

{/* PAGE 16 — ORGANIZATIONAL CHART */}
<div className="page" id="p16">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Organizational Chart</span>
    <span className="page-num">Page 16</span>
  </div>
  <div className="page-body">
    <div className="section-label">Rosie AI, LLC · Organizational Chart</div>
    <p>This organizational structure is designed for Extreme Capital Efficiency, bridging strategic U.S. leadership with a specialized technical execution layer in the Philippines.</p>
    {/* Org Chart */}
    <div style="display:flex;flex-direction:column;align-items:center;gap:0;margin:18px 0;">
      <div style="background:var(--navy);color:#fff;border-radius:2px;padding:10px 24px;text-align:center;min-width:180px;">
        <strong style="color:var(--gold);display:block;font-size:11px;">Stephani Scheidt</strong>
        <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:rgba(255,255,255,.6);">Managing Partner</span>
      </div>
      <div style="width:1px;height:20px;background:var(--navy);"></div>
      <div style="background:var(--navy-light);color:#fff;border-radius:2px;padding:10px 24px;text-align:center;min-width:180px;">
        <strong style="display:block;font-size:11px;">Chief Technology Engineer</strong>
      </div>
      <div style="width:1px;height:20px;background:var(--navy);"></div>
      {/* horizontal connector */}
      <div style="display:flex;gap:0;position:relative;width:100%;justify-content:center;">
        <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:60%;height:1px;background:var(--navy);"></div>
      </div>
      <div style="display:flex;gap:14px;margin-top:1px;">
        <div style="border:1.5px solid var(--navy);border-radius:2px;padding:8px 12px;text-align:center;min-width:140px;">
          <strong style="display:block;font-size:10px;color:var(--navy);">Backend Engineer</strong>
          <span style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--gray-400);">Deno / TS / Supabase</span>
        </div>
        <div style="border:1.5px solid var(--navy);border-radius:2px;padding:8px 12px;text-align:center;min-width:140px;">
          <strong style="display:block;font-size:10px;color:var(--navy);">Frontend Engineer</strong>
          <span style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--gray-400);">React 18 / Tailwind</span>
        </div>
        <div style="border:1.5px solid var(--navy);border-radius:2px;padding:8px 12px;text-align:center;min-width:140px;">
          <strong style="display:block;font-size:10px;color:var(--navy);">Integrations Engineer</strong>
          <span style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--gray-400);">Apify / APIs / Webhooks</span>
        </div>
      </div>
      <div style="width:1px;height:20px;background:var(--navy);"></div>
      <div style="display:flex;gap:14px;">
        <div style="background:var(--gray-100);border:1px solid var(--gray-200);border-radius:2px;padding:8px 12px;text-align:center;min-width:140px;">
          <strong style="display:block;font-size:10px;color:var(--navy);">Base44</strong>
          <span style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--gray-400);">Investor Portal</span>
        </div>
        <div style="background:var(--gray-100);border:1px solid var(--gray-200);border-radius:2px;padding:8px 12px;text-align:center;min-width:140px;">
          <strong style="display:block;font-size:10px;color:var(--navy);">OpenAI</strong>
          <span style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--gray-400);">AI Orchestration</span>
        </div>
        <div style="background:var(--gray-100);border:1px solid var(--gray-200);border-radius:2px;padding:8px 12px;text-align:center;min-width:140px;">
          <strong style="display:block;font-size:10px;color:var(--navy);">ChainWave Studios</strong>
          <span style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--gray-400);">Automation &amp; Brand</span>
        </div>
      </div>
    </div>
    <h3>Role Descriptions</h3>
    <p><strong>1. Executive Leadership</strong></p>
    <ul className="dot-list">
      <li><strong>Stephani Scheidt | Managing Partner:</strong> Focus: B2B Sales Engine, Partnership Cultivation, and SaaS Revenue Optimization. Mandate: Driving market penetration and managing high-value enterprise contracts.</li>
      <li><strong>Chief Technology Engineer:</strong> Focus: "v6 Engine" Architecture, AI Orchestration, and Enterprise Security. Mandate: Oversight of the 150+-function backend and maintaining SOC2-compliant data isolation.</li>
    </ul>
    <p><strong>2. Technical Execution Layer (Philippines)</strong></p>
    <ul className="dot-list">
      <li><strong>Backend Engineer:</strong> Responsible for type-safe pipeline architecture and scalable PostgreSQL management.</li>
      <li><strong>Frontend Engineer:</strong> Focuses on the React 18 dashboard, ensuring lightning-fast data visualization for enterprise clients.</li>
      <li><strong>Integrations Engineer:</strong> The "glue" of the system — building custom scrapers and orchestrating lead enrichment workflows.</li>
    </ul>
    <p><strong>3. Supporting Vendors</strong></p>
    <ul className="dot-list">
      <li><strong>Base44:</strong> Powers the Rosie AI Investor Portal — providing secure document storage, investor dashboards, and account management infrastructure.</li>
      <li><strong>OpenAI:</strong> Core AI orchestration layer powering the autonomous intent scoring, voice agents, and multi-model outreach capabilities of the "v6 Engine."</li>
      <li><strong>ChainWave Studios LLC:</strong> ChainWave has been contracted to help create scalable automation. ChainWave delivers end-to-end digital services that strengthen your brand and has a professional team that aims to produce meaningful results.</li>
    </ul>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 16</span>
  </div>
</div>

{/* PAGE 17 — CAPITALIZATION AND MANAGEMENT */}
<div className="page" id="p17">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Capitalization and Management</span>
    <span className="page-num">Page 17</span>
  </div>
  <div className="page-body">
    <div className="section-label">Rosie AI, LLC · Capitalization and Management</div>
    <h3>Capitalization Summary</h3>
    <p>The Company has an authorized capitalization of 10,000,000 total Units, structured to provide clear separation between operational control and economic participation.</p>
    <div className="kv-grid">
      <span className="kv-key">Total Authorized Units</span><span className="kv-val">10,000,000</span>
      <span className="kv-key">Class A Units (Voting)</span><span className="kv-val">7,850,000 (6,850,000 Stephani Scheidt + 1,000,000 Equity Pool)</span>
      <span className="kv-key">Class B Units (Non-Voting/Investor)</span><span className="kv-val">2,150,000 (includes 150,000 Bonus Round units)</span>
    </div>
    <div className="donut-wrap">
      <svg className="donut" width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r="40" fill="none" stroke="#e8e6e0" stroke-width="20"/>
        <circle cx="55" cy="55" r="40" fill="none" stroke="#1a2744" stroke-width="20"
          stroke-dasharray="199.8 51.5" stroke-dashoffset="0" transform="rotate(-90 55 55)"/>
        <circle cx="55" cy="55" r="40" fill="none" stroke="#D4AF37" stroke-width="20"
          stroke-dasharray="51.5 199.8" stroke-dashoffset="-199.8" transform="rotate(-90 55 55)"/>
        <text x="55" y="50" text-anchor="middle" font-size="11" font-family="'Playfair Display',serif" font-weight="700" fill="#1a2744">78.5%</text>
        <text x="55" y="63" text-anchor="middle" font-size="7" font-family="'JetBrains Mono',monospace" fill="#666">Class A</text>
      </svg>
      <div className="chart-legend">
        <div className="legend-item"><div className="legend-dot" style="background:var(--navy)"></div><span>Class A Units — 7,850,000 (78.5%) — Founders &amp; Management</span></div>
        <div className="legend-item"><div className="legend-dot" style="background:var(--gold)"></div><span>Class B Units — 2,150,000 (21.5%) — Investors (this Offering)</span></div>
      </div>
    </div>
    <h3>Management &amp; Governance</h3>
    <p>The business and operations of the Company are directed by its leadership team based in Sheridan, Wyoming. Unlike traditional management structures, Rosie AI is led by a high-leverage duo focused on technical excellence and market expansion.</p>
    <p><strong>Stephani Scheidt | Managing Partner</strong><br />Stephani Scheidt serves as the Managing Partner, responsible for the overarching business strategy, B2B revenue generation, and strategic alliances. Under her leadership, the Company executes its "Discovery to Conversion" model, ensuring that the platform's autonomous capabilities translate into high-value enterprise contracts and sustainable growth.</p>
    <p><strong>Chief Technology Engineer</strong><br />The Chief Technology Engineer is responsible for the development and maintenance of the "v6 Engine," including its 150+ backend functions and 136-entity data model, enterprise risk management, SOC2-compliant data isolation, and the continuous integration of multi-model AI orchestration.</p>
    <h3>Membership Unit Classes</h3>
    <p><strong>Class A Membership Units (7,850,000 Units total · 6,850,000 held by Managing Partner + 1,000,000 Equity Pool)</strong><br />The Chief Technology Engineer is responsible for the development and maintenance of the "v6 Engine," including its 150+ backend functions and 136-entity data model. This role oversees enterprise risk management, SOC2-compliant data isolation, and the continuous integration of multi-model AI orchestration.</p>
    <h3>Authority and Control</h3>
    <p>Except as otherwise specifically provided in the Operating Agreement, no Member other than the Managing Partner or designated leadership shall have any voice in, or take any part in, the management of the business. The leadership team has the right, power, and authority to act on behalf of the Company in all matters pursuant to the Wyoming Limited Liability Company Act.</p>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 17</span>
  </div>
</div>

{/* PAGE 18 — FIDUCIARY RESPONSIBILITIES */}
<div className="page" id="p18">
  <div className="page-header">
    <span className="doc-title">Rosie AI, LLC — Fiduciary Responsibilities</span>
    <span className="page-num">Page 18</span>
  </div>
  <div className="page-body">
    <div className="section-label">Fiduciary Responsibilities of the Managing Partner</div>
    <p>Under Wyoming law, the fiduciary duties of a Managing Partner to a limited liability company and to its Members are characterized by the obligation of good faith and fair dealing. Accordingly, the Managing Partner is accountable to Rosie AI, LLC as a fiduciary, which means they are required to exercise integrity and sound judgment with respect to company affairs.</p>
    <p>This fiduciary duty is in addition to those other duties, obligations, and limitations of the Managing Partner as set forth in our Operating Agreement. Our Operating Agreement provides that our Managing Partner and leadership team shall have no liability for losses resulting from errors in judgment or other acts or omissions, unless they are guilty of intentional misconduct, fraud, or a knowing violation of the law.</p>
    <p>Our Operating Agreement also provides that the Company will indemnify the Managing Partner and Chief Technology Engineer against liability and related expenses incurred in dealing with members, third parties, or the Company, provided no intentional misconduct or fraud is involved. Therefore, investors may have a more limited right of action than they would have absent these provisions. Investors who believe that a breach of fiduciary duty has occurred should consult with their own counsel.</p>
    <h3>Rosie AI, LLC Systems Introduction</h3>
    <ul className="dot-list">
      <li>Rosie AI began as a specialized project to solve the structural crisis in B2B sales development. By architecting a multi-pipeline engine, the team has created a unique opportunity for sourcing, scoring, and converting high-intent leads autonomously.</li>
      <li>Our business model is built on Autonomous Revenue Generation. Specifically, we deploy, manage, and scale AI orchestration pipelines that replace manual SDR (Sales Development Representative) functions across high-alpha verticals.</li>
      <li>We offer investors economic participation in a High-Leverage SaaS Model, utilizing a waterfall profit-sharing structure designed for rapid capital efficiency.</li>
      <li>Our clients consist of fully vetted B2B organizations and contractors in the Solar, Roofing, and SaaS sectors who require real-time intent detection to maintain a competitive edge.</li>
      <li>Our core assets are Proprietary Lead Intelligence Pipelines, evidenced by real-time municipal permit ingestion, social signal extraction (Reddit/YouTube/X), and professional intent triggers.</li>
      <li>Traditional sales cycles suffer from "Data Decay" and high human overhead. Rosie AI capitalizes on this by providing Autonomous Outreach via iMessage, WhatsApp, and AI voice, resulting in a 7x cost advantage over legacy telephony pricing.</li>
      <li>The Company utilizes a Hybrid Global Team Model, pairing senior U.S. leadership with a specialized Philippines-based engineering unit, delivering a 92% cost saving compared to traditional domestic tech startups.</li>
      <li>Our 150+ backend functions and 136 data entities allow the platform to function as a "self-healing" system, ensuring 99.99% uptime for enterprise-grade deployments.</li>
      <li>By supplying consistent, high-accuracy lead flow and automated conversion, Rosie AI enables its clients to generate higher operational profits while the Company builds long-term, scalable recurring revenue.</li>
    </ul>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 18</span>
  </div>
</div>

{/* PAGE 19 — INTENTIONALLY BLANK */}
<div className="page" id="p19">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Confidential Private Placement Memorandum</span><span className="page-num">Page 19</span></div>
  <div className="page-body" style="display:flex;align-items:center;justify-content:center;flex:1;"><span style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;color:var(--gray-400);text-transform:uppercase;">This Page Left Intentionally Blank</span></div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 19</span></div>
</div>

{/* PAGE 20 — RISK MANAGEMENT & EXIT STRATEGY */}
<div className="page" id="p20">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Investment Risk Management &amp; Exit Strategy</span><span className="page-num">Page 20</span></div>
  <div className="page-body">
    <div className="section-label">Investment Risk Management: Risk Management and Exit Strategy</div>
    <h3>Pipeline and Intelligence Risk</h3>
    <p><strong>Rigorous Signal Vetting:</strong> Lead discovery is divided into three layers of verification:</p>
    <ul className="dot-list">
      <li><strong>Source Integrity:</strong> Real-time ingestion from primary sources (municipal permits, social APIs, professional triggers).</li>
      <li><strong>AI Intent Scoring:</strong> Multi-model classification with a 91%+ accuracy benchmark to filter "noise" from actionable signals.</li>
      <li><strong>Enrichment Verification:</strong> Waterfall data enrichment (Apollo/Hunter) to ensure identity and contact deliverability.</li>
    </ul>
    <h3>Systemic and Execution Risk</h3>
    <ul className="dot-list">
      <li><strong>Infrastructure Resilience:</strong> Migration to an enterprise-ready, multi-tenant system with a target of 99.99% uptime.</li>
      <li><strong>API Redundancy:</strong> Mitigating "Concentration Risk" by utilizing multi-model AI routing (OpenAI, Anthropic, Gemini, Groq) and diverse communication providers (Twilio, SendGrid, iMessage).</li>
      <li><strong>Self-Healing Logic:</strong> Automated retry systems and queue recovery for the 150+ backend functions to prevent data loss during high-concurrency workloads.</li>
      <li><strong>High-Leverage Engineering:</strong> Utilizing a specialized offshore unit to maintain a 92% cost saving, extending the Company's runway.</li>
    </ul>
    <h3>Capital and Distribution Risk</h3>
    <ul className="dot-list">
      <li><strong>Profit Waterfall Model:</strong> Unlike fixed-rate debt, the Company utilizes a net-profit waterfall. Distributions are triggered once the platform exceeds its operational break-even point ($10,100/month — approximately 15 paying organizations at $700 avg MRR).</li>
      <li><strong>Equity Appreciation:</strong> Investors hold 21.5% of the Company, positioning them for capital appreciation as the platform scales toward its target of 2,000 paying organizations by end of 2028.</li>
      <li><strong>Scalable Subscription Revenue:</strong> The multi-tenant SaaS model creates predictable, recurring cash flow across Solar, Roofing, and SaaS verticals. Projected blended ARR: $3.33M by end of 2027 and $27.5M by end of 2028.</li>
    </ul>
    <h3>Compliance and AI Governance</h3>
    <ul className="dot-list">
      <li><strong>Data Privacy:</strong> Implementing SOC2-compliant data isolation, Row-Level Security (RLS) via Supabase, and end-to-end encryption for enterprise assets.</li>
      <li><strong>Carrier Compliance:</strong> Proactive monitoring of communication platform policies (iMessage/WhatsApp) to ensure high deliverability and bypass automated spam filters.</li>
    </ul>
    <h3>Exit Strategy</h3>
    <ul className="dot-list">
      <li><strong>Net Profit Distributions:</strong> Ongoing participation in the Company's monthly waterfall split as the platform scales.</li>
      <li><strong>Strategic Acquisition:</strong> The Company operates in a Total Addressable Market (TAM) exceeding $300B. The exit pathway is focused on a strategic buyout by major CRM or Sales Automation incumbents (e.g., Salesforce, HubSpot, or ZoomInfo) seeking Rosie's proprietary real-time intent pipelines.</li>
      <li><strong>Secondary Market Potential:</strong> As an enterprise-grade SaaS platform with high-margin recurring revenue, the Company's equity units represent a liquidable asset class within private technology secondary markets.</li>
      <li><strong>Reinvestment Option:</strong> Investors may have the opportunity to roll distributions into future technical expansions or adjacent high-alpha AI pipelines.</li>
    </ul>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 20</span></div>
</div>

{/* PAGE 21 — TERMS OF THE OFFERING */}
<div className="page" id="p21">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Terms of the Offering</span><span className="page-num">Page 21</span></div>
  <div className="page-body">
    <div className="section-label">Terms of the Offering</div>
    <p>We are offering on a best-efforts basis Class B Membership Units for a total offering amount of $500,000. These units represent a <strong>21.5% ownership stake</strong> in the Company upon full subscription.</p>
    <p>No minimum amount of capital must be raised in this Offering before we can access the proceeds. The proceeds will be deployed immediately to fund the migration to an enterprise-ready multi-tenant system and to scale the autonomous discovery pipelines. The Offering will commence as of the date of this Memorandum and will terminate upon the earlier of: (a) the sale of all the Units, or (b) the termination date which shall be twenty-four (24) months from the date of this Memorandum (the "Termination Date"), unless otherwise extended in the sole discretion of the Managing Partner. The funds will be returned to Investors whose subscriptions are not accepted by the Termination Date (or extended Termination Date), without interest or deduction.</p>
    <p>Prospective Investors should consult their own tax and legal counsel regarding the suitability of an investment. Each Investor will be required to represent that the Units are being acquired for investment only and not with a view toward the resale or distribution thereof and will not be re-sold or distributed in violation of the Securities Act or any other applicable securities law. No transfer of any Units by an Investor will be effective unless adequate assurance is received by us that no violation of the Securities Act or any other applicable securities law will occur by reason of such transfer. The investment will be illiquid and is suitable only for persons of adequate financial means who have no need for liquidity with respect to the investment and who are able to bear the economic risk of complete loss of the investment. Any proposed transferee of Units from an Investor hereunder will be required to provide us with written representations like those required of Investors hereunder.</p>
    <p>The suitability standards herein represent minimum suitability requirements for a prospective Investor and the satisfaction of such standards by a prospective Investor does not necessarily mean that the purchase of Securities is a suitable investment for them. We reserve the right to refuse a subscription if, in our discretion, we believe that the prospective Investor does not meet the suitability requirements or that the purchase of Securities is otherwise an unsuitable investment for the prospective Investor.</p>
    <p>We have the absolute right, in our sole discretion, to accept or refuse any subscription. We will rely on the accuracy of each prospective Investor's representations as set forth in the documents to be executed by a prospective Investor in connection with their purchase of Securities — specifically through the Rosie AI Investor Portal. We may require additional evidence that a prospective Investor meets the standards set forth above at any time prior to acceptance of a prospective Investor's subscription. A prospective Investor is not obligated to supply any information so requested by us, but we may reject a subscription from any prospective Investor who fails to supply any information so requested.</p>
    <p>Subject to independent verification pursuant to applicable law, we will rely on the accuracy of each prospective Investor's representations. If our belief as to the suitability of a prospective Investor is incorrect in any instance, then the delivery of this Memorandum shall not be deemed to be an offer to that person to invest in us and such prospective Investor shall, after notice from us, immediately return this Memorandum to us.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 21</span></div>
</div>

{/* PAGE 22 — CLASS B UNIT OFFERING STRUCTURE & BONUS ROUND */}
<div className="page" id="p22">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Class B Unit Offering Structure &amp; Bonus Round</span><span className="page-num">Page 22</span></div>
  <div className="page-body">
    <div className="section-label">Unit Structure, Pricing &amp; Bonus Round Details</div>
    <p>The Company has 10,000,000 total authorized Units of membership interest. Of these, 2,150,000 are Class B Units being offered to investors in this Offering, representing 21.5% of the Company. The remaining 7,850,000 Units are Class A Units — 6,850,000 held by Managing Partner Stephani Scheidt and 1,000,000 reserved for future equity partners and key employees. The Class B Offering is structured in two components: a paid tranche and a bonus tranche.</p>
    <div className="twin-boxes">
      <div className="twin-box">
        <span className="twin-box-title">Paid Class B Units</span>
        <div className="kv-grid" style="grid-template-columns:auto 1fr;gap:3px 10px;">
          <span className="kv-key" style="font-size:9px;">Units Offered</span><span className="kv-val" style="font-size:10.5px;">2,000,000</span>
          <span className="kv-key" style="font-size:9px;">Price Per Unit</span><span className="kv-val" style="font-size:10.5px;">$0.25 / unit</span>
          <span className="kv-key" style="font-size:9px;">Total Raise</span><span className="kv-val" style="font-size:10.5px;color:var(--gold);font-weight:600;">$500,000 USD</span>
          <span className="kv-key" style="font-size:9px;">Ownership</span><span className="kv-val" style="font-size:10.5px;">21.5% (all Class B)</span>
          <span className="kv-key" style="font-size:9px;">Min Investment</span><span className="kv-val" style="font-size:10.5px;">$15,000</span>
          <span className="kv-key" style="font-size:9px;">Votes</span><span className="kv-val" style="font-size:10.5px;">None</span>
        </div>
      </div>
      <div className="twin-box">
        <span className="twin-box-title">Bonus Round Units</span>
        <div className="kv-grid" style="grid-template-columns:auto 1fr;gap:3px 10px;">
          <span className="kv-key" style="font-size:9px;">Bonus Pool</span><span className="kv-val" style="font-size:10.5px;">150,000 units</span>
          <span className="kv-key" style="font-size:9px;">Triggers</span><span className="kv-val" style="font-size:10.5px;">First $150,000 raised</span>
          <span className="kv-key" style="font-size:9px;">Rate</span><span className="kv-val" style="font-size:10.5px;">1,000 bonus units per $1,000 invested</span>
          <span className="kv-key" style="font-size:9px;">Cost Basis</span><span className="kv-val" style="font-size:10.5px;">$0 additional cost</span>
          <span className="kv-key" style="font-size:9px;">Effect</span><span className="kv-val" style="font-size:10.5px;">Lowers investor's avg cost per unit</span>
        </div>
      </div>
    </div>
    <h3>How the Bonus Round Works</h3>
    <p>The first $150,000 of subscriptions received in this Offering constitutes the "Bonus Round." During the Bonus Round, every investor who subscribes receives 1,000 additional Class B Units for every $1,000 invested, at no additional cost. These 150,000 Bonus Units are drawn from the 2,150,000 total Class B Units and are pre-allocated as the Bonus Pool. They do not represent additional units beyond the authorized offering — they are part of it.</p>
    <div className="callout"><p><strong>Accounting Treatment of Bonus Units:</strong> Bonus Round units carry no separate purchase price. For accounting and tax purposes, the investor's total cost basis is allocated across all units received (paid + bonus), which lowers the average cost per unit but does not change the dollar amount paid. The buy-in cost is fixed at $0.25/unit on the paid tranche only.</p></div>
    <h3>Bonus Round Illustration</h3>
    <table>
      <thead><tr><th>Investment</th><th>Paid Units @ $0.25</th><th>Bonus Units</th><th>Total Units</th><th>Avg Cost/Unit</th><th>Ownership %</th></tr></thead>
      <tbody>
        <tr><td>$15,000</td><td>60,000</td><td>15,000</td><td>75,000</td><td>$0.200</td><td>0.75%</td></tr>
        <tr><td>$25,000</td><td>100,000</td><td>25,000</td><td>125,000</td><td>$0.200</td><td>1.25%</td></tr>
        <tr><td>$50,000</td><td>200,000</td><td>50,000</td><td>250,000</td><td>$0.200</td><td>2.50%</td></tr>
        <tr><td>$100,000</td><td>400,000</td><td>100,000</td><td>500,000</td><td>$0.200</td><td>5.00%</td></tr>
        <tr style="background:#1a2744;color:#fff;"><td><strong style="color:#D4AF37">$150,000</strong></td><td><strong style="color:#fff">600,000</strong></td><td><strong style="color:#fff">150,000</strong></td><td><strong style="color:#D4AF37">750,000</strong></td><td><strong style="color:#fff">$0.200</strong></td><td><strong style="color:#D4AF37">7.50%</strong></td></tr>
      </tbody>
    </table>
    <p style="font-size:9px;color:var(--gray-400);">Note: Bonus Round closes automatically once aggregate Bonus Round subscriptions reach $150,000. Subscriptions received after the Bonus Round Cap are processed at standard terms: $0.25/unit, no bonus units.</p>
    <h3>Standard Round (After Bonus Round Closes)</h3>
    <p>After the first $150,000 is raised and the Bonus Round closes, the remaining $350,000 of the Offering is sold at standard terms: $0.25 per Class B Unit, with no bonus units. Investors in the standard round receive units only on a paid basis. The $0.25/unit price and 21.5% total Class B ownership stake remain unchanged throughout the Offering.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 22</span></div>
</div>

{/* PAGE 23 — SUBSCRIBING TO THE OFFERING */}
<div className="page" id="p23">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Subscribing to the Offering</span><span className="page-num">Page 23</span></div>
  <div className="page-body">
    <div className="section-label">Subscribing to the Offering</div>
    <p>Investors who wish to purchase Units must complete and execute our Subscription Agreement (under which the Investor will agree to be bound by the terms of the Operating Agreement) and return the same, along with the payment for the Units, as directed in the Subscription Agreement. By executing a Subscription Agreement, a subscriber unconditionally and irrevocably agrees to purchase the Units shown thereon on a "when issued basis." Accordingly, upon executing a Subscription Agreement, the subscriber is not yet an owner of our Units. Units will be deemed issued when the Subscription Agreement is accepted by the Company and the prospective Investor is admitted to the Company as a Member. Subscription Agreements are non-cancelable and irrevocable, and the subscription funds are non-refundable for any reason, except with our consent or pursuant to any legal right of rescission. After having subscribed for the minimum investment amount, you may at any time, and from time to time, subscribe to invest additional amounts so long as this Offering is open.</p>
    <p>We will be reviewing subscription applications as they are received and will accept or reject subscription applications within generally 15 days after receipt. We will indicate our acceptance of a subscription agreement by countersigning it and indicating the number of Units we will issue. We reserve the right to reject any subscription submitted for any reason. If accepted, an Investor will become a Member subject to execution of the documents specified in the subscription agreement and you shall become subject to the Operating Agreement.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 23</span></div>
</div>

{/* PAGE 24 — PLAN OF DISTRIBUTION / WHO MAY INVEST */}
<div className="page" id="p24">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Plan of Distribution</span><span className="page-num">Page 24</span></div>
  <div className="page-body">
    <div className="section-label">Plan of Distribution</div>
    <p>The Class B Membership Units offered hereby have not been registered under the Securities Act with the SEC or under the securities laws of any state. As a result, all certificates or digital ledgers for Securities sold herein will bear a restrictive legend. The Investor will only be able to sell or otherwise transfer the Securities pursuant to an effective registration statement or in a transaction exempt from registration. Securities in this offering constitute restricted securities with limited marketability. <strong>An investment in Rosie AI LLC involves a long-term, high-risk investment.</strong></p>
    <p>The Units will be offered to Investors who qualify as "accredited investors" as defined under Rule 501(a) of Regulation D promulgated under the Securities Act. To comply with federal regulations, the Company or its designated agents will undertake reasonable methods to independently verify that an Investor is "accredited." Such methods include, without limitation:</p>
    <ul className="dot-list">
      <li><strong>Income Verification:</strong> Review of an Investor's income tax returns and filings along with a written representation that the person reasonably expects to reach the level necessary to qualify as an accredited investor during the current year.</li>
      <li><strong>Net Worth Verification:</strong> Review of bank statements, brokerage statements, certificates of deposit, or tax assessments (dated within three months) together with a credit report from a nationwide agency to determine net worth.</li>
      <li><strong>Third-Party Confirmation:</strong> Obtaining written confirmation from a registered broker-dealer, an SEC-registered investment advisor, a licensed attorney, or a CPA that such person or entity has taken reasonable steps to verify that the purchaser is an accredited investor.</li>
    </ul>
    <p>Not withstanding anything to the contrary, the Company shall not sell securities to Investors that do not qualify for the exemption from registration as an Investment Company under the Investment Company Act of 1940. Section 3(c)(1) of the Act excludes from being an investment company any issuer whose outstanding securities are beneficially owned by not more than 100 persons. Subscribers shall execute subscription documents via the Rosie AI Investor Portal in which they represent that the purchase of Units is being made for investment purposes with no intent to resell.</p>
    <div className="section-label navy-light" style="margin-top:14px;">Who May Invest?</div>
    <p>An investment in our Class B Units involves a high degree of risk and is suitable only for persons of substantial financial means who have no need for liquidity in their investment. These Units are only suitable for those who desire a relatively long-term investment for which they do not need liquidity until the realization of the anticipated technical and market milestones set forth in this Memorandum.</p>
    <p>Our offering will be conducted in reliance upon exemptions for transactions not involving a public offering. A subscriber must meet the following investor suitability standards to purchase Units:</p>
    <ul className="dot-list">
      <li><strong>Financial Resilience:</strong> Each Investor must have the ability to bear the economic risks of investing in the Units, including a complete loss of investment.</li>
      <li><strong>Sophistication:</strong> Each Investor must have sufficient knowledge and experience in financial, business, or technology investment matters to evaluate the merits and risks of an AI SaaS-based revenue orchestration platform.</li>
      <li><strong>Investment Intent:</strong> Each Investor must represent and warrant that the Units are being acquired for investment and not with a view to distribution.</li>
      <li><strong>Access to Information:</strong> Each Investor will confirm they have had access to the Rosie AI Technical Appendix, Platform Audit reports, and the Company's high-leverage engineering roadmap.</li>
    </ul>
    <p>For purposes of the net worth calculations, net worth is the amount by which assets exceed liabilities, excluding your primary residence, home furnishings, or automobiles.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 24</span></div>
</div>

{/* PAGE 25 — USE OF INVESTOR PROCEEDS */}
<div className="page" id="p25">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Use of Investor Proceeds</span><span className="page-num">Page 25</span></div>
  <div className="page-body">
    <div className="section-label">Use of Investor Proceeds</div>
    <h3>Use of Proceeds:</h3>
    <p>The primary use of proceeds is described in the table below. A total of USD $500,000 is being raised to migrate the current functional production build to an enterprise-ready, multi-tenant system and to scale the Company's proprietary discovery pipelines. By utilizing a high-leverage offshore engineering model, the Company achieves a 92% cost saving on technical execution, allowing the majority of invested funds to be directed toward customer acquisition, infrastructure hardening, and first-year personnel costs.</p>
    <h3>Source and Use of Funds</h3>
    <table>
      <thead><tr><th>Category</th><th>Amount</th><th>%</th><th>Primary Objective</th></tr></thead>
      <tbody>
        <tr><td>Gross Offering Proceeds</td><td>$500,000</td><td>100%</td><td>Enterprise Scale-Out</td></tr>
        <tr><td>Customer Acquisition (GTM)</td><td>$150,000</td><td>30%</td><td>Driving B2B adoption &amp; pipeline scaling</td></tr>
        <tr><td>Product Development (Migration)</td><td>$100,000</td><td>20%</td><td>Enterprise-ready multi-tenant framework</td></tr>
        <tr><td>Infrastructure Scaling</td><td>$50,000</td><td>10%</td><td>Ingestion hardening &amp; signal throughput</td></tr>
        <tr><td>Operations &amp; Legal</td><td>$50,000</td><td>10%</td><td>Compliance, security audits &amp; governance</td></tr>
        <tr><td>1st Year Personnel Costs</td><td>$107,400</td><td>21.5%</td><td>Core team salaries &amp; contractor fees</td></tr>
        <tr><td>Working Capital Reserve</td><td>$42,600</td><td>8.5%</td><td>R&amp;D and operational cushion</td></tr>
      </tbody>
      <tfoot><tr><td>Total</td><td>$500,000</td><td>100%</td><td>Projected 21.5% Equity Stake</td></tr></tfoot>
    </table>
    <p style="font-size:9.5px;color:var(--gray-600);"><strong>Allocation Notes:</strong> The $107,400 allocation for 1st Year Personnel Costs reflects the Company's commitment to maintaining its core U.S.-based leadership team (Managing Partner and Chief Technology Engineer) and specialized offshore engineering unit during the critical enterprise migration phase. Customer Acquisition has been adjusted to $150,000 (30%) and Infrastructure Scaling to $50,000 (10%) to accommodate these personnel costs while preserving the Company's ability to drive B2B market penetration and system hardening.</p>
    <h3>Detailed Allocation Descriptions</h3>
    <p><strong>Customer Acquisition (Go-To-Market Strategy): 30%</strong><br />These funds are dedicated to scaling the Company's B2B sales engine. This includes expanding the autonomous outreach pipelines within high-alpha verticals such as Solar, Roofing, and SaaS. Funds will be used to optimize conversion funnels, attend industry-specific trade events, and drive market penetration through the Managing Partner's strategic channel alliances.</p>
    <p><strong>Product Development (Enterprise Migration): 20%</strong><br />A critical portion of the proceeds will fund the final migration of the Rosie AI platform to an enterprise-ready architecture. This includes the development of multi-tenant isolation protocols, enhanced Row-Level Security (RLS) via Supabase, and the hardening of the 150+ backend functions to support thousands of concurrent organizations with 99.99% uptime.</p>
    <p><strong>Infrastructure Scaling: 10%</strong><br />These costs include the expansion of the Company's 7 active discovery pipelines. Funds will be used to enhance real-time ingestion capabilities for municipal permits, social signal extraction, and professional intent triggers. This ensures that the platform remains the "first-mover" in detecting live intent.</p>
    <p><strong>Operations &amp; Legal: 10%</strong><br />This allocation covers organizational and ongoing business operational costs, including attorneys' fees for compliance, accounting services, and security audits (SOC2-readiness). It also covers state income taxes and retention of professional services to maintain the Company's Wyoming corporate standing and Sheridan, Wyoming executive office.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 25</span></div>
</div>

{/* PAGE 26 — SUMMARY OF OPERATING AGREEMENT */}
<div className="page" id="p26">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Summary of Operating Agreement</span><span className="page-num">Page 26</span></div>
  <div className="page-body">
    <div className="section-label">Restrictive Legend on Membership Certificate</div>
    <p>If the Company decides to issue physical membership certificates or digital tokens of ownership, we will place restrictive legends on your membership certificate or any other document evidencing ownership of our Units. The language of the legend will be substantially similar to the following:</p>
    <div className="notice-block">
      <p className="legal-caps">THE TRANSFERABILITY OF THE MEMBERSHIP UNITS REPRESENTED BY THIS CERTIFICATE IS RESTRICTED. SUCH UNITS MAY NOT BE SOLD, ASSIGNED, OR TRANSFERRED, AND NO ASSIGNEE, VENDEE, TRANSFEREE, OR ENDORSEE THEREOF WILL BE RECOGNIZED AS HAVING ACQUIRED ANY SUCH UNITS FOR ANY PURPOSES, UNLESS AND TO THE EXTENT SUCH SALE, TRANSFER, HYPOTHECATION, OR ASSIGNMENT IS PERMITTED BY, AND IS COMPLETED IN STRICT ACCORDANCE WITH, APPLICABLE FEDERAL AND STATE LAW AND THE TERMS AND CONDITIONS SET FORTH IN THE OPERATING AGREEMENT OF Rosie AI LLC, AS AMENDED FROM TIME TO TIME.</p>
    </div>
    <div className="notice-block">
      <p className="legal-caps">THE SECURITIES REPRESENTED BY THIS CERTIFICATE MAY NOT BE SOLD, OFFERED FOR SALE, OR TRANSFERRED IN THE ABSENCE OF AN EFFECTIVE REGISTRATION UNDER THE SECURITIES ACT OF 1933, AS AMENDED, AND UNDER APPLICABLE STATE SECURITIES LAWS, OR AN OPINION OF COUNSEL SATISFACTORY TO Rosie AI LLC &amp; THAT SUCH TRANSACTION IS EXEMPT FROM REGISTRATION UNDER THE SECURITIES ACT OF 1933, AS AMENDED, AND UNDER APPLICABLE STATE SECURITIES LAWS.</p>
    </div>
    <div className="section-label" style="margin-top:18px;">Summary of Operating Agreement</div>
    <p>The following is a summary of our Operating Agreement and is qualified in its entirety by the terms of the Operating Agreement itself. You are urged to read our entire Operating Agreement, a copy of which is available for review within the Rosie AI Investor Portal. By participating in the Offering and executing the subscription documents, the Investor shall become a Member of the Company and shall be bound by the terms and conditions set forth in the Operating Agreement of Rosie AI LLC.</p>
    <h3>Summary of Operating Agreement</h3>
    <p>The Operating Agreement governs the internal affairs of the Company, including the rights of Class A and Class B Members, the management authority of the Managing Partner, and the specific mechanics of the Profit Waterfall Distribution. Investors are encouraged to consult with their own legal counsel prior to committing capital to ensure a full understanding of their obligations and rights as a Member of Rosie AI LLC.</p>
    <div className="callout navy"><p><strong>NOTE: Invested Capital vs. Operating Costs</strong><br />The personnel costs above reflect first-year capital deployment from the raise — not the Company's recurring operating cost structure. As the platform scales to enterprise, operating costs will grow materially.</p></div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 26</span></div>
</div>

{/* PAGE 27 — CAPITALIZATION: BUSINESS PURPOSE */}
<div className="page" id="p27">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Capitalization: Business Purpose</span><span className="page-num">Page 27</span></div>
  <div className="page-body">
    <div className="section-label">Capitalization: Business Purpose</div>
    <p>The Company is authorized to issue up to 10,000,000 total Units, structured to support its transition into a high-scale, enterprise-ready AI orchestration platform.</p>
    <h3>Class A Membership Units (7,850,000 Units)</h3>
    <p>The Managing Partner holds Class A Units, which are entitled to one vote per Unit with respect to all matters on which Members are entitled to vote. Class A Members maintain 100% of the voting power and operational control of the Company.</p>
    <p>Holders of Class A Units are entitled to receive distributions from the Company's net profits according to the Profit Waterfall once the initial return of capital and designated profit hurdles for Class B Members have been satisfied. The Class A Members intend to reinvest excess cash flow into the Company to fund continuous technical R&amp;D, infrastructure hardening, and the expansion of proprietary data ingestion pipelines.</p>
    <h3>Class B Membership Units:</h3>
    <p><strong>Class B Membership Units (2,150,000 Units)</strong><br />The Class B Membership Units are the securities being offered to investors. At full subscription, Class B Units represent a 21.5% ownership. 2,000,000 Class B Units $0.25/unit ($500,000). 150,000 Bonus Round.</p>
    <p>Class B Members are entitled to economic participation in the Company's success through an eventual waterfall split on net profits. Distributions are triggered once monthly revenue exceeds $20,000/month. Profits generated by the platform's subscription-based SaaS model are allocated according to the priority tiers defined in the Operating Agreement. Investors may have the opportunity to reinvest their distributions into the Company to fund further scaling of the v6 Rosie AI Engine, subject to the discretion of the Managing Partner.</p>
    <h3>Business Purpose</h3>
    <p>The business purpose of Rosie AI LLC is to finalize the migration of its fully functional AI orchestration platform into a robust, enterprise-ready multi-tenant system.</p>
    <p>The Company utilizes its USD $500,000 in offering proceeds to harden its 150+ backend functions, expand its 7 active discovery pipelines, and scale its high-leverage offshore engineering model. By replacing legacy, manual lead generation and sales development workflows with autonomous AI agents, the Company aims to capture a significant share of the $300B+ Sales and Marketing Automation market. Excess cash flow generated by the platform is reinvested to maintain a technical "moat" through real-time intent detection (such as municipal permit scraping) and to drive aggressive customer acquisition across high-alpha B2B verticals.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 27</span></div>
</div>

{/* PAGE 28 — RIGHTS AND LIABILITIES / CAPITAL CONTRIBUTIONS */}
<div className="page" id="p28">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Rights, Liabilities &amp; Capital Contributions</span><span className="page-num">Page 28</span></div>
  <div className="page-body">
    <div className="section-label">Rights and Liabilities of Investors</div>
    <p>Only the Class A Units carry voting rights. The rights, duties, and powers of Investors (Class B Members) are governed by the Operating Agreement of and by the Wyoming Limited Liability Company Act. The discussion herein is qualified in its entirety by reference to said Operating Agreement and the Act.</p>
    <p>Persons who become Investors in the manner set forth in this Memorandum will not be responsible for the Company's obligations and will be liable only to the extent of their agreed-upon capital contributions. Investors may be liable for any return of capital plus interest if necessary to discharge liabilities existing at the time of such return. Any cash distributed to Investors through the Profit Waterfall may constitute, wholly or in part, a return of capital until the initial investment is recouped.</p>
    <div className="section-label" style="margin-top:18px;">Capital Contributions</div>
    <p>The Company is seeking a total capital infusion of USD $500,000 through the Rosie AI Investor Portal (<strong>https://investors.rosieai.tech/portal</strong>) to ensure proper AML/KYC verification and accreditation documentation.</p>
    <div className="section-label" style="margin-top:18px;">Rights, Powers, and Duties of Management</div>
    <p>Subject to the rights of the Class A Unit holders to vote on specified matters, the Managing Partner and the Chief Technology Engineer will have complete charge of the Company's business. Management is not required to devote full time to the Company's affairs but shall devote such time as is required for the effective conduct of the business, including the migration to enterprise-ready systems and the oversight of the global engineering unit.</p>
    <p>In addition, the Managing Partner is granted a special power of attorney from each Investor for the purpose of executing documents that the Investors have expressly agreed to execute and deliver or that are required to be filed under applicable Wyoming law. Management may also, at its sole discretion, retain specialized vendors — including the Philippine-based engineering unit, legal counsel, and accounting professional administer the platform, scale discovery pipelines, and adjudicate technical audits on behalf of the Company.</p>
    <p>The Managing Partner is elected by those Members holding a majority of the Class A Units. Management shall remain in place until resignation, dissolution, or replacement by a vote of the Class A Members. In the event of the resignation or removal of a Managing Partner, a successor shall be selected by a vote of the Class A Members at their sole discretion.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 28</span></div>
</div>

{/* PAGE 29 — ALLOCATION / MEETINGS / ACCOUNTING / AMENDMENTS */}
<div className="page" id="p29">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Allocation, Distributions &amp; Governance</span><span className="page-num">Page 29</span></div>
  <div className="page-body">
    <div className="section-label">Allocation and Distributions</div>
    <p>The Company's net profits and distributions shall be allocated and distributed to the Class B Members in proportion to their ownership of Units. Economic participation is structured as an eventual waterfall split on net profits. <strong>Distributions to Class B holders activate once monthly platform revenue exceeds $20,000/month</strong> (approximately 28–30 paying organizations at $700 avg MRR). This threshold is projected to be reached in Q4 2026.</p>
    <p>Excess cash flow beyond the designated Class B distributions shall be allocated to the Class A Members to be utilized at their discretion — including reinvestment into technical R&amp;D, infrastructure hardening of the 150+ backend functions, or retention as a capital reserve.</p>
    <div className="section-label" style="margin-top:14px;">Meetings</div>
    <p>The Company does not plan to hold regular meetings of the Members. Special meetings (telephonic or digital) may be convened at any time at the request of the Managing Partner or by the holders of more than 50% of either the Class A or Class B Units. Any such request must state the specific purpose of the meeting and the technical or operational matters proposed for review. Notices regarding the time and access details for special meetings will be distributed to Members via the Rosie AI Investor Portal.</p>
    <div className="section-label" style="margin-top:14px;">Accounting and Reports</div>
    <p>The Managing Partner shall cause to be prepared an annual report detailing the Company's operations, technical milestones, and financial performance. This report will be furnished to Members via the Investor Portal within 75 days of the close of the fiscal year. Additionally, Members will be provided with all information reasonably necessary to complete their individual tax returns (such as Schedule K-1s) within 75 days after the end of the calendar year.</p>
    <div className="section-label" style="margin-top:14px;">Amendment of the Operating Agreement</div>
    <p>The Operating Agreement of Rosie AI, LLC may be amended only by a vote of the Class A Members holding more than 50% of the outstanding Class A Units. However, no amendment may increase the rights or preferences of the Class A Members or decrease the economic rights of the Class B Members without the approval of more than 50% of the Class B Unit holders.</p>
    <div className="section-label" style="margin-top:14px;">Limitations on Transferability</div>
    <p>The Operating Agreement places substantial limitations on the transferability of the Units to protect the Company's technical "moat" and operational stability. Generally, Units may not be voluntarily transferred, assigned, or pledged without the express written consent of the Managing Partner. Investors are urged to review the Operating Agreement in its entirety to understand these restrictions, as the Securities represent a long-term, illiquid investment in an early-stage AI orchestration platform.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 29</span></div>
</div>

{/* PAGE 30 — FEDERAL AND STATE INCOME TAX */}
<div className="page" id="p30">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Federal and State Income Tax Consequences</span><span className="page-num">Page 30</span></div>
  <div className="page-body">
    <div className="section-label">Federal and State Income Tax Consequences</div>
    <p>This Memorandum does not address specific tax considerations that may be relevant to individual investors.</p>
    <p className="legal-caps"><strong>YOU ARE URGED TO CONSULT YOUR OWN TAX ADVISOR REGARDING THE SPECIFIC TAX CONSEQUENCES OF PURCHASING, OWNING, AND DISPOSING OF AN INTEREST IN THE COMPANY.</strong> Nothing in this Memorandum should be construed as legal or tax advice. You should be aware that the Internal Revenue Service (IRS) may not agree with all tax positions taken by the Company, and changes in federal or state laws regarding AI-based SaaS revenue may impact anticipated tax outcomes.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 30</span></div>
</div>

{/* PAGE 31 — SUBSCRIPTION PROCEDURES / SUITABILITY REQUIREMENTS */}
<div className="page" id="p31">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Subscription Procedures</span><span className="page-num">Page 31</span></div>
  <div className="page-body">
    <div className="section-label">Subscription Procedures</div>
    <p>Each prospective Investor is required to perform the following to subscribe for Class B Membership Units in Rosie AI LLC (the "Company"):</p>
    <h3>Execute Subscription Documents:</h3>
    <p>Access the Rosie AI Investor Portal at <strong>https://investors.rosieai.tech/portal</strong> to complete and sign the Subscription Agreement and Investor Questionnaire. By subscribing to Units in this Offering and executing these documents, you shall, upon acceptance of the subscription by the Company, become a Member of the Company and become subject to the Operating Agreement.</p>
    <h3>Deliver Capital Contribution:</h3>
    <p>Funds should be directed to Column N.A., for the account of Rosie AI LLC. Funds will be deposited into the Company's operating account upon acceptance. If a subscription is not accepted, funds will be promptly returned to the subscriber without interest or deduction.</p>
    <h3>Accreditation Verification:</h3>
    <p>Provide all necessary documents and information requested via the Investor Portal to complete a mandatory verification of Accredited Investor status. In accordance with Rule 506(c), the Company requires reasonable independent verification, which may include tax returns, bank statements, or a letter of confirmation from a CPA, attorney, or registered investment advisor.</p>
    <div className="section-label" style="margin-top:18px;">Suitability Requirements</div>
    <p>Rule 501(a) of Regulation D defines an "Accredited Investor" as any person or entity that meets specific financial or professional criteria. To participate in this Offering, a subscriber must fall into one of the following categories at the time of the sale:</p>
    <ul className="dot-list">
      <li><strong>Individual Net Worth:</strong> A natural person whose net worth, either individually or jointly with their spouse or spousal equivalent, exceeds $1,000,000 (excluding the value of their primary residence).</li>
      <li><strong>Individual or Joint Income:</strong> A natural person who had an individual income in excess of $200,000, or joint income with their spouse or spousal equivalent in excess of $300,000, in each of the two most recent years and has a reasonable expectation of reaching the same income level in the current year.</li>
      <li><strong>Institutional Investors:</strong> A bank, savings and loan association, insurance company, registered investment company, or business development company acting in its individual or fiduciary capacity.</li>
      <li><strong>Registered Professionals:</strong> A broker or dealer registered pursuant to Section 15 of the Exchange Act.</li>
      <li><strong>Entities with Assets:</strong> A corporation, partnership, or organization described in Section 501(c)(3) of the Internal Revenue Code, not formed for the specific purpose of acquiring the Units, with total assets in excess of $5,000,000.</li>
      <li><strong>Trusts:</strong> A trust with total assets in excess of $5,000,000, not formed for the specific purpose of acquiring the Units, whose purchase is directed by a sophisticated person.</li>
      <li><strong>Employee Benefit Plans:</strong> An ERISA plan with total assets in excess of $5,000,000 or a plan where investment decisions are made by a plan fiduciary that is a bank, insurance company, or registered investment advisor.</li>
      <li><strong>Equity Entities:</strong> An entity in which all of the equity owners qualify as accredited investors under any of the above categories.</li>
    </ul>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 31</span></div>
</div>

{/* PAGE 32 — SUITABILITY REQUIREMENTS CONTINUED */}
<div className="page" id="p32">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Suitability Requirements (Continued)</span><span className="page-num">Page 32</span></div>
  <div className="page-body">
    <div className="section-label">Suitability Requirements (Continued)</div>
    <p><strong>Definition of Net Worth:</strong> For the purposes of these requirements, "net worth" means the excess of total assets over total liabilities. When computing net worth, the subscriber's primary residence is disregarded. Any mortgage or other debt secured by the primary residence is also disregarded, unless the debt exceeds the fair market value of the residence.</p>
    <p><strong>Calculation of Income:</strong> In determining income, a subscriber should include adjusted gross income plus any amounts attributable to tax-exempt interest, alimony payments, and any losses claimed as a limited partner.</p>
    <div className="callout navy"><p><strong>Note:</strong> The Company relies on the accuracy of the representations provided through the Investor Portal. The Managing Partner reserves the absolute right to reject any subscription if there is reason to believe a prospective Investor does not meet these suitability requirements.</p></div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 32</span></div>
</div>

{/* PAGE 33 — STATEMENT AS TO INDEMNIFICATION */}
<div className="page" id="p33">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Statement as to Indemnification</span><span className="page-num">Page 33</span></div>
  <div className="page-body">
    <div className="section-label">Statement as to Indemnification</div>
    <p>The Operating Agreement of Rosie AI LLC provides for the indemnification of the Managing Partner and other officers under certain circumstances, which could include liabilities relating to securities laws.</p>
    <p>The Securities and Exchange Commission (SEC) mandates the following disclosure of its position on indemnification for liabilities under the federal securities laws:</p>
    <div className="notice-block">
      <p><em>"Insofar as indemnification for liabilities arising under the Securities Act of 1933 may be permitted to directors, officers or persons controlling an issuer, the Company has been informed that in the opinion of the Securities and Exchange Commission such indemnification is against public policy as expressed in the Act and is therefore unenforceable."</em></p>
    </div>
    <p>In the event that a claim for indemnification against such liabilities (other than the payment by the Company of expenses incurred or paid by a director, officer, or controlling person of the Company in the successful defense of any action, suit or proceeding) is asserted by such director, officer, or controlling person in connection with the securities being registered, the Company will, unless in the opinion of its counsel the matter has been settled by controlling precedent, submit to a court of appropriate jurisdiction the question of whether such indemnification by it is against public policy as expressed in the Act and will be governed by the final adjudication of such issue.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 33</span></div>
</div>

{/* PAGE 34 — CAPITALIZATION: OWNERSHIP OF SECURITIES */}
<div className="page" id="p34">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Capitalization: Ownership of Securities</span><span className="page-num">Page 34</span></div>
  <div className="page-body">
    <div className="section-label">Capitalization: Ownership of Securities</div>
    <p>The following table sets forth, as of the date of this Memorandum, the number of outstanding Units beneficially owned by the Company's founders and the projected ownership for investors upon full subscription of the Offering.</p>
    <p>The Company has an authorized capitalization of 10,000,000 total Units. The current outstanding Class A Units are held by the founding management and sponsors to ensure operational stability and technical continuity during the enterprise migration phase.</p>
    <table>
      <thead><tr><th>Owner</th><th>Units Prior to Offering</th><th>% Prior to Offering</th><th>Units After Offering</th><th>% After Offering</th></tr></thead>
      <tbody>
        <tr><td>Founding Management &amp; Sponsors (Class A)</td><td>6,850,000</td><td>100%</td><td>6,850,000</td><td>78.6%</td></tr>
        <tr><td>New Class B Investors</td><td>—</td><td>—</td><td>2,150,000</td><td className="td-highlight">21.5%</td></tr>
      </tbody>
      <tfoot><tr><td>Total</td><td>6,850,000</td><td>100%</td><td>9,000,000</td><td>100%</td></tr></tfoot>
    </table>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 34</span></div>
</div>

{/* PAGE 35 — DESCRIPTION OF UNITS */}
<div className="page" id="p35">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Description of Units</span><span className="page-num">Page 35</span></div>
  <div className="page-body">
    <div className="section-label">Description of Units</div>
    <p>An Investor in the Company is both a holder of Units and a member of the limited liability company at the time of acceptance of the investment (a "Member"). The Company has two primary classes of Units: Class A Units (Voting) and Class B Units (Non-Voting).</p>
    <p>Investors must agree to the terms and conditions of the Operating Agreement of Rosie AI LLC, as described herein and available through the Rosie AI Investor Portal. An Investor must execute the Subscription Agreement and associated documents via the Investor Portal in order to invest in the Offering, under which the Investor will agree to be bound, as a Member, by the terms and conditions of the Operating Agreement.</p>
    <div className="info-box" style="margin-top:20px;text-align:center;">
      <div className="info-box-title">Investor Portal</div>
      <p style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--navy);font-weight:500;">https://investors.rosieai.tech/portal</p>
    </div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 35</span></div>
</div>

{/* PAGE 36 — UNITS, ORGANIZATION AND MANAGEMENT */}
<div className="page" id="p36">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Units, Organization and Management</span><span className="page-num">Page 36</span></div>
  <div className="page-body">
    <div className="section-label">Units, Organization and Management</div>
    <h3>Company Management</h3>
    <p>Our equity ownership is divided into Units of membership interest in Rosie AI LLC. We maintain a comprehensive membership register at our principal executive office in Sheridan, Wyoming, which sets forth the name, address, capital contribution, and number of Units held by each Member.</p>
    <p><strong>Class A Units (7,850,000 Units total):</strong><br />These are the only Units with voting rights and are held by the Company's founders and sponsors to ensure technical and operational continuity. The Class A Units possess distribution and liquidation rights only after the Class B Members have received their designated capital returns and profit distributions as outlined in the Profit Waterfall.</p>
    <p><strong>Class B Units (2,150,000 Units):</strong><br />These Units are being offered to investors and represent a 21.5% ownership stake in the Company upon full subscription. Class B Units are:</p>
    <ol>
      <li style="font-size:11.5px;margin-bottom:6px;"><strong>Non-voting:</strong> Holders have no voice in the day-to-day management or strategic direction.</li>
      <li style="font-size:11.5px;"><strong>Economic Participation:</strong> Holders have a right to receive distributions from net profits via the waterfall structure, triggered once the platform exceeds its monthly operating expenses.</li>
    </ol>
    <h3>Entity Structure &amp; Taxation</h3>
    <p>We have elected to organize as a Wyoming Limited Liability Company rather than a traditional corporation to qualify for partnership tax treatment. This ensures that the Company's earnings or losses pass through to our Members, avoiding the "double taxation" typical of C-Corporations and allowing taxation to occur at the individual Member level.</p>
    <p>As a Member, an Investor is entitled to the economic rights and distributions that accompany their Class B Units. Our business affairs, as well as the respective rights and obligations of all Members, are governed strictly by the Operating Agreement.</p>
    <h3>Control and Governance</h3>
    <p>The core leadership consists of Stephani Scheidt (Managing Partner) and the Chief Technology Engineer. The Managing Partner oversees the B2B revenue engine and strategic partnerships, while the Chief Technology Engineer manages the 150+-function backend, security protocols, and the specialized Philippine-based engineering unit.</p>
    <p>No Member other than the designated Management shall have any voice in, or take part in, the management of our business, nor any authority to act on our behalf. In the event of the resignation, removal, or liquidation of a Managing Partner, a successor shall be selected by a vote of the Class A Members at their sole discretion.</p>
    <p>Generally, the Managing Partner shall have the right, power, and authority on our behalf to exercise all rights and powers possessed under the Wyoming Limited Liability Company Act, including but not limited to the borrowing of funds, the acquisition of proprietary data assets (e.g., municipal permits), and the pledging of Company assets to secure growth-related debt.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 36</span></div>
</div>

{/* PAGE 37 — OPERATING AGREEMENT; MANAGEMENT */}
<div className="page" id="p37">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Operating Agreement; Management of the Company</span><span className="page-num">Page 37</span></div>
  <div className="page-body">
    <div className="section-label">Operating Agreement; Management of the Company</div>
    <p>The Company is operated pursuant to a limited liability company agreement (the "Operating Agreement"). Any references to the Operating Agreement in this Memorandum do not purport to be a complete statement and are qualified in their entirety by reference to the complete Operating Agreement available via the Rosie AI Investor Portal.</p>
    <p>The business and operations of the Company are managed by its leadership core based in Sheridan, Wyoming, led by Stephani Scheidt (Managing Partner) and the Chief Technology Engineer. The founding management team holds 6,850,000 Class A Units, which represent 100% of the voting power of the Company. Investors in this offering shall hold Class B Units, which are non-voting. Accordingly, Investors shall have no control over or vote as to any technical, operational, or strategic decisions made by the Company or its Management.</p>
    <h3>Retaining Specialized Technical Units for System Orchestration</h3>
    <p>To achieve Extreme Capital Efficiency, the Managing Partner retains a specialized Engineering Unit based in the Philippines. This unit performs the deep technical labor required to discover, score, and convert high-intent leads across 7 active discovery pipelines.</p>
    <ol>
      <li style="font-size:11.5px;margin-bottom:6px;"><strong>Data Isolation:</strong> Ensuring SOC2-compliant Row-Level Security (RLS) across all multi-tenant environments.</li>
      <li style="font-size:11.5px;margin-bottom:6px;"><strong>System Health:</strong> Monitoring the "self-healing" logic of the backend functions to ensure 99.99% uptime.</li>
      <li style="font-size:11.5px;"><strong>Audit Cycles:</strong> Verifying that all AI-generated outputs maintain a 91%+ accuracy benchmark.</li>
    </ol>
    <h3>Engineering Execution Unit:</h3>
    <p>The Company utilizes a specialized three-person team to manage the "machine that builds the machine." Each engineer is mapped to a critical system component and is compensated at a fraction of domestic rates, delivering the Company's 92% cost advantage over traditional venture-backed startups.</p>
    <div className="callout"><p><strong>Backend Engineer (Deno/TS/Supabase):</strong> Responsible for type-safe pipeline architecture, scalable PostgreSQL management, and the design of robust background processing queues to handle high-volume data ingestion.</p></div>
    <div className="callout navy"><p><strong>Frontend Engineer (React 18/Tailwind):</strong> Architects interactive, component-based interfaces and real-time analytics dashboards that allow enterprise clients to visualize lead intelligence and campaign conversion metrics.</p></div>
    <div className="callout"><p><strong>Integrations Engineer (Apify/APIs/Webhooks):</strong> The "glue" of the tech stack. Develops custom web scrapers and automation actors to extract high-quality intent data at scale, and manages the enrichment waterfall (Apollo/Hunter) across all outreach channels.</p></div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 37</span></div>
</div>

{/* PAGE 38 — THE OFFERING / DISSOLUTION / QUARTERLY ALLOCATION */}
<div className="page" id="p38">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — The Offering</span><span className="page-num">Page 38</span></div>
  <div className="page-body">
    <div className="section-label">The Offering</div>
    <p>Interests in Rosie AI LLC. The total offering amount is USD $500,000, which represents a 21.5% ownership stake in the Company upon full subscription. The Class B Units may be referred to as the "Units." The proceeds will be deployed immediately to fund the migration of the platform to an enterprise-ready, multi-tenant system and to scale the Company's proprietary lead intelligence pipelines.</p>
    <h3>Dissolution of the Company</h3>
    <p>The Managing Partner may elect to dissolve the Company and distribute its remaining assets — including the proprietary "v6 Engine" code base, 150+ backend functions, and data ingestion intellectual property — to the Class A Members as determined by the Managing Partner. This dissolution may occur without obtaining an appraisal of such assets' value and without any obligation to use commercially reasonable efforts to sell the assets, at such time as the Class B Members have received cash distributions through the Profit Waterfall equal to their original capital contribution plus the designated profit hurdles defined in the Operating Agreement.</p>
    <p>The Company may elect to dissolve and wind up at any time after the later of (i) 12 months from the date of this Memorandum, or (ii) such time as the Company is able to return the original investment made by each Class B Member plus their required return for the time period ending on the date of election to dissolve.</p>
    <h3>Quarterly Profit Allocation and Reinvestment</h3>
    <p>By way of clarification, and as further described in the Operating Agreement, the Company shall distribute net profits according to a Waterfall Split. On a quarterly basis (or monthly at the discretion of Management), the Company shall pay out distributions from net cash flow once the platform's monthly fixed operating costs (currently projected at $10,100/month) are exceeded.</p>
    <p>Profits in excess of the designated Class B distributions shall be allocated to the Class A Members. These funds are typically reinvested into the Company to harden the 136-entity data model, expand the 7 active discovery pipelines (including municipal permit scraping), and maintain the high-leverage offshore engineering unit required to sustain the platform's technical advantage.</p>
    <div className="info-box" style="margin-top:20px;text-align:center;">
      <div className="info-box-title">Investor Portal</div>
      <p style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--navy);font-weight:500;">https://investors.rosieai.tech/portal</p>
    </div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 38</span></div>
</div>

{/* PAGE 39 — DESCRIPTION OF UNITS; RIGHTS OF HOLDERS */}
<div className="page" id="p39">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Description of Units; Rights of Holders of Units</span><span className="page-num">Page 39</span></div>
  <div className="page-body">
    <div className="section-label">Description of Units; Rights of Holders of Units</div>
    <h3>Class A Units:</h3>
    <p>The Class A Units are the primary voting securities of the Company and are held by the founders and the Managing Partner. Holders of Class A Units possess 100% of the voting power and operational control over the Company's strategic direction, technical roadmap, and the management of the Philippine-based engineering unit. Class A Units have distribution and liquidation rights as defined in the Profit Waterfall, triggered once Class B hurdles are met. No Class A Units are being offered in this Offering.</p>
    <h3>Class B Units:</h3>
    <p>The Class B Units are the securities being offered to Investors. These Units: (i) are non-voting, (ii) possess economic rights to participate in the Company's success through a monthly Waterfall Split on net profits, and (iii) represent a combined 21.5% ownership stake in the Company upon full subscription of the Offering.</p>
    <div className="kv-grid">
      <span className="kv-key">Offering Amount</span><span className="kv-val hl-orange">$500,000</span>
      <span className="kv-key">Total Class B Units Offered</span><span className="kv-val">2,150,000 (incl. 150,000 Bonus Units)</span>
      <span className="kv-key">Maximum Offering</span><span className="kv-val">$500,000</span>
      <span className="kv-key">Minimum Investment</span><span className="kv-val">$15,000</span>
    </div>
    <p>The Units will be offered to individuals or entities (the "Investors") who qualify as "Accredited Investors" as defined in Rule 501 of Regulation D. After the closing of the Offering, the Company shall be limited to no more than 100 Investors to comply with the Section 3(c)(1) exemption of the Investment Company Act of 1940.</p>
    <h3>Offering Period:</h3>
    <p>The Offering of Units will terminate upon the earlier of: (a) the sale of all of the Units, or (b) the termination date which shall be twenty-four months from the date of this Memorandum, unless otherwise extended or terminated early by the Managing Partner in her sole discretion.</p>
    <h3>Distribution of Units:</h3>
    <p>We intend to offer the Units for sale directly to Investors privately pursuant to Regulation D, Rule 506(c). All subscription activities must be conducted through the Rosie AI Investor Portal (<strong>https://investors.rosieai.tech/portal</strong>). Subscribers shall execute subscription documents in which they represent that the purchase of the Units is being made for investment purposes with no intent to resell.</p>
    <h3>Use of Proceeds from this Offering:</h3>
    <p>We intend to use the proceeds from this Offering for: (i) the migration of the currently functional platform to an enterprise-ready, multi-tenant system, (ii) the expansion of the 7 active discovery pipelines (including municipal permit ingestion), and (iii) the acceleration of B2B customer acquisition in high-alpha verticals.</p>
    <h3>Securities Outstanding Before the Offering:</h3>
    <ul className="dot-list">
      <li>6,850,000 Class A Units (Stephani Scheidt) + 1,000,000 reserved Equity Pool Units</li>
      <li>0 Class B Units</li>
    </ul>
    <h3>Securities Outstanding After Offering:</h3>
    <ul className="dot-list">
      <li>6,850,000 Class A Units</li>
      <li>1,000,000 Class A Units (Reserved for Employee, executive and critical vendor compensation)</li>
      <li>2,150,000 Class B Units (2,000,000 priced @ $0.25 + 150,000 Bonus Round units)</li>
    </ul>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 39</span></div>
</div>

{/* PAGE 40 — RESTRICTIONS ON TRANSFER */}
<div className="page" id="p40">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Restrictions on Transfer</span><span className="page-num">Page 40</span></div>
  <div className="page-body">
    <div className="section-label">Restrictions on Transfer</div>
    <p>If the Company elects to issue certificates or digital ledgers evidencing the Units, they will be imprinted with a conspicuous restrictive legend. The Company's internal records will include "stop transfer notations" with respect to such Units to protect the integrity of the capitalization table.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 40</span></div>
</div>

{/* PAGE 41 — INVESTOR RELATIONS & THE ROSIE PORTAL */}
<div className="page" id="p41">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Investor Relations &amp; The Rosie Portal</span><span className="page-num">Page 41</span></div>
  <div className="page-body">
    <div className="section-label">Investor Relations &amp; The Rosie Portal</div>
    <p>Rosie AI has deployed a proprietary, high-security Investor Portal designed to provide real-time transparency and a seamless experience for our partners.</p>
    <p>Access the Portal: <strong>https://investors.rosieai.tech/portal</strong></p>
    <ul className="dot-list">
      <li><strong>Centralized Secure Access:</strong> The portal serves as the single source of truth for all investment documentation, including signed Subscription Agreements, Schedule K-1 tax forms, technical roadmaps, and quarterly performance notices.</li>
      <li><strong>Performance Analytics:</strong> Investors can track the "v6 Engine" production metrics, unit economics, and the growth trajectory of our SaaS subscriptions through interactive charts and real-time lead-intelligence KPIs.</li>
      <li><strong>Institutional-Grade Security:</strong> Architected by our Chief Technology Engineer, the platform utilizes TLS/SSL &amp; AES 256-bit encryption. Access is restricted via mandatory Multi-Factor Authentication (MFA) to ensure SOC2-level compliance and data privacy.</li>
      <li><strong>Modern SaaS Infrastructure:</strong> Hosted on a state-of-the-art multi-tenant architecture, the portal leverages Row-Level Security (RLS) and distributed cloud systems to ensure 99.99% uptime and zero-knowledge data isolation.</li>
      <li><strong>Enterprise Safeguards:</strong> Our underlying infrastructure utilizes a "Self-Healing" logic and redundant data centers with global failover capabilities, protecting the integrity of the membership register and financial ledgers.</li>
    </ul>
    <div className="section-label navy-light" style="margin-top:14px;">Infrastructure &amp; Data Protection Standards</div>
    <p>The Rosie AI technical stack is built on the same "institutional-fidelity" principles as our core AI orchestration engine, including:</p>
    <ul className="dot-list">
      <li><strong>Physical &amp; Logical Security:</strong> Restricted backend access and automated threat detection.</li>
      <li><strong>Power &amp; Data Redundancy:</strong> Continuous backups and communications redundancy across distributed AWS/Edge nodes.</li>
      <li><strong>Privacy Protocols:</strong> Rigorous storage decommissioning and data sanitization adhering to NIST 800-88 standards.</li>
    </ul>
    <p style="font-size:10px;color:var(--gray-600);font-style:italic;">Note: The "Rosie" mascot serves as your visual guide throughout the portal, personifying the intelligent, autonomous nature of the platform you are helping to build.</p>
    <div className="callout" style="margin-top:14px;"><p><strong>SEE THE NEXT SECTIONS FOR A DETAILED BREAKDOWN OF THE INVESTOR PORTAL CAPABILITIES.</strong></p></div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 41</span></div>
</div>

{/* PAGE 42 — MEMBERSHIP BILL OF RIGHTS */}
<div className="page" id="p42">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Membership Bill of Rights</span><span className="page-num">Page 42</span></div>
  <div className="page-body">
    <div className="section-label">Rosie AI LLC: Membership Bill of Rights</div>
    <p>This Bill of Rights establishes the standard of excellence and accountability that Rosie AI LLC guarantees to every Class B Member. Our commitment is to treat our investors with the same "institutional-grade" precision that we apply to our autonomous orchestration engine.</p>
    <div className="timeline">
      <div className="tl-item">
        <div className="tl-date">Right 1</div>
        <p className="tl-content"><strong>Proactive Communication</strong> — We commit to a policy of high-frequency engagement. Management will provide a comprehensive update on technical milestones, market penetration, and "v6 Engine" performance every 90 days, at a minimum. Whether we are celebrating a new enterprise contract or navigating an API pivot, you will hear it from us first.</p>
      </div>
      <div className="tl-item">
        <div className="tl-date">Right 2</div>
        <p className="tl-content"><strong>Radical Honesty &amp; Integrity</strong> — All dealings with investors — and all data presented within our dashboards — will be conducted with unwavering honesty. In an industry often clouded by "AI hype," we provide grounded, verified metrics. If a pipeline underperforms its 91% accuracy benchmark, we disclose the variance and the technical fix.</p>
      </div>
      <div className="tl-item">
        <div className="tl-date">Right 3</div>
        <p className="tl-content"><strong>Performance Transparency</strong> — Investors have the right to clear, concise, and real-time information. Through the Rosie AI Investor Portal, you will have visibility into the unit economics of the platform, including current subscription counts and the velocity of our discovery pipelines. We believe transparency is the ultimate "de-risking" tool.</p>
      </div>
      <div className="tl-item">
        <div className="tl-date">Right 4</div>
        <p className="tl-content"><strong>Distribution Timeliness</strong> — Capital distributions via the Profit Waterfall will be executed with technical precision. All disbursements will be accompanied by automated notifications and verifiable transfer data (wire confirmations or digital ledger entries), ensuring you are never left guessing about the status of your returns.</p>
      </div>
      <div className="tl-item">
        <div className="tl-date">Right 5</div>
        <p className="tl-content"><strong>24/7 Digital Disclosure</strong> — The Rosie AI Investor Portal is your primary source of truth. Members will have continuous, 24/7 access to their account statements, tax documents (K-1s), legal agreements, and historical performance charts. Our infrastructure is designed for zero-latency disclosure.</p>
      </div>
      <div className="tl-item">
        <div className="tl-date">Right 6</div>
        <p className="tl-content"><strong>Institutional Fairness</strong> — We operate on a principle of absolute equity. All Class B Members will be treated fairly in all matters, regardless of the size of their capital contribution. In the Rosie ecosystem, every unit holder is an essential partner in our mission to automate the B2B sales landscape.</p>
      </div>
    </div>
    <div className="callout green"><p><strong>The Rosie Guarantee:</strong> Our leadership team remains personally accountable for these rights. We don't just build autonomous systems; we build trusted partnerships.</p></div>
    <p>Access Your Rights &amp; Data: <strong>https://investors.rosieai.tech/portal</strong></p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 42</span></div>
</div>

{/* PAGE 43 — INVESTOR PORTAL QUICKSTART GUIDE */}
<div className="page" id="p43">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Investor Portal Quickstart Guide</span><span className="page-num">Page 43</span></div>
  <div className="page-body">
    <div className="section-label">Rosie AI LLC: Investor Portal Quickstart Guide</div>
    <h3>How it Works</h3>
    <ol>
      <li style="font-size:11.5px;margin-bottom:8px;"><strong>Capitalization &amp; Strategy:</strong> The entity is registered as a Wyoming LLC and capitalized through the issuance of Class B Membership Units.</li>
      <li style="font-size:11.5px;margin-bottom:8px;"><strong>Technical Deployment:</strong> Capital is immediately deployed to scale the "v6 Engine" and migrate the platform to a hardened, enterprise-ready multi-tenant infrastructure.</li>
      <li style="font-size:11.5px;"><strong>Autonomous Orchestration:</strong> The platform utilizes its 7 active discovery pipelines to ingest real-time intent signals (e.g., municipal permits), replacing manual sales labor with autonomous AI agents.</li>
    </ol>
    <h3>Contact &amp; Support</h3>
    <div className="kv-grid">
      <span className="kv-key">Executive Offices</span><span className="kv-val">32 N Gould St, Sheridan, WY 82801</span>
      <span className="kv-key">Investor Portal</span><span className="kv-val">https://investors.rosieai.tech/portal</span>
      <span className="kv-key">Technical Support</span><span className="kv-val">Access the "Help" module within the portal for 24/7 technical documentation</span>
    </div>
    <h3>Your Digital Dashboard</h3>
    <p>Once your subscription is accepted, the Rosie AI Investor Portal becomes your command center. You will be able to:</p>
    <ul className="dot-list">
      <li><strong>Monitor System Health:</strong> View the real-time status of our discovery pipelines and AI accuracy benchmarks.</li>
      <li><strong>Track Capital Growth:</strong> Access interactive charts detailing unit economics and your ownership stake.</li>
      <li><strong>Execute Documentation:</strong> Seamlessly sign and store K-1 tax forms and legal notices.</li>
      <li><strong>Review Technical Audits:</strong> Access deep-dive reports on our 150+ backend functions and security protocols.</li>
    </ul>
    <div className="callout navy"><p><strong>Pro-Tip:</strong> Ensure you have Multi-Factor Authentication (MFA) enabled on your portal account to maintain SOC2-level security over your investment data.</p></div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 43</span></div>
</div>

{/* PAGE 44 — ROSIE INVESTOR PORTAL OVERVIEW */}
<div className="page" id="p44">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Rosie Investor Portal Overview</span><span className="page-num">Page 44</span></div>
  <div className="page-body">
    <div className="section-label">Rosie Investor Portal Overview</div>
    <p>The Rosie AI Investor Portal is your mission control for managing your partnership with Rosie AI LLC. It provides secure, 24/7 access to your investment portfolio, technical milestones, and financial reporting from any device.</p>
    <ul className="dot-list">
      <li><strong>Secure Document Vault:</strong> Instantly access tax forms (K-1s), legal agreements, quarterly reports, and executive summaries.</li>
      <li><strong>Performance Analytics:</strong> Monitor the "v6 Engine" production metrics, SaaS unit economics, and capital growth through real-time charts.</li>
      <li><strong>Institutional Security:</strong> Rest easy knowing your data is protected by AES 256-bit encryption and multi-factor authentication — the same standards used by global financial institutions.</li>
      <li><strong>Collaborative Access:</strong> Securely grant portal access to your trusted advisors, such as CPAs, attorneys, or wealth managers.</li>
    </ul>
    <p>For technical assistance or investment inquiries, please contact our team at <strong>Investors@rosieai.tech</strong>.</p>
    <div className="section-label navy-light" style="margin-top:14px;">Getting Started</div>
    <p><strong>STEP 1: Account Activation</strong><br />You will receive an invitation email from our system with instructions on how to activate your account. Click the secure link within the email to begin.</p>
    <p><strong>STEP 2: Secure Your Account</strong><br />Select and confirm a complex password. We highly recommend enabling Multi-Factor Authentication (MFA) immediately upon your first login to ensure SOC2-level security for your data.</p>
    <div className="section-label navy-light" style="margin-top:14px;">General Navigation</div>
    <table className="portal-table">
      <thead><tr><th>Section</th><th>Function</th></tr></thead>
      <tbody>
        <tr><td><strong>Dashboard</strong></td><td>Your primary command center. View high-level portfolio snapshots, recent notifications, and quick links to the Tax Center.</td></tr>
        <tr><td><strong>Investments</strong></td><td>A deep dive into your equity stake, including transaction history, capital account balances, and real-time asset allocation.</td></tr>
        <tr><td><strong>Documents</strong></td><td>Your digital filing cabinet. Access all fund-related notices, legal agreements, and quarterly technical roadmaps.</td></tr>
        <tr><td><strong>Emails</strong></td><td>A centralized archive of all official correspondence sent through the portal, ensuring you never miss a mission-critical update.</td></tr>
        <tr><td><strong>Tax Center</strong></td><td>One convenient location to retrieve your annual tax information and Schedule K-1 forms.</td></tr>
        <tr><td><strong>Settings</strong></td><td>Update your profile, manage communication preferences, and grant permissions to external consultants.</td></tr>
      </tbody>
    </table>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 44</span></div>
</div>

{/* PAGE 45 — RISK FACTORS */}
<div className="page" id="p45">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Risk Factors</span><span className="page-num">Page 45</span></div>
  <div className="page-body">
    <div className="section-label">Risk Factors</div>
    <div className="risk-box">
      <p className="legal-caps"><strong>AN INVESTMENT IN THE UNITS THAT ARE THE SUBJECT OF THIS MEMORANDUM IS HIGHLY SPECULATIVE AND INVOLVES A HIGH DEGREE OF RISK. INVESTORS SHOULD BE ABLE TO WITHSTAND THE TOTAL LOSS OF THEIR ENTIRE INVESTMENT IN THE UNITS.</strong></p>
    </div>
    <p>Prospective purchasers should carefully review the information set forth under "Risk Factors" as well as other technical and financial information contained in this Memorandum. There can be no assurance that the Company's technical objectives — including the successful enterprise migration of the "v6 Engine" — can be achieved.</p>
    <h3>Financial Projections and Technical Performance Benchmarks Require Caution</h3>
    <p>Investors are urged to consider that the financial projections discussed in this Memorandum assume a specific rate of market adoption and system performance. Such projections are not guarantees of future financial performance. Performance may be impacted by AI Model Decay (fluctuations in LLM accuracy), Infrastructure Reliability (maintaining the 150+ backend functions at enterprise scale), and Subscription Churn (ability of B2B clients to integrate autonomous agents).</p>
    <p>Although Management has a reasonable basis for these projections, Investors should be aware of the inherent inaccuracies of forecasting in the high-growth AI SaaS sector.</p>
    <h3>Considerations for Tax-Exempt Investors</h3>
    <p>Any tax-exempt investor, such as pension plans or Individual Retirement Accounts (IRAs), may have to recognize some or all of its allocable share of Company income as Unrelated Business Taxable Income (UBTI). Because Rosie AI, LLC is structured as a Wyoming Limited Liability Company with pass-through taxation, the nature of the Company's SaaS revenue may trigger tax liabilities for exempt entities.</p>
    <p>Tax-exempt investors are strongly urged to consult with their own tax advisor to evaluate the implications of UBTI before committing capital.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 45</span></div>
</div>

{/* PAGE 46 — DISCLOSURE STATEMENT */}
<div className="page" id="p46">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Disclosure Statement</span><span className="page-num">Page 46</span></div>
  <div className="page-body">
    <div className="section-label">Disclosure Statement</div>
    <p><strong>ROSIE AI, LLC</strong></p>
    <p className="legal-caps">YOUR PARTICIPATION IN THIS COMPANY. Therefore, before you decide to participate in an equity investment in Rosie AI LLC, you should carefully study this Disclosure Document in its entirety, including the Technical Roadmap, the "v6 Engine" specifications, and the detailed discussion of the specific risk factors inherent in an AI-driven SaaS orchestration model.</p>
    <p>Because the Units are being offered exclusively to Accredited Investors pursuant to Rule 506(c) of Regulation D, this Memorandum may not contain all information that would be required to be disclosed under applicable laws and regulations if the Offering was made to the general public.</p>
    <p>Prospective investors are urged to conduct their own independent due diligence and consult with their own legal, technical, and financial advisors before committing capital to this high-leverage technology venture.</p>
    <div className="info-box" style="margin-top:20px;text-align:center;">
      <div className="info-box-title">Investor Portal</div>
      <p style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--navy);font-weight:500;">https://investors.rosieai.tech/portal</p>
    </div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 46</span></div>
</div>

{/* PAGE 47 — STATE-SPECIFIC LEGAL NOTICES */}
<div className="page" id="p47">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — State-Specific Legal Notices</span><span className="page-num">Page 47</span></div>
  <div className="page-body">
    <div className="section-label">State-Specific Legal Notices</div>
    <p className="legal-caps">NOTICE TO CALIFORNIA RESIDENTS ONLY: THE SALE OF THE SECURITIES WHICH ARE THE SUBJECT OF THIS OFFERING HAS NOT BEEN QUALIFIED WITH THE COMMISSIONER OF CORPORATIONS OF THE STATE OF CALIFORNIA AND THE ISSUANCE OF SUCH SECURITIES OR PAYMENT OR RECEIPT OF ANY PART OF THE CONSIDERATION THEREFOR PRIOR TO SUCH QUALIFICATIONS IS UNLAWFUL, UNLESS THE SALE OF SECURITIES IS EXEMPTED FROM QUALIFICATION BY SECTION 25100, 25102, OR 25104 OF THE CALIFORNIA CORPORATIONS CODE. THE RIGHTS OF ALL PARTIES TO THIS OFFERING ARE EXPRESSLY CONDITIONED UPON SUCH QUALIFICATIONS BEING OBTAINED, UNLESS THE SALE IS SO EXEMPT. THE SECURITIES OFFERED HEREUNDER HAVE NOT BEEN REGISTERED UNDER APPLICABLE CALIFORNIA SECURITIES LAWS AND, THEREFORE, ANY PURCHASER THEREOF MUST BEAR THE ECONOMIC RISK OF THE INVESTMENT FOR AN INDEFINITE PERIOD OF TIME BECAUSE THE SECURITIES CANNOT BE RESOLD UNLESS THEY ARE SUBSEQUENTLY REGISTERED UNDER SUCH SECURITIES LAWS OR AN EXEMPTION FROM SUCH REGISTRATION IS AVAILABLE.</p>
    <p className="legal-caps">NOTICE TO COLORADO RESIDENTS ONLY: THE SECURITIES HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933, AS AMENDED, OR THE COLORADO SECURITIES ACT OF 1991 BY REASON OF SPECIFIC EXEMPTIONS THEREUNDER RELATING TO THE LIMITED AVAILABILITY OF THE OFFERING. THESE SECURITIES CANNOT BE RESOLD, TRANSFERRED OR OTHERWISE DISPOSED OF TO ANY PERSON OR ENTITY UNLESS SUBSEQUENTLY REGISTERED UNDER THE SECURITIES ACT OF 1933, AS AMENDED, OR THE COLORADO SECURITIES ACT OF 1991, IF SUCH REGISTRATION IS REQUIRED.</p>
    <p className="legal-caps">NOTICE TO CONNECTICUT RESIDENTS ONLY: SECURITIES ACQUIRED BY CONNECTICUT RESIDENTS ARE BEING SOLD AS A TRANSACTION EXEMPT UNDER SECTION 36-490(b)(9)(A) OF THE CONNECTICUT UNIFORM SECURITIES ACT. THE SECURITIES HAVE NOT BEEN REGISTERED UNDER SAID ACT IN THE STATE OF CONNECTICUT. ALL INVESTORS SHOULD BE AWARE THAT THERE ARE CERTAIN RESTRICTIONS AS TO THE TRANSFERABILITY OF THE SECURITIES.</p>
    <p className="legal-caps">NOTICE TO DELAWARE RESIDENTS ONLY: IF YOU ARE A DELAWARE RESIDENT, YOU ARE HEREBY ADVISED THAT THESE SECURITIES ARE BEING OFFERED IN A TRANSACTION EXEMPT FROM THE REGISTRATION REQUIREMENTS OF THE DELAWARE SECURITIES ACT. THE SECURITIES CANNOT BE SOLD OR TRANSFERRED EXCEPT IN A TRANSACTION WHICH IS EXEMPT UNDER THE ACT OR PURSUANT TO AN EFFECTIVE REGISTRATION STATEMENT UNDER THE ACT OR IN A TRANSACTION WHICH IS OTHERWISE IN COMPLIANCE WITH THE ACT.</p>
    <p className="legal-caps">NOTICE TO DISTRICT OF COLUMBIA RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN APPROVED OR DISAPPROVED BY THE SECURITIES BUREAU OF THE DISTRICT OF COLUMBIA NOR HAS THE COMMISSIONER PASSED UPON THE ACCURACY OR ADEQUACY OF THIS DOCUMENT. ANY REPRESENTATION TO THE CONTRARY IS UNLAWFUL.</p>
    <p className="legal-caps">NOTICE TO FLORIDA RESIDENTS ONLY: THE SECURITIES DESCRIBED HEREIN HAVE NOT BEEN REGISTERED WITH THE FLORIDA DIVISION OF SECURITIES AND INVESTOR PROTECTION UNDER THE FLORIDA SECURITIES ACT. THE SECURITIES REFERRED TO HEREIN WILL BE SOLD TO AND ACQUIRED BY THE HOLDER IN A TRANSACTION EXEMPT UNDER SECTION 517.061 OF SAID ACT. IN ADDITION, ALL OFFEREES WHO ARE FLORIDA RESIDENTS SHOULD BE AWARE THAT SECTION 517.061(11)(a)(5) OF THE ACT PROVIDES THAT ANY SALE IN FLORIDA MADE PURSUANT TO THIS SECTION IS VOIDABLE BY THE PURCHASER WITHIN 3 DAYS AFTER THE FIRST TENDER OF CONSIDERATION.</p>
    <p className="legal-caps">NOTICE TO GEORGIA RESIDENTS ONLY: THESE SECURITIES ARE OFFERED IN A TRANSACTION EXEMPT FROM THE REGISTRATION REQUIREMENTS OF THE GEORGIA SECURITIES ACT PURSUANT TO REGULATION 590-4-5-.04 AND -.01. THE SECURITIES CANNOT BE SOLD OR TRANSFERRED EXCEPT IN A TRANSACTION WHICH IS EXEMPT UNDER THE ACT OR PURSUANT TO AN EFFECTIVE REGISTRATION STATEMENT UNDER THE ACT.</p>
    <p className="legal-caps">NOTICE TO HAWAII RESIDENTS ONLY: NEITHER THIS MEMORANDUM NOR THE SECURITIES DESCRIBED HEREIN HAVE BEEN APPROVED OR DISAPPROVED BY THE COMMISSIONER OF SECURITIES OF THE STATE OF HAWAII NOR HAS THE COMMISSIONER PASSED UPON THE ACCURACY OR ADEQUACY OF THIS MEMORANDUM.</p>
    <p className="legal-caps">NOTICE TO IDAHO RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN REGISTERED UNDER THE IDAHO SECURITIES ACT AND MAY NOT BE SOLD, TRANSFERRED, PLEDGED OR HYPOTHECATED EXCEPT IN A TRANSACTION WHICH IS EXEMPT UNDER SAID ACT OR PURSUANT TO AN EFFECTIVE REGISTRATION UNDER SAID ACT.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 47</span></div>
</div>

{/* PAGE 48 — STATE NOTICES CONTINUED */}
<div className="page" id="p48">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — State-Specific Legal Notices (Continued)</span><span className="page-num">Page 48</span></div>
  <div className="page-body">
    <div className="section-label">State-Specific Legal Notices (Continued)</div>
    <p className="legal-caps">NOTICE TO INDIANA RESIDENTS ONLY: THESE SECURITIES ARE OFFERED PURSUANT TO A CLAIM OF EXEMPTION UNDER SECTION 23-2-1-2 OF THE INDIANA SECURITIES LAW AND HAVE NOT BEEN REGISTERED UNDER SECTION 23-2-1-3.</p>
    <p className="legal-caps">NOTICE TO IOWA RESIDENTS ONLY: IN MAKING AN INVESTMENT DECISION INVESTORS MUST RELY ON THEIR OWN EXAMINATION OF THE PERSON OR ENTITY CREATING THE SECURITIES AND THE TERMS OF THE OFFERING. THESE SECURITIES ARE SUBJECT TO RESTRICTIONS ON TRANSFERABILITY AND RESALE.</p>
    <p className="legal-caps">NOTICE TO KANSAS RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION EXEMPT FROM REGISTRATION UNDER SECTION 81-5-6 OF THE KANSAS SECURITIES ACT AND MAY NOT BE RE-OFFERED FOR SALE, TRANSFERRED, OR RESOLD EXCEPT IN COMPLIANCE WITH SUCH ACT.</p>
    <p className="legal-caps">NOTICE TO KENTUCKY RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION EXEMPT FROM REGISTRATION UNDER RULE 808 OF THE KENTUCKY SECURITIES ACT AND MAY NOT BE RE-OFFERED FOR SALE, TRANSFERRED, OR RESOLD EXCEPT IN COMPLIANCE WITH SUCH ACT.</p>
    <p className="legal-caps">NOTICE TO LOUISIANA RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION EXEMPT FROM REGISTRATION UNDER RULE 1 OF THE LOUISIANA SECURITIES LAW AND MAY NOT BE RE-OFFERED FOR SALE, TRANSFERRED, OR RESOLD EXCEPT IN COMPLIANCE WITH SUCH ACT.</p>
    <p className="legal-caps">NOTICE TO MAINE RESIDENTS ONLY: THESE SECURITIES ARE OFFERED PURSUANT TO AN EXEMPTION UNDER §16202(15) OF THE MAINE UNIFORM SECURITIES ACT AND ARE NOT REGISTERED WITH THE SECURITIES ADMINISTRATOR OF THE STATE OF MAINE.</p>
    <p className="legal-caps">NOTICE TO MARYLAND RESIDENTS ONLY: THESE SECURITIES ARE BEING SOLD AS A TRANSACTION EXEMPT UNDER SECTION 11-602(9) OF THE MARYLAND SECURITIES ACT. ALL INVESTORS SHOULD BE AWARE THAT THERE ARE CERTAIN RESTRICTIONS AS TO THE TRANSFERABILITY OF THE SECURITIES.</p>
    <p className="legal-caps">NOTICE TO MASSACHUSETTS RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933, AS AMENDED, OR THE MASSACHUSETTS UNIFORM SECURITIES ACT. THESE SECURITIES CANNOT BE SOLD, TRANSFERRED, OR OTHERWISE DISPOSED OF TO ANY PERSON OR ENTITY UNLESS THEY ARE SUBSEQUENTLY REGISTERED OR AN EXEMPTION FROM REGISTRATION IS AVAILABLE.</p>
    <p className="legal-caps">NOTICE TO MICHIGAN RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN REGISTERED UNDER SECTION 451.701 OF THE MICHIGAN UNIFORM SECURITIES ACT AND MAY BE TRANSFERRED OR RESOLD BY RESIDENTS OF MICHIGAN ONLY IF REGISTERED PURSUANT TO THE PROVISIONS OF THE ACT, OR IF AN EXEMPTION FROM REGISTRATION IS AVAILABLE. THE INVESTMENT IS SUITABLE IF IT DOES NOT EXCEED 10% OF THE INVESTOR'S NET WORTH.</p>
    <p className="legal-caps">NOTICE TO MINNESOTA RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN REGISTERED UNDER CHAPTER 80A OF THE MINNESOTA SECURITIES LAWS AND MAY NOT BE SOLD, TRANSFERRED, OR OTHERWISE DISPOSED OF EXCEPT PURSUANT TO REGISTRATION, OR AN EXEMPTION THEREFROM.</p>
    <p className="legal-caps">NOTICE TO MISSISSIPPI RESIDENTS ONLY: THE SECURITIES ARE OFFERED PURSUANT TO A CLAIM OF EXEMPTION UNDER THE MISSISSIPPI SECURITIES ACT. EACH PURCHASER MUST MEET CERTAIN SUITABILITY STANDARDS AND MUST BE ABLE TO BEAR AN ENTIRE LOSS OF THIS INVESTMENT.</p>
    <p className="legal-caps">NOTICE TO MISSOURI RESIDENTS ONLY: THE SECURITIES OFFERED HEREIN WILL BE SOLD IN A TRANSACTION EXEMPT UNDER SECTION 4.G OF THE MISSOURI SECURITIES LAW OF 1953, AS AMENDED.</p>
    <p className="legal-caps">NOTICE TO MONTANA RESIDENTS ONLY: ANY INVESTOR WHO IS A MONTANA RESIDENT MUST HAVE A NET WORTH (EXCLUSIVE OF HOME, FURNISHINGS AND AUTOMOBILES) IN EXCESS OF FIVE (5) TIMES THE AGGREGATE AMOUNT INVESTED.</p>
    <p className="legal-caps">NOTICE TO NEBRASKA RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION EXEMPT FROM REGISTRATION UNDER CHAPTER 15 OF THE NEBRASKA SECURITIES LAW AND MAY NOT BE RE-OFFERED FOR SALE, TRANSFERRED, OR RESOLD EXCEPT IN COMPLIANCE WITH SUCH ACT.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 48</span></div>
</div>

{/* PAGE 49 — STATE NOTICES CONTINUED */}
<div className="page" id="p49">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — State-Specific Legal Notices (Continued)</span><span className="page-num">Page 49</span></div>
  <div className="page-body">
    <div className="section-label">State-Specific Legal Notices (Continued)</div>
    <p className="legal-caps">NOTICE TO NEVADA RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION EXEMPT FROM REGISTRATION UNDER THE NEVADA SECURITIES LAW. THE ATTORNEY GENERAL OF THE STATE OF NEVADA HAS NOT PASSED ON OR ENDORSED THE MERITS OF THIS OFFERING. (SEE NRS 90.530.11.)</p>
    <p className="legal-caps">NOTICE TO NEW HAMPSHIRE RESIDENTS ONLY: THE FACT THAT AN EXEMPTION OR EXCEPTION IS AVAILABLE FOR A SECURITY OR A TRANSACTION DOES NOT MEAN THAT THE SECRETARY OF STATE HAS PASSED IN ANY WAY UPON THE MERITS OR QUALIFICATIONS OF, OR RECOMMENDED OR GIVEN APPROVAL TO, ANY PERSON, SECURITY, OR TRANSACTION.</p>
    <p className="legal-caps">NOTICE TO NEW JERSEY RESIDENTS ONLY: THIS MEMORANDUM HAS NOT BEEN FILED WITH OR REVIEWED BY THE ATTORNEY GENERAL OF THE STATE OF NEW JERSEY PRIOR TO ITS ISSUANCE AND USE. THE ATTORNEY GENERAL OF THE STATE OF NEW JERSEY HAS NOT PASSED ON OR ENDORSED THE MERITS OF THIS OFFERING. ANY REPRESENTATION TO THE CONTRARY IS UNLAWFUL.</p>
    <p className="legal-caps">NOTICE TO NEW MEXICO RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN APPROVED OR DISAPPROVED BY THE SECURITIES DIVISION OF THE NEW MEXICO DEPARTMENT OF BANKING NOR HAS THE SECURITIES DIVISION PASSED UPON THE ACCURACY OR ADEQUACY OF THIS MEMORANDUM. ANY REPRESENTATION TO THE CONTRARY IS A CRIMINAL OFFENSE.</p>
    <p className="legal-caps">NOTICE TO NEW YORK RESIDENTS ONLY: THIS DOCUMENT HAS NOT BEEN REVIEWED BY THE ATTORNEY GENERAL OF THE STATE OF NEW YORK PRIOR TO ITS ISSUANCE AND USE. THE ATTORNEY GENERAL OF THE STATE OF NEW YORK HAS NOT PASSED ON OR ENDORSED THE MERITS OF THIS OFFERING. ANY REPRESENTATION TO THE CONTRARY IS UNLAWFUL.</p>
    <p className="legal-caps">NOTICE TO NORTH CAROLINA RESIDENTS ONLY: IN MAKING AN INVESTMENT DECISION, INVESTORS MUST RELY ON THEIR OWN EXAMINATION OF THE PERSON OR ENTITY CREATING THE SECURITIES AND THE TERMS OF THE OFFERING. THESE SECURITIES ARE SUBJECT TO RESTRICTIONS ON TRANSFERABILITY AND RESALE.</p>
    <p className="legal-caps">NOTICE TO NORTH DAKOTA RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN APPROVED OR DISAPPROVED BY THE SECURITIES COMMISSIONER OF THE STATE OF NORTH DAKOTA NOR HAS THE COMMISSIONER PASSED UPON THE ACCURACY OR ADEQUACY OF THIS MEMORANDUM. ANY REPRESENTATION TO THE CONTRARY IS A CRIMINAL OFFENSE.</p>
    <p className="legal-caps">NOTICE TO OHIO RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION EXEMPT FROM REGISTRATION UNDER SECTION 1707.03(Q) OR (X) OF THE OHIO SECURITIES LAW AND MAY NOT BE RE-OFFERED FOR SALE, TRANSFERRED, OR RESOLD EXCEPT IN COMPLIANCE WITH SUCH ACT.</p>
    <p className="legal-caps">NOTICE TO OKLAHOMA RESIDENTS ONLY: THESE SECURITIES ARE OFFERED FOR SALE IN THE STATE OF OKLAHOMA IN RELIANCE UPON AN EXEMPTION FROM REGISTRATION FOR PRIVATE OFFERINGS. SUCH FILING IS PERMISSIVE ONLY AND DOES NOT CONSTITUTE AN APPROVAL, RECOMMENDATION OR ENDORSEMENT.</p>
    <p className="legal-caps">NOTICE TO OREGON RESIDENTS ONLY: THE INVESTOR MUST RELY ON THE INVESTOR'S OWN EXAMINATION OF THE COMPANY CREATING THE SECURITIES, AND THE TERMS OF THE OFFERING INCLUDING THE MERITS AND RISKS INVOLVED IN MAKING AN INVESTMENT DECISION ON THESE SECURITIES.</p>
    <p className="legal-caps">NOTICE TO PENNSYLVANIA RESIDENTS ONLY: EACH PERSON WHO ACCEPTS AN OFFER TO PURCHASE SECURITIES EXEMPTED FROM REGISTRATION BY SECTION 203(d) SHALL HAVE THE RIGHT TO WITHDRAW HIS ACCEPTANCE WITHOUT INCURRING ANY LIABILITY WITHIN TWO (2) BUSINESS DAYS FROM THE DATE OF RECEIPT BY THE ISSUER OF HIS WRITTEN BINDING CONTRACT OF PURCHASE.</p>
    <p className="legal-caps">NOTICE TO RHODE ISLAND RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN APPROVED OR DISAPPROVED BY THE DEPARTMENT OF BUSINESS REGULATION OF THE STATE OF RHODE ISLAND NOR HAS THE DIRECTOR PASSED UPON THE ACCURACY OR ADEQUACY OF THIS DOCUMENT. ANY REPRESENTATION TO THE CONTRARY IS UNLAWFUL.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 49</span></div>
</div>

{/* PAGE 50 — STATE NOTICES CONTINUED */}
<div className="page" id="p50">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — State-Specific Legal Notices (Continued)</span><span className="page-num">Page 50</span></div>
  <div className="page-body">
    <div className="section-label">State-Specific Legal Notices (Continued)</div>
    <p className="legal-caps">NOTICE TO SOUTH DAKOTA RESIDENTS ONLY: THESE SECURITIES ARE BEING OFFERED FOR SALE IN THE STATE OF SOUTH DAKOTA PURSUANT TO AN EXEMPTION FROM REGISTRATION UNDER THE SOUTH DAKOTA BLUE SKY LAW, CHAPTER 47-31. THE EXEMPTION DOES NOT CONSTITUTE A FINDING THAT THIS MEMORANDUM IS TRUE, COMPLETE, AND NOT MISLEADING. ANY REPRESENTATION TO THE CONTRARY IS A CRIMINAL OFFENSE.</p>
    <p className="legal-caps">NOTICE TO TENNESSEE RESIDENTS ONLY: IN MAKING AN INVESTMENT DECISION INVESTORS MUST RELY ON THEIR OWN EXAMINATION OF THE ISSUER AND THE TERMS OF THE OFFERING. THESE SECURITIES ARE SUBJECT TO RESTRICTIONS ON TRANSFERABILITY AND RESALE AND MAY NOT BE TRANSFERRED OR RESOLD EXCEPT AS PERMITTED UNDER THE SECURITIES ACT OF 1933.</p>
    <p className="legal-caps">NOTICE TO UTAH RESIDENTS ONLY: THESE SECURITIES ARE BEING OFFERED IN A TRANSACTION EXEMPT FROM THE REGISTRATION REQUIREMENTS OF THE UTAH SECURITIES ACT. THE SECURITIES CANNOT BE TRANSFERRED OR SOLD EXCEPT IN TRANSACTIONS WHICH ARE EXEMPT UNDER THE ACT OR PURSUANT TO AN EFFECTIVE REGISTRATION STATEMENT.</p>
    <p className="legal-caps">NOTICE TO VERMONT RESIDENTS ONLY: THESE SECURITIES HAVE NOT BEEN APPROVED OR DISAPPROVED BY THE SECURITIES DIVISION OF THE STATE OF VERMONT NOR HAS THE COMMISSIONER PASSED UPON THE ACCURACY OR ADEQUACY OF THIS DOCUMENT. ANY REPRESENTATION TO THE CONTRARY IS UNLAWFUL.</p>
    <p className="legal-caps">NOTICE TO VIRGINIA RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION UNDER SECTION 13.1-514 OF THE VIRGINIA SECURITIES ACT AND MAY NOT BE RE-OFFERED FOR SALE, TRANSFERRED, OR RESOLD EXCEPT IN COMPLIANCE WITH SUCH ACT.</p>
    <p className="legal-caps">NOTICE TO WASHINGTON RESIDENTS ONLY: THE ADMINISTRATOR OF SECURITIES HAS NOT REVIEWED THE OFFERING OR MEMORANDUM AND THE SECURITIES HAVE NOT BEEN REGISTERED IN RELIANCE UPON THE SECURITIES ACT OF WASHINGTON, CHAPTER 21.20 RCW.</p>
    <p className="legal-caps">NOTICE TO WEST VIRGINIA RESIDENTS ONLY: THE SECURITIES WILL BE SOLD IN A TRANSACTION EXEMPT FROM REGISTRATION UNDER SECTION 15.06(b)(9) OF THE WEST VIRGINIA SECURITIES LAW AND MAY NOT BE REOFFERED FOR SALE, TRANSFERRED, OR RESOLD EXCEPT IN COMPLIANCE WITH SUCH ACT.</p>
    <p className="legal-caps">NOTICE TO WISCONSIN RESIDENTS ONLY: ANY INVESTOR WHO IS A WISCONSIN RESIDENT MUST HAVE A NET WORTH (EXCLUSIVE OF HOME, FURNISHINGS AND AUTOMOBILES) IN EXCESS OF THREE AND ONE-THIRD (3 1/3) TIMES THE AGGREGATE AMOUNT INVESTED BY SUCH INVESTOR IN THE SECURITIES OFFERED HEREIN.</p>
    <p className="legal-caps">NOTICE TO WYOMING RESIDENTS ONLY: Rosie AI LLC IS A WYOMING LIMITED LIABILITY COMPANY. ALL WYOMING RESIDENTS WHO SUBSCRIBE TO PURCHASE SECURITIES OFFERED BY THE COMPANY MUST SATISFY MINIMUM FINANCIAL SUITABILITY REQUIREMENTS IN ORDER TO PURCHASE SECURITIES. INVESTORS ARE URGED TO CONSULT THE WYOMING LIMITED LIABILITY COMPANY ACT REGARDING THEIR RIGHTS AND OBLIGATIONS AS MEMBERS.</p>
    <p>During the course of the Offering and prior to any sale, each offeree of the Securities and his or her professional advisor(s), if any, are invited to ask questions concerning the terms and conditions of the Offering and to obtain any additional information necessary to verify the accuracy of the information set forth herein. Such information will be provided to the extent the Company possesses such information or can acquire it without unreasonable effort or expense.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 50</span></div>
</div>

{/* PAGE 51 — RISK FACTORS CONTINUED */}
<div className="page" id="p51">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Risk Factors (Continued)</span><span className="page-num">Page 51</span></div>
  <div className="page-body">
    <div className="section-label">Risk Factors</div>
    <div className="risk-box">
      <p className="legal-caps"><strong>AN INVESTMENT IN THE UNITS THAT ARE THE SUBJECT OF THIS MEMORANDUM IS HIGHLY SPECULATIVE AND INVOLVES A HIGH DEGREE OF RISK. INVESTORS SHOULD BE ABLE TO WITHSTAND THE TOTAL LOSS OF THEIR ENTIRE INVESTMENT IN THE UNITS.</strong></p>
    </div>
    <p>Prospective purchasers should carefully review the information set forth under "Risk Factors" as well as other technical and financial information contained in this Memorandum. There can be no assurance that the Company's technical objectives — including the successful enterprise migration of the "v6 Engine" — can be achieved.</p>
    <h3>Financial Projections and Technical Performance Benchmarks Require Caution</h3>
    <p>Investors are urged to consider that the financial projections discussed in this Memorandum — specifically the growth milestones projecting 50 orgs by Q4 2026, 250 by end of 2027 ($2.25M ARR), and 2,000 by end of 2028 ($19.7M ARR) — assume a specific rate of market adoption and system performance. Break-even is projected at approximately 15 paying organizations at an average MRR of $700/org, reflecting total fixed monthly operating costs of $10,100.</p>
    <p>Such projections are not guarantees of future financial performance. Performance may be impacted by AI Model Decay (fluctuations in LLM accuracy), Infrastructure Reliability (maintaining the 150+ backend functions at enterprise scale), and Subscription Churn (ability of B2B clients to integrate autonomous agents).</p>
    <p>Although Management has a reasonable basis for these projections, Investors should be aware of the inherent inaccuracies of forecasting in the high-growth AI SaaS sector.</p>
    <h3>Considerations for Tax-Exempt Investors</h3>
    <p>Any tax-exempt investor, such as pension plans or Individual Retirement Accounts (IRAs), may have to recognize some or all of its allocable share of Company income as Unrelated Business Taxable Income (UBTI). Because Rosie AI, LLC is structured as a Wyoming Limited Liability Company with pass-through taxation, the nature of the Company's SaaS revenue may trigger tax liabilities for exempt entities.</p>
    <p>Tax-exempt investors are strongly urged to consult with their own tax advisor to evaluate the implications of UBTI before committing capital.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 51</span></div>
</div>

{/* PAGE 52 — RISK FACTORS CONTINUED (REGULATORY & MARKET) */}
<div className="page" id="p52">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Risk Factors (Continued)</span><span className="page-num">Page 52</span></div>
  <div className="page-body">
    <div className="section-label">Risk Factors (Continued)</div>
    <h3>Indemnification of Management</h3>
    <p>The Operating Agreement provides that the Company will hold its Managing Partner and Chief Technology Engineer harmless against certain claims, provided they are not guilty of gross negligence or fraud. If the Company is called upon to perform under these indemnification agreements, the assets available for technical development or investor distributions would be significantly reduced.</p>
    <div className="section-label navy-light" style="margin-top:14px;">Regulatory &amp; Tax Risks</div>
    <h3>AI and Privacy Regulations</h3>
    <p>There is a risk that future state or federal legislation may restrict the use of autonomous AI agents for sales and marketing. New laws governing "AI transparency" or data privacy could change the criteria for how the Company's pipelines operate.</p>
    <h3>Federal and State Income Tax Risks</h3>
    <p>The Company is structured as a Wyoming LLC for pass-through tax treatment. However, the IRS may not accept the tax positions taken by the Company. <strong>THE COMPANY HAS NOT OBTAINED A LEGAL OPINION CONCERNING THE TAX IMPLICATIONS.</strong> Investors are urged to consult their own tax advisors regarding their specific situation.</p>
    <h3>Risk of Audit</h3>
    <p>The Company's federal tax returns may be audited by the IRS. An audit could result in the challenge of deductions or an increase in taxable income, potentially impacting the Company's allocation of return of capital and income distributions.</p>
    <div className="section-label navy-light" style="margin-top:14px;">Market &amp; Liquidity Risks</div>
    <h3>Lack of Investment Diversification</h3>
    <p>The Company's revenue is currently concentrated in high-alpha verticals like Solar, Roofing, and SaaS. If these specific sectors experience an economic downturn, the demand for the Company's autonomous lead generation services could decrease significantly.</p>
    <h3>Restricted Transferability</h3>
    <p>Investors should expect to bear the economic risk of their investment for an indefinite period. The Units have not been registered and are "restricted securities." They may only be transferred in strict compliance with the Operating Agreement and applicable securities laws.</p>
    <h3>Determination of Offering Price</h3>
    <p>The Offering price of the Units and the resulting 21.5% equity stake have been arbitrarily determined by the Company based on technical milestones and projected unit economics. There is no assurance that the Units could be sold for the offering price in a secondary transaction.</p>
    <div className="risk-box"><p className="legal-caps">INVESTORS ARE NOT TO CONSTRUE THIS MEMORANDUM AS CONSTITUTING LEGAL OR TAX ADVICE. BEFORE MAKING ANY DECISION TO INVEST, INVESTORS SHOULD READ THIS ENTIRE PROSPECTUS, INCLUDING ALL TECHNICAL EXHIBITS, AND CONSULT WITH THEIR OWN INVESTMENT, LEGAL, TAX, AND OTHER PROFESSIONAL ADVISORS.</p></div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 52</span></div>
</div>

{/* PAGE 53 — ERISA CONSIDERATIONS */}
<div className="page" id="p53">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — ERISA Considerations</span><span className="page-num">Page 53</span></div>
  <div className="page-body">
    <div className="section-label">ERISA Considerations</div>
    <h3>General Fiduciary Responsibility</h3>
    <p>It is anticipated that some Investors in Rosie AI LLC will be corporate pension plans, profit-sharing plans, or other employee benefit plans subject to ERISA.</p>
    <p>In such cases, the person making the investment decision concerning the purchase of Class B Units will be considered a "fiduciary" of that plan and is required to conform to ERISA's fiduciary responsibility rules.</p>
    <div className="notice-block">
      <p className="legal-caps">DUE TO THE COMPLEX NATURE OF ERISA, EACH PROSPECTIVE INVESTOR IS STRONGLY URGED TO CONSULT THEIR OWN TAX ADVISOR OR PENSION CONSULTANT TO DETERMINE THE APPLICATION OF ERISA TO THEIR PROSPECTIVE INVESTMENT.</p>
    </div>
    <h3>The Prudent Man Standard</h3>
    <p>Fiduciaries making investment decisions for employee benefit plans must discharge their duties with the care, skill, and prudence that a "prudent man" familiar with such matters would exercise in like circumstances. When evaluating an investment in the Company, fiduciaries should carefully consider:</p>
    <ul className="dot-list">
      <li><strong>Diversification:</strong> Whether the investment in a high-leverage technology company is consistent with the diversification requirements of ERISA.</li>
      <li><strong>UBTI Risks:</strong> The possibility and consequences of Unrelated Business Taxable Income (UBTI), as the Company is structured as a pass-through entity (Wyoming LLC).</li>
      <li><strong>Liquidity:</strong> The Company is an early-stage venture with substantial restrictions on transferability. Fiduciaries must not rely on the ability to convert an investment in the Company into cash to meet immediate liabilities to plan participants.</li>
    </ul>
    <div className="risk-box"><p className="legal-caps">FAILURE TO CONFORM TO THE PRUDENT MAN STANDARD MAY EXPOSE A FIDUCIARY TO PERSONAL LIABILITY FOR ANY RESULTING LOSSES.</p></div>
    <h3>Investment Suitability for Tax-Advantaged Plans</h3>
    <p>While the Company provides 24/7 transparency through the Rosie AI Investor Portal, the underlying asset — proprietary AI software and data pipelines — is considered a long-term, illiquid holding. Fiduciaries must determine if the "v6 Engine" technical roadmap and the projected Profit Waterfall align with the plan's specific liquidity horizons and risk tolerance.</p>
    <div className="info-box" style="margin-top:20px;text-align:center;">
      <div className="info-box-title">Investor Portal</div>
      <p style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--navy);font-weight:500;">https://investors.rosieai.tech/portal</p>
    </div>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 53</span></div>
</div>

{/* PAGE 54 — ANNUAL VALUATION & REGULATORY MATTERS */}
<div className="page" id="p54">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Annual Valuation &amp; Regulatory Matters</span><span className="page-num">Page 54</span></div>
  <div className="page-body">
    <div className="section-label">Annual Valuation &amp; Regulatory Matters</div>
    <h3>Annual Valuation</h3>
    <p>Fiduciaries of plans subject to ERISA are required to determine annually the fair market value (FMV) of the assets of such plans as of the close of the plan's fiscal year. Upon written request from a Member, the Managing Partner will provide an annual estimate of the value of the Membership Interests.</p>
    <p>This valuation will be based upon, among other things, the Company's proprietary technology assets, the verified intellectual property comprising the "v6 Engine," and the capitalized value of active SaaS subscription contracts. However, Investors should be aware that it may not be possible to value the Units adequately from year to year due to the lack of a public secondary market.</p>
    <h3>Certain Regulatory Matters</h3>
    <p><strong>Investment Company Act of 1940</strong><br />The Company anticipates that it will be exempt from the provisions of the Investment Company Act of 1940, primarily in reliance upon the exemption provided by Section 3(c)(1) thereof, which excludes from the definition of an investment company any issuer whose outstanding securities are beneficially owned by not more than one hundred persons.</p>
    <p><strong>Anti-Money Laundering (AML) Requirements</strong><br />The Company requires strict adherence to AML protocols. Prospective Investors must provide comprehensive documentation via the Rosie AI Investor Portal to verify their identity and the source of the funds used for the purchase of Units. The Company utilizes an automated KYC workflow to screen all subscribers.</p>
    <p><strong>The PATRIOT Act and Related Regulations</strong><br />Units may not be offered, sold, transferred, or delivered, directly or indirectly, to any "Unacceptable Investor," including any person designated as a "specially designated national" or "blocked person" by the U.S. Treasury Department's Office of Foreign Assets Control (OFAC), or any person involved in terrorist activities or money laundering.</p>
    <p><strong>Conflicts of Interest</strong><br />The Managing Partner, the Chief Technology Engineer, and their affiliates may engage, for their own account or for the account of others, in other business ventures similar to those of the Company. Neither the Company nor any Investor shall be entitled to any interest in such independent ventures.</p>
    <div className="notice-block"><p className="legal-caps">THE FOREGOING SPECIAL CONSIDERATIONS DO NOT PURPORT TO BE A COMPLETE EXPLANATION OF THE RISKS INVOLVED IN THIS OFFERING. PROSPECTIVE INVESTORS SHOULD READ THE ENTIRE MEMORANDUM AND CONSULT THE OPERATING AGREEMENT VIA THE INVESTOR PORTAL BEFORE DETERMINING TO INVEST IN THE COMPANY.</p></div>
    <p>Investor Portal: <strong>https://investors.rosieai.tech/portal</strong></p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 54</span></div>
</div>

{/* PAGE 55 — CONFIDENTIALITY & FORWARD-LOOKING STATEMENTS */}
<div className="page" id="p55">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Confidentiality and Forward-Looking Statements</span><span className="page-num">Page 55</span></div>
  <div className="page-body">
    <div className="section-label">Confidentiality and Related Matters</div>
    <p>Each recipient of this Memorandum, by accepting delivery hereof, agrees that the information contained herein is of a strictly confidential and proprietary nature. The recipient shall treat such information — including, but not limited to, the technical specifications of the "v6 Engine," the architecture of the 150+ backend functions, and the operational details of the 7 active discovery pipelines — in a strictly confidential manner.</p>
    <p>Recipients shall not disclose such information to any other person or entity, nor reproduce such information, in whole or in part, without the prior written consent of Rosie AI LLC. Furthermore, each recipient agrees to use this information solely for the purpose of analyzing the desirability of an investment in the Company and for no other purpose whatsoever. Any unauthorized use of this technical "moat" or proprietary data ingestion logic may result in immediate legal action and the termination of access to the Rosie AI Investor Portal.</p>
    <div className="section-label" style="margin-top:18px;">Notice Regarding Forward-Looking Statements</div>
    <p>Certain statements set forth in this Memorandum constitute "Forward-Looking Statements." These forward-looking statements include, without limitation, any statement that may predict, forecast, indicate, or imply future results, performance, or technical achievements.</p>
    <p>In the context of Rosie AI LLC, these statements specifically include, but are not limited to:</p>
    <ul className="dot-list">
      <li>Projections regarding the 91% accuracy benchmark of AI-generated outputs.</li>
      <li>Forecasts concerning Annual Recurring Revenue (ARR) and lead conversion velocity.</li>
      <li>Plans for the migration of the platform to a multi-tenant enterprise-ready system.</li>
      <li>Anticipated cost savings derived from the Philippine-based engineering unit.</li>
    </ul>
    <p>All such forward-looking statements involve significant risks and uncertainties. Technical R&amp;D in the AI orchestration sector is subject to rapid shifts in API availability, model drift, and infrastructure scalability. Therefore, prospective Investors are cautioned that there can be no assurance that the forward-looking statements included in this Memorandum will prove to be accurate.</p>
  </div>
  <div className="page-footer"><span className="footer-left">Rosie AI, LLC — Confidential PPM</span><span className="footer-right">Page 55</span></div>
</div>

{/* PAGE 56 — ADDITIONAL INFORMATION / SUMMARY */}
<div className="page" id="p56">
  <div className="page-header"><span className="doc-title">Rosie AI, LLC — Additional Information &amp; Summary</span><span className="page-num">Page 56</span></div>
  <div className="page-body">
    <div className="section-label">Additional Information</div>
    <p>Representatives of the Company are available at our principal executive office in Sheridan, Wyoming, to discuss and answer questions concerning this Memorandum, the technical roadmap of the "v6 Engine," and the specific terms and conditions of this Offering.</p>
    <p>Management will provide any additional information which the Company possesses — or can acquire without unreasonable effort or expense — that is necessary to verify the accuracy of the information set forth herein and in the accompanying Technical Exhibits. For immediate access to documentation, audit logs, and direct communication with the Managing Partner, Investors are encouraged to utilize the Rosie AI Investor Portal.</p>
    <div className="section-label" style="margin-top:18px;">Summary</div>
    <p>The preceding summary is qualified in its entirety by the detailed technical and financial information appearing elsewhere in this Memorandum. Although this Memorandum provides potential Investors with specific references and subject headings, the information appearing under those headings is not necessarily a complete or exclusive discussion of that subject.</p>
    <p>References in this Memorandum to the "Company," "we," "us," and "our" refer to Rosie AI LLC.</p>
    <p>An investment in the securities offered hereby involves a high degree of risk and is suitable only for sophisticated investors who can afford the total loss of their capital. Prospective Investors are urged to read this Memorandum carefully in its entirety, including the section entitled "Risk Factors," the Operating Agreement, and the technical specifications of the AI orchestration platform attached as Exhibits.</p>
    <div style="margin-top:32px;padding:24px;background:var(--navy);border-radius:2px;text-align:center;">
      <p style="color:rgba(255,255,255,.65);font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px;">End of Private Placement Memorandum</p>
      <p style="color:#fff;font-family:'Playfair Display',serif;font-size:18px;font-weight:700;margin-bottom:6px;">Rosie AI, LLC</p>
      <p style="color:var(--gold);font-family:'JetBrains Mono',monospace;font-size:10px;">506(c) PPM · Confidential · Accredited Investors Only</p>
      <div style="margin:16px auto;width:60px;height:1px;background:var(--gold);"></div>
      <p style="color:rgba(255,255,255,.7);font-size:10px;margin-bottom:4px;">Investor Portal: <strong style="color:#fff;">https://investors.rosieai.tech/portal</strong></p>
      <p style="color:rgba(255,255,255,.7);font-size:10px;">Contact: <strong style="color:#fff;">Investors@rosieai.tech</strong></p>
      <p style="color:rgba(255,255,255,.5);font-size:10px;margin-top:6px;">32 N Gould St, Sheridan, WY 82801</p>
    </div>
  </div>
  <div className="page-footer">
    <span className="footer-left">Rosie AI, LLC — Confidential PPM</span>
    <span className="footer-right">Page 56</span>
  </div>
</div>`;

export default function Offering() {
  useEffect(() => {
    // Inject styles
    if (!document.getElementById('rosie-ppm-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'rosie-ppm-styles';
      styleEl.textContent = cssStyles;
      document.head.appendChild(styleEl);
    }

    // Build page-jump select options
    const sel = document.getElementById('page-jump');
    if (sel && sel.options.length === 0) {
      for (let i = 1; i <= 56; i++) {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = 'Page ' + i;
        sel.appendChild(o);
      }
      sel.addEventListener('change', (e) => {
        const el = document.getElementById('p' + e.target.value);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }

    return () => {
      const styleEl = document.getElementById('rosie-ppm-styles');
      if (styleEl) styleEl.remove();
    };
  }, []);

  return (
    <div
      id="rosie-ppm-root"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}