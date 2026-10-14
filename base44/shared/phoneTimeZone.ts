/**
 * phoneTimeZone.ts — Maps US phone numbers to IANA time zones via area code.
 * Shared backend utility for enforcing the 8pm local-time cutoff on calls.
 *
 * Unknown area codes default to America/New_York (Eastern) — the earliest US
 * zone — so we never accidentally call past 8pm in the recipient's actual zone.
 */

// Area code → IANA timezone. Curated from NANP assignments.
const AREA_CODE_TZ: Record<string, string> = {
  // ── Eastern (America/New_York) ──
  '202': 'America/New_York', '203': 'America/New_York', '207': 'America/New_York',
  '212': 'America/New_York', '213': 'America/New_York', '215': 'America/New_York',
  '216': 'America/New_York', '220': 'America/New_York', '223': 'America/New_York',
  '227': 'America/New_York', '228': 'America/New_York', '229': 'America/New_York',
  '231': 'America/New_York', '236': 'America/New_York', '239': 'America/New_York',
  '240': 'America/New_York', '248': 'America/New_York', '249': 'America/New_York',
  '251': 'America/New_York', '252': 'America/New_York', '260': 'America/New_York',
  '262': 'America/New_York', '263': 'America/New_York', '267': 'America/New_York',
  '269': 'America/New_York', '272': 'America/New_York', '276': 'America/New_York',
  '277': 'America/New_York', '278': 'America/New_York', '279': 'America/New_York',
  '281': 'America/New_York', '283': 'America/New_York', '284': 'America/New_York',
  '301': 'America/New_York', '302': 'America/New_York', '304': 'America/New_York',
  '305': 'America/New_York', '308': 'America/New_York', '310': 'America/New_York',
  '312': 'America/New_York', '313': 'America/New_York', '315': 'America/New_York',
  '316': 'America/New_York', '317': 'America/New_York', '318': 'America/New_York',
  '319': 'America/New_York', '320': 'America/New_York', '321': 'America/New_York',
  '323': 'America/New_York', '325': 'America/New_York', '326': 'America/New_York',
  '327': 'America/New_York', '330': 'America/New_York', '331': 'America/New_York',
  '332': 'America/New_York', '334': 'America/New_York', '336': 'America/New_York',
  '337': 'America/New_York', '339': 'America/New_York', '340': 'America/New_York',
  '341': 'America/New_York', '343': 'America/New_York', '345': 'America/New_York',
  '346': 'America/New_York', '347': 'America/New_York', '349': 'America/New_York',
  '350': 'America/New_York', '351': 'America/New_York', '352': 'America/New_York',
  '360': 'America/New_York', '361': 'America/New_York', '363': 'America/New_York',
  '364': 'America/New_York', '365': 'America/New_York', '366': 'America/New_York',
  '367': 'America/New_York', '368': 'America/New_York', '369': 'America/New_York',
  '370': 'America/New_York', '371': 'America/New_York', '372': 'America/New_York',
  '373': 'America/New_York', '374': 'America/New_York', '375': 'America/New_York',
  '376': 'America/New_York', '377': 'America/New_York', '378': 'America/New_York',
  '379': 'America/New_York', '380': 'America/New_York', '381': 'America/New_York',
  '382': 'America/New_York', '385': 'America/New_York', '386': 'America/New_York',
  '401': 'America/New_York', '404': 'America/New_York', '405': 'America/New_York',
  '406': 'America/New_York', '407': 'America/New_York', '408': 'America/New_York',
  '410': 'America/New_York', '412': 'America/New_York', '413': 'America/New_York',
  '414': 'America/New_York', '419': 'America/New_York', '423': 'America/New_York',
  '434': 'America/New_York', '438': 'America/New_York', '440': 'America/New_York',
  '442': 'America/New_York', '443': 'America/New_York', '445': 'America/New_York',
  '447': 'America/New_York', '448': 'America/New_York', '456': 'America/New_York',
  '458': 'America/New_York', '463': 'America/New_York', '464': 'America/New_York',
  '470': 'America/New_York', '472': 'America/New_York', '473': 'America/New_York',
  '475': 'America/New_York', '478': 'America/New_York', '482': 'America/New_York',
  '484': 'America/New_York', '500': 'America/New_York', '502': 'America/New_York',
  '504': 'America/New_York', '508': 'America/New_York', '510': 'America/New_York',
  '516': 'America/New_York', '518': 'America/New_York', '520': 'America/New_York',
  '534': 'America/New_York', '539': 'America/New_York', '540': 'America/New_York',
  '548': 'America/New_York', '551': 'America/New_York', '557': 'America/New_York',
  '561': 'America/New_York', '567': 'America/New_York', '570': 'America/New_York',
  '571': 'America/New_York', '579': 'America/New_York', '581': 'America/New_York',
  '585': 'America/New_York', '601': 'America/New_York', '603': 'America/New_York',
  '605': 'America/New_York', '606': 'America/New_York', '607': 'America/New_York',
  '609': 'America/New_York', '610': 'America/New_York', '614': 'America/New_York',
  '615': 'America/New_York', '616': 'America/New_York', '617': 'America/New_York',
  '618': 'America/New_York', '623': 'America/New_York', '628': 'America/New_York',
  '629': 'America/New_York', '631': 'America/New_York', '646': 'America/New_York',
  '647': 'America/New_York', '657': 'America/New_York', '659': 'America/New_York',
  '667': 'America/New_York', '669': 'America/New_York', '670': 'America/New_York',
  '678': 'America/New_York', '679': 'America/New_York', '681': 'America/New_York',
  '682': 'America/New_York', '689': 'America/New_York', '701': 'America/New_York',
  '702': 'America/New_York', '703': 'America/New_York', '704': 'America/New_York',
  '706': 'America/New_York', '707': 'America/New_York', '708': 'America/New_York',
  '716': 'America/New_York', '717': 'America/New_York', '718': 'America/New_York',
  '719': 'America/New_York', '725': 'America/New_York', '728': 'America/New_York',
  '731': 'America/New_York', '732': 'America/New_York', '734': 'America/New_York',
  '737': 'America/New_York', '740': 'America/New_York', '743': 'America/New_York',
  '747': 'America/New_York', '754': 'America/New_York', '757': 'America/New_York',
  '765': 'America/New_York', '768': 'America/New_York', '770': 'America/New_York',
  '772': 'America/New_York', '774': 'America/New_York', '779': 'America/New_York',
  '781': 'America/New_York', '785': 'America/New_York', '786': 'America/New_York',
  '801': 'America/New_York', '802': 'America/New_York', '803': 'America/New_York',
  '804': 'America/New_York', '808': 'America/New_York', '810': 'America/New_York',
  '812': 'America/New_York', '813': 'America/New_York', '814': 'America/New_York',
  '815': 'America/New_York', '820': 'America/New_York', '828': 'America/New_York',
  '829': 'America/New_York', '830': 'America/New_York', '832': 'America/New_York',
  '838': 'America/New_York', '843': 'America/New_York', '845': 'America/New_York',
  '848': 'America/New_York', '850': 'America/New_York', '854': 'America/New_York',
  '856': 'America/New_York', '857': 'America/New_York', '858': 'America/New_York',
  '859': 'America/New_York', '860': 'America/New_York', '862': 'America/New_York',
  '863': 'America/New_York', '864': 'America/New_York', '865': 'America/New_York',
  '868': 'America/New_York', '870': 'America/New_York', '873': 'America/New_York',
  '878': 'America/New_York', '901': 'America/New_York', '902': 'America/New_York',
  '903': 'America/New_York', '904': 'America/New_York', '906': 'America/New_York',
  '908': 'America/New_York', '909': 'America/New_York', '910': 'America/New_York',
  '912': 'America/New_York', '913': 'America/New_York', '914': 'America/New_York',
  '917': 'America/New_York', '919': 'America/New_York', '927': 'America/New_York',
  '929': 'America/New_York', '930': 'America/New_York', '934': 'America/New_York',
  '937': 'America/New_York', '938': 'America/New_York', '939': 'America/New_York',
  '941': 'America/New_York', '943': 'America/New_York', '945': 'America/New_York',
  '947': 'America/New_York', '949': 'America/New_York', '954': 'America/New_York',
  '956': 'America/New_York', '959': 'America/New_York', '980': 'America/New_York',
  '984': 'America/New_York', '985': 'America/New_York', '989': 'America/New_York',

  // ── Central (America/Chicago) ──
  '205': 'America/Chicago', '251': 'America/Chicago', '256': 'America/Chicago',
  '334': 'America/Chicago', '479': 'America/Chicago', '501': 'America/Chicago',
  '870': 'America/Chicago', '318': 'America/Chicago', '337': 'America/Chicago',
  '504': 'America/Chicago', '985': 'America/Chicago', '225': 'America/Chicago',
  '773': 'America/Chicago', '872': 'America/Chicago', '312': 'America/Chicago',
  '630': 'America/Chicago', '217': 'America/Chicago', '309': 'America/Chicago',
  '815': 'America/Chicago', '319': 'America/Chicago', '515': 'America/Chicago',
  '563': 'America/Chicago', '641': 'America/Chicago', '712': 'America/Chicago',
  '620': 'America/Chicago', '785': 'America/Chicago', '405': 'America/Chicago',
  '580': 'America/Chicago', '918': 'America/Chicago', '314': 'America/Chicago',
  '417': 'America/Chicago', '573': 'America/Chicago', '636': 'America/Chicago',
  '660': 'America/Chicago', '816': 'America/Chicago', '270': 'America/Chicago',
  '364': 'America/Chicago', '502': 'America/Chicago', '606': 'America/Chicago',
  '859': 'America/Chicago', '228': 'America/Chicago', '601': 'America/Chicago',
  '662': 'America/Chicago', '769': 'America/Chicago', '409': 'America/Chicago',
  '936': 'America/Chicago', '979': 'America/Chicago', '281': 'America/Chicago',
  '346': 'America/Chicago', '713': 'America/Chicago', '832': 'America/Chicago',
  '210': 'America/Chicago', '214': 'America/Chicago', '254': 'America/Chicago',
  '361': 'America/Chicago', '430': 'America/Chicago', '469': 'America/Chicago',
  '512': 'America/Chicago', '682': 'America/Chicago', '737': 'America/Chicago',
  '806': 'America/Chicago', '817': 'America/Chicago', '830': 'America/Chicago',
  '915': 'America/Chicago', '940': 'America/Chicago', '945': 'America/Chicago',
  '972': 'America/Chicago', '432': 'America/Chicago', '325': 'America/Chicago',
  '507': 'America/Chicago', '612': 'America/Chicago', '651': 'America/Chicago',
  '763': 'America/Chicago', '952': 'America/Chicago', '531': 'America/Chicago',
  '402': 'America/Chicago', '308': 'America/Chicago', '629': 'America/Chicago',
  '731': 'America/Chicago', '865': 'America/Chicago', '931': 'America/Chicago',
  '901': 'America/Chicago', '614': 'America/Chicago', '740': 'America/Chicago',
  '380': 'America/Chicago', '567': 'America/Chicago', '419': 'America/Chicago',
  '234': 'America/Chicago', '330': 'America/Chicago', '765': 'America/Chicago',
  '574': 'America/Chicago', '260': 'America/Chicago', '812': 'America/Chicago',
  '316': 'America/Chicago', '320': 'America/Chicago', '608': 'America/Chicago',

  // ── Mountain (America/Denver) ──
  '303': 'America/Denver', '719': 'America/Denver', '720': 'America/Denver',
  '970': 'America/Denver', '307': 'America/Denver', '406': 'America/Denver',
  '208': 'America/Denver', '575': 'America/Denver', '505': 'America/Denver',
  '801': 'America/Denver', '435': 'America/Denver', '385': 'America/Denver',
  '702': 'America/Denver', '775': 'America/Denver', '602': 'America/Denver',
  '480': 'America/Denver', '623': 'America/Denver', '928': 'America/Denver',

  // ── Pacific (America/Los_Angeles) ──
  '206': 'America/Los_Angeles', '253': 'America/Los_Angeles',
  '425': 'America/Los_Angeles', '509': 'America/Los_Angeles',
  '564': 'America/Los_Angeles', '503': 'America/Los_Angeles',
  '541': 'America/Los_Angeles', '971': 'America/Los_Angeles',
  '209': 'America/Los_Angeles', '213': 'America/Los_Angeles',
  '310': 'America/Los_Angeles', '323': 'America/Los_Angeles',
  '408': 'America/Los_Angeles', '415': 'America/Los_Angeles',
  '424': 'America/Los_Angeles', '510': 'America/Los_Angeles',
  '530': 'America/Los_Angeles', '559': 'America/Los_Angeles',
  '619': 'America/Los_Angeles', '626': 'America/Los_Angeles',
  '628': 'America/Los_Angeles', '650': 'America/Los_Angeles',
  '661': 'America/Los_Angeles', '669': 'America/Los_Angeles',
  '707': 'America/Los_Angeles', '714': 'America/Los_Angeles',
  '747': 'America/Los_Angeles', '760': 'America/Los_Angeles',
  '805': 'America/Los_Angeles', '818': 'America/Los_Angeles',
  '831': 'America/Los_Angeles', '858': 'America/Los_Angeles',
  '909': 'America/Los_Angeles', '916': 'America/Los_Angeles',
  '925': 'America/Los_Angeles', '949': 'America/Los_Angeles',
  '951': 'America/Los_Angeles', '279': 'America/Los_Angeles',
  '341': 'America/Los_Angeles', '351': 'America/Los_Angeles',

  // ── Alaska (America/Anchorage) ──
  '907': 'America/Anchorage',

  // ── Hawaii (Pacific/Honolulu) ──
  '808': 'Pacific/Honolulu',
};

const DEFAULT_TZ = 'America/New_York';

export function getAreaCode(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const start = digits.length === 11 && digits[0] === '1' ? 1 : 0;
  return digits.slice(start, start + 3);
}

export function getTzFromPhone(phone: string): string {
  const ac = getAreaCode(phone);
  return AREA_CODE_TZ[ac] || DEFAULT_TZ;
}

export function getTzLabel(phone: string): string {
  const tz = getTzFromPhone(phone);
  if (tz === 'America/New_York') return 'ET';
  if (tz === 'America/Chicago') return 'CT';
  if (tz === 'America/Denver') return 'MT';
  if (tz === 'America/Los_Angeles') return 'PT';
  if (tz === 'America/Anchorage') return 'AK';
  if (tz === 'Pacific/Honolulu') return 'HI';
  return 'ET';
}

function getPartsInTz(phone: string, date: Date): { hour: number; minute: number; label: string } {
  const tz = getTzFromPhone(phone);
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    const labelFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const label = labelFmt.format(date);
    return { hour, minute, label };
  } catch {
    return { hour: 0, minute: 0, label: '' };
  }
}

export interface CutoffResult {
  blocked: boolean;
  localHour: number;
  localTime: string;
  tzLabel: string;
  tz: string;
}

/**
 * Check if it's past the 8pm (20:00) cutoff in the phone number's timezone.
 * Also blocks before 8am as an early-morning guard.
 */
export function checkCallCutoff(phone: string, cutoffHour = 20, date = new Date()): CutoffResult {
  const { hour, label } = getPartsInTz(phone, date);
  const tzLabel = getTzLabel(phone);
  const tz = getTzFromPhone(phone);
  const blocked = hour >= cutoffHour || hour < 8;
  return { blocked, localHour: hour, localTime: label, tzLabel, tz };
}