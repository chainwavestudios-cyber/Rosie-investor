/**
 * Portal Settings — Base44 Backend with localStorage fallback
 *
 * Strategy:
 *  1. Try to load from Base44 PortalSettings entity on mount
 *  2. Always also mirror to localStorage as backup
 *  3. On save: write to Base44 AND localStorage
 *  4. On load failure: fall back to localStorage, then defaults
 *
 * This means settings ALWAYS persist even if Base44 entity
 * isn't configured or has a query issue.
 */

import { PortalSettingsDB } from '@/api/entities';

const LS_KEY = 'rosie_portal_settings_v2';

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

// In-memory cache
let _cache = null;
// Track Base44 record ID once we find/create it
let _recordId = null;

function readFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...SETTING_DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return null;
}

function writeToLS(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {}
}

function cleanForDB(settings) {
  // Remove Base44 internal fields before saving
  const clean = { ...settings };
  delete clean.id;
  delete clean.created_date;
  delete clean.updated_date;
  // Do NOT delete clean.key — that's the settingsKey field in our schema
  return clean;
}

/** Load from Base44 (falls back to localStorage → defaults) */
export async function loadPortalSettings() {
  // Return cache if available
  if (_cache) return _cache;

  // Try Base44 first
  try {
    const row = await PortalSettingsDB.get();
    if (row) {
      _recordId = row.id;
      const { key: _k, ...rowData } = cleanForDB(row);
    const merged = { ...SETTING_DEFAULTS, ...rowData };
      _cache = merged;
      writeToLS(merged); // keep localStorage in sync
      return merged;
    }
  } catch (e) {
    console.warn('[portalSettings] Base44 load failed, using localStorage:', e.message);
  }

  // Fall back to localStorage
  const lsData = readFromLS();
  if (lsData) {
    _cache = lsData;
    return lsData;
  }

  // Fall back to defaults
  _cache = { ...SETTING_DEFAULTS };
  return _cache;
}

/** Synchronous read — returns cache or localStorage or defaults */
export function getPortalSettings() {
  if (_cache) return _cache;
  const lsData = readFromLS();
  return lsData || { ...SETTING_DEFAULTS };
}

/** Save to both Base44 AND localStorage */
export async function savePortalSettings(updates) {
  const current = _cache || getPortalSettings();
  const merged  = { ...current, ...updates };

  // Always save to localStorage immediately (guaranteed persistence)
  writeToLS(merged);
  _cache = merged;

  // Broadcast to any open portal tabs
  window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: merged }));

  // Try Base44 in background — don't block the UI on this
  try {
    if (_recordId) {
      await base44EntityUpdate(_recordId, cleanForDB(merged));
    } else {
      const created = await PortalSettingsDB.save(cleanForDB(merged));
      if (created?.id) _recordId = created.id;
    }
  } catch (e) {
    console.warn('[portalSettings] Base44 save failed (localStorage backup used):', e.message);
  }

  return { success: true };
}

// Direct Base44 update helper
async function base44EntityUpdate(id, data) {
  const { base44 } = await import('@/api/base44Client');
  return await base44.entities.PortalSettings.update(id, data);
}

/** Reset to defaults */
export async function resetPortalSettings() {
  _cache = { ...SETTING_DEFAULTS };
  _recordId = null;
  writeToLS(_cache);
  window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: _cache }));
  try {
    await PortalSettingsDB.save(cleanForDB(_cache));
  } catch {}
}

export { _cache as _settingsCache };