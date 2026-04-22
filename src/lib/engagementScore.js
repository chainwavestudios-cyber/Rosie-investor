/**
 * Engagement Scoring System
 *
 * Scoring rules:
 * - First login ever:              +5 pts
 * - Each new session login:        +1 pt
 * - 3+ sessions in one day:        +10 pts (bonus, once per day)
 * - Read circular/PPM (doc view):  +10 pts
 * - Look at subscription docs:     +10 pts
 * - Filled questionnaire:          +10 pts
 * - 75%+ of PPM/circular viewed:   +5 pts bonus
 * - Download 1 document:           +10 pts
 * - Download 2 documents:          +15 pts (replaces 1-doc bonus)
 * - Download all 3 documents:      +20 pts (replaces 2-doc bonus)
 * - SignNow documents requested:   +40 pts
 * - 15+ min in portal (one session)+10 pts
 * - Used Rosie AI chatbot:         +10 pts
 */

export function computeEngagementScore(sessions = [], hasSignNow = false, hasRosie = false) {
  let score = 0;

  if (sessions.length === 0 && !hasSignNow && !hasRosie) return 0;

  // First login
  if (sessions.length >= 1) score += 5;

  // +1 per additional session
  if (sessions.length > 1) score += (sessions.length - 1);

  // 3+ sessions in a day → +10 bonus (once per day)
  const sessionsByDay = {};
  sessions.forEach(s => {
    if (!s.startTime) return;
    const day = new Date(s.startTime).toDateString();
    sessionsByDay[day] = (sessionsByDay[day] || 0) + 1;
  });
  const daysWithTriple = Object.values(sessionsByDay).filter(c => c >= 3).length;
  score += daysWithTriple * 10;

  // Doc views across all sessions
  const allDocViews = sessions.flatMap(s => s.docViews || []);
  const allDownloads = sessions.flatMap(s => s.downloads || []);
  const allPages = sessions.flatMap(s => s.pages || []);

  // Detect specific doc types (by name heuristics)
  const hasPPM = allDocViews.some(d => /ppm|circular|offering/i.test(d.docName || ''));
  const hasSubscription = allDocViews.some(d => /subscription|sub agreement/i.test(d.docName || ''));
  const hasQuestionnaire = allDocViews.some(d => /questionnaire|questionaire|accreditation/i.test(d.docName || ''));

  if (hasPPM) score += 10;
  if (hasSubscription) score += 10;
  if (hasQuestionnaire) score += 10;

  // 75%+ of PPM viewed bonus
  const ppmDoc = allDocViews.find(d => /ppm|circular|offering/i.test(d.docName || ''));
  if (ppmDoc && ppmDoc.pagesViewed && ppmDoc.totalPages) {
    const pct = ppmDoc.pagesViewed.length / ppmDoc.totalPages;
    if (pct >= 0.75) score += 5;
  }

  // Downloads
  const uniqueDownloads = new Set(allDownloads.map(d => d.fileName)).size;
  if (uniqueDownloads >= 3) score += 20;
  else if (uniqueDownloads === 2) score += 15;
  else if (uniqueDownloads === 1) score += 10;

  // SignNow requested
  if (hasSignNow) score += 40;

  // 15+ min in portal (any single session)
  const longSession = sessions.some(s => (s.durationSeconds || 0) >= 900);
  if (longSession) score += 10;

  // Used Rosie AI
  if (hasRosie) score += 10;

  return score;
}

export function getScoreColor(score) {
  if (score >= 80) return '#4ade80';   // green — hot
  if (score >= 50) return '#f59e0b';   // amber — warm
  if (score >= 20) return '#60a5fa';   // blue — engaged
  return '#6b7280';                    // gray — cold
}

export function getScoreLabel(score) {
  if (score >= 80) return 'Hot';
  if (score >= 50) return 'Warm';
  if (score >= 20) return 'Engaged';
  return 'Cold';
}