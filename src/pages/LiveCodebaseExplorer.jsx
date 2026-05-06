import { useState, useEffect } from "react";

const LCE_FILES = [
  {
    "p": "MANIFEST.md",
    "v": "# Gilt Lead Engine — Complete Project\n\n**This is the single source of truth. Use this file only.**\n\n## What's In Here\n\n```\nfunctions/   191 backend Deno functions — fully audited & fixed\nmigrations/  001_performance_indexes.sql — run this first in Supabase\nsrc/         256 React frontend files\nindex.html   Entry point\npackage.json Dependencies\n```\n\n## How To Deploy",
    "b": true,
    "l": 61
  },
  {
    "p": "README.md",
    "v": "**Welcome to your Base44 project** \n\n**About**\n\nView and Edit  your app on [Base44.com](http://Base44.com) \n\nThis project contains everything you need to run your app locally.\n\n**Edit the code in your local development environment**\n\nAny change pushed to the repo will also be reflected in the Base44 Builder.\n\n**Prerequisites:** \n\n1. Clone the repository using the project's Git URL ",
    "b": true,
    "l": 40
  },
  {
    "p": "addins/aether-strike/README.md",
    "v": "# Aether-Strike — Storm Acquisition Engine\n### Implementation Guide\n\n---\n\n## Overview\n\nAether-Strike is a vertically integrated data pipeline that detects California wind events in real time, intersects the storm polygon against residential address data, and produces a prioritized lead list ready for Tracerfy enrichment and outreach.\n\n**Stack:**\n- **NWS API** → free, no key, polls every 10 min\n- **Oracle Autonomous DB (Free Tier)** → stores OpenAddresses CA data (~14M rows)\n- **Python on Render** → spatial intersection (bbox SQL + Shapely PIP)\n- **NWS DAT ArcGIS FeatureServer** → confirmed damage points (Priority 1)\n- **base44 Deno functions** → orchestration, dedup, entity writes",
    "b": true,
    "l": 462
  },
  {
    "p": "addins/aether-strike/base44/functions/nwsStormSentinel/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';\n\n/**\n * NWS STORM SENTINEL\n *\n * Polls api.weather.gov/alerts/active?area=CA every 10 minutes.\n * Triggers stormIntersectionWorker when windGust ≥ 58 mph is detected.\n *\n * Handles two alert types:\n *   1. Polygon-based (Severe Thunderstorm Warning) — geometry in the alert itself\n *   2. Zone-based (High Wind Warning / Santa Ana) — geometry fetched from /zones/ API\n *\n * Deduplicates on alert ID so the same storm doesn't spawn multiple jobs.\n */\n",
    "b": true,
    "l": 189
  },
  {
    "p": "addins/aether-strike/base44/functions/stormIntersectionWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';\n\n/**\n * STORM INTERSECTION WORKER\n *\n * Called by nwsStormSentinel after a qualifying wind event is detected.\n *\n * Steps:\n *   1. Call Render /storm-intersection with polygon → addresses from OpenAddresses/Oracle\n *   2. Query NWS DAT FeatureServer for confirmed damage points in same bbox\n *   3. Merge + deduplicate (DAT = Priority 1, broad-net = Priority 2)\n *   4. Sort by priority then year_built ASC (older roofs first)\n *   5. Cap at 1000 total, write as StormLead entities\n *   6. Update StormEvent with counts\n */",
    "b": true,
    "l": 224
  },
  {
    "p": "addins/aether-strike/frontend/src/components/campaign/DiscoveryTab.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Wind, Radar, MapPin, CheckCircle2,\n  Clock, Zap, RefreshCw, Play, Shield,\n  ChevronDown, ChevronRight, Activity, Target\n} from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nfunction PriorityBadge({ priority }) {\n  return priority === 1\n    ? <span className=\"text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20\">DAT P1</span>\n    : <span className=\"text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/15\">Broad-Net</span>;",
    "b": true,
    "l": 297
  },
  {
    "p": "addins/aether-strike/frontend/src/pages/CampaignDetail.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useParams, useSearchParams, useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport {\n  Play, Pause, Settings, BarChart3, Users, Activity,\n  Cpu, FileText, ArrowLeft, ChevronDown,\n  CheckCircle2, AlertTriangle, Clock, TrendingUp, Send,\n  MessageSquare, DollarSign, Zap, RefreshCw\n} from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport CampaignAnalytics from '@/components/campaign/CampaignAnalytics';\nimport EnrolledLeads from '@/components/campaign/EnrolledLeads';",
    "b": true,
    "l": 383
  },
  {
    "p": "ai/prompts/intentAnalysis.ts",
    "v": "/**\n * INTENT ANALYSIS PROMPT\n *\n * Merged from agentbman_platform_full_system/ai/prompts/intentAnalysis.ts\n *\n * Changes from original:\n *   - Added system message (better instruction following)\n *   - Structured JSON output requirement (prevents hallucinated fields)\n *   - Lead data is serialized safely (avoids prompt injection from lead fields)\n *   - Added lead field allowlist so we don't accidentally inject full DB records\n *     with sensitive org data into the prompt\n */\n\ninterface LeadContext {\n  id?: string;",
    "b": true,
    "l": 59
  },
  {
    "p": "ai/prompts/messageGeneration.ts",
    "v": "/**\n * MESSAGE GENERATION PROMPT\n *\n * Merged from agentbman_platform_full_system/ai/prompts/messageGeneration.ts\n *\n * Changes from original:\n *   - Structured output requirement (returns JSON so caller can extract subject + body)\n *   - Added tone/channel parameter (email vs LinkedIn vs Twitter)\n *   - Lead field allowlist (same as intentAnalysis — prevents data leakage)\n *   - Constrained length to avoid runaway token usage\n */\n\ninterface LeadContext {\n  name?: string;\n  title?: string;",
    "b": true,
    "l": 86
  },
  {
    "p": "base44/functions/actorRegistry/entry.ts",
    "v": "/**\n * ACTOR REGISTRY — Single source of truth for all Apify actor IDs.\n *\n * Previously actor IDs were scattered across three files with conflicting values:\n *   - discoveryWorker.ts\n *   - apifyDataSourceIntegration.ts\n *   - apifyClient.ts\n *\n * All files must import from here. Never hard-code actor IDs elsewhere.\n *\n * Actor ID format: \"owner/actor-name\" — verified against Apify platform.\n */\n\nexport const ACTOR_REGISTRY = {\n  // ── Video platforms ────────────────────────────────────────────",
    "b": true,
    "l": 166
  },
  {
    "p": "base44/functions/addCredits/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const {\n      organization_id, amount, type,\n      description, created_by, reference_id, called_by_system,\n    } = await req.json();\n\n    // Guard: only admins can manually add credits (system calls bypass)\n    if (!called_by_system) {\n      const user = await base44.auth.me().catch(() => null);\n      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n",
    "b": true,
    "l": 94
  },
  {
    "p": "base44/functions/adminQuery/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * adminQuery — consolidated admin CRUD gateway\n * Replaces all frontend base44.asServiceRole.entities.* calls in admin components.\n * Only accessible by admin/super_admin roles.\n */\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    // Check user.role first (fast path)\n    const isAdminByUserRole = user?.role === 'admin' || user?.role === 'super_admin';\n",
    "b": true,
    "l": 84
  },
  {
    "p": "base44/functions/adminSystemHealth/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {\n      return Response.json({ error: 'Admin access required' }, { status: 403 });\n    }\n\n    const body = await req.json();\n    const { action, entity, id, data, filter } = body;\n\n    const entities = {",
    "b": true,
    "l": 57
  },
  {
    "p": "base44/functions/advanceDripStep/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * ADVANCE DRIP STEP (dev/test utility)\n * Immediately makes the next pending ContactEnrollment due for a contact\n * by setting next_send_at to now — bypassing the scheduled delay so you\n * can test SMS drip sequence logic without waiting real days between steps.\n *\n * Body: { contact_id?: string, enrollment_id?: string, run_now?: boolean, dry_run?: boolean }\n *   - contact_id: advance the next active enrollment for this contact\n *   - enrollment_id: advance a specific enrollment by ID\n *   - run_now (default true): also invoke runCampaignScheduler immediately\n *   - dry_run (default false): just show what would be advanced, don't change anything\n *\n * Returns: { advanced: number, enrollments: [...], scheduler_result? }",
    "b": true,
    "l": 120
  },
  {
    "p": "base44/functions/agentExecutionTracker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nimport { Buffer } from 'node:buffer';\n\n/**\n * AGENT EXECUTION TRACKER\n *\n * Logs each agent step in a workflow.\n * Creates execution history for loop detection.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n",
    "b": true,
    "l": 94
  },
  {
    "p": "base44/functions/aiClient/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * aiClient — Pass-through wrapper that forwards all AI requests to aiGateway.\n * Exists so legacy functions that invoke('aiClient', ...) still work.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);",
    "b": true,
    "l": 26
  },
  {
    "p": "base44/functions/aiCopilot/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n\n\n    const { action, lead, campaign, message } = await req.json();\n\n    let prompt = '';",
    "b": true,
    "l": 57
  },
  {
    "p": "base44/functions/aiGateway/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n\n/**\n * CENTRALIZED AI GATEWAY\n *\n * All AI requests flow through this gateway.\n * Handles:\n * - Provider routing (Groq, OpenAI, Gemini, Anthropic)\n * - Cost tracking\n * - Request deduplication & caching\n * - Budget enforcement\n * - Retry logic\n * - Audit logging\n *",
    "b": true,
    "l": 848
  },
  {
    "p": "base44/functions/aiResponseValidator/entry.ts",
    "v": "/**\n * AI RESPONSE VALIDATOR\n * \n * Validates LLM responses against predefined schemas.\n * Prevents corrupt data from entering the database.\n */\n\n// Schema definitions for different AI operations\nconst SCHEMAS = {\n  intent_analysis: {\n    type: 'object',\n    required: ['intent_score', 'buying_stage', 'reasoning'],\n    properties: {\n      intent_score: {\n        type: 'number',",
    "b": true,
    "l": 284
  },
  {
    "p": "base44/functions/analysisWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway via invokeAI wrapper */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    // Fetch a single new DiscoveryResult, then scope to its campaign's org\n    const results = await base44.asServiceRole.entities.DiscoveryResult.filter({ status: 'new' }, '-created_at', 1);\n\n    if (!results || results.length === 0) {\n      return Response.json({ success: true, analyzed: 0 });",
    "b": true,
    "l": 70
  },
  {
    "p": "base44/functions/analyticsConsistencyChecker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * ANALYTICS CONSISTENCY CHECKER\n *\n * Daily reconciliation to detect silent data loss.\n * Compares expected vs actual analytics records.\n *\n * Example checks:\n * - count(leads where status=\"replied\") vs count(reply_events)\n * - count(outreach_sent_events) vs count(outreach_messages)\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {",
    "b": true,
    "l": 218
  },
  {
    "p": "base44/functions/analyzeContentRelevance/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n  const { content_discovery_id, campaign_id } = await req.json();\n\n  try {\n    console.log(`[RELEVANCE_ANALYSIS] Processing content ${content_discovery_id}`);\n\n    const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id);\n    if (!campaign) {",
    "b": true,
    "l": 159
  },
  {
    "p": "base44/functions/analyzeLeadIntent/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * ANALYZE LEAD INTENT\n *\n * N-01 FIX: LLM call now routes through aiGateway (kill switch + budget + cost log).\n * N-02 FIX: Budget check reads Campaign.ai_spend_usd (O(1)) not 10k CostTracker rows.\n *           FAIL-CLOSED — unreadable campaign blocks rather than allows.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n",
    "b": true,
    "l": 88
  },
  {
    "p": "base44/functions/analyzeLeadSignals/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst WORKER_NAME = 'analyzeLeadSignals';\n\nasync function writeHeartbeat(base44) {\n  try {\n    const existing = await base44.asServiceRole.entities.WorkerStatus.filter(\n      { worker_name: WORKER_NAME }, '-last_heartbeat', 1\n    );\n    const now = new Date().toISOString();\n    if (existing?.[0]) {\n      await base44.asServiceRole.entities.WorkerStatus.update(existing[0].id, {\n        status: 'running', last_heartbeat: now,\n      });\n    } else {",
    "b": true,
    "l": 218
  },
  {
    "p": "base44/functions/apiCommentsAnalyze/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n// ── Inline invokeAI (relative imports not supported in Base44 Deno) ──────────\nasync function invokeAI(opts: {\n  base44: unknown; organization_id: string; task: string;\n  prompt: string; worker_name: string; campaign_id?: string;\n  lead_id?: string; system_message?: string;\n}): Promise<unknown> {\n  const { base44, organization_id, task, prompt, worker_name,\n          campaign_id, lead_id, system_message } = opts;\n  const b44 = base44 as { asServiceRole: { functions: { invoke: (n: string, p: unknown) => Promise<Record<string, unknown>> } } };\n  const res = await b44.asServiceRole.functions.invoke('aiGateway', {\n    organization_id, campaign_id, lead_id, task, prompt, worker_name, system_message,\n  });\n  if (!res?.success) {\n    const reason = (res?.reason ?? res?.error ?? 'aiGateway rejected') as string;",
    "b": true,
    "l": 66
  },
  {
    "p": "base44/functions/apiCommentsIngest/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const body = await req.json();\n\n    // Validate payload\n    const { author, commentText, videoUrl, channelUrl, platform } = body;\n    const errors = [];",
    "b": true,
    "l": 61
  },
  {
    "p": "base44/functions/apifyDataSourceIntegration/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * DEPRECATED — apifyDataSourceIntegration.ts\n *\n * Issue 6 fix: This file duplicated Apify actor execution with two problems:\n *   1. Fire-and-forget: it called actor.run() without polling for completion,\n *      so results were never retrieved and leads were never created.\n *   2. Conflicting actor registry: it maintained its own ACTOR_REGISTRY that\n *      differed from discoveryWorker.ts and apifyClient.ts (3 registries total).\n *\n * ALL discovery execution now routes through:\n *   discoveryWorker.ts  ← uses actorRegistry.ts (single source of truth)\n *                       ← uses apifyClient.ts   (correct polling implementation)\n *",
    "b": true,
    "l": 66
  },
  {
    "p": "base44/functions/apifyDatasetWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * APIFY DATASET INGESTION WORKER\n * \n * Fetches items from Apify dataset and queues them for downstream processing.\n * This is the critical layer between actor execution and content workers.\n * \n * Input:\n * - dataset_id: Apify dataset ID\n * - campaign_id: Campaign ID\n * - source_platform: youtube, linkedin, reddit, twitter, facebook\n * - next_queue: Which queue to push items to\n * - next_worker: Which worker processes each item\n */",
    "b": true,
    "l": 186
  },
  {
    "p": "base44/functions/apifyRetryService/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst RETRY_CONFIG = {\n  maxAttempts: 3,\n  backoffMs: [2000, 5000, 10000]\n};\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\n\nasync function sleep(ms) {\n  return new Promise(resolve => setTimeout(resolve, ms));\n}\n\nasync function runWithRetry(fn, opName) {\n  let lastError;",
    "b": true,
    "l": 127
  },
  {
    "p": "base44/functions/apifyService/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\n\nconst ACTOR_REGISTRY = {\n  discovery: {\n    youtube:  'apify/youtube-scraper',\n    reddit:   'trudax/reddit-scraper',\n    twitter:  'apidojo/tweet-scraper',\n    linkedin: 'curious_coder/linkedin-post-search-scraper',\n    facebook: 'apify/facebook-posts-scraper',\n    facebook_groups_finder: 'easyapi/facebook-groups-search-scraper',\n  },\n  comments: {\n    youtube:  'apify/youtube-comment-scraper',",
    "b": true,
    "l": 91
  },
  {
    "p": "base44/functions/apifyWebhookHandler/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * APIFY WEBHOOK HANDLER\n * C-1 FIX: Added timing-safe HMAC secret validation.\n * Set APIFY_WEBHOOK_SECRET in Deno env to match the secret configured in Apify.\n * Uses crypto.subtle.timingSafeEqual() to prevent timing-based secret enumeration.\n */\n\nasync function validateApifySecret(provided: string, expected: string): Promise<boolean> {\n  const enc = new TextEncoder();\n  const a = enc.encode(provided);\n  const b = enc.encode(expected);\n  if (a.byteLength !== b.byteLength) return false;\n  return await crypto.subtle.timingSafeEqual(a, b);",
    "b": true,
    "l": 97
  },
  {
    "p": "base44/functions/approvalWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Approval Worker\n * Handles auto-approval or manual approval routing\n */\n\nasync function procesApproval(base44, campaignLead, campaign) {\n  const settings = campaign.campaign_config;\n  const requireManualApproval = settings.require_manual_approval !== false;\n\n  if (!requireManualApproval) {\n    // Auto-approve qualified leads\n    await base44.asServiceRole.entities.CampaignLead.update(campaignLead.id, {\n      organization_id: campaignLead.organization_id,",
    "b": true,
    "l": 95
  },
  {
    "p": "base44/functions/approveLead/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * APPROVE LEAD\n *\n * Approves a lead and pushes it to the OutreachQueue.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n",
    "b": true,
    "l": 121
  },
  {
    "p": "base44/functions/assignDefaultPlan/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const body = await req.json().catch(() => ({}));\n  const orgId  = body.organization_id || user.organization_id;\n  const planId = body.plan_id || 'starter';\n\n  if (!orgId) return Response.json({ error: 'organization_id required' }, { status: 400 });\n\n  // Look up the plan — always needed for a full snapshot\n  const plans = await base44.asServiceRole.entities.Plan",
    "b": true,
    "l": 119
  },
  {
    "p": "base44/functions/auditComplete/entry.ts",
    "v": "/**\n * PRODUCTION READINESS AUDIT — COMPLETE\n * \n * Timestamp: 2026-03-09\n * Status: ✅ PRODUCTION READY\n */\n\nDeno.serve(async (req) => {\n  return Response.json({\n    status: 'PRODUCTION_READY',\n    audit_date: '2026-03-09',\n    summary: {\n      entities_verified: '14 core entities exist, properly referenced',\n      critical_path: '✅ Campaign → Leads → Enrichment → Outreach intact',\n      budget_controls: '✅ Hardened with fail-closed enforcement',",
    "b": true,
    "l": 56
  },
  {
    "p": "base44/functions/auditReport/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * AUDIT REPORT\n *\n * Platform-level configuration audit. Checks everything needed\n * for the platform to actually work — not just \"is the DB up\"\n * but \"is Twilio configured?\", \"are permits being enriched?\",\n * \"do visibility rules exist?\", \"is the scheduler wired?\", etc.\n *\n * Returns a structured report with sections, each containing\n * check items with status: pass | warn | fail | info\n *\n * POST {} → full report\n * POST { section: 'twilio' } → single section only",
    "b": true,
    "l": 484
  },
  {
    "p": "base44/functions/backfillSMSLogOrgId/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  try {\n    // Get all inbound SMSLog records missing organization_id\n    const logs = await base44.asServiceRole.entities.SMSLog\n      .filter({ direction: 'inbound' }, '-sent_at', 1000)\n      .catch(() => []);\n\n    const missing = (logs || []).filter(l => !l.organization_id && l.contact_id);\n    ",
    "b": true,
    "l": 37
  },
  {
    "p": "base44/functions/batchEnrichSolarPermits/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * BATCH ENRICH SOLAR PERMITS via Tracerfy\n *\n * Sends all permits that are missing at least one contact field (phone or email)\n * to Tracerfy's normal bulk skip trace API.\n *\n * Enrichment tiers:\n *   scraped            — address only → send address cols only, Tracerfy finds owner\n *   pending_enrichment — has name + address but missing phone/email → send name + address\n *   lead               — has all 4 fields → SKIP (already complete)\n *\n * API: POST https://tracerfy.com/v1/api/trace/  (multipart/form-data)\n * Webhook: fires to Account.webhook_url in Tracerfy dashboard → our tracerfyWebhook function",
    "b": true,
    "l": 187
  },
  {
    "p": "base44/functions/bulkEnrollContacts/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * BULK ENROLL CONTACTS\n * Enrolls multiple contacts into a campaign with concurrent processing\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });\n\n  const base44 = createClientFromRequest(req);\n  \n  try {\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });",
    "b": true,
    "l": 88
  },
  {
    "p": "base44/functions/callEventWebhook/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Validate Twilio X-Twilio-Signature header using HMAC-SHA1.\n * https://www.twilio.com/docs/usage/webhooks/webhooks-security\n */\nasync function validateTwilioSignature(\n  req: Request,\n  formData: URLSearchParams,\n  authToken: string,\n): Promise<boolean> {\n  const signature = req.headers.get('x-twilio-signature');\n  if (!signature) return false;\n\n  const url = req.url;",
    "b": true,
    "l": 182
  },
  {
    "p": "base44/functions/campaignConfigDefaults/entry.ts",
    "v": "/**\n * Default campaign configuration template\n */\nexport const CAMPAIGN_CONFIG_DEFAULTS = {\n  discovery_sources: [],\n  scrapers: [],\n  ai_analysis: {\n    intent_detection: true,\n    pain_point_detection: true,\n    persona_detection: true,\n    lead_intelligence: true,\n  },\n  llm_settings: {\n    provider: 'groq',\n    model: 'llama3-8b-8192',",
    "b": true,
    "l": 68
  },
  {
    "p": "base44/functions/campaignExecutionEngine/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Campaign Execution Engine\n * Dynamically executes automation pipelines based on campaign_config\n * Each stage enqueues workers rather than executing inline\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { campaign_id, organization_id } = await req.json();\n\n    if (!campaign_id || !organization_id) {\n      return Response.json(",
    "b": true,
    "l": 257
  },
  {
    "p": "base44/functions/campaignOrchestrator/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CAMPAIGN ORCHESTRATOR\n * \n * Controls the entire campaign lifecycle:\n * - Start/pause/resume/stop campaigns\n * - Spawn workers based on campaign config\n * - Schedule jobs in queues\n * - Monitor budget and worker health\n * - Retry failed jobs\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {",
    "b": true,
    "l": 328
  },
  {
    "p": "base44/functions/campaignPipelineAudit/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    if (req.method !== 'POST') {\n      return Response.json({ error: 'POST only' }, { status: 405 });\n    }\n\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n    // N-08 FIX: was !user?.role (always true) — fix the condition\n    if (!user || user.role !== 'admin') {\n      return Response.json({ error: 'Admin required' }, { status: 403 });\n    }\n",
    "b": true,
    "l": 282
  },
  {
    "p": "base44/functions/campaignScalingProtection/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CAMPAIGN SCALING PROTECTION\n *\n * Enforces limits to prevent queue explosion.\n * Blocks new campaigns/discovery jobs when limits reached.\n *\n * Lead-driven architecture: workers pull by status, not campaign_id\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }",
    "b": true,
    "l": 142
  },
  {
    "p": "base44/functions/checkCallAllowed/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const { organization_id, direction } = await req.json();\n\n  if (!organization_id) {\n    return Response.json({ allowed: false, reason: 'No org' });\n  }\n\n  // Check credit deduction flag — if disabled, skip credit checks\n  const creditDeductFlag = await base44.asServiceRole.entities.FeatureFlag\n    .filter({ flag_name: 'enable_credit_deduction' }, 'flag_name', 1)\n    .catch(() => []);\n  const creditDeductEnabled = creditDeductFlag?.length ? creditDeductFlag[0].enabled !== false : true;",
    "b": true,
    "l": 120
  },
  {
    "p": "base44/functions/checkCredentialHealth/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const orgId = user.organization_id;\n\n  const CREDENTIAL_MAP = [\n    { key: 'twilio_account_sid',      env: 'TWILIO_ACCOUNT_SID' },\n    { key: 'twilio_auth_token',       env: 'TWILIO_AUTH_TOKEN' },\n    { key: 'twilio_phone_number',     env: 'TWILIO_PHONE_NUMBER' },\n    { key: 'twilio_api_key_sid',      env: 'TWILIO_API_KEY_SID' },\n    { key: 'twilio_api_key_secret',   env: 'TWILIO_API_KEY_SECRET' },",
    "b": true,
    "l": 68
  },
  {
    "p": "base44/functions/checkCredits/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { organization_id, amount_needed } = await req.json().catch(() => ({}));\n\n    if (!organization_id) {\n      return Response.json({ has_credits: false, balance: 0 });\n    }\n\n    const credits = await base44.asServiceRole.entities.OrgCredits\n      .filter({ organization_id }, '-last_updated', 1)\n      .catch(() => []);\n",
    "b": true,
    "l": 53
  },
  {
    "p": "base44/functions/checkTwilioWebhookLogs/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  try {\n    const logs = await base44.asServiceRole.entities.FunctionLog\n      .filter(\n        { function_name: 'twilioResponseWebhook' },\n        '-created_date',\n        10\n      )\n      .catch(() => []);",
    "b": true,
    "l": 33
  },
  {
    "p": "base44/functions/classifyLeadTemperature/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst WORKER_NAME = 'classifyLeadTemperature';\n\nasync function writeHeartbeat(base44) {\n  try {\n    const existing = await base44.asServiceRole.entities.WorkerStatus.filter(\n      { worker_name: WORKER_NAME }, '-last_heartbeat', 1\n    );\n    const now = new Date().toISOString();\n    if (existing?.[0]) {\n      await base44.asServiceRole.entities.WorkerStatus.update(existing[0].id, {\n        status: 'running', last_heartbeat: now,\n      });\n    } else {",
    "b": true,
    "l": 129
  },
  {
    "p": "base44/functions/commentsAnalyze/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n// ── Inline invokeAI (relative imports not supported in Base44 Deno) ──────────\nasync function invokeAI(opts: {\n  base44: unknown; organization_id: string; task: string;\n  prompt: string; worker_name: string; campaign_id?: string;\n  lead_id?: string; system_message?: string;\n}): Promise<unknown> {\n  const { base44, organization_id, task, prompt, worker_name,\n          campaign_id, lead_id, system_message } = opts;\n  const b44 = base44 as { asServiceRole: { functions: { invoke: (n: string, p: unknown) => Promise<Record<string, unknown>> } } };\n  const res = await b44.asServiceRole.functions.invoke('aiGateway', {\n    organization_id, campaign_id, lead_id, task, prompt, worker_name, system_message,\n  });\n  if (!res?.success) {\n    const reason = (res?.reason ?? res?.error ?? 'aiGateway rejected') as string;",
    "b": true,
    "l": 96
  },
  {
    "p": "base44/functions/commentsIngest/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const startTime = Date.now();\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const body = await req.json();\n    const { comments } = body;\n\n    if (!comments || !Array.isArray(comments) || comments.length === 0) {\n      return Response.json({ error: 'Missing or empty \"comments\" array in payload' }, { status: 400 });\n    }\n\n    console.log(`[INGEST] Received ${comments.length} comments for ingestion`);",
    "b": true,
    "l": 56
  },
  {
    "p": "base44/functions/connectOwnTwilio/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const body = await req.json().catch(() => ({}));\n  // Accept either single selected_number (legacy) or selected_numbers array (new)\n  const account_sid = body.account_sid;\n  const auth_token  = body.auth_token;\n  const selected_numbers: any[] = body.selected_numbers || \n    (body.selected_number ? [body.selected_number] : []);\n\n  if (!account_sid || !auth_token) {",
    "b": true,
    "l": 245
  },
  {
    "p": "base44/functions/connectSMSTwilio/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const body = await req.json().catch(() => ({}));\n  // Accept either single selected_number (legacy) or selected_numbers array (new)\n  const account_sid = body.account_sid;\n  const auth_token  = body.auth_token;\n  const selected_numbers: any[] = body.selected_numbers || \n    (body.selected_number ? [body.selected_number] : []);\n\n  if (!account_sid || !auth_token) {",
    "b": true,
    "l": 243
  },
  {
    "p": "base44/functions/contextSafetyLayer/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CONTEXT INJECTION Class B UnitsTY LAYER\n *\n * Orchestrates the full context filtering pipeline:\n *\n * Raw Context\n *   ↓\n * Injection Guard (detect malicious patterns)\n *   ↓\n * Context Selector (choose what's relevant)\n *   ↓\n * Deduplication Agent (remove duplicates)\n *   ↓",
    "b": true,
    "l": 554
  },
  {
    "p": "base44/functions/costEstimator/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * COST ESTIMATOR\n *\n * Calculates estimated cost of an AI request before execution.\n */\n\nDeno.serve(async (req) => {\n\n  // B-12 FIX: Internal function guard — only callable via functions.invoke() from other functions\n  // Rejects direct HTTP calls that don't carry the internal shared secret\n  const internalSecret = Deno.env.get('INTERNAL_SECRET');\n  if (internalSecret) {\n    const callerSecret = req.headers.get('x-internal-secret');",
    "b": true,
    "l": 86
  },
  {
    "p": "base44/functions/costPolicyEngine/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * COST POLICY ENGINE\n *\n * Enforces cost policies and decides if an AI request should be allowed.\n * Checks limits at: per-request, per-user per day, per-campaign per day, global per day.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);",
    "b": true,
    "l": 201
  },
  {
    "p": "base44/functions/createCampaignSequence/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CREATE CAMPAIGN SEQUENCE\n *\n * Creates a CampaignSequence with OutreachTemplate and OutreachVariant steps.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n",
    "b": true,
    "l": 94
  },
  {
    "p": "base44/functions/createCampaignV2/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CREATE CAMPAIGN V2\n *\n * Creates a campaign with structured campaign_config JSON.\n *\n * Fixes applied:\n *   C-01 — organization_id no longer derived from email domain.\n *   C-02 — Accepts pre-wrapped or flat builder payload.\n *   L-05 — Campaign created with status = 'active'.\n *   C-03 — Fixed: save field is 'campaign_config' not 'config'.\n *   C-04 — Orchestrator + scheduler are fire-and-forget (no await) to prevent 502.\n */\n",
    "b": true,
    "l": 128
  },
  {
    "p": "base44/functions/createPersonFromDiscovery/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Create Person from Discovery\n * Converts discovered comment/post author into Person + CampaignLead\n * Deduplicates on email or linkedin_url\n */\n\nfunction generateFingerprint(data) {\n  const str = JSON.stringify({\n    email: data.email?.toLowerCase(),\n    linkedin_url: data.linkedin_url,\n    full_name: data.full_name?.toLowerCase(),\n  });\n  ",
    "b": true,
    "l": 171
  },
  {
    "p": "base44/functions/createScrapeJob/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CREATE SCRAPE JOB\n * \n * HTTP POST /api/scrape\n * Creates a new scraping job in queued status\n * \n * Request body:\n * {\n *   platform: \"youtube|linkedin|reddit|twitter|facebook\",\n *   keyword: \"search term\",\n *   max_results: 100,\n *   campaign_id: \"optional\"\n * }",
    "b": true,
    "l": 85
  },
  {
    "p": "base44/functions/datasetIngestionWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * DATASET INGESTION WORKER\n *\n * Fetches an Apify dataset and creates Lead + CampaignLead records.\n *\n * Reliability fixes:\n *   Pagination    — Fetches in pages of PAGE_SIZE instead of a single 50k request.\n *                   A 500k-item dataset no longer OOMs or times out the function.\n *   Progress      — ScrapeJob.items_processed updated after each page so crashes\n *                   are recoverable (resume from last offset).\n *   Batch insert  — Lead + CampaignLead created in parallel batches (BATCH_SIZE)\n *                   instead of serial for-loop. 50k records: ~500 seconds → ~10 seconds.\n *   Idempotency   — Before creating a Lead, check for existing (org, source_url).",
    "b": true,
    "l": 274
  },
  {
    "p": "base44/functions/deductCredits/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const {\n      organization_id, amount, rate_key,\n      quantity, type, description,\n      reference_id, reference_type, created_by, metadata, called_by_system,\n    } = await req.json();\n\n    // Guard: only admins can manually deduct (system calls bypass)\n    if (!called_by_system) {\n      const user = await base44.auth.me().catch(() => null);\n      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });",
    "b": true,
    "l": 186
  },
  {
    "p": "base44/functions/deduplicateFeatureFlags/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me();\n  if (user?.role !== 'admin') {\n    return Response.json({ error: 'Admin only' }, { status: 403 });\n  }\n\n  // Fetch all flags in batches\n  let allFlags = [];\n  let skip = 0;\n  const batchSize = 200;\n  while (true) {\n    const batch = await base44.asServiceRole.entities.FeatureFlag.filter({}, '-created_date', batchSize, skip);",
    "b": true,
    "l": 75
  },
  {
    "p": "base44/functions/deduplicateLead/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nasync function sha256(text) {\n  const encoder = new TextEncoder();\n  const data = encoder.encode(text || '');\n  const hashBuffer = await crypto.subtle.digest('SHA-256', data);\n  const hashArray = Array.from(new Uint8Array(hashBuffer));\n  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');\n}\n\nconst WORKER_NAME = 'deduplicateLead';\n\nasync function writeHeartbeat(base44) {\n  try {\n    const existing = await base44.asServiceRole.entities.WorkerStatus.filter(",
    "b": true,
    "l": 210
  },
  {
    "p": "base44/functions/deduplicateLeads/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;\n      return true;\n    } catch { return true; }",
    "b": true,
    "l": 213
  },
  {
    "p": "base44/functions/deduplicateSystemSettings/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me();\n  if (user?.role !== 'admin') {\n    return Response.json({ error: 'Forbidden' }, { status: 403 });\n  }\n\n  // Fetch all SystemSettings (up to 2000)\n  const all = await base44.asServiceRole.entities.SystemSettings.list('-updated_date', 2000);\n\n  // Group by org_id + setting_key, keep the first (most recent)\n  const seen = new Set();\n  const toDelete = [];",
    "b": true,
    "l": 38
  },
  {
    "p": "base44/functions/deletePermitCampaign/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst SUPER_ADMIN_EMAIL = 'chainwavestudios@gmail.com';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n    const body = await req.json().catch(() => ({}));\n    const permit_campaign_id = body.permit_campaign_id || body.id;\n    if (!permit_campaign_id) {\n      return Response.json({ error: 'permit_campaign_id required' }, { status: 400 });\n    }",
    "b": true,
    "l": 44
  },
  {
    "p": "base44/functions/deletePersona/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    if (req.method !== 'DELETE') {",
    "b": true,
    "l": 28
  },
  {
    "p": "base44/functions/deleteVariant/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    if (req.method !== 'DELETE') {\n      return Response.json({ error: 'Method not allowed' }, { status: 405 });",
    "b": true,
    "l": 34
  },
  {
    "p": "base44/functions/detectPainPoints/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst WORKER_NAME = 'detectPainPoints';\n\nasync function writeHeartbeat(base44) {\n  try {\n    const existing = await base44.asServiceRole.entities.WorkerStatus.filter(\n      { worker_name: WORKER_NAME }, '-last_heartbeat', 1\n    );\n    const now = new Date().toISOString();\n    if (existing?.[0]) {\n      await base44.asServiceRole.entities.WorkerStatus.update(existing[0].id, {\n        status: 'running', last_heartbeat: now,\n      });\n    } else {",
    "b": true,
    "l": 151
  },
  {
    "p": "base44/functions/detectPersona/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;\n      return true;\n    } catch { return true; }",
    "b": true,
    "l": 210
  },
  {
    "p": "base44/functions/dialerCallback/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nasync function validateTwilioSignature(\n  req: Request,\n  formData: URLSearchParams,\n  authToken: string,\n): Promise<boolean> {\n  const signature = req.headers.get('x-twilio-signature');\n  if (!signature) return false;\n\n  const url = req.url;\n  const sortedKeys = [...formData.keys()].sort();\n  const paramStr = sortedKeys.map(k => k + (formData.get(k) ?? '')).join('');\n  const toSign = url + paramStr;\n",
    "b": true,
    "l": 120
  },
  {
    "p": "base44/functions/dialerVoiceHandler/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const rawBody = await req.text();\n  const params = Object.fromEntries(new URLSearchParams(rawBody));\n\n  const to         = params.To || params.to || '';\n  const from       = params.From || params.from || '';\n  const callSid    = params.CallSid || '';\n  const contactId  = params.contactId || params.contact_id || '';\n  const baseUrl = (() => {\n    return Deno.env.get('BASE44_FUNCTION_BASE_URL') || '';\n  })();\n",
    "b": true,
    "l": 124
  },
  {
    "p": "base44/functions/discoverContentFromProviders/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    console.log('[DISCOVERY] Starting content discovery from providers');\n\n    const startTime = Date.now();\n\n    // Fetch all active campaigns",
    "b": true,
    "l": 212
  },
  {
    "p": "base44/functions/discoveryWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n\n// ── Inline: ACTOR_REGISTRY ─────────────────────────────────────────────────\ninterface ActorConfig {\n  actor_id: string;\n  name: string;\n  cost_per_run_usd: number;\n  timeout_minutes: number;\n  rate_limit_per_hour: number;\n}\nconst ACTOR_REGISTRY: Record<string, ActorConfig> = {\n  youtube: { actor_id: 'apify/youtube-scraper', name: 'YouTube Search', cost_per_run_usd: 0.20, timeout_minutes: 20, rate_limit_per_hour: 100 },\n  youtube_search: { actor_id: 'apify/youtube-scraper', name: 'YouTube Search', cost_per_run_usd: 0.20, timeout_minutes: 20, rate_limit_per_hour: 100 },\n  youtube_comments: { actor_id: 'apify/youtube-comment-scraper', name: 'YouTube Comments', cost_per_run_usd: 0.10, timeout_minutes: 30, rate_limit_per_hour: 200 },",
    "b": true,
    "l": 296
  },
  {
    "p": "base44/functions/emitPipelineEvent/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n// Central pipeline event emitter\n// Called by pipeline functions to fire webhooks for registered endpoints\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n  const { eventType, data } = await req.json();\n\n  if (!eventType || !data) {\n    return Response.json({ error: 'Missing eventType or data' }, { status: 400 });",
    "b": true,
    "l": 105
  },
  {
    "p": "base44/functions/enableAllFeatureFlags/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * ENABLE ALL FEATURE FLAGS\n * Bulk enables feature flags by subsystem or all at once.\n * Admin-only function.\n */\n\nDeno.serve(async (req) => {\n  if (req.method === 'OPTIONS') {\n    return new Response(null, { status: 204 });\n  }\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }",
    "b": true,
    "l": 75
  },
  {
    "p": "base44/functions/enqueueJob/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const { campaign_id, job_type, payload, priority = 1 } = await req.json();\n\n    if (!campaign_id || !job_type) {\n      return Response.json({ error: 'Missing campaign_id or job_type' }, { status: 400 });\n    }",
    "b": true,
    "l": 42
  },
  {
    "p": "base44/functions/enrichLead/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * ENRICH LEAD\n * Single-contact enrichment triggered by workflow nodes.\n * Delegates to enrichmentWorker for the actual enrichment logic.\n * \n * Called by: executeWorkflowTrigger (enrich_lead workflow node)\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });",
    "b": true,
    "l": 64
  },
  {
    "p": "base44/functions/enrichmentMemoryCheck/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Enrichment Memory Check\n * Checks if person has been enriched before\n * Returns stored enrichment data to avoid re-enrichment\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { person_id, organization_id, provider } = await req.json();\n\n    if (!person_id || !organization_id) {\n      return Response.json(",
    "b": true,
    "l": 73
  },
  {
    "p": "base44/functions/enrichmentWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n\n// ── Inline: rateLimiter ────────────────────────────────────────────────────\ninterface Window { count: number; windowStart: number; }\nconst windows = new Map<string, Window>();\nfunction checkRateLimit(orgId: string, endpoint: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetMs: number } {\n  const key = `${orgId}:${endpoint}`;\n  const now = Date.now();\n  const win = windows.get(key);\n  if (!win || now - win.windowStart > windowMs) {\n    windows.set(key, { count: 1, windowStart: now });\n    return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };\n  }\n  if (win.count >= maxRequests) {",
    "b": true,
    "l": 359
  },
  {
    "p": "base44/functions/enrollContact/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * ENROLL CONTACT IN CAMPAIGN\n * Creates a ContactEnrollment and kicks off the drip sequence\n */\n\nDeno.serve(async (req: Request) => {\n  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });\n\n  const base44 = createClientFromRequest(req);\n  try {\n    const body = await req.json();\n    const { contact_id, campaign_id, enrolled_by } = body;\n",
    "b": true,
    "l": 152
  },
  {
    "p": "base44/functions/eventProcessor/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * EVENT PROCESSOR\n *\n * Processes durable events from SystemEvent queue.\n * GUARANTEES: at-least-once delivery\n *\n * Flow:\n * SystemEvent (queued) → process → AnalyticsRecord\n *                      → fail → retry (max 5)\n *                      → exhausted → DLQ\n */\n\nDeno.serve(async (req) => {",
    "b": true,
    "l": 189
  },
  {
    "p": "base44/functions/executeCampaignEntry/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Campaign Execution Entry Point\n * Validates campaign and initiates all pipeline stages\n */\n\nexport async function executeCampaign(base44, campaign_id, organization_id) {\n  const campaign = await base44.asServiceRole.entities.Campaign.filter(\n    { id: campaign_id, organization_id },\n    null,\n    1\n  ).then(r => r[0]);\n\n  if (!campaign) {",
    "b": true,
    "l": 79
  },
  {
    "p": "base44/functions/executeWorkflowTrigger/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { trigger_type, contact_id, metadata = {} } = await req.json();\n\n    // Resume a paused workflow from a wait node\n    if (trigger_type === '_resume_workflow' && metadata._resume_node_id) {\n      try {\n        const nodes = JSON.parse(metadata._nodes || '[]');\n        const edges = JSON.parse(metadata._edges || '[]');\n        const resumeNode = nodes.find((n) => n.id === metadata._resume_node_id);\n        if (!resumeNode) return Response.json({ success: false, error: 'Resume node not found' });\n        const outgoingEdges = edges.filter((e) => e.from === resumeNode.id);",
    "b": true,
    "l": 626
  },
  {
    "p": "base44/functions/exportAppSchema/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n    // Fetch all data in parallel\n    const [plans, creditRates, creditConfig, orgCredits, seats, orgPackages] = await Promise.all([\n      base44.asServiceRole.entities.Plan.list('-created_date', 500).catch(() => []),\n      base44.asServiceRole.entities.CreditRate.list('-created_date', 500).catch(() => []),\n      base44.asServiceRole.entities.CreditConfig.list('-created_date', 100).catch(() => []),\n      base44.asServiceRole.entities.OrgCredits.list('-created_date', 500).catch(() => []),\n      base44.asServiceRole.entities.OrgSeat.list('-created_date', 500).catch(() => []),",
    "b": true,
    "l": 61
  },
  {
    "p": "base44/functions/exportLeads/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * EXPORT LEADS\n *\n * Exports leads in CSV, JSON, or webhook formats.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n",
    "b": true,
    "l": 131
  },
  {
    "p": "base44/functions/extractLeadsFromScrapedContent/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const payload = await req.json();\n    const { campaign_id, scraped_comment_ids } = payload;\n\n    if (!campaign_id) {\n      return Response.json({ error: 'Missing campaign_id' }, { status: 400 });",
    "b": true,
    "l": 102
  },
  {
    "p": "base44/functions/facebookCommentWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * FACEBOOK COMMENT WORKER - STAGE 2\n * Scrapes comments from Facebook posts\n * Actor: apify/facebook-comments-scraper\n */\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\nconst FACEBOOK_COMMENT_ACTOR = 'apify/facebook-comments-scraper';\n\nasync function runApifyActor(actorId, input, APIFY_TOKEN) {\n  console.log(`[Apify] Starting ${actorId}`);\n  \n  let runId, datasetId;",
    "b": true,
    "l": 162
  },
  {
    "p": "base44/functions/facebookDoubleActorWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * FACEBOOK DOUBLE-ACTOR WORKER\n *\n * Mirrors the YouTube double-actor pipeline for Facebook groups:\n *\n * Phase A: Keyword → easyapi/facebook-groups-search-scraper → group URLs\n * Phase B: Group URLs → apify/facebook-groups-scraper → posts\n * Phase C: Posts → datasetIngestionWorker → Lead records → intent analysis\n *\n * Requires facebook_cookies stored in org SystemSettings.\n * Export cookies from Chrome using Cookie-Editor extension while logged into Facebook.\n */\n",
    "b": true,
    "l": 236
  },
  {
    "p": "base44/functions/facebookPostWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * FACEBOOK POST WORKER - STAGE 1\n * Scrapes posts from Facebook groups\n * Actor: apify/facebook-posts-scraper\n */\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\nconst FACEBOOK_POST_ACTOR = 'apify/facebook-posts-scraper';\n\nasync function runApifyActor(actorId, input, APIFY_TOKEN) {\n  console.log(`[Apify] Starting ${actorId}`);\n  \n  let runId, datasetId;",
    "b": true,
    "l": 185
  },
  {
    "p": "base44/functions/fetchDoc/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst DOC_URL =\n  \"https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69ac768167fa5ab007eb6ae7/2864254b9_rosieai-guide-v4.html\";\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me();",
    "b": true,
    "l": 16
  },
  {
    "p": "base44/functions/followupWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst BATCH_SIZE = 10;\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;",
    "b": true,
    "l": 135
  },
  {
    "p": "base44/functions/generateDiscoveryQueries/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  const base44 = createClientFromRequest(req);\n  const { campaign_id } = await req.json();\n\n  if (!campaign_id) return Response.json({ error: 'Missing campaign_id' }, { status: 400 });\n\n  try {\n    const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id);\n    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });\n",
    "b": true,
    "l": 52
  },
  {
    "p": "base44/functions/generatePersonalization/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n\n    const {\n      contact_name,\n      company_name,\n      source_text,\n      platform,\n      pain_points,\n      intent_score,\n      campaign_context,\n    } = await req.json();",
    "b": true,
    "l": 79
  },
  {
    "p": "base44/functions/generateTwilioToken/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  // Check browser dialer flag\n  const dialerFlag = await base44.asServiceRole.entities.FeatureFlag\n    .filter({ flag_name: 'enable_browser_dialer' }, 'flag_name', 1)\n    .catch(() => []);\n  if (dialerFlag?.length && dialerFlag[0].enabled === false) {\n    return Response.json({ error: 'Browser dialer is not enabled' }, { status: 403 });\n  }\n",
    "b": true,
    "l": 77
  },
  {
    "p": "base44/functions/getConfigValue/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Dynamic configuration getter for backend workers.\n * Workers call this instead of using hardcoded constants.\n * \n * Returns: setting_value, or default if not found\n */\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { setting_key, default_value } = await req.json();\n\n    // Try to fetch from SystemSettings\n    const results = await base44.asServiceRole.entities.SystemSettings.filter(",
    "b": true,
    "l": 50
  },
  {
    "p": "base44/functions/getCreditRates/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { rate_key, action } = await req.json().catch(() => ({}));\n\n    // Guard: only super_admin can update rates (read allowed for all)\n    if (action === 'update') {\n      const user = await base44.auth.me().catch(() => null);\n      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n      const SUPER_ADMIN_EMAIL = 'chainwavestudios@gmail.com';\n      const isOwnerEmail = user?.email === SUPER_ADMIN_EMAIL;\n      const isAdminRole  = user?.role === 'super_admin' || user?.role === 'admin';",
    "b": true,
    "l": 54
  },
  {
    "p": "base44/functions/getDataSourceDetails/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Get Data Source Details\n * Returns full schema and configuration for a specific data source\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { source_id } = await req.json();\n\n    if (!source_id) {\n      return Response.json(\n        { error: 'Missing source_id' },",
    "b": true,
    "l": 56
  },
  {
    "p": "base44/functions/getDataSources/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Get Data Sources\n * Returns all enabled data sources for the campaign builder\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n\n    // Get all enabled sources, grouped by category\n    const sources = await base44.asServiceRole.entities.DataSource.filter(\n      { enabled: true },\n      'category,name',",
    "b": true,
    "l": 49
  },
  {
    "p": "base44/functions/getEntities/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * GET ENTITIES — Unified read API for frontend entity aliases\n *\n * Issue 7 fix: Frontend was calling base44.entities.Persona, PipelineEvent,\n * FeatureFlags, GlobalSettings — names that don't match backend entity names.\n * Rather than maintain magic string aliases only in the frontend, we expose\n * server-side endpoints that map the frontend intent to the correct entity.\n *\n * Endpoints (all GET or POST with action):\n *   POST { action: \"personas\",        ... }  → LeadPersona\n *   POST { action: \"feature_flags\",   ... }  → FeatureFlag (singular)\n *   POST { action: \"pipeline_events\", ... }  → PipelineLog\n *   POST { action: \"settings\",        ... }  → SystemSettings",
    "b": true,
    "l": 98
  },
  {
    "p": "base44/functions/getFeatureFlag/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * GET FEATURE FLAG\n * Supports org-specific overrides: org-level flag takes precedence over global.\n * Called via base44.functions.invoke('getFeatureFlag', { flag_name: '...' })\n */\n\nlet cachedFlags = [];\nlet cacheTs = 0;\nconst TTL = 30_000;\n\nasync function getAllFlags(base44) {\n  const now = Date.now();\n  if (now - cacheTs < TTL && cachedFlags.length) return cachedFlags;",
    "b": true,
    "l": 84
  },
  {
    "p": "base44/functions/getOrCreateCompany/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Get Or Create Company\n * Finds or creates company by domain (dedup key)\n */\n\nfunction extractDomain(urlOrDomain) {\n  if (!urlOrDomain) return null;\n\n  // If already looks like a domain, return it\n  if (!urlOrDomain.includes('/')) {\n    return urlOrDomain.toLowerCase();\n  }\n",
    "b": true,
    "l": 95
  },
  {
    "p": "base44/functions/getOrgSetting/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * getOrgSetting — reads a single setting for an org.\n *\n * Priority:\n *   1. SystemSettings (canonical — written by upsertSetting / setup flows)\n *   2. GlobalSettings (legacy fallback)\n *   3. Env var — ONLY for non-sensitive, non-credential keys\n *\n * Twilio credentials (account_sid, auth_token, etc.) NEVER fall back to env vars.\n * If not configured for the org, returns empty and lets the caller fail loudly.\n *\n * POST { org_id, key, env_fallback? }\n */",
    "b": true,
    "l": 72
  },
  {
    "p": "base44/functions/getScrappyCities/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nfunction dedupeCities(\n  cities: { key?: string; id?: string; label?: string; name?: string }[],\n): { key: string; label: string }[] {\n  const seen = new Map<string, { key: string; label: string }>();\n  for (const c of cities) {\n    const raw = c.key ?? c.id;\n    if (raw == null || String(raw).trim() === '') continue;\n    const key = String(raw).trim();\n    const norm = key.toLowerCase();\n    if (seen.has(norm)) continue;\n    const label = String(c.label ?? c.name ?? key).trim() || key;\n    seen.set(norm, { key, label });\n  }",
    "b": true,
    "l": 79
  },
  {
    "p": "base44/functions/getVisibilityRules/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nlet cache = [];\nlet cacheTs = 0;\nconst TTL = 60_000;\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const now = Date.now();",
    "b": true,
    "l": 24
  },
  {
    "p": "base44/functions/globalScheduler/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    console.log('[GLOBAL_SCHEDULER] Running');\n\n    // ── Process delayed workflow steps (wait nodes) on every tick ─────────────\n    // WorkflowScheduledStep records are written when a Wait node is hit.\n    // processWorkflowSchedule checks execute_at <= now and resumes those flows.",
    "b": true,
    "l": 741
  },
  {
    "p": "base44/functions/growthAgent/entry.ts",
    "v": "/**\n * GROWTH AGENT\n *\n * Merged from agentbman_platform_full_system/functions/growthAgent.ts\n *\n * AI-driven market research + outreach strategy generator.\n * Designed as a Deno.serve endpoint so it runs through Base44 auth\n * and the existing aiGateway.ts cost tracking.\n *\n * Changes from original:\n *   - Original called aiRequest() directly (bypassed auth, cost tracking, RLS)\n *   - Now calls aiGateway.ts via base44.functions.invoke() — same as all other workers\n *   - Added organization_id + auth check (was completely open)\n *   - Added structured response schema\n *   - goal is validated and length-capped (prompt injection guard)",
    "b": true,
    "l": 99
  },
  {
    "p": "base44/functions/handleTriggerActions/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Executes trigger actions based on campaign events\n * Handles: responses, opt-outs, campaign completion, etc.\n */\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const db = base44.asServiceRole; // Use service role for all DB operations\n    const { campaign_id, contact_id, trigger_type, metadata = {} } = await req.json();\n\n    if (!campaign_id || !contact_id || !trigger_type) {\n      return Response.json({ error: 'Missing required fields' }, { status: 400 });\n    }",
    "b": true,
    "l": 230
  },
  {
    "p": "base44/functions/healthAnalyzer/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * HEALTH ANALYZER\n *\n * Evaluates system telemetry and detects anomalies.\n * Creates SystemAnomaly records for RemediationExecutor.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);",
    "b": true,
    "l": 175
  },
  {
    "p": "base44/functions/idempotencyHelper/entry.ts",
    "v": "/**\n * IDEMPOTENCY HELPER\n *\n * Generates idempotency keys and checks for duplicates.\n * Prevents duplicate leads across campaigns using campaign + source ID.\n */\n\nimport crypto from 'node:crypto';\n\n/**\n * Generate idempotency key from campaign + source identifier\n */\nexport function generateIdempotencyKey(campaign_id, source_platform, source_id) {\n  if (!campaign_id || !source_platform || !source_id) {\n    throw new Error('campaign_id, source_platform, and source_id are required');",
    "b": true,
    "l": 106
  },
  {
    "p": "base44/functions/importExternalLeads/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nfunction normalizeLeadDataMapping(platform, data) {\n  if (platform === 'youtube') {\n    return {\n      author_name: data.comment_author || data.author || '',\n      profile_url: data.author_channel_url || data.channel_url || '',\n      content_text: data.comment_text || data.text || '',\n      content_url: data.video_url || data.url || '',\n    };\n  }\n\n  if (platform === 'twitter') {\n    return {\n      author_name: data.username || data.author || '',",
    "b": true,
    "l": 189
  },
  {
    "p": "base44/functions/importLeads/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n// ── Inline rate limiter ───────────────────────────────────────────────────────\nconst _rlWindows = new Map();\nfunction checkRateLimit(orgId, endpoint, maxReq, windowMs) {\n  const key = `${orgId}:${endpoint}`;\n  const now = Date.now();\n  const win = _rlWindows.get(key);\n  if (!win || now - win.windowStart > windowMs) {\n    _rlWindows.set(key, { count: 1, windowStart: now });\n    return { allowed: true, remaining: maxReq - 1, resetMs: windowMs };\n  }\n  if (win.count >= maxReq) {\n    return { allowed: false, remaining: 0, resetMs: windowMs - (now - win.windowStart) };\n  }",
    "b": true,
    "l": 115
  },
  {
    "p": "base44/functions/incomingCallWebhook/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * INCOMING CALL WEBHOOK\n *\n * Twilio calls this URL when an inbound call arrives on your number.\n * It returns TwiML that connects the call to the assigned agent's browser\n * (Twilio Device / Client).\n *\n * Configure in Twilio Console:\n *   Phone Number → Voice & Fax → A Call Comes In → Webhook → POST → <this URL>\n *\n * Flow:\n * 1. Parse From/To/CallSid from Twilio POST body\n * 2. Look up PhoneLine for the dialed number → get org_id",
    "b": true,
    "l": 154
  },
  {
    "p": "base44/functions/ingestSolarLeadsFromCSV/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n    const body = await req.json().catch(() => ({}));\n    const { rows, campaign_id, campaign_name, organization_id } = body;\n\n    if (!rows || !Array.isArray(rows) || rows.length === 0) {\n      return Response.json({ error: 'No rows provided' }, { status: 400 });\n    }",
    "b": true,
    "l": 95
  },
  {
    "p": "base44/functions/ingestSolarPermits/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** Base44 short-text fields reject large HTML blobs from Accela detail pages. */\nconst STRING_MAX: Record<string, number> = {\n  licensedProfessional: 500,\n  contractor: 500,\n  contractorPhone: 80,\n  applicantName: 500,\n  workLocation: 500,\n  address: 500,\n  city: 120,\n  zipCode: 20,\n  permitNumber: 80,\n  permitUrl: 2000,\n  status: 200,",
    "b": true,
    "l": 477
  },
  {
    "p": "base44/functions/initiateCall/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nimport twilio from 'npm:twilio@5.3.3';\n\n// Inlined rate limiter (no local imports allowed in Base44 functions)\ninterface RLWindow { count: number; windowStart: number; }\nconst _rlWindows = new Map<string, RLWindow>();\nfunction checkRateLimit(orgId: string, endpoint: string, maxRequests: number, windowMs: number) {\n  const key = `${orgId}:${endpoint}`;\n  const now = Date.now();\n  const win = _rlWindows.get(key);\n  if (!win || now - win.windowStart > windowMs) {\n    _rlWindows.set(key, { count: 1, windowStart: now });\n    return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };\n  }\n  if (win.count >= maxRequests) {",
    "b": true,
    "l": 189
  },
  {
    "p": "base44/functions/initiateOutboundCall/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    const {\n      contact_id,\n      campaign_id,\n      call_script_id,\n      transfer_number,",
    "b": true,
    "l": 169
  },
  {
    "p": "base44/functions/instantlyAPI/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    // Check feature flag — default to ENABLED if flag doesn't exist\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: 'enable_email_campaigns' }, 'flag_name', 1).catch(() => []);\n      if (flags?.length > 0 && flags[0].enabled === false) {\n        return Response.json({ error: `Feature 'enable_email_campaigns' is disabled. Enable it in Admin → Feature Flags.`, flag: 'enable_email_campaigns' }, { status: 403 });",
    "b": true,
    "l": 356
  },
  {
    "p": "base44/functions/instantlyWebhook/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n\n    // Verify webhook secret if configured\n    const webhookSecret = Deno.env.get('INSTANTLY_WEBHOOK_SECRET');\n    if (webhookSecret) {\n      const signature = req.headers.get('x-webhook-secret') || req.headers.get('x-instantly-signature');\n      if (signature !== webhookSecret) {\n        console.warn('instantlyWebhook: Invalid signature');\n        return new Response('Forbidden', { status: 403 });\n      }\n    }",
    "b": true,
    "l": 325
  },
  {
    "p": "base44/functions/intentAnalysisWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway */\n\nasync function analyzeIntent(base44, lead, campaign) {\n  const prompt = `Analyze the intent of this person/comment. Rate 0-100 buying intent.\n\nAuthor: ${lead.author_name}, Platform: ${lead.source_platform}\nContent: ${lead.notes || lead.source_url}\n\nConsider: product recommendations, problem descriptions, solution research, buyer journey stage.\nReturn JSON: { \"intent_score\": 0-100, \"reasoning\": \"...\", \"buyer_stage\": \"awareness|research|comparison|purchase\" }`;\n\n  // N-01 FIX: route through aiGateway\n  const res = await base44.asServiceRole.functions.invoke('aiGateway', {",
    "b": true,
    "l": 68
  },
  {
    "p": "base44/functions/intentWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * INTENT WORKER — Dual-mode lead intent analyzer\n *\n * MODE A — Per-lead (called by queueDrainer with a specific lead_id):\n *   Processes exactly one lead. This is the primary production path.\n *   Input: { lead_id, campaign_id, organization_id }\n *\n * MODE B — Batch scan (called directly for back-fill / catch-up):\n *   Scans for all CampaignLead records with status = 'discovered'.\n *   Input: { organization_id, campaign_id?, batch_size? }\n *\n * The scheduler ONLY calls queueDrainer, which uses Mode A.\n * Mode B exists for back-fill and manual invocations only.",
    "b": true,
    "l": 189
  },
  {
    "p": "base44/functions/invoiceAI/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** invokeAI — helper that routes AI calls through aiGateway */\nasync function invokeAI(opts: {\n  base44: unknown; organization_id: string; task: string;\n  prompt: string; worker_name: string; campaign_id?: string;\n  lead_id?: string; system_message?: string;\n}): Promise<unknown> {\n  const { base44, organization_id, task, prompt, worker_name,\n          campaign_id, lead_id, system_message } = opts;\n  const b44 = base44 as { asServiceRole: { functions: { invoke: (n: string, p: unknown) => Promise<Record<string, unknown>> } } };\n  const res = await b44.asServiceRole.functions.invoke('aiGateway', {\n    organization_id, campaign_id, lead_id, task, prompt, worker_name, system_message,\n  });\n  if (!res?.success) {",
    "b": true,
    "l": 43
  },
  {
    "p": "base44/functions/invokeAI/entry.ts",
    "v": "/**\n * invokeAI — Shared helper module for all worker AI calls.\n *\n * Routes every inference through aiGateway which enforces:\n *   - kill switch / budget check (fail-closed)\n *   - contextSafetyLayer pre-call\n *   - response caching / deduplication\n *   - cost tracking + DailySpendBucket writes\n *   - aiResponseValidator post-call\n *\n * NOTE: This is a utility module (no Deno.serve). It was incorrectly\n * deleted during duplicate cleanup. It is NOT a duplicate of aiGateway —\n * it is a typed wrapper that 13 worker functions depend on.\n */\nexport interface InvokeAIOptions {",
    "b": true,
    "l": 51
  },
  {
    "p": "base44/functions/isSuperAdmin/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n\n  // Support both POST body and being called as a function\n  const body = await req.json().catch(() => ({}));\n  const { user_id, organization_id } = body;\n\n  const SUPER_ADMIN_EMAIL = 'chainwavestudios@gmail.com';\n\n  // 1. Resolve user by id\n  let userEmail = '';\n  let userRole  = '';\n  if (user_id) {",
    "b": true,
    "l": 50
  },
  {
    "p": "base44/functions/keywordIntentFilter/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag\n        .filter({ flag_name: flagName }, 'flag_name', 1)\n        .catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;",
    "b": true,
    "l": 88
  },
  {
    "p": "base44/functions/killSwitch/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * KILL SWITCH\n *\n * N-04 FIX: No longer fetches 2000 AISpendLog rows and filters in memory.\n *           Now reads SpendWindow rolling buckets (one row per org per window),\n *           maintained atomically by aiGateway after every inference.\n *           Falls back to date-filtered AISpendLog scan if SpendWindow missing.\n *\n * FAIL-CLOSED: any exception returns kill_switch_active: true.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {",
    "b": true,
    "l": 148
  },
  {
    "p": "base44/functions/leadExtractionWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nimport crypto from 'node:crypto';\n\n/**\n * Generate idempotency key: SHA-256(campaign_id + source_platform + source_id)\n */\nfunction generateIdempotencyKey(campaign_id, source_platform, source_id) {\n  const combined = `${campaign_id}:${source_platform}:${source_id}`;\n  return crypto.createHash('sha256').update(combined).digest('hex');\n}\n\n/**\n * Check if lead already exists by idempotency key\n */\nasync function checkLeadExists(base44, idempotency_key) {",
    "b": true,
    "l": 135
  },
  {
    "p": "base44/functions/leadFilteringPipeline/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n// ── Inline invokeAI (relative imports not supported in Base44 Deno) ──────────\nasync function invokeAI(opts: {\n  base44: unknown; organization_id: string; task: string;\n  prompt: string; worker_name: string; campaign_id?: string;\n  lead_id?: string; system_message?: string;\n}): Promise<unknown> {\n  const { base44, organization_id, task, prompt, worker_name,\n          campaign_id, lead_id, system_message } = opts;\n  const b44 = base44 as { asServiceRole: { functions: { invoke: (n: string, p: unknown) => Promise<Record<string, unknown>> } } };\n  const res = await b44.asServiceRole.functions.invoke('aiGateway', {\n    organization_id, campaign_id, lead_id, task, prompt, worker_name, system_message,\n  });\n  if (!res?.success) {\n    const reason = (res?.reason ?? res?.error ?? 'aiGateway rejected') as string;",
    "b": true,
    "l": 113
  },
  {
    "p": "base44/functions/leadIntelligenceWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Lead Intelligence Worker\n * Combines intent, persona, pain points into final lead score\n */\n\nasync function calculateLeadScore(base44, lead, campaignLead) {\n  const intentScore = lead.intent_score || 0;\n  const painPointsCount = (lead.pain_points || []).length;\n  const engagementScore = getEngagementScore(lead.engagement_level);\n\n  // Base scoring formula\n  let score = (intentScore * 0.5) + (painPointsCount * 5) + (engagementScore * 20);\n",
    "b": true,
    "l": 125
  },
  {
    "p": "base44/functions/leadPipeline/entry.ts",
    "v": "/**\n * LEAD PIPELINE (Standalone / Local)\n *\n * Merged from agentbman_platform_full_system/functions/leadPipeline.ts\n *\n * This is a LOCAL orchestration module (not a Deno.serve endpoint).\n * It is imported by workerController.ts and simulationEngine.ts.\n *\n * ⚠️  In production, lead processing goes through the existing Deno.serve\n *     worker chain (intentWorker.ts, qualificationWorker.ts, etc.) which\n *     route through aiGateway.ts with full auth, cost tracking, and RLS.\n *\n * This module is used by:\n *   - simulationEngine.ts  (dry-run / CampaignSimulator page)\n *   - workerController.ts  (local dev / test runner)",
    "b": true,
    "l": 136
  },
  {
    "p": "base44/functions/leadStreamer/entry.ts",
    "v": "/**\n * LEAD STREAMER (Local / Dev)\n *\n * Merged from agentbman_platform_full_system/functions/leadStreamer.ts\n *\n * Streams campaign leads into the in-memory queue for local simulation.\n *\n * ⚠️  In production, campaign lead streaming is handled by:\n *     - campaignExecutionEngine.ts (Deno.serve) — enqueues via CampaignQueue entity\n *     - discoveryWorker.ts, leadExtractionWorker.ts — populate Lead entity\n *\n * This module is used only by:\n *   - simulationEngine.ts (CampaignSimulator page dry runs)\n *   - Local dev testing without a live database\n *",
    "b": true,
    "l": 71
  },
  {
    "p": "base44/functions/linkedinCommentWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * LINKEDIN COMMENT WORKER - STAGE 3\n * Scrapes comments from LinkedIn posts\n * Actor: apify/linkedin-comment-scraper\n */\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\nconst LINKEDIN_COMMENT_ACTOR = 'apify/linkedin-comment-scraper';\n\n/**\n * Run Apify actor and fetch dataset results\n */\nasync function runApifyActor(actorId, input, APIFY_TOKEN) {",
    "b": true,
    "l": 164
  },
  {
    "p": "base44/functions/linkedinDiscoveryWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * LINKEDIN DISCOVERY WORKER\n * \n * Searches LinkedIn posts for relevant content.\n * Actor: apify~linkedin-post-search\n * \n * Extracts:\n * - post_text\n * - author_name\n * - profile_url\n * - likes\n * - comments_count\n * ",
    "b": true,
    "l": 159
  },
  {
    "p": "base44/functions/linkedinPostWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * LINKEDIN POST WORKER - STAGE 2\n * \n * LinkedIn posts have already been scraped and ingested.\n * This worker simply validates and normalizes post data,\n * then queues for comment scraping.\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });",
    "b": true,
    "l": 65
  },
  {
    "p": "base44/functions/listTeamMembers/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    if (req.method !== 'GET') {\n      return Response.json({ error: 'Method not allowed' }, { status: 405 });",
    "b": true,
    "l": 41
  },
  {
    "p": "base44/functions/loadSettings/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * loadSettings — loads all per-org settings from SystemSettings.\n *\n * SystemSettings is the canonical store. Also checks GlobalSettings\n * for any keys that may have been written there by older code, and\n * merges them in (SystemSettings takes precedence).\n *\n * POST { organization_id }\n */\nDeno.serve(async (req: Request) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const body = await req.json().catch(() => ({}));",
    "b": true,
    "l": 53
  },
  {
    "p": "base44/functions/logAdminAction/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (user?.role !== 'admin') {\n      return Response.json({ error: 'Forbidden' }, { status: 403 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    const { action, resource, old_value, new_value } = await req.json();\n",
    "b": true,
    "l": 34
  },
  {
    "p": "base44/functions/logEngagementEvent/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n\n  // Only allow internal service role calls\n  // External POST requests without valid context are rejected\n  const internalSecret = Deno.env.get('INTERNAL_SECRET');\n  const authHeader = req.headers.get('authorization') || '';\n  \n  // base44.asServiceRole calls include the internal secret automatically\n  // For direct HTTP calls, require the internal secret\n  if (!authHeader && internalSecret) {\n    const reqSecret = req.headers.get('x-internal-secret');\n    if (reqSecret !== internalSecret) {",
    "b": true,
    "l": 159
  },
  {
    "p": "base44/functions/loopBreakerAgent/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n\n\n    const { workflow_id, execution_history, current_step } = await req.json();",
    "b": true,
    "l": 51
  },
  {
    "p": "base44/functions/loopDetector/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * LOOP DETECTOR\n *\n * Analyzes agent execution history to detect loops.\n * Rules:\n * - Same agent appears > 3 times = loop\n * - Same input_hash appears twice = loop\n * - Max steps exceeded (12) = loop\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });",
    "b": true,
    "l": 173
  },
  {
    "p": "base44/functions/manageCampaignPersonas/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    const url = new URL(req.url);\n    const pathParts = url.pathname.split('/');",
    "b": true,
    "l": 50
  },
  {
    "p": "base44/functions/manageCostPolicy/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * MANAGE COST POLICY\n *\n * Issue 5 fix: Kill-switch thresholds ($10/10min) were hardcoded in the source.\n * This endpoint provides CRUD for CostPolicy records so admins can adjust limits\n * without a code deploy.\n *\n * CostPolicy fields used by killSwitch.ts and costPolicyEngine.ts:\n *   anomaly_threshold_usd       — max spend per anomaly_window_minutes before kill switch fires\n *   anomaly_window_minutes      — rolling window for anomaly detection (default: 10)\n *   max_cost_per_request_usd    — per-call spend ceiling (blocks single runaway prompt)\n *   max_daily_spend_usd         — org-level daily spend cap\n *   max_campaign_budget_usd     — per-campaign total budget cap",
    "b": true,
    "l": 149
  },
  {
    "p": "base44/functions/manageOutreachVariants/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    const url = new URL(req.url);\n    const pathParts = url.pathname.split('/');",
    "b": true,
    "l": 69
  },
  {
    "p": "base44/functions/manageSeat/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n    const { action, target_email, role, target_seat_id } = await req.json();\n\n    // Resolve orgId — user.organization_id may not be stamped yet\n    let orgId = user.organization_id || '';\n    if (!orgId && user.id) {\n      const seat = await base44.asServiceRole.entities.OrgSeat\n        .filter({ user_id: user.id, status: 'active' }, '-created_at', 1).catch(() => []);",
    "b": true,
    "l": 209
  },
  {
    "p": "base44/functions/mapPlatformAccounts/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n  const { lead_id, discovery_results } = await req.json();\n\n  if (!lead_id || !discovery_results) {\n    return Response.json({ error: 'Missing lead_id or discovery_results' }, { status: 400 });\n  }\n\n  try {",
    "b": true,
    "l": 38
  },
  {
    "p": "base44/functions/migrateEnvVarsToSettings/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst MAPPINGS = [\n  { env: 'TWILIO_ACCOUNT_SID',      key: 'twilio_account_sid' },\n  { env: 'TWILIO_ACCOUNT_SID',      key: 'twilio_voice_account_sid' },\n  { env: 'TWILIO_AUTH_TOKEN',       key: 'twilio_auth_token' },\n  { env: 'TWILIO_AUTH_TOKEN',       key: 'twilio_voice_auth_token' },\n  { env: 'TWILIO_PHONE_NUMBER',     key: 'twilio_phone_number' },\n  { env: 'TWILIO_PHONE_NUMBER',     key: 'twilio_voice_phone_number' },\n  { env: 'TWILIO_OUTBOUND_NUMBER',  key: 'twilio_phone_number', fallback: true },\n  { env: 'TWILIO_DEFAULT_FROM',     key: 'twilio_phone_number', fallback: true },\n  { env: 'TWILIO_API_KEY_SID',      key: 'twilio_api_key_sid' },\n  { env: 'TWILIO_API_KEY_SECRET',   key: 'twilio_api_key_secret' },\n  { env: 'TWILIO_TWIML_APP_SID',    key: 'twilio_twiml_app_sid' },\n  { env: 'RENDER_AI_AGENT_URL',     key: 'render_ai_agent_url' },",
    "b": true,
    "l": 153
  },
  {
    "p": "base44/functions/migrateLeadArchitecture/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * DATA MIGRATION: Convert from single-parent (Lead.campaign_id) to multi-parent (CampaignLead join)\n *\n * Steps:\n * 1. For each Lead with campaign_id set, create a CampaignLead record\n * 2. Copy campaign-specific fields from Lead to CampaignLead\n * 3. Update Lead to remove campaign_id (set to null/empty)\n * 4. Update campaign-specific state fields to global equivalents\n *\n * This is a one-time migration that should be run once to convert the data model.\n */\n\nDeno.serve(async (req) => {",
    "b": true,
    "l": 155
  },
  {
    "p": "base44/functions/monitorDLQ/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst DLQ_ALERT_THRESHOLD = 20;\n\nconst JOB_TYPES = ['discover', 'analyze', 'qualify', 'intelligence', 'enrich', 'outreach'];\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {",
    "b": true,
    "l": 60
  },
  {
    "p": "base44/functions/normalizeLeadData/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n\n  // B-12 FIX: Internal function guard — only callable via functions.invoke() from other functions\n  // Rejects direct HTTP calls that don't carry the internal shared secret\n  const internalSecret = Deno.env.get('INTERNAL_SECRET');\n  if (internalSecret) {\n    const callerSecret = req.headers.get('x-internal-secret');\n    if (callerSecret !== internalSecret) {\n      return Response.json({ error: 'Forbidden' }, { status: 403 });\n    }\n  }\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });",
    "b": true,
    "l": 67
  },
  {
    "p": "base44/functions/nwsStormSentinel/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * NWS STORM SENTINEL (Aether-Strike)\n *\n * Polls api.weather.gov/alerts/active?area=CA.\n * Triggers stormIntersectionWorker when windGust ≥ 58 mph is detected.\n */\n\nconst NWS_BASE = 'https://api.weather.gov';\nconst WIND_THRESHOLD_MPH = 58;\nconst USER_AGENT = '(chainwave-aether-strike, support@chainwavestudios.com)';\n\nconst WIND_EVENT_TYPES = [\n  'Severe Thunderstorm Warning',",
    "b": true,
    "l": 181
  },
  {
    "p": "base44/functions/onboardNewOrg/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * ONBOARD NEW ORG\n * M-4 FIX: Previously seedDataSources, seedFeatureFlags, seedDocumentation\n * required manual admin invocation. This function auto-runs all seeds when\n * a new organization is created. Call this from your org creation webhook\n * or directly after Organization.create().\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });\n\n  const base44 = createClientFromRequest(req);\n  try {",
    "b": true,
    "l": 234
  },
  {
    "p": "base44/functions/outreachWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n\n/**\n * OUTREACH WORKER\n *\n * Fixes applied:\n *   C-04 — Real email sending via SendGrid (replaces console.log stub).\n *           Falls back to Mailgun or SMTP envelope if SendGrid key absent.\n *   L-03 — Writes heartbeat to WorkerStatus on every invocation.\n *   Reliability — Campaign status guard: skips paused / stopped campaigns.\n *   Reliability — Idempotency: checks OutreachMessage before sending to prevent duplicates.\n */\n\nconst SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';",
    "b": true,
    "l": 306
  },
  {
    "p": "base44/functions/painPointWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway directly */\n\nasync function extractPainPoints(base44, lead, campaign) {\n  const prompt = `Extract pain points and problems mentioned by this person.\n\nAuthor: ${lead.author_name}\nPlatform: ${lead.source_platform}\nURL: ${lead.source_url}\n\nIdentify specific problems, challenges, frustrations, and needs.\n\nRespond with JSON: { \"pain_points\": [\"...\"], \"severity\": \"high|medium|low\", \"relevance\": 0-1 }`;\n",
    "b": true,
    "l": 56
  },
  {
    "p": "base44/functions/pauseQueue/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  const { queue_name } = await req.json().catch(() => ({}));\n  if (!queue_name) return Response.json({ error: 'Missing queue_name' }, { status: 400 });\n  const orgId = user.organization_id;\n  const key = `queue_paused_${queue_name}`;",
    "b": true,
    "l": 19
  },
  {
    "p": "base44/functions/pauseWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  const { worker_name } = await req.json().catch(() => ({}));\n  if (!worker_name) return Response.json({ error: 'Missing worker_name' }, { status: 400 });\n  const orgId = user.organization_id;",
    "b": true,
    "l": 16
  },
  {
    "p": "base44/functions/personMatchingService/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Person Matching Service\n * Handles finding or creating persons with intelligent deduplication\n * Called by discovery/ingestion workers\n */\n\nfunction normalizeEmail(email) {\n  return email ? email.toLowerCase().trim() : null;\n}\n\nfunction normalizeLinkedInUrl(url) {\n  if (!url) return null;\n  return url.replace(/\\/$/, '').toLowerCase();",
    "b": true,
    "l": 228
  },
  {
    "p": "base44/functions/personaClusteringWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Persona Clustering Worker\n * Nightly job to group people by detected patterns\n * Creates AI persona segments for campaign targeting\n */\n\nasync function clusterPersonas(base44, organizationId) {\n  // Fetch all people with persona tags\n  const people = await base44.asServiceRole.entities.Person.filter(\n    { organization_id: organizationId },\n    '-ai_intent_score',\n    1000\n  );",
    "b": true,
    "l": 129
  },
  {
    "p": "base44/functions/personaDetectionWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway via invokeAI wrapper */\n\nasync function detectPersona(base44, lead, campaign) {\n  const prompt = `Analyze this person and detect their most likely business role/persona.\n\nAuthor: ${lead.author_name}\nPlatform: ${lead.source_platform}\nSource: ${lead.source_url}\n\nClassify as ONE of: founder, marketing_manager, sales_leader, developer, cto, other\n\nRespond with JSON: { \"persona\": \"...\", \"confidence\": 0-1, \"reasoning\": \"...\" }`;\n",
    "b": true,
    "l": 108
  },
  {
    "p": "base44/functions/pipelineSimulation/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (user?.role !== 'admin') {\n      return Response.json({ error: 'Admin access required' }, { status: 403 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    const { campaign_id, discovery_results = 500 } = await req.json();\n",
    "b": true,
    "l": 86
  },
  {
    "p": "base44/functions/platformActors/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Platform Actors — returns verified Apify actor IDs and input schemas per platform.\n * GET/POST with { platform, type } returns actor ID and sample input.\n *\n * VERIFIED ACTOR IDs (March 2026):\n * - YouTube search:   apify/youtube-scraper\n * - YouTube comments: apify/youtube-comment-scraper\n * - Reddit:           trudax/reddit-scraper  (Apify has no native Reddit actor)\n * - Twitter/X:        apidojo/tweet-scraper\n * - LinkedIn posts:   curious_coder/linkedin-post-search-scraper\n * - Facebook posts:   apify/facebook-posts-scraper\n */\n",
    "b": true,
    "l": 115
  },
  {
    "p": "base44/functions/postCallSync/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n\n  const rawBody = await req.text();\n\n  const secret = Deno.env.get('RENDER_CALLBACK_SECRET');\n  if (secret) {\n    const provided = req.headers.get('x-callback-secret') || '';\n    if (provided !== secret) {\n      console.warn('[postCallSync] Rejected — invalid secret');\n      return new Response('Forbidden', { status: 403 });\n    }\n  }",
    "b": true,
    "l": 259
  },
  {
    "p": "base44/functions/previewVoice/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'POST only' }, { status: 405 });\n  }\n\n  const { model } = await req.json();\n  if (!model) {\n    return Response.json({ error: 'model required' }, { status: 400 });\n  }\n\n  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');\n  if (!DEEPGRAM_API_KEY) {\n    return Response.json(",
    "b": true,
    "l": 54
  },
  {
    "p": "base44/functions/processInboundSMS/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * PROCESS INBOUND SMS (background)\n * Called fire-and-forget by twilioResponseWebhook.\n * Handles: opt-out, contact update, enrollment stops, campaign triggers,\n *          workflow triggers, notifications, engagement events.\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const body = await req.json().catch(() => null);\n    if (!body) return Response.json({ error: 'No body' }, { status: 400 });\n",
    "b": true,
    "l": 183
  },
  {
    "p": "base44/functions/processLeadQueue/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n// ── Inline invokeAI (relative imports not supported in Base44 Deno) ──────────\nasync function invokeAI(opts: {\n  base44: unknown; organization_id: string; task: string;\n  prompt: string; worker_name: string; campaign_id?: string;\n  lead_id?: string; system_message?: string;\n}): Promise<unknown> {\n  const { base44, organization_id, task, prompt, worker_name,\n          campaign_id, lead_id, system_message } = opts;\n  const b44 = base44 as { asServiceRole: { functions: { invoke: (n: string, p: unknown) => Promise<Record<string, unknown>> } } };\n  const res = await b44.asServiceRole.functions.invoke('aiGateway', {\n    organization_id, campaign_id, lead_id, task, prompt, worker_name, system_message,\n  });\n  if (!res?.success) {\n    const reason = (res?.reason ?? res?.error ?? 'aiGateway rejected') as string;",
    "b": true,
    "l": 115
  },
  {
    "p": "base44/functions/processReminders/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const now = new Date().toISOString();\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;\n      return true;\n    } catch { return true; }\n  };\n  if (!(await checkFlag('enable_followup_scheduling'))) {\n    return Response.json({ error: `Feature 'enable_followup_scheduling' is disabled`, flag: 'enable_followup_scheduling' }, { status: 403 });",
    "b": true,
    "l": 87
  },
  {
    "p": "base44/functions/processWebhooks/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n// ── SSRF Protection ──────────────────────────────────────────────────────────\n// Validates that a webhook target_url is safe to fetch.\n// Rejects: private IP ranges, loopback, link-local, metadata endpoints,\n//          and any non-HTTPS scheme.\nfunction isAllowedWebhookUrl(rawUrl: string): { ok: boolean; reason?: string } {\n  let url: URL;\n  try {\n    url = new URL(rawUrl);\n  } catch {\n    return { ok: false, reason: 'Invalid URL' };\n  }\n\n  // Only HTTPS allowed for webhook targets",
    "b": true,
    "l": 132
  },
  {
    "p": "base44/functions/processWorkflowSchedule/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const now = new Date().toISOString();\n\n    // Find all pending steps due for execution\n    const stepQuery: any = {\n      status: 'pending',\n    };\n    // Fetch all pending steps — they're org-scoped via organization_id\n    const dueSteps = await base44.asServiceRole.entities.WorkflowScheduledStep.filter(stepQuery).catch(() => []);\n\n    const actuallyDue = dueSteps.filter((s: any) => s.execute_at <= now);",
    "b": true,
    "l": 55
  },
  {
    "p": "base44/functions/promoteLeadToContact/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'POST only' }, { status: 405 });\n  }\n  const base44 = createClientFromRequest(req);\n  try {\n    // Check enable_auto_lead_approval flag — if false, require manual approval\n    const autoApproveFlag = await base44.asServiceRole.entities.FeatureFlag\n      .filter({ flag_name: 'enable_auto_lead_approval' }, 'flag_name', 1).catch(() => []);\n    const autoApproveEnabled = autoApproveFlag?.length ? autoApproveFlag[0].enabled !== false : true;\n    if (!autoApproveEnabled) {\n      console.log('[PROMOTE] Auto approval disabled — manual review required');\n      return Response.json({ success: false, skipped: true, reason: 'Manual approval required — auto lead approval is disabled' }, { status: 403 });",
    "b": true,
    "l": 193
  },
  {
    "p": "base44/functions/provisionTwilioEZSetup/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const { area_code } = await req.json();\n  const orgId = user.organization_id;\n  const areaCode = area_code || '415';\n\n  // Master account credentials — from YOUR Render env vars\n  // These are YOUR Twilio credentials, not the client's\n  const masterSid   = Deno.env.get('TWILIO_MASTER_ACCOUNT_SID') || '';\n  const masterToken = Deno.env.get('TWILIO_MASTER_AUTH_TOKEN') || '';",
    "b": true,
    "l": 185
  },
  {
    "p": "base44/functions/purchasePhoneLine/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const { area_code, action, phone_number, label } = await req.json();\n  const orgId = user.organization_id;\n\n  const getSetting = async (key: string, envFallback: string) => {\n    const _CRED_KEYS = new Set(['twilio_account_sid','twilio_auth_token','twilio_phone_number','twilio_api_key_sid','twilio_api_key_secret','twilio_twiml_app_sid']);\n    try {\n      const r = await base44.asServiceRole.functions\n        .invoke('getOrgSetting', { ",
    "b": true,
    "l": 189
  },
  {
    "p": "base44/functions/purgeDLQ/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me();\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const organization_id = (user as Record<string, string>).organization_id;\n",
    "b": true,
    "l": 19
  },
  {
    "p": "base44/functions/pushLeadToMonday/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;\n      return true;\n    } catch { return true; }\n  };\n  if (!(await checkFlag('enable_monday_push'))) {\n    return Response.json({ skipped: true, reason: 'Monday push disabled' });\n  }",
    "b": true,
    "l": 191
  },
  {
    "p": "base44/functions/qualificationWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n\n/**\n * QUALIFICATION WORKER\n *\n * Fixes applied:\n *   H-03 — Writes to CampaignLead.status (canonical state-machine field),\n *           not the legacy status_in_campaign field. Both are kept in sync.\n *   M-02 — Reads intent threshold from the canonical path:\n *           campaign.campaign_config.qualification_rules.intent_threshold\n *           (was reading campaign.campaign_config.intent_hot_threshold which doesn't exist)\n *   L-03 — Writes heartbeat to WorkerStatus.\n *   Reliability — Campaign status guard: skips paused/stopped campaigns.\n */",
    "b": true,
    "l": 327
  },
  {
    "p": "base44/functions/querySMSLogs/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  try {\n    const logs = await base44.asServiceRole.entities.SMSLog\n      .filter({\n        direction: 'inbound',\n        organization_id: '69c48e97e0729ae072dbac5a'",
    "b": true,
    "l": 24
  },
  {
    "p": "base44/functions/queueBackpressureManager/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUEUE BACKPRESSURE MANAGER\n *\n * N-08 FIX — Three bugs corrected:\n *   Bug 1: Auth check was `!user?.role !== 'admin'` (always true due to operator precedence).\n *          Fixed to: `user?.role !== 'admin'`\n *   Bug 2: organization_id derived from `campaign_id.split('_')[0]` (wrong, fragile).\n *          Fixed to: lookup Campaign entity and read campaign.organization_id.\n *   Bug 3: Used `base44.entities` (user-scoped) instead of `base44.asServiceRole.entities`.\n *          Fixed throughout.\n */\n\nDeno.serve(async (req) => {",
    "b": true,
    "l": 102
  },
  {
    "p": "base44/functions/queueCleanupWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUEUE CLEANUP WORKER\n *\n * A-05 FIX: Queue tables grew indefinitely — old cleanup only archived rows.\n * This worker HARD DELETES completed/failed/dead_letter rows older than 30 days,\n * keeping tables lean for index performance.\n *\n * Scheduled: nightly via globalScheduler (daily cadence flag).\n * Also callable manually by admins.\n */\n\nconst QUEUES_TO_CLEAN = [\n  'CampaignQueue',",
    "b": true,
    "l": 115
  },
  {
    "p": "base44/functions/queueControl/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUEUE CONTROL — pauseQueue / resumeQueue / purgeDLQ\n *\n * Manages queue pause state in SystemSettings and purges dead letter queue.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n  const body = await req.clone().json().catch(() => ({}));",
    "b": true,
    "l": 92
  },
  {
    "p": "base44/functions/queueDrainer/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUEUE DRAINER — Single consumer for all domain queues.\n *\n * H-2 FIX: Queue entity naming standardised.\n * Two patterns exist and both are handled:\n *   (a) Named entity tables: IntentQueue, QualificationQueue, EnrichmentQueue,\n *       OutreachQueue, DiscoveryQueue — original 5 core queues.\n *   (b) Shared CampaignQueue filtered by job_type — 7 new job types from C-3.\n * Both can coexist. Named-entity drains return empty if the table doesn't exist.\n *\n * Full mapping (12 job types):\n *   IntentQueue | CampaignQueue[intent_analysis]      → intentWorker\n *   QualificationQueue | CampaignQueue[qualify_leads] → qualificationWorker",
    "b": true,
    "l": 344
  },
  {
    "p": "base44/functions/queuePriorityScheduler/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUEUE PRIORITY SCHEDULER\n *\n * Process queues by priority instead of FIFO.\n * Prevents low-priority queues from starving.\n *\n * Priority: Outreach > Followup > Qualification > Intent > Discovery\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }",
    "b": true,
    "l": 195
  },
  {
    "p": "base44/functions/queueRecoveryWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * QUEUE RECOVERY WORKER\n *\n * N-05 FIX: Now recovers ALL 5 domain queues.\n * Old code only scanned CampaignQueue — IntentQueue, QualificationQueue,\n * EnrichmentQueue, OutreachQueue stuck jobs were NEVER recovered.\n */\n\n// All queue entities to scan\nconst ALL_QUEUES = [\n  'CampaignQueue',\n  'IntentQueue',\n  'QualificationQueue',",
    "b": true,
    "l": 137
  },
  {
    "p": "base44/functions/rateLimiter/entry.ts",
    "v": "/**\n * RATE LIMITER UTILITY\n * M-1 FIX: Sliding-window per-org rate limiting for high-traffic endpoints.\n * Usage: import { checkRateLimit } from './rateLimiter.ts';\n *\n * In-memory — resets on function cold start. For persistent limits across\n * instances, swap the Map for a Supabase counter row or Redis.\n */\n\ninterface Window { count: number; windowStart: number; }\nconst windows = new Map<string, Window>();\n\nexport function checkRateLimit(\n  orgId: string,\n  endpoint: string,",
    "b": true,
    "l": 65
  },
  {
    "p": "base44/functions/recordCallEnd/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const { \n    organization_id, \n    call_sid, \n    duration_seconds,\n    direction,\n    from_number,\n    to_number,\n    twilio_cost,\n  } = await req.json();\n\n  if (!organization_id) {",
    "b": true,
    "l": 90
  },
  {
    "p": "base44/functions/redditDiscoveryWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * REDDIT DISCOVERY WORKER\n * \n * Scrapes Reddit posts and comments from specified subreddits.\n * Actor: apify~reddit-scraper\n * \n * Extracts:\n * - post_title\n * - post_text\n * - author\n * - score\n * - comments (array)\n * ",
    "b": true,
    "l": 217
  },
  {
    "p": "base44/functions/rejectLead/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * REJECT LEAD\n *\n * Rejects a lead with optional rejection reason.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n",
    "b": true,
    "l": 76
  },
  {
    "p": "base44/functions/relevanceWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag\n        .filter({ flag_name: flagName }, 'flag_name', 1)\n        .catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;",
    "b": true,
    "l": 135
  },
  {
    "p": "base44/functions/remediationExecutor/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * REMEDIATION EXECUTOR\n *\n * Executes remediation actions for detected anomalies.\n * All actions are logged for auditability.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);",
    "b": true,
    "l": 167
  },
  {
    "p": "base44/functions/removeTeamMember/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (!user) {\n      return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    }\n\n    // N-07 FIX: Set Postgres session variable — activates RLS policies\n\n    if (req.method !== 'DELETE') {\n      return Response.json({ error: 'Method not allowed' }, { status: 405 });",
    "b": true,
    "l": 41
  },
  {
    "p": "base44/functions/resetDailyUsage/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const packages = await base44.asServiceRole.entities.OrgPackage.list('-created_date', 10000).catch(() => []);\n    \n    if (!packages || packages.length === 0) {\n      return Response.json({ success: true, reset: 0 });\n    }\n\n    const updates = packages.map(p =>\n      base44.asServiceRole.entities.OrgPackage.update(p.id, {\n        calls_today: 0,",
    "b": true,
    "l": 31
  },
  {
    "p": "base44/functions/resetMonthlyUsage/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const packages = await base44.asServiceRole.entities.OrgPackage.list('-created_date', 10000).catch(() => []);\n    \n    if (!packages || packages.length === 0) {\n      return Response.json({ success: true, reset: 0 });\n    }\n\n    const now = new Date();\n    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);\n    const nextMonthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);",
    "b": true,
    "l": 42
  },
  {
    "p": "base44/functions/restartWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  const { worker_name } = await req.json().catch(() => ({}));\n  if (!worker_name) return Response.json({ error: 'Missing worker_name' }, { status: 400 });\n  const orgId = user.organization_id;",
    "b": true,
    "l": 16
  },
  {
    "p": "base44/functions/resumeQueue/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  const { queue_name } = await req.json().catch(() => ({}));\n  if (!queue_name) return Response.json({ error: 'Missing queue_name' }, { status: 400 });\n  const orgId = user.organization_id;",
    "b": true,
    "l": 16
  },
  {
    "p": "base44/functions/resumeWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  const { worker_name } = await req.json().catch(() => ({}));\n  if (!worker_name) return Response.json({ error: 'Missing worker_name' }, { status: 400 });\n  const orgId = user.organization_id;",
    "b": true,
    "l": 16
  },
  {
    "p": "base44/functions/retryFailedJobs/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst MAX_RETRIES = 3;\n\n// Map DLQ job_type → queue entity + payload shape\nconst QUEUE_MAP = {\n  discover:      { entity: 'DiscoveryQueue',  extraFields: { provider_type: 'serper' } },\n  analyze:       { entity: 'RelevanceQueue',  extraFields: {} },\n  qualify:       { entity: 'IntentQueue',     extraFields: {} },\n  intelligence:  { entity: 'EnrichmentQueue', extraFields: {} },\n  enrich:        { entity: 'EnrichmentQueue', extraFields: {} },\n  outreach:      { entity: 'OutreachQueue',   extraFields: { outreach_channel: 'email' } },\n};\n\nDeno.serve(async (req) => {",
    "b": true,
    "l": 84
  },
  {
    "p": "base44/functions/reviewCallTranscript/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { call_log_id, force_review } = await req.json();\n\n    if (!call_log_id) return Response.json({ error: 'call_log_id required' }, { status: 400 });\n\n    const callLog = await base44.asServiceRole.entities.CallLog.get(call_log_id).catch(() => null);\n    if (!callLog) return Response.json({ error: 'Call log not found' }, { status: 404 });\n    if (!callLog.transcript) return Response.json({ error: 'No transcript available' }, { status: 400 });\n\n    if (callLog.ai_review_complete && !force_review) {\n      return Response.json({",
    "b": true,
    "l": 99
  },
  {
    "p": "base44/functions/runApifyDatasetDiscovery/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n  \n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag\n        .filter({ flag_name: flagName }, 'flag_name', 1)\n        .catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;",
    "b": true,
    "l": 232
  },
  {
    "p": "base44/functions/runCampaignScheduler/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * CAMPAIGN SCHEDULER\n * Runs every 5 minutes to send drip sequence messages\n */\n\nfunction substituteVariables(template: string, contact: any, assignee: any, companyName: string): string {\n  const firstName = contact.contact_name?.split(' ')[0] || '';\n  const lastName = contact.contact_name?.split(' ').slice(1).join(' ') || '';\n  const assigneeFirst = assignee?.full_name?.split(' ')[0] || '';\n  const assigneeLast = assignee?.full_name?.split(' ').slice(1).join(' ') || '';\n  const company = companyName || '';\n\n  return template",
    "b": true,
    "l": 580
  },
  {
    "p": "base44/functions/runDataSource/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Run Data Source\n * Executes Apify actor and queues dataset ingestion\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const { source_id, input, campaign_id, organization_id } = await req.json();\n\n    if (!source_id || !campaign_id || !organization_id) {\n      return Response.json(\n        { error: 'Missing required parameters' },",
    "b": true,
    "l": 112
  },
  {
    "p": "base44/functions/runExaDiscovery/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n  \n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag\n        .filter({ flag_name: flagName }, 'flag_name', 1)\n        .catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;",
    "b": true,
    "l": 229
  },
  {
    "p": "base44/functions/runPermitCampaign/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nfunction formatToAccelaDate(isoDate: string) {\n  const [y, m, d] = isoDate.split('-');\n  return `${m}/${d}/${y}`;\n}\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const secret = req.headers.get('x-internal-secret');\n  if (!secret || secret !== Deno.env.get('INTERNAL_SECRET')) {\n    return Response.json({ error: 'Unauthorized' }, { status: 401 });",
    "b": true,
    "l": 127
  },
  {
    "p": "base44/functions/runSerperDiscovery/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n  \n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag\n        .filter({ flag_name: flagName }, 'flag_name', 1)\n        .catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;",
    "b": true,
    "l": 195
  },
  {
    "p": "base44/functions/runSmsSystemTest/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nimport twilio from 'npm:twilio';\n\n// Twilio test credentials ONLY work with magic test numbers:\n// +15005550006 = valid test sender (always works with test creds)\n// +15005550001 = invalid number (for testing error handling)\n// Real phone numbers like +13465678136 only work with production credentials.\nconst TWILIO_TEST_FROM = '+15005550006';\nconst TWILIO_VIRTUAL_PHONE = '+18777804236';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n",
    "b": true,
    "l": 728
  },
  {
    "p": "base44/functions/runSystemAudit/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n// Live-ping an external API endpoint — returns latency ms or error\nasync function pingEndpoint(url, options = {}) {\n  const start = Date.now();\n  try {\n    const res = await fetch(url, {\n      method: options.method || 'GET',\n      headers: options.headers || {},\n      body: options.body || undefined,\n      signal: AbortSignal.timeout(5000),\n    });\n    return { ok: res.status < 500, status: res.status, ms: Date.now() - start };\n  } catch (e) {\n    return { ok: false, status: 0, ms: Date.now() - start, error: e.message };",
    "b": true,
    "l": 204
  },
  {
    "p": "base44/functions/safeVectorRetrieval/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Class B Units VECTOR RETRIEVAL\n *\n * Retrieves vectors with safety filters.\n * Only returns is_active=true vectors.\n * Prevents stale embeddings from being used.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n",
    "b": true,
    "l": 78
  },
  {
    "p": "base44/functions/savePhoneLines/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * savePhoneLines — Upserts each phone line into SystemSettings.\n * Key format: phone_line_{line.id}\n * Value: JSON.stringify(line)\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n",
    "b": true,
    "l": 54
  },
  {
    "p": "base44/functions/scrapeApprovedContent/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {\n    console.log('[SCRAPE] Starting content scraping pipeline');\n\n    const startTime = Date.now();\n\n    // Fetch approved content that hasn't been scraped yet",
    "b": true,
    "l": 179
  },
  {
    "p": "base44/functions/scrapeJobWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * SCRAPE JOB WORKER\n * \n * Processes queued scraping jobs:\n * 1. Fetch queued job\n * 2. Run Apify actor\n * 3. Parse dataset\n * 4. Store normalized results\n * 5. Update job status\n */\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\n",
    "b": true,
    "l": 524
  },
  {
    "p": "base44/functions/scrapingWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst BATCH_SIZE = 10;\n// Max wait: 10 polls × 5s = 50s, then fire-and-forget to avoid blocking the worker slot\nconst APIFY_POLL_INTERVAL_MS = 5000;\nconst APIFY_MAX_POLLS = 10;\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {",
    "b": true,
    "l": 224
  },
  {
    "p": "base44/functions/searchIntelligence/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Search Intelligence\n * Global intelligence search across people and companies\n * Used for lead mining from historical data\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const {\n      organization_id,\n      persona_tags,\n      industry,",
    "b": true,
    "l": 140
  },
  {
    "p": "base44/functions/seedCreditRates/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst DEFAULT_RATES = [\n  { rate_key: 'plan_starter',    rate_name: 'Starter Plan (monthly)',        credits: 9700,  category: 'platform' },\n  { rate_key: 'plan_growth',     rate_name: 'Growth Plan (monthly)',         credits: 19700, category: 'platform' },\n  { rate_key: 'plan_pro',        rate_name: 'Pro Plan (monthly)',            credits: 29700, category: 'platform' },\n  { rate_key: 'plan_agency',     rate_name: 'Agency Plan (monthly)',         credits: 49700, category: 'platform' },\n  { rate_key: 'plan_enterprise', rate_name: 'Enterprise Plan (monthly)',     credits: 99700, category: 'platform' },\n  { rate_key: 'voice_outbound_per_min', rate_name: 'Outbound Call (per min)', credits: 5,   category: 'voice',    description: 'Per minute of outbound call' },\n  { rate_key: 'voice_inbound_per_min',  rate_name: 'Inbound Call (per min)',  credits: 3,   category: 'voice',    description: 'Per minute of inbound call' },\n  { rate_key: 'voicemail_drop',         rate_name: 'Voicemail Drop',          credits: 2,   category: 'voice',    description: 'Per voicemail drop' },\n  { rate_key: 'ai_autodial_per_min',    rate_name: 'AI Auto-Dial (per min)',  credits: 8,   category: 'voice',    description: 'AI handles full call' },\n  { rate_key: 'sms_outbound',    rate_name: 'Outbound SMS',                  credits: 1,   category: 'sms',      description: 'Per SMS sent' },\n  { rate_key: 'email_outbound',  rate_name: 'Outbound Email',                credits: 1,   category: 'sms',      description: 'Per email sent' },\n  { rate_key: 'lead_score',      rate_name: 'Lead Scoring',                  credits: 1,   category: 'ai',       description: 'Per lead scored' },",
    "b": true,
    "l": 97
  },
  {
    "p": "base44/functions/seedDataSources/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Seed Data Sources Registry\n * Populates DataSource entity with initial sources\n */\n\nconst DATA_SOURCES = [\n  {\n    name: 'youtube_search',\n    display_name: 'YouTube Search',\n    category: 'discovery',\n    platform: 'youtube',\n    description: 'Search YouTube for videos by keywords',\n    apify_actor_id: 'apify/youtube-search-scraper',",
    "b": true,
    "l": 366
  },
  {
    "p": "base44/functions/seedDocumentation/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst SEED_DOCS = [\n  // Getting Started\n  { title: 'Platform Overview', slug: 'platform-overview', category: 'Getting Started', order: 1, content: '# Platform Overview\\n\\nGold Intent is an AI-powered lead intelligence platform...' },\n  { title: 'First Campaign', slug: 'first-campaign', category: 'Getting Started', order: 2, content: '# Creating Your First Campaign\\n\\nGet started with Gold Intent...' },\n  { title: 'Connecting Email', slug: 'connecting-email', category: 'Getting Started', order: 3, content: '# Email Configuration\\n\\nSet up email providers...' },\n  \n  // Leads\n  { title: 'Lead Intelligence', slug: 'lead-intelligence', category: 'Leads', order: 1, content: '# Lead Intelligence\\n\\nUnderstand lead intelligence...' },\n  { title: 'Lead Qualification', slug: 'lead-qualification', category: 'Leads', order: 2, content: '# Qualification Process\\n\\nHow leads are qualified...' },\n  { title: 'Enrichment', slug: 'enrichment', category: 'Leads', order: 3, content: '# Data Enrichment\\n\\nEnriching lead data...' },\n  \n  // Campaigns\n  { title: 'Creating Campaigns', slug: 'creating-campaigns', category: 'Campaigns', order: 1, content: '# Campaign Creation\\n\\nStep-by-step campaign setup...' },",
    "b": true,
    "l": 58
  },
  {
    "p": "base44/functions/seedFeatureFlags/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst FEATURE_FLAGS = [\n  // Discovery Engine\n  { flag_name: 'enable_serper_discovery', description: 'Enable Serper API for discovery', subsystem: 'discovery', affects_workers: true },\n  { flag_name: 'enable_exa_discovery', description: 'Enable Exa search discovery', subsystem: 'discovery', affects_workers: true },\n  { flag_name: 'enable_apify_dataset_discovery', description: 'Enable Apify dataset discovery', subsystem: 'discovery', affects_workers: true },\n  { flag_name: 'enable_directory_scraping', description: 'Enable scraping of online directories', subsystem: 'discovery', affects_workers: true },\n  { flag_name: 'enable_review_site_scraping', description: 'Enable scraping of review websites', subsystem: 'discovery', affects_workers: true },\n  { flag_name: 'enable_news_comment_scraping', description: 'Enable scraping comments from news sites', subsystem: 'discovery', affects_workers: true },\n  { flag_name: 'enable_forum_scraping', description: 'Enable scraping of industry forums', subsystem: 'discovery', affects_workers: true },\n\n  // AI Filtering\n  { flag_name: 'enable_ai_relevance_filter', description: 'Enable AI relevance filtering', subsystem: 'ai_filtering', affects_workers: true, affects_pipeline: true },\n  { flag_name: 'enable_keyword_pre_filter', description: 'Enable keyword pre-filtering before AI scoring', subsystem: 'ai_filtering', affects_workers: true, affects_pipeline: true },",
    "b": true,
    "l": 224
  },
  {
    "p": "base44/functions/seedLeadVerticals/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** Slugs the app expects (Leads UI + Tracerfy). */\nconst EXPECTED_SLUGS = ['solar', 'solar_permit', 'roofing', 'general'] as const;\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n\n  try {\n    const user = await base44.auth.me();\n    const orgId = user?.organization_id;\n    if (!orgId) {\n      return Response.json({ success: false, error: 'No organization_id on user' }, { status: 400 });\n    }\n",
    "b": true,
    "l": 114
  },
  {
    "p": "base44/functions/seedPlans/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst DEFAULT_PLANS = [\n  {\n    plan_id:              'starter',\n    plan_name:            'Starter',\n    monthly_price:        97,\n    onboard_fee:          97,\n    minutes_included:     500,\n    overage_rate_per_min: 0.05,\n    max_concurrent_calls: 2,\n    max_call_duration_min: 30,\n    max_daily_calls:      50,\n    phone_lines_included: 1,\n    phone_lines_max:      3,",
    "b": true,
    "l": 109
  },
  {
    "p": "base44/functions/seedRoleConfigs/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst SYSTEM_ROLES = [\n  {\n    role_id: 'super_admin',\n    role_name: 'Super Admin',\n    description: 'Platform owner. Full access including billing, credits, and rates.',\n    is_system: true,\n    permissions: JSON.stringify([\n      'billing','credits','rates','plans','exemptions',\n      'settings','users','campaigns','leads','contacts',\n      'dialer','reports','admin','super_admin',\n      'all_templates','all_features',\n    ]),\n  },",
    "b": true,
    "l": 116
  },
  {
    "p": "base44/functions/seedVisibilityRules/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nconst DEFAULT_RULES = [\n  {\n    rule_key: 'template_solar_permits',\n    rule_name: 'Solar Permit Campaign Template',\n    allowed_roles: JSON.stringify(['super_admin','admin','superuser']),\n    denied_roles: JSON.stringify(['retail','retail_sub','agent','viewer','leads_only']),\n    category: 'template',\n    description: 'Solar permit scraper + Tracerfy enrichment',\n    is_active: true,\n  },\n  {\n    rule_key: 'template_youtube',\n    rule_name: 'YouTube Keyword Discovery',",
    "b": true,
    "l": 222
  },
  {
    "p": "base44/functions/selfHealingAgent/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/** N-01 FIX: InvokeLLM → aiGateway */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;\n      return true;\n    } catch { return true; }\n  };",
    "b": true,
    "l": 60
  },
  {
    "p": "base44/functions/sendAlert/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  // ── DUAL AUTH: INTERNAL_SECRET or admin user ──\n  const authHeader = req.headers.get('Authorization');\n  const internalSecret = Deno.env.get('INTERNAL_SECRET');\n  const isInternalCall = internalSecret && authHeader === `Bearer ${internalSecret}`;\n\n  if (!isInternalCall) {\n    const base44Temp = createClientFromRequest(req);\n    const user = await base44Temp.auth.me().catch(() => null);",
    "b": true,
    "l": 73
  },
  {
    "p": "base44/functions/sendSMS/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\nimport twilio from 'npm:twilio@5.3.3';\n\n/**\n * SEND SMS\n * Sends SMS/MMS via Twilio with full opt-out checking and campaign tracking.\n */\n\nDeno.serve(async (req: Request) => {\n  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });\n\n  const base44 = createClientFromRequest(req);\n  try {\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });",
    "b": true,
    "l": 165
  },
  {
    "p": "base44/functions/sendSystemEmail/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * sendSystemEmail — sends transactional/system emails via SendGrid.\n *\n * Uses org SystemSettings: sendgrid_api_key, sendgrid_from_email\n *\n * POST body: { to, template_id, dynamic_template_data?, organization_id? }\n */\n\nasync function getSettings(base44, orgId) {\n  const rows = await base44.asServiceRole.entities.SystemSettings\n    .filter({ organization_id: orgId }, '-updated_at', 200)\n    .catch(() => []);\n",
    "b": true,
    "l": 90
  },
  {
    "p": "base44/functions/setMyOrgId/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    \n    const users = await base44.asServiceRole.entities.User\n      .filter({ email: 'chainwavestudios@gmail.com' }, '-created_date', 1);\n    \n    if (!users?.[0]) {\n      return Response.json({ error: 'User not found' }, { status: 404 });\n    }\n",
    "b": true,
    "l": 27
  },
  {
    "p": "base44/functions/setSuperAdmin/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  // Only this specific email can become super_admin\n  const SUPER_ADMIN_EMAIL = 'chainwavestudios@gmail.com';\n  \n  if (user.email !== SUPER_ADMIN_EMAIL) {\n    return Response.json({ \n      error: 'Only the platform owner can become super admin' \n    }, { status: 403 });\n  }",
    "b": true,
    "l": 95
  },
  {
    "p": "base44/functions/setupInstantlyWebhook/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  try {\n    // Resolve real org ID from OrgSeat (user.organization_id may be app ID)\n    let orgId = user.organization_id || '';\n    const APP_ID = '69ac768167fa5ab007eb6ae7';\n    if (orgId === APP_ID && user.email) {\n      const seats = await base44.asServiceRole.entities.OrgSeat\n        .filter({ email: user.email, status: 'active' }, '-created_at', 1)\n        .catch(() => []);",
    "b": true,
    "l": 62
  },
  {
    "p": "base44/functions/simulationEngine/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * SIMULATION ENGINE\n *\n * Dry-runs a campaign pipeline against synthetic leads\n * WITHOUT touching the production database or spending AI budget.\n *\n * Used by: CampaignSimulator.jsx page\n *\n * POST { campaign_id?, lead_count?, niche? }\n */\n\nDeno.serve(async (req: Request) => {\n  if (req.method !== 'POST') {",
    "b": true,
    "l": 61
  },
  {
    "p": "base44/functions/solarDetectionWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;\n      return true;\n    } catch { return true; }\n  };\n  if (!(await checkFlag('enable_solar_detection'))) {\n    return Response.json({ error: `Feature 'enable_solar_detection' is disabled`, flag: 'enable_solar_detection' }, { status: 403 });\n  }",
    "b": true,
    "l": 236
  },
  {
    "p": "base44/functions/sourceWorkerMap/entry.ts",
    "v": "/**\n * Source-to-Worker Mapping\n * Maps frontend data source selections to backend worker functions\n */\n\nexport const sourceWorkerMap = {\n  youtube: 'youtubeSearchWorker',\n  linkedin: 'linkedinSearchWorker',\n  reddit: 'redditSearchWorker',\n  twitter: 'twitterSearchWorker',\n  facebook: 'facebookPostWorker',\n  github: 'githubSearchWorker',\n  product_hunt: 'productHuntSearchWorker',\n};\n",
    "b": true,
    "l": 100
  },
  {
    "p": "base44/functions/spamFilter/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag\n        .filter({ flag_name: flagName }, 'flag_name', 1)\n        .catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;",
    "b": true,
    "l": 84
  },
  {
    "p": "base44/functions/stormIntersectionWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * STORM INTERSECTION WORKER (Aether-Strike)\n *\n * POST Render /storm-intersection → Oracle/OpenAddresses.\n * URL: org setting `render_storm_url` (or env RENDER_STORM_URL), else fallback to Scrappy `render_scraper_url`.\n * NWS DAT damage points → merge, cap, write StormLead, update StormEvent.\n */\n\nconst DAT_BASE =\n  'https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/FeatureServer';\nconst MAX_LEADS = 1000;\n\nfunction bboxFromPolygon(polygon: number[][]): {",
    "b": true,
    "l": 228
  },
  {
    "p": "base44/functions/stuckJobDetector/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * STUCK JOB DETECTOR\n * M-2 FIX: Added cursor-based pagination — previous hard cap of 1,000\n * silently ignored workflows beyond position 1000. Now pages through\n * ALL running workflows in batches of 500.\n */\n\nconst STAGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min\nconst PAGE_SIZE = 500;\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });\n",
    "b": true,
    "l": 86
  },
  {
    "p": "base44/functions/syncConfigToWorkers/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Broadcasts SystemSettings changes to all active workers.\n * Called automatically when admin changes config.\n * \n * Workers must call getConfigValue() to fetch fresh values.\n */\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n\n    if (user?.role !== 'admin') {\n      return Response.json({ error: 'Forbidden' }, { status: 403 });",
    "b": true,
    "l": 50
  },
  {
    "p": "base44/functions/systemAuditReporter/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * SYSTEM AUDIT REPORTER\n * Generates comprehensive system audit report covering:\n * - All backend functions & worker status\n * - Automations & schedules\n * - Entities & data\n * - Feature flags\n * - Front-end components\n * - Integrations & webhooks\n * - Issues & recommendations\n */\n\nDeno.serve(async (req) => {",
    "b": true,
    "l": 206
  },
  {
    "p": "base44/functions/telemetryCollector/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * TELEMETRY COLLECTOR\n *\n * Collects system metrics every 10 seconds.\n * Stores in SystemTelemetry for HealthAnalyzer to consume.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);",
    "b": true,
    "l": 194
  },
  {
    "p": "base44/functions/tracerfyWebhook/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * TRACERFY WEBHOOK\n *\n * Fires when a Tracerfy trace job completes.\n * Webhook payload: { id, pending, download_url, rows_uploaded, credits_deducted, trace_type }\n * Note: field is \"id\" not \"queue_id\" in the webhook body.\n *\n * Flow:\n * 1. Fetch results CSV from download_url\n * 2. For each row, find the matching SolarPermit by uniqueId\n * 3. Update permit with name/phone/email from Tracerfy results\n * 4. Re-evaluate enrichmentStage:\n *    - has firstName + lastName + address + phone + email → 'lead' → create Contact",
    "b": true,
    "l": 427
  },
  {
    "p": "base44/functions/trackCost/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  const checkFlag = async (flagName) => {\n    try {\n      const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ flag_name: flagName }, 'flag_name', 1).catch(() => []);\n      if (flags?.length && flags[0].enabled === false) return false;\n      return true;\n    } catch { return true; }",
    "b": true,
    "l": 153
  },
  {
    "p": "base44/functions/triggerCreditReload/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n\n    // Guard: only super_admin can trigger manual reloads\n    const user = await base44.auth.me().catch(() => null);\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n    const SUPER_ADMIN_EMAIL = 'chainwavestudios@gmail.com';\n    const isOwnerEmail = user?.email === SUPER_ADMIN_EMAIL;\n    const isAdminRole  = user?.role === 'super_admin' || user?.role === 'admin';\n    let   isAdminSeat  = false;\n    if (!isOwnerEmail && !isAdminRole && user?.id) {",
    "b": true,
    "l": 76
  },
  {
    "p": "base44/functions/triggerFunction/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * TRIGGER FUNCTION\n *\n * Manually triggers a backend function for admin execution.\n * Used by FunctionMonitor to trigger workers and maintenance jobs.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);",
    "b": true,
    "l": 102
  },
  {
    "p": "base44/functions/triggerScrappyCampaign/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n    const { campaign } = await req.json();\n    if (!campaign?.id) throw new Error('campaign object with id required');\n\n    const orgId = user.organization_id || '';\n    const getSetting = async (key: string, envFallback: string) => {\n      const r = await base44.asServiceRole.functions\n        .invoke('getOrgSetting', { org_id: orgId, key, env_fallback: envFallback })",
    "b": true,
    "l": 85
  },
  {
    "p": "base44/functions/twilioResponseWebhook/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * INBOUND SMS WEBHOOK\n * Stripped to bare minimum — respond to Twilio fast, hand off processing.\n * \n * DB calls: 3 max (PhoneLine, Contact, SMSLog.create)\n * Everything else → processInboundSMS (fire-and-forget)\n */\n\nconst TWIML_OK = new Response(\n  '<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>',\n  { status: 200, headers: { 'Content-Type': 'text/xml' } }\n);\n",
    "b": true,
    "l": 99
  },
  {
    "p": "base44/functions/twilioSmsStatus/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * TWILIO SMS STATUS CALLBACK\n * Receives delivery status updates from Twilio and updates SMSLog records.\n * Called server-to-server by Twilio — no user auth required.\n */\n\nDeno.serve(async (req) => {\n  try {\n    const url = new URL(req.url);\n    const logId = url.searchParams.get('log');\n\n    if (!logId) {\n      console.warn('twilioSmsStatus: Missing log id in URL params');",
    "b": true,
    "l": 48
  },
  {
    "p": "base44/functions/twilioWebhook/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Validate Twilio X-Twilio-Signature header using HMAC-SHA1.\n */\nasync function validateTwilioSignature(\n  req: Request,\n  formData: URLSearchParams,\n  authToken: string,\n): Promise<boolean> {\n  const signature = req.headers.get('x-twilio-signature');\n  if (!signature) return false;\n\n  const url = req.url;\n  const sortedKeys = [...formData.keys()].sort();",
    "b": true,
    "l": 237
  },
  {
    "p": "base44/functions/twitterDiscoveryWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * TWITTER/X DISCOVERY WORKER\n * \n * Searches Twitter/X for relevant content.\n * Actor: apify~twitter-scraper\n * \n * Extracts:\n * - tweet_text\n * - author\n * - likes\n * - replies\n * \n * Queues: intent_analysis_queue (STAGE 5)",
    "b": true,
    "l": 180
  },
  {
    "p": "base44/functions/twitterReplyWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * TWITTER REPLY WORKER - STAGE 2\n * Scrapes replies from tweets\n * Actor: apidojo/tweet-scraper\n */\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\nconst TWITTER_ACTOR = 'apidojo/tweet-scraper';\n\nasync function runApifyActor(actorId, input, APIFY_TOKEN) {\n  console.log(`[Apify] Starting ${actorId}`);\n  \n  let runId, datasetId;",
    "b": true,
    "l": 163
  },
  {
    "p": "base44/functions/updateCampaignLeadIntelligence/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Update Campaign Lead Intelligence\n * Updates campaign-specific lead scoring and status\n * Called during qualification, enrichment, and analysis stages\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const {\n      organization_id,\n      campaign_lead_id,\n      intent_score,",
    "b": true,
    "l": 86
  },
  {
    "p": "base44/functions/updateCampaignSettings/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * UPDATE CAMPAIGN SETTINGS\n *\n * Updates campaign-specific settings from CampaignSettings entity.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n",
    "b": true,
    "l": 103
  },
  {
    "p": "base44/functions/updateCampaignStatus/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * UPDATE CAMPAIGN STATUS\n *\n * Routes all campaign status changes through backend so budget checks, org validation,\n * and audit logging cannot be bypassed.\n */\n\nconst VALID_STATUSES = ['active', 'paused', 'stopped', 'draft', 'archived'];\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }",
    "b": true,
    "l": 67
  },
  {
    "p": "base44/functions/updateCommentIntelligence/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Update Comment Intelligence\n * Analyzes comments/content and updates Person's AI learning memory\n * Called after comments are scraped and analyzed\n */\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const {\n      organization_id,\n      person_id,\n      persona_tags,",
    "b": true,
    "l": 81
  },
  {
    "p": "base44/functions/updateWorkerWithSafetyLayer/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * EXAMPLE: Intent Worker with Context Safety Layer\n *\n * Shows how to integrate contextSafetyLayer into existing workers.\n *\n * Flow:\n * 1. Gather raw context\n * 2. Pass through contextSafetyLayer\n * 3. Use filtered prompt with aiGateway\n * 4. Process result\n */\n\nDeno.serve(async (req) => {",
    "b": true,
    "l": 177
  },
  {
    "p": "base44/functions/upgradePlan/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\nDeno.serve(async (req: Request) => {\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  \n  // Auth check — inline, no function call dependency\n  const SUPER_ADMIN_EMAIL = 'chainwavestudios@gmail.com';\n  const isOwner = user?.email === SUPER_ADMIN_EMAIL || user?.role === 'super_admin' || user?.role === 'admin';\n  let isAdmin = isOwner;\n  if (!isAdmin && user?.id) {\n    const seats = await base44.asServiceRole.entities.OrgSeat\n      .filter({ user_id: user.id, status: 'active' }, '-created_at', 3).catch(() => []);\n    isAdmin = seats?.some((s: any) => s.role === 'super_admin' || s.role === 'admin') || false;\n  }",
    "b": true,
    "l": 108
  },
  {
    "p": "base44/functions/upsertSetting/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * upsertSetting — saves a per-org setting to SystemSettings.\n *\n * Deletes ALL existing records for this key+org before writing a fresh one.\n * This permanently eliminates the duplicate record problem.\n *\n * POST { key, value, organization_id }\n */\nDeno.serve(async (req: Request) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const body = await req.json();\n    const { key, value, organization_id } = body;",
    "b": true,
    "l": 50
  },
  {
    "p": "base44/functions/validateAIResponse/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * validateAIResponse — validates an AI response against a schema.\n * POST { response: string, schema?: object, strict?: boolean }\n */\nDeno.serve(async (req: Request) => {\n  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);\n  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const { response, schema, strict = false } = await req.json().catch(() => ({}));\n  if (!response) return Response.json({ error: 'response required' }, { status: 400 });\n",
    "b": true,
    "l": 44
  },
  {
    "p": "base44/functions/validateBudget/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * validateBudget — Check if a campaign/org has budget remaining for today.\n * Returns { allowed, remaining_usd, daily_limit, spent_today }\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);\n\n  try {",
    "b": true,
    "l": 51
  },
  {
    "p": "base44/functions/validatePipelineChain/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Validate Pipeline Chain\n * Checks if source1 → source2 is a valid connection\n */\n\nconst VALID_CHAINS = [\n  // YouTube\n  { from: 'youtube_search', to: 'youtube_comments' },\n  { from: 'youtube_search', to: 'youtube_channels' },\n\n  // Reddit\n  { from: 'reddit_search', to: 'reddit_comments' },\n  { from: 'reddit_search', to: 'reddit_subreddits' },",
    "b": true,
    "l": 100
  },
  {
    "p": "base44/functions/validatePlatform/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * Platform Validation Utility\n * Validates that platform selections are supported and registered\n */\n\nconst SUPPORTED_PLATFORMS = ['youtube', 'reddit', 'twitter', 'linkedin', 'facebook'];\n\n/**\n * Validate platform in request\n * @param {string} platform - Platform name to validate\n * @returns {object} { valid: boolean, error?: string }\n */\nfunction validatePlatform(platform) {",
    "b": true,
    "l": 74
  },
  {
    "p": "base44/functions/vectorConsistencyChecker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * VECTOR CONSISTENCY CHECKER\n *\n * Detects vector database corruption:\n * - Duplicate embeddings\n * - Orphaned vectors\n * - Inactive vectors still used\n * - Missing metadata\n *\n * Append-only design: never mutate vectors, mark inactive instead\n */\n\nDeno.serve(async (req) => {",
    "b": true,
    "l": 259
  },
  {
    "p": "base44/functions/vectorIndexRebuild/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * VECTOR INDEX REBUILD\n *\n * Rebuilds vector index once per day.\n * Prevents fragmentation.\n * Removes inactive vectors from index.\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n",
    "b": true,
    "l": 91
  },
  {
    "p": "base44/functions/webhookDispatcher/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * WEBHOOK DISPATCHER\n * C-2 FIX: Added SSRF protection on outbound target_url before every fetch.\n * Re-implements isAllowedWebhookUrl() (same rules as processWebhooks.ts).\n * Any WebhookConfig row pointing to a private/internal URL is blocked + disabled.\n */\n\nfunction isAllowedWebhookUrl(rawUrl: string): { ok: boolean; reason?: string } {\n  let url: URL;\n  try { url = new URL(rawUrl); } catch { return { ok: false, reason: 'Invalid URL' }; }\n  if (url.protocol !== 'https:') return { ok: false, reason: 'Only HTTPS URLs allowed' };\n\n  const h = url.hostname.toLowerCase();",
    "b": true,
    "l": 84
  },
  {
    "p": "base44/functions/workerAutoscaler/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * WORKER AUTOSCALER\n * \n * Dynamically spawns additional workers based on queue depth.\n * \n * Logic:\n * if queue_size > worker_count × 100\n *   → spawn additional worker\n * \n * Max workers per type:\n * - intent_analysis_worker: 50\n * - youtube_comment_worker: 20\n * - youtube_channel_worker: 15",
    "b": true,
    "l": 132
  },
  {
    "p": "base44/functions/workerControl/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * WORKER CONTROL — pauseWorker / resumeWorker / restartWorker\n *\n * Previously MISSING — WorkerControlPanel.jsx called these but no backend existed.\n\n */\n\n// pauseWorker\nexport const pauseWorker = (req: Request) =>\n    const { worker_name } = await req.clone().json().catch(() => ({}));\n    if (!worker_name) return Response.json({ error: 'Missing worker_name' }, { status: 400 });\n\n    const workers = await base44.asServiceRole.entities.WorkerStatus.filter(",
    "b": true,
    "l": 84
  },
  {
    "p": "base44/functions/workerController/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * workerController — dev/test utility to manually trigger a worker loop.\n * In production, workers are driven by globalScheduler → queueDrainer.\n * POST { worker_name?, max_jobs? }\n */\nDeno.serve(async (req: Request) => {\n  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });\n  const base44 = createClientFromRequest(req);\n  const user = await base44.auth.me().catch(() => null);",
    "b": true,
    "l": 23
  },
  {
    "p": "base44/functions/workerHealthMonitor/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n// Unified worker health monitor — replaces both workerHealthMonitor and workerHealthCheck\n// Uses WorkerStatus as the canonical entity (WorkerHealth/WorkerHeartbeat are legacy)\n\nconst HEARTBEAT_TIMEOUT_MINUTES = 10;\nconst DLQ_ALERT_THRESHOLD = 10;\nconst QUEUE_BACKLOG_ALERT = 200;\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }\n\n  const base44 = createClientFromRequest(req);",
    "b": true,
    "l": 111
  },
  {
    "p": "base44/functions/workflowOrchestrator/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * WORKFLOW ORCHESTRATOR\n *\n * Main coordinator for agent workflows.\n * Manages step execution, loop detection, cooldowns, and termination.\n *\n * Flow:\n * Agent Request → Loop Detection Layer → Agent Execution → (repeat)\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });",
    "b": true,
    "l": 145
  },
  {
    "p": "base44/functions/workflowRepairOrchestrator/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * WORKFLOW REPAIR ORCHESTRATOR\n *\n * Main coordinator for self-healing.\n * Calls stuck job detector, healing agent, and executes repair strategy.\n *\n * Flow:\n * Stuck Job Detection → Self-Healing Agent → Execute Repair → Monitor Recovery\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });",
    "b": true,
    "l": 190
  },
  {
    "p": "base44/functions/workflowRetry/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * WORKFLOW RETRY\n *\n * Handles retry with exponential backoff strategy.\n * retry 1 → 30 sec\n * retry 2 → 2 min\n * retry 3 → 5 min\n */\n\nDeno.serve(async (req) => {\n  if (req.method !== 'POST') {\n    return Response.json({ error: 'Method not allowed' }, { status: 405 });\n  }",
    "b": true,
    "l": 96
  },
  {
    "p": "base44/functions/youtubeChannelWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * STAGE 2: YOUTUBE CHANNEL WORKER\n * \n * Processes channel URLs from Stage 1.\n * Calls: apify~youtube-channel-scraper\n * \n * Extracts:\n * - video_url\n * - views\n * - likes\n * - published_date\n * \n * Queues STAGE 3 jobs (youtube_video_worker)",
    "b": true,
    "l": 141
  },
  {
    "p": "base44/functions/youtubeDoubleActorWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * YOUTUBE DOUBLE-ACTOR WORKER\n * \n * Implements the two-phase YouTube discovery pipeline:\n * Phase A: Search for videos using keywords → get video URLs\n * Phase B: Scrape comments from those video URLs\n */\n\nconst APIFY_BASE = 'https://api.apify.com/v2';\nconst POLL_INTERVAL = 5_000;\nconst MAX_POLLS = 180; // 15 min max per phase\n\nfunction makeSetting(base44, orgId) {",
    "b": true,
    "l": 290
  },
  {
    "p": "base44/functions/youtubeSearchWorker/entry.ts",
    "v": "/**\n * YOUTUBE SEARCH WORKER - STAGE 1\n * Searches YouTube videos directly (not channels).\n * Actor: apify~youtube-search-scraper\n * \n * Extracts:\n * - videoId\n * - videoUrl\n * - channelName\n * \n * Queues: youtubeVideoScrapeWorker (STAGE 2)\n */\n\nimport { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n",
    "b": true,
    "l": 146
  },
  {
    "p": "base44/functions/youtubeVideoScrapeWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * YOUTUBE VIDEO SCRAPE WORKER - STAGE 2\n * Scrapes video metadata from search results.\n * Actor: apify~youtube-scraper (with maxComments: 0)\n * \n * Extracts:\n * - videoId\n * - title\n * - description\n * - channelId\n * - viewCount\n * \n * Queues: youtubeVideoWorker (STAGE 3 - normalize & filter)",
    "b": true,
    "l": 140
  },
  {
    "p": "base44/functions/youtubeVideoWorker/entry.ts",
    "v": "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';\n\n/**\n * YOUTUBE VIDEO WORKER - STAGE 3\n * Normalizes video metadata and applies engagement filters.\n * \n * Filters:\n * - min_views (default: 1000)\n * - min_engagement_ratio (default: 0.001)\n * \n * Queues: youtubeCommentWorker (STAGE 4)\n */\n\nDeno.serve(async (req) => {\n  try {",
    "b": true,
    "l": 88
  },
  {
    "p": "docs/AETHER_STRIKE_ENTITIES.md",
    "v": "# Aether-Strike — Base44 entities (manual setup)\n\nCreate these entities in the Base44 app if they do not exist yet. Field types should match your schema editor (string, number, boolean, enum, text).\n\n## `StormEvent`\n\n| Field | Type | Notes |\n| --- | --- | --- |\n| `organization_id` | string | indexed |\n| `campaign_id` | string | indexed, required |\n| `alert_id` | string | indexed — NWS alert id (dedup) |\n| `event_type` | string | e.g. High Wind Warning |\n| `wind_gust_mph` | number | |\n| `polygon_source` | string | `alert_geometry` or `zone_geometry` |\n| `polygon_coordinates` | text | JSON string `[[lon,lat],...]` |",
    "b": true,
    "l": 68
  },
  {
    "p": "docs/ARCHITECTURE.md",
    "v": "# Rosie AI Platform — Architecture\n\n## Stack\n- **Frontend**: React (Vite) + TanStack Query + Tailwind CSS\n- **Backend**: Base44/Deno serverless functions\n- **Database**: Supabase (Postgres + RLS)\n- **AI**: Groq (primary), OpenAI, Gemini, Anthropic (via aiGateway)\n\n---\n\n## Core Systems\n\n### Production Pipeline (Base44 Deno endpoints)\n```\ncampaignExecutionEngine  → enqueueJob → CampaignQueue (Supabase)",
    "b": true,
    "l": 99
  },
  {
    "p": "docs/SCRAPPY_ASSISTANT_CITY_DEVELOPMENT.md",
    "v": "# Scrappy — Assistant guide: new Accela cities (staging / no production DB)\n\nThis document is for a **contractor or assistant** who mirrors the **Scrappy** GitHub repo, uses **Cursor**, and deploys to a **dedicated Render service** for testing.  \n**Goal:** produce `cities/<name>.py` configs that are nearly production-ready, without touching **production Base44** or any production database.\n\n**Staging Render base URL (assistant):** `https://scrapy1.onrender.com`  \n**Production** uses a different URL — never point staging at production secrets.\n\n---\n\n## 1. What you are building\n\n| Deliverable | Where |\n|-------------|--------|\n| New city module | `cities/<city_key>.py` — one or more entries in `CONFIGS = { ... }` |",
    "b": true,
    "l": 309
  },
  {
    "p": "eslint.config.js",
    "v": "import globals from \"globals\";\nimport pluginJs from \"@eslint/js\";\nimport pluginReact from \"eslint-plugin-react\";\nimport pluginReactHooks from \"eslint-plugin-react-hooks\";\nimport pluginUnusedImports from \"eslint-plugin-unused-imports\";\n\nexport default [\n  {\n    files: [\n      \"src/components/**/*.{js,mjs,cjs,jsx}\",\n      \"src/pages/**/*.{js,mjs,cjs,jsx}\",\n      \"src/Layout.jsx\",\n    ],\n    ignores: [\"src/lib/**/*\", \"src/components/ui/**/*\"],\n    ...pluginJs.configs.recommended,",
    "b": true,
    "l": 61
  },
  {
    "p": "postcss.config.js",
    "v": "export default {\n  plugins: {\n    tailwindcss: {},",
    "b": false,
    "l": 7
  },
  {
    "p": "src/App.jsx",
    "v": "import { Toaster } from \"@/components/ui/toaster\"\nimport { Toaster as SonnerToaster } from \"sonner\"\nimport { QueryClientProvider } from '@tanstack/react-query'\nimport { queryClientInstance } from '@/lib/query-client'\nimport { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';\nimport PageNotFound from './lib/PageNotFound';\nimport { AuthProvider, useAuth } from '@/lib/AuthContext';\nimport UserNotRegisteredError from '@/components/UserNotRegisteredError';\nimport React from 'react';\n\n// Page imports\nimport Dashboard from './pages/Dashboard';\nimport Leads from './pages/Leads';\nimport Campaigns from './pages/Campaigns';\nimport Automation from './pages/Automation';",
    "b": true,
    "l": 173
  },
  {
    "p": "src/ENTITY_SCHEMAS_PART1.md",
    "v": "# Entity Schema Documentation - Part 1\n## Entities A-Z (Sections 1-50)\n\n**Total Entities:** 136\n**System Fields on all entities:** id, created_date, updated_date, created_by\n\n---\n\n## 1-50: AdminAuditLog through DiscoverySource\n\n### AdminAuditLog\n- action (string, required, indexed)\n- changed_by (string, required, indexed)\n- organization_id (string, nullable, indexed)\n- old_value, new_value, details, reason (strings)",
    "b": true,
    "l": 201
  },
  {
    "p": "src/ENTITY_SCHEMAS_PART2.md",
    "v": "# Entity Schema Documentation - Part 2\n## Entities 51-100\n\n---\n\n## 51-100: EnrichmentQueue through OrgSeat\n\n### EnrichmentQueue\n- organization_id, campaign_id (indexed), lead_id (indexed)\n- status (default: pending), priority, payload, claim_id\n- claimed_at, processing_started_at, completed_at\n- retry_count, max_retries, last_error, retry_after\n\n### EnrichmentStats\n- provider (indexed), date (indexed, required)",
    "b": true,
    "l": 222
  },
  {
    "p": "src/ENTITY_SCHEMAS_PART3.md",
    "v": "# Entity Schema Documentation - Part 3\n## Entities 101-136 + Summary\n\n---\n\n## 101-136: Person through YoutubeCommentCampaign\n\n### Person\n- organization_id, campaign_id, lead_id\n- full_name, email, phone\n- linkedin_url, twitter_url, title, seniority, department\n- company_id, location, bio, source, source_url\n- enriched (default: false), created_at\n\n### PersonActivity",
    "b": true,
    "l": 312
  },
  {
    "p": "src/Layout.jsx",
    "v": "/**\n * Layout.jsx — Rosie AI App Shell\n * Blue theme, white text, no feature-flag locks, Base44 glow killer.\n */\nimport React, { useState, useEffect, useMemo } from 'react';\nimport { Link } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useFeatureFlag } from '@/components/hooks/useFeatureFlag';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { useVisibility } from '@/hooks/useVisibility';\nimport Dialer from '@/components/dialer/Dialer';\nimport {\n  LayoutDashboard, Users, Megaphone, Cpu, BarChart3,",
    "b": true,
    "l": 694
  },
  {
    "p": "src/api/base44Client.js",
    "v": "import { createClient } from '@base44/sdk';\nimport { appParams } from '@/lib/app-params';\n\nconst { appId, token, functionsVersion, appBaseUrl } = appParams;\n\n//Create a client with authentication required\nexport const base44 = createClient({",
    "b": false,
    "l": 15
  },
  {
    "p": "src/api/entities.js",
    "v": "/**\n * ENTITY ALIASES — Frontend to Backend name mapping\n *\n * M-01: The frontend was using entity names that don't exist on the backend.\n * This file provides a single import point that maps the frontend names\n * to the correct backend entity names.\n *\n * Frontend name        → Backend entity name\n * ─────────────────────────────────────────────\n * Persona              → LeadPersona\n * PipelineEvent        → PipelineLog\n * EnrichmentResult     → EnrichedLead\n * ApiUsageLog          → AISpendLog\n * FeatureFlags         → FeatureFlag   (plural → singular)\n * GlobalSettings       → SystemSettings",
    "b": true,
    "l": 259
  },
  {
    "p": "src/components/AIResponseValidationGuide.jsx",
    "v": "export default function AIResponseValidationGuide() {\n  return (\n    <div className=\"min-h-screen bg-[#0f1117] text-white p-8\">\n      <div className=\"max-w-6xl mx-auto\">\n        <h1 className=\"text-4xl font-bold mb-2 text-amber-400\">AI Response Schema Validation</h1>\n        <p className=\"text-white/60 mb-8\">Prevent corrupt lead scoring with strict LLM output validation</p>\n\n        <div className=\"space-y-8\">\n          {/* Overview */}\n          <section className=\"bg-[#13151c] border border-white/10 rounded-lg p-6\">\n            <h2 className=\"text-2xl font-bold text-amber-400 mb-4\">Overview</h2>\n            <div className=\"space-y-3 text-white/80\">\n              <p><strong>Problem:</strong> LLM responses sometimes contain invalid JSON, missing fields, or out-of-range values that corrupt the Lead database.</p>\n              <p><strong>Solution:</strong> Validate all AI responses against predefined schemas before storing. Retry parse on failure. Discard invalid responses.</p>\n              <div className=\"bg-black/40 p-4 rounded font-mono text-sm\">",
    "b": true,
    "l": 318
  },
  {
    "p": "src/components/ApifyIntegrationGuide.jsx",
    "v": "export default function ApifyIntegrationGuide() {\n  return (\n    <div className=\"min-h-screen bg-[#0f1117] text-white p-8\">\n      <div className=\"max-w-6xl mx-auto\">\n        <h1 className=\"text-4xl font-bold mb-2 text-amber-400\">Apify Run Retry Logic</h1>\n        <p className=\"text-white/60 mb-8\">Resilient data collection with automatic retry & dead letter queue routing</p>\n\n        <div className=\"space-y-8\">\n          {/* Overview */}\n          <section className=\"bg-[#13151c] border border-white/10 rounded-lg p-6\">\n            <h2 className=\"text-2xl font-bold text-amber-400 mb-4\">Overview</h2>\n            <div className=\"space-y-3 text-white/80\">\n              <p><strong>Problem:</strong> Temporary network failures, API rate limits, or transient issues cause Apify runs to fail.</p>\n              <p><strong>Solution:</strong> Automatic retry with exponential backoff (2s → 5s → 10s) + dead letter queue for permanent failures.</p>\n              <div className=\"bg-black/40 p-4 rounded font-mono text-sm\">",
    "b": true,
    "l": 263
  },
  {
    "p": "src/components/FeatureFlagGate.jsx",
    "v": "/**\n * FeatureFlagGate\n * Wraps any page that is gated behind a feature flag.\n * Shows a \"Coming Soon\" screen when the flag is disabled or not found.\n * Admins see a direct link to FeatureFlagsAdmin to enable it.\n *\n * Usage:\n *   <FeatureFlagGate flagName=\"enable_sms_campaigns\" label=\"SMS Campaigns\">\n *     <SMSCampaignsContent />\n *   </FeatureFlagGate>\n */\nimport React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Lock, ArrowLeft, BookOpen, ExternalLink, Zap } from 'lucide-react';",
    "b": true,
    "l": 137
  },
  {
    "p": "src/components/PipelineDiagram.jsx",
    "v": "export default function PipelineDiagram() {\n  return (\n    <div className=\"min-h-screen bg-[#0f1117] p-8 text-white\">\n      <div className=\"max-w-7xl mx-auto\">\n        <h1 className=\"text-3xl font-bold mb-2 text-amber-400\">Campaign Intelligence Pipeline</h1>\n        <p className=\"text-white/60 mb-8\">6-stage deterministic architecture with Apify integration</p>\n\n        {/* Full Pipeline Diagram */}\n        <div className=\"bg-[#13151c] border border-white/10 rounded-lg p-8 mb-8 overflow-x-auto\">\n          <div className=\"min-w-max\">\n            <svg viewBox=\"0 0 1400 400\" className=\"w-full\" style={{ minWidth: '1200px' }}>\n              {/* Stage boxes */}\n              {[\n                { num: 1, title: 'DISCOVERY', y: 50, color: '#f59e0b', desc: 'Platform search\\nYT/LinkedIn/Reddit/Twitter' },\n                { num: 2, title: 'CHANNEL SCRAPE', y: 50, color: '#3b82f6', desc: 'Get channel videos\\nExtract metadata' },",
    "b": true,
    "l": 286
  },
  {
    "p": "src/components/UserNotRegisteredError.jsx",
    "v": "import React from 'react';\n\nconst UserNotRegisteredError = () => {\n  return (\n    <div className=\"flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50\">\n      <div className=\"max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100\">\n        <div className=\"text-center\">\n          <div className=\"inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100\">\n            <svg className=\"w-8 h-8 text-orange-600\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">\n              <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth=\"2\" d=\"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z\" />\n            </svg>\n          </div>\n          <h1 className=\"text-3xl font-bold text-slate-900 mb-4\">Access Restricted</h1>\n          <p className=\"text-slate-600 mb-8\">\n            You are not registered to use this application. Please contact the app administrator to request access.",
    "b": true,
    "l": 32
  },
  {
    "p": "src/components/admin/AICostMonitor.jsx",
    "v": "import { ApiUsageLog } from '@/api/entities';\nimport React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';\n\nconst PROVIDERS = [\n  { id: 'openai', name: 'OpenAI', color: 'from-green-500 to-emerald-600', textColor: 'text-green-400' },\n  { id: 'gemini', name: 'Gemini', color: 'from-blue-500 to-cyan-600', textColor: 'text-blue-400' },\n  { id: 'groq', name: 'Groq', color: 'from-orange-500 to-red-600', textColor: 'text-orange-400' },\n];\n\nexport default function AICostMonitor() {",
    "b": true,
    "l": 360
  },
  {
    "p": "src/components/admin/AICostsDashboard.jsx",
    "v": "import { AICostLog } from '@/api/entities';\nimport React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { DollarSign, TrendingUp } from 'lucide-react';\n\nexport default function AICostsDashboard() {\n  const today = new Date();\n  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);\n  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);\n\n  const todayStr = today.toISOString().split('T')[0];\n  const weekStr = weekAgo.toISOString().split('T')[0];\n  const monthStr = monthAgo.toISOString().split('T')[0];",
    "b": true,
    "l": 259
  },
  {
    "p": "src/components/admin/AISafetyArchitectureGuide.jsx",
    "v": "import React, { useState } from 'react';\nimport { ChevronDown } from 'lucide-react';\n\nconst ARCHITECTURE_GUIDE = [\n  {\n    layer: 1,\n    name: 'Intent Router',\n    description: 'Parse and validate user intent',\n    protects: [],\n    details: 'Extracts intent from user request and routes to appropriate workflow.',\n  },\n  {\n    layer: 2,\n    name: 'Workflow Planner',\n    description: 'Plan execution steps',",
    "b": true,
    "l": 228
  },
  {
    "p": "src/components/admin/AISafetyStackDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { AlertCircle, CheckCircle2, Shield, Zap, AlertTriangle, Lock, Brain, Wrench } from 'lucide-react';\n\nconst LAYERS = [\n  {\n    order: 1,\n    name: 'Intent Router',\n    description: 'Parses user intent',\n    color: 'blue',\n    icon: Brain,\n  },\n  {",
    "b": true,
    "l": 352
  },
  {
    "p": "src/components/admin/AIUsagePanel.jsx",
    "v": "import { AICostLog } from '@/api/entities';\nimport React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';\nimport { AlertTriangle } from 'lucide-react';\n\nexport default function AIUsagePanel() {\n  const today = new Date();\n  const last24h = new Date(today.getTime() - 24 * 60 * 60 * 1000);\n\n  const { data: costLogs = [] } = useQuery({\n    queryKey: ['ai-usage-logs'],\n    queryFn: () =>\n      AICostLog?.filter(",
    "b": true,
    "l": 146
  },
  {
    "p": "src/components/admin/AdminAIControls.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\n\nexport default function AdminAIControls() {\n  const queryClient = useQueryClient();\n  const [settings, setSettings] = useState({});\n\n  const { data: systemSettings = [] } = useQuery({\n    queryKey: ['ai-settings'],\n    queryFn: async () => {\n      const all = await base44.entities.SystemSettings.list('-updated_at', 100);\n      return all.filter(s => s.category === 'ai');",
    "b": true,
    "l": 113
  },
  {
    "p": "src/components/admin/AdminAIDocumentation.jsx",
    "v": "import React from 'react';\n\nexport default function AdminAIDocumentation() {\n  const docs = [\n    {\n      title: 'SYSTEM OVERVIEW',\n      content: `Gold Intent is an automated lead discovery and outreach platform built on a multi-stage AI pipeline.\n\nCore mission: Find high-intent B2B prospects and enable personalized outreach at scale.\n\nKey characteristics:\n  - Fully autonomous data pipeline (discovery → enrichment → outreach)\n  - Real-time intent scoring using multiple AI models\n  - Multi-provider redundancy (Apollo, Hunter, Clay, FindyMail)\n  - Cost-optimized with configurable budgets and thresholds",
    "b": true,
    "l": 280
  },
  {
    "p": "src/components/admin/AdminBillingPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Edit2, Plus, Loader2, Lock, AlertCircle, CheckCircle2, Trash2, X } from 'lucide-react';\nimport { toast } from 'sonner';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport PlanManagementModal from './PlanManagementModal';\nimport SubscriberOverview from './SubscriberOverview';\n\n// ─── Credits Tab ───────────────────────────────────────────────────────────\nfunction CreditsTab() {\n  const { user } = useCurrentUser();\n  const queryClient = useQueryClient();\n  const [issueModal, setIssueModal] = useState(null);\n  const [bufferModal, setBufferModal] = useState(null);",
    "b": true,
    "l": 560
  },
  {
    "p": "src/components/admin/AdminCostControl.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { RefreshCw } from 'lucide-react';\n\nexport default function AdminCostControl() {\n  const queryClient = useQueryClient();\n  const [settings, setSettings] = useState({});\n\n  const { data: systemSettings = [], refetch } = useQuery({\n    queryKey: ['cost-settings'],\n    queryFn: async () => {\n      const all = await base44.entities.SystemSettings.list('-updated_at', 100);",
    "b": true,
    "l": 104
  },
  {
    "p": "src/components/admin/AdminCreditsPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Loader2, X, Save, ChevronDown, ChevronUp,\n  Plus, Shield, AlertTriangle\n} from 'lucide-react';\n\n// ── Shared Modal ──────────────────────────────────────────────\nfunction Modal({ open, onClose, title, children }) {\n  if (!open) return null;\n  return (\n    <div",
    "b": true,
    "l": 848
  },
  {
    "p": "src/components/admin/AdminDashboard.jsx",
    "v": "import { FeatureFlags } from '@/api/entities';\nimport React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery } from '@tanstack/react-query';\nimport { Activity, AlertCircle, Zap, Users, Download, X, CheckCircle2, AlertTriangle } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nfunction SystemAuditDialog({ open, onOpenChange }) {\n  const [auditResult, setAuditResult] = useState(null);\n  const [loading, setLoading] = useState(false);\n\n  const runAudit = async () => {\n    setLoading(true);\n    try {",
    "b": true,
    "l": 332
  },
  {
    "p": "src/components/admin/AdminDataPipeline.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';\n\nconst PIPELINE_STAGES = [\n  'Keyword Discovery',\n  'AI Relevance Filter',\n  'Scraping',\n  'Signal Filtering',\n  'Intent Detection',\n  'Lead Intelligence',\n  'Persona Detection',\n  'Qualification',\n  'Deduplication',",
    "b": true,
    "l": 145
  },
  {
    "p": "src/components/admin/AdminEnrichmentSystem.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { RefreshCw } from 'lucide-react';\n\nexport default function AdminEnrichmentSystem() {\n  const queryClient = useQueryClient();\n  const [settings, setSettings] = useState({});\n\n  const { data: systemSettings = [], refetch } = useQuery({\n    queryKey: ['enrichment-settings'],\n    queryFn: async () => {\n      const all = await base44.entities.SystemSettings.list('-updated_at', 100);",
    "b": true,
    "l": 121
  },
  {
    "p": "src/components/admin/AdminExperiments.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { RefreshCw, TrendingUp, Users, Mail, Target } from 'lucide-react';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';\n\nexport default function AdminExperiments() {\n  const [selectedVariant, setSelectedVariant] = useState(null);\n  const [selectedCampaign, setSelectedCampaign] = useState('all');\n\n  const { data: variants = [], isLoading, refetch } = useQuery({\n    queryKey: ['outreach-variants'],\n    queryFn: () => base44.entities.OutreachVariant.list('-created_at', 100),",
    "b": true,
    "l": 260
  },
  {
    "p": "src/components/admin/AdminFeatureFlags.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { RefreshCw, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';\n\nconst SUBSYSTEMS = [\n  'discovery', 'ai_filtering', 'intent_detection', 'lead_intelligence',\n  'qualification', 'enrichment', 'outreach', 'campaign_automation',\n  'ai_system', 'pipeline', 'autonomous_systems', 'ui_features',\n];\n\nconst SUBSYSTEM_COLORS = {\n  discovery: 'text-blue-400',\n  enrichment: 'text-cyan-400',\n  outreach: 'text-green-400',",
    "b": true,
    "l": 153
  },
  {
    "p": "src/components/admin/AdminLeadQuality.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\n\nexport default function AdminLeadQuality() {\n  const queryClient = useQueryClient();\n  const [settings, setSettings] = useState({});\n\n  const { data: systemSettings = [] } = useQuery({\n    queryKey: ['quality-settings'],\n    queryFn: async () => {\n      const all = await base44.entities.SystemSettings.list('-updated_at', 100);\n      return all.filter(s => s.category === 'quality');",
    "b": true,
    "l": 97
  },
  {
    "p": "src/components/admin/AdminLogs.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\n\nconst LOG_TYPES = [\n  { id: 'scraper', label: 'Scraper Logs' },\n  { id: 'ai', label: 'AI Calls' },\n  { id: 'enrichment', label: 'Enrichment Logs' },\n  { id: 'api', label: 'API Errors' },\n  { id: 'campaign', label: 'Campaign Events' },\n  { id: 'worker', label: 'Worker Crashes' },\n];\n\nexport default function AdminLogs() {\n  const [selectedType, setSelectedType] = useState('scraper');",
    "b": true,
    "l": 101
  },
  {
    "p": "src/components/admin/AdminMissionControl.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport {\n  Activity, AlertCircle, Zap, Users, TrendingUp, Lock, Eye, EyeOff,\n  Loader2, CheckCircle2, AlertTriangle, Clock, Server\n} from 'lucide-react';\nimport CampaignExecutionLog from './CampaignExecutionLog';\n\nconst CRITICAL_SETTINGS = [\n  { key: 'ai_daily_budget', label: 'AI Daily Budget', unit: '$', type: 'number' },\n  { key: 'enrichment_daily_limit', label: 'Enrichment Limit', unit: 'leads', type: 'number' },\n  { key: 'intent_hot_threshold', label: 'Intent HOT Threshold', unit: 'score', type: 'number' },\n  { key: 'intent_warm_threshold', label: 'Intent WARM Threshold', unit: 'score', type: 'number' },\n  { key: 'max_scraping_jobs_per_day', label: 'Max Scraping Jobs', unit: 'jobs', type: 'number' },",
    "b": true,
    "l": 240
  },
  {
    "p": "src/components/admin/AdminOperatorPlaybook.jsx",
    "v": "import React from 'react';\n\nexport default function AdminOperatorPlaybook() {\n  const sections = [\n    {\n      title: 'Campaign Strategy',\n      content: `Choose 1-3 tight target industries.\nUse 2-5 primary keywords per industry.\nSet quality thresholds:\n  - Minimum relevance: 0.7\n  - Minimum intent: 65\n  - Minimum confidence: 0.6\nMonitor lead velocity - 20-50 qualified leads per day is healthy.`,\n    },\n    {",
    "b": true,
    "l": 133
  },
  {
    "p": "src/components/admin/AdminScrapingEngine.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\n\nexport default function AdminScrapingEngine() {\n  const queryClient = useQueryClient();\n  const [settings, setSettings] = useState({});\n\n  const { data: systemSettings = [] } = useQuery({\n    queryKey: ['scraping-settings'],\n    queryFn: async () => {\n      const all = await base44.entities.SystemSettings.list('-updated_at', 100);\n      return all.filter(s => s.category === 'scraping');",
    "b": true,
    "l": 114
  },
  {
    "p": "src/components/admin/AdminSystem.jsx",
    "v": "import React, { useEffect, useState } from 'react';\nimport FunctionMonitor from '@/components/admin/FunctionMonitor';\nimport LiveSystemMonitor from '@/components/admin/LiveSystemMonitor';\n\nexport default function AdminSystem() {\n  return (\n    <div className=\"p-6 space-y-6\">\n      <h1 className=\"text-3xl font-bold text-white\">System Monitor</h1>",
    "b": true,
    "l": 17
  },
  {
    "p": "src/components/admin/AdminSystemHealth.jsx",
    "v": "import React, { useEffect, useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';\n\nexport default function AdminSystemHealth() {\n  const [dbLatency, setDbLatency] = useState(0);\n\n  const { data: currentUser } = useQuery({\n    queryKey: ['current-user'],\n    queryFn: () => base44.auth.me(),\n  });\n\n  const { data: workers = [] } = useQuery({\n    queryKey: ['worker-health'],",
    "b": true,
    "l": 154
  },
  {
    "p": "src/components/admin/AuditLogSystem.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { RefreshCw, ChevronDown, Filter, Download } from 'lucide-react';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';\n\nconst ACTION_COLORS = {\n  'changed_ai_threshold': 'bg-blue-500/20 text-blue-400',\n  'changed_api_limit': 'bg-indigo-500/20 text-indigo-400',\n  'paused_campaign': 'bg-yellow-500/20 text-yellow-400',\n  'resumed_campaign': 'bg-green-500/20 text-green-400',\n  'changed_budget': 'bg-orange-500/20 text-orange-400',\n  'changed_api_key': 'bg-red-500/20 text-red-400',",
    "b": true,
    "l": 406
  },
  {
    "p": "src/components/admin/AutonomousOpsDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { AlertTriangle, CheckCircle2, Zap, Activity, BarChart3, AlertCircle } from 'lucide-react';\nimport { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\n\nexport default function AutonomousOpsDashboard() {\n  const queryClient = useQueryClient();\n\n  // Fetch latest telemetry\n  const { data: telemetries = [] } = useQuery({\n    queryKey: ['system-telemetry'],\n    queryFn: () => base44.entities.SystemTelemetry.filter({}, '-timestamp', 100),\n    refetchInterval: 10000,\n  });",
    "b": true,
    "l": 251
  },
  {
    "p": "src/components/admin/CampaignAutomationPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { Play, Pause } from 'lucide-react';\n\nexport default function CampaignAutomationPanel() {\n  const queryClient = useQueryClient();\n\n  const { data: campaigns = [] } = useQuery({\n    queryKey: ['campaign-automation-list'],\n    queryFn: () => base44.entities.Campaign?.filter({ status: 'active' }, '-created_at', 100).catch(() => []),\n    refetchInterval: 30000,\n  });\n\n  const { data: campaignLeads = [] } = useQuery({",
    "b": true,
    "l": 103
  },
  {
    "p": "src/components/admin/CampaignExecutionLog.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport {\n  Play, AlertCircle, CheckCircle2, Clock, Code, ChevronDown, Search, Filter\n} from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nexport default function CampaignExecutionLog() {\n  const [selectedExecution, setSelectedExecution] = useState(null);\n  const [searchTerm, setSearchTerm] = useState('');\n  const [filterStatus, setFilterStatus] = useState('all');\n\n  const { data: executionLogs = [], isLoading, refetch } = useQuery({\n    queryKey: ['campaign-execution-logs'],",
    "b": true,
    "l": 229
  },
  {
    "p": "src/components/admin/CampaignScalingDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { AlertTriangle, TrendingUp, Users, Zap, Activity } from 'lucide-react';\nimport { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\n\nexport default function CampaignScalingDashboard() {\n  const queryClient = useQueryClient();\n\n  // Fetch scaling metrics\n  const { data: metrics = [] } = useQuery({\n    queryKey: ['scaling-metrics'],\n    queryFn: () => base44.entities.CampaignScalingMetrics.filter({}, '-date', 30),\n    refetchInterval: 60000,\n  });",
    "b": true,
    "l": 271
  },
  {
    "p": "src/components/admin/CostTrackingDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { TrendingUp, AlertTriangle, DollarSign, Zap } from 'lucide-react';\n\nconst COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];\n\nexport default function CostTrackingDashboard() {\n  const today = new Date().toISOString().split('T')[0];\n\n  // Fetch today's cost tracking\n  const { data: todaysCosts = [] } = useQuery({\n    queryKey: ['cost-tracker-today', today],\n    queryFn: () =>",
    "b": true,
    "l": 222
  },
  {
    "p": "src/components/admin/EnrichmentActivityPanel.jsx",
    "v": "import { EnrichmentResult } from '@/api/entities';\nimport React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';\n\nconst PROVIDERS = ['apollo', 'hunter', 'findymail', 'clay'];\n\nexport default function EnrichmentActivityPanel() {\n  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);\n\n  const { data: enrichmentLogs = [] } = useQuery({\n    queryKey: ['enrichment-activity-logs'],\n    queryFn: () =>\n      EnrichmentResult?.filter(",
    "b": true,
    "l": 118
  },
  {
    "p": "src/components/admin/EnrichmentMonitor.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';\n\nconst PROVIDERS = [\n  { id: 'clearbit', name: 'Clearbit', color: 'text-blue-400' },\n  { id: 'apollo', name: 'Apollo', color: 'text-purple-400' },\n  { id: 'linkedin_scraping', name: 'LinkedIn Scraping', color: 'text-cyan-400' },\n  { id: 'internal', name: 'Internal Enrichment', color: 'text-emerald-400' },\n];\n\nexport default function EnrichmentMonitor() {",
    "b": true,
    "l": 311
  },
  {
    "p": "src/components/admin/ErrorMonitoringPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { AlertTriangle, ExternalLink } from 'lucide-react';\n\nexport default function ErrorMonitoringPanel() {\n  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);\n\n  const { data: errorLogs = [] } = useQuery({\n    queryKey: ['error-monitoring-logs'],\n    queryFn: () =>\n      base44.entities.FunctionLog?.filter(\n        { status: 'error', created_at: { $gte: last24h.toISOString() } },\n        '-created_at',\n        100",
    "b": true,
    "l": 64
  },
  {
    "p": "src/components/admin/EventMetricsDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { AlertTriangle, CheckCircle2, RotateCw, AlertCircle, TrendingUp } from 'lucide-react';\n\nexport default function EventMetricsDashboard() {\n  const queryClient = useQueryClient();\n\n  // Fetch today's system events\n  const { data: systemEvents = [] } = useQuery({\n    queryKey: ['system-events'],\n    queryFn: () => base44.entities.SystemEvent.filter({}, '-created_at', 1000),\n    refetchInterval: 30000,\n  });",
    "b": true,
    "l": 297
  },
  {
    "p": "src/components/admin/ExperimentLab.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { RefreshCw, Plus, Play, Pause, Trash2, TrendingUp } from 'lucide-react';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';\n\nconst EXPERIMENT_TYPES = [\n  { id: 'email_subject', label: 'Email Subject Variants', icon: '📧' },\n  { id: 'ai_personalization', label: 'AI Personalization Models', icon: '🤖' },\n  { id: 'intent_scoring', label: 'Intent Scoring Algorithm', icon: '🎯' },\n  { id: 'followup_timing', label: 'Follow-up Timing', icon: '⏱️' },\n];\n",
    "b": true,
    "l": 304
  },
  {
    "p": "src/components/admin/FeatureFlagPanel.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { Search, Filter, ToggleRight, ToggleLeft, Zap, Trash2, AlertTriangle } from 'lucide-react';\nimport { clearFlagCache } from '@/components/hooks/useFeatureFlag';\nimport { toast } from 'sonner';\n\nconst SUBSYSTEMS = [\n  { id: 'all', label: 'All Features' },\n  { id: 'discovery', label: 'Discovery' },\n  { id: 'ai_filtering', label: 'AI Filtering' },\n  { id: 'intent_detection', label: 'Intent Detection' },\n  { id: 'lead_intelligence', label: 'Lead Intelligence' },\n  { id: 'qualification', label: 'Qualification' },\n  { id: 'enrichment', label: 'Enrichment' },",
    "b": true,
    "l": 277
  },
  {
    "p": "src/components/admin/FunctionMonitor.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation } from '@tanstack/react-query';\nimport { AlertCircle, Play, Pause, Loader2, CheckCircle2, XCircle } from 'lucide-react';\n\nconst BACKEND_FUNCTIONS = [\n  // Core Workers\n  { name: 'discoveryWorker', category: 'core-workers', enabled: true, manual_trigger: true },\n  { name: 'intentWorker', category: 'core-workers', enabled: true, manual_trigger: true },\n  { name: 'leadExtractionWorker', category: 'core-workers', enabled: true, manual_trigger: true },\n  { name: 'qualificationWorker', category: 'core-workers', enabled: true, manual_trigger: true },\n  { name: 'leadIntelligenceWorker', category: 'core-workers', enabled: true, manual_trigger: true },\n  // Maintenance\n  { name: 'retryFailedJobs', category: 'maintenance', enabled: true, manual_trigger: true },\n  { name: 'monitorDLQ', category: 'maintenance', enabled: true, manual_trigger: true },",
    "b": true,
    "l": 181
  },
  {
    "p": "src/components/admin/FunctionRegistry.jsx",
    "v": "import React, { useState, useMemo, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  RefreshCw, Search, Play, ChevronDown, ChevronUp,\n  CheckCircle2, AlertCircle, Clock, Loader2, Terminal,\n  Zap, Filter, X, Copy, Check,\n} from 'lucide-react';\n\n// ── Accurate registry built from actual backend functions ────────────────────\nconst FUNCTION_REGISTRY = [\n  // Discovery\n  { name: 'discoverContentFromProviders', category: 'discovery', purpose: 'Execute discovery across all providers', invokable: true },\n  { name: 'runSerperDiscovery',           category: 'discovery', purpose: 'Run Serper.dev search discovery', invokable: true },",
    "b": true,
    "l": 637
  },
  {
    "p": "src/components/admin/LiveSystemMonitor.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Activity, AlertCircle, TrendingUp, Zap } from 'lucide-react';\n\n\nexport default function LiveSystemMonitor() {\n  const { data: currentUser } = useQuery({\n    queryKey: ['current-user'],\n    queryFn: () => base44.auth.me(),\n  });\n\n  const { data: workers = [] } = useQuery({\n    queryKey: ['lsm-workers'],\n    queryFn: () => base44.entities.WorkerStatus",
    "b": true,
    "l": 138
  },
  {
    "p": "src/components/admin/PipelineHealthPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { AlertTriangle, CheckCircle2 } from 'lucide-react';\n\nconst STAGES = [\n  'Discovery', 'Filtering', 'Intent Detection', 'Lead Intelligence',\n  'Qualification', 'Enrichment', 'Outreach', 'Followups',\n];\n\nexport default function PipelineHealthPanel() {\n  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);\n\n  const { data: pipelineLogs = [] } = useQuery({\n    queryKey: ['pipeline-health-logs'],",
    "b": true,
    "l": 81
  },
  {
    "p": "src/components/admin/PipelineVisualizer.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { ChevronRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';\n\nconst PIPELINE_STAGES = [\n  { id: 'discovery', label: 'Discovery', queue: 'DiscoveryQueue', metric: 'leads_discovered' },\n  { id: 'relevance', label: 'Relevance', queue: 'RelevanceQueue', metric: 'relevance_filtered' },\n  { id: 'intent', label: 'Intent', queue: 'IntentQueue', metric: 'intent_analyzed' },\n  { id: 'qualification', label: 'Qualification', queue: 'QualificationQueue', metric: 'leads_qualified' },\n  { id: 'enrichment', label: 'Enrichment', queue: 'EnrichmentQueue', metric: 'leads_enriched' },\n  { id: 'outreach', label: 'Outreach', queue: 'OutreachQueue', metric: 'leads_contacted' },\n  { id: 'followup', label: 'Followup', queue: 'FollowupQueue', metric: 'followup_sent' },\n];\n",
    "b": true,
    "l": 271
  },
  {
    "p": "src/components/admin/PlanManagementModal.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { AlertCircle, Save, Loader2, X } from 'lucide-react';\nimport { toast } from 'sonner';\n\nexport default function PlanManagementModal({ plan, onClose, onSuccess }) {\n  const [formData, setFormData] = useState({\n    plan_name: plan.plan_name || '',\n    monthly_price: plan.monthly_price || 0,\n    onboard_fee: plan.onboard_fee || 0,\n    phone_line_monthly_fee: plan.phone_line_monthly_fee || 0,\n    minutes_included: plan.minutes_included || 0,\n    overage_rate_per_min: plan.overage_rate_per_min || 0,\n    max_concurrent_calls: plan.max_concurrent_calls || 0,\n    max_call_duration_min: plan.max_call_duration_min || 0,",
    "b": true,
    "l": 252
  },
  {
    "p": "src/components/admin/QueueMonitor.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { toast } from 'sonner';\nimport { Input } from '@/components/ui/input';\nimport { RefreshCw, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';\n\nconst QUEUE_TYPES = [\n  'DiscoveryQueue',\n  'IntentQueue',\n  'QualificationQueue',\n  'IntelligenceQueue',\n  'OutreachQueue',\n  'FollowupQueue',",
    "b": true,
    "l": 324
  },
  {
    "p": "src/components/admin/QueueMonitorDetailed.jsx",
    "v": "import React, { useMemo, useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  AlertTriangle, CheckCircle2, Clock, Zap, Trash2, RotateCw,\n  Pause, Play, RefreshCw, Loader2,\n} from 'lucide-react';\n\nconst QUEUE_NAMES = [\n  'DiscoveryQueue', 'IntentQueue', 'QualificationQueue',\n  'EnrichmentQueue', 'OutreachQueue', 'FollowupQueue', 'DeadLetterQueue',\n];\n",
    "b": true,
    "l": 227
  },
  {
    "p": "src/components/admin/QueueMonitoringPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { AlertTriangle, CheckCircle2 } from 'lucide-react';\n\nconst QUEUES = [\n  'DiscoveryQueue', 'FilteringQueue', 'IntentQueue', 'IntelligenceQueue',\n  'QualificationQueue', 'EnrichmentQueue', 'OutreachQueue', 'FollowupQueue',\n  'RetryQueue', 'DeadLetterQueue',\n];\n\nexport default function QueueMonitoringPanel() {\n  const queueQueries = QUEUES.map((queueName) =>\n    useQuery({\n      queryKey: [`queue-monitoring-${queueName}`],",
    "b": true,
    "l": 108
  },
  {
    "p": "src/components/admin/QueuePriorityDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';\n\nconst QUEUE_INFO = [\n  { name: 'OutreachQueue', priority: 1, color: '#ef4444', icon: '📤' },\n  { name: 'FollowupQueue', priority: 2, color: '#f59e0b', icon: '↩️' },\n  { name: 'QualificationQueue', priority: 3, color: '#eab308', icon: '✓' },\n  { name: 'IntentQueue', priority: 4, color: '#06b6d4', icon: '💡' },\n  { name: 'DiscoveryQueue', priority: 5, color: '#8b5cf6', icon: '🔍' },\n];\n\nexport default function QueuePriorityDashboard() {",
    "b": true,
    "l": 211
  },
  {
    "p": "src/components/admin/SubscriberOverview.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { AlertCircle, Edit2, RefreshCw, Loader2, Zap, Building2, User, Mail, Shield, CreditCard } from 'lucide-react';\nimport { toast } from 'sonner';\nimport UpgradePlanModal from './UpgradePlanModal';\n\nconst STATUS_STYLES = {\n  active:    'bg-green-500/15 text-green-400 border-green-500/25',\n  suspended: 'bg-red-500/15 text-red-400 border-red-500/25',\n  cancelled: 'bg-white/10 text-white/40 border-white/10',\n  grace:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',\n};\n",
    "b": true,
    "l": 328
  },
  {
    "p": "src/components/admin/SystemAuditDialog.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { Download, X, AlertCircle, CheckCircle2, AlertTriangle, HelpCircle, RefreshCw, Database, Key, Wifi, Cpu, List, DollarSign, Flag } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nconst CATEGORY_META = {\n  database:     { label: 'Database',      icon: Database },\n  api_keys:     { label: 'API Keys',      icon: Key },\n  connectivity: { label: 'Live Connectivity', icon: Wifi },\n  workers:      { label: 'Workers',       icon: Cpu },\n  queues:       { label: 'Queues',        icon: List },\n  budget:       { label: 'AI Budget',     icon: DollarSign },\n  config:       { label: 'Config',        icon: Flag },\n};\n",
    "b": true,
    "l": 228
  },
  {
    "p": "src/components/admin/SystemAuditReport.jsx",
    "v": "import React, { useState } from 'react';\nimport { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';\n\nexport default function SystemAuditReport() {\n  const [expanded, setExpanded] = useState({});\n\n  const sections = [\n    {\n      id: 'critical',\n      title: '🔴 CRITICAL ISSUES',\n      color: 'text-red-400',\n      items: [\n        { item: 'New Campaign Button', status: 'BROKEN', issue: 'No createCampaign handler', location: 'pages/Campaigns.jsx:32-34' },\n        { item: 'Campaign Settings Button', status: 'BROKEN', issue: 'No updateCampaignSettings handler', location: 'pages/Campaigns.jsx:77-79' },\n        { item: 'Campaign Creation Dialog', status: 'MISSING', issue: 'UI component does not exist', location: 'components/campaign/*' },",
    "b": true,
    "l": 201
  },
  {
    "p": "src/components/admin/SystemHealthDashboard.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { RefreshCw, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';\nimport WorkerDetailModal from './WorkerDetailModal';\n\n\n\nconst getStatusColor = (status, avgRuntime, errorRate) => {\n  if (status === 'error' || errorRate > 0.1) return { color: 'text-red-400', bg: 'bg-red-500/15', label: 'Failing' };\n  if (avgRuntime > 5000 || status === 'slow') return { color: 'text-yellow-400', bg: 'bg-yellow-500/15', label: 'Slow' };\n  if (status === 'healthy' || status === 'idle') return { color: 'text-green-400', bg: 'bg-green-500/15', label: 'Healthy' };",
    "b": true,
    "l": 249
  },
  {
    "p": "src/components/admin/SystemPerformancePanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { TrendingUp } from 'lucide-react';\n\nexport default function SystemPerformancePanel() {\n  const last60min = new Date(Date.now() - 60 * 60 * 1000);\n\n  const { data: functionLogs = [] } = useQuery({\n    queryKey: ['system-performance-logs'],\n    queryFn: () =>\n      base44.entities.FunctionLog?.filter(\n        { created_at: { $gte: last60min.toISOString() } },\n        '-created_at',\n        10000",
    "b": true,
    "l": 134
  },
  {
    "p": "src/components/admin/UpgradePlanModal.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { AlertCircle, Loader2, X } from 'lucide-react';\nimport { toast } from 'sonner';\n\nexport default function UpgradePlanModal({ orgPackage, onClose, onSuccess }) {\n  const [selectedPlanId, setSelectedPlanId] = useState(null);\n  const [upgrading, setUpgrading] = useState(false);\n\n  const { data: plans = [] } = useQuery({\n    queryKey: ['plans-active'],\n    queryFn: () => base44.entities.Plan\n      .filter({ is_active: true }, 'display_order', 100)\n      .catch(() => []),",
    "b": true,
    "l": 128
  },
  {
    "p": "src/components/admin/VectorHealthDashboard.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { AlertTriangle, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';\n\nexport default function VectorHealthDashboard() {\n  const queryClient = useQueryClient();\n\n  // Fetch latest consistency report\n  const { data: latestReport } = useQuery({\n    queryKey: ['vector-report'],\n    queryFn: () => base44.entities.VectorConsistencyReport.filter({}, '-scan_timestamp', 1),\n    refetchInterval: 60000,\n  });\n",
    "b": true,
    "l": 210
  },
  {
    "p": "src/components/admin/WorkerActivityPanel.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  CheckCircle2, AlertCircle, Clock, Pause, Play, RotateCcw,\n  RefreshCw, Loader2, Activity, Cpu, Zap, ChevronDown, ChevronUp,\n} from 'lucide-react';\n\nconst WORKERS = [\n  // Discovery\n  { name: 'discoveryWorker',          group: 'Discovery',   queue: 'discovery' },\n  { name: 'redditDiscoveryWorker',    group: 'Discovery',   queue: 'discovery' },\n  { name: 'linkedinDiscoveryWorker',  group: 'Discovery',   queue: 'discovery' },",
    "b": true,
    "l": 310
  },
  {
    "p": "src/components/admin/WorkerDetailModal.jsx",
    "v": "import React, { useState } from 'react';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';\nimport { Button } from '@/components/ui/button';\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';\nimport { AlertCircle, CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronRight, Copy, Trash2 } from 'lucide-react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { formatDistanceToNow } from 'date-fns';\nimport { toast } from 'sonner';\n\nfunction JsonExpander({ data, label }) {\n  const [open, setOpen] = useState(false);\n  if (!data) return <span className=\"text-white/25 italic\">null</span>;\n  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);\n  return (",
    "b": true,
    "l": 339
  },
  {
    "p": "src/components/admin/WorkflowHealthDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { AlertTriangle, CheckCircle2, Zap, Clock, RotateCw, AlertCircle } from 'lucide-react';\n\nconst STAGE_COLORS = {\n  discovery: '#3b82f6',\n  intent: '#10b981',\n  qualification: '#f59e0b',\n  enrichment: '#8b5cf6',\n  outreach: '#ef4444',\n  followup: '#06b6d4',\n};\n",
    "b": true,
    "l": 245
  },
  {
    "p": "src/components/admin/sections/AllUsersSection.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Search, Shield, Loader2, Gift, ChevronDown, ChevronUp,\n  CreditCard, UserCog, X, Mail, Hash,\n} from 'lucide-react';\n\nconst ROLE_COLORS = {\n  super_admin:         'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',\n  admin:               'bg-purple-500/20 text-purple-300 border-purple-500/30',\n  superuser:           'bg-blue-500/20 text-blue-300 border-blue-500/30',\n  retail:              'bg-green-500/20 text-green-300 border-green-500/30',",
    "b": true,
    "l": 366
  },
  {
    "p": "src/components/admin/sections/DLQSection.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Loader2, RotateCcw, Trash2 } from 'lucide-react';\nimport { toast } from 'sonner';\n\nexport default function DLQSection() {\n  const queryClient = useQueryClient();\n  const [retrying, setRetrying] = useState(null);\n  const [purgingAll, setPurgingAll] = useState(false);\n\n  const { data: dlqItems = [], isLoading } = useQuery({\n    queryKey: ['dlq'],\n    queryFn: () => adminQuery.entities.DeadLetterQueue.list('-created_date', 500).catch(() => []),",
    "b": true,
    "l": 108
  },
  {
    "p": "src/components/admin/sections/DeveloperToolsSection.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport {\n  Loader2, Play, AlertCircle, CheckCircle2, RefreshCw,\n  Database, Flag, Eye, Shield, Users, Zap, Activity,\n  Clock, ChevronDown, ChevronUp,\n} from 'lucide-react';\nimport { toast } from 'sonner';\n\nfunction timeAgo(iso) {\n  if (!iso) return null;\n  const diff = Date.now() - new Date(iso).getTime();\n  const m = Math.floor(diff / 60000);\n  const h = Math.floor(diff / 3600000);",
    "b": true,
    "l": 400
  },
  {
    "p": "src/components/admin/sections/KillSwitchSection.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Loader2, PowerOff, CheckCircle2,\n  AlertTriangle, Save, Shield\n} from 'lucide-react';\n\nexport default function KillSwitchSection() {\n  const queryClient = useQueryClient();\n  const [activating, setActivating] = useState(false);\n  const [deactivating, setDeactivating] = useState(false);\n  const [savingPolicy, setSavingPolicy] = useState(false);",
    "b": true,
    "l": 324
  },
  {
    "p": "src/components/admin/sections/OrganizationsSection.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Loader2, ChevronDown, ChevronUp, Building2,\n  Mail, CreditCard, Users, X, CheckCircle2,\n} from 'lucide-react';\n\nfunction Modal({ open, onClose, title, children }) {\n  if (!open) return null;\n  return (\n    <div className=\"fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4\" onClick={onClose}>\n      <div className=\"bg-[#13151c] border border-white/10 rounded-2xl p-6 w-full max-w-md\" onClick={e => e.stopPropagation()}>",
    "b": true,
    "l": 289
  },
  {
    "p": "src/components/admin/sections/PermitCampaignsSection.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Loader2, Play, Eye } from 'lucide-react';\nimport { toast } from 'sonner';\nimport { useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\n\nexport default function PermitCampaignsSection() {\n  const queryClient = useQueryClient();\n  const navigate = useNavigate();\n  const [running, setRunning] = useState(null);\n\n  const { data: campaigns = [], isLoading } = useQuery({",
    "b": true,
    "l": 104
  },
  {
    "p": "src/components/admin/sections/PlansSection.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery } from '@tanstack/react-query';\nimport { Loader2, Plus, Edit2, AlertTriangle } from 'lucide-react';\nimport PlanManagementModal from '@/components/admin/PlanManagementModal';\n\nexport default function PlansSection() {\n  const [showNewPlanModal, setShowNewPlanModal] = useState(false);\n  const [editingPlan, setEditingPlan] = useState(null);\n\n  const { data: plans = [], isLoading } = useQuery({\n    queryKey: ['plans'],\n    queryFn: () => adminQuery.entities.Plan.list('-display_order', 500).catch(() => []),\n  });",
    "b": true,
    "l": 97
  },
  {
    "p": "src/components/admin/sections/RolesVisibilitySection.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Loader2, Edit2, Plus, Save, ToggleLeft, ToggleRight, Eye } from 'lucide-react';\nimport { toast } from 'sonner';\n\nconst ALL_ROLES = [\n  { id: 'super_admin', label: 'Super Admin', desc: 'Full platform access including billing' },\n  { id: 'admin',       label: 'Admin',       desc: 'Full app access, no billing controls' },\n  { id: 'superuser',   label: 'Super User',  desc: 'Advanced discovery + solar pipeline' },\n  { id: 'retail',      label: 'Retail',      desc: 'Default signup role — basic discovery' },\n  { id: 'retail_sub',  label: 'Retail Sub',  desc: 'Minimal access — YouTube/Reddit only' },\n  { id: 'agent',       label: 'Agent',       desc: 'Dialer + leads + contacts only' },\n  { id: 'viewer',      label: 'Viewer',      desc: 'Read-only leads and reports' },",
    "b": true,
    "l": 398
  },
  {
    "p": "src/components/admin/sections/TeamSeatsSection.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { adminQuery } from '@/lib/adminQuery';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Loader2, Search, UserCog, Ban,\n  CheckCircle2, Trash2, X\n} from 'lucide-react';\n\nconst ROLE_COLORS = {\n  super_admin: 'bg-yellow-500/20 text-yellow-300',\n  admin:       'bg-purple-500/20 text-purple-300',\n  superuser:   'bg-blue-500/20 text-blue-300',\n  owner:       'bg-blue-500/20 text-blue-300',",
    "b": true,
    "l": 319
  },
  {
    "p": "src/components/ai/MessageBubble.jsx",
    "v": "import { useState } from 'react';\nimport ReactMarkdown from 'react-markdown';\nimport { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock } from 'lucide-react';\n\nconst FunctionDisplay = ({ toolCall }) => {\n  const [expanded, setExpanded] = useState(false);\n  const name = toolCall?.name || 'Function';\n  const status = toolCall?.status || 'pending';\n  const results = toolCall?.results;\n\n  const parsedResults = (() => {\n    if (!results) return null;\n    try { return typeof results === 'string' ? JSON.parse(results) : results; }\n    catch { return results; }\n  })();",
    "b": true,
    "l": 127
  },
  {
    "p": "src/components/billing/PhoneLinesManager.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport {\n  Phone, Plus, Trash2, Edit2, Check, X, AlertCircle,\n  Loader2, CheckCircle2, MessageSquare, PhoneCall, RefreshCw,\n} from 'lucide-react';\nimport { toast } from 'sonner';\n\nconst TYPE_OPTIONS = [\n  { value: 'both',  label: 'Voice + SMS',   icon: PhoneCall,     color: 'text-blue-400',   bg: 'bg-blue-500/10',  border: 'border-blue-500/20' },\n  { value: 'call',  label: 'Voice Only',    icon: PhoneCall,     color: 'text-green-400',  bg: 'bg-green-500/10', border: 'border-green-500/20' },\n  { value: 'sms',   label: 'SMS Only',      icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10',border: 'border-purple-500/20' },\n];\n",
    "b": true,
    "l": 414
  },
  {
    "p": "src/components/billing/SMSSetup.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { AlertCircle, Loader2, Check, RefreshCw } from 'lucide-react';\n\nexport default function SMSSetup({ user }) {\n  const [accountSid, setAccountSid]     = useState('');\n  const [authToken, setAuthToken]       = useState('');\n  const [loading, setLoading]           = useState(false);\n  const [checking, setChecking]         = useState(true);  // checking existing creds on mount\n  const [phoneNumbers, setPhoneNumbers] = useState([]);\n  const [selectedNumber, setSelectedNumber] = useState(null);\n  const [selectingNumber, setSelectingNumber] = useState(false);\n  const [error, setError]               = useState('');\n  const [success, setSuccess]           = useState(false);\n  const [reconfigure, setReconfigure]   = useState(false);",
    "b": true,
    "l": 253
  },
  {
    "p": "src/components/billing/UsageCard.jsx",
    "v": "import React from 'react';\nimport { AlertCircle, TrendingUp } from 'lucide-react';\n\nexport default function UsageCard({ orgPackage }) {\n  if (!orgPackage) {\n    return (\n      <div className=\"bg-[#10121a] border border-white/5 rounded-2xl p-6 text-center\">\n        <p className=\"text-sm text-white/30\">No active plan found</p>\n      </div>\n    );\n  }\n\n  const minutesIncluded = orgPackage.minutes_included || 0;\n  const minutesUsed = orgPackage.minutes_used_this_month || 0;\n  const pctUsed = minutesIncluded > 0 ? (minutesUsed / minutesIncluded) * 100 : 0;",
    "b": true,
    "l": 121
  },
  {
    "p": "src/components/campaign/AddCampaignModal.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQueryClient } from '@tanstack/react-query';\nimport { X, CheckCircle, Loader2 } from 'lucide-react';\n\nexport default function AddCampaignModal({ onClose, onSave }) {\n  const queryClient = useQueryClient();\n  const [form, setForm] = useState({\n    name: '',\n    automation_behavior: 'stop_on_response',\n    copy_from: null,\n    copy_type: null, // 'campaign' or 'template'\n  });\n\n  const createMutation = useMutation({",
    "b": true,
    "l": 184
  },
  {
    "p": "src/components/campaign/AddEventModal.jsx",
    "v": "import React, { useState } from 'react';\nimport { X, MessageSquare, Mail, Mic, Plus } from 'lucide-react';\n\nconst EVENT_TYPES = [\n  { id: 'sms', label: 'SMS', icon: MessageSquare },\n  { id: 'email', label: 'Email', icon: Mail },\n  { id: 'voice', label: 'Voice', icon: Mic },\n];\n\nconst SHORTCODES = ['{{FirstName}}', '{{LastName}}', '{{AssigneeFirstName}}', '{{AssigneeLastName}}', '{{CompanyName}}'];\n\nexport default function AddEventModal({ event, selectedDay, onClose, onSave }) {\n  const [tab, setTab] = useState('settings');\n  const [form, setForm] = useState(event || {\n    name: '',",
    "b": true,
    "l": 235
  },
  {
    "p": "src/components/campaign/AutomationControls.jsx",
    "v": "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Switch } from '@/components/ui/switch';\nimport { Label } from '@/components/ui/label';\n\nconst WORKERS = [\n  { key: 'discovery_enabled', label: 'Discovery Worker' },\n  { key: 'analysis_enabled', label: 'Relevance Worker' },\n  { key: 'scraping_enabled', label: 'Scraping Worker' },\n  { key: 'lead_extraction_enabled', label: 'Lead Extraction Worker' },\n  { key: 'intent_enabled', label: 'Intent Worker' },\n  { key: 'enrichment_enabled', label: 'Enrichment Worker' },\n  { key: 'outreach_enabled', label: 'Outreach Worker' },\n];\n\nexport default function AutomationControls({ campaign }) {",
    "b": true,
    "l": 31
  },
  {
    "p": "src/components/campaign/CampaignAnalytics.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nexport default function CampaignAnalytics({ campaign }) {\n  const { data: metrics = [], isLoading } = useQuery({\n    queryKey: ['campaign-metrics', campaign.id],\n    queryFn: () => \n      base44.entities.UsageMetrics.filter({ campaign_id: campaign.id }, '-date', 30),\n  });\n\n  if (isLoading) return <CardSkeleton />;\n",
    "b": true,
    "l": 83
  },
  {
    "p": "src/components/campaign/CampaignCreatorWizard.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { X, ChevronRight, ChevronLeft, MessageSquare, Mail, Mic, Check } from 'lucide-react';\nimport CampaignTimeline from './CampaignTimeline';\n\nconst CAMPAIGN_TYPES = [\n  { id: 'drip', label: 'Drip Sequence', desc: 'Scheduled messages over multiple days', icon: '📅' },\n  { id: 'broadcast', label: 'Broadcast', desc: 'One-time send to all enrolled contacts', icon: '📢' },\n  { id: 'auto_reply', label: 'Auto-Reply', desc: 'Triggered response to inbound messages', icon: '🤖' },\n  { id: 're_engagement', label: 'Re-engagement', desc: 'Targets contacts with no recent activity', icon: '🔄' },\n];\n\nconst AUTOMATION_BEHAVIORS = [",
    "b": true,
    "l": 418
  },
  {
    "p": "src/components/campaign/CampaignPreferencesModal.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  X, Bell, Users, Clock, Filter as FilterIcon, Zap, Trash2, Plus, ChevronDown, AlertTriangle, Phone\n} from 'lucide-react';\nimport PhoneLinesManager from './PhoneLinesManager';\n\nconst TIMEZONES = [\n  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time' },\n  { value: 'America/Chicago', label: '(UTC-06:00) Central Time' },\n  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time' },\n  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time (Los Angeles)' },",
    "b": true,
    "l": 828
  },
  {
    "p": "src/components/campaign/CampaignProgressPanel.jsx",
    "v": "import React, { useState, useEffect, useRef } from 'react';\nimport { Card } from '@/components/ui/card';\nimport { base44 } from '@/api/base44Client';\nimport { Activity, AlertCircle, CheckCircle2, Clock, WifiOff } from 'lucide-react';\nimport { useQuery } from '@tanstack/react-query';\n\nexport default function CampaignProgressPanel({ campaignId }) {\n  const [progress, setProgress] = useState({\n    status: 'idle',\n    channels_found: 0,\n    videos_scraped: 0,\n    comments_processed: 0,\n    leads_detected: 0,\n    errors: 0,\n    last_update: null,",
    "b": true,
    "l": 155
  },
  {
    "p": "src/components/campaign/CampaignSettings.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { Loader2 } from 'lucide-react';\n\nexport default function CampaignSettings({ campaign, campaignSettings }) {\n  const queryClient = useQueryClient();\n  const [settings, setSettings] = useState({\n    intent_hot_threshold: campaignSettings?.intent_hot_threshold || 85,\n    intent_warm_threshold: campaignSettings?.intent_warm_threshold || 65,\n    intent_cold_threshold: campaignSettings?.intent_cold_threshold || 45,\n    max_enrichment_cost_per_lead: campaignSettings?.max_enrichment_cost_per_lead || 5,\n    email_verification_required: campaignSettings?.email_verification_required ?? true,",
    "b": true,
    "l": 365
  },
  {
    "p": "src/components/campaign/CampaignStatusCard.jsx",
    "v": "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Badge } from '@/components/ui/badge';\n\nexport default function CampaignStatusCard({ campaign }) {\n  return (\n    <Card>\n      <CardHeader>\n        <CardTitle>{campaign.name}</CardTitle>\n      </CardHeader>\n      <CardContent className=\"space-y-4\">\n        <div className=\"grid grid-cols-2 gap-4\">\n          <div>\n            <p className=\"text-sm text-gray-500\">Status</p>\n            <Badge\n              variant={campaign.status === 'active' ? 'default' : 'secondary'}",
    "b": true,
    "l": 65
  },
  {
    "p": "src/components/campaign/CampaignTemplates.jsx",
    "v": "import React, { useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport { Zap, Youtube, Linkedin, MessageCircle, Twitter, Facebook, ArrowRight, Lock, ChevronDown, ChevronUp } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport { useVisibility } from '@/hooks/useVisibility';\n\n// ── Platform icons / colors ────────────────────────────────────────────────\nconst PLATFORM_META = {\n  youtube:  { icon: Youtube,        color: 'text-red-400',    bg: 'bg-red-500/10',    label: 'YouTube' },\n  reddit:   { icon: MessageCircle,  color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Reddit' },\n  linkedin: { icon: Linkedin,       color: 'text-blue-400',   bg: 'bg-blue-500/10',   label: 'LinkedIn' },\n  twitter:  { icon: Twitter,        color: 'text-sky-400',    bg: 'bg-sky-500/10',    label: 'Twitter/X' },\n  facebook: { icon: Facebook,       color: 'text-blue-500',   bg: 'bg-blue-600/10',   label: 'Facebook' },\n};",
    "b": true,
    "l": 521
  },
  {
    "p": "src/components/campaign/CampaignTimeline.jsx",
    "v": "import React, { useState } from 'react';\nimport { Plus, Trash2, MoreVertical, MessageSquare, Mail, Mic } from 'lucide-react';\nimport AddEventModal from './AddEventModal';\n\nconst EVENT_TYPE_ICONS = {\n  sms: MessageSquare,\n  email: Mail,\n  voice: Mic,\n};\n\nexport default function CampaignTimeline({ events, setEvents, editable = true }) {\n  const [showAddEvent, setShowAddEvent] = useState(false);\n  const [editingEvent, setEditingEvent] = useState(null);\n  const [selectedDay, setSelectedDay] = useState(0);\n",
    "b": true,
    "l": 154
  },
  {
    "p": "src/components/campaign/CampaignTypeSelector.jsx",
    "v": "import React from 'react';\nimport { Youtube, Zap } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nexport default function CampaignTypeSelector({ onSelect }) {\n  return (\n    <div className=\"min-h-screen bg-[#0f1117] p-6 flex items-center justify-center\">\n      <div className=\"max-w-2xl w-full\">\n        <div className=\"mb-12 text-center\">\n          <h1 className=\"text-4xl font-bold text-white mb-2\">Choose Campaign Type</h1>\n          <p className=\"text-white/60\">Select what kind of campaign you want to create</p>\n        </div>\n\n        <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">\n          {/* Lead Gen */}",
    "b": true,
    "l": 54
  },
  {
    "p": "src/components/campaign/CreateCampaignDialog.jsx",
    "v": "import React from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\n\nexport default function CreateCampaignDialog({ open, onOpenChange }) {\n  const navigate = useNavigate();\n\n  if (!open) return null;\n\n  const handleNavigate = () => {\n    onOpenChange(false);\n    navigate(createPageUrl('CampaignBuilder'));\n  };\n\n  return (",
    "b": true,
    "l": 39
  },
  {
    "p": "src/components/campaign/DiscoveryTab.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Wind, Radar, MapPin, CheckCircle2,\n  Zap, RefreshCw, Play, Shield,\n  ChevronDown, ChevronRight, Activity, Target,\n} from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nfunction PriorityBadge({ priority }) {\n  return priority === 1 ? (\n    <span className=\"text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20\">\n      DAT P1",
    "b": true,
    "l": 345
  },
  {
    "p": "src/components/campaign/EnrolledLeads.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nexport default function EnrolledLeads({ campaign }) {\n  const { data: leads = [], isLoading } = useQuery({\n    queryKey: ['campaign-leads', campaign.id],\n    queryFn: () => \n      base44.entities.Lead.filter({ campaign_id: campaign.id }, '-created_at', 100),\n  });\n\n  if (isLoading) return <CardSkeleton />;\n",
    "b": true,
    "l": 55
  },
  {
    "p": "src/components/campaign/PermitCampaignModal.jsx",
    "v": "import React, { useState, useMemo, useRef, useEffect } from 'react';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { X, Loader2, Download, Sun } from 'lucide-react';\nimport { dedupeScrappyCities } from '@/lib/permitScraper';\n\nconst DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];\n\n/** Used when getScrappyCities fails — keys must match Scrappy `cities/*.py` CONFIGS (custom detail: `cities/detail_registry.py`). */\nconst FALLBACK_CITIES = [\n  { key: 'chula_vista', label: 'Chula Vista — Residential Solar' },\n  { key: 'chula_vista_commercial', label: 'Chula Vista — Commercial Solar' },\n  { key: 'chula_vista_solarapp', label: 'Chula Vista — SolarApp+' },",
    "b": true,
    "l": 563
  },
  {
    "p": "src/components/campaign/PhoneLinesManager.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { Plus, Edit3, Star, Power, Check, X, Loader2, Phone, AlertCircle } from 'lucide-react';\n\nexport default function PhoneLinesManager() {\n  const queryClient = useQueryClient();\n  const { orgId } = useCurrentUser();\n  const [showModal, setShowModal] = useState(false);\n  const [editingLine, setEditingLine] = useState(null);\n  const [deactivatingId, setDeactivatingId] = useState(null);\n\n  const { data: lines = [], isLoading } = useQuery({\n    queryKey: ['phone-lines'],",
    "b": true,
    "l": 265
  },
  {
    "p": "src/components/campaign/PipelineStatusGrid.jsx",
    "v": "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport {\n  Table,\n  TableBody,\n  TableCell,\n  TableHead,\n  TableHeader,\n  TableRow,\n} from '@/components/ui/table';\nimport { Badge } from '@/components/ui/badge';\n\nconst STAGES = [\n  'discovery',\n  'relevance_analysis',\n  'scraping',",
    "b": true,
    "l": 95
  },
  {
    "p": "src/components/campaign/SequenceBuilder.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQueryClient } from '@tanstack/react-query';\nimport { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';\nimport { Mail, Clock, Send, Trash2, Loader2 } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nconst STEP_TYPES = [\n  { type: 'email', label: 'Send Email', icon: Mail },\n  { type: 'wait', label: 'Wait', icon: Clock },\n  { type: 'linkedin_message', label: 'LinkedIn Message', icon: Send },\n  { type: 'followup', label: 'Follow-up', icon: Mail },\n];\n\nexport default function SequenceBuilder({ campaign }) {",
    "b": true,
    "l": 308
  },
  {
    "p": "src/components/campaign/SolarCampaignTemplate.jsx",
    "v": "import React, { useState } from 'react';\nimport { Sun, ArrowRight } from 'lucide-react';\nimport SolarPermitCampaignModal from './SolarPermitCampaignModal';\nimport { useVisibility } from '@/hooks/useVisibility';\n\nexport default function SolarCampaignTemplate() {\n  const [open, setOpen] = useState(false);\n  const { canSee } = useVisibility();\n  if (!canSee('template_solar_permits')) return null;\n\n  return (\n    <>\n      <div\n        onClick={() => setOpen(true)}\n        className=\"bg-[#13151c] border border-amber-500/20 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all group hover:bg-amber-500/5\"",
    "b": true,
    "l": 39
  },
  {
    "p": "src/components/campaign/SolarDetectionCampaignModal.jsx",
    "v": "import React, { useState, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQueryClient } from '@tanstack/react-query';\nimport { X, Upload, FileText, Loader2, CheckCircle, AlertCircle, Satellite, ChevronRight } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport { toast } from 'sonner';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nconst STEPS = ['upload', 'confirm', 'importing', 'done'];\n\nexport default function SolarDetectionCampaignModal({ onClose }) {\n  const { orgId } = useCurrentUser();\n  const queryClient = useQueryClient();\n  const fileRef = useRef(null);\n",
    "b": true,
    "l": 262
  },
  {
    "p": "src/components/campaign/SolarDetectionStatusPanel.jsx",
    "v": "import React, { useEffect, useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { Satellite, Play, Loader2, CheckCircle, Sun, XCircle, AlertCircle, RefreshCw, Zap } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport { toast } from 'sonner';\n\nconst STATUS_COLORS = {\n  pending:          'text-white/40 bg-white/5',\n  processing:       'text-yellow-400 bg-yellow-500/10',\n  completed:        'text-green-400 bg-green-500/10',\n  failed:           'text-red-400 bg-red-500/10',\n  has_solar:        'text-orange-400 bg-orange-500/10',\n  no_solar:         'text-blue-400 bg-blue-500/10',",
    "b": true,
    "l": 293
  },
  {
    "p": "src/components/campaign/SolarDetectionTemplateCard.jsx",
    "v": "import React, { useState } from 'react';\nimport { Sun, Satellite } from 'lucide-react';\nimport SolarDetectionCampaignModal from './SolarDetectionCampaignModal';\n\nexport default function SolarDetectionTemplateCard() {\n  const [open, setOpen] = useState(false);\n\n  return (\n    <>\n      <div\n        onClick={() => setOpen(true)}\n        className=\"bg-[#13151c] border border-white/5 rounded-xl p-5 space-y-4 cursor-pointer hover:border-yellow-500/30 hover:bg-[#16181f] transition-all group\"\n      >\n        <div className=\"flex items-start gap-3\">\n          <div className=\"w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 group-hover:bg-yellow-500/20 transition-colors\">",
    "b": true,
    "l": 43
  },
  {
    "p": "src/components/campaign/SolarPermitCampaignModal.jsx",
    "v": "import React, { useState, useMemo, useRef, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { X, Loader2, Download, ExternalLink, Sun } from 'lucide-react';\nimport { toast } from 'sonner';\nimport { dedupeScrappyCities, jobOrSystemSummary } from '@/lib/permitScraper';\n\n/** Fallback when getScrappyCities is unavailable — keys must match Scrappy `cities/*.py` CONFIGS (see also `cities/detail_registry.py` for custom CapDetail). */\nconst CITIES = [\n  { key: 'chula_vista',  label: 'Chula Vista — Residential Solar' },\n  { key: 'chula_vista_commercial', label: 'Chula Vista — Commercial Solar' },\n  { key: 'chula_vista_solarapp', label: 'Chula Vista — SolarApp+' },\n  { key: 'oakland',      label: 'Oakland' },\n  { key: 'oakland_solarapp', label: 'Oakland (SolarApp+)' },",
    "b": true,
    "l": 636
  },
  {
    "p": "src/components/campaign/SolarPermitTemplateCard.jsx",
    "v": "import React, { useState } from 'react';\nimport { Sun, ArrowRight } from 'lucide-react';\nimport PermitCampaignModal from './PermitCampaignModal';\n\nexport default function SolarPermitTemplateCard() {\n  const [open, setOpen] = useState(false);\n\n  return (\n    <>\n      <div\n        onClick={() => setOpen(true)}\n        className=\"bg-[#13151c] border border-amber-500/20 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all group hover:bg-amber-500/5\"\n      >\n        <div className=\"flex items-start justify-between mb-3\">\n          <div className=\"w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center\">",
    "b": true,
    "l": 36
  },
  {
    "p": "src/components/campaign/StormDiscoveryTemplateCard.jsx",
    "v": "import React, { useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQueryClient } from '@tanstack/react-query';\nimport { createPageUrl } from '@/utils';\nimport { CloudLightning, ArrowRight, X, Loader2 } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport { toast } from 'sonner';\n\n/** Matches addins/aether-strike/README.md — not Apify/social discovery. */\nconst DEFAULT_NAME = 'Storm Discovery — California';\n\nfunction buildStormCampaignConfig() {\n  return {\n    storm_discovery: {",
    "b": true,
    "l": 186
  },
  {
    "p": "src/components/campaign/YouTubePipelineConfig.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { Card } from '@/components/ui/card';\nimport { Input } from '@/components/ui/input';\nimport { Slider } from '@/components/ui/slider';\nimport { ArrowRight, Settings } from 'lucide-react';\n\nconst PIPELINE_STAGES = [\n  { name: 'Keyword Search', desc: 'Find videos matching keywords' },\n  { name: 'Channel Discovery', desc: 'Extract channel metadata' },\n  { name: 'Video Extraction', desc: 'Scrape video metadata' },\n  { name: 'Comment Scraping', desc: 'Extract & sample comments' },\n  { name: 'AI Lead Detection', desc: 'Analyze for buyer intent' },\n];\n\nexport default function YouTubePipelineConfig({ config, setConfig }) {",
    "b": true,
    "l": 172
  },
  {
    "p": "src/components/campaign/builder/ConfigAIAnalysis.jsx",
    "v": "import React from 'react';\nimport { Checkbox } from '@/components/ui/checkbox';\n\nexport default function ConfigAIAnalysis({ config, setConfig }) {\n  const aiConfig = config.campaign_config?.ai_analysis || {};\n\n  const handleToggle = (key) => {\n    setConfig({\n      ...config,\n      campaign_config: {\n        ...config.campaign_config,\n        ai_analysis: {\n          ...aiConfig,\n          [key]: !aiConfig[key],\n        },",
    "b": true,
    "l": 50
  },
  {
    "p": "src/components/campaign/builder/ConfigEnrichment.jsx",
    "v": "import React from 'react';\n\nconst ENRICHMENT_PROVIDERS = [\n  {\n    id: 'apollo',\n    label: 'Apollo.io',\n    desc: 'Email, phone, company data — largest B2B database',\n    cost: '$0.05 / lead',\n    badge: 'Recommended',\n    badgeColor: 'bg-green-500/20 text-green-300 border-green-500/30',\n    note: 'Requires Apollo API key in Settings',\n  },\n  {\n    id: 'hunter',\n    label: 'Hunter.io',",
    "b": true,
    "l": 199
  },
  {
    "p": "src/components/campaign/builder/ConfigLLM.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\n\nconst STATIC_PROVIDERS = [\n  { value: 'groq',      label: 'Groq',           models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'] },\n  { value: 'openai',    label: 'OpenAI',          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },\n  { value: 'gemini',    label: 'Google Gemini',   models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },\n  { value: 'anthropic', label: 'Anthropic',       models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },\n];\n\nexport default function ConfigLLM({ config, setConfig }) {\n  const llmSettings = config.campaign_config?.llm_settings || {};\n\n  const { data: settingsList = [] } = useQuery({",
    "b": true,
    "l": 147
  },
  {
    "p": "src/components/campaign/builder/ConfigOutreach.jsx",
    "v": "import React from 'react';\nimport { Checkbox } from '@/components/ui/checkbox';\nimport { Input } from '@/components/ui/input';\n\nexport default function ConfigOutreach({ config, setConfig }) {\n  const outreachConfig = config.campaign_config?.outreach || {};\n\n  const handleToggle = (key) => {\n    setConfig({\n      ...config,\n      campaign_config: {\n        ...config.campaign_config,\n        outreach: {\n          ...outreachConfig,\n          [key]: !outreachConfig[key],",
    "b": true,
    "l": 111
  },
  {
    "p": "src/components/campaign/builder/ConfigScrapers.jsx",
    "v": "import React from 'react';\nimport { Button } from '@/components/ui/button';\nimport { Trash2 } from 'lucide-react';\n\nconst SCRAPER_TYPES = [\n  { value: 'youtube_comments', label: 'YouTube Comments', source: 'youtube_search' },\n  { value: 'reddit_comments', label: 'Reddit Comments', source: 'reddit_search' },\n  { value: 'twitter_replies', label: 'Twitter Replies', source: 'twitter_search' },\n  { value: 'linkedin_comments', label: 'LinkedIn Comments', source: 'linkedin_search' },\n  { value: 'facebook_comments', label: 'Facebook Comments', source: 'facebook_groups' },\n];\n\nexport default function ConfigScrapers({ config, setConfig }) {\n  const scrapers = config.campaign_config?.scrapers || [];\n  const sources = config.campaign_config?.discovery_sources || [];",
    "b": true,
    "l": 104
  },
  {
    "p": "src/components/campaign/builder/Step1Basics.jsx",
    "v": "import React, { useState } from 'react';\nimport { Input } from '@/components/ui/input';\nimport { X } from 'lucide-react';\n\nexport default function Step1Basics({ config, setConfig }) {\n  const [kwInput, setKwInput] = useState('');\n\n  const addKeyword = () => {\n    const val = kwInput.trim();\n    if (!val) return;\n    const current = config.keywords || [];\n    if (!current.includes(val)) {\n      setConfig({ ...config, keywords: [...current, val] });\n    }\n    setKwInput('');",
    "b": true,
    "l": 112
  },
  {
    "p": "src/components/campaign/builder/Step2DataSources.jsx",
    "v": "import React, { useState } from 'react';\nimport { Input } from '@/components/ui/input';\nimport { X, Youtube, Linkedin, MessageSquare, Users, ChevronDown } from 'lucide-react';\n\n// ── Pipeline definitions ──────────────────────────────────────────────────────\n// Each pipeline maps to specific Apify actors already registered in actorRegistry.ts\nexport const APIFY_PIPELINES = [\n  {\n    id: 'youtube_keyword',\n    label: 'YouTube — Keyword Discovery',\n    icon: '▶',\n    badge: 'Double-Actor',\n    badgeColor: 'amber',\n    description: \"Don't know your competitors? Enter keywords — Apify scouts the top channels, then harvests comments from their videos.\",\n    actors: ['apify/youtube-scraper', 'apify/youtube-comment-scraper'],",
    "b": true,
    "l": 531
  },
  {
    "p": "src/components/campaign/builder/Step3IntentModel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { CheckCircle2, AlertCircle } from 'lucide-react';\n\n// These task types map directly to what intentAnalysisWorker reads from\n// campaign_config.intent_config.model_type\nexport const INTENT_MODELS = [\n  {\n    id: 'ROOFING',\n    label: 'Roofing / Home Repair',\n    emoji: '🏠',\n    description: 'Find homeowners with active damage or repair needs.',\n    signals: ['leaks', 'hail damage', 'missing shingles', 'insurance claim', 'asking for a quote'],\n    filters: ['Ignore roofers advertising services', 'Ignore generic news about storms'],\n  },\n  {",
    "b": true,
    "l": 194
  },
  {
    "p": "src/components/campaign/builder/Step3ScrapingRules.jsx",
    "v": "import React from 'react';\n\n// These task types map directly to what intentAnalysisWorker reads from\n// campaign_config.intent_config.model_type\nexport const INTENT_MODELS = [\n  {\n    id: 'ROOFING',\n    label: 'Roofing / Home Repair',\n    emoji: '🏠',\n    description: 'Find homeowners with active damage or repair needs.',\n    signals: ['leaks', 'hail damage', 'missing shingles', 'insurance claim', 'asking for a quote'],\n    filters: ['Ignore roofers advertising services', 'Ignore generic news about storms'],\n  },\n  {\n    id: 'SOLAR',",
    "b": true,
    "l": 194
  },
  {
    "p": "src/components/campaign/builder/Step4AIIntelligence.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\n\nconst STATIC_MODELS = [\n  { id: 'groq',      label: 'Groq (Fast, Cheap)',   desc: '⚡ Best for high-volume processing' },\n  { id: 'openai',    label: 'OpenAI GPT-4',          desc: '🧠 Highest quality, higher cost' },\n  { id: 'gemini',    label: 'Google Gemini',          desc: '🎯 Balanced performance' },\n  { id: 'anthropic', label: 'Anthropic Claude',       desc: '🤖 Advanced reasoning' },\n];\n\nconst AI_CAPABILITIES = [\n  { id: 'intent_detection',        label: 'Intent Detection',        desc: 'Detect buyer intent signals' },\n  { id: 'sentiment_analysis',      label: 'Sentiment Analysis',      desc: 'Analyze tone and mood' },\n  { id: 'buyer_signal_detection',  label: 'Buyer Signal Detection',  desc: 'Find purchase intent' },",
    "b": true,
    "l": 133
  },
  {
    "p": "src/components/campaign/builder/Step5LeadFilters.jsx",
    "v": "import React, { useState } from 'react';\nimport { Input } from '@/components/ui/input';\nimport { X } from 'lucide-react';\n\nconst ACTIVITY_LEVELS  = ['any', 'high', 'medium', 'low'];\nconst ENGAGEMENT_LEVELS = ['any', 'high', 'medium', 'low'];\n\nexport default function Step5LeadFilters({ config, setConfig }) {\n  // Fix (5): local input state for tag-style fields so Enter/comma adds a tag\n  const [locationInput,    setLocationInput]    = useState('');\n  const [roleKeywordInput, setRoleKeywordInput] = useState('');\n\n  const update = (field, value) =>\n    setConfig({ ...config, qualification_rules: { ...config.qualification_rules, [field]: value } });\n",
    "b": true,
    "l": 206
  },
  {
    "p": "src/components/campaign/builder/Step6Outreach.jsx",
    "v": "import React from 'react';\nimport { Input } from '@/components/ui/input';\n\nconst OUTREACH_CHANNELS = [\n  { id: 'linkedin', label: 'LinkedIn',            icon: '💼' },\n  { id: 'email',    label: 'Email',               icon: '✉️' },\n  { id: 'twitter',  label: 'Twitter/X',           icon: '𝕏'  },\n  { id: 'reddit',   label: 'Reddit',              icon: '🔴' },\n  { id: 'comments', label: 'Comment Engagement',  icon: '💬' },\n];\n\nconst SEQUENCE_CHANNELS  = ['email', 'linkedin', 'twitter', 'reddit'];\nconst TONES              = ['professional', 'casual', 'friendly', 'direct'];\nconst LENGTHS            = ['short', 'medium', 'long'];\nconst PERSONALIZATION    = ['minimal', 'medium', 'high'];",
    "b": true,
    "l": 315
  },
  {
    "p": "src/components/campaign/builder/Step7BudgetLimits.jsx",
    "v": "import React from 'react';\nimport { Input } from '@/components/ui/input';\nimport { GripVertical } from 'lucide-react';\n\nconst LLM_OPTIONS = [\n  { id: 'groq',    label: 'Groq',    desc: 'Fastest, cheapest' },\n  { id: 'gemini',  label: 'Gemini',  desc: 'Balanced' },\n  { id: 'openai',  label: 'OpenAI',  desc: 'Premium quality' },\n];\n\nexport default function Step7BudgetLimits({ config, setConfig }) {\n  const budget = config.budget_config;\n\n  const updateBudget = (field, value) =>\n    setConfig({ ...config, budget_config: { ...budget, [field]: value } });",
    "b": true,
    "l": 142
  },
  {
    "p": "src/components/campaign/builder/Step8Review.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { CheckCircle2, AlertCircle } from 'lucide-react';\nimport { APIFY_PIPELINES } from './Step2DataSources.jsx';\nimport { INTENT_MODELS }   from './Step3IntentModel.jsx';\n\nfunction ReviewCard({ title, ok, children }) {\n  return (\n    <div className=\"bg-white/5 border border-white/10 rounded-lg p-4\">\n      <h4 className=\"font-medium text-white mb-3 flex items-center gap-2\">\n        {ok ? (\n          <CheckCircle2 className=\"w-4 h-4 text-green-400 shrink-0\" />\n        ) : (\n          <AlertCircle className=\"w-4 h-4 text-yellow-400 shrink-0\" />\n        )}\n        {title}",
    "b": true,
    "l": 256
  },
  {
    "p": "src/components/campaign/configConstants.jsx",
    "v": "/**\n * Campaign Configuration Defaults and Constants\n */\n\nexport const CAMPAIGN_CONFIG_DEFAULTS = {\n  discovery_sources: [],\n  scrapers: [],\n  ai_analysis: {\n    intent_detection: true,\n    pain_point_detection: true,\n    persona_detection: true,\n    lead_intelligence: true,\n  },\n  llm_settings: {\n    provider: 'groq',",
    "b": true,
    "l": 60
  },
  {
    "p": "src/components/dashboard/AICostTracker.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { TrendingDown } from 'lucide-react';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nexport default function AICostTracker() {\n  const { orgId } = useCurrentUser();\n  const { data: costTrackers = [], isLoading } = useQuery({\n    queryKey: ['cost-trackers-full', orgId],\n    queryFn: () => base44.entities.CostTracker.filter({ organization_id: orgId }, '-date', 31),\n  });\n\n  const today = new Date().toISOString().slice(0, 10);",
    "b": true,
    "l": 69
  },
  {
    "p": "src/components/dashboard/AILeadScoringDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { TrendingUp, Users, Target, Zap } from 'lucide-react';\n\nexport default function AILeadScoringDashboard({ leads = [], analysisResults = [] }) {\n  const stats = useMemo(() => {\n    const discovered = leads.length;\n    const qualified = leads.filter(l => l.status === 'qualified').length;\n    const enriched = leads.filter(l => l.status === 'enriched').length;\n\n    const avgIntentScore = analysisResults.length > 0\n      ? (analysisResults.reduce((sum, a) => sum + (a.urgency_score || 0), 0) / analysisResults.length).toFixed(1)\n      : 0;\n",
    "b": true,
    "l": 147
  },
  {
    "p": "src/components/dashboard/AlertsPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nconst ALERT_ICONS = {\n  error: AlertTriangle,\n  warning: AlertCircle,\n  info: Info,\n  success: CheckCircle,\n};\n\nconst ALERT_COLORS = {\n  error: 'bg-red-500/10 border-red-500/30 text-red-400',",
    "b": true,
    "l": 124
  },
  {
    "p": "src/components/dashboard/CampaignPerformanceTable.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useNavigate } from 'react-router-dom';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { createPageUrl } from '@/utils';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nexport default function CampaignPerformanceTable() {\n  const navigate = useNavigate();\n  const { orgId } = useCurrentUser();\n  const { data: campaigns = [], isLoading } = useQuery({\n    queryKey: ['campaigns-performance', orgId],\n    queryFn: () => base44.entities.Campaign.filter({ organization_id: orgId }, '-created_date', 100),",
    "b": true,
    "l": 102
  },
  {
    "p": "src/components/dashboard/FunnelMetrics.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { TrendingDown } from 'lucide-react';\n\nexport default function FunnelMetrics({ contentDiscovery = [], approvedContent = [], scrapedContent = [], leads = [], outreachSent = [] }) {\n  const metrics = useMemo(() => {\n    const discovery = contentDiscovery.length || 1;\n    const approved = approvedContent.length || 0;\n    const scraped = scrapedContent.length || 0;\n    const qualified = leads.filter(l => l.status !== 'new').length || 0;\n    const outreach = outreachSent.length || 0;\n\n    return [\n      {\n        label: 'Content Discovered',",
    "b": true,
    "l": 130
  },
  {
    "p": "src/components/dashboard/IngestForm.jsx",
    "v": "import React, { useState } from 'react';\nimport { Card, CardHeader, CardTitle, CardContent } from \"@/components/ui/card\";\nimport { Button } from \"@/components/ui/button\";\nimport { Textarea } from \"@/components/ui/textarea\";\nimport { Input } from \"@/components/ui/input\";\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from \"@/components/ui/select\";\nimport { Upload, Loader2, Plus, Trash2 } from \"lucide-react\";\nimport { base44 } from \"@/api/base44Client\";\n\nexport default function IngestForm({ onRefresh }) {\n  const [comments, setComments] = useState([{ author: '', content: '', source: 'youtube', video_url: '' }]);\n  const [loading, setLoading] = useState(false);\n  const [result, setResult] = useState(null);\n\n  const addRow = () => setComments(prev => [...prev, { author: '', content: '', source: 'youtube', video_url: '' }]);",
    "b": true,
    "l": 93
  },
  {
    "p": "src/components/dashboard/LeadIntelligenceView.jsx",
    "v": "import React from 'react';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Badge } from '@/components/ui/badge';\nimport { AlertCircle, Zap, Package, Users, MapPin } from 'lucide-react';\n\nexport default function LeadIntelligenceView({ lead = null, intelligence = null, enrichment = null }) {\n  if (!lead) {\n    return (\n      <Card>\n        <CardContent className=\"pt-6 text-center text-gray-500\">\n          Select a lead to view intelligence\n        </CardContent>\n      </Card>\n    );\n  }",
    "b": true,
    "l": 180
  },
  {
    "p": "src/components/dashboard/LeadsTable.jsx",
    "v": "import React from 'react';\nimport { Card, CardHeader, CardTitle, CardContent } from \"@/components/ui/card\";\nimport { Badge } from \"@/components/ui/badge\";\nimport { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from \"@/components/ui/table\";\nimport { Users } from \"lucide-react\";\n\nconst statusStyles = {\n  new: 'bg-blue-100 text-blue-700',\n  enriched: 'bg-emerald-100 text-emerald-700',\n  outreach_pending: 'bg-amber-100 text-amber-700',\n  outreach_sent: 'bg-violet-100 text-violet-700',\n  responded: 'bg-green-100 text-green-800',\n  converted: 'bg-green-200 text-green-900',\n  lost: 'bg-slate-100 text-slate-500',\n};",
    "b": true,
    "l": 82
  },
  {
    "p": "src/components/dashboard/MetricCard.jsx",
    "v": "import React from 'react';\n\n/**\n * Metric card for dashboard widgets\n * \n * Props:\n * - icon: Lucide icon component\n * - label: Card title\n * - values: Array of { label, value, color }\n */\nexport default function MetricCard({ icon: Icon, label, values = [] }) {\n  return (\n    <div className=\"bg-[#1e293b] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors\">\n      {/* Header */}\n      <div className=\"flex items-center gap-2 mb-4\">",
    "b": true,
    "l": 33
  },
  {
    "p": "src/components/dashboard/OutreachDashboard.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Badge } from '@/components/ui/badge';\nimport { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';\nimport { Mail, MessageSquare, TrendingUp, CheckCircle } from 'lucide-react';\n\nexport default function OutreachDashboard({ messages = [] }) {\n  const stats = useMemo(() => {\n    const sent = messages.filter(m => m.status === 'sent').length;\n    const replied = messages.filter(m => m.status === 'replied').length;\n    const bounced = messages.filter(m => m.status === 'bounced').length;\n    const total = messages.length;\n\n    const conversionRate = total > 0 ? ((replied / total) * 100).toFixed(1) : 0;\n    const bounceRate = total > 0 ? ((bounced / total) * 100).toFixed(1) : 0;",
    "b": true,
    "l": 158
  },
  {
    "p": "src/components/dashboard/PipelineActions.jsx",
    "v": "import React, { useState } from 'react';\nimport { Button } from \"@/components/ui/button\";\nimport { Card, CardHeader, CardTitle, CardContent } from \"@/components/ui/card\";\nimport { Play, Brain, Sparkles, Database, Send, Loader2, CheckCircle2, AlertCircle } from \"lucide-react\";\nimport { base44 } from \"@/api/base44Client\";\n\n/**\n * C-4 FIX: Corrected 3 of 4 broken backend function names.\n *\n * BEFORE (broken)  →  AFTER (correct backend endpoint)\n * commentsAnalyze  →  commentsAnalyze  ✓ (was OK, casing confirmed)\n * leadsEnrich      →  enrichmentWorker  (no leadsEnrich endpoint exists)\n * leadsStore       →  processLeadQueue  (no leadsStore endpoint exists)\n * leadsOutreach    →  outreachWorker    (no leadsOutreach endpoint exists)\n */",
    "b": true,
    "l": 116
  },
  {
    "p": "src/components/dashboard/PipelineLogs.jsx",
    "v": "import React from 'react';\nimport { Card, CardHeader, CardTitle, CardContent } from \"@/components/ui/card\";\nimport { Badge } from \"@/components/ui/badge\";\nimport { Activity, CheckCircle2, AlertCircle, AlertTriangle } from \"lucide-react\";\nimport { format } from \"date-fns\";\n\nconst statusConfig = {\n  success: { icon: CheckCircle2, style: 'text-green-600', badge: 'bg-green-100 text-green-700' },\n  error: { icon: AlertCircle, style: 'text-red-500', badge: 'bg-red-100 text-red-700' },\n  warning: { icon: AlertTriangle, style: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },\n};\n\nconst stepLabels = {\n  ingest: 'Ingest',\n  analyze: 'Analyze',",
    "b": true,
    "l": 68
  },
  {
    "p": "src/components/dashboard/PipelineStats.jsx",
    "v": "import React from 'react';\nimport { Card } from \"@/components/ui/card\";\nimport { MessageSquare, Brain, UserCheck, Database, Send } from \"lucide-react\";\n\nconst statCards = [\n  { key: 'ingested', label: 'Ingested', icon: MessageSquare, color: 'from-slate-500 to-slate-700', textColor: 'text-slate-600' },\n  { key: 'analyzed', label: 'Analyzed', icon: Brain, color: 'from-indigo-500 to-indigo-700', textColor: 'text-indigo-600' },\n  { key: 'qualified', label: 'Qualified', icon: UserCheck, color: 'from-amber-500 to-amber-700', textColor: 'text-amber-600' },\n  { key: 'stored', label: 'Leads', icon: Database, color: 'from-emerald-500 to-emerald-700', textColor: 'text-emerald-600' },\n  { key: 'outreach', label: 'Outreach', icon: Send, color: 'from-violet-500 to-violet-700', textColor: 'text-violet-600' },\n];\n\nexport default function PipelineStats({ comments, leads }) {\n  const counts = {\n    ingested: comments.filter(c => c.status === 'ingested').length,",
    "b": true,
    "l": 38
  },
  {
    "p": "src/components/dashboard/PipelineVisualization.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nconst STAGES = [\n  'discovery',\n  'relevance_analysis',\n  'scraping',\n  'lead_extraction',\n  'intent_analysis',\n  'enrichment',\n  'outreach',\n  'followup'\n];",
    "b": true,
    "l": 149
  },
  {
    "p": "src/components/dashboard/QuickActions.jsx",
    "v": "import React from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport { Plus, Upload, Activity, BookOpen, Settings } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nconst ACTIONS = [\n  { label: 'Create Campaign', icon: Plus,     page: 'CampaignBuilder' },\n  { label: 'Import Leads', icon: Upload, page: 'Leads' },\n  { label: 'View Pipeline', icon: Activity, page: 'Automation' },\n  { label: 'Documentation', icon: BookOpen, page: 'Documentation' },\n  { label: 'Settings', icon: Settings, page: 'Settings' },\n];\n\nexport default function QuickActions() {",
    "b": true,
    "l": 35
  },
  {
    "p": "src/components/dashboard/RecentComments.jsx",
    "v": "import React from 'react';\nimport { Card, CardHeader, CardTitle, CardContent } from \"@/components/ui/card\";\nimport { Badge } from \"@/components/ui/badge\";\nimport { MessageSquare } from \"lucide-react\";\n\nconst statusStyles = {\n  ingested: 'bg-slate-100 text-slate-700',\n  analyzed: 'bg-blue-100 text-blue-700',\n  qualified: 'bg-amber-100 text-amber-700',\n  enriched: 'bg-emerald-100 text-emerald-700',\n  outreach_sent: 'bg-violet-100 text-violet-700',\n  disqualified: 'bg-red-50 text-red-600',\n};\n\nconst intentStyles = {",
    "b": true,
    "l": 72
  },
  {
    "p": "src/components/dialer/Dialer.jsx",
    "v": "import React, { useState, useEffect, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\n// Twilio Client SDK is loaded dynamically\nlet twilioDevice = null;\nlet activeCall = null;\n\nexport default function Dialer({\n  initialNumber = '',   // pre-fill number (click-to-call)\n  contactId = null,     // contact to log against\n  contactName = '',     // display name\n  onClose,              // close callback",
    "b": true,
    "l": 414
  },
  {
    "p": "src/components/hooks/useFeatureFlag.jsx",
    "v": "import { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\n\n// Simple in-memory cache for frontend\nlet flagCache = {};\n\n// Helper to clear cache (call when flags are updated)\nexport function clearFlagCache(flagName) {\n  if (flagName) {\n    delete flagCache[flagName];\n  } else {\n    flagCache = {};\n  }\n}\n",
    "b": true,
    "l": 43
  },
  {
    "p": "src/components/hooks/useFeatureFlags.jsx",
    "v": "import { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\n\n/**\n * Hook to check if a feature flag is enabled\n * Usage: const isEnabled = useFeatureFlag('ai_autoresponder');\n */\nexport function useFeatureFlag(flagName) {\n  const { data: flags = [] } = useQuery({\n    queryKey: ['feature-flags'],\n    queryFn: () => base44.entities.FeatureFlag.list('-created_date', 200),\n    staleTime: 5 * 60 * 1000, // 5 min cache\n  });\n\n  const flag = flags.find(f => f.flag_name === flagName);",
    "b": true,
    "l": 30
  },
  {
    "p": "src/components/leads/LeadDetailDrawer.jsx",
    "v": "import React, { useState } from 'react';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { base44 } from '@/api/base44Client';\nimport { formatDistanceToNow } from 'date-fns';\nimport { X } from 'lucide-react';\nimport LeadDrawerTimeline from './LeadDrawerTimeline';\nimport LeadDrawerNotes from './LeadDrawerNotes';\nimport LeadDrawerReminders from './LeadDrawerReminders';\nimport Dialer from '@/components/dialer/Dialer';\n\nexport default function LeadDetailDrawer({ contactId, onClose }) {\n  const [activeTab, setActiveTab] = useState('timeline');\n  const [showDialer, setShowDialer] = useState(false);\n  const queryClient = useQueryClient();",
    "b": true,
    "l": 492
  },
  {
    "p": "src/components/leads/LeadDetailPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation, useQueryClient } from '@tanstack/react-query';\nimport { X, Wand2, Mail, TrendingUp, CheckCircle2, XCircle, Zap, Loader2 } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport StatusBadge from '@/components/ui/StatusBadge';\n\nexport default function LeadDetailPanel({ lead, campaign, onClose, onCopilotOpen, onLeadsUpdated }) {\n  const queryClient = useQueryClient();\n  const [error, setError] = useState('');\n  const [successMessage, setSuccessMessage] = useState('');\n  const [rejectReason, setRejectReason] = useState('');\n  const [showRejectForm, setShowRejectForm] = useState(false);\n\n  const approveMutation = useMutation({",
    "b": true,
    "l": 247
  },
  {
    "p": "src/components/leads/LeadDrawerNotes.jsx",
    "v": "import React, { useState } from 'react';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { formatDistanceToNow } from 'date-fns';\n\nexport default function LeadDrawerNotes({ contactId }) {\n  const [newNote, setNewNote] = useState('');\n  const [noteType, setNoteType] = useState('general');\n  const queryClient = useQueryClient();\n\n  const { data: notes = [] } = useQuery({\n    queryKey: ['lead-notes', contactId],\n    queryFn: () =>\n      base44.entities.LeadNote.filter(\n        { contact_id: contactId },",
    "b": true,
    "l": 101
  },
  {
    "p": "src/components/leads/LeadDrawerReminders.jsx",
    "v": "import React, { useState } from 'react';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { formatDistanceToNow } from 'date-fns';\n\nexport default function LeadDrawerReminders({ contactId }) {\n  const [showForm, setShowForm] = useState(false);\n  const [title, setTitle] = useState('');\n  const [remindAt, setRemindAt] = useState('');\n  const [body, setBody] = useState('');\n  const queryClient = useQueryClient();\n\n  const { data: reminders = [] } = useQuery({\n    queryKey: ['lead-reminders', contactId],\n    queryFn: () =>",
    "b": true,
    "l": 143
  },
  {
    "p": "src/components/leads/LeadDrawerTimeline.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { useQuery } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { formatDistanceToNow, format } from 'date-fns';\n\n// ── Score weights mirror logEngagementEvent.ts ────────────────────────────\nconst SCORE_WEIGHTS = {\n  lead_created:             5,\n  email_sent:               1,\n  email_opened:             3,\n  email_opened_multiple:    10,\n  email_replied:            25,\n  email_link_clicked:       18,\n  email_interested:         30,\n  email_bounced:           -5,",
    "b": true,
    "l": 360
  },
  {
    "p": "src/components/leads/LeadFilters.jsx",
    "v": "import React, { useState } from 'react';\nimport { Filter, X } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nexport default function LeadFilters({ filters, onFiltersChange }) {\n  const [open, setOpen] = useState(false);\n\n  const statuses = ['qualified', 'enriched', 'contact_ready', 'contacted', 'replied', 'disqualified'];\n  const personas = ['founder', 'marketing_manager', 'sales_leader', 'developer'];\n  const temperatures = ['hot', 'warm', 'cold'];\n\n  const activeCount = Object.keys(filters).filter(k => filters[k] != null).length;\n\n  return (\n    <div className=\"relative\">",
    "b": true,
    "l": 118
  },
  {
    "p": "src/components/leads/LeadsFilterSidebar.jsx",
    "v": "import React from 'react';\n\nconst temperatures = [\n  { id: 'hot', label: '🔴 HOT (60+)', color: '#ef4444' },\n  { id: 'warm', label: '🟡 WARM (25-59)', color: '#f59e0b' },\n  { id: 'cold', label: '🔵 COLD (0-24)', color: '#06b6d4' },\n];\n\nconst statuses = [\n  'new', 'contacted', 'engaged', 'qualified', 'transferred', 'closed_won', 'closed_lost'\n];\n\nconst sources = ['YouTube', 'Reddit', 'LinkedIn', 'Permit', 'Manual'];\n\nconst flags = [",
    "b": true,
    "l": 145
  },
  {
    "p": "src/components/leads/LeadsHeatBoard.jsx",
    "v": "import React from 'react';\nimport { formatDistanceToNow } from 'date-fns';\n\nexport default function LeadsHeatBoard({ contacts, onSelectContact }) {\n  const hot = contacts.filter(c => c.engagement_score >= 60).sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0));\n  const warm = contacts.filter(c => c.engagement_score >= 25 && c.engagement_score < 60).sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0));\n  const cold = contacts.filter(c => c.engagement_score < 25).sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0));\n\n  const Column = ({ title, color, leads }) => (\n    <div className=\"flex-1 p-4 min-h-full\" style={{ background: 'rgba(15,23,42,0.3)' }}>\n      <h3 className=\"font-bold mb-4 text-white\" style={{ color }}>\n        {title} ({leads.length})\n      </h3>\n      <div className=\"space-y-3\">\n        {leads.map(lead => (",
    "b": true,
    "l": 58
  },
  {
    "p": "src/components/leads/LeadsTable.jsx",
    "v": "import React, { useState } from 'react';\nimport { Checkbox } from '@/components/ui/checkbox';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { ChevronRight, Wand2 } from 'lucide-react';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nconst COLUMNS = [\n  { key: 'author_name', label: 'Name', width: '180px' },\n  { key: 'company_name', label: 'Company', width: '150px' },\n  { key: 'email', label: 'Email', width: '200px' },\n  { key: 'source_platform', label: 'Source', width: '100px' },\n  { key: 'intent_score', label: 'Intent', width: '80px' },\n  { key: 'status', label: 'Status', width: '120px' },\n  { key: 'persona', label: 'Persona', width: '120px' },\n  { key: 'created_at', label: 'Created', width: '120px' },",
    "b": true,
    "l": 179
  },
  {
    "p": "src/components/leads/LeadsTableView.jsx",
    "v": "import React, { useState } from 'react';\nimport { MoreVertical, ExternalLink, Check, X } from 'lucide-react';\nimport { formatDistanceToNow } from 'date-fns';\nimport { useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { base44 } from '@/api/base44Client';\nimport Dialer from '@/components/dialer/Dialer';\n\nexport default function LeadsTableView({ contacts, onSelectContact, isLeadsOnly = false }) {\n  const [openMenu, setOpenMenu] = useState(null);\n  const [dialerContact, setDialerContact] = useState(null);\n  const [pushingContactId, setPushingContactId] = useState(null);\n  const queryClient = useQueryClient();\n\n  const pushMondayMutation = useMutation({",
    "b": true,
    "l": 246
  },
  {
    "p": "src/components/leads/LeadsTopBar.jsx",
    "v": "import React from 'react';\nimport { TableIcon, Flame, Upload } from 'lucide-react';\n\nexport default function LeadsTopBar({\n  selectedVertical,\n  onVerticalChange,\n  viewMode,\n  onViewChange,\n  stats,\n  onImportClick,\n}) {\n  const verticals = [\n    { slug: 'solar', label: 'Solar Leads', icon: '☀️', color: '#f59e0b', rgb: '245,158,11' },\n    { slug: 'solar_permit', label: 'Permit leads', icon: '📋', color: '#d97706', rgb: '217,119,6' },\n    { slug: 'roofing', label: 'Roofing Leads', icon: '🏠', color: '#3b82f6', rgb: '59,130,246' },",
    "b": true,
    "l": 138
  },
  {
    "p": "src/components/leads/SavedViews.jsx",
    "v": "import React, { useState } from 'react';\nimport { ChevronDown, Save } from 'lucide-react';\n\nexport default function SavedViews({ selectedView, onViewChange }) {\n  const [showMenu, setShowMenu] = useState(false);\n\n  const views = [\n    { id: 'all', label: 'All Leads' },\n    { id: 'hot', label: '🔥 Hot Leads', filter: { intent_score_min: 80 } },\n    { id: 'qualified', label: '✅ AI Qualified', filter: { status: 'qualified' } },\n    { id: 'recent', label: '⏱️ Recent Leads', sort: '-created_at' },\n    { id: 'outreach', label: '📧 Needs Outreach', filter: { status: 'contact_ready' } },\n  ];\n\n  const current = views.find(v => v.id === selectedView) || views[0];",
    "b": true,
    "l": 49
  },
  {
    "p": "src/components/operator/AICostMonitorPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { DollarSign } from 'lucide-react';\n\nexport default function AICostMonitorPanel() {\n  const today = new Date();\n  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);\n  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);\n\n  const { data: costLogs = [] } = useQuery({\n    queryKey: ['cost-logs'],\n    queryFn: () =>\n      base44.entities.AISpendLog?.filter(\n        { date: { $gte: monthAgo.toISOString().split('T')[0] } },",
    "b": true,
    "l": 83
  },
  {
    "p": "src/components/operator/CampaignOverviewPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Megaphone } from 'lucide-react';\n\nexport default function CampaignOverviewPanel() {\n  const { data: campaigns = [] } = useQuery({\n    queryKey: ['campaigns'],\n    queryFn: () => base44.entities.Campaign?.filter({ status: 'active' }, '-created_at', 50).catch(() => []),\n    refetchInterval: 10000,\n  });\n\n  const { data: campaignLeads = [] } = useQuery({\n    queryKey: ['campaign-leads'],\n    queryFn: () => base44.entities.CampaignLead?.filter({ organization_id: currentUser?.organization_id }, '-created_at', 5000).catch(() => []),",
    "b": true,
    "l": 79
  },
  {
    "p": "src/components/operator/PipelineMetricsPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { TrendingUp } from 'lucide-react';\n\nexport default function PipelineMetricsPanel() {\n  const today = new Date().toISOString().split('T')[0];\n\n  // Fetch usage metrics for today\n  const { data: usageMetrics = [] } = useQuery({\n    queryKey: ['usage-metrics', today],\n    queryFn: () =>\n      base44.entities.UsageMetrics?.filter({ date: today }, '-created_at', 1000).catch(() => []),\n    refetchInterval: 10000,\n  });",
    "b": true,
    "l": 55
  },
  {
    "p": "src/components/operator/QueueStatusPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Layers } from 'lucide-react';\n\nconst QUEUE_NAMES = [\n  'DiscoveryQueue',\n  'IntentQueue',\n  'QualificationQueue',\n  'EnrichmentQueue',\n  'OutreachQueue',\n  'FollowupQueue',\n  'DeadLetterQueue',\n];\n",
    "b": true,
    "l": 69
  },
  {
    "p": "src/components/operator/SystemHealthPanel.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';\n\nexport default function SystemHealthPanel() {\n  // Fetch worker status\n  const { data: workerStatuses = [] } = useQuery({\n    queryKey: ['worker-status'],\n    queryFn: () => base44.entities.WorkerStatus?.filter({}, '-updated_at', 100).catch(() => []),\n    refetchInterval: 10000,\n  });\n\n  // Fetch recent function logs for error rate\n  const { data: functionLogs = [] } = useQuery({",
    "b": true,
    "l": 115
  },
  {
    "p": "src/components/operator/WorkerControlPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { Power, RotateCw, Pause } from 'lucide-react';\n\nconst WORKER_NAMES = [\n  'discoveryWorker',\n  'intentWorker',\n  'qualificationWorker',\n  'enrichmentWorker',\n  'outreachWorker',\n  'followupWorker',\n];\n\nexport default function WorkerControlPanel() {",
    "b": true,
    "l": 133
  },
  {
    "p": "src/components/pipeline/LeadDetailPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { X, Phone, Mail, Calendar, User, DollarSign, FileText, MessageSquare, Activity, Check, ExternalLink } from 'lucide-react';\nimport { formatDistanceToNow } from 'date-fns';\nimport { toast } from 'sonner';\n\nexport default function LeadDetailPanel({ lead, stages, pipelineName, onClose }) {\n  const queryClient = useQueryClient();\n  const [activeTab, setActiveTab] = useState('details');\n  const [editedName, setEditedName] = useState(lead.lead_name);\n  const [saving, setSaving] = useState(false);\n  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);\n\n  const { data: contact } = useQuery({",
    "b": true,
    "l": 245
  },
  {
    "p": "src/components/platformActors.jsx",
    "v": "/**\n * Centralized Platform-to-Actor Configuration\n * Maps frontend platform selections to Apify actors and payload builders\n * \n * This ensures consistency between frontend platform choices and backend worker implementations.\n */\n\nexport const PLATFORM_ACTORS = {\n  youtube: {\n    searchActor: 'apify/youtube-search-scraper',\n    commentActor: 'apify/youtube-comments-scraper',\n    searchInput: (keyword, maxResults) => ({\n      searchQueries: [keyword],\n      maxResults: maxResults || 100,\n    }),",
    "b": true,
    "l": 137
  },
  {
    "p": "src/components/settings/AccountSection.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { \n  User, Copy, Edit3, Check, X, Loader2, Shield, \n  Mail, Key, LogOut, Trash2, UserPlus, Clock \n} from 'lucide-react';\n\nexport default function AccountSection() {\n  const queryClient = useQueryClient();\n  const [editingName, setEditingName] = useState(false);\n  const [editingEmail, setEditingEmail] = useState(false);\n  const [newName, setNewName] = useState('');\n  const [newEmail, setNewEmail] = useState('');",
    "b": true,
    "l": 384
  },
  {
    "p": "src/components/settings/CustomAIEndpoints.jsx",
    "v": "import React, { useState, useEffect, useRef } from 'react';\nimport { Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';\n\nfunction MaskedInput({ value, onChange, placeholder }) {\n  const [show, setShow] = useState(false);\n  return (\n    <div className=\"relative\">\n      <input\n        type={show ? 'text' : 'password'}\n        className=\"w-full bg-[#111318] border border-white/8 rounded-lg px-3 py-2 pr-9 text-sm text-white outline-none focus:border-white/20 font-mono placeholder-white/15\"\n        value={value}\n        onChange={e => onChange(e.target.value)}\n        placeholder={placeholder}\n      />\n      <button type=\"button\" onClick={() => setShow(s => !s)}",
    "b": true,
    "l": 252
  },
  {
    "p": "src/components/settings/DiscoverySection.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { Copy, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';\nimport { toast } from 'sonner';\nimport { useQuery } from '@tanstack/react-query';\n\nconst CITIES = [\n  { key: 'chula_vista',  label: 'Chula Vista' },\n  { key: 'oakland',      label: 'Oakland' },\n  { key: 'santa_ana',    label: 'Santa Ana' },\n  { key: 'fontana',      label: 'Fontana' },\n  { key: 'palmdale',     label: 'Palmdale' },\n  { key: 'concord',      label: 'Concord' },\n  { key: 'berkeley',     label: 'Berkeley' },\n  { key: 'downey',       label: 'Downey' },",
    "b": true,
    "l": 275
  },
  {
    "p": "src/components/settings/VoiceAgentSection.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Copy, Loader2, Play, Check, X } from 'lucide-react';\n\nexport default function VoiceAgentSection({ settings, onUpdate }) {\n  const [testLoading, setTestLoading] = useState(false);\n\n  const { data: callScripts = [] } = useQuery({\n    queryKey: ['call-scripts'],\n    queryFn: () => base44.entities.CallScript.list().catch(() => []),\n  });\n\n  const testWebhookMutation = useMutation({",
    "b": true,
    "l": 166
  },
  {
    "p": "src/components/settings/tabs/AIModelsTab.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Bot, Key, DollarSign, Loader2 } from 'lucide-react';\nimport { loadOrgSettings, reloadOrgSettings, upsertSettings, SecretField, TextField, SelectField, NumberField, SectionCard, SaveBar } from '@/components/settings/tabs/shared';\n\nconst KEYS = [\n  'ai_provider', 'groq_model', 'openai_model', 'anthropic_model',\n  'groq_api_key', 'openai_api_key', 'anthropic_api_key', 'google_gemini_api_key',\n  'cost_limit_daily', 'anomaly_threshold_usd', 'max_daily_outreach',\n];\n\nexport default function AIModelsTab({ user }) {\n  const queryClient = useQueryClient();\n  const [fields, setFields] = useState({});",
    "b": true,
    "l": 134
  },
  {
    "p": "src/components/settings/tabs/AIVoiceTab.jsx",
    "v": "import React, { useState, useEffect, useCallback, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Link } from 'react-router-dom';\nimport {\n  Phone, ArrowRight, Loader2, BookOpen,\n  DollarSign, Mic, Play, Square,\n  Crown, ChevronDown, ChevronUp,\n} from 'lucide-react';\nimport {\n  loadOrgSettings, reloadOrgSettings, upsertSettings,\n  SecretField, TextField, SectionCard, SaveBar,\n} from '@/components/settings/tabs/shared';\n",
    "b": true,
    "l": 590
  },
  {
    "p": "src/components/settings/tabs/AdvancedTab.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Settings2, RefreshCw, AlertTriangle, CheckCircle2,\n  Loader2, Trash2, X, ToggleLeft, ToggleRight,\n  ShieldCheck, Activity, Lock\n} from 'lucide-react';\nimport { loadOrgSettings, reloadOrgSettings, upsertSettings, NumberField, SectionCard, SaveBar } from '@/components/settings/tabs/shared';\n\n// ─── Credits & Usage Section ──────────────────────────────────────────────────\nfunction CreditsUsageSection({ user }) {\n  const queryClient = useQueryClient();\n  const { data: orgCredits, isLoading: creditsLoading } = useQuery({",
    "b": true,
    "l": 695
  },
  {
    "p": "src/components/settings/tabs/AlertsTab.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Bell, Shield, Mail, Loader2, RefreshCw, Send, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';\nimport { loadOrgSettings, reloadOrgSettings, upsertSettings, SecretField, TextField, NumberField, SectionCard, SaveBar } from '@/components/settings/tabs/shared';\n\nconst KEYS = ['slack_alert_webhook', 'alert_email', 'kill_switch_window_min', 'anomaly_threshold_usd'];\n\nfunction StatusCard({ label, value, variant = 'default' }) {\n  const colors = {\n    default: 'text-white/70',\n    success: 'text-green-400',\n    danger:  'text-red-400',\n    warning: 'text-amber-400',",
    "b": true,
    "l": 209
  },
  {
    "p": "src/components/settings/tabs/CRMTab.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';\nimport { loadOrgSettings, reloadOrgSettings, upsertSettings, SecretField, TextField, NumberField, SectionCard, SaveBar } from '@/components/settings/tabs/shared';\n\nconst KEYS = ['monday_api_key', 'monday_default_board_id', 'monday_auto_push_score'];\n\nexport default function CRMTab({ user }) {\n  const queryClient = useQueryClient();\n  const [fields, setFields] = useState({});\n  const [loading, setLoading] = useState(true);\n  const [saving, setSaving] = useState(false);\n  const [lastSaved, setLastSaved] = useState(null);",
    "b": true,
    "l": 118
  },
  {
    "p": "src/components/settings/tabs/DiscoveryTab.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Globe, Shield, MapPin, Activity, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';\nimport {\n  loadOrgSettings, reloadOrgSettings, upsertSettings, getFunctionUrl,\n  SecretField, TextField, CopyField, SectionCard, SaveBar,\n} from '@/components/settings/tabs/shared';\n\nconst CITIES = [\n  { key: 'chula_vista',  label: 'Chula Vista'  },\n  { key: 'oakland',      label: 'Oakland'      },\n  { key: 'santa_ana',    label: 'Santa Ana'    },\n  { key: 'fontana',      label: 'Fontana'      },",
    "b": true,
    "l": 187
  },
  {
    "p": "src/components/settings/tabs/EmailTab.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Mail, Webhook, Loader2, Zap } from 'lucide-react';\nimport { loadOrgSettings, reloadOrgSettings, upsertSettings, getFunctionUrl, SecretField, TextField, CopyField, SectionCard, SaveBar } from '@/components/settings/tabs/shared';\n\nconst KEYS = [\n  'instantly_api_key',\n  'outreach_from_email', 'outreach_from_name',\n  'mailslurp_api_key', 'mailslurp_inbox_id',\n  'sendgrid_api_key', 'sendgrid_from_email',\n];\n\nexport default function EmailTab({ user }) {",
    "b": true,
    "l": 224
  },
  {
    "p": "src/components/settings/tabs/EnrichmentTab.jsx",
    "v": "import React, { useState, useEffect, useCallback, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Loader2, RefreshCw, Database, Search, Zap } from 'lucide-react';\nimport {\n  loadOrgSettings, reloadOrgSettings, upsertSettings,\n  SecretField, TextField, SectionCard, SaveBar,\n} from '@/components/settings/tabs/shared';\n\nconst KEYS = [\n  'tracerfy_api_key', 'tracerfy_base_url',\n  'apollo_api_key', 'hunter_io_api_key',\n  'clay_api_key', 'findymail_api_key',\n  'exa_api_key', 'serper_api_key',",
    "b": true,
    "l": 237
  },
  {
    "p": "src/components/settings/tabs/IncomingCallRoutingSection.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  PhoneIncoming, User, Copy, Check, Loader2,\n  AlertCircle, CheckCircle2, ExternalLink, RefreshCw,\n  ChevronDown, Phone, Wifi, WifiOff,\n} from 'lucide-react';\nimport { getFunctionUrl, upsertSettings } from '@/components/settings/tabs/shared';\n\n// ── helpers ──────────────────────────────────────────────────────────────────\n\nfunction formatPhone(p) {\n  if (!p) return '—';",
    "b": true,
    "l": 319
  },
  {
    "p": "src/components/settings/tabs/TeamTab.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Plus, Loader2, X, Edit2, Lock, Trash2 } from 'lucide-react';\n\nconst roleBadgeConfig = {\n  owner: { bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/25' },\n  admin: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/25' },\n  manager: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25' },\n  agent: { bg: 'bg-green-500/15', text: 'text-green-300', border: 'border-green-500/25' },\n  viewer: { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/25' },\n  leads_only:           { bg: 'bg-cyan-500/15',   text: 'text-cyan-300',   border: 'border-cyan-500/25' },\n  incoming_call_agent:  { bg: 'bg-green-500/15',  text: 'text-green-300',  border: 'border-green-500/25' },\n};",
    "b": true,
    "l": 279
  },
  {
    "p": "src/components/settings/tabs/shared.jsx",
    "v": "import React, { useState, useEffect, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { Eye, EyeOff, Copy, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';\n\n// ─── Data helpers ─────────────────────────────────────────────────────────────\nexport async function loadOrgSettings(user) {\n  if (!user?.organization_id) return {};\n  try {\n    const res = await base44.functions.invoke('loadSettings', {\n      organization_id: user.organization_id,\n    });\n    const rows = res?.data || res || [];\n    const map = {};\n    (rows || []).forEach(r => { map[r.setting_key] = r; });\n    return map;",
    "b": true,
    "l": 244
  },
  {
    "p": "src/components/sidebar/AICopilotPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation } from '@tanstack/react-query';\nimport { X, Wand2, Send, Loader2 } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport { Textarea } from '@/components/ui/textarea';\n\nexport default function AICopilotPanel({ open, onClose, leadData, campaignData }) {\n  const [messages, setMessages] = useState([]);\n  const [input, setInput] = useState('');\n  const [activeTab, setActiveTab] = useState('summarize'); // summarize, email, signals, suggest\n\n  const aiMutation = useMutation({\n    mutationFn: (payload) => base44.functions.invoke('aiCopilot', payload),\n    onSuccess: (res) => {",
    "b": true,
    "l": 147
  },
  {
    "p": "src/components/sms/AnalyticsTab.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';\nimport { Calendar, MessageSquare, TrendingUp, Clock, Loader2 } from 'lucide-react';\n\nconst DATE_RANGES = {\n  today: { label: 'Today', days: 0 },\n  '7d': { label: 'Last 7 days', days: 7 },\n  '30d': { label: 'Last 30 days', days: 30 },\n  '90d': { label: 'Last 90 days', days: 90 },\n  all: { label: 'All time', days: null },\n};\n",
    "b": true,
    "l": 424
  },
  {
    "p": "src/components/sms/CampaignStatsBar.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { useQuery } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nexport default function CampaignStatsBar() {\n  const { orgId } = useCurrentUser();\n  const { data: smsLogs = [] } = useQuery({\n    queryKey: ['sms-logs-dashboard', orgId],\n    queryFn: () => base44.entities.SMSLog.filter({ organization_id: orgId }, '-sent_at', 1000).catch(() => []),\n    refetchInterval: 60000,\n  });\n\n  const totalSent = smsLogs.filter(l => l.direction === 'outbound').length;\n  const totalDelivered = smsLogs.filter(l => l.status === 'delivered').length;",
    "b": true,
    "l": 34
  },
  {
    "p": "src/components/sms/CampaignsList.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport { Plus, Search, Play, Pause, Trash2, Edit3, Settings, MessageCircle, Calendar, Copy, MessageSquare, X, Mail, Phone } from 'lucide-react';\nimport CampaignPreferencesModal from '@/components/campaign/CampaignPreferencesModal';\nimport CampaignCreatorWizard from '@/components/campaign/CampaignCreatorWizard';\nimport AddEventModal from '@/components/campaign/AddEventModal';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';\n\nconst STATUS_STYLE = {\n  active: 'bg-green-500/15 text-green-400 border-green-500/25',\n  paused: 'bg-amber-500/15 text-amber-400 border-amber-500/25',\n  draft:  'bg-white/5 text-white/30 border-white/10',",
    "b": true,
    "l": 826
  },
  {
    "p": "src/components/sms/ComposeSMS.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nexport default function ComposeSMS({ lines, initialMessage, testMode }) {\n  const queryClient = useQueryClient();\n  const { orgId } = useCurrentUser();\n  const [to, setTo]           = useState('');\n  const [from, setFrom]       = useState('');\n  const [message, setMessage] = useState('');\n  const [mediaUrl, setMediaUrl] = useState('');\n  const [sending, setSending] = useState(false);",
    "b": true,
    "l": 382
  },
  {
    "p": "src/components/sms/ContactsManager.jsx",
    "v": "import React, { useState, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  Plus, Upload, Download, Search, Filter, Edit3, Trash2, X, \n  CheckCircle2, XCircle, Loader2, Users, Mail, Phone, MapPin,\n  Calendar, Tag, FileText, UserPlus\n} from 'lucide-react';\n\nconst ENGAGEMENT_COLORS = {\n  high: 'bg-green-500/15 text-green-400 border-green-500/25',\n  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',\n  low: 'bg-blue-500/15 text-blue-400 border-blue-500/25',",
    "b": true,
    "l": 721
  },
  {
    "p": "src/components/sms/ConversationsTab.jsx",
    "v": "import React, { useState, useEffect, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { Search, Send, Paperclip, Smile, MessageSquare, CheckCheck, Clock, AlertCircle, Loader2, ExternalLink } from 'lucide-react';\nimport { formatDistanceToNow } from 'date-fns';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nconst ENGAGEMENT_COLORS = {\n  engaged: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25' },\n  disengaged: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/25' },\n  attention: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },\n  stopped: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25' },\n};\n\nconst CONTACT_ENGAGEMENT_COLORS = {",
    "b": true,
    "l": 544
  },
  {
    "p": "src/components/sms/DocumentationButton.jsx",
    "v": "import React from 'react';\nimport { FileText } from 'lucide-react';\nimport { useNavigate } from 'react-router-dom';\n\nexport default function DocumentationButton() {\n  const navigate = useNavigate();\n\n  return (",
    "b": true,
    "l": 17
  },
  {
    "p": "src/components/sms/PipelineTab.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport {\n  Plus, Settings, Filter, Search, Edit3, Trash2, X, Loader2,\n  Calendar, Phone, Mail, ChevronDown, List, LayoutGrid, Download, Users, MoreHorizontal, Check\n} from 'lucide-react';\nimport LeadDetailPanel from '@/components/pipeline/LeadDetailPanel';\n\nconst ENGAGEMENT_COLORS = {\n  engaged: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25' },\n  disengaged: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/25' },",
    "b": true,
    "l": 902
  },
  {
    "p": "src/components/sms/SystemTestPanel.jsx",
    "v": "import React, { useState, useRef, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useMutation } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Play, Copy, Loader2, X } from 'lucide-react';\n\nconst TESTS = [\n  { id: 0, name: 'Pre-Launch Checklist', desc: 'Verify all production readiness requirements', type: 'pre_launch_checklist', critical: true },\n  { id: 'PRODUCTION Class B UnitsTY', name: 'Production Safety Check', desc: 'Verify test mode and signature validation bypass are both disabled', type: 'production_safety', critical: true },\n  { id: 1, name: 'Twilio Connection', desc: 'Verify Twilio Account SID and Auth Token are valid', type: 'twilio_credentials' },\n  { id: 2, name: 'Phone Lines', desc: 'Verify at least one phone line is configured and active', type: 'phone_lines' },\n  { id: 3, name: 'Send SMS (Virtual Phone)', desc: 'Send SMS from +13465678136 to Twilio Virtual Phone (+18777804236)', type: 'send_sms_virtual' },\n  { id: 4, name: 'Delivery Webhook URL', desc: 'Verify the twilioSmsStatus webhook URL is configured and reachable', type: 'webhook_url' },\n  { id: 5, name: 'Status Update Webhook', desc: 'Verify twilioSmsStatus function exists and can update SMSLog records', type: 'sms_log_update' },\n  { id: 6, name: 'Opt-Out Processing', desc: 'Verify STOP keyword correctly marks contact as opted out', type: 'opt_out_handling' },",
    "b": true,
    "l": 337
  },
  {
    "p": "src/components/sms/TemplatesTab.jsx",
    "v": "import React, { useState, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Plus, Copy, Edit3, Trash2, CheckCircle2, Search, X, FileText, Loader2 } from 'lucide-react';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nconst CATEGORIES = [\n  { value: 'all', label: 'All' },\n  { value: 'follow_up', label: 'Follow Up' },\n  { value: 'appointment', label: 'Appointment' },\n  { value: 're_engagement', label: 'Re-engagement' },\n  { value: 'introduction', label: 'Introduction' },\n  { value: 'opt_in', label: 'Opt-In' },\n  { value: 'sales', label: 'Sales' },",
    "b": true,
    "l": 370
  },
  {
    "p": "src/components/sourceWorkerMap.jsx",
    "v": "/**\n * Source-to-Worker Mapping\n * Maps frontend data source selections to backend worker functions\n */\n\nexport const sourceWorkerMap = {\n  youtube: 'youtubeSearchWorker',\n  linkedin: 'linkedinSearchWorker',\n  reddit: 'redditSearchWorker',\n  twitter: 'twitterSearchWorker',\n  facebook: 'facebookPostWorker',\n  github: 'githubSearchWorker',\n  product_hunt: 'productHuntSearchWorker',\n};\n",
    "b": true,
    "l": 97
  },
  {
    "p": "src/components/stores/CampaignStore.jsx",
    "v": "import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nexport function useCampaignStore() {\n  const queryClient = useQueryClient();\n  const { orgId } = useCurrentUser();\n\n  const { data: campaigns = [], isLoading, error, refetch } = useQuery({\n    queryKey: ['campaigns', orgId],\n    queryFn: () => base44.entities.Campaign.filter({ organization_id: orgId }, '-created_date', 100),\n  });\n\n  // FIX: Route creates through createCampaignV2 — enforces budget checks + org validation\n  const createMutation = useMutation({",
    "b": true,
    "l": 48
  },
  {
    "p": "src/components/stores/LeadStore.jsx",
    "v": "import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nexport function useLeadStore() {\n  const queryClient = useQueryClient();\n  const { orgId } = useCurrentUser();\n\n  const { data: leads = [], isLoading, error, refetch } = useQuery({\n    queryKey: ['leads', orgId],\n    queryFn: () => base44.entities.Lead.filter({ organization_id: orgId }, '-created_date', 500),\n    refetchInterval: 15000,\n  });\n\n  const approveMutation = useMutation({",
    "b": true,
    "l": 44
  },
  {
    "p": "src/components/stores/NotificationStore.jsx",
    "v": "import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCallback } from 'react';\n\nexport function useNotificationStore() {\n  const queryClient = useQueryClient();\n  const user = null; // Would come from auth\n\n  const { data: notifications = [] } = useQuery({\n    queryKey: ['notifications', user?.email],\n    queryFn: () => user ? base44.entities.Notification.filter({ user_email: user.email }, '-created_at', 100) : Promise.resolve([]),\n    enabled: !!user,\n    refetchInterval: 10000,\n  });\n",
    "b": true,
    "l": 38
  },
  {
    "p": "src/components/stores/SettingsStore.jsx",
    "v": "import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\n\nexport function useSettingsStore(organizationId) {\n  const queryClient = useQueryClient();\n\n  const { data: settings = [], isLoading } = useQuery({\n    queryKey: ['settings', organizationId],\n    queryFn: () => base44.entities.SystemSettings.filter({ organization_id: organizationId }),\n    enabled: !!organizationId,\n  });\n\n  const updateMutation = useMutation({\n    mutationFn: ({ id, value }) => base44.entities.SystemSettings.update(id, { setting_value: value, updated_at: new Date().toISOString() }),\n    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', organizationId] }),",
    "b": true,
    "l": 30
  },
  {
    "p": "src/components/stores/SystemHealthStore.jsx",
    "v": "import { useQuery } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\n\nexport function useSystemHealthStore() {\n  const { orgId } = useCurrentUser();\n\n  const { data: workers = [] } = useQuery({\n    queryKey: ['workers', orgId],\n    queryFn: () => orgId\n      ? base44.entities.WorkerStatus.filter({ organization_id: orgId }, '-last_heartbeat', 50).catch(() => [])\n      : Promise.resolve([]),\n    refetchInterval: 15000,\n    enabled: !!orgId,\n  });",
    "b": true,
    "l": 56
  },
  {
    "p": "src/components/system/CostTrackerPanel.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { DollarSign } from 'lucide-react';\n\nexport default function CostTrackerPanel({ campaignId }) {\n  const today = new Date().toISOString().slice(0, 10);\n\n  const { data: trackers = [] } = useQuery({\n    queryKey: ['cost-tracker', campaignId, today],\n    queryFn: () => base44.entities.CostTracker.filter(\n      campaignId ? { campaign_id: campaignId, date: today } : { date: today }\n    ),\n    refetchInterval: 30000,\n  });",
    "b": true,
    "l": 45
  },
  {
    "p": "src/components/system/QueueHealthIndicator.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { Activity } from 'lucide-react';\n\nconst QUEUES = [\n  { label: 'Discovery',       entity: 'DiscoveryQueue' },\n  { label: 'Relevance',       entity: 'RelevanceQueue' },\n  { label: 'Scraping',        entity: 'ScrapingQueue' },\n  { label: 'Lead Extraction', entity: 'LeadExtractionQueue' },\n  { label: 'Intent',          entity: 'IntentQueue' },\n  { label: 'Enrichment',      entity: 'EnrichmentQueue' },\n  { label: 'Outreach',        entity: 'OutreachQueue' },\n];",
    "b": true,
    "l": 68
  },
  {
    "p": "src/components/system/WorkerStatusPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { formatDistanceToNow } from 'date-fns';\nimport { Cpu, ChevronRight } from 'lucide-react';\nimport WorkerDetailModal from '@/components/admin/WorkerDetailModal';\n\nexport default function WorkerStatusPanel() {\n  const [selectedWorker, setSelectedWorker] = useState(null);\n  const { orgId } = useCurrentUser();\n\n  const { data: workers = [] } = useQuery({\n    queryKey: ['worker-status', orgId],",
    "b": true,
    "l": 71
  },
  {
    "p": "src/components/ui/ActivityFeed.jsx",
    "v": "import React from 'react';\nimport { formatDistanceToNow } from 'date-fns';\n\n/**\n * Generic activity feed.\n * items: [{ id, icon?, title, subtitle?, timestamp, color? }]\n */\nexport default function ActivityFeed({ items = [], loading, maxHeight = 'max-h-96', emptyText = 'No activity yet' }) {\n  if (loading) {\n    return (\n      <div className=\"space-y-3 p-4\">\n        {[...Array(4)].map((_, i) => (\n          <div key={i} className=\"flex gap-3 animate-pulse\">\n            <div className=\"w-7 h-7 rounded-full bg-white/5 shrink-0\" />\n            <div className=\"flex-1 space-y-1.5 pt-1\">",
    "b": true,
    "l": 52
  },
  {
    "p": "src/components/ui/AlertBanner.jsx",
    "v": "import React from 'react';\nimport { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';\n\nconst VARIANTS = {\n  success: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', Icon: CheckCircle2 },\n  error:   { bg: 'bg-red-500/10 border-red-500/20',         text: 'text-red-400',     Icon: XCircle },\n  warning: { bg: 'bg-yellow-500/10 border-yellow-500/20',   text: 'text-yellow-400',  Icon: AlertTriangle },\n  info:    { bg: 'bg-blue-500/10 border-blue-500/20',       text: 'text-blue-400',    Icon: Info },\n};\n\nexport default function AlertBanner({ type = 'info', title, message, onDismiss }) {\n  const { bg, text, Icon } = VARIANTS[type] || VARIANTS.info;\n  return (",
    "b": true,
    "l": 27
  },
  {
    "p": "src/components/ui/BulkActions.jsx",
    "v": "import React from 'react';\nimport { Trash2, Archive, Download, CheckCircle2 } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nexport default function BulkActions({ selected = [], onAction, isLoading }) {\n  if (selected.length === 0) return null;\n\n  return (\n    <div className=\"fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#1e293b] border border-white/10 rounded-xl p-4 shadow-2xl flex items-center gap-4 z-40\">\n      <span className=\"text-sm font-medium text-white\">\n        {selected.length} selected\n      </span>\n\n      <div className=\"flex gap-2\">\n        <Button",
    "b": true,
    "l": 61
  },
  {
    "p": "src/components/ui/DataTable.jsx",
    "v": "import React from 'react';\nimport { TableSkeleton } from './LoadingSkeleton';\n\n/**\n * Generic dark-themed data table.\n * columns: [{ key, label, render?, className? }]\n * rows: array of data objects (must have .id)\n */\nexport default function DataTable({ columns, rows = [], loading, emptyText = 'No data', className = '' }) {\n  return (\n    <div className={`bg-[#13151c] border border-white/5 rounded-xl overflow-hidden ${className}`}>\n      <div className=\"overflow-x-auto\">\n        <table className=\"w-full text-sm\">\n          <thead className=\"border-b border-white/5\">\n            <tr>",
    "b": true,
    "l": 53
  },
  {
    "p": "src/components/ui/DesignSystemReference.jsx",
    "v": "/**\n * Design System Reference\n * \n * Colors:\n * - Primary: #2563eb (blue-600)\n * - Success: #16a34a (green-600)\n * - Warning: #f59e0b (amber-500)\n * - Danger: #dc2626 (red-600)\n * - Background: #0f172a (slate-950)\n * - Surface: #1e293b (slate-800)\n * \n * Component States:\n * - Loading: opacity-50, pointer-events-none, animate-pulse\n * - Empty: text-white/25, centered, icon + message\n * - Error: bg-red-500/10, border-red-500/20, text-red-400",
    "b": true,
    "l": 57
  },
  {
    "p": "src/components/ui/FilterBar.jsx",
    "v": "import React from 'react';\nimport { Search, Filter } from 'lucide-react';\n\n/**\n * Reusable filter bar.\n * filters: [{ key, label, options: [{ value, label }] }]\n * values: { [key]: value }\n * onChange: (key, value) => void\n */\nexport default function FilterBar({ search, onSearch, filters = [], values = {}, onChange, count, countLabel = 'results' }) {\n  return (\n    <div className=\"flex flex-wrap items-center gap-2\">\n      {onSearch !== undefined && (\n        <div className=\"relative flex-1 min-w-48 max-w-xs\">\n          <Search className=\"absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25\" />",
    "b": true,
    "l": 44
  },
  {
    "p": "src/components/ui/KeyboardShortcuts.jsx",
    "v": "import React, { useEffect, useState } from 'react';\nimport { X } from 'lucide-react';\n\nexport default function KeyboardShortcuts() {\n  const [open, setOpen] = useState(false);\n\n  useEffect(() => {\n    const handler = (e) => {\n      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '?') {\n        e.preventDefault();\n        setOpen(o => !o);\n      }\n      if (e.key === 'Escape') setOpen(false);\n    };\n    window.addEventListener('keydown', handler);",
    "b": true,
    "l": 62
  },
  {
    "p": "src/components/ui/LoadingSkeleton.jsx",
    "v": "import React from 'react';\n\nexport function Skeleton({ className = '' }) {\n  return <div className={`animate-pulse rounded bg-white/5 ${className}`} />;\n}\n\nexport function CardSkeleton() {\n  return (\n    <div className=\"bg-[#13151c] border border-white/5 rounded-xl p-4 space-y-3\">\n      <Skeleton className=\"h-3 w-1/3\" />\n      <Skeleton className=\"h-6 w-1/2\" />\n      <Skeleton className=\"h-3 w-2/3\" />\n    </div>\n  );\n}",
    "b": true,
    "l": 35
  },
  {
    "p": "src/components/ui/StatsCard.jsx",
    "v": "import React from 'react';\n\nexport default function StatsCard({ label, value, sub, icon: Icon, trend, className = '' }) {\n  return (\n    <div className={`bg-[#13151c] border border-white/5 rounded-xl p-4 ${className}`}>\n      <div className=\"flex items-start justify-between\">\n        <div>\n          <div className=\"text-xs text-white/35 font-medium uppercase tracking-wide mb-1\">{label}</div>\n          <div className=\"text-2xl font-bold text-white\">{value ?? '—'}</div>\n          {sub && <div className=\"text-xs text-white/35 mt-0.5\">{sub}</div>}\n          {trend !== undefined && (\n            <div className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>",
    "b": true,
    "l": 25
  },
  {
    "p": "src/components/ui/StatusBadge.jsx",
    "v": "import React from 'react';\n\nconst VARIANTS = {\n  // Lead statuses\n  new:           'bg-slate-800 text-slate-300',\n  raw:           'bg-slate-800 text-slate-300',\n  qualified:     'bg-blue-500/15 text-blue-400',\n  enriched:      'bg-purple-500/15 text-purple-400',\n  contact_ready: 'bg-amber-500/15 text-amber-400',\n  contacted:     'bg-green-500/15 text-green-400',\n  outreach_sent: 'bg-green-500/15 text-green-400',\n  replied:       'bg-emerald-500/15 text-emerald-400',\n  disqualified:  'bg-red-500/15 text-red-400',\n  // Approval\n  pending:       'bg-yellow-500/15 text-yellow-400',",
    "b": true,
    "l": 48
  },
  {
    "p": "src/components/ui/VirtualTable.jsx",
    "v": "import React from 'react';\nimport { FixedSizeList as List } from 'react-window';\n\nexport default function VirtualTable({ columns, data, height = 500, itemSize = 50, renderRow }) {\n  if (!data?.length) {\n    return (\n      <div className=\"flex items-center justify-center h-32 text-white/40\">\n        No data\n      </div>\n    );\n  }\n\n  return (\n    <div>\n      {/* Header */}",
    "b": true,
    "l": 34
  },
  {
    "p": "src/components/ui/accordion.jsx",
    "v": "import * as React from \"react\"\nimport * as AccordionPrimitive from \"@radix-ui/react-accordion\"\nimport { ChevronDown } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Accordion = AccordionPrimitive.Root\n\nconst AccordionItem = React.forwardRef(({ className, ...props }, ref) => (\n  <AccordionPrimitive.Item ref={ref} className={cn(\"border-b\", className)} {...props} />\n))\nAccordionItem.displayName = \"AccordionItem\"\n\nconst AccordionTrigger = React.forwardRef(({ className, children, ...props }, ref) => (\n  <AccordionPrimitive.Header className=\"flex\">",
    "b": true,
    "l": 42
  },
  {
    "p": "src/components/ui/alert-dialog.jsx",
    "v": "import * as React from \"react\"\nimport * as AlertDialogPrimitive from \"@radix-ui/react-alert-dialog\"\n\nimport { cn } from \"@/lib/utils\"\nimport { buttonVariants } from \"@/components/ui/button\"\n\nconst AlertDialog = AlertDialogPrimitive.Root\n\nconst AlertDialogTrigger = AlertDialogPrimitive.Trigger\n\nconst AlertDialogPortal = AlertDialogPrimitive.Portal\n\nconst AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (\n  <AlertDialogPrimitive.Overlay\n    className={cn(",
    "b": true,
    "l": 98
  },
  {
    "p": "src/components/ui/alert.jsx",
    "v": "import * as React from \"react\"\nimport { cva } from \"class-variance-authority\";\n\nimport { cn } from \"@/lib/utils\"\n\nconst alertVariants = cva(\n  \"relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7\",\n  {\n    variants: {\n      variant: {\n        default: \"bg-background text-foreground\",\n        destructive:\n          \"border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive\",\n      },\n    },",
    "b": true,
    "l": 48
  },
  {
    "p": "src/components/ui/aspect-ratio.jsx",
    "v": "import * as AspectRatioPrimitive from \"@radix-ui/react-aspect-ratio\"\n\nconst AspectRatio = AspectRatioPrimitive.Root",
    "b": false,
    "l": 6
  },
  {
    "p": "src/components/ui/avatar.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport * as AvatarPrimitive from \"@radix-ui/react-avatar\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Avatar = React.forwardRef(({ className, ...props }, ref) => (\n  <AvatarPrimitive.Root\n    ref={ref}\n    className={cn(\"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full\", className)}\n    {...props} />\n))\nAvatar.displayName = AvatarPrimitive.Root.displayName\n",
    "b": true,
    "l": 36
  },
  {
    "p": "src/components/ui/badge.jsx",
    "v": "import * as React from \"react\"\nimport { cva } from \"class-variance-authority\";\n\nimport { cn } from \"@/lib/utils\"\n\nconst badgeVariants = cva(\n  \"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2\",\n  {\n    variants: {\n      variant: {\n        default:\n          \"border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80\",\n        secondary:\n          \"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80\",\n        destructive:",
    "b": true,
    "l": 35
  },
  {
    "p": "src/components/ui/breadcrumb.jsx",
    "v": "import * as React from \"react\"\nimport { Slot } from \"@radix-ui/react-slot\"\nimport { ChevronRight, MoreHorizontal } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Breadcrumb = React.forwardRef(\n  ({ ...props }, ref) => <nav ref={ref} aria-label=\"breadcrumb\" {...props} />\n)\nBreadcrumb.displayName = \"Breadcrumb\"\n\nconst BreadcrumbList = React.forwardRef(({ className, ...props }, ref) => (\n  <ol\n    ref={ref}\n    className={cn(",
    "b": true,
    "l": 93
  },
  {
    "p": "src/components/ui/button.jsx",
    "v": "import * as React from \"react\"\nimport { Slot } from \"@radix-ui/react-slot\"\nimport { cva } from \"class-variance-authority\";\n\nimport { cn } from \"@/lib/utils\"\n\nconst buttonVariants = cva(\n  \"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0\",\n  {\n    variants: {\n      variant: {\n        default:\n          \"bg-primary text-primary-foreground shadow hover:bg-primary/90\",\n        destructive:\n          \"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90\",",
    "b": true,
    "l": 49
  },
  {
    "p": "src/components/ui/calendar.jsx",
    "v": "import * as React from \"react\"\nimport { ChevronLeft, ChevronRight } from \"lucide-react\"\nimport { DayPicker } from \"react-day-picker\"\n\nimport { cn } from \"@/lib/utils\"\nimport { buttonVariants } from \"@/components/ui/button\"\n\nfunction Calendar({\n  className,\n  classNames,\n  showOutsideDays = true,\n  ...props\n}) {\n  return (\n    (<DayPicker",
    "b": true,
    "l": 72
  },
  {
    "p": "src/components/ui/card.jsx",
    "v": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Card = React.forwardRef(({ className, ...props }, ref) => (\n  <div\n    ref={ref}\n    className={cn(\"rounded-xl border bg-card text-card-foreground shadow\", className)}\n    {...props} />\n))\nCard.displayName = \"Card\"\n\nconst CardHeader = React.forwardRef(({ className, ...props }, ref) => (\n  <div\n    ref={ref}",
    "b": true,
    "l": 51
  },
  {
    "p": "src/components/ui/carousel.jsx",
    "v": "import * as React from \"react\"\nimport useEmblaCarousel from \"embla-carousel-react\";\nimport { ArrowLeft, ArrowRight } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\n\nconst CarouselContext = React.createContext(null)\n\nfunction useCarousel() {\n  const context = React.useContext(CarouselContext)\n\n  if (!context) {\n    throw new Error(\"useCarousel must be used within a <Carousel />\")\n  }",
    "b": true,
    "l": 194
  },
  {
    "p": "src/components/ui/chart.jsx",
    "v": "\"use client\";\nimport * as React from \"react\"\nimport * as RechartsPrimitive from \"recharts\"\n\nimport { cn } from \"@/lib/utils\"\n\n// Format: { THEME_NAME: CSS_SELECTOR }\nconst THEMES = {\n  light: \"\",\n  dark: \".dark\"\n}\n\nconst ChartContext = React.createContext(null)\n\nfunction useChart() {",
    "b": true,
    "l": 310
  },
  {
    "p": "src/components/ui/checkbox.jsx",
    "v": "import * as React from \"react\"\nimport * as CheckboxPrimitive from \"@radix-ui/react-checkbox\"\nimport { Check } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Checkbox = React.forwardRef(({ className, ...props }, ref) => (\n  <CheckboxPrimitive.Root\n    ref={ref}\n    className={cn(\n      \"peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground\",",
    "b": true,
    "l": 23
  },
  {
    "p": "src/components/ui/collapsible.jsx",
    "v": "\"use client\"\n\nimport * as CollapsiblePrimitive from \"@radix-ui/react-collapsible\"\n\nconst Collapsible = CollapsiblePrimitive.Root\n",
    "b": false,
    "l": 12
  },
  {
    "p": "src/components/ui/command.jsx",
    "v": "import * as React from \"react\"\nimport { Command as CommandPrimitive } from \"cmdk\"\nimport { Search } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Dialog, DialogContent } from \"@/components/ui/dialog\"\n\nconst Command = React.forwardRef(({ className, ...props }, ref) => (\n  <CommandPrimitive\n    ref={ref}\n    className={cn(\n      \"flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground\",\n      className\n    )}\n    {...props} />",
    "b": true,
    "l": 117
  },
  {
    "p": "src/components/ui/context-menu.jsx",
    "v": "import * as React from \"react\"\nimport * as ContextMenuPrimitive from \"@radix-ui/react-context-menu\"\nimport { Check, ChevronRight, Circle } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst ContextMenu = ContextMenuPrimitive.Root\n\nconst ContextMenuTrigger = ContextMenuPrimitive.Trigger\n\nconst ContextMenuGroup = ContextMenuPrimitive.Group\n\nconst ContextMenuPortal = ContextMenuPrimitive.Portal\n\nconst ContextMenuSub = ContextMenuPrimitive.Sub",
    "b": true,
    "l": 157
  },
  {
    "p": "src/components/ui/dialog.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport * as DialogPrimitive from \"@radix-ui/react-dialog\"\nimport { X } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Dialog = DialogPrimitive.Root\n\nconst DialogTrigger = DialogPrimitive.Trigger\n\nconst DialogPortal = DialogPrimitive.Portal\n\nconst DialogClose = DialogPrimitive.Close",
    "b": true,
    "l": 97
  },
  {
    "p": "src/components/ui/drawer.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport { Drawer as DrawerPrimitive } from \"vaul\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Drawer = ({\n  shouldScaleBackground = true,\n  ...props\n}) => (\n  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />\n)\nDrawer.displayName = \"Drawer\"\n",
    "b": true,
    "l": 93
  },
  {
    "p": "src/components/ui/dropdown-menu.jsx",
    "v": "import * as React from \"react\"\nimport * as DropdownMenuPrimitive from \"@radix-ui/react-dropdown-menu\"\nimport { Check, ChevronRight, Circle } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst DropdownMenu = DropdownMenuPrimitive.Root\n\nconst DropdownMenuTrigger = DropdownMenuPrimitive.Trigger\n\nconst DropdownMenuGroup = DropdownMenuPrimitive.Group\n\nconst DropdownMenuPortal = DropdownMenuPrimitive.Portal\n\nconst DropdownMenuSub = DropdownMenuPrimitive.Sub",
    "b": true,
    "l": 157
  },
  {
    "p": "src/components/ui/form.jsx",
    "v": "\"use client\";\nimport * as React from \"react\"\nimport { Slot } from \"@radix-ui/react-slot\"\nimport { Controller, FormProvider, useFormContext } from \"react-hook-form\";\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\n\nconst Form = FormProvider\n\nconst FormFieldContext = React.createContext({})\n\nconst FormField = (\n  {\n    ...props",
    "b": true,
    "l": 135
  },
  {
    "p": "src/components/ui/hover-card.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport * as HoverCardPrimitive from \"@radix-ui/react-hover-card\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst HoverCard = HoverCardPrimitive.Root\n\nconst HoverCardTrigger = HoverCardPrimitive.Trigger\n\nconst HoverCardContent = React.forwardRef(({ className, align = \"center\", sideOffset = 4, ...props }, ref) => (\n  <HoverCardPrimitive.Content",
    "b": true,
    "l": 26
  },
  {
    "p": "src/components/ui/input-otp.jsx",
    "v": "import * as React from \"react\"\nimport { OTPInput, OTPInputContext } from \"input-otp\"\nimport { Minus } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst InputOTP = React.forwardRef(({ className, containerClassName, ...props }, ref) => (\n  <OTPInput\n    ref={ref}\n    containerClassName={cn(\"flex items-center gap-2 has-[:disabled]:opacity-50\", containerClassName)}\n    className={cn(\"disabled:cursor-not-allowed\", className)}\n    {...props} />\n))\nInputOTP.displayName = \"InputOTP\"\n",
    "b": true,
    "l": 54
  },
  {
    "p": "src/components/ui/input.jsx",
    "v": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Input = React.forwardRef(({ className, type, ...props }, ref) => {\n  return (\n    (<input\n      type={type}\n      className={cn(\n        \"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm\",",
    "b": true,
    "l": 20
  },
  {
    "p": "src/components/ui/label.jsx",
    "v": "import * as React from \"react\"\nimport * as LabelPrimitive from \"@radix-ui/react-label\"\nimport { cva } from \"class-variance-authority\";\n\nimport { cn } from \"@/lib/utils\"\n\nconst labelVariants = cva(\n  \"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70\"",
    "b": true,
    "l": 17
  },
  {
    "p": "src/components/ui/menubar.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport * as MenubarPrimitive from \"@radix-ui/react-menubar\"\nimport { Check, ChevronRight, Circle } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nfunction MenubarMenu({\n  ...props\n}) {\n  return <MenubarPrimitive.Menu {...props} />;\n}\n\nfunction MenubarGroup({",
    "b": true,
    "l": 201
  },
  {
    "p": "src/components/ui/navigation-menu.jsx",
    "v": "import * as React from \"react\"\nimport * as NavigationMenuPrimitive from \"@radix-ui/react-navigation-menu\"\nimport { cva } from \"class-variance-authority\"\nimport { ChevronDown } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst NavigationMenu = React.forwardRef(({ className, children, ...props }, ref) => (\n  <NavigationMenuPrimitive.Root\n    ref={ref}\n    className={cn(\n      \"relative z-10 flex max-w-max flex-1 items-center justify-center\",\n      className\n    )}\n    {...props}>",
    "b": true,
    "l": 105
  },
  {
    "p": "src/components/ui/pagination.jsx",
    "v": "import * as React from \"react\"\nimport { ChevronLeft, ChevronRight, MoreHorizontal } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\nimport { buttonVariants } from \"@/components/ui/button\";\n\nconst Pagination = ({\n  className,\n  ...props\n}) => (\n  <nav\n    role=\"navigation\"\n    aria-label=\"pagination\"\n    className={cn(\"mx-auto flex w-full justify-center\", className)}\n    {...props} />",
    "b": true,
    "l": 101
  },
  {
    "p": "src/components/ui/popover.jsx",
    "v": "import * as React from \"react\"\nimport * as PopoverPrimitive from \"@radix-ui/react-popover\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Popover = PopoverPrimitive.Root\n\nconst PopoverTrigger = PopoverPrimitive.Trigger\n\nconst PopoverAnchor = PopoverPrimitive.Anchor\n\nconst PopoverContent = React.forwardRef(({ className, align = \"center\", sideOffset = 4, ...props }, ref) => (\n  <PopoverPrimitive.Portal>\n    <PopoverPrimitive.Content",
    "b": true,
    "l": 28
  },
  {
    "p": "src/components/ui/progress.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport * as ProgressPrimitive from \"@radix-ui/react-progress\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Progress = React.forwardRef(({ className, value, ...props }, ref) => (\n  <ProgressPrimitive.Root\n    ref={ref}\n    className={cn(\n      \"relative h-2 w-full overflow-hidden rounded-full bg-primary/20\",",
    "b": true,
    "l": 24
  },
  {
    "p": "src/components/ui/radio-group.jsx",
    "v": "import * as React from \"react\"\nimport * as RadioGroupPrimitive from \"@radix-ui/react-radio-group\"\nimport { Circle } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst RadioGroup = React.forwardRef(({ className, ...props }, ref) => {\n  return (<RadioGroupPrimitive.Root className={cn(\"grid gap-2\", className)} {...props} ref={ref} />);\n})\nRadioGroup.displayName = RadioGroupPrimitive.Root.displayName\n\nconst RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => {\n  return (\n    (<RadioGroupPrimitive.Item\n      ref={ref}",
    "b": true,
    "l": 30
  },
  {
    "p": "src/components/ui/resizable.jsx",
    "v": "\"use client\"\n\nimport { GripVertical } from \"lucide-react\"\nimport * as ResizablePrimitive from \"react-resizable-panels\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst ResizablePanelGroup = ({\n  className,\n  ...props\n}) => (\n  <ResizablePrimitive.PanelGroup\n    className={cn(\n      \"flex h-full w-full data-[panel-group-direction=vertical]:flex-col\",\n      className",
    "b": true,
    "l": 43
  },
  {
    "p": "src/components/ui/scroll-area.jsx",
    "v": "import * as React from \"react\"\nimport * as ScrollAreaPrimitive from \"@radix-ui/react-scroll-area\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (\n  <ScrollAreaPrimitive.Root\n    ref={ref}\n    className={cn(\"relative overflow-hidden\", className)}\n    {...props}>\n    <ScrollAreaPrimitive.Viewport className=\"h-full w-full rounded-[inherit]\">\n      {children}\n    </ScrollAreaPrimitive.Viewport>\n    <ScrollBar />\n    <ScrollAreaPrimitive.Corner />",
    "b": true,
    "l": 39
  },
  {
    "p": "src/components/ui/select.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport * as SelectPrimitive from \"@radix-ui/react-select\"\nimport { Check, ChevronDown, ChevronUp } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Select = SelectPrimitive.Root\n\nconst SelectGroup = SelectPrimitive.Group\n\nconst SelectValue = SelectPrimitive.Value\n\nconst SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (",
    "b": true,
    "l": 122
  },
  {
    "p": "src/components/ui/separator.jsx",
    "v": "import * as React from \"react\"\nimport * as SeparatorPrimitive from \"@radix-ui/react-separator\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Separator = React.forwardRef((\n  { className, orientation = \"horizontal\", decorative = true, ...props },\n  ref\n) => (\n  <SeparatorPrimitive.Root\n    ref={ref}\n    decorative={decorative}",
    "b": true,
    "l": 24
  },
  {
    "p": "src/components/ui/sheet.jsx",
    "v": "\"use client\";\nimport * as React from \"react\"\nimport * as SheetPrimitive from \"@radix-ui/react-dialog\"\nimport { cva } from \"class-variance-authority\";\nimport { X } from \"lucide-react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Sheet = SheetPrimitive.Root\n\nconst SheetTrigger = SheetPrimitive.Trigger\n\nconst SheetClose = SheetPrimitive.Close\n\nconst SheetPortal = SheetPrimitive.Portal",
    "b": true,
    "l": 110
  },
  {
    "p": "src/components/ui/sidebar.jsx",
    "v": "import * as React from \"react\"\nimport { Slot } from \"@radix-ui/react-slot\"\nimport { cva } from \"class-variance-authority\";\nimport { PanelLeft } from \"lucide-react\"\n\nimport { useIsMobile } from \"@/hooks/use-mobile\"\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport { Input } from \"@/components/ui/input\"\nimport { Separator } from \"@/components/ui/separator\"\nimport { Sheet, SheetContent } from \"@/components/ui/sheet\"\nimport { Skeleton } from \"@/components/ui/skeleton\"\nimport {\n  Tooltip,\n  TooltipContent,",
    "b": true,
    "l": 627
  },
  {
    "p": "src/components/ui/skeleton.jsx",
    "v": "import { cn } from \"@/lib/utils\"\n\nfunction Skeleton({\n  className,\n  ...props\n}) {\n  return (",
    "b": false,
    "l": 15
  },
  {
    "p": "src/components/ui/slider.jsx",
    "v": "import * as React from \"react\"\nimport * as SliderPrimitive from \"@radix-ui/react-slider\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Slider = React.forwardRef(({ className, ...props }, ref) => (\n  <SliderPrimitive.Root\n    ref={ref}\n    className={cn(\"relative flex w-full touch-none select-none items-center\", className)}\n    {...props}>\n    <SliderPrimitive.Track",
    "b": true,
    "l": 22
  },
  {
    "p": "src/components/ui/sonner.jsx",
    "v": "\"use client\";\nimport { useTheme } from \"next-themes\"\nimport { Toaster as Sonner } from \"sonner\"\n\nconst Toaster = ({\n  ...props\n}) => {\n  const { theme = \"system\" } = useTheme()\n\n  return (\n    (<Sonner\n      theme={theme}\n      className=\"toaster group\"\n      toastOptions={{\n        classNames: {",
    "b": true,
    "l": 30
  },
  {
    "p": "src/components/ui/switch.jsx",
    "v": "import * as React from \"react\"\nimport * as SwitchPrimitives from \"@radix-ui/react-switch\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Switch = React.forwardRef(({ className, ...props }, ref) => (\n  <SwitchPrimitives.Root\n    className={cn(\n      \"peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input\",\n      className\n    )}",
    "b": true,
    "l": 23
  },
  {
    "p": "src/components/ui/table.jsx",
    "v": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Table = React.forwardRef(({ className, ...props }, ref) => (\n  <div className=\"relative w-full overflow-auto\">\n    <table\n      ref={ref}\n      className={cn(\"w-full caption-bottom text-sm\", className)}\n      {...props} />\n  </div>\n))\nTable.displayName = \"Table\"\n\nconst TableHeader = React.forwardRef(({ className, ...props }, ref) => (",
    "b": true,
    "l": 87
  },
  {
    "p": "src/components/ui/tabs.jsx",
    "v": "import * as React from \"react\"\nimport * as TabsPrimitive from \"@radix-ui/react-tabs\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Tabs = TabsPrimitive.Root\n\nconst TabsList = React.forwardRef(({ className, ...props }, ref) => (\n  <TabsPrimitive.List\n    ref={ref}\n    className={cn(\n      \"inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground\",\n      className\n    )}\n    {...props} />",
    "b": true,
    "l": 42
  },
  {
    "p": "src/components/ui/textarea.jsx",
    "v": "import * as React from \"react\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst Textarea = React.forwardRef(({ className, ...props }, ref) => {\n  return (\n    <textarea\n      className={cn(\n        \"flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm\",\n        className",
    "b": true,
    "l": 20
  },
  {
    "p": "src/components/ui/toast.jsx",
    "v": "import * as React from \"react\";\nimport { cva } from \"class-variance-authority\";\nimport { X } from \"lucide-react\";\nimport { cn } from \"@/lib/utils\";\n\nconst ToastProvider = React.forwardRef(({ ...props }, ref) => (\n  <div\n    ref={ref}\n    className=\"fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]\"\n    {...props}\n  />\n));\nToastProvider.displayName = \"ToastProvider\";\n\nconst ToastViewport = React.forwardRef(({ ...props }, ref) => (",
    "b": true,
    "l": 104
  },
  {
    "p": "src/components/ui/toaster.jsx",
    "v": "import { useToast } from \"@/components/ui/use-toast\";\nimport {\n  Toast,\n  ToastClose,\n  ToastDescription,\n  ToastProvider,\n  ToastTitle,\n  ToastViewport,\n} from \"@/components/ui/toast\";\n\nexport function Toaster() {\n  const { toasts } = useToast();\n\n  return (\n    <ToastProvider>",
    "b": true,
    "l": 33
  },
  {
    "p": "src/components/ui/toggle-group.jsx",
    "v": "\"use client\";\nimport * as React from \"react\"\nimport * as ToggleGroupPrimitive from \"@radix-ui/react-toggle-group\"\n\nimport { cn } from \"@/lib/utils\"\nimport { toggleVariants } from \"@/components/ui/toggle\"\n\nconst ToggleGroupContext = React.createContext({\n  size: \"default\",\n  variant: \"default\",\n})\n\nconst ToggleGroup = React.forwardRef(({ className, variant, size, children, ...props }, ref) => (\n  <ToggleGroupPrimitive.Root\n    ref={ref}",
    "b": true,
    "l": 45
  },
  {
    "p": "src/components/ui/toggle.jsx",
    "v": "import * as React from \"react\"\nimport * as TogglePrimitive from \"@radix-ui/react-toggle\"\nimport { cva } from \"class-variance-authority\";\n\nimport { cn } from \"@/lib/utils\"\n\nconst toggleVariants = cva(\n  \"inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0\",\n  {\n    variants: {\n      variant: {\n        default: \"bg-transparent\",\n        outline:\n          \"border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground\",\n      },",
    "b": true,
    "l": 39
  },
  {
    "p": "src/components/ui/tooltip.jsx",
    "v": "\"use client\"\n\nimport * as React from \"react\"\nimport * as TooltipPrimitive from \"@radix-ui/react-tooltip\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst TooltipProvider = TooltipPrimitive.Provider\n\nconst Tooltip = TooltipPrimitive.Root\n\nconst TooltipTrigger = TooltipPrimitive.Trigger\n\nconst TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (",
    "b": true,
    "l": 29
  },
  {
    "p": "src/components/ui/use-toast.jsx",
    "v": "// Inspired by react-hot-toast library\nimport { useState, useEffect } from \"react\";\n\nconst TOAST_LIMIT = 20;\nconst TOAST_REMOVE_DELAY = 1000000;\n\nconst actionTypes = {\n  ADD_TOAST: \"ADD_TOAST\",\n  UPDATE_TOAST: \"UPDATE_TOAST\",\n  DISMISS_TOAST: \"DISMISS_TOAST\",\n  REMOVE_TOAST: \"REMOVE_TOAST\",\n};\n\nlet count = 0;\n",
    "b": true,
    "l": 164
  },
  {
    "p": "src/globals.css",
    "v": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n/* ───────────────── GLOBAL BACKGROUND ───────────────── */\n\nbody {\n  background:\n    radial-gradient(900px 400px at 50% -200px, #60a5fa33, transparent),\n    radial-gradient(700px 300px at 80% 110%, #ec489933, transparent),\n    radial-gradient(600px 300px at 10% 110%, #10b98122, transparent),\n    linear-gradient(180deg, #0a1628, #050d1f);\n\n  color: white;\n  overflow-x: hidden;",
    "b": true,
    "l": 215
  },
  {
    "p": "src/hooks/use-mobile.jsx",
    "v": "import * as React from \"react\"\n\nconst MOBILE_BREAKPOINT = 768\n\nexport function useIsMobile() {\n  const [isMobile, setIsMobile] = React.useState(undefined)\n\n  React.useEffect(() => {\n    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)\n    const onChange = () => {",
    "b": true,
    "l": 20
  },
  {
    "p": "src/hooks/useCurrentUser.js",
    "v": "import { useQuery } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\n\nexport function useCurrentUser() {\n  const { data: user, isLoading } = useQuery({\n    queryKey: ['current-user'],\n    queryFn: () => base44.auth.me().catch(() => null),\n    staleTime: 5 * 60 * 1000,\n  });\n\n  const { data: seat } = useQuery({\n    queryKey: ['current-seat', user?.id],\n    queryFn: async () => {\n      if (!user?.id) return null;\n      // Try with organization_id first if available",
    "b": true,
    "l": 76
  },
  {
    "p": "src/hooks/useVisibility.js",
    "v": "import { useQuery } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from './useCurrentUser';\n\nexport function useVisibility() {\n  const { role, isSuperAdmin, isAdmin, hasPermission } = useCurrentUser();\n\n  const { data: rulesData = [] } = useQuery({\n    queryKey: ['visibility-rules'],\n    queryFn: () => base44.functions\n      .invoke('getVisibilityRules', {})\n      .then(r => r?.data?.rules || r?.rules || [])\n      .catch(() => []),\n    staleTime: 60 * 1000,\n  });",
    "b": true,
    "l": 37
  },
  {
    "p": "src/index.css",
    "v": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n@layer base {\n  :root {\n    --background: 0 0% 100%;\n    --foreground: 0 0% 3.9%;\n    --card: 0 0% 100%;\n    --card-foreground: 0 0% 3.9%;\n    --popover: 0 0% 100%;\n    --popover-foreground: 0 0% 3.9%;\n    --primary: 0 0% 9%;\n    --primary-foreground: 0 0% 98%;\n    --secondary: 0 0% 96.1%;",
    "b": true,
    "l": 88
  },
  {
    "p": "src/lib/AuthContext.jsx",
    "v": "import React, { createContext, useState, useContext, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { appParams } from '@/lib/app-params';\nimport { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';\n\nconst AuthContext = createContext();\n\nexport const AuthProvider = ({ children }) => {\n  const [user, setUser] = useState(null);\n  const [isAuthenticated, setIsAuthenticated] = useState(false);\n  const [isLoadingAuth, setIsLoadingAuth] = useState(true);\n  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);\n  const [authError, setAuthError] = useState(null);\n  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }\n",
    "b": true,
    "l": 238
  },
  {
    "p": "src/lib/PageNotFound.jsx",
    "v": "import { useLocation } from 'react-router-dom';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\n\n\nexport default function PageNotFound({}) {\n    const location = useLocation();\n    const pageName = location.pathname.substring(1);\n\n    const { data: authData, isFetched } = useQuery({\n        queryKey: ['user'],\n        queryFn: async () => {\n            try {\n                const user = await base44.auth.me();\n                return { user, isAuthenticated: true };",
    "b": true,
    "l": 75
  },
  {
    "p": "src/lib/adminQuery.js",
    "v": "/**\n * adminQuery — frontend helper that replaces base44.asServiceRole.entities.*\n * Routes through the adminQuery backend function which enforces admin-only access.\n */\nimport { base44 } from '@/api/base44Client';\n\nexport const adminQuery = {\n  entities: new Proxy({}, {\n    get(_, entity) {\n      return {\n        list: (sort, limit) =>\n          base44.functions.invoke('adminQuery', { entity, action: 'list', sort, limit })\n            .then(r => r.data?.items ?? []),\n        filter: (filter, sort, limit) =>",
    "b": true,
    "l": 29
  },
  {
    "p": "src/lib/app-params.js",
    "v": "const isNode = typeof window === 'undefined';\nconst windowObj = isNode ? { localStorage: new Map() } : window;\nconst storage = windowObj.localStorage;\n\nconst toSnakeCase = (str) => {\n\treturn str.replace(/([A-Z])/g, '_$1').toLowerCase();\n}\n\nconst getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {\n\tif (isNode) {\n\t\treturn defaultValue;\n\t}\n\tconst storageKey = `base44_${toSnakeCase(paramName)}`;\n\tconst urlParams = new URLSearchParams(window.location.search);\n\tconst searchParam = urlParams.get(paramName);",
    "b": true,
    "l": 55
  },
  {
    "p": "src/lib/permitScraper.js",
    "v": "/**\n * Deduplicate city options from Scrappy or merged sources (same key may appear multiple times).\n * First occurrence wins for key + label.\n */\nexport function dedupeScrappyCities(cities) {\n  if (!Array.isArray(cities) || cities.length === 0) return [];\n  const seen = new Map();\n  for (const c of cities) {\n    const rawKey = c?.key ?? c?.id;\n    if (rawKey == null || String(rawKey).trim() === '') continue;\n    const key = String(rawKey).trim();\n    const norm = key.toLowerCase();\n    if (seen.has(norm)) continue;\n    const label = String(c.label ?? c.name ?? key).trim() || key;\n    seen.set(norm, { key, label });",
    "b": true,
    "l": 41
  },
  {
    "p": "src/lib/query-client.js",
    "v": "import { QueryClient } from '@tanstack/react-query';\n\n\nexport const queryClientInstance = new QueryClient({\n\tdefaultOptions: {",
    "b": false,
    "l": 11
  },
  {
    "p": "src/lib/utils.js",
    "v": "import { clsx } from \"clsx\"\nimport { twMerge } from \"tailwind-merge\"\n\nexport function cn(...inputs) {\n  return twMerge(clsx(inputs))",
    "b": false,
    "l": 10
  },
  {
    "p": "src/main.jsx",
    "v": "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from '@/App.jsx'\nimport '@/index.css'",
    "b": false,
    "l": 9
  },
  {
    "p": "src/pages.config.js",
    "v": "/**\n * pages.config.js - Page routing configuration\n * \n * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.\n * Pages are auto-registered when you create files in the ./pages/ folder.\n * \n * THE ONLY EDITABLE VALUE: mainPage\n * This controls which page is the landing page (shown when users visit the app).\n * \n * Example file structure:\n * \n *   import HomePage from './pages/HomePage';\n *   import Dashboard from './pages/Dashboard';\n *   import Settings from './pages/Settings';\n *   ",
    "b": true,
    "l": 136
  },
  {
    "p": "src/pages/AIAgent.jsx",
    "v": "import React, { useState, useEffect, useRef, useMemo } from 'react';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  Mic, Phone, PhoneOff, Play, Square, Edit2, Plus, Copy,\n  Trash2, Save, X, ChevronDown, ChevronUp, RefreshCw,\n  Zap, Radio, Settings, MessageSquare, Eye, Check, Loader2,\n} from 'lucide-react';\nimport Dialer from '@/components/dialer/Dialer';\n\n// ── Helpers ────────────────────────────────────────────────────────────────\nconst DEFAULT_OUTBOUND_SCRIPT = `Identity: You are Alex, an AI outbound sales agent calling on behalf of the team.\n",
    "b": true,
    "l": 810
  },
  {
    "p": "src/pages/Admin.jsx",
    "v": "/**\n * Admin Panel - Enterprise-grade admin dashboard\n * Left sidebar with grouped navigation\n * Dynamic content rendering based on active section\n */\n\nimport React, { useState, useEffect } from 'react';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { useNavigate } from 'react-router-dom';\nimport {\n  LayoutDashboard, Crosshair, Activity, Users, Building2, UserCheck,\n  ScrollText, CreditCard, Users2, Coins, Settings2, ToggleRight,\n  PowerOff, Cpu, ListOrdered, AlertOctagon, GitBranch, Megaphone,\n  Sparkles, Globe, DollarSign, Brain, Shield, FlaskConical, Sun, Zap,\n  HeartPulse, Code2, Terminal, Lock, ChevronRight, X,",
    "b": true,
    "l": 272
  },
  {
    "p": "src/pages/Analytics.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport {\n  AreaChart, Area, BarChart, Bar, LineChart, Line,\n  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,\n  Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList\n} from 'recharts';\nimport {\n  Users, TrendingUp, Send, DollarSign, Zap, Target,\n  BarChart3, MessageSquare, Brain, Activity, ChevronDown,\n  ArrowUpRight, ArrowDownRight, Minus, AlertCircle, CheckCircle2,\n  Clock, Flame, Thermometer, Snowflake, Lock\n} from 'lucide-react';\nimport { useVisibility } from '@/hooks/useVisibility';",
    "b": true,
    "l": 908
  },
  {
    "p": "src/pages/AuditLogs.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  History, RefreshCw, Search, X, Loader2,\n  CheckCircle2, AlertCircle, AlertTriangle, Info,\n  Shield, BarChart3, Zap, ChevronDown, ChevronUp,\n} from 'lucide-react';\n\n// ── Status display helpers ────────────────────────────────────────────────────\nconst STATUS = {\n  pass:    { icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },\n  fail:    { icon: AlertCircle,  color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },",
    "b": true,
    "l": 368
  },
  {
    "p": "src/pages/Automation.jsx",
    "v": "import React from 'react';\nimport WorkerStatusPanel from '@/components/system/WorkerStatusPanel';\nimport QueueHealthIndicator from '@/components/system/QueueHealthIndicator';\nimport CostTrackerPanel from '@/components/system/CostTrackerPanel';\n\nexport default function Automation() {\n  return (\n    <div className=\"p-6 space-y-6\">",
    "b": true,
    "l": 16
  },
  {
    "p": "src/pages/CallMonitor.jsx",
    "v": "import React, { useState, useEffect, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  Phone, PhoneOff, Clock, Send, Loader2, Play, Pause, Copy,\n  Search, Plus, Settings, RefreshCw, AlertCircle, CheckCircle2,\n  MessageSquare, TrendingUp, Zap, X, Eye, Trash2\n} from 'lucide-react';\n\nexport default function CallMonitor() {\n  const queryClient = useQueryClient();\n  const { orgId } = useCurrentUser();\n  const [selectedCallId, setSelectedCallId] = useState(null);",
    "b": true,
    "l": 454
  },
  {
    "p": "src/pages/CampaignBuilder.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useNavigate } from 'react-router-dom';\nimport { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, LayoutTemplate } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport Step1Basics        from '@/components/campaign/builder/Step1Basics.jsx';\nimport Step2DataSources   from '@/components/campaign/builder/Step2DataSources.jsx';\nimport Step3IntentModel   from '@/components/campaign/builder/Step3IntentModel.jsx';\nimport Step4AIIntelligence from '@/components/campaign/builder/Step4AIIntelligence.jsx';\nimport Step5LeadFilters   from '@/components/campaign/builder/Step5LeadFilters.jsx';\nimport Step6Outreach      from '@/components/campaign/builder/Step6Outreach.jsx';\nimport Step7BudgetLimits  from '@/components/campaign/builder/Step7BudgetLimits.jsx';\nimport Step8Review        from '@/components/campaign/builder/Step8Review.jsx';\n\nconst STEPS = [",
    "b": true,
    "l": 450
  },
  {
    "p": "src/pages/CampaignDetail.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useParams, useSearchParams, useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport {\n  Play, Pause, Settings, BarChart3, Users, Activity,\n  Cpu, FileText, ArrowLeft, ChevronDown,\n  CheckCircle2, AlertTriangle, Clock, TrendingUp, Send,\n  MessageSquare, DollarSign, Zap, RefreshCw, Wind,\n} from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport CampaignAnalytics from '@/components/campaign/CampaignAnalytics';\nimport EnrolledLeads from '@/components/campaign/EnrolledLeads';",
    "b": true,
    "l": 383
  },
  {
    "p": "src/pages/CampaignEngine.jsx",
    "v": "import React from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\n\nconst ADMIN_PAGES = [\n  { id: 'builder', label: '🏗️ Campaign Builder', desc: 'Create and configure campaigns' },\n  { id: 'workflows', label: '⚙️ Campaign Workflows', desc: 'View active campaign pipelines' },\n  { id: 'workers', label: '👷 Campaign Workers', desc: 'Monitor worker status and performance' },\n  { id: 'queue', label: '📋 Job Queue', desc: 'Inspect pending and completed jobs' },\n  { id: 'aiusage', label: '🤖 AI Usage', desc: 'Track AI costs and token consumption' },\n  { id: 'errors', label: '⚠️ Error Logs', desc: 'View worker errors and failures' },\n  { id: 'analytics', label: '📊 Campaign Analytics', desc: 'Campaign performance metrics' },\n];\n\nexport default function CampaignEngine() {",
    "b": true,
    "l": 58
  },
  {
    "p": "src/pages/CampaignEngineAiUsage.jsx",
    "v": "import { AICostLog } from '@/api/entities';\nimport React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';\n\nexport default function CampaignEngineAiUsage() {\n  const { data: aiLogs = [] } = useQuery({\n    queryKey: ['ai-cost-logs'],\n    queryFn: () => AICostLog.filter({}, '-timestamp', 200),\n  });\n\n  const { data: campaigns = [] } = useQuery({\n    queryKey: ['campaigns-for-ai'],\n    queryFn: () => base44.entities.Campaign.list('-created_date', 50),",
    "b": true,
    "l": 132
  },
  {
    "p": "src/pages/CampaignEngineAnalytics.jsx",
    "v": "import React, { useMemo } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';\n\nconst COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];\n\nexport default function CampaignEngineAnalytics() {\n  const { data: campaigns = [] } = useQuery({\n    queryKey: ['campaigns-analytics'],\n    queryFn: () => base44.entities.Campaign.list('-created_date', 50),\n  });\n\n  const { data: jobs = [] } = useQuery({\n    queryKey: ['jobs-analytics'],",
    "b": true,
    "l": 164
  },
  {
    "p": "src/pages/CampaignEngineErrors.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { AlertCircle } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nexport default function CampaignEngineErrors() {\n  const queryClient = useQueryClient();\n  const { data: failedJobs = [] } = useQuery({\n    queryKey: ['failed-jobs'],\n    queryFn: () => base44.entities.CampaignJob.filter({ status: 'failed' }, '-created_date', 100),\n    refetchInterval: 10000,\n    refetchIntervalInBackground: false,\n  });\n",
    "b": true,
    "l": 114
  },
  {
    "p": "src/pages/CampaignEngineQueue.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';\n\nconst STATUS_ICONS = {\n  pending: <Clock className=\"w-4 h-4 text-yellow-400\" />,\n  processing: <Loader2 className=\"w-4 h-4 text-blue-400 animate-spin\" />,\n  completed: <CheckCircle2 className=\"w-4 h-4 text-green-400\" />,\n  dead_letter: <AlertCircle className=\"w-4 h-4 text-red-400\" />,\n};\n\nexport default function CampaignEngineQueue() {\n  const { data: currentUser } = useQuery({\n    queryKey: ['current-user'],",
    "b": true,
    "l": 121
  },
  {
    "p": "src/pages/CampaignEngineWorkers.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { CheckCircle2, AlertCircle, Loader2, Pause } from 'lucide-react';\n\nconst STATUS_COLORS = {\n  idle: 'text-white/50',\n  running: 'text-green-400',\n  paused: 'text-yellow-400',\n  failed: 'text-red-400',\n};\n\nexport default function CampaignEngineWorkers() {\n  const { data: workers = [] } = useQuery({\n    queryKey: ['campaign-workers-list'],",
    "b": true,
    "l": 95
  },
  {
    "p": "src/pages/CampaignEngineWorkflows.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { ArrowRight, Play, Pause, AlertCircle } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nconst PIPELINE_STAGES = [\n  { stage: 'discovery', label: 'Discovery', icon: '🔍' },\n  { stage: 'scraper', label: 'Scraper', icon: '📄' },\n  { stage: 'content_extractor', label: 'Extract', icon: '✂️' },\n  { stage: 'signal_detection', label: 'Signals', icon: '⚡' },\n  { stage: 'lead_scoring', label: 'Score', icon: '📊' },\n  { stage: 'enrichment', label: 'Enrich', icon: '📦' },\n  { stage: 'outreach_generator', label: 'Outreach', icon: '📧' },\n];",
    "b": true,
    "l": 113
  },
  {
    "p": "src/pages/CampaignSimulator.jsx",
    "v": "import { useState, useEffect, useRef } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { Card } from '@/components/ui/card';\nimport { Button } from '@/components/ui/button';\nimport { Badge } from '@/components/ui/badge';\nimport { Play, AlertCircle, CheckCircle2, Zap, FlaskConical, DollarSign, AlertTriangle } from 'lucide-react';\n\nexport default function CampaignSimulator() {\n  const [activeTab, setActiveTab] = useState('dryrun');\n\n  return (\n    <div className=\"p-6 space-y-6 max-w-2xl\">\n      <div>\n        <h1 className=\"text-2xl font-bold text-white\">Pipeline Simulator</h1>\n        <p className=\"text-white/50 text-sm mt-1\">",
    "b": true,
    "l": 370
  },
  {
    "p": "src/pages/Campaigns.jsx",
    "v": "import React, { useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';\nimport { createPageUrl } from '@/utils';\nimport { Plus, Play, Pause, ArrowRight, Trash2, LayoutTemplate, Megaphone, Lock, Sun, Loader2, ExternalLink, Satellite } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\nimport CampaignTemplates from '@/components/campaign/CampaignTemplates';\nimport SolarPermitTemplateCard from '@/components/campaign/SolarPermitTemplateCard';\nimport SolarDetectionTemplateCard from '@/components/campaign/SolarDetectionTemplateCard';\nimport StormDiscoveryTemplateCard from '@/components/campaign/StormDiscoveryTemplateCard';\nimport SolarDetectionStatusPanel from '@/components/campaign/SolarDetectionStatusPanel';\nimport { useVisibility } from '@/hooks/useVisibility';",
    "b": true,
    "l": 388
  },
  {
    "p": "src/pages/ContactLists.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { base44 } from '@/api/base44Client';\nimport { toast } from 'sonner';\nimport {\n  FolderPlus, Plus, Trash2, X, Loader2,\n  List, ChevronRight, Users, Download, FolderOpen,\n} from 'lucide-react';\n\nexport default function ContactLists() {\n  const queryClient = useQueryClient();\n  const { orgId } = useCurrentUser();\n\n  const [selectedList, setSelectedList]     = useState(null);",
    "b": true,
    "l": 511
  },
  {
    "p": "src/pages/Contacts.jsx",
    "v": "import React, { useState, useMemo } from 'react';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useSearchParams } from 'react-router-dom';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  Users, Search, Upload, Download, Plus, X,\n  Flame, Sun, Home, Globe, Loader2, Mail,\n  List, SlidersHorizontal, MoreVertical,\n} from 'lucide-react';\nimport LeadDetailDrawer from '@/components/leads/LeadDetailDrawer';\n\nfunction getTemp(score) {\n  if (score >= 60) return 'hot';",
    "b": true,
    "l": 1015
  },
  {
    "p": "src/pages/CostPanel.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport CostTrackerPanel from '@/components/system/CostTrackerPanel';\nimport DataTable from '@/components/ui/DataTable';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { DollarSign, TrendingUp } from 'lucide-react';\nimport { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';\n\nexport default function CostPanel() {\n  const { orgId } = useCurrentUser();\n  const { data: trackers = [] } = useQuery({\n    queryKey: ['cost-trackers', orgId],\n    queryFn: () => orgId",
    "b": true,
    "l": 112
  },
  {
    "p": "src/pages/Dashboard.jsx",
    "v": "import React, { useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { Users, FileText, Send, TrendingUp } from 'lucide-react';\nimport StatsCard from '@/components/ui/StatsCard';\nimport ActivityFeed from '@/components/ui/ActivityFeed';\nimport WorkerStatusPanel from '@/components/system/WorkerStatusPanel';\nimport QueueHealthIndicator from '@/components/system/QueueHealthIndicator';\nimport CostTrackerPanel from '@/components/system/CostTrackerPanel';\nimport StatusBadge from '@/components/ui/StatusBadge';\n\nexport default function Dashboard() {\n  const queryClient = useQueryClient();\n  const { orgId } = useCurrentUser();",
    "b": true,
    "l": 108
  },
  {
    "p": "src/pages/DocsViewer.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useSearchParams, useNavigate } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport { ArrowLeft } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport ReactMarkdown from 'react-markdown';\nimport { CardSkeleton } from '@/components/ui/LoadingSkeleton';\n\nexport default function DocsViewer() {\n  const [searchParams] = useSearchParams();\n  const slug = searchParams.get('slug');\n  const navigate = useNavigate();\n",
    "b": true,
    "l": 62
  },
  {
    "p": "src/pages/Documentation.jsx",
    "v": "import React, { useState, useEffect, useRef } from 'react';\nimport DocumentationInstantly from './DocumentationInstantly';\nimport { Link } from 'react-router-dom';\nimport { ArrowLeft, Home } from 'lucide-react';\n\n/* ─── NAV SECTIONS ─── */\nconst NAV = [\n  { id: 'getting-started',   label: 'Getting Started'      },\n  { id: 'overview',      label: 'Overview'       },\n  { id: 'ai-first',      label: 'AI-First'        },\n  { id: 'discovery',     label: 'Discovery Engines'  },\n  { id: 'pipeline',      label: 'Pipeline'        },\n  { id: 'enrichment',    label: 'Enrichment'      },\n  { id: 'ai-analysis',   label: 'AI Analysis'     },\n  { id: 'email-engine',  label: 'Email Engine'    },",
    "b": true,
    "l": 1984
  },
  {
    "p": "src/pages/DocumentationInstantly.jsx",
    "v": "import React from 'react';\n\n/* ─── RE-EXPORTED SHARED COMPONENTS (passed as props) ─── */\n/* This file renders all 5 Instantly documentation sections */\n\nexport default function DocumentationInstantly({ S, SectionTitle, SectionDesc, InfoCard, ScaleStep, WarnBox, TipBox, FinTable, ConfigBlock, HR }) {\n  return (\n    <>\n      <HR />\n\n      {/* ══ INSTANTLY SETUP ══ */}\n      <section id=\"doc-instantly-setup\" style={S.section}>\n        <SectionTitle icon=\"📧\">Instantly Setup — Cold Email at Scale</SectionTitle>\n        <SectionDesc>\n          Instantly is the email delivery backbone of Rosie AI. When a lead passes the AI intent gate and has an email address, Rosie AI automatically adds them to your Instantly campaign. Instantly handles everything else — which inbox sends, when, rotation across hundreds of addresses, warmup, follow-up sequences, reply detection, and deliverability. You never choose which email address a message comes from.",
    "b": true,
    "l": 249
  },
  {
    "p": "src/pages/EnrichmentMonitor.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport DataTable from '@/components/ui/DataTable';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { Network, RefreshCw } from 'lucide-react';\nimport { useQueryClient } from '@tanstack/react-query';\n\nexport default function EnrichmentMonitor() {\n  const { user } = useCurrentUser();\n  const queryClient = useQueryClient();\n\n  const { data: enrich = [], isLoading } = useQuery({\n    queryKey: ['enrichment-results', user?.organization_id],",
    "b": true,
    "l": 159
  },
  {
    "p": "src/pages/ExperimentLab.jsx",
    "v": "import React from 'react';\nimport { Beaker } from 'lucide-react';\n\nexport default function ExperimentLab() {\n  return (\n    <div className=\"p-6 space-y-6\">\n      <div className=\"flex items-center gap-2 mb-6\">\n        <Beaker className=\"w-4 h-4 text-orange-400\" />\n        <h1 className=\"text-lg font-semibold text-white\">Experiment Lab</h1>",
    "b": true,
    "l": 18
  },
  {
    "p": "src/pages/FeatureFlagsAdmin.jsx",
    "v": "import React, { useState } from 'react';\nimport FeatureFlagPanel from '@/components/admin/FeatureFlagPanel';\nimport { base44 } from '@/api/base44Client';\nimport { RefreshCw, CheckCircle2 } from 'lucide-react';\n\nexport default function FeatureFlagsAdmin() {\n  const [seeding, setSeeding] = useState(false);\n  const [seedResult, setSeedResult] = useState(null);\n\n  const handleSeed = async () => {\n    setSeeding(true);\n    setSeedResult(null);\n    const res = await base44.functions.invoke('seedFeatureFlags', {});\n    setSeedResult(res.data);\n    setSeeding(false);",
    "b": true,
    "l": 50
  },
  {
    "p": "src/pages/IncomingCalls.jsx",
    "v": "import React, { useState, useEffect, useRef, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { toast } from 'sonner';\nimport {\n  Phone, PhoneIncoming, PhoneMissed, PhoneOff, Clock,\n  User, Mic, MicOff, CheckCircle, Hash, Search, X,\n  MessageSquare, Mail, Tag, Loader2, PhoneForwarded,\n  Copy, Check, AlertTriangle, Settings2, Info,\n} from 'lucide-react';\n\nlet twilioDevice = null;\nlet activeCall   = null;\n",
    "b": true,
    "l": 734
  },
  {
    "p": "src/pages/InstantlyOutreach.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport { Mail, Plus, Loader2, Play, Pause, Trash2, TrendingUp, Activity } from 'lucide-react';\n\nexport default function InstantlyOutreach() {\n  const queryClient = useQueryClient();\n  const [activeTab, setActiveTab] = useState('campaigns');\n  const [selectedCampaignId, setSelectedCampaignId] = useState(null);\n\n  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({\n    queryKey: ['instantly-campaigns'],\n    queryFn: async () => {\n      const res = await base44.functions.invoke('instantlyAPI', { operation: 'list_campaigns' });",
    "b": true,
    "l": 294
  },
  {
    "p": "src/pages/Integrations.jsx",
    "v": "import React, { useState } from 'react';\nimport { CheckCircle2, XCircle, AlertCircle, ChevronRight, Copy } from 'lucide-react';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Link } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\n\nconst INTEGRATIONS = [\n  { name: 'Groq',         type: 'AI',          description: 'Primary LLM — analysis & generation',    docs: 'https://console.groq.com',       settingKey: 'groq_api_key', settingsTab: 'integrations' },\n  { name: 'OpenAI',       type: 'AI',          description: 'GPT models for complex analysis',        docs: 'https://platform.openai.com',    settingKey: 'openai_api_key', settingsTab: 'integrations' },\n  { name: 'Anthropic',    type: 'AI',          description: 'Claude models for reasoning tasks',      docs: 'https://console.anthropic.com',  settingKey: 'anthropic_api_key', settingsTab: 'integrations' },\n  { name: 'Google Gemini',type: 'AI',          description: 'Fallback LLM provider',                   docs: 'https://aistudio.google.com',    settingKey: 'google_gemini_api_key', settingsTab: 'integrations' },\n  { name: 'Apollo.io',    type: 'Enrichment',  description: 'Email & company enrichment',              docs: 'https://app.apollo.io',          settingKey: 'apollo_api_key', settingsTab: 'integrations' },\n  { name: 'Hunter.io',    type: 'Enrichment',  description: 'Email finder & verification',             docs: 'https://hunter.io',              settingKey: 'hunter_io_api_key', settingsTab: 'integrations' },",
    "b": true,
    "l": 156
  },
  {
    "p": "src/pages/Leads.jsx",
    "v": "import React, { useState, useCallback, useEffect } from 'react';\nimport { useSearchParams } from 'react-router-dom';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { base44 } from '@/api/base44Client';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { ChevronDown, Upload, TableIcon, Flame, Menu, X } from 'lucide-react';\nimport LeadsTopBar from '@/components/leads/LeadsTopBar';\nimport LeadsFilterSidebar from '@/components/leads/LeadsFilterSidebar';\nimport LeadsTableView from '@/components/leads/LeadsTableView';\nimport LeadsHeatBoard from '@/components/leads/LeadsHeatBoard';\nimport LeadDetailDrawer from '@/components/leads/LeadDetailDrawer';\n\nexport default function Leads() {\n  const [searchParams] = useSearchParams();\n  const verticalFromUrl = searchParams.get('vertical');",
    "b": true,
    "l": 360
  },
  {
    "p": "src/pages/Onboarding.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useNavigate } from 'react-router-dom';\nimport { Zap, Wrench, AlertCircle, Loader2, Phone, MessageSquare, PhoneCall, Check } from 'lucide-react';\n\nconst TYPE_OPTIONS = [\n  { value: 'both', label: 'Voice + SMS', icon: PhoneCall },\n  { value: 'call', label: 'Voice Only',  icon: PhoneCall },\n  { value: 'sms',  label: 'SMS Only',    icon: MessageSquare },\n];\n\nexport default function Onboarding() {\n  const navigate = useNavigate();\n  const [inviteRole, setInviteRole] = useState(null);\n  const [inviteEmail, setInviteEmail] = useState(null);",
    "b": true,
    "l": 451
  },
  {
    "p": "src/pages/OperatorMode.jsx",
    "v": "import React from 'react';\nimport { base44 } from '@/api/base44Client';\nimport SystemHealthPanel from '@/components/operator/SystemHealthPanel';\nimport PipelineMetricsPanel from '@/components/operator/PipelineMetricsPanel';\nimport QueueStatusPanel from '@/components/operator/QueueStatusPanel';\nimport AICostMonitorPanel from '@/components/operator/AICostMonitorPanel';\nimport CampaignOverviewPanel from '@/components/operator/CampaignOverviewPanel';\nimport WorkerControlPanel from '@/components/operator/WorkerControlPanel';\n\nexport default function OperatorMode() {\n  return (\n    <div className=\"min-h-screen bg-[#0f1117] p-6\">\n      <div className=\"max-w-[1400px] mx-auto space-y-6\">\n        {/* Header */}\n        <div className=\"mb-8\">",
    "b": true,
    "l": 49
  },
  {
    "p": "src/pages/PermitDiscovery.jsx",
    "v": "import React, { useMemo, useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { useVisibility } from '@/hooks/useVisibility';\nimport { createPageUrl } from '@/utils';\nimport {\n  FileSearch, Download, Loader2, Lock, MapPin,\n  ExternalLink, Building2, Users, X, Phone, Mail,\n  Zap, User, FileText, ChevronRight,\n} from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport { useNavigate } from 'react-router-dom';\nimport { toast } from 'sonner';\n",
    "b": true,
    "l": 434
  },
  {
    "p": "src/pages/PipelineLogViewer.jsx",
    "v": "import React, { useState } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { Search, Filter, RefreshCw, ChevronDown, AlertCircle, CheckCircle2, Clock, Info } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\n\nexport default function PipelineLogViewer() {\n  const [searchTerm, setSearchTerm] = useState('');\n  const [filterSeverity, setFilterSeverity] = useState('all');\n  const [filterStatus, setFilterStatus] = useState('all');\n  const [expandedLog, setExpandedLog] = useState(null);\n\n  const { data: logs = [], isLoading, refetch } = useQuery({\n    queryKey: ['pipeline-logs'],\n    queryFn: () =>",
    "b": true,
    "l": 246
  },
  {
    "p": "src/pages/QueuesAdmin.jsx",
    "v": "import React from 'react';\nimport QueueMonitorDetailed from '@/components/admin/QueueMonitorDetailed';\n\nexport default function QueuesAdmin() {\n  return (\n    <div className=\"min-h-screen bg-[#0f1117] p-6\">\n      <div className=\"max-w-[1400px] mx-auto space-y-6\">\n        {/* Header */}\n        <div className=\"mb-8\">",
    "b": true,
    "l": 19
  },
  {
    "p": "src/pages/SMSCampaigns.jsx",
    "v": "import React, { useState, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport CampaignStatsBar from '@/components/sms/CampaignStatsBar';\nimport CampaignsList from '@/components/sms/CampaignsList';\nimport ComposeSMS from '@/components/sms/ComposeSMS';\nimport ContactsManager from '@/components/sms/ContactsManager';\nimport PipelineTab from '@/components/sms/PipelineTab';\nimport ConversationsTab from '@/components/sms/ConversationsTab';\nimport AnalyticsTab from '@/components/sms/AnalyticsTab';\nimport TemplatesTab from '@/components/sms/TemplatesTab';\nimport SystemTestPanel from '@/components/sms/SystemTestPanel';\nimport { MessageSquare, Send, Users, Copy, BarChart3, LayoutTemplate, MessageCircle, Loader2, ChevronRight, X, Plus } from 'lucide-react';\n",
    "b": true,
    "l": 146
  },
  {
    "p": "src/pages/SMSDocumentation.jsx",
    "v": "import React from 'react';\nimport { ArrowLeft } from 'lucide-react';\nimport { useNavigate } from 'react-router-dom';\n\nexport default function SMSDocumentation() {\n  const navigate = useNavigate();\n\n  return (\n    <div className=\"min-h-screen bg-[#0a0c14]\">\n      <style>{`\n        :root {\n          --bg: #0a0c14;\n          --card: #13151c;\n          --card2: #1a1d27;\n          --border: rgba(255,255,255,0.06);",
    "b": true,
    "l": 261
  },
  {
    "p": "src/pages/Settings.jsx",
    "v": "import React, { useState, useEffect, useCallback } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { toast } from 'sonner';\nimport {\n  Shield, Users, MessageSquare, Phone, PhoneIncoming, Mail, Database, Bot,\n  Search, Zap, Bell, Settings2,\n  CheckCircle2, Loader2, Plus, Trash2,\n  RefreshCw, AlertCircle, Copy\n} from 'lucide-react';\nimport {\n  loadOrgSettings, reloadOrgSettings, upsertSettings, getFunctionUrl, getWebhookBaseUrl,\n  SecretField, TextField, CopyField, SectionCard, SaveBar,\n} from '@/components/settings/tabs/shared';\n",
    "b": true,
    "l": 334
  },
  {
    "p": "src/pages/SolarResults.jsx",
    "v": "import React, { useState } from 'react';\nimport { Link } from 'react-router-dom';\nimport { createPageUrl } from '@/utils';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { useVisibility } from '@/hooks/useVisibility';\nimport { Sun, Download, Users, CheckCircle2, XCircle, Clock, Zap, Loader2, Lock } from 'lucide-react';\nimport { Button } from '@/components/ui/button';\nimport { Checkbox } from '@/components/ui/checkbox';\n\nexport default function SolarResults() {\n  const { canSee } = useVisibility();\n  if (!canSee('feature_solar_pipeline')) {\n    return (",
    "b": true,
    "l": 387
  },
  {
    "p": "src/pages/SystemHealth.jsx",
    "v": "import React from 'react';\nimport { useSystemHealthStore } from '@/components/stores/SystemHealthStore';\nimport WorkerStatusPanel from '@/components/system/WorkerStatusPanel';\nimport QueueHealthIndicator from '@/components/system/QueueHealthIndicator';\nimport DataTable from '@/components/ui/DataTable';\nimport StatusBadge from '@/components/ui/StatusBadge';\nimport { AlertTriangle, Server } from 'lucide-react';\n\nexport default function SystemHealth() {\n  const { workers, logs, dlq, health } = useSystemHealthStore();\n\n  return (\n    <div className=\"p-6 space-y-6\">\n      <div className=\"flex items-center gap-2\">\n        <Server className=\"w-4 h-4 text-blue-400\" />",
    "b": true,
    "l": 80
  },
  {
    "p": "src/pages/WorkflowManager.jsx",
    "v": "import React, { useState, useRef, useCallback, useEffect } from 'react';\nimport { base44 } from '@/api/base44Client';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { useCurrentUser } from '@/hooks/useCurrentUser';\nimport { useVisibility } from '@/hooks/useVisibility';\nimport { toast } from 'sonner';\nimport {\n  Plus, Play, Save, Trash2, X, ChevronDown, Zap, Mail, MessageSquare,\n  Phone, Globe, Clock, GitBranch, Database, Webhook, Eye, EyeOff,\n  Copy, MoreHorizontal, AlertCircle, CheckCircle2, Loader2, Edit3,\n  ArrowRight, Filter, Users, Bell, Code, ToggleLeft, Layers, LayoutTemplate, Lock\n} from 'lucide-react';\n\n// ─── Node type definitions ────────────────────────────────────────────────────\nconst NODE_TYPES = {",
    "b": true,
    "l": 1685
  },
  {
    "p": "src/utils/index.ts",
    "v": "export function createPageUrl(pageName: string) {",
    "b": false,
    "l": 3
  },
  {
    "p": "tailwind.config.js",
    "v": "/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n    darkMode: [\"class\"],\n    content: [\"./index.html\", \"./src/**/*.{ts,tsx,js,jsx}\"],\n  theme: {\n  \textend: {\n  \t\tborderRadius: {\n  \t\t\tlg: 'var(--radius)',\n  \t\t\tmd: 'calc(var(--radius) - 2px)',\n  \t\t\tsm: 'calc(var(--radius) - 4px)'\n  \t\t},\n  \t\tcolors: {\n  \t\t\tbackground: 'hsl(var(--background))',\n  \t\t\tforeground: 'hsl(var(--foreground))',\n  \t\t\tcard: {",
    "b": true,
    "l": 89
  },
  {
    "p": "utils/aiCache.ts",
    "v": "/**\n * AI RESPONSE CACHE\n *\n * In-memory prompt deduplication cache for Deno worker processes.\n * Prevents redundant AI calls for identical prompts within a single worker lifetime.\n *\n * Merged from agentbman_platform_full_system/utils/aiCache.ts\n *\n * IMPORTANT NOTES:\n * - This is process-local (in-memory). It resets on every cold start.\n * - The persistent cross-request cache lives in aiGateway.ts → AIRequest entity (prompt_hash lookup).\n * - This layer is a cheap first-hit guard for repeated calls within the same worker run.\n * - TTL added (default 10 min) to prevent stale results in long-running workers.\n * - Max size cap (500 entries) to prevent unbounded memory growth.\n */",
    "b": true,
    "l": 60
  },
  {
    "p": "utils/queue.ts",
    "v": "/**\n * IN-MEMORY QUEUE UTILITY (Development / Testing Only)\n *\n * Merged from agentbman_platform_full_system/utils/queue.ts\n *\n * ⚠️  WARNING: This is an IN-MEMORY queue. It is NOT used in production.\n *     Production queueing uses Base44/Supabase entities:\n *       - CampaignQueue (primary queue)\n *       - DeadLetterQueue (failed jobs)\n *       - enqueueJob.ts / queueDrainer.ts (Deno.serve endpoints)\n *\n * Use this only for:\n *   - Local development without a database connection\n *   - Unit tests / simulationEngine.ts dry runs\n *   - CampaignSimulator.jsx page (non-production demo)",
    "b": true,
    "l": 81
  },
  {
    "p": "utils/retry.ts",
    "v": "/**\n * RETRY UTILITY\n *\n * Exponential backoff retry for async functions.\n * Used by aiGateway and any worker that calls external APIs.\n *\n * Merged from agentbman_platform_full_system/utils/retry.ts\n * - Kept the core logic (3 attempts, delay * attempt)\n * - Added jitter to prevent thundering herd when many workers retry simultaneously\n * - Added typed error so callers know how many attempts were made\n * - maxAttempts is configurable (default 3)\n */\n\nexport class RetryExhaustedError extends Error {\n  attempts: number;",
    "b": true,
    "l": 52
  }
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