import { useState, useEffect, useRef } from "react";
import LiveCodebaseExplorer from "./LiveCodebaseExplorer";

// ══ STYLES ══════════════════════════════════════════════════════════════════
const G = {
  fonts: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`,
  ink: "#070709", ink2: "#0d0d11", ink3: "#121218", ink4: "#18181f", ink5: "#1e1e28",
  gold: "#c9a84c", goldB: "#deba6a", goldL: "#f0d898", goldD: "#8a6b28",
  goldDim: "rgba(201,168,76,0.10)", goldBdr: "rgba(201,168,76,0.25)", goldGlow: "rgba(201,168,76,0.18)",
  cream: "#f0ead8", white: "#ffffff",
  t1: "#e8e2d0", t2: "#9a9280", t3: "#5a5448", t4: "#35322c",
  em: "#22c55e", emDim: "rgba(34,197,94,0.12)", emBdr: "rgba(34,197,94,0.28)",
  ruby: "#e55454", ruDim: "rgba(229,84,84,0.12)",
  sky: "#38bdf8", skyDim: "rgba(56,189,248,0.10)",
  bdr: "rgba(201,168,76,0.10)", bdr2: "rgba(201,168,76,0.18)",
};

const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  html { scroll-behavior: smooth; }
  body { font-family: 'DM Sans', sans-serif; background: #070709; color: #e8e2d0; line-height: 1.6; overflow-x: hidden; }
  h1,h2,h3,h4,h5 { font-family: 'Playfair Display', serif; line-height: 1.15; }
  p { color: #9a9280; font-size: 15px; line-height: 1.78; }
  strong { color: #e8e2d0; font-weight: 600; }
  code { background: #18181f; color: #deba6a; padding: 2px 6px; border-radius: 4px; font-family: 'DM Mono', monospace; font-size: 11px; border: 1px solid rgba(201,168,76,0.1); }
  ul { color: #9a9280; padding-left: 20px; margin-bottom: 14px; font-size: 14px; }
  li { margin-bottom: 5px; line-height: 1.65; }
  table { border-collapse: collapse; width: 100%; }

  /* Scroll progress */
  #prog { position: fixed; top: 0; left: 0; height: 2px; z-index: 2000; background: linear-gradient(90deg,#8a6b28,#deba6a,#f0d898); transition: width .15s linear; }

  /* Grain */
  body::after { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 1000; opacity: 0.022; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E"); }

  /* Nav */
  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 900; height: 66px; display: flex; align-items: center; justify-content: space-between; padding: 0 48px; background: rgba(7,7,9,0.92); backdrop-filter: blur(24px) saturate(1.4); border-bottom: 1px solid rgba(201,168,76,0.10); }
  .nav-brand { display: flex; align-items: center; gap: 11px; }
  .nav-gem { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg,#8a6b28 0%,#deba6a 100%); display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 0 0 18px rgba(201,168,76,0.45); }
  .nav-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: #f0ead8; }
  .nav-sub { font-size: 10px; color: #5a5448; letter-spacing: 0.08em; text-transform: uppercase; }
  .nav-tabs { display: flex; gap: 2px; background: #18181f; border: 1px solid rgba(201,168,76,0.10); border-radius: 9px; padding: 3px; flex-wrap: wrap; }
  .nav-tab { padding: 7px 16px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; color: #5a5448; border: none; background: transparent; transition: all 0.18s; letter-spacing: 0.02em; font-family: 'DM Sans', sans-serif; }
  .nav-tab:hover { color: #9a9280; background: rgba(255,255,255,0.04); }
  .nav-tab.active { background: rgba(201,168,76,0.10); color: #deba6a; border: 1px solid rgba(201,168,76,0.25) !important; }

  /* Pages */
  .page { display: none; animation: pgIn 0.4s ease both; }
  .page.active { display: block; }
  @keyframes pgIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

  /* Animations */
  @keyframes riseIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
  @keyframes rod { 0%{opacity:0;transform:scaleY(0) translateY(-50%)} 40%{opacity:1;transform:scaleY(1) translateY(0)} 100%{opacity:0;transform:scaleY(1) translateY(100%)} }
  .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.65s ease, transform 0.65s ease; }
  .reveal.vis { opacity: 1; transform: none; }

  /* Layout */
  .wrap { max-width: 1100px; margin: 0 auto; padding: 0 40px; }
  .pad { padding: 108px 0; }
  .pad-sm { padding: 72px 0; }
  .slab { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6b28; display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .slab::before { content: ''; width: 24px; height: 1px; background: #8a6b28; }
  .h2 { font-size: clamp(28px,3.2vw,44px); color: #f0ead8; margin-bottom: 14px; }
  .lead { font-size: 16px; color: #9a9280; line-height: 1.75; max-width: 560px; margin-bottom: 44px; }
  .divgold { height: 1px; background: linear-gradient(to right,transparent,rgba(201,168,76,0.25) 20%,rgba(201,168,76,0.25) 80%,transparent); margin: 0; }

  /* Hero */
  .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 140px 24px 80px; position: relative; overflow: hidden; }
  .hero-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 90% 60% at 50% -5%,rgba(201,168,76,0.14) 0%,transparent 65%), radial-gradient(ellipse 50% 40% at 80% 70%,rgba(56,189,248,0.04) 0%,transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%,rgba(34,197,94,0.03) 0%,transparent 60%); }
  .hero-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(201,168,76,0.05) 1px,transparent 1px), linear-gradient(90deg,rgba(201,168,76,0.05) 1px,transparent 1px); background-size: 80px 80px; mask-image: radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 80%); }
  .hero-eyebrow { display: inline-flex; align-items: center; gap: 9px; margin-bottom: 28px; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #deba6a; background: rgba(201,168,76,0.10); border: 1px solid rgba(201,168,76,0.25); padding: 7px 20px; border-radius: 40px; position: relative; z-index: 1; animation: riseIn 0.7s ease both; }
  .pulse { width: 7px; height: 7px; background: #deba6a; border-radius: 50%; animation: pulse 2.2s infinite; }
  .hero h1 { font-size: clamp(44px,7vw,94px); font-weight: 900; position: relative; z-index: 1; background: linear-gradient(155deg,#ffffff 0%,#f0d898 35%,#c9a84c 65%,#8a6b28 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 12px; animation: riseIn 0.7s 0.08s ease both; }
  .hero-deck { font-size: 18px; color: #9a9280; max-width: 640px; line-height: 1.7; margin-bottom: 44px; position: relative; z-index: 1; animation: riseIn 0.7s 0.16s ease both; }
  .hero-scroll { position: absolute; bottom: 44px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 7px; color: #5a5448; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; animation: fadeIn 1.2s 0.8s both; cursor: pointer; }
  .scroll-rod { width: 1px; height: 44px; background: linear-gradient(to bottom,rgba(201,168,76,0.25),transparent); animation: rod 2.2s infinite; }

  /* Cards - Metric 3-across */
  .metric-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin: 28px 0 44px; }
  .metric-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 14px; padding: 22px 20px; text-align: center; position: relative; overflow: hidden; aspect-ratio: 16/9; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .metric-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg,#8a6b28,#deba6a); }
  .metric-card-n { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 800; background: linear-gradient(135deg,#deba6a,#f0d898); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; display: block; line-height: 1; margin-bottom: 8px; }
  .metric-card-l { font-size: 12px; color: #5a5448; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; margin-bottom: 6px; }
  .metric-card-sub { font-size: 11px; color: #35322c; }

  /* Market grid */
  .market-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 20px; margin-bottom: 44px; }
  .mcard { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 16px; padding: 30px 28px; position: relative; overflow: hidden; transition: border-color 0.2s; }
  .mcard:hover { border-color: rgba(201,168,76,0.18); }
  .mcard::after { content: ''; position: absolute; top: -30px; right: -30px; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle,rgba(201,168,76,0.18) 0%,transparent 70%); }
  .mcard-icon { font-size: 26px; margin-bottom: 14px; }
  .mcard-market { font-size: 11px; font-weight: 700; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .mcard-size { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #f0ead8; margin-bottom: 4px; }
  .mcard-proj { font-size: 13px; color: #9a9280; margin-bottom: 10px; }
  .mcard-cagr { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.28); }
  .mcard-desc { font-size: 13px; color: #5a5448; margin-top: 12px; line-height: 1.6; }

  /* Market callout */
  .market-callout { background: linear-gradient(135deg,rgba(201,168,76,0.07) 0%,rgba(201,168,76,0.02) 100%); border: 1px solid rgba(201,168,76,0.18); border-radius: 16px; padding: 36px 40px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-bottom: 44px; }
  .mc-stat { text-align: center; }
  .mc-num { font-family: 'Playfair Display', serif; font-size: 42px; font-weight: 800; color: #deba6a; display: block; line-height: 1; margin-bottom: 6px; }
  .mc-label { font-size: 12px; color: #5a5448; text-transform: uppercase; letter-spacing: 0.1em; }

  /* Diff grid */
  .diff-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 48px; }
  .diff-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 14px; padding: 22px; transition: all 0.2s; }
  .diff-card:hover { border-color: rgba(201,168,76,0.25); background: #18181f; }
  .diff-icon { font-size: 22px; margin-bottom: 12px; }
  .diff-title { font-size: 14px; font-weight: 700; color: #f0ead8; margin-bottom: 8px; }
  .diff-desc { font-size: 12px; color: #9a9280; line-height: 1.6; }

  /* VS table */
  .vs-table th { background: #18181f; color: #5a5448; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 12px 18px; border: 1px solid rgba(201,168,76,0.10); text-align: left; }
  .vs-table th.ours { background: rgba(201,168,76,0.10); color: #deba6a; border-color: rgba(201,168,76,0.25); }
  .vs-table td { padding: 12px 18px; border: 1px solid rgba(201,168,76,0.10); font-size: 13px; color: #9a9280; vertical-align: top; }
  .vs-table td.ours { background: rgba(201,168,76,0.04); color: #e8e2d0; border-color: rgba(201,168,76,0.25); }
  .vs-table td:first-child { color: #e8e2d0; font-weight: 500; }

  /* Audit banner */
  .audit-banner { background: linear-gradient(135deg,rgba(201,168,76,0.07),rgba(201,168,76,0.02)); border: 1px solid rgba(201,168,76,0.25); border-radius: 16px; padding: 28px 36px; display: flex; align-items: center; gap: 24px; margin-bottom: 52px; cursor: pointer; transition: border-color 0.2s; }
  .audit-banner:hover { border-color: rgba(201,168,76,0.45); }
  .audit-badge-icon { font-size: 36px; flex-shrink: 0; }
  .audit-badge-text h4 { font-family: 'Playfair Display', serif; font-size: 18px; color: #f0ead8; margin-bottom: 6px; }
  .audit-badge-text p { font-size: 13px; color: #9a9280; margin-bottom: 12px; }
  .certified-pills { display: flex; gap: 8px; flex-wrap: wrap; }
  .cert-pill { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; background: rgba(34,197,94,0.10); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
  .audit-score-chip { margin-left: auto; text-align: center; background: rgba(201,168,76,0.10); border: 1px solid rgba(201,168,76,0.25); border-radius: 12px; padding: 16px 24px; flex-shrink: 0; }
  .audit-score-n { font-family: 'Playfair Display', serif; font-size: 44px; font-weight: 900; color: #deba6a; display: block; line-height: 1; }
  .audit-score-l { font-size: 11px; color: #5a5448; text-transform: uppercase; letter-spacing: 0.1em; }

  /* Platform tabs */
  .mkt-tabs { display: flex; gap: 8px; margin-bottom: 36px; border-bottom: 1px solid rgba(201,168,76,0.10); padding-bottom: 0; flex-wrap: wrap; }
  .mkt-tab { background: transparent; border: none; border-bottom: 3px solid transparent; padding: 12px 20px; font-family: 'Playfair Display', serif; font-size: 13px; color: #9a9280; cursor: pointer; transition: all 0.2s; margin-bottom: -1px; }
  .mkt-tab:hover { color: #f0ead8; }
  .mkt-tab.active { color: #deba6a; border-bottom-color: #deba6a; }
  .mkt-panel { display: none; }
  .mkt-panel.active { display: block; }
  .mkt-hero { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-bottom: 44px; }
  .mkt-hero-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 12px; padding: 28px; position: relative; overflow: hidden; }
  .mkt-hero-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .mkt-hero-card.gold::before { background: linear-gradient(90deg,#8a6b28,#deba6a); }
  .mkt-hero-card.emerald::before { background: linear-gradient(90deg,#14a058,#22c55e); }
  .mkt-hero-card.blue::before { background: linear-gradient(90deg,#1e6be6,#60a5fa); }
  .mkt-hero-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #5a5448; margin-bottom: 8px; }
  .mkt-hero-stat { font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 700; line-height: 1; margin-bottom: 8px; }
  .mkt-hero-card.gold .mkt-hero-stat { color: #deba6a; }
  .mkt-hero-card.emerald .mkt-hero-stat { color: #22c55e; }
  .mkt-hero-card.blue .mkt-hero-stat { color: #60a5fa; }
  .mkt-hero-label { font-size: 13px; color: #9a9280; margin-bottom: 6px; }
  .mkt-hero-sub { font-size: 11px; color: #5a5448; line-height: 1.5; }

  /* Bar chart */
  .bar-chart { margin-bottom: 44px; }
  .bar-row { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .bar-year { font-size: 12px; font-weight: 600; color: #9a9280; width: 80px; flex-shrink: 0; text-align: right; }
  .bar-track { flex: 1; height: 34px; background: #18181f; border-radius: 8px; overflow: hidden; position: relative; }
  .bar-fill { height: 100%; border-radius: 8px; position: relative; display: flex; align-items: center; padding: 0 12px; font-size: 11px; font-weight: 600; color: #18181f; transition: width 1.4s cubic-bezier(0.16,1,0.3,1); }
  .bar-fill.gold { background: linear-gradient(90deg,#8a6b28,#deba6a); }
  .bar-fill.emerald { background: linear-gradient(90deg,#14a058,#22c55e); }

  /* Financials */
  .fin-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 32px; margin-bottom: 44px; }
  .proj-table { overflow-x: auto; }
  .proj-table table { font-size: 13px; }
  .proj-table th { background: #18181f; color: #5a5448; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 10px 14px; border: 1px solid rgba(201,168,76,0.10); text-align: left; }
  .proj-table td { padding: 10px 14px; border: 1px solid rgba(201,168,76,0.10); color: #9a9280; }
  .cost-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 14px; padding: 24px; margin-bottom: 16px; }
  .cost-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9a9280; margin-bottom: 14px; }
  .cost-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(201,168,76,0.10); font-size: 13px; align-items: center; }
  .cost-row:last-child { border-bottom: none; }
  .cost-row-label { color: #9a9280; }
  .cost-row-val { color: #e8e2d0; font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 600; }

  /* Team */
  .eng-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 40px; }
  .eng-card { background: #121218; border: 1px solid rgba(201,168,76,0.18); border-radius: 14px; padding: 22px; transition: border-color 0.2s; }
  .eng-card:hover { border-color: rgba(201,168,76,0.35); }
  .eng-card.us-eng { border-color: rgba(201,168,76,0.35); background: rgba(201,168,76,0.02); }
  .eng-avatar { font-size: 22px; text-align: center; width: 52px; height: 52px; border-radius: 50%; background: rgba(201,168,76,0.10); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
  .eng-name { font-family: 'Playfair Display', serif; font-size: 16px; color: #f0ead8; text-align: center; margin-bottom: 4px; }
  .eng-role { font-size: 12px; color: #9a9280; text-align: center; margin-bottom: 12px; }
  .eng-cost { font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 700; color: #22c55e; text-align: center; margin-bottom: 12px; }
  .eng-skills-expanded { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .eng-skill-row { display: flex; flex-direction: column; gap: 2px; }
  .eng-skill-tag { font-size: 10px; font-weight: 700; color: #deba6a; text-transform: uppercase; letter-spacing: 0.08em; }
  .eng-skill-desc { font-size: 11px; color: #9a9280; line-height: 1.5; }
  .team-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; background: linear-gradient(135deg,rgba(201,168,76,0.06),rgba(201,168,76,0.02)); border: 1px solid rgba(201,168,76,0.18); border-radius: 18px; padding: 36px; margin-bottom: 36px; }
  .savings-big { font-family: 'Playfair Display', serif; font-size: 52px; font-weight: 900; background: linear-gradient(135deg,#deba6a,#f0d898); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; margin-bottom: 8px; }
  .savings-sub { font-size: 14px; color: #9a9280; }
  .team-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .tc-box { border-radius: 12px; padding: 20px; text-align: center; }
  .tc-box.us { background: rgba(229,84,84,0.08); border: 1px solid rgba(229,84,84,0.2); }
  .tc-box.ph { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); }
  .tc-flag { font-size: 24px; margin-bottom: 8px; }
  .tc-country { font-size: 11px; color: #9a9280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .tc-annual { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  .tc-box.us .tc-annual { color: #e55454; }
  .tc-box.ph .tc-annual { color: #22c55e; }
  .tc-per { font-size: 11px; color: #5a5448; }
  .savings-timeline { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 14px; overflow: hidden; }
  .sav-header { background: #18181f; padding: 14px 24px; display: grid; grid-template-columns: 1fr 1.2fr 1.2fr 1fr; gap: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #5a5448; border-bottom: 1px solid rgba(201,168,76,0.10); }
  .sav-row { padding: 14px 24px; display: grid; grid-template-columns: 1fr 1.2fr 1.2fr 1fr; gap: 8px; border-bottom: 1px solid rgba(201,168,76,0.10); align-items: center; font-size: 13px; transition: background 0.15s; }
  .sav-row:last-child { border-bottom: none; background: rgba(201,168,76,0.10); }
  .sav-row:last-child .sav-val { color: #deba6a; font-weight: 700; }
  .sav-period { color: #e8e2d0; font-weight: 600; }
  .sav-us { color: #e55454; font-family: 'DM Mono', monospace; font-size: 12px; }
  .sav-ph { color: #22c55e; font-family: 'DM Mono', monospace; font-size: 12px; }
  .sav-val { color: #22c55e; font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 600; }

  /* Use of Proceeds */
  .proceed-hero { background: linear-gradient(135deg,#121218,#0d0d11); border: 1px solid rgba(201,168,76,0.18); border-radius: 20px; padding: 40px; margin-bottom: 36px; display: grid; grid-template-columns: 1fr 1.4fr; gap: 44px; align-items: center; }
  .raise-num { font-family: 'Playfair Display', serif; font-size: 64px; font-weight: 900; background: linear-gradient(135deg,#deba6a,#f0d898); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; margin-bottom: 8px; }
  .raise-sub { font-size: 14px; color: #9a9280; margin-bottom: 20px; }
  .raise-note { font-size: 12px; color: #5a5448; line-height: 1.6; font-style: italic; }
  .proc-bars { display: flex; flex-direction: column; gap: 14px; }
  .proc-bar-row { display: flex; align-items: center; gap: 14px; }
  .proc-label { font-size: 13px; color: #9a9280; width: 200px; flex-shrink: 0; }
  .proc-track { flex: 1; height: 32px; background: #1e1e28; border-radius: 8px; overflow: hidden; }
  .proc-fill { height: 100%; border-radius: 8px; display: flex; align-items: center; padding: 0 12px; font-size: 11px; font-weight: 700; color: #18181f; }
  .proc-fill.c1 { background: linear-gradient(90deg,#8a6b28,#deba6a); }
  .proc-fill.c2 { background: linear-gradient(90deg,#1e7a5a,#22c55e); }
  .proc-fill.c3 { background: linear-gradient(90deg,#1a5fa0,#38bdf8); }
  .proc-fill.c4 { background: linear-gradient(90deg,#7c3aed,#a78bfa); }
  .proc-fill.c5 { background: linear-gradient(90deg,#92400e,#fbbf24); }
  .proc-amount { font-size: 12px; font-weight: 700; font-family: 'DM Mono', monospace; color: #e8e2d0; width: 72px; text-align: right; }
  .breakeven { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.28); border-radius: 14px; padding: 28px 32px; display: flex; align-items: center; gap: 24px; }
  .be-num { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 800; color: #22c55e; margin-bottom: 4px; }
  .be-label { font-size: 13px; color: #9a9280; }

  /* Current Ops */
  .ops-proof-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 0; border: 1px solid rgba(201,168,76,0.18); border-radius: 18px; overflow: hidden; background: rgba(255,255,255,0.016); margin: 40px 0 0; }
  .ops-proof-cell { padding: 30px 28px; border-right: 1px solid rgba(201,168,76,0.10); text-align: center; }
  .ops-proof-cell:last-child { border-right: none; }
  .ops-proof-n { font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 800; background: linear-gradient(135deg,#deba6a,#f0d898); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; display: block; line-height: 1; margin-bottom: 8px; }
  .ops-proof-l { font-size: 11px; color: #5a5448; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; }

  /* Screenshots grid */
  .screenshots-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 48px; }
  .screenshot-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 12px; overflow: hidden; transition: all 0.2s; cursor: pointer; }
  .screenshot-card:hover { border-color: rgba(201,168,76,0.35); transform: translateY(-2px); }
  .screenshot-inner { background: linear-gradient(135deg,#18181f,#121218); padding: 24px; height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .screenshot-icon { font-size: 28px; margin-bottom: 10px; }
  .screenshot-label { font-size: 12px; font-weight: 700; color: #e8e2d0; }
  .screenshot-sub { font-size: 10px; color: #5a5448; margin-top: 4px; text-align: center; }

  /* Platform - tech grid */
  .tech-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 48px; }
  .tech-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 14px; padding: 22px; transition: all 0.2s; }
  .tech-card:hover { border-color: rgba(201,168,76,0.18); background: #18181f; }
  .tech-layer { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #8a6b28; margin-bottom: 8px; }
  .tech-name { font-family: 'Playfair Display', serif; font-size: 15px; color: #f0ead8; margin-bottom: 8px; }
  .tech-desc { font-size: 12px; color: #9a9280; line-height: 1.6; margin-bottom: 12px; }
  .tech-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .tech-tag { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; background: rgba(201,168,76,0.10); color: #9a9280; border: 1px solid rgba(201,168,76,0.10); }

  /* Alacarte */
  .alacarte-section { background: linear-gradient(135deg,rgba(201,168,76,0.05),rgba(201,168,76,0.01)); border: 1px solid rgba(201,168,76,0.18); border-radius: 18px; padding: 32px; margin-bottom: 48px; }
  .alacarte-top { display: grid; grid-template-columns: 1fr 280px; gap: 32px; margin-bottom: 24px; }
  .alacarte-eyebrow { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #8a6b28; margin-bottom: 6px; }
  .alacarte-title { font-family: 'Playfair Display', serif; font-size: 20px; color: #f0ead8; margin-bottom: 12px; }
  .alacarte-body { font-size: 13px; color: #9a9280; line-height: 1.75; }
  .price-compare-box { background: #18181f; border: 1px solid rgba(201,168,76,0.25); border-radius: 12px; padding: 20px; }
  .pc-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(201,168,76,0.10); }
  .pc-label { font-size: 12px; color: #9a9280; }
  .pc-val { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; }
  .pc-val.industry { color: #e55454; }
  .pc-val.ours { color: #22c55e; }
  .pc-savings { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.28); border-radius: 8px; padding: 9px; text-align: center; margin-top: 12px; }
  .pc-savings-n { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #22c55e; display: block; }
  .alacarte-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
  .ac-card { background: #18181f; border: 1px solid rgba(201,168,76,0.10); border-radius: 12px; padding: 18px; transition: border-color 0.2s; }
  .ac-card:hover { border-color: rgba(201,168,76,0.25); }
  .ac-icon { font-size: 20px; margin-bottom: 10px; }
  .ac-title { font-size: 13px; font-weight: 700; color: #e8e2d0; margin-bottom: 6px; }
  .ac-desc { font-size: 12px; color: #9a9280; line-height: 1.55; margin-bottom: 10px; }
  .ac-tag { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: rgba(201,168,76,0.12); color: #deba6a; border: 1px solid rgba(201,168,76,0.25); }

  /* Verticals */
  .verticals-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 44px; }
  .vert-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 12px; padding: 18px; transition: all 0.2s; }
  .vert-card:hover { border-color: rgba(201,168,76,0.25); }
  .vert-card.vert-active { border-color: rgba(34,197,94,0.25); }
  .vert-card.vert-coming { opacity: 0.7; }
  .vert-icon { font-size: 22px; margin-bottom: 8px; }
  .vert-name { font-size: 13px; font-weight: 700; color: #e8e2d0; margin-bottom: 4px; }
  .vert-desc { font-size: 11px; color: #9a9280; line-height: 1.5; margin-bottom: 10px; }
  .vert-status { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; display: inline-block; }
  .vert-live { background: rgba(34,197,94,0.10); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
  .vert-soon { background: rgba(56,189,248,0.10); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); }

  /* Enterprise grid */
  .enterprise-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 48px; }
  .ent-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 14px; padding: 24px; }
  .ent-icon { font-size: 24px; margin-bottom: 12px; }
  .ent-title { font-size: 14px; font-weight: 700; color: #e8e2d0; margin-bottom: 8px; }
  .ent-desc { font-size: 12px; color: #9a9280; line-height: 1.6; }

  /* User Guide */
  .ug-layout { display: grid; grid-template-columns: 240px 1fr; gap: 0; min-height: calc(100vh - 66px); }
  .ug-sidebar { background: #0d0d11; border-right: 1px solid rgba(201,168,76,0.10); padding: 28px 0; position: sticky; top: 66px; height: calc(100vh - 66px); overflow-y: auto; }
  .ug-sidebar-label { font-size: 9px; font-weight: 700; letter-spacing: 0.18em; color: #35322c; text-transform: uppercase; padding: 14px 20px 5px; }
  .ug-nav-item { display: block; padding: 7px 20px; font-size: 13px; color: #5a5448; transition: all 0.15s; border-left: 2px solid transparent; cursor: pointer; }
  .ug-nav-item:hover { color: #9a9280; background: rgba(255,255,255,0.03); }
  .ug-nav-item.active { color: #deba6a; border-left-color: #c9a84c; background: rgba(201,168,76,0.10); }
  .ug-content { padding: 0; overflow-y: auto; }
  .ug-section { display: none; padding: 52px 56px; border-bottom: 1px solid rgba(201,168,76,0.10); }
  .ug-section.active { display: block; }
  .ug-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #c9a84c; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .ug-eyebrow::before { content: ''; width: 20px; height: 1px; background: #c9a84c; }
  .ug-title { font-family: 'Playfair Display', serif; font-size: clamp(22px,2.4vw,32px); color: #f0ead8; margin-bottom: 10px; }
  .ug-subtitle { font-size: 14px; color: #9a9280; margin-bottom: 28px; line-height: 1.7; max-width: 600px; }
  .ug-tbl { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 13px; }
  .ug-tbl th { background: #18181f; color: #5a5448; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 10px 14px; border: 1px solid rgba(201,168,76,0.10); text-align: left; }
  .ug-tbl td { padding: 10px 14px; border: 1px solid rgba(201,168,76,0.10); color: #9a9280; vertical-align: top; }
  .ug-tbl td:first-child { color: #e8e2d0; font-weight: 500; }
  .ug-cards { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 12px; margin-bottom: 22px; }
  .ug-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 12px; padding: 18px; transition: border-color 0.2s; }
  .ug-card:hover { border-color: rgba(201,168,76,0.25); }
  .ug-card-icon { font-size: 18px; margin-bottom: 8px; }
  .ug-card-title { font-weight: 700; color: #e8e2d0; font-size: 13px; margin-bottom: 5px; }
  .ug-card-desc { font-size: 12px; color: #9a9280; line-height: 1.55; }
  .ug-callout { border-radius: 12px; padding: 16px 20px; margin-bottom: 18px; border-left: 3px solid #c9a84c; background: rgba(201,168,76,0.10); }
  .ug-callout p { font-size: 13px; margin: 0; color: #9a9280; }
  .ug-callout strong { color: #deba6a; }
  .flow-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
  .flow-step { background: #18181f; border: 1px solid rgba(201,168,76,0.18); border-radius: 7px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #e8e2d0; }
  .flow-step.hl { background: rgba(201,168,76,0.10); border-color: rgba(201,168,76,0.25); color: #deba6a; }
  .flow-arr { color: #35322c; font-size: 14px; }

  /* MA table */
  .ma-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
  .ma-table thead tr { border-bottom: 2px solid rgba(184,147,58,0.3); }
  .ma-table th { color: #deba6a; padding: 10px 14px; text-align: left; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
  .ma-table td { padding: 13px 14px; border-bottom: 1px solid rgba(201,168,76,0.10); color: #9a9280; vertical-align: top; }
  .ma-table td:first-child { color: #f0ead8; font-weight: 600; }
  .ma-table td.deal-val { color: #deba6a; font-weight: 700; font-size: 14px; }
  .ma-table td.multiple { color: #22c55e; font-weight: 700; }
  .ma-note { background: rgba(184,147,58,0.07); border: 1px solid rgba(184,147,58,0.2); border-radius: 8px; padding: 16px 20px; font-size: 13px; color: #9a9280; line-height: 1.7; }
  .ma-note strong { color: #deba6a; }

  /* Seg grid */
  .seg-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 20px; margin-bottom: 44px; }
  .seg-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 12px; padding: 24px; transition: border-color 0.2s; }
  .seg-card:hover { border-color: rgba(201,168,76,0.18); }
  .seg-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .seg-icon { font-size: 28px; }
  .seg-cagr { background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.25); border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #22c55e; }
  .seg-cagr.gold { background: rgba(184,147,58,0.10); border-color: rgba(184,147,58,0.3); color: #deba6a; }
  .seg-title { font-family: 'Playfair Display', serif; font-size: 16px; color: #f0ead8; margin-bottom: 4px; }
  .seg-size { font-size: 22px; font-weight: 700; color: #deba6a; margin-bottom: 4px; font-family: 'Playfair Display', serif; }
  .seg-proj { font-size: 12px; color: #5a5448; margin-bottom: 10px; }
  .seg-desc { font-size: 13px; color: #9a9280; line-height: 1.6; }
  .trend-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 44px; }
  .trend-card { background: #121218; border: 1px solid rgba(201,168,76,0.10); border-radius: 12px; padding: 22px; }
  .trend-num { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #deba6a; margin-bottom: 6px; }
  .trend-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #5a5448; margin-bottom: 8px; }
  .trend-desc { font-size: 13px; color: #9a9280; line-height: 1.6; }

  /* Cost callout */
  .comp-intro { display: grid; grid-template-columns: 1fr 280px; gap: 32px; align-items: start; margin-bottom: 36px; }
  .cost-callout { background: #121218; border: 1px solid rgba(184,147,58,0.25); border-radius: 12px; padding: 24px; text-align: center; }
  .cost-vs { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
  .cost-row2 { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(201,168,76,0.10); }
  .cost-row2:last-child { border: none; }
  .cost-lbl { font-size: 12px; color: #9a9280; }
  .cost-val-bad { font-size: 20px; font-weight: 700; color: #ef4444; font-family: 'Playfair Display', serif; }
  .cost-val-good { font-size: 20px; font-weight: 700; color: #22c55e; font-family: 'Playfair Display', serif; }
  .cost-savings { background: linear-gradient(135deg,rgba(34,197,94,0.10),rgba(184,147,58,0.10)); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 12px; text-align: center; }
  .cost-savings-n { font-size: 24px; font-weight: 700; color: #22c55e; display: block; font-family: 'Playfair Display', serif; }
  .cost-savings-l { font-size: 11px; color: #5a5448; }

  /* PDF audit page */
  .pdf-doc { max-width: 900px; margin: 0 auto; font-family: 'DM Sans', sans-serif; padding: 100px 24px 60px; }
  .pdf-page { background: #fff; border-radius: 4px; margin-bottom: 32px; overflow: hidden; box-shadow: 0 8px 48px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.06); }
  .pdf-header-band { background: #0a1628; padding: 14px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a6e; }
  .pdf-header-title { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; }
  .pdf-header-meta { font-size: 9px; color: #64748b; letter-spacing: 0.06em; }
  .pdf-cover { background: linear-gradient(160deg,#0f1f3d 0%,#0a1628 40%,#061018 100%); padding: 52px 48px 44px; position: relative; overflow: hidden; }
  .pdf-cover-h1 { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 800; color: #f1f5f9; line-height: 1.2; margin-bottom: 6px; }
  .pdf-cover-h1 em { color: #38bdf8; font-style: italic; }
  .pdf-body { background: #0d1117; padding: 32px 48px; }
  .pdf-section { margin-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 24px; }
  .pdf-sec-num { font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #1e3a6e; margin-bottom: 4px; }
  .pdf-sec-title { font-size: 15px; font-weight: 700; color: #e2e8f0; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .pdf-sec-title::before { content: ''; display: inline-block; width: 3px; height: 16px; background: linear-gradient(to bottom,#38bdf8,#0ea5e9); border-radius: 2px; flex-shrink: 0; }
  .pdf-score-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .pdf-score-card { background: rgba(14,165,233,0.04); border: 1px solid rgba(14,165,233,0.12); border-radius: 8px; padding: 14px 16px; }
  .pdf-score-cat { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
  .pdf-score-val { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 800; color: #38bdf8; margin-bottom: 2px; }
  .pdf-score-note { font-size: 9px; color: #475569; line-height: 1.5; }
  .pdf-finding-row { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 7px; padding: 14px 16px; margin-bottom: 10px; display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: start; }
  .pdf-finding-id { font-family: 'DM Mono', monospace; font-size: 9px; font-weight: 700; background: rgba(201,168,76,0.12); color: #c9a84c; border: 1px solid rgba(201,168,76,0.25); padding: 3px 8px; border-radius: 4px; white-space: nowrap; }
  .pdf-finding-title { font-size: 12px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px; }
  .pdf-finding-file { font-family: 'DM Mono', monospace; font-size: 10px; color: #64748b; margin-bottom: 5px; }
  .pdf-finding-desc { font-size: 11px; color: #64748b; line-height: 1.65; }
  .pdf-fixed { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; color: #22c55e; background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.25); padding: 3px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
  .pdf-sev-crit { background: rgba(229,84,84,0.12); color: #e55454; border: 1px solid rgba(229,84,84,0.3); padding: 2px 7px; border-radius: 20px; font-size: 8px; font-weight: 700; margin-right: 5px; display: inline-flex; }
  .pdf-sev-high { background: rgba(249,115,22,0.10); color: #f97316; border: 1px solid rgba(249,115,22,0.25); padding: 2px 7px; border-radius: 20px; font-size: 8px; font-weight: 700; margin-right: 5px; display: inline-flex; }
  .pdf-certifier { background: rgba(255,255,255,0.03); border: 1px solid rgba(14,165,233,0.15); border-radius: 8px; padding: 14px; text-align: center; }
  .pdf-cert-check { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; color: #22c55e; background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.25); padding: 3px 10px; border-radius: 20px; }

  /* Footer */
  .footer { padding: 52px 0 36px; text-align: center; border-top: 1px solid rgba(201,168,76,0.10); }
  .footer-disc { font-size: 11px; color: #35322c; max-width: 720px; margin: 0 auto 16px; line-height: 1.7; font-style: italic; }
  .footer-copy { font-size: 11px; color: #35322c; }

  /* Pill / tag */
  .pilot-badge { display: inline-flex; align-items: center; gap: 9px; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.28); border-radius: 40px; padding: 8px 20px; font-size: 12px; font-weight: 700; color: #22c55e; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 32px; }
  .pilot-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; animation: pulse 1.8s infinite; }

  /* Milestones */
  .milestone-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-top: 16px; }

  @media (max-width: 1024px) {
    .nav { padding: 0 20px; }
    .nav-tabs { gap: 1px; }
    .nav-tab { padding: 6px 10px; font-size: 11px; }
    .market-grid, .diff-grid, .mkt-hero, .tech-grid, .enterprise-grid { grid-template-columns: 1fr 1fr; }
    .eng-cards, .verticals-grid { grid-template-columns: 1fr 1fr; }
    .alacarte-top, .comp-intro, .proceed-hero { grid-template-columns: 1fr; }
    .alacarte-grid { grid-template-columns: 1fr 1fr; }
    .fin-grid, .team-hero { grid-template-columns: 1fr; }
    .ug-layout { grid-template-columns: 1fr; }
    .ug-sidebar { position: static; height: auto; }
    .milestone-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 768px) {
    .market-grid, .diff-grid, .mkt-hero, .tech-grid, .eng-cards, .enterprise-grid, .verticals-grid, .alacarte-grid, .metric-cards, .savings-timeline .sav-row, .savings-timeline .sav-header, .screenshots-grid, .pdf-score-row, .market-callout, .seg-grid, .trend-grid, .milestone-grid { grid-template-columns: 1fr; }
    .wrap { padding: 0 20px; }
    .hero { padding: 100px 20px 60px; }
    .ops-proof-strip { grid-template-columns: 1fr 1fr; }
    .team-compare { grid-template-columns: 1fr 1fr; }
  }
`;

// ══ COMPONENT ═══════════════════════════════════════════════════════════════
export default function InvestorPage() {
  const [activePage, setActivePage] = useState("overview");
  const [scrollPct, setScrollPct] = useState(0);
  const [mktTab, setMktTab] = useState("overview");
  const [barsFired, setBarsFired] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      setScrollPct((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
      // Reveal
      document.querySelectorAll(".reveal").forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight - 60) el.classList.add("vis");
      });
      // Bars
      if (!barsFired) {
        document.querySelectorAll(".bar-fill[data-w]").forEach((b) => {
          if (b.getBoundingClientRect().top < window.innerHeight) {
            b.style.width = b.dataset.w;
            setBarsFired(true);
          }
        });
      }
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [barsFired]);

  // Trigger bars when page changes to market
  useEffect(() => {
    if (activePage === "market") {
      setTimeout(() => {
        document.querySelectorAll(".bar-fill[data-w]").forEach((b) => { b.style.width = b.dataset.w; });
      }, 400);
    }
  }, [activePage]);

  const showPage = (p) => { setActivePage(p); window.scrollTo(0, 0); };

  return (
    <>
      <style>{css}</style>
      <div id="prog" style={{ width: scrollPct + "%" }}></div>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-gem">⚡</div>
          <div>
            <div className="nav-title">Rosie AI</div>
            <div className="nav-sub">Investor Overview · 2026</div>
          </div>
        </div>
        <div className="nav-tabs">
          {[
            ["overview", "Overview"],
            ["market", "Market"],
            ["platform", "Platform"],
            ["financials", "Financials"],
            ["team", "Team"],
            ["proceeds", "Use of Proceeds"],
            ["operations", "Current State"],
            ["roadmap", "Strategic Roadmap"],
            ["lce", "Live Codebase Explorer"],
            ["audit", "🔒 Security Audit"],
          ].map(([id, label]) => (
            <button key={id} className={`nav-tab${activePage === id ? " active" : ""}`} onClick={() => showPage(id)}>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
      <div id="page-overview" className={`page${activePage === "overview" ? " active" : ""}`}>
        <div className="hero">
          <div className="hero-bg"></div>
          <div className="hero-grid"></div>
          <div className="hero-eyebrow"><span className="pulse"></span>Confidential Investor Overview · Equity Partner 2026</div>
          <h1>Rosie handles your growth.<br/><em style={{fontStyle:"italic"}}>You handle your business.</em></h1>
          <p className="hero-deck">
            Rosie automates lead generation, customer outreach, and AI agent activation — so business owners spend less time figuring out marketing and more time running their business.
          </p>
          <div className="hero-scroll" onClick={() => document.querySelector(".divgold")?.scrollIntoView({behavior:"smooth"})}>
            <div className="scroll-rod"></div>Scroll
          </div>
        </div>
        <div className="divgold"></div>
        <section className="pad">
          <div className="wrap">
            {/* Audit banner */}
            <div className="audit-banner reveal" onClick={() => showPage("audit")}>
              <div className="audit-badge-icon">🔐</div>
              <div className="audit-badge-text">
                <h4>Triple-AI Certified Security Audit — v6 Production Build</h4>
                <p>Independently audited by Claude (Anthropic), GPT-4o (OpenAI), and Gemini 1.5 Pro (Google DeepMind). 5/5 vulnerabilities remediated. Click to view the full certified report →</p>
                <div className="certified-pills">
                  <span className="cert-pill">✓ Claude — Anthropic</span>
                  <span className="cert-pill">✓ GPT-4o — OpenAI</span>
                  <span className="cert-pill">✓ Gemini — Google DeepMind</span>
                  <span className="cert-pill">5/5 Issues Remediated</span>
                </div>
              </div>
              <div className="audit-score-chip">
                <span className="audit-score-n">92</span>
                <span className="audit-score-l">out of 100</span>
                <div style={{fontSize:9,color:"#22c55e",fontWeight:700,marginTop:5}}>✓ PRODUCTION READY</div>
              </div>
            </div>

            {/* What Rosie Does */}
            <p className="lead reveal" style={{maxWidth:740, fontSize:16}}>
              Customers can sign their organizations up via a subscription and access our full suite of discovery tools, automated outreach, and a built-in lead scoring and notification system — one complete workflow, ready to go. For teams that want flexibility, most of our services are also available à la carte.
            </p>
            <p className="reveal" style={{fontSize:15,color:"#9a9280",lineHeight:1.78,maxWidth:740,marginBottom:28}}>
              Our signature à la carte offering is our incoming and outgoing AI calling agents, powered by Inworld — the #1 ranked voice AI engine in the industry. Building your own AI calling agent takes days and costs $0.08/minute — just for the components, before a dialer. Factor in a point-and-click service with dialing, and you're looking at $0.15/minute. <strong>Rosie delivers the same capability out of the box, at $0.07/minute all-in. Customers save over 50%. We margin 500%.</strong>
            </p>

            {/* 3-across metric cards */}
            <div className="metric-cards">
              <div className="metric-card reveal">
                <span className="metric-card-n">500%</span>
                <div className="metric-card-l">Margin on Every Call Minute</div>
                <div className="metric-card-sub">Rosie earns 5× on every minute of AI voice</div>
              </div>
              <div className="metric-card reveal">
                <span className="metric-card-n">50%</span>
                <div className="metric-card-l">Cheaper Than Nearest Competitor</div>
                <div className="metric-card-sub">Half the cost — full stack included</div>
              </div>
              <div className="metric-card reveal">
                <span className="metric-card-n">$0.07</span>
                <div className="metric-card-l">All-In vs $0.15 Industry Average</div>
                <div className="metric-card-sub">Dialer + Agent + LLM + TTS + infrastructure</div>
              </div>
            </div>

            {/* The Opportunity */}
            <div className="slab reveal">The Opportunity</div>
            <h2 className="h2 reveal">A $21 Billion Market<br/>Still Running on Spreadsheets</h2>
            <p className="lead reveal">
              The AI Sales Intelligence market is growing at 25.8% CAGR through 2032. Most small and mid-sized businesses still prospect manually — cold lists, outdated data, zero intelligence. They're spending time and money on approaches that stopped working years ago, simply because modern alternatives have been too complex or too expensive to access.
              <br/><br/>
              Rosie AI changes that. We automate the entire top-of-funnel for any business starved of modern tooling — regardless of industry.
            </p>
            <div className="market-grid">
              <div className="mcard reveal">
                <div className="mcard-icon">🤖</div>
                <div className="mcard-market">AI Sales Intelligence</div>
                <div className="mcard-size">$3.4B → $21.4B</div>
                <div className="mcard-proj">2024 → 2032 · Global Market</div>
                <div className="mcard-cagr">▲ 25.8% CAGR</div>
                <div className="mcard-desc">Fastest-growing segment in B2B software. AI-driven prospecting is replacing traditional SDR teams at scale.</div>
              </div>
              <div className="mcard reveal">
                <div className="mcard-icon">📞</div>
                <div className="mcard-market">AI Voice Agent Market</div>
                <div className="mcard-size">$4.1B → $18B</div>
                <div className="mcard-proj">2024 → 2030 · Outbound + Inbound</div>
                <div className="mcard-cagr">▲ 28.3% CAGR</div>
                <div className="mcard-desc">Our AI voice agents run at $0.07/min all-in — vs industry average $0.15/min. We offer 15× cost advantage with zero infrastructure for the customer.</div>
              </div>
            </div>

            {/* Built. Real. Yours. */}
            <div className="slab reveal">Why Now</div>
            <h2 className="h2 reveal">Built. Real. Yours.</h2>
            <div className="diff-grid">
              <div className="diff-card reveal">
                <div className="diff-icon">🏗️</div>
                <div className="diff-title">This Is a Product, Not a Pitch</div>
                <div className="diff-desc">Rosie AI is fully built and operational. What you're seeing isn't a concept, a mockup, or a promise — it's a functioning platform ready to scale.</div>
              </div>
              <div className="diff-card reveal">
                <div className="diff-icon">📡</div>
                <div className="diff-title">Already in the Wild</div>
                <div className="diff-desc">Rosie is actively deployed with select companies today, generating real call data, real leads, and real results. We're not waiting for investment to prove the model — we're already proving it.</div>
              </div>
              <div className="diff-card reveal">
                <div className="diff-icon">💰</div>
                <div className="diff-title">100% of Your Capital Goes to Work</div>
                <div className="diff-desc">Our fundraising is handled entirely in-house. No brokers, no finders fees, no commissions. Every dollar raised goes directly into building and scaling Rosie — not paying middlemen.</div>
              </div>
            </div>
          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">Market data based on publicly available industry reports. Projections are forward-looking estimates and not guarantees of performance.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ MARKET ════════════════════════════════════════════════════════ */}
      <div id="page-market" className={`page${activePage === "market" ? " active" : ""}`}>
        <section className="pad" style={{paddingTop:130}}>
          <div className="wrap">
            <div className="slab reveal">Market Analysis</div>
            <h2 className="h2 reveal">Multiple Exploding Markets,<br/>One Unified Platform</h2>
            <p className="lead reveal">Rosie AI sits at the intersection of three of the fastest-growing categories in enterprise software — AI in Sales, AI Voice Agents, and Conversational AI. Each market is independently large. Together they represent a generational wave of automation spend.</p>
            <div className="mkt-tabs reveal">
              {[["overview","📊 Market Overview"],["segments","📈 Segments & TAM"],["trends","🔥 Growth Drivers"],["competitive","⚔️ Competitive Landscape"],["ma","🤝 M&A Precedents"]].map(([id,label])=>(
                <button key={id} className={`mkt-tab${mktTab===id?" active":""}`} onClick={()=>setMktTab(id)}>{label}</button>
              ))}
            </div>

            {/* Overview panel */}
            <div className={`mkt-panel${mktTab==="overview"?" active":""}`}>
              <div className="mkt-hero reveal">
                <div className="mkt-hero-card gold"><div className="mkt-hero-eyebrow">AI in Sales — Total Market 2024</div><div className="mkt-hero-stat">$31.2B</div><div className="mkt-hero-label">Global AI in Sales Market</div><div className="mkt-hero-sub">Growing to $383B by 2034 · 28.8% CAGR · North America leads with 35%+ share</div></div>
                <div className="mkt-hero-card emerald"><div className="mkt-hero-eyebrow">Voice AI Agents — 2024</div><div className="mkt-hero-stat">$2.4B</div><div className="mkt-hero-label">Voice AI Agents Market</div><div className="mkt-hero-sub">Projected $47.5B by 2034 · 34.8% CAGR — fastest-growing AI subcategory · VC funding surged 8× to $2.1B in 2025</div></div>
                <div className="mkt-hero-card blue"><div className="mkt-hero-eyebrow">Conversational AI — 2024</div><div className="mkt-hero-stat">$11.6B</div><div className="mkt-hero-label">Conversational AI Market</div><div className="mkt-hero-sub">Projected $41.4B by 2030 · 23.7% CAGR · Gartner: contact centers save $80B in labor costs from AI in 2026</div></div>
              </div>
              <div className="bar-chart reveal">
                <div style={{fontSize:11,fontWeight:700,color:"#5a5448",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16}}>TAM by Vertical — Annual (US)</div>
                {[["Solar","85%","gold","$200B US Market"],["Automotive","78%","gold","$1.3T US Market"],["Healthcare","72%","gold","$4.3T US Healthcare"],["AI in Sales","60%","emerald","$31.2B → $383B by 2034"],["Roofing","55%","gold","$62B Annual"],["Conv. AI","48%","emerald","$11.6B → $41.4B by 2030"],["Voice Agents","35%","emerald","$2.4B → $47.5B by 2034"],["Cleaning","42%","gold","$117B Global"]].map(([yr,w,cls,txt])=>(
                  <div key={yr} className="bar-row">
                    <div className="bar-year">{yr}</div>
                    <div className="bar-track"><div className={`bar-fill ${cls}`} style={{width:0}} data-w={w}>{txt}</div></div>
                  </div>
                ))}
              </div>
              <div className="diff-grid reveal" style={{marginTop:44}}>
                {[["⚡","The Latency Threshold Crossed","AI voice agents now respond in under 150ms — below the perceptual threshold where speech feels natural. This single breakthrough unlocked mass enterprise deployment in 2024–2025."],["💰","8× Surge in Voice AI Funding","VC funding into voice AI companies surged from $315M in 2022 to $2.1B in 2025. ElevenLabs closed a $500M Series D at an $11B valuation in February 2026."],["📉","Cost Curve Collapsing","Enterprise voice AI now runs at $0.01–0.05/minute all-in. Industry average was $0.15/min just 18 months ago. Rosie AI is already at the floor — $0.07/min — with margin built in."],["🏭","Production Deployment Tripling","Voice agent production deployments grew 340% in 2025. 78% of top 50 banks now have live voice agents. 88% of contact centers use AI."],["🏠","Home Services: Untapped","Solar, roofing, cleaning, HVAC — $500B+ in combined US market — are the most manual, cold-call-dependent verticals. They are the last major industry to receive AI-first prospecting tools."],["🤖","AI Replacing SDR Teams at Scale","AI is replacing traditional SDR functions at 15× lower cost. 68% of enterprise sales teams already use AI tools in their pipeline."]].map(([icon,title,desc])=>(
                  <div key={title} className="diff-card"><div className="diff-icon">{icon}</div><div className="diff-title">{title}</div><div className="diff-desc">{desc}</div></div>
                ))}
              </div>
            </div>

            {/* Segments panel */}
            <div className={`mkt-panel${mktTab==="segments"?" active":""}`}>
              <div className="seg-grid reveal">
                {[["🤖","AI Sales Intelligence","$3.4B → $21.4B","2024 → 2032 · Global","25.8%","Fastest-growing B2B software segment. AI-driven prospecting is replacing SDR teams.","gold"],["📞","Voice AI Agents","$2.4B → $47.5B","2024 → 2034 · Outbound + Inbound","34.8%","Fastest-growing AI subcategory. VC funding surged 8× in 2025.",""],["🗣️","Conversational AI","$11.6B → $41.4B","2024 → 2030 · Chatbots + Voice","23.7%","Gartner: contact centers save $80B in labor costs from AI in 2026.",""],["🏠","Home Services (US)","$500B+","Solar + Roofing + Cleaning + HVAC","Growing","Most manual, cold-call-dependent verticals in B2B. Last to automate.","gold"]].map(([icon,title,size,proj,cagr,desc,cls])=>(
                  <div key={title} className="seg-card">
                    <div className="seg-header"><div className="seg-icon">{icon}</div><div className={`seg-cagr${cls?" "+cls:""}`}>▲ {cagr} CAGR</div></div>
                    <div className="seg-title">{title}</div>
                    <div className="seg-size">{size}</div>
                    <div className="seg-proj">{proj}</div>
                    <div className="seg-desc">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trends panel */}
            <div className={`mkt-panel${mktTab==="trends"?" active":""}`}>
              <div className="trend-grid reveal">
                {[["340%","Voice Agent Deployment Growth","Voice agent production deployments grew 340% in 2025 alone."],["88%","Contact Centers Using AI","88% of contact centers now use some form of AI — the adoption inflection point has passed."],["$80B","Labor Cost Savings by 2026","Gartner projects contact centers save $80B in labor costs from AI deployment in 2026."],["15×","Cost Advantage vs. SDR Teams","AI can execute traditional SDR functions at 15× lower cost — changing the fundamental economics of outbound sales."],["8×","VC Funding Surge","VC investment into voice AI surged 8× from 2022 to 2025. The capital is flowing."],["$0.07","Rosie All-In Cost Per Minute","Industry assembles Deepgram + ElevenLabs + Twilio + LLM separately. Rosie delivers everything at $0.07/min."]].map(([n,l,d])=>(
                  <div key={l} className="trend-card"><div className="trend-num">{n}</div><div className="trend-label">{l}</div><div className="trend-desc">{d}</div></div>
                ))}
              </div>
            </div>

            {/* Competitive panel */}
            <div className={`mkt-panel${mktTab==="competitive"?" active":""}`}>
              <div className="comp-intro reveal">
                <div>
                  <div className="slab" style={{margin:"0 0 16px"}}>Why No One Else Can Compete</div>
                  <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#f0ead8",marginBottom:16}}>The Moat Is Data, Not Just Software</h3>
                  <p style={{fontSize:14,color:"#9a9280",lineHeight:1.7,maxWidth:560}}>Apollo, ZoomInfo, and Clay are generic B2B databases. They sell contact data. Rosie AI generates proprietary, real-time intent signals from sources competitors literally cannot access — because we built the ingestion infrastructure, and they didn't.</p>
                </div>
                <div className="cost-callout">
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#5a5448",marginBottom:16}}>Voice Agent Cost/Minute</div>
                  <div className="cost-vs">
                    <div className="cost-row2"><span className="cost-lbl">Industry Average</span><span className="cost-val-bad">$0.15</span></div>
                    <div className="cost-row2"><span className="cost-lbl">Rosie AI All-In</span><span className="cost-val-good">$0.07</span></div>
                  </div>
                  <div className="cost-savings"><span className="cost-savings-n">2× Cheaper</span><span className="cost-savings-l">Full stack included · 500% margin</span></div>
                </div>
              </div>
              <table className="vs-table reveal">
                <thead><tr><th>Capability</th><th>Apollo.io</th><th>ZoomInfo</th><th>Clay</th><th>Gong.io</th><th className="ours">Rosie AI</th></tr></thead>
                <tbody>
                  {[["Solar Permit Ingestion (live)","❌","❌","❌","❌","✅ Daily, 50+ cities"],["Storm DAT Reports (real-time)","❌","❌","❌","❌","✅ NWS API live"],["AI Voice Agents (outbound)","❌","❌","❌","Partial","✅ $0.07/min all-in"],["AI Inbound Call Center","❌","❌","❌","❌","✅ Browser-based"],["WhatsApp + iMessage Outreach","❌","❌","❌","❌","✅ No 10DLC required"],["Self-Healing Pipeline","❌","❌","❌","❌","✅ Autonomous recovery"],["Setup Time (AI Calling)","N/A","N/A","N/A","Weeks","20 minutes"],["Pricing / Month","$499+","$15,000+","$599+","$5,000+","$297 all-in"],["Vertical-Specific Data Modules","❌","❌","❌","❌","✅ Solar, Roofing, Storm"]].map((row)=>(
                    <tr key={row[0]}>{row.map((cell,i)=><td key={i} className={i===5?"ours":""}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* M&A panel */}
            <div className={`mkt-panel${mktTab==="ma"?" active":""}`}>
              <div className="slab reveal">Precedent Transactions</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#f0ead8",marginBottom:16}} className="reveal">What Acquirers Pay for AI Sales Platforms</h3>
              <table className="ma-table reveal">
                <thead><tr><th>Acquirer</th><th>Target</th><th>Year</th><th>Deal Value</th><th>Sector</th><th>Rev. Multiple</th></tr></thead>
                <tbody>
                  {[["Microsoft","Nuance Communications","2021","$19.7B","AI Voice / NLP","~10× ARR"],["Salesforce","Slack","2021","$27.7B","SaaS / Collaboration","26× ARR"],["Adobe","Figma","2022","$20B","SaaS / Design","50× ARR"],["ZoomInfo","Chorus.ai","2021","$575M","Conversation Intelligence","11.5× ARR"],["ServiceNow","Intellibot","2021","$1.35B","AI Automation","12× ARR"],["Salesloft","Drift","2023","~$1B","Conversational Marketing AI","~10× ARR"],["Salesforce","Tableau","2019","$15.7B","Data Analytics / SaaS","~8× ARR"],["Twilio","Segment","2020","$3.2B","Data / SaaS","12× ARR"]].map((row)=>(
                    <tr key={row[0]+row[1]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td className="deal-val">{row[3]}</td><td>{row[4]}</td><td className="multiple">{row[5]}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="ma-note reveal"><strong>Rosie AI context:</strong> At the $15M SAFE note valuation cap with $380K ARR, Rosie AI implies a 39× forward multiple — consistent with early-stage AI-native platforms before revenue scaling. Microsoft paid 10× ARR for Nuance's voice AI infrastructure. The AI voice agent market that Rosie AI competes in is growing to $47.5B by 2034. The first category-defining platform in the vertically-integrated AI prospecting space will command premium exit multiples.</div>
            </div>
          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">Market data based on publicly available industry reports. Projections are forward-looking estimates and not guarantees of performance.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ PLATFORM ══════════════════════════════════════════════════════ */}
      <div id="page-platform" className={`page${activePage === "platform" ? " active" : ""}`}>
        <section className="pad" style={{paddingTop:130}}>
          <div className="wrap">
            <div className="slab reveal">Technology</div>
            <h2 className="h2 reveal">One Unified System.<br/><em style={{fontStyle:"italic",color:"#deba6a"}}>Infinite Possibilities.</em></h2>
            <p className="lead reveal">Rosie AI leverages a multi-tenant, distributed framework to run 150+ backend functions simultaneously, updating 136 entities the second data hits the system. This isn't just a CRM—it's an intelligence layer that adapts to your industry. From dental patient engagement to precision-targeted roofing and solar leads, Rosie eliminates the lag and puts real-time solutions at your fingertips.</p>

            <div className="slab reveal">Core Capabilities</div>
            <div className="diff-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:32}}>
              {[
                ["🔍","Discovery","Our discovery engine automates the heavy lifting of data acquisition, integrating web crawlers, solar permit tracking, NWS storm data, and deep social scraping to identify high-intent opportunities as they happen."],
                ["🧠","AI Analysis","Beyond simple data, Rosie provides deep cognitive processing — from intent scoring and pain point detection to persona clustering — ensuring every lead is qualified and understood before you ever hit "send.""],
                ["⚡","Enrichment","We eliminate incomplete data through a sophisticated multi-source waterfall, merging global databases with specialized industry data to provide a comprehensive, 360-degree view of every prospect."],
                ["📤","Outreach","Rosie orchestrates multi-channel engagement across SMS, email, AI voice, and WhatsApp, maintaining a consistent brand presence through intelligent drip sequences and automated follow-ups."],
                ["📊","Intelligence","The backbone of the platform focuses on operational excellence, managing complex queue systems, self-healing protocols, and full-stack telemetry to ensure the system remains resilient and transparent."],
                ["🔔","Notification","The final layer of the Rosie ecosystem ensures you never miss a beat. This module pushes real-time alerts, engagement pings, and critical system updates directly to your preferred channel, turning platform intelligence into immediate human action."],
              ].map(([icon,title,desc])=>(
                <div key={title} className="diff-card reveal">
                  <div className="diff-icon">{icon}</div>
                  <div className="diff-title">{title}</div>
                  <div className="diff-desc">{desc}</div>
                </div>
              ))}
            </div>

            <div className="slab reveal">Technical Stack</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:44}}>
              {[["BACKEND RUNTIME","Deno + Base44 SDK","262 serverless edge functions. Each function isolated, versioned, health-monitored. All calls use INTERNAL_SECRET auth + RLS session context.","TypeScript","Deno Deploy","Base44 v0.8.23","JWT Auth"],
                ["FRONTEND","React 18 + Vite","42 full pages, 248 components across billing, admin, campaign, leads, SMS, settings, and workflow modules. TanStack Query with 15s auto-refresh.","React 18","TanStack Query","Tailwind CSS","Lucide Icons"],
                ["DATABASE","Supabase PostgreSQL","136 entity types. Row-Level Security enforced via set_org_context() at every query. Zero cross-org data leakage. Full audit log trail.","PostgreSQL","RLS","Supabase","136 Entities"],
                ["AI GATEWAY","Centralized Multi-Provider","All AI calls route through aiGateway. Handles cost tracking, request caching, budget enforcement, provider failover across Groq, OpenAI, Anthropic, and Gemini.","OpenAI","Groq","Anthropic","Gemini"],
                ["OUTREACH LAYER","Twilio + Instantly.ai","Full SMS drip/broadcast, AI voice agent with call recording, email sequences via Instantly.ai, WhatsApp + Blue Bubble messaging. BYO Twilio or EZ-Setup. 20 minutes to dial.","Twilio","AI Voice","Instantly.ai","WhatsApp"],
                ["QUEUE SYSTEM","Self-Healing Job Engine","Priority scheduler, DLQ monitor, backpressure manager, stuck-job detector, loop-breaker agent, and full autoscaler. Workers restart automatically on failure.","Priority Queues","DLQ","Self-Healing","Autoscaling"],
              ].map(([layer,name,desc,...tags])=>(
                <div key={name} style={{background:"#121218",border:"1px solid rgba(201,168,76,0.10)",borderRadius:10,padding:"14px 16px",transition:"border-color 0.2s"}} className="reveal">
                  <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:"#8a6b28",marginBottom:5}}>{layer}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:"#f0ead8",marginBottom:6}}>{name}</div>
                  <div style={{fontSize:11,color:"#9a9280",lineHeight:1.55,marginBottom:10}}>{desc}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{tags.map(t=><span key={t} style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20,background:"rgba(201,168,76,0.10)",color:"#9a9280",border:"1px solid rgba(201,168,76,0.10)"}}>{t}</span>)}</div>
                </div>
              ))}
            </div>

            <div className="slab reveal">À La Carte Services</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:44}} className="reveal">
              {[["📞","AI Outbound Voice Agents","Fully automated outbound calls with AI agents that qualify leads, book appointments, and handle objections. Setup in 20 minutes.","$0.07/min all-in"],
                ["🎙️","AI Inbound Call Center","Browser-based inbound console with AI agent handling, caller ID, customer lookup, history, and live transfer to human agents.","$0.07/min all-in"],
                ["💬","SMS Campaigns + Automation","Standard SMS, WhatsApp, and Blue Bubble (iMessage) outreach. Includes Instantly.ai email integration and automated follow-up workflows.","No 10DLC required"],
                ["🍎","Blue Bubble (iMessage) Outreach","Apple Messages-style outreach that bypasses SMS carrier compliance entirely. Higher open rates, no registration hassle.","Zero compliance overhead"],
                ["📱","WhatsApp Business Outreach","Automated WhatsApp campaigns with AI-powered reply handling. Two-way conversations, media support, and full outreach workflow integration.","Global reach"],
                ["🔌","BYO Twilio or Buy From Us","Bring your own Twilio account for maximum control, or purchase phone numbers directly through Rosie AI EZ-Setup. Same $0.07/min either way.","20 min setup"],
              ].map(([icon,title,desc,tag])=>(
                <div key={title} style={{background:"#121218",border:"1px solid rgba(201,168,76,0.10)",borderRadius:10,padding:"14px 16px",transition:"border-color 0.2s"}}>
                  <div style={{fontSize:18,marginBottom:8}}>{icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#e8e2d0",marginBottom:5}}>{title}</div>
                  <div style={{fontSize:11,color:"#9a9280",lineHeight:1.5,marginBottom:10}}>{desc}</div>
                  <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"rgba(201,168,76,0.12)",color:"#deba6a",border:"1px solid rgba(201,168,76,0.25)"}}>{tag}</span>
                </div>
              ))}
            </div>

            <div className="slab reveal">Verticals We Service</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:44}} className="reveal">
              {[
                ["🏘️","Real Estate","Distressed property signals and 'likely to sell' data modeling to support agents identifying off-market opportunities and high-intent sellers."],
                ["🚗","Retail Auto Sales","Identifying high-intent buyer signals across YouTube, Reddit, and social platforms to capture in-market automotive leads at peak search."],
                ["🦷","Dental Practices","Patient acquisition and reactivation pipelines designed to fill chairs by identifying local residents seeking specialized or routine care."],
                ["🏥","Medical Offices","Strategic growth signals and local demographic targeting to help private practices and specialty clinics expand their patient base."],
                ["🏢","Hospitals","High-level facility targeting and health system data integration to streamline B2B partnerships, staffing solutions, and equipment procurement."],
                ["🛡️","Insurance Industry","Automated lead generation for life, health, and property insurance providers by tracking major life events and property transitions in real-time."],
                ["🏥","Treatment Facilities","Precision targeting for behavioral health and rehabilitation centers, identifying individuals and families actively searching for care."],
                ["🏦","Mortgage & Lending","Tracking equity milestones and financial behavior to connect lenders with homeowners ready for refinancing, HELOCs, or new purchase loans."],
                ["❄️","HVAC & Home Services","Monitoring localized climate shifts and equipment age signals to connect HVAC and plumbing professionals with homeowners needing replacements."],
                ["🔒","Cybersecurity & IT","B2B intent-tracking identifying companies searching for security solutions following infrastructure changes, hiring spikes, or compliance shifts."],
                ["🚢","Logistics & Supply Chain","Connecting freight and 3PL providers with manufacturers and e-commerce brands showing high-volume shipping and distribution demand."],
                ["⚖️","Legal Services","Intent-based lead generation for personal injury and mass tort firms based on real-time incident reporting, public data, and legal-search behaviors."],
                ["☀️","Solar","Precision permit scraping from 50+ city portals with daily data ingestion to identify homeowners ready to transition to clean energy."],
                ["🏠","Roofing","Comprehensive storm tracking via NWS data and social signals to connect contractors with homeowners in immediate need of repair."],
                ["🔑","Commodities","Sophisticated intent-tracking across social platforms to identify and engage active buyers in precious metals and raw materials markets."],
                ["🏗️","General Contracting","Commercial and residential permit data aggregation to provide GCs with a steady pipeline of new construction and remodel projects."],
                ["🧹","Residential Cleaning","Territory mapping and homeowner signal detection to deploy service demand alerts for local cleaning franchises and independent services."],
                ["🏢","Commercial Cleaning","Strategic B2B facility targeting focused on office complexes, medical centers, and industrial contract opportunities."],
                ["🔬","Lab & Testing","Data pipelines for clinical labs, environmental testing, and diagnostic companies looking to scale their B2B partnerships."],
                ["🌿","Landscaping & Lawn Care","Utilizing new homeowner data and seasonal demand signals to automate outreach for maintenance and design-build services."],
              ].map(([icon,name,desc])=>(
                <div key={name} style={{background:"#121218",border:"1px solid rgba(201,168,76,0.10)",borderRadius:8,padding:"10px 12px",transition:"border-color 0.2s"}}>
                  <div style={{fontSize:16,marginBottom:5}}>{icon}</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#e8e2d0",marginBottom:4}}>{name}</div>
                  <div style={{fontSize:10,color:"#9a9280",lineHeight:1.45}}>{desc}</div>
                </div>
              ))}
            </div>


          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">Source code shown is from the audited production build. All functions are deployed and operational.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ FINANCIALS ════════════════════════════════════════════════════ */}
      <div id="page-financials" className={`page${activePage === "financials" ? " active" : ""}`}>
        <section className="pad" style={{paddingTop:130}}>
          <div className="wrap">
            <div className="slab reveal">Financial Projections & Growth Milestones</div>
            <h2 className="h2 reveal">Two Revenue Streams.<br/><em style={{fontStyle:"italic",color:"#deba6a"}}>One Compounding Engine.</em></h2>
            <p className="lead reveal">The platform generates revenue through two complementary streams: recurring organizational subscriptions and an à la carte AI services marketplace launching in September 2026. The following table reflects the updated blended revenue projections.</p>

            <div className="fin-grid">
              <div className="proj-table reveal">
                <table>
                  <thead><tr><th>Milestone</th><th># Orgs</th><th>Avg MRR/Org</th><th>MRR</th><th>ARR</th></tr></thead>
                  <tbody>
                    <tr><td>Month 2 (Sept 2026)</td><td>10</td><td>$500</td><td>$5,000</td><td>$60K</td></tr>
                    <tr><td>Month 4 (Q4 2026)</td><td>25</td><td>$600</td><td>$15,000</td><td>$180K</td></tr>
                    <tr><td style={{color:"#deba6a",fontWeight:700}}>Month 6 (Q2 2027)</td><td style={{color:"#deba6a",fontWeight:700}}>50</td><td>$650</td><td style={{color:"#deba6a",fontWeight:700}}>$32,500</td><td>$390K</td></tr>
                    <tr><td>Month 12 (Q2 2027)</td><td>125</td><td>$700</td><td>$87,500</td><td>$1.05M</td></tr>
                    <tr><td style={{color:"#22c55e",fontWeight:700}}>Month 18 (Dec 2027)</td><td style={{color:"#22c55e",fontWeight:700}}>250</td><td>$750</td><td style={{color:"#22c55e",fontWeight:700}}>$187,500</td><td style={{color:"#22c55e",fontWeight:700}}>$2.25M</td></tr>
                    <tr><td>Month 24 (Jun 2028)</td><td>750</td><td>$800</td><td>$600,000</td><td>$7.2M</td></tr>
                    <tr><td>Month 30 (Dec 2028)</td><td>2,000</td><td>$820</td><td>$1,640,000</td><td>$19.7M</td></tr>
                  </tbody>
                </table>
                <div style={{marginTop:16,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,padding:"14px 18px"}}>
                  <p style={{fontSize:12,color:"#9a9280",margin:0,lineHeight:1.7}}><strong style={{color:"#22c55e"}}>Profitability Target:</strong> We project reaching profitability the moment revenue exceeds our monthly operational costs, with break-even achieved at approximately 15 paying organizations.</p>
                  <p style={{fontSize:12,color:"#9a9280",margin:"8px 0 0",lineHeight:1.7}}><strong style={{color:"#deba6a"}}>Long-term Goal:</strong> Scale to 2,000 paying organizations by end of 2028.</p>
                </div>
              </div>
              <div className="reveal">
                <div className="cost-card">
                  <div className="cost-title">Refined Monthly Operating Costs</div>
                  {[["Sr. Technology Engineer","$4,000","#38bdf8"],["Managing Partner","$3,000","#38bdf8"],["PH Engineering Unit (3 Engineers)","$1,950","#22c55e"],["Server & Edge Deployment (Deno)","$300",""],["Database Management (Supabase Pro)","$150",""],["AI API Usage (OpenAI/Groq/etc.)","$200",""],["Twilio / SMS / Voice Base","$150",""],["Tools & Software Subscriptions","$150",""],["Legal, Audit & Compliance","$200",""]].map(([l,v,col])=>(
                    <div key={l} className="cost-row"><span className="cost-row-label">{l}</span><span className="cost-row-val" style={col?{color:col}:{}}>{v}</span></div>
                  ))}
                  <div className="cost-row" style={{borderTop:"1px solid rgba(201,168,76,0.25)",marginTop:4,paddingTop:10}}><span className="cost-row-label" style={{fontWeight:700,color:"#e8e2d0"}}>Total Fixed Monthly Burn</span><span className="cost-row-val" style={{color:"#deba6a",fontWeight:700,fontSize:14}}>$10,100</span></div>
                </div>
                <div className="cost-card" style={{background:"rgba(34,197,94,0.08)",borderColor:"rgba(34,197,94,0.25)"}}>
                  <div className="cost-title" style={{color:"#22c55e"}}>Revenue Share & Distribution Threshold</div>
                  <div className="cost-row"><span className="cost-row-label">Fixed Monthly Operating Cost</span><span className="cost-row-val">$10,100</span></div>
                  <div className="cost-row"><span className="cost-row-label">Break-even Point</span><span className="cost-row-val" style={{color:"#22c55e"}}>~15 orgs @ ~$700 avg MRR</span></div>
                  <div className="cost-row"><span className="cost-row-label">Distribution Activation</span><span className="cost-row-val" style={{color:"#22c55e",fontWeight:700}}>$20,000/mo MRR</span></div>
                  <div className="cost-row"><span className="cost-row-label">Orgs Required for Distributions</span><span className="cost-row-val" style={{color:"#deba6a"}}>~28–30 orgs</span></div>
                  <div className="cost-row"><span className="cost-row-label">Projected Start</span><span className="cost-row-val" style={{color:"#deba6a"}}>Q4 2026</span></div>
                </div>
              </div>
            </div>

            {/* Pricing Tiers */}
            <div className="slab reveal" style={{marginTop:40}}>Subscription Pricing Tiers</div>
            <div style={{overflowX:"auto",marginBottom:36}} className="reveal">
              <table style={{fontSize:13,width:"100%"}}>
                <thead><tr><th style={{background:"#18181f",color:"#5a5448",padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>Plan</th><th style={{background:"#18181f",color:"#5a5448",padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>Price</th><th style={{background:"#18181f",color:"#5a5448",padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>Included Features</th><th style={{background:"#18181f",color:"#5a5448",padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>Target Audience</th></tr></thead>
                <tbody>
                  {[["Starter","$297/mo","500 voice min · 2,500 SMS · 1 line · 1,000 AI calls","Solo contractors, 1–3 closers"],["Growth","$497/mo","1,500 voice min · 7,500 SMS · 3 lines · 5,000 AI calls","Small teams, 3–10 reps"],["Scale","$997/mo","5,000 voice min · 25,000 SMS · 8 lines · 20K AI calls","Mid-market, 10–30 reps"],["Enterprise","$2,497/mo","Unlimited minutes · 20 lines · Unlimited AI","Large operations, 30+ reps"]].map(([plan,price,feat,target])=>(
                    <tr key={plan}>
                      <td style={{padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",color:"#deba6a",fontWeight:700}}>{plan}</td>
                      <td style={{padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",color:"#22c55e",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{price}</td>
                      <td style={{padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",color:"#9a9280",fontSize:12}}>{feat}</td>
                      <td style={{padding:"10px 14px",border:"1px solid rgba(201,168,76,0.10)",color:"#9a9280",fontSize:12}}>{target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Marketplace */}
            <div className="slab reveal">À La Carte AI Services Marketplace</div>
            <div style={{background:"rgba(201,168,76,0.04)",border:"1px solid rgba(201,168,76,0.18)",borderRadius:16,padding:"28px 32px",marginBottom:36}} className="reveal">
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#f0ead8",marginBottom:8}}>Launching September 2026</h3>
              <p style={{fontSize:13,color:"#9a9280",lineHeight:1.75,marginBottom:20}}>Rosie AI generates high-margin, usage-based revenue through a self-funding marketplace that allows users to purchase and consume individual AI services on demand. This model lowers the barrier to entry for new clients and increases the average revenue per user (ARPU).</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:"#8a6b28",marginBottom:12}}>Core Service Offerings</div>
                  {[["AI Voice Agents","Autonomous inbound/outbound appointment setting and lead qualification"],["Predictive Dialer","Intelligent automated dialing for high-alpha verticals like Solar and Roofing"],["Email Automation","AI-composed, personalized sequences triggered by real-time intent signals"],["Apify Web Scraping","On-demand data extraction from municipal permit filings and social signals"]].map(([name,desc])=>(
                    <div key={name} style={{display:"flex",gap:10,marginBottom:10}}>
                      <span style={{color:"#22c55e",flexShrink:0,marginTop:1}}>✓</span>
                      <div><span style={{fontSize:12,fontWeight:700,color:"#e8e2d0"}}>{name}:</span><span style={{fontSize:12,color:"#9a9280"}}> {desc}</span></div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:"#8a6b28",marginBottom:12}}>Credit Packages</div>
                  <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
                    <thead><tr>{["Package","Price","Credits","Bonus","Rate"].map(h=><th key={h} style={{background:"#18181f",color:"#5a5448",padding:"6px 8px",border:"1px solid rgba(201,168,76,0.10)",fontSize:9,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {[["Starter","$5","500","+100","$0.010/cr"],["Growth","$25","2,500","+250","$0.0091/cr"],["Pro","$50","5,000","+1,000","$0.0083/cr"],["Scale","$100","10,000","+3,000","$0.0077/cr"]].map(([pkg,price,cr,bonus,rate])=>(
                        <tr key={pkg}><td style={{padding:"6px 8px",border:"1px solid rgba(201,168,76,0.10)",color:"#deba6a",fontWeight:700}}>{pkg}</td><td style={{padding:"6px 8px",border:"1px solid rgba(201,168,76,0.10)",color:"#22c55e",fontFamily:"'DM Mono',monospace"}}>{price}</td><td style={{padding:"6px 8px",border:"1px solid rgba(201,168,76,0.10)",color:"#9a9280"}}>{cr}</td><td style={{padding:"6px 8px",border:"1px solid rgba(201,168,76,0.10)",color:"#22c55e"}}>{bonus}</td><td style={{padding:"6px 8px",border:"1px solid rgba(201,168,76,0.10)",color:"#9a9280"}}>{rate}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{marginTop:10,fontSize:10,color:"#5a5448",lineHeight:1.6}}>Consumption: AI Voice = 50 cr/min · Predictive Dialer = 30 cr/min · Email = 10 cr/email</div>
                </div>
              </div>
            </div>

            {/* Financial Impact */}
            <div className="diff-grid reveal" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
              <div className="diff-card"><div className="diff-icon">🔄</div><div className="diff-title">Revenue Flywheel</div><div className="diff-desc">A $5 "Starter Pack" allows any business to trial Rosie AI services without a subscription, creating a built-in sales funnel that accelerates organizational conversion rates from Q4 2026 forward.</div></div>
              <div className="diff-card"><div className="diff-icon">📈</div><div className="diff-title">Conservative Upside</div><div className="diff-desc">Projections assume a 40% attachment rate among subscribers. By December 2027, credit revenue alone is projected to reach $90,000/month at 250 organizations.</div></div>
              <div className="diff-card"><div className="diff-icon">💰</div><div className="diff-title">Blended Profitability</div><div className="diff-desc">Total MRR figures used to trigger the $20,000/month distribution threshold include the combined revenue from both subscription fees and the à la carte credit marketplace.</div></div>
            </div>
          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">Investment terms subject to final documentation. This does not constitute an offer to sell or solicitation to buy securities.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ TEAM ══════════════════════════════════════════════════════════ */}
      <div id="page-team" className={`page${activePage === "team" ? " active" : ""}`}>
        <section className="pad" style={{paddingTop:130}}>
          <div className="wrap">
            <div className="slab">Capital Efficiency: The Global Engineering Advantage</div>
            <h2 className="h2">Elite US Strategy +<br/><em style={{fontStyle:"italic",color:"#deba6a"}}>High-Velocity Execution.</em></h2>
            <div style={{background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.18)",borderRadius:14,padding:"24px 28px",marginBottom:36}}>
              <p style={{fontSize:15,color:"#9a9280",lineHeight:1.78,marginBottom:16}}>Rosie AI is built on a "Capital-Efficient Growth" model that decouples high-level engineering output from traditional Silicon Valley burn rates. Our structure leverages a specialized 5-person core team that integrates senior US leadership with a dedicated international engineering unit.</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[["Strategic Oversight","Directed by our Sr. Technology Engineer and Managing Partner, ensuring every line of code aligns with US enterprise standards and market demand."],["Operational Velocity","A 3-person Philippine Engineering Unit provides 24/7 development cycles and rapid deployment of our 262+ backend functions."],["Strategic Support Functions","The core team is bolstered by a network of specialized advisors and automated systems handling compliance, legal, and multi-tenant security sharding."]].map(([title,desc])=>(
                  <div key={title} style={{display:"flex",gap:10}}>
                    <span style={{color:"#deba6a",flexShrink:0,marginTop:2}}>◆</span>
                    <div><span style={{fontSize:13,fontWeight:700,color:"#e8e2d0"}}>{title}:</span><span style={{fontSize:13,color:"#9a9280"}}> {desc}</span></div>
                  </div>
                ))}
              </div>
              <p style={{fontSize:13,color:"#9a9280",lineHeight:1.7,marginTop:16,marginBottom:0}}>By maintaining a total core team cost of <strong style={{color:"#deba6a"}}>$8,950/month</strong>, this lean, high-output configuration allows us to deploy investor capital toward platform hardening and aggressive market acquisition rather than administrative bloat.</p>
            </div>
            <div className="eng-cards">
              <div className="eng-card us-eng">
                <div className="eng-avatar" style={{fontSize:28}}>👨‍💻</div>
                <div className="eng-name">Christopher</div>
                <div className="eng-role" style={{color:"#deba6a"}}>Sr. Technology Engineer</div>
                <div className="eng-skills-expanded">
                  {[["System Design","Architecting high-performance, multi-tenant SaaS frameworks that translate complex business logic into scalable, modular codebases."],["Security","Implementing rigorous data isolation, SOC2-compliant protocols, and end-to-end encryption to protect enterprise-grade assets."],["Scaling","Engineering elastic infrastructure and optimized database schemas designed to handle rapid user growth."],["Enterprise","Bridging startup agility and corporate stability through robust API integrations and custom-built CRM solutions."],["DevOps","Automating the 'machine that builds the machine' with seamless CI/CD pipelines, containerization, and proactive monitoring."]].map(([tag,desc])=>(
                    <div key={tag} className="eng-skill-row"><span className="eng-skill-tag">{tag}</span><span className="eng-skill-desc">{desc}</span></div>
                  ))}
                </div>
              </div>
              <div className="eng-card us-eng">
                <div className="eng-avatar" style={{fontSize:28}}>👩‍💼</div>
                <div className="eng-name">Stephani Scheidt</div>
                <div className="eng-role" style={{color:"#deba6a"}}>Managing Partner</div>
                <div className="eng-skills-expanded">
                  {[["B2B Sales","Driving the full-cycle sales engine, from high-intent prospecting to closing high-value contracts with data-driven precision."],["Partnerships","Cultivating strategic alliances and ecosystem integrations that expand market reach and deepen product defensibility."],["Channel","Developing and managing indirect sales pipelines that diversify acquisition sources and accelerate market penetration."],["Contractors","Orchestrating high-performance external teams and specialist talent to scale outbound efforts."],["SaaS","Optimizing the recurring revenue model through churn reduction strategies, seat expansion, and value-based selling."]].map(([tag,desc])=>(
                    <div key={tag} className="eng-skill-row"><span className="eng-skill-tag">{tag}</span><span className="eng-skill-desc">{desc}</span></div>
                  ))}
                </div>
              </div>
              <div className="eng-card us-eng" style={{borderColor:"rgba(56,189,248,0.35)",background:"rgba(56,189,248,0.03)",position:"relative"}}>
                <div style={{position:"absolute",top:10,right:10,background:"rgba(56,189,248,0.12)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:4,padding:"2px 8px",fontSize:9,fontWeight:700,letterSpacing:"1.2px",textTransform:"uppercase",color:"#60a5fa"}}>Critical Supporting Vendor</div>
                <div className="eng-avatar" style={{fontSize:22}}>🌊</div>
                <div className="eng-name" style={{marginTop:10}}>Chainwave Studios</div>
                <div className="eng-role" style={{color:"#60a5fa"}}>Enterprise Migration & Development Partner</div>
                <div style={{marginBottom:10}}><a href="https://www.chainwavestudios.com/" target="_blank" rel="noreferrer" style={{fontSize:10,color:"#5a5448",textDecoration:"none",letterSpacing:"0.05em"}}>chainwavestudios.com ↗</a></div>
                <div className="eng-skills-expanded">
                  {[["Enterprise Migration","Leading the full Base44 → enterprise infrastructure migration — architecting a production-grade, scalable environment."],["Platform Dev","Ongoing development support across web, SaaS, and AI solutions — embedded with the core team since day one."],["AI Solutions","Custom AI automation and agent architecture expertise — directly contributed to core pipeline and workflow components."],["FinTech / CRM","Deep domain expertise in financial technology and CRM platforms, informing Rosie AI's multi-tenant architecture."]].map(([tag,desc])=>(
                    <div key={tag} className="eng-skill-row"><span className="eng-skill-tag">{tag}</span><span className="eng-skill-desc">{desc}</span></div>
                  ))}
                </div>
              </div>
              {[["⚙️","PH — Backend Engineer","Pipeline Architecture","Deno / TS","Supabase","Queues","AI Integration"],["🎨","PH — Frontend Engineer","UI / UX Development","React 18","TanStack","Tailwind","Data Viz"],["🔗","PH — Integrations Engineer","APIs & Data Pipeline","Apify","Apollo/Hunter","Instantly","Webhooks"]].map(([icon,name,role,...skills])=>(
                <div key={name} className="eng-card">
                  <div className="eng-avatar">{icon}</div>
                  <div className="eng-name">{name}</div>
                  <div className="eng-role">{role}</div>
                  <div style={{display:"inline-block",background:"rgba(96,165,250,0.12)",color:"#60a5fa",fontSize:9,padding:"2px 8px",borderRadius:3,letterSpacing:"1px",textTransform:"uppercase",marginBottom:8}}>To Be Hired · May 2026</div>
                  <div className="eng-cost">$650 / month</div>
                  <div className="tech-tags">{skills.map(s=><span key={s} className="tech-tag">{s}</span>)}</div>
                </div>
              ))}
            </div>
            <div className="team-hero">
              <div>
                <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#8a6b28",marginBottom:7}}>Annual Engineering Savings vs All-US Team</p>
                <div className="savings-big">$667,600</div>
                <div className="savings-sub">saved per year vs. an equivalent US team of 5</div>
                <div style={{marginTop:16,display:"flex",gap:12,flexWrap:"wrap"}}>
                  <div style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.28)",borderRadius:9,padding:"10px 15px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#22c55e"}}>$107.4K</div>
                    <div style={{fontSize:9,color:"#5a5448",textTransform:"uppercase",letterSpacing:"0.07em"}}>Team Cost/yr</div>
                  </div>
                  <div style={{background:"rgba(229,84,84,0.12)",border:"1px solid rgba(229,84,84,0.3)",borderRadius:9,padding:"10px 15px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#e55454"}}>$775K+</div>
                    <div style={{fontSize:9,color:"#5a5448",textTransform:"uppercase",letterSpacing:"0.07em"}}>All-US Team/yr</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="team-compare">
                  <div className="tc-box us"><div className="tc-flag">🇺🇸</div><div className="tc-country">US Senior Engineer</div><div className="tc-annual">$155,000</div><div className="tc-per">per engineer / year</div><div style={{marginTop:7,fontSize:10,color:"#e55454"}}>+$40K benefits/taxes</div></div>
                  <div className="tc-box ph"><div className="tc-flag">🇵🇭</div><div className="tc-country">PH Senior Engineer</div><div className="tc-annual">$7,800</div><div className="tc-per">per engineer / year</div><div style={{marginTop:7,fontSize:10,color:"#22c55e"}}>No additional overhead</div></div>
                </div>
                <div style={{background:"#1e1e28",borderRadius:11,padding:14,textAlign:"center",border:"1px solid rgba(201,168,76,0.10)"}}>
                  <div style={{fontSize:11,color:"#5a5448",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.08em"}}>Engineering cost per line of code</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#deba6a"}}>95%+ cheaper</div>
                  <div style={{fontSize:11,color:"#5a5448"}}>Same quality · Better availability · Deeper focus</div>
                </div>
              </div>
            </div>
            <div className="savings-timeline">
              <div className="sav-header"><div>Period</div><div>US Team (5 eng.)</div><div>Our Team</div><div>Saved</div></div>
              {[["Year 1","$775,000","$107,400","$667,600"],["Year 2","$1,550,000","$214,800","$1,335,200"],["Year 3","$2,325,000","$322,200","$2,002,800"],["Year 5","$3,875,000","$537,000","$3,338,000"]].map(([p,us,ph,sv])=>(
                <div key={p} className="sav-row"><div className="sav-period">{p}</div><div className="sav-us">{us}</div><div className="sav-ph">{ph}</div><div className="sav-val">{sv}</div></div>
              ))}
            </div>
          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">US salary estimates from 2025 Glassdoor/Levels.fyi. Philippines rates based on contracted rates. Does not include equity or benefits.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ USE OF PROCEEDS ═══════════════════════════════════════════════ */}
      <div id="page-proceeds" className={`page${activePage === "proceeds" ? " active" : ""}`}>
        <section className="pad" style={{paddingTop:130}}>
          <div className="wrap">
            <div className="slab reveal">Capital Allocation Strategy: Engineering for Scale</div>
            <h2 className="h2 reveal">$500,000 Total Raise —<br/><em style={{fontStyle:"italic",color:"#deba6a"}}>One Round. One Mission.</em></h2>
            <p className="lead reveal">Rosie AI, LLC is executing a focused $500,000 capital raise through the issuance of Class B Membership Units, representing a 21.5% equity stake in the Company. Departing from complex multi-tranche or SAFE structures, this is a single-entry Regulation D, Rule 506(c) offering designed for maximum capital efficiency. Every dollar of this raise is purpose-built for a singular objective: hardening our existing, fully functional platform into an enterprise-grade utility — positioning the company to surpass $1M+ ARR within the next 12 months.</p>
            <div className="proceed-hero reveal">
              <div>
                <div className="raise-num">$500K</div>
                <div className="raise-sub">Class B Equity Units · Investor Equity Stake: 21.5%</div>
                <div style={{background:"rgba(34,197,94,0.10)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:9,padding:"10px 14px",display:"inline-flex",alignItems:"center",gap:8,marginBottom:16}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#22c55e"}}>✓ No Broker Fees · No Finder's Fees · No Commissions</span>
                </div>
                <div className="raise-note">This round is being raised directly by the managing partners under Regulation D, Rule 506(c). No placement agents. No commission structure. Every dollar in equals every dollar deployed into product hardening and growth.</div>
              </div>
              <div className="proc-bars">
                {[["Customer Acquisition","30%","c1","$150,000"],["1st Year Personnel Costs","21.5%","c2","$107,400"],["Product Development","20%","c3","$100,000"],["Operations & Legal","10%","c4","$50,000"],["Infrastructure Scaling","10%","c5","$50,000"],["Working Capital Reserve","8.5%","c1","$42,600"]].map(([label,pct,cls,amt])=>(
                  <div key={label} className="proc-bar-row">
                    <div className="proc-label">{label}</div>
                    <div className="proc-track"><div className={`proc-fill ${cls}`} style={{width:pct}}>{pct}</div></div>
                    <div className="proc-amount">{amt}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="breakeven reveal">
              <div style={{fontSize:32,flexShrink:0}}>⚡</div>
              <div>
                <div className="be-num">~15 Orgs</div>
                <div className="be-label">Break-Even Point — Profitable at $10,100/month MRR. Distributions activate at $20,000/month MRR (~28–30 orgs). Projected Q4 2026.</div>
              </div>
            </div>
          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">Investment terms subject to final documentation. This does not constitute an offer to sell or solicitation to buy securities.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ CURRENT STATE ═════════════════════════════════════════════════ */}
      <div id="page-operations" className={`page${activePage === "operations" ? " active" : ""}`}>
        <section className="pad" style={{paddingTop:130}}>
          <div className="wrap">
            <div className="slab reveal">Current State — Q1 2026</div>
            <h2 className="h2 reveal">Fully Built. Fully Audited.<br/><em style={{fontStyle:"italic",color:"#deba6a"}}>Production Ready.</em></h2>
            <p className="lead reveal">Rosie AI is not a concept or a deck — it is a running, audited, multi-tenant SaaS platform built over 18 months through founder-funded sweat equity. Every screen you see below is live production code.</p>
            <div className="ops-proof-strip reveal">
              {[["262","Backend Functions",""],["92/100","Triple-AI Audit Score","sky"],["18mo","In Development","em"],["136","Database Entities",""]].map(([n,l,cls])=>(
                <div key={l} className="ops-proof-cell">
                  <span className={`ops-proof-n${cls?" "+cls:""}`}>{n}</span>
                  <div className="ops-proof-l">{l}</div>
                </div>
              ))}
            </div>
            <div style={{background:"linear-gradient(135deg,rgba(201,168,76,0.08),rgba(201,168,76,0.02))",border:"1px solid rgba(201,168,76,0.25)",borderRadius:16,padding:"28px 36px",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:24,alignItems:"center",marginBottom:44,marginTop:44}} className="reveal">
              <div style={{fontSize:44}}>💪</div>
              <div>
                <h4 style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#f0ead8",marginBottom:5}}>Founder-Funded Sweat Equity Build</h4>
                <p style={{fontSize:13,color:"#9a9280",lineHeight:1.7,margin:0}}>Rosie AI was built entirely through founder sweat equity over 18 months — no institutional funding, no hired agencies. The entire 262-function, 136-entity, multi-tenant platform was designed, built, iterated, and security-audited in-house. The equivalent value of this development effort at US market rates would exceed <strong style={{color:"#deba6a"}}>$750,000</strong>. The $500K raise is being made into a platform that already exists and operates — not a promise.</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
                <div style={{background:"#18181f",border:"1px solid rgba(201,168,76,0.18)",borderRadius:9,padding:"8px 16px",textAlign:"center",whiteSpace:"nowrap"}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#deba6a"}}>$7,500</div>
                  <div style={{fontSize:9,color:"#5a5448",textTransform:"uppercase",letterSpacing:"0.1em"}}>Cash Invested</div>
                </div>
                <div style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.28)",borderRadius:9,padding:"8px 16px",textAlign:"center",whiteSpace:"nowrap"}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#22c55e"}}>$750K+</div>
                  <div style={{fontSize:9,color:"#5a5448",textTransform:"uppercase",letterSpacing:"0.1em"}}>Sweat Equity Value</div>
                </div>
              </div>
            </div>
            <div className="slab reveal">Platform Screenshots — Live Production</div>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#f0ead8",marginBottom:8}} className="reveal">All 7 Core Screens — Live & Operational</h3>
            <p style={{fontSize:13,color:"#9a9280",marginBottom:24}} className="reveal">These are live screens from the deployed production platform — not mockups.</p>
            <div className="screenshots-grid reveal">
              {[["📊","Dashboard","Real-time pipeline metrics & worker health"],["📡","Discovery Campaigns","Multi-vertical campaign builder with AI config"],["👤","Contacts & Leads","CRM with intent scoring and heat board"],["📞","Call Monitor","AI agent call tracking with transcript review"],["⚡","Workflow Manager","Visual automation pipeline builder"],["🛡️","Admin Panel","Multi-org management with feature flags"],["🔒","Security Audit","Triple-AI certified 92/100 audit report"]].map(([icon,label,sub])=>(
                <div key={label} className="screenshot-card" onClick={()=>showPage("audit")}>
                  <div className="screenshot-inner">
                    <div className="screenshot-icon">{icon}</div>
                    <div className="screenshot-label">{label}</div>
                    <div className="screenshot-sub">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">Platform screenshots from v6 production build. All functionality shown is live and operational.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ STRATEGIC ROADMAP ════════════════════════════════════════════ */}
      <div id="page-roadmap" className={`page${activePage === "roadmap" ? " active" : ""}`}>
        <section className="pad" style={{paddingTop:130}}>
          <div className="wrap">
            <div className="slab reveal">Strategic Roadmap</div>
            <h2 className="h2 reveal">The Architecture of Trust:<br/><em style={{fontStyle:"italic",color:"#deba6a"}}>Scaling for the Next Horizon.</em></h2>
            <p className="lead reveal">This investment round is a strategic commitment to our long-term success, ensuring the seamless migration and absolute protection of our customers' most valuable data. We are actively evolving our architecture to meet the rigorous demands of institutional-scale operations.</p>

            <div style={{background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.18)",borderRadius:16,padding:"28px 36px",marginBottom:44}} className="reveal">
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#f0ead8",marginBottom:12}}>One Unified System. Built for Global Demand.</h3>
              <p style={{fontSize:14,color:"#9a9280",lineHeight:1.78,marginBottom:0}}>Rosie AI leverages a distributed SaaS framework to run 150+ backend functions in parallel, ensuring 136 entities stay updated the second data changes. This isn't just another software layer; it's an intelligence powerhouse engineered for massive-scale concurrency without compromising speed. The next evolution of the platform focuses on infrastructure "hardening" — deploying enterprise-grade security and redundancy systems to ensure 99.99% uptime as we scale to support 10,000+ concurrent organizations. Whether you are managing a single medical practice or scaling a global solar empire, your investment fuels our transition to a high-availability framework.</p>
            </div>

            <div className="slab reveal">Enterprise Infrastructure Roadmap — 6-Month Execution</div>

            {/* Phase 1 */}
            <div style={{marginBottom:28}} className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{background:"linear-gradient(135deg,#8a6b28,#deba6a)",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,color:"#070709",whiteSpace:"nowrap"}}>🗓️ Phase 1</div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#f0ead8"}}>Foundation & Data Migration (Q2 2026)</div>
                  <div style={{fontSize:11,color:"#5a5448"}}>Focus: Amazon S3 Integration & Infrastructure Hardening</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
                {[["📦","Amazon S3 Migration","Transitioning all unstructured data, call recordings, and document storage to AWS S3 with cross-region replication for absolute data durability."],["🗄️","Database Optimization","Implementing PostgreSQL read replicas and connection pooling via PgBouncer to handle the initial surge of concurrent organizations."],["🔐","Initial Security Sweep","Implementing encryption at rest and in transit across all S3 buckets and database instances."],["🔄","Integration Framework","Finalizing the REST and GraphQL API structures to prepare for native CRM syncing."]].map(([icon,title,desc])=>(
                  <div key={title} style={{background:"#121218",border:"1px solid rgba(201,168,76,0.10)",borderRadius:10,padding:"14px 16px",display:"flex",gap:12}}>
                    <div style={{fontSize:20,flexShrink:0}}>{icon}</div>
                    <div><div style={{fontSize:12,fontWeight:700,color:"#e8e2d0",marginBottom:4}}>{title}</div><div style={{fontSize:11,color:"#9a9280",lineHeight:1.5}}>{desc}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Phase 2 */}
            <div style={{marginBottom:28}} className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{background:"linear-gradient(135deg,#14a058,#22c55e)",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,color:"#070709",whiteSpace:"nowrap"}}>🗓️ Phase 2</div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#f0ead8"}}>Resilience & Performance (Q3 2026)</div>
                  <div style={{fontSize:11,color:"#5a5448"}}>Focus: 99.99% Uptime & Global Edge Deployment</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
                {[["📊","High Availability","Deploying active-active redundancy and automated health checks every 30 seconds to ensure the 'Four Nines' uptime standard."],["⚡","Hardware Scaling","Launching multi-region edge deployment and auto-scaling worker pools to maintain speed as the user base grows toward 10,000+."],["📉","Traffic Management","Integrating Redis clusters for global rate limiting and CDN caching to optimize real-time streaming performance."],["📋","Compliance Engine","Launching the automated consent management system and TCPA/GDPR audit trails for enterprise data governance."]].map(([icon,title,desc])=>(
                  <div key={title} style={{background:"#121218",border:"1px solid rgba(34,197,94,0.15)",borderRadius:10,padding:"14px 16px",display:"flex",gap:12}}>
                    <div style={{fontSize:20,flexShrink:0}}>{icon}</div>
                    <div><div style={{fontSize:12,fontWeight:700,color:"#e8e2d0",marginBottom:4}}>{title}</div><div style={{fontSize:11,color:"#9a9280",lineHeight:1.5}}>{desc}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Phase 3 */}
            <div style={{marginBottom:44}} className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{background:"linear-gradient(135deg,#1a5fa0,#38bdf8)",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,color:"#070709",whiteSpace:"nowrap"}}>🗓️ Phase 3</div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#f0ead8"}}>Enterprise Maturity & Compliance (Q4 2026)</div>
                  <div style={{fontSize:11,color:"#5a5448"}}>Focus: SOC 2 Completion & Deep Integrations</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
                {[["🛡️","SOC 2 Type II Roadmap","Finalizing the compliance framework, SIEM integration, and conducting the first official penetration testing program."],["🔌","Native CRM Ecosystem","Deploying bi-directional sync for Salesforce, HubSpot, and Pipedrive, allowing Rosie to sit at the center of the user's existing tech stack."],["⚖️","Governance & Audit","Finalizing enterprise DPA agreements and automated data retention policies to meet the standards of Fortune 500 legal teams."],["🛠️","Chaos Engineering","Implementing 'Circuit Breaker' patterns and automated rollback capabilities to ensure <5-minute incident response."]].map(([icon,title,desc])=>(
                  <div key={title} style={{background:"#121218",border:"1px solid rgba(56,189,248,0.15)",borderRadius:10,padding:"14px 16px",display:"flex",gap:12}}>
                    <div style={{fontSize:20,flexShrink:0}}>{icon}</div>
                    <div><div style={{fontSize:12,fontWeight:700,color:"#e8e2d0",marginBottom:4}}>{title}</div><div style={{fontSize:11,color:"#9a9280",lineHeight:1.5}}>{desc}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <div className="footer"><div className="wrap"><p className="footer-disc">Roadmap timelines are projections and subject to change based on engineering priorities and capital deployment.</p><div className="footer-copy">© 2026 Rosie AI, LLC · Confidential</div></div></div>
      </div>

      {/* ══ LIVE CODEBASE EXPLORER ════════════════════════════════════════ */}
      <div id="page-lce" className={`page${activePage === "lce" ? " active" : ""}`} style={{paddingTop:66}}>
        <LiveCodebaseExplorer />
      </div>

      {/* ══ AUDIT ═════════════════════════════════════════════════════════ */}
      <div id="page-audit" className={`page${activePage === "audit" ? " active" : ""}`}>
        <div className="pdf-doc">
          <div className="pdf-page">
            <div className="pdf-header-band">
              <div className="pdf-header-title">Security Audit Report — Rosie AI, LLC</div>
              <div className="pdf-header-meta">Triple-AI Certified · v6 Production Build · March 2026</div>
            </div>
            <div className="pdf-cover">
              <div className="pdf-cover-top" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:36,position:"relative",zIndex:1}}>
                <div>
                  <div className="pdf-cover-eyebrow" style={{fontSize:9,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#64748b",marginBottom:18}}>SECURITY AUDIT — PRODUCTION CERTIFICATION</div>
                  <div className="pdf-cover-h1">Rosie AI Platform<br/><em>Security Assessment</em></div>
                  <div className="pdf-cover-sub" style={{fontSize:12,color:"#64748b",marginBottom:28,letterSpacing:"0.04em"}}>Version 6 · Audited March 2026 · All Findings Remediated</div>
                </div>
                <div style={{position:"relative",width:120,height:120,flexShrink:0}}>
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(56,189,248,0.15)" strokeWidth="8"/>
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#38bdf8" strokeWidth="8" strokeDasharray={`${0.92*2*Math.PI*54} ${2*Math.PI*54}`} strokeDashoffset={2*Math.PI*54*0.25} strokeLinecap="round"/>
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:900,color:"#38bdf8",lineHeight:1}}>92</span>
                    <span style={{fontSize:7,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#64748b",marginTop:2}}>OUT OF 100</span>
                    <span style={{fontSize:6,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#22c55e",marginTop:3}}>PRODUCTION READY</span>
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,position:"relative",zIndex:1,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:22}}>
                {[["🤖","Claude","claude-opus-4","Anthropic"],["🧠","GPT-4o","gpt-4o-2024-11","OpenAI"],["💎","Gemini","gemini-1.5-pro","Google DeepMind"]].map(([icon,name,model,org])=>(
                  <div key={name} className="pdf-certifier">
                    <div className="pdf-cert-icon" style={{fontSize:20,marginBottom:7}}>{icon}</div>
                    <div className="pdf-cert-name" style={{fontSize:12,fontWeight:700,color:"#38bdf8",marginBottom:2}}>{name}</div>
                    <div className="pdf-cert-model" style={{fontSize:9,color:"#475569",marginBottom:3}}>{model}</div>
                    <div className="pdf-cert-org" style={{fontSize:9,color:"#64748b",marginBottom:8}}>{org}</div>
                    <div className="pdf-cert-check">✓ Certified</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pdf-body">
              <div className="pdf-section">
                <div className="pdf-sec-num">01</div>
                <div className="pdf-sec-title">Executive Summary</div>
                <p style={{fontSize:11,color:"#64748b",lineHeight:1.7}}>The Rosie AI platform v6 production build was subjected to a comprehensive Triple-AI security audit conducted simultaneously by three independent AI systems: Claude (Anthropic), GPT-4o (OpenAI), and Gemini 1.5 Pro (Google DeepMind). All 5 identified vulnerabilities were remediated prior to production deployment. The platform achieved a composite security score of <strong style={{color:"#38bdf8"}}>92/100</strong> and is certified PRODUCTION READY.</p>
              </div>
              <div className="pdf-section">
                <div className="pdf-sec-num">02</div>
                <div className="pdf-sec-title">Audit Findings — All Remediated</div>
                {[["VULN-001","CRITICAL","Authorization Bypass in Admin Functions","base44/functions/adminQuery/entry.ts","Role check condition evaluated incorrectly — !user?.role !== 'admin' is always true due to operator precedence. All admin functions were accessible to unauthenticated requests."],["VULN-002","HIGH","Missing HMAC Signature Validation on Twilio Webhooks","base44/functions/twilioResponseWebhook/entry.ts","Twilio webhook endpoints accepted requests without validating the X-Twilio-Signature header, allowing spoofed webhook calls from any source."],["VULN-003","HIGH","SSRF Vulnerability in Webhook Dispatcher","base44/functions/webhookDispatcher/entry.ts","target_url field accepted arbitrary URLs including internal network addresses (169.254.169.254, 10.x.x.x), enabling Server-Side Request Forgery attacks."],["VULN-004","CRITICAL","AI Budget Kill Switch Not Fail-Closed","base44/functions/killSwitch/entry.ts","On database errors, the kill switch returned kill_switch_active: false, allowing unlimited AI spend during outages. FAIL-OPEN by design error."],["VULN-005","HIGH","SQL Injection via Unvalidated Campaign ID","base44/functions/campaignPipelineAudit/entry.ts","campaign_id parameter was interpolated directly into query strings without parameterization, enabling potential SQL injection attacks."]].map(([id,sev,title,file,desc])=>(
                  <div key={id} className="pdf-finding-row">
                    <div className="pdf-finding-id">{id}</div>
                    <div>
                      <div className="pdf-finding-title"><span className={sev==="CRITICAL"?"pdf-sev-crit":"pdf-sev-high"}>{sev}</span>{title}</div>
                      <div className="pdf-finding-file">{file}</div>
                      <div className="pdf-finding-desc">{desc}</div>
                    </div>
                    <div className="pdf-fixed">✓ Fixed</div>
                  </div>
                ))}
              </div>
              <div className="pdf-section">
                <div className="pdf-sec-num">06</div>
                <div className="pdf-sec-title">Scoring Breakdown</div>
                <div className="pdf-score-row">
                  {[["Rate Limiting","9.0","In-memory sliding window correct for current scale. For multi-instance, replace Map with Redis."],["Input Validation","9.2","Phone validation + bulk caps added. CSV parser RFC-4180 compliant."],["Row-Level Security","8.7","asServiceRole used correctly. RLS policies applied. leadStreamer and leadPipeline are local modules (no auth by design)."]].map(([cat,val,note])=>(
                    <div key={cat} className="pdf-score-card">
                      <div className="pdf-score-cat">{cat}</div>
                      <div className="pdf-score-val">{val}<span style={{fontSize:13,color:"#475569"}}>/10</span></div>
                      <div className="pdf-score-note">{note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pdf-section">
                <div className="pdf-sec-num">09</div>
                <div className="pdf-sec-title">Certification Statement</div>
                <p style={{fontSize:11,color:"#64748b",lineHeight:1.7,marginBottom:16}}>This audit was conducted independently by three AI systems with no coordination between auditors. All findings represent consensus vulnerabilities identified across multiple audit passes. The remediation of all 5 critical and high-severity vulnerabilities, combined with the platform's comprehensive security architecture, qualifies the Rosie AI v6 production build as PRODUCTION READY for multi-tenant enterprise deployment.</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                  {[["🤖","Claude — Anthropic","CERTIFIED"],["🧠","GPT-4o — OpenAI","CERTIFIED"],["💎","Gemini — Google DeepMind","CERTIFIED"]].map(([icon,org,status])=>(
                    <div key={org} style={{background:"rgba(34,197,94,0.05)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
                      <div style={{fontSize:18,marginBottom:6}}>{icon}</div>
                      <div style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>{org}</div>
                      <div className="pdf-cert-check">{status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
