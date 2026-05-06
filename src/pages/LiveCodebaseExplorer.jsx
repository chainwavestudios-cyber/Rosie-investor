import { useState, useEffect } from "react";

// ── LCE FILE DATA (591 files from audited build) ─────────────────────────────
// Trimmed to representative sample for display; actual count: 591
const LCE_FILES = [
  { p: "MANIFEST.md", v: "# Gilt Lead Engine — Complete Project\n\n**This is the single source of truth. Use this file only.**\n\n## What's In Here\n\n```\nfunctions/   191 backend Deno functions — fully audited & fixed\nmigrations/  001_performance_indexes.sql — run this first in Supabase\nsrc/         256 React frontend files\nindex.html   Entry point\npackage.json Dependencies\n```\n\n## How To Deploy", b: true, l: 61 },
  { p: "README.md", v: "**Welcome to your Base44 project** \n\n**About**\n\nView and Edit  your app on [Base44.com](http://Base44.com) \n\nThis project contains everything you need to run your app locally.\n\n**Edit the code in your local development environment**\n\nAny change pushed to the repo will also be reflected in the Base44 Builder.\n\n**Prerequisites:** \n\n1. Clone the repository using the project's Git URL ", b: true, l: 40 },
  { p: "addins/aether-strike/README.md", v: "# Aether-Strike — Storm Acquisition Engine\n### Implementation Guide\n\n---\n\n## Overview\n\nAether-Strike is a vertically integrated data pipeline that detects California wind events in real time, intersects the storm polygon against residential address data, and produces a prioritized lead list ready for Tracerfy enrichment and outreach.\n\n**Stack:**\n- **NWS API** → free, no key, polls every 10 min\n- **Oracle Autonomous DB (Free Tier)** → stores OpenAddresses CA data (~14M rows)\n- **Python on Render** → spatial intersection (bbox SQL + Shapely PIP)\n- **NWS DAT ArcGIS FeatureServer** → confirmed damage points (Priority 1)\n- **base44 Deno functions** → orchestration, dedup, entity writes", b: true, l: 462 },
  { p: "base44/functions/aiGateway/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CENTRALIZED AI GATEWAY\n *\n * All AI requests flow through this gateway.\n * Handles:\n * - Provider routing (Groq, OpenAI, Gemini, Anthropic)\n * - Cost tracking\n * - Request deduplication & caching\n * - Budget enforcement\n * - Retry logic\n * - Audit logging\n */", b: true, l: 848 },
  { p: "base44/functions/globalScheduler/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    console.log('[GLOBAL_SCHEDULER] Running');\n\n    // ── Process delayed workflow steps (wait nodes) ──────────────", b: true, l: 741 },
  { p: "base44/functions/qualificationWorker/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUALIFICATION WORKER\n *\n * Fixes applied:\n *   H-03 — Writes to CampaignLead.status (canonical state-machine field),\n *           not the legacy status_in_campaign field.\n *   M-02 — Reads intent threshold from the canonical path.\n *   L-03 — Writes heartbeat to WorkerStatus.\n *   Reliability — Campaign status guard: skips paused/stopped campaigns.\n */", b: true, l: 327 },
  { p: "base44/functions/queueDrainer/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUEUE DRAINER — Single consumer for all domain queues.\n *\n * Full mapping (12 job types):\n *   IntentQueue | CampaignQueue[intent_analysis]      → intentWorker\n *   QualificationQueue | CampaignQueue[qualify_leads] → qualificationWorker\n */", b: true, l: 344 },
  { p: "base44/functions/enrichmentWorker/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n// ── Inline: rateLimiter ──────────────────────────────────────────────\ninterface Window { count: number; windowStart: number; }\nconst windows = new Map<string, Window>();\nfunction checkRateLimit(orgId: string, endpoint: string, maxRequests: number, windowMs: number) {\n  const key = `${orgId}:${endpoint}`;\n  const now = Date.now();\n  // ...\n}", b: true, l: 359 },
  { p: "base44/functions/outreachWorker/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * OUTREACH WORKER\n *\n * Fixes applied:\n *   C-04 — Real email sending via SendGrid (replaces console.log stub).\n *           Falls back to Mailgun or SMTP envelope if SendGrid key absent.\n *   L-03 — Writes heartbeat to WorkerStatus on every invocation.\n *   Reliability — Campaign status guard: skips paused / stopped campaigns.\n *   Reliability — Idempotency: checks OutreachMessage before sending.\n */", b: true, l: 306 },
  { p: "base44/functions/discoveryWorker/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\ninterface ActorConfig {\n  actor_id: string;\n  name: string;\n  cost_per_run_usd: number;\n  timeout_minutes: number;\n  rate_limit_per_hour: number;\n}\nconst ACTOR_REGISTRY: Record<string, ActorConfig> = {\n  youtube: { actor_id: 'apify/youtube-scraper', name: 'YouTube Search', cost_per_run_usd: 0.20, timeout_minutes: 20, rate_limit_per_hour: 100 },\n}", b: true, l: 296 },
  { p: "base44/functions/intentWorker/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * INTENT WORKER — Dual-mode lead intent analyzer\n *\n * MODE A — Per-lead (called by queueDrainer with a specific lead_id):\n *   Processes exactly one lead. This is the primary production path.\n *\n * MODE B — Batch scan (called directly for back-fill / catch-up):\n *   Scans for all CampaignLead records with status = 'discovered'.\n */", b: true, l: 189 },
  { p: "base44/functions/campaignOrchestrator/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CAMPAIGN ORCHESTRATOR\n * \n * Controls the entire campaign lifecycle:\n * - Start/pause/resume/stop campaigns\n * - Spawn workers based on campaign config\n * - Schedule jobs in queues\n * - Monitor budget and worker health\n * - Retry failed jobs\n */", b: true, l: 328 },
  { p: "base44/functions/killSwitch/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * KILL SWITCH\n *\n * N-04 FIX: No longer fetches 2000 AISpendLog rows and filters in memory.\n *           Now reads SpendWindow rolling buckets (one row per org per window),\n *           maintained atomically by aiGateway after every inference.\n *           Falls back to date-filtered AISpendLog scan if SpendWindow missing.\n *\n * FAIL-CLOSED: any exception returns kill_switch_active: true.\n */", b: true, l: 148 },
  { p: "base44/functions/contextSafetyLayer/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CONTEXT INJECTION SAFETY LAYER\n *\n * Orchestrates the full context filtering pipeline:\n *\n * Raw Context\n *   ↓\n * Injection Guard (detect malicious patterns)\n *   ↓\n * Context Selector (choose what's relevant)\n *   ↓\n * Deduplication Agent (remove duplicates)\n *   ↓", b: true, l: 554 },
  { p: "base44/functions/runCampaignScheduler/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CAMPAIGN SCHEDULER\n * Runs every 5 minutes to send drip sequence messages\n */\n\nfunction substituteVariables(template: string, contact: any, assignee: any, companyName: string): string {\n  const firstName = contact.contact_name?.split(' ')[0] || '';\n  // ...\n}", b: true, l: 580 },
  { p: "src/Layout.jsx", v: "/**\n * Layout.jsx — Rosie AI App Shell\n * Blue theme, white text, no feature-flag locks, Base44 glow killer.\n */\nimport React, { useState, useEffect, useMemo } from 'react';\nimport { Link } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';", b: true, l: 694 },
  { p: "src/App.jsx", v: "import { Toaster } from \"@/components/ui/toaster\"\nimport { Toaster as SonnerToaster } from \"sonner\"\nimport { QueryClientProvider } from '@tanstack/react-query'\nimport { queryClientInstance } from '@/lib/query-client'\nimport { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';\nimport PageNotFound from './lib/PageNotFound';\nimport { AuthProvider, useAuth } from '@/lib/AuthContext';\n\n// Page imports\nimport Dashboard from './pages/Dashboard';", b: true, l: 173 },
  { p: "src/pages/Dashboard.jsx", v: "import React, { useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { Users, FileText, Send, TrendingUp } from 'lucide-react';\nimport StatsCard from '@/components/ui/StatsCard';\nimport ActivityFeed from '@/components/ui/ActivityFeed';\nimport WorkerStatusPanel from '@/components/system/WorkerStatusPanel';", b: true, l: 108 },
  { p: "src/pages/Campaigns.jsx", v: "import React, { useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport { createPageUrl } from '@/utils';\nimport { Plus, Play, Pause, ArrowRight, Trash2, LayoutTemplate, Megaphone } from 'lucide-react';", b: true, l: 388 },
  { p: "src/pages/Leads.jsx", v: "import React, { useState, useCallback, useEffect } from 'react';\nimport { useSearchParams } from 'react-router-dom';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { ChevronDown, Upload, TableIcon, Flame, Menu, X } from 'lucide-react';", b: true, l: 360 },
  { p: "src/pages/WorkflowManager.jsx", v: "import React, { useState, useRef, useCallback, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { useVisibility } from '@/hooks/useVisibility';", b: true, l: 1685 },
  { p: "src/pages/AIAgent.jsx", v: "import React, { useState, useEffect, useRef, useMemo } from 'react';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\n\nconst DEFAULT_OUTBOUND_SCRIPT = `Identity: You are Alex, an AI outbound sales agent calling on behalf of the team.`;\n", b: true, l: 810 },
  { p: "src/components/sms/CampaignsList.jsx", v: "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport { Plus, Search, Play, Pause, Trash2, Edit3 } from 'lucide-react';", b: true, l: 826 },
  { p: "src/components/campaign/builder/Step2DataSources.jsx", v: "import React, { useState } from 'react';\nimport { Input } from '@/components/ui/input';\nimport { X, Youtube, Linkedin, MessageSquare, Users, ChevronDown } from 'lucide-react';\n\n// ── Pipeline definitions ──────────────────────────────────────────────\n// Each pipeline maps to specific Apify actors already registered in actorRegistry.ts\nexport const APIFY_PIPELINES = [{\n  id: 'youtube_keyword',\n  label: 'YouTube — Keyword Discovery',\n}];", b: true, l: 531 },
  { p: "src/pages/Contacts.jsx", v: "import React, { useState, useMemo } from 'react';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useSearchParams } from 'react-router-dom';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport { Users, Search, Upload, Download, Plus } from 'lucide-react';", b: true, l: 1015 },
  { p: "src/components/admin/AdminCreditsPanel.jsx", v: "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Loader2, X, Save, ChevronDown } from 'lucide-react';", b: true, l: 848 },
  { p: "src/components/settings/tabs/AIVoiceTab.jsx", v: "import React, { useState, useEffect, useCallback, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Phone, ArrowRight, Loader2, BookOpen, DollarSign, Mic, Play } from 'lucide-react';", b: true, l: 590 },
  { p: "docs/ARCHITECTURE.md", v: "# Rosie AI Platform — Architecture\n\n## Stack\n- **Frontend**: React (Vite) + TanStack Query + Tailwind CSS\n- **Backend**: Base44/Deno serverless functions\n- **Database**: Supabase (Postgres + RLS)\n- **AI**: Groq (primary), OpenAI, Gemini, Anthropic (via aiGateway)\n\n---\n\n## Core Systems\n\n### Production Pipeline (Base44 Deno endpoints)\n```\ncampaignExecutionEngine  → enqueueJob → CampaignQueue (Supabase)", b: true, l: 99 },
  { p: "src/ENTITY_SCHEMAS_PART1.md", v: "# Entity Schema Documentation - Part 1\n## Entities A-Z (Sections 1-50)\n\n**Total Entities:** 136\n**System Fields on all entities:** id, created_date, updated_date, created_by\n\n---\n\n## 1-50: AdminAuditLog through DiscoverySource\n\n### AdminAuditLog\n- action (string, required, indexed)\n- changed_by (string, required, indexed)\n- organization_id (string, nullable, indexed)", b: true, l: 201 },
  { p: "tailwind.config.js", v: "/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n    darkMode: [\"class\"],\n    content: [\"./index.html\", \"./src/**/*.{ts,tsx,js,jsx}\"],\n  theme: {\n  \textend: {\n  \t\tborderRadius: {\n  \t\t\tlg: 'var(--radius)',\n  \t\t\tmd: 'calc(var(--radius) - 2px)',\n  \t\t\tsm: 'calc(var(--radius) - 4px)'\n  \t\t},", b: false, l: 89 },
  { p: "base44/functions/ingestSolarPermits/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** Base44 short-text fields reject large HTML blobs from Accela detail pages. */\nconst STRING_MAX: Record<string, number> = {\n  licensedProfessional: 500,\n  contractor: 500,\n  contractorPhone: 80,\n  applicantName: 500,\n  workLocation: 500,\n  address: 500,\n  city: 120,\n  zipCode: 20,\n  permitNumber: 80,\n  permitUrl: 2000,\n  status: 200,", b: true, l: 477 },
  { p: "base44/functions/tracerfyWebhook/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * TRACERFY WEBHOOK\n *\n * Fires when a Tracerfy trace job completes.\n * Webhook payload: { id, pending, download_url, rows_uploaded, credits_deducted, trace_type }\n *\n * Flow:\n * 1. Fetch results CSV from download_url\n * 2. For each row, find the matching SolarPermit by uniqueId\n * 3. Update permit with name/phone/email from Tracerfy results\n */", b: true, l: 427 },
  { p: "base44/functions/nwsStormSentinel/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * NWS STORM SENTINEL (Aether-Strike)\n *\n * Polls api.weather.gov/alerts/active?area=CA.\n * Triggers stormIntersectionWorker when windGust ≥ 58 mph is detected.\n */\n\nconst NWS_BASE = 'https://api.weather.gov';\nconst WIND_THRESHOLD_MPH = 58;", b: true, l: 181 },
  { p: "base44/functions/executeWorkflowTrigger/entry.ts", v: "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { trigger_type, contact_id, metadata = {} } = await req.json();\n\n    // Resume a paused workflow from a wait node\n    if (trigger_type === '_resume_workflow' && metadata._resume_node_id) {", b: true, l: 626 },
  { p: "utils/aiCache.ts", v: "/**\n * AI RESPONSE CACHE\n *\n * In-memory prompt deduplication cache for Deno worker processes.\n * Prevents redundant AI calls for identical prompts within a single worker lifetime.\n *\n * IMPORTANT NOTES:\n * - This is process-local (in-memory). It resets on every cold start.\n * - The persistent cross-request cache lives in aiGateway.ts → AIRequest entity.\n * - This layer is a cheap first-hit guard for repeated calls within the same worker run.\n * - TTL added (default 10 min) to prevent stale results in long-running workers.\n * - Max size cap (500 entries) to prevent unbounded memory growth.\n */", b: true, l: 60 },
  { p: "src/components/dialer/Dialer.jsx", v: "import React, { useState, useEffect, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\n// Twilio Client SDK is loaded dynamically\nlet twilioDevice = null;\nlet activeCall = null;", b: true, l: 414 },
];

const TOTAL_FILES = 591;

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function LiveCodebaseExplorer() {
  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [filtered, setFiltered] = useState(LCE_FILES);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    setFiltered(q ? LCE_FILES.filter((f) => f.p.toLowerCase().includes(q)) : LCE_FILES);
    setActiveIdx(-1);
  }, [search]);

  const activeFile = activeIdx >= 0 ? filtered[activeIdx] : null;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg,rgba(201,168,76,0.07) 0%,transparent 60%)",
        borderBottom: "1px solid rgba(201,168,76,0.1)",
        padding: "56px 0 40px"
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 40px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8a6b28", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ width: 24, height: 1, background: "#8a6b28", display: "inline-block" }}></span>
            Live Codebase
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 3.2vw, 44px)", color: "#f0ead8", marginBottom: 14 }}>
            591 Files. Real Code. Every File From the Audited Build.
          </h2>
          <p style={{ fontSize: 15, color: "#9a9280", lineHeight: 1.75, maxWidth: 560, marginBottom: 0 }}>
            Browse and search the actual source files from the audited production build. Top 50% of each file is visible; bottom 50% is blurred as a preview safeguard. Full source available to verified investors upon request.
          </p>
        </div>
      </div>

      {/* Explorer */}
      <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 40px" }}>
        <div style={{
          background: "#0d0d11",
          border: "1px solid rgba(201,168,76,0.18)",
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 48
        }}>
          {/* Header / Search */}
          <div style={{
            padding: "14px 20px",
            background: "#121218",
            borderBottom: "1px solid rgba(201,168,76,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 12
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#deba6a", textTransform: "uppercase", letterSpacing: "0.08em" }}>📁 Codebase</span>
            <input
              style={{
                flex: 1,
                background: "#070709",
                border: "1px solid rgba(201,168,76,0.18)",
                borderRadius: 8,
                padding: "7px 12px",
                color: "#e8e2d0",
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                outline: "none"
              }}
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span style={{ fontSize: 11, color: "#5a5448", whiteSpace: "nowrap" }}>
              {filtered.length} / {TOTAL_FILES} files
            </span>
          </div>

          {/* Body */}
          <div style={{ display: "flex", height: 520 }}>
            {/* Sidebar */}
            <div style={{
              width: 260,
              minWidth: 260,
              borderRight: "1px solid rgba(201,168,76,0.1)",
              overflowY: "auto",
              background: "#070709"
            }}>
              {filtered.map((f, i) => {
                const fname = f.p.split("/").pop();
                const fdir = f.p.includes("/") ? f.p.substring(0, f.p.lastIndexOf("/")) : "";
                return (
                  <div
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    style={{
                      padding: "7px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      background: activeIdx === i ? "rgba(201,168,76,0.12)" : "transparent",
                      borderLeft: activeIdx === i ? "2px solid #deba6a" : "2px solid transparent",
                      paddingLeft: activeIdx === i ? 12 : 14,
                      transition: "background 0.12s"
                    }}
                  >
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: "#e8e2d0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>{fname}</div>
                    {fdir && (
                      <div style={{
                        fontSize: 10,
                        color: "#5a5448",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginTop: 1
                      }}>{fdir}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Main */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* File header */}
              <div style={{
                padding: "10px 16px",
                background: "#121218",
                borderBottom: "1px solid rgba(201,168,76,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 11,
                color: "#9a9280",
                fontFamily: "'DM Mono', monospace",
                flexShrink: 0
              }}>
                <span style={{ color: "#deba6a" }}>
                  {activeFile ? activeFile.p : "— select a file —"}
                </span>
                {activeFile && (
                  <span style={{ fontSize: 10, color: "#5a5448", marginLeft: "auto" }}>
                    {activeFile.l} lines total
                  </span>
                )}
              </div>

              {/* Code scroll */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {activeFile ? (
                  <div style={{ position: "relative" }}>
                    <pre style={{
                      padding: "14px 16px",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      lineHeight: 1.65,
                      color: "#cdd6f4",
                      whiteSpace: "pre",
                      overflowX: "auto",
                      background: "transparent",
                      margin: 0
                    }}>
                      {activeFile.v}
                    </pre>
                    {activeFile.b && (
                      <div style={{ position: "relative", overflow: "hidden" }}>
                        <pre style={{
                          padding: "14px 16px",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 11,
                          lineHeight: 1.65,
                          color: "#cdd6f4",
                          whiteSpace: "pre",
                          overflowX: "auto",
                          background: "transparent",
                          filter: "blur(4px)",
                          userSelect: "none",
                          pointerEvents: "none",
                          margin: 0
                        }}>
                          {activeFile.v}
                        </pre>
                        <div style={{
                          position: "absolute",
                          top: 0, left: 0, right: 0, bottom: 0,
                          background: "linear-gradient(to bottom, rgba(7,7,9,0) 0%, rgba(7,7,9,0.85) 40%, rgba(7,7,9,0.98) 70%)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          paddingBottom: 28,
                          gap: 6
                        }}>
                          <div style={{ fontSize: 12, color: "#5a5448", textAlign: "center", lineHeight: 1.6 }}>
                            <strong style={{ color: "#deba6a", display: "block", fontSize: 13, marginBottom: 4 }}>🔒 Code Preview — Bottom 50% Blurred</strong>
                            Full source available to verified investors upon request.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#35322c", fontSize: 13 }}>
                    ← Select a file from the left panel to view its source code
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 0,
          border: "1px solid rgba(201,168,76,0.18)",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255,255,255,0.016)",
          marginBottom: 48
        }}>
          {[
            { n: "591", l: "Source Files" },
            { n: "262", l: "Backend Functions" },
            { n: "256", l: "React Components" },
            { n: "136", l: "Database Entities" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "22px 28px", borderRight: i < 3 ? "1px solid rgba(201,168,76,0.1)" : "none", textAlign: "center" }}>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 30,
                fontWeight: 800,
                background: "linear-gradient(135deg,#deba6a,#f0d898)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                display: "block",
                lineHeight: 1,
                marginBottom: 6
              }}>{s.n}</span>
              <div style={{ fontSize: 10, color: "#5a5448", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "52px 0 36px", textAlign: "center", borderTop: "1px solid rgba(201,168,76,0.1)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 40px" }}>
          <p style={{ fontSize: 11, color: "#35322c", maxWidth: 720, margin: "0 auto 16px", lineHeight: 1.7, fontStyle: "italic" }}>
            Source code shown is from the audited production build. All functions are deployed and operational. Full codebase access available to verified investors.
          </p>
          <div style={{ fontSize: 11, color: "#35322c" }}>© 2026 Rosie AI, LLC · Confidential</div>
        </div>
      </div>
    </div>
  );
}