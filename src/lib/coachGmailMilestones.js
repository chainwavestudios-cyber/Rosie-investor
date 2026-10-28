/**
 * Gmail-only engagement milestones. All website indicators mean a recorded
 * tracked redirect, NOT proof a website finished loading or was read.
 * Full audio is ≥98% estimated playback or an explicit player ended event.
 */
const clamp = (n) => Math.min(100, Math.max(0, Number(n) || 0));
const latest = (a, b) => new Date(a || 0).getTime() > new Date(b || 0).getTime() ? a : b;

export function linkCategory(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'bbb.org' || host.endsWith('.bbb.org')) return 'bbb';
    if (host === 'trustpilot.com' || host.endsWith('.trustpilot.com')) return 'trustpilot';
    if (host === 'debtadvisorsofamerica.com' || host.endsWith('.debtadvisorsofamerica.com')) return 'company';
    if ((host === 'debtsolutions.cc' || host.endsWith('.debtsolutions.cc') || host.endsWith('.base44.app')) && parsed.pathname.replace(/\/$/, '') === '/welcome') return 'welcome';
  } catch {}
  return '';
}

export function aggregateMilestones(sends = []) {
  const flags = { bbb: false, trustpilot: false, company: false, calendar: false };
  let percent = 0, audioPlays = 0, audioCompleted = false, estimated = false;
  let fullAudioAt = null, mostRecentAt = null, lastTemplate = '';
  let sendIdForFullAudio = '';
  const uniqueLinks = new Set();
  for (const send of sends) {
    const pct = clamp(send.audioBestPercent);
    const completed = !!send.audioCompleted || (pct >= 98 && Number(send.audioPlays || 0) > 0);
    percent = Math.max(percent, pct);
    audioPlays += Number(send.audioPlays || 0);
    if (completed) {
      audioCompleted = true;
      const completedAt = send.audioFullAt || send.audioLastAt || send.lastEventAt || send.sentAt;
      if (!fullAudioAt || new Date(completedAt || 0) > new Date(fullAudioAt)) {
        fullAudioAt = completedAt || null;
        sendIdForFullAudio = String(send.sendId || '');
        estimated = !!send.audioCompletionEstimated || !send.audioCompleted;
      }
    }
    flags.calendar ||= !!send.calendarOpened;
    flags.company ||= !!send.websiteClicked;
    for (const url of send.clickedDestinations || []) {
      uniqueLinks.add(url);
      const category = linkCategory(url);
      if (category && category in flags) flags[category] = true;
    }
    mostRecentAt = latest(mostRecentAt, send.lastEngagementAt || send.lastEventAt || send.sentAt);
    if (!lastTemplate) lastTemplate = send.templateName || '';
  }
  const allWebsites = flags.bbb && flags.trustpilot && flags.company;
  const allLinksAndAudio = audioCompleted && allWebsites;
  const eliteJourney = allLinksAndAudio && flags.calendar;
  const milestone = eliteJourney ? 'elite' : allLinksAndAudio ? 'all_signals' : audioCompleted ? 'gold' : 'none';
  return { flags, percent, audioCompleted, audioPlays, estimated, fullAudioAt, sendIdForFullAudio,
    lastTemplate, lastEngagementAt: mostRecentAt, allWebsites, allLinksAndAudio, eliteJourney,
    goldListener: audioCompleted, milestone, uniqueLinks: uniqueLinks.size,
  };
}

export function milestoneCounts(people = []) {
  return {
    goldListeners: people.filter(p => p.goldListener).length,
    allLinksAndAudio: people.filter(p => p.allLinksAndAudio).length,
    eliteJourneys: people.filter(p => p.eliteJourney).length,
    calendarOpeners: people.filter(p => p.flags?.calendar).length,
    companyVisitors: people.filter(p => p.flags?.company).length,
  };
}

export const MILESTONE_FILTERS = [
  { key: 'all', label: 'All contacts' },
  { key: 'gold', label: 'Gold listeners' },
  { key: 'strong', label: '75%+ played' },
  { key: 'websites', label: 'All 3 websites' },
  { key: 'company', label: 'Company link' },
  { key: 'calendar', label: 'Calendar opened' },
  { key: 'all_signals', label: 'All links + audio' },
  { key: 'elite', label: 'Elite journey' },
  { key: 'followup', label: 'Follow up' },
];

export function matchesMilestoneFilter(person, filter) {
  switch (filter) {
    case 'gold': return person.goldListener;
    case 'strong': return person.percent >= 75;
    case 'websites': return person.allWebsites;
    case 'company': return person.flags?.company;
    case 'calendar': return person.flags?.calendar;
    case 'all_signals': return person.allLinksAndAudio;
    case 'elite': return person.eliteJourney;
    case 'followup': return person.hotLead || person.allLinksAndAudio || person.flags?.calendar;
    default: return true;
  }
}
