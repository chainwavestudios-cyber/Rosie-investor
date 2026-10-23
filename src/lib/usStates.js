/**
 * usStates.js — state abbreviations written out in full.
 * Contact cards should read "California", never "CA": the state a lead is in is
 * shown to the rep on the call, written into outreach templates and read aloud by
 * the AI agents, so the full name is the one that belongs on a card.
 */

/** Code → full name, for the fifty states plus DC and Puerto Rico. */
export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};

/**
 * "CA" / "ca." / "California" / "california" → "California".
 * Anything that is not a known state comes back trimmed exactly as it was typed,
 * so a foreign province or a typo is never thrown away.
 */
export function fullStateName(value) {
  const text = String(value ?? '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const named = STATE_NAMES[text.toUpperCase()];
  if (named) return named;
  const spelled = Object.values(STATE_NAMES).find((name) => name.toLowerCase() === text.toLowerCase());
  return spelled || text;
}