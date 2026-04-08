/**
 * Portal Settings — Base44 Database Only
 *
 * All settings are stored in and loaded from the Base44 PortalSettings entity.
 * No localStorage. An in-memory session cache prevents redundant DB calls.
 *
 * Required fields on the PortalSettings entity in Base44:
 *   key (string) — always "global", used to identify the single settings row
 *   totalRaise, committedCapital, investedCapital, investedTarget (number)
 *   companyName, address1, address2, phone, email (string)
 *   portalTagline, portalHeadline, portalSubtext, disclosureText (string)
 *   roundSize, valuationCap, minInvestment, discountRate, targetClose (string)
 *   chatbotEnabled (boolean)
 *   chatbotName, deepgramApiKey, llmProvider, llmModel, sttModel, voiceModel (string)
 *   chatbotGreeting, chatbotContext, knowledgeBase (string)
 *   showCalculator, showMarketData, showSubscription, portalActive (boolean)
 */

import { PortalSettingsDB } from '@/api/entities';

export const SETTING_DEFAULTS = {
  totalRaise:        2500000,
  committedCapital:  875000,
  investedCapital:   500000,
  investedTarget:    500000,

  companyName: 'Rosie AI LLC',
  address1:    '1234 Main St',
  address2:    'Cleveland, OH',
  phone:       '216-332-4234',
  email:       'Investors@RosieAI.com',

  portalTagline:  'Confidential · Authorized Access Only',
  portalHeadline: 'Welcome to the Rosie AI\nInvestor Data Portal',
  portalSubtext:  'This secure portal gives authorized investors access to all materials, documents, and updates on the Rosie AI investment opportunity.',
  disclosureText: 'The information contained in this portal is strictly confidential and intended solely for authorized investors. This material does not constitute an offer to sell securities. Investment involves risk. Past performance is not indicative of future results. Please review all risk factors before investing.',

  roundSize:     '$2,500,000',
  valuationCap:  '$15,000,000',
  minInvestment: '$25,000',
  discountRate:  '20%',
  targetClose:   'Q2 2025',

  chatbotEnabled:  true,
  chatbotName:     'Rosie',
  deepgramApiKey:  '',
  llmProvider:     'open_ai',
  llmModel:        'gpt-4.1-mini',
  sttModel:        'nova-3',
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

  showCalculator:   true,
  showMarketData:   true,
  showSubscription: true,
  portalActive:     true,
};

// In-memory session cache — cleared on refresh, never written to disk
let _cache = null;
// Base44 record ID once loaded
let _recordId = null;

function cleanForDB(settings) {
  const clean = { ...settings };
  delete clean.id;
  delete clean.created_date;
  delete clean.updated_date;
  return clean;
}

/** Load settings from Base44. Uses session cache to avoid redundant DB calls. */
export async function loadPortalSettings() {
  if (_cache) return _cache;

  try {
    const row = await PortalSettingsDB.get();
    if (row) {
      _recordId = row.id;
      const { key: _k, ...rowData } = cleanForDB(row);
      _cache = { ...SETTING_DEFAULTS, ...rowData };
      return _cache;
    }
  } catch (e) {
    console.error('[portalSettings] Failed to load from database:', e.message);
  }

  // No record yet — use defaults until admin saves for the first time
  _cache = { ...SETTING_DEFAULTS };
  return _cache;
}

/** Force a fresh load from Base44, bypassing the session cache. */
export async function refreshPortalSettings() {
  _cache = null;
  return loadPortalSettings();
}

/** Synchronous read — returns session cache or defaults. Call loadPortalSettings() first. */
export function getPortalSettings() {
  return _cache || { ...SETTING_DEFAULTS };
}

/** Save settings to Base44 and update the session cache. */
export async function savePortalSettings(updates) {
  const current = _cache || { ...SETTING_DEFAULTS };
  const merged  = { ...current, ...updates };
  _cache = merged;

  // Broadcast to other components in this tab
  window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: merged }));

  try {
    if (_recordId) {
      const { base44 } = await import('@/api/base44Client');
      await base44.entities.PortalSettings.update(_recordId, cleanForDB(merged));
    } else {
      const created = await PortalSettingsDB.save(cleanForDB(merged));
      if (created?.id) _recordId = created.id;
    }
  } catch (e) {
    console.error('[portalSettings] Failed to save to database:', e.message);
    throw e;
  }

  return { success: true };
}

/** Reset all settings to defaults and persist to Base44. */
export async function resetPortalSettings() {
  _cache = { ...SETTING_DEFAULTS };
  _recordId = null;
  window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: _cache }));
  try {
    await PortalSettingsDB.save(cleanForDB(_cache));
  } catch (e) {
    console.error('[portalSettings] Failed to reset in database:', e.message);
    throw e;
  }
}

export { _cache as _settingsCache };
