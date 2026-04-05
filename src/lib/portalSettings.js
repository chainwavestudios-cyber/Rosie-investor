// Portal Settings — shared between admin and investor portal
// All portal-configurable values live here

const SETTINGS_KEY = 'rosie_portal_settings';

const DEFAULTS = {
  // Raise progress bars
  totalRaise: 2500000,
  committedCapital: 875000,
  investedCapital: 500000,
  investedTarget: 500000,

  // Contact info
  companyName: 'Rosie AI LLC',
  address1: '1234 Main St',
  address2: 'Cleveland, OH',
  phone: '216-332-4234',
  email: 'Investors@RosieAI.com',

  // Portal header text
  portalTagline: 'Confidential · Authorized Access Only',
  portalHeadline: 'Welcome to the Rosie AI\nInvestor Data Portal',
  portalSubtext: 'This secure portal gives authorized investors access to all materials, documents, and updates on the Rosie AI investment opportunity. Use the tabs above or the navigation below to explore.',

  // Investment terms (shown in offering tab)
  roundSize: '$2,500,000',
  valuationCap: '$15,000,000',
  minInvestment: '$25,000',
  discountRate: '20%',
  targetClose: 'Q2 2025',

  // Chatbot
  chatbotEnabled: true,
  chatbotName: 'Rosie',
  chatbotGreeting: "Hi! I'm Rosie, Rosie AI's investment assistant. I can answer questions about our platform, the investment opportunity, terms, market data, or the subscription process. What would you like to know?",
  chatbotContext: `You are Rosie, the AI investment assistant for Rosie AI LLC — an enterprise AI voice agent platform. 
You help accredited investors understand the investment opportunity. Be concise, professional, and confident.

Key facts:
- Raise: $2.5M SAFE Note, $15M valuation cap, 20% discount
- Minimum investment: $25,000
- Rosie AI automates sales calls using AI — 15x cheaper than human SDRs at $0.01/min
- Market: AI Voice API growing from $4.1B to $40B by 2032 (38.46% CAGR)
- Current ARR: $380K, 47+ clients, 1.2M+ calls processed
- Projections: $2.1M ARR by 2026, $22M by 2028

Keep answers to 2-4 sentences unless detail is requested. Be warm but professional.`,

  // Disclosure text
  disclosureText: 'The information contained in this portal is strictly confidential and intended solely for authorized investors. This material does not constitute an offer to sell securities. Investment involves risk. Past performance is not indicative of future results. Please review all risk factors before investing.',

  // Portal visibility toggles
  showCalculator: true,
  showMarketData: true,
  showSubscription: true,
  portalActive: true,
};

export function getPortalSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePortalSettings(updates) {
  try {
    const current = getPortalSettings();
    const merged = { ...current, ...updates };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    // Dispatch event so portal updates in real time if open in same tab
    window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: merged }));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function resetPortalSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  window.dispatchEvent(new CustomEvent('portalSettingsChanged', { detail: DEFAULTS }));
}

export const SETTING_DEFAULTS = DEFAULTS;