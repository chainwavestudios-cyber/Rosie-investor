/**
 * Portal Settings — Base44 Backend
 * Stored as a single row in entities.PortalSettings (settingsKey = "global")
 * Local cache + CustomEvent for real-time UI updates without extra DB reads
 */

import { PortalSettingsDB } from '@/api/entities';

export const SETTING_DEFAULTS = {
  // Raise progress
  totalRaise:        2500000,
  committedCapital:  875000,
  investedCapital:   500000,
  investedTarget:    500000,

  // Contact
  companyName: 'Rosie AI LLC',
  address1:    '1234 Main St',
  address2:    'Cleveland, OH',
  phone:       '216-332-4234',
  email:       'Investors@RosieAI.com',

  // Portal content
  portalTagline:  'Confidential · Authorized Access Only',
  portalHeadline: 'Welcome to the Rosie AI\nInvestor Data Portal',
  portalSubtext:  'This secure portal gives authorized investors access to all materials, documents, and updates on the Rosie AI investment opportunity.',
  disclosureText: 'The information contained in this portal is strictly confidential and intended solely for authorized investors. This material does not constitute an offer to sell securities. Investment involves risk. Past performance is not indicative of future results. Please review all risk factors before investing.',

  // Investment terms
  roundSize:     '$2,500,000',
  valuationCap:  '$15,000,000',
  minInvestment: '$25,000',
  discountRate:  '20%',
  targetClose:   'Q2 2025',

  // Voice agent
  chatbotEnabled:  true,
  chatbotName:     'Rosie',
  deepgramApiKey:  '',
  llmProvider:     'anthropic',
  llmModel:        'claude-sonnet-4-5',
  voiceModel:      'aura-2-asteria-en',
  chatbotGreeting: "Hi! I'm Rosie, Rosie AI's investment assistant. I'm here to answer any questions about our investment opportunity, platform, or subscription process. What would you like to know?",
  chatbotContext:  `You are Rosie, the AI investment assistant for Rosie AI LLC — an enterprise AI voice agent platform.
You help accredited investors understand the investment opportunity. Be concise, warm, and professional.

Key facts:
- Raise: $2.5M SAFE Note, $15M valuation cap, 20% discount
- Minimum investment: $25,000
- Rosie AI automates sales calls using AI — 15x cheaper than human SDRs at $0.01/min
- Market: AI Voice API growing from $4.1B to $40B by 2032 (38.46% CAGR)
- Current ARR: $380K, 47+ clients, 1.2M+ calls processed
- Contact: Investors@RosieAI.com | 216-332-4234

Keep responses to 2-4 sentences unless more detail is requested.`,
  knowledgeBase: '',

  // Visibility
  showCalculator:  true,
  showMarketData:  true,
  showSubscription: true,
  portalActive:    true,
};

// In-memory cache so components don't hammer the DB on every render
let _cache = null;

/** Load settings from Base44, merging with defaults. Caches result. */
export async function loadPortalSettings() {
  try {
    const row = await PortalSettingsDB.get();
    const merged = { ...SETTING_DEFAULTS, ...(row || {}) };
    // Strip Base44 internal fields
    delete merged.id;
    delete merged.settingsKey;
    delete merged.created_date;
    delete merged.updated_date;
    _cache = merged;
    return merged;
  } catch (e) {
    console.error('[portalSettings] load failed:', e);
    return _cache || { ...SETTING_DEFAULTS };
  }
}

/** Synchronous read from cache (use after loadPortalSettings has resolved) */
export function getPortalSettings() {
  return _cache || { ...SETTING_DEFAULTS };
}

/** Save updates to Base44 and update cache + broadcast event */
export async function savePortalSettings(updates) {
  try {
    const current = _cache || { ...SETTING_DEFAULTS };
    const merged  = { ...current, ...updates };
    await PortalSettingsDB.save(merged);
    _cache = merged;
    window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: merged }));
    return { success: true };
  } catch (e) {
    console.error('[portalSettings] save failed:', e);
    return { success: false, error: e.message };
  }
}

/** Reset to defaults in Base44 */
export async function resetPortalSettings() {
  try {
    await PortalSettingsDB.save({ ...SETTING_DEFAULTS });
    _cache = { ...SETTING_DEFAULTS };
    window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: _cache }));
  } catch (e) {
    console.error('[portalSettings] reset failed:', e);
  }
}