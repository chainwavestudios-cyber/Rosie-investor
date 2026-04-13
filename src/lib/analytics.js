/**
 * Rosie AI Analytics Engine — Base44 Backend
 *
 * Sessions are written to Base44 entities.AnalyticsSession
 * Live cursor state lives in sessionStorage only (fast, ephemeral)
 * On every meaningful event the full session is flushed to Base44
 */

import { AnalyticsSession } from '@/api/entities';

const SESSION_KEY = 'rosie_session';

// ─── sessionStorage helpers (live cursor only) ────────────────────────────

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeSession(s) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  catch (e) { console.warn('[Analytics] session write failed:', e); }
}

function nowISO() { return new Date().toISOString(); }

function secondsSince(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

// ─── Build a clean persistable snapshot ──────────────────────────────────

function snapshot(s, closing = false) {
  const nowTs = nowISO();

  // Close open section
  const openSecs = [...(s._openSections || [])];
  if (s._curSection && s._secStart) {
    openSecs.push({
      section: s._curSection,
      enteredAt: s._secStart,
      exitedAt: nowTs,
      durationSeconds: secondsSince(s._secStart),
    });
  }

  // Close open page
  const pages = [...(s.pages || [])];
  if (s._curPage && s._pageStart) {
    pages.push({
      page: s._curPage,
      enteredAt: s._pageStart,
      exitedAt: nowTs,
      durationSeconds: secondsSince(s._pageStart),
      sections: openSecs,
    });
  }

  // Never include id — flush() decides create vs update separately
  return {
    sessionId:       s.sessionId,
    userEmail:       s.userEmail,
    username:        s.username,
    userName:        s.userName,
    startTime:       s.startTime,
    endTime:         closing ? nowTs : s.endTime,
    durationSeconds: closing ? secondsSince(s.startTime) : (s.durationSeconds || 0),
    pages:     pages,
    downloads: s.downloads || [],
    docViews:  s.docViews  || [],
  };
}

// ─── Flush to Base44 ──────────────────────────────────────────────────────

async function flush(session, closing = false) {
  const clean = snapshot(session, closing);
  try {
    if (session.id) {
      // Record already exists — update it
      await AnalyticsSession.update(session.id, clean);
    } else {
      // First flush — create record, capture returned id
      const created = await AnalyticsSession.create(clean);
      if (created?.id) {
        session.id = created.id;
        writeSession(session);
      }
    }
  } catch (e) {
    console.warn('[Analytics] flush failed:', e);
  }
}

// ─── JSON field parser (Base44 may return arrays as JSON strings) ─────────

function parseJsonField(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

function parseSessionFields(s) {
  return {
    ...s,
    pages:     parseJsonField(s.pages),
    downloads: parseJsonField(s.downloads),
    docViews:  parseJsonField(s.docViews),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

export const analytics = {

  startSession(userEmail, userName, username) {
    // End any open session first
    const existing = readSession();
    if (existing) {
      flush(existing, true).catch(() => {});
    }

    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const s = {
      id:        null,   // filled after Base44 create returns
      sessionId,
      userEmail:  userEmail  || 'unknown',
      username:   username   || userEmail || 'unknown',
      userName:   userName   || 'Unknown',
      startTime:  nowISO(),
      endTime:    null,
      durationSeconds: 0,
      pages:      [],
      downloads:  [],
      docViews:   [],
      _curPage:    null,
      _pageStart:  null,
      _curSection: null,
      _secStart:   null,
      _openSections: [],
    };
    writeSession(s);
    flush(s);
    return sessionId;
  },

  endSession() {
    const s = readSession();
    if (!s) return;
    flush(s, true);
    sessionStorage.removeItem(SESSION_KEY);
  },

  trackPageView(pageName) {
    const s = readSession();
    if (!s) return;
    const nowTs = nowISO();

    if (s._curSection && s._secStart) {
      if (!s._openSections) s._openSections = [];
      s._openSections.push({
        section: s._curSection, enteredAt: s._secStart,
        exitedAt: nowTs, durationSeconds: secondsSince(s._secStart),
      });
    }
    if (s._curPage && s._pageStart) {
      s.pages.push({
        page: s._curPage, enteredAt: s._pageStart,
        exitedAt: nowTs, durationSeconds: secondsSince(s._pageStart),
        sections: s._openSections || [],
      });
    }

    s._curPage = pageName; s._pageStart = nowTs;
    s._curSection = null; s._secStart = null; s._openSections = [];
    writeSession(s);
    flush(s);
  },

  trackSection(sectionName) {
    const s = readSession();
    if (!s) return;
    const nowTs = nowISO();

    if (s._curSection && s._secStart) {
      if (!s._openSections) s._openSections = [];
      s._openSections.push({
        section: s._curSection, enteredAt: s._secStart,
        exitedAt: nowTs, durationSeconds: secondsSince(s._secStart),
      });
    }
    s._curSection = sectionName; s._secStart = nowTs;
    writeSession(s);
    flush(s);
  },

  trackDocumentOpen(docName, docType) {
    const s = readSession();
    if (!s) return null;
    if (!s.docViews) s.docViews = [];
    const id = `${Date.now()}-${docName}`;
    s.docViews.push({
      id, docName, docType,
      openedAt: nowISO(), closedAt: null, durationSeconds: 0,
      pagesViewed: [], page: s._curPage,
      _curDocPage: null, _docPageStart: null,
    });
    writeSession(s);
    flush(s);
    return id;
  },

  trackDocumentPageView(docId, pageNum) {
    const s = readSession();
    if (!s || !s.docViews) return;
    const entry = s.docViews.find(d => d.id === docId);
    if (!entry) return;
    const nowTs = nowISO();
    if (entry._curDocPage !== null && entry._curDocPage !== undefined && entry._docPageStart) {
      if (!entry.pagesViewed) entry.pagesViewed = [];
      entry.pagesViewed.push({
        pageNum: entry._curDocPage, enteredAt: entry._docPageStart,
        exitedAt: nowTs, durationSeconds: secondsSince(entry._docPageStart),
      });
    }
    entry._curDocPage = pageNum; entry._docPageStart = nowTs;
    writeSession(s);
    flush(s);
  },

  trackDocumentClose(docId) {
    const s = readSession();
    if (!s || !s.docViews) return;
    const entry = s.docViews.find(d => d.id === docId);
    if (!entry) return;
    const nowTs = nowISO();
    if (entry._curDocPage !== null && entry._curDocPage !== undefined && entry._docPageStart) {
      if (!entry.pagesViewed) entry.pagesViewed = [];
      entry.pagesViewed.push({
        pageNum: entry._curDocPage, enteredAt: entry._docPageStart,
        exitedAt: nowTs, durationSeconds: secondsSince(entry._docPageStart),
      });
    }
    entry._curDocPage = null; entry._docPageStart = null;
    entry.closedAt = nowTs; entry.durationSeconds = secondsSince(entry.openedAt);
    writeSession(s);
    flush(s);
  },

  trackDownload(fileName, fileType) {
    const s = readSession();
    if (!s) return;
    if (!s.downloads) s.downloads = [];
    s.downloads.push({
      fileName, fileType: fileType || 'file',
      downloadedAt: nowISO(), page: s._curPage, section: s._curSection,
    });
    writeSession(s);
    flush(s);
  },

  // ── Read API (used by AdminDashboard) ─────────────────────────────────

  async getAllSessions() {
    const sessions = await AnalyticsSession.listAll();
    return sessions.map(parseSessionFields);
  },

  async getUserSessions(emailOrUsername) {
    const normalised = (emailOrUsername || '').toLowerCase().trim();
    // Fetch by both email and username in parallel, then dedupe by id
    const [byEmail, byUsername] = await Promise.all([
      AnalyticsSession.listForUser(normalised),
      AnalyticsSession.listForUsername(normalised),
    ]);
    const seen = new Set();
    const merged = [...byEmail, ...byUsername].filter(s => {
      const key = s.id || s.sessionId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return merged
      .map(parseSessionFields)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  },

  computeUserStats(sessions) {
    // Sort descending by startTime so index 0 is always the most recent session
    const sorted = [...sessions].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    const totalTime       = sorted.reduce((s, sess) => s + (sess.durationSeconds || 0), 0);
    const totalDownloads  = sorted.reduce((s, sess) => s + (sess.downloads?.length  || 0), 0);
    const totalDocViews   = sorted.reduce((s, sess) => s + (sess.docViews?.length   || 0), 0);
    const allPages        = sorted.flatMap(s => s.pages || []);

    const pageTime = {};
    allPages.forEach(p => {
      if (p.page) pageTime[p.page] = (pageTime[p.page] || 0) + (p.durationSeconds || 0);
    });

    const sectionTime = {};
    allPages.forEach(p => {
      (p.sections || []).forEach(sec => {
        if (sec.section) {
          const k = `${p.page} › ${sec.section}`;
          sectionTime[k] = (sectionTime[k] || 0) + (sec.durationSeconds || 0);
        }
      });
    });

    const logins = sorted.map(s => ({
      date: s.startTime,
      duration: s.durationSeconds || 0,
      pagesCount: s.pages?.length || 0,
      downloadsCount: s.downloads?.length || 0,
      docViewsCount: s.docViews?.length || 0,
    }));

    return {
      sessionCount:  sorted.length,
      totalTime,
      totalDownloads,
      totalDocViews,
      pageTime,
      sectionTime,
      logins,
      lastSeen:  sorted.length > 0 ? sorted[0].startTime : null,
      firstSeen: sorted.length > 0 ? sorted[sorted.length - 1].startTime : null,
    };
  },

  async computeGlobalStats(allSessions) {
    const raw = allSessions || await AnalyticsSession.listAll();
    const parsed = raw.map(parseSessionFields);
    return {
      totalSessions:  parsed.length,
      totalTime:      parsed.reduce((t, s) => t + (s.durationSeconds || 0), 0),
      totalDownloads: parsed.reduce((t, s) => t + (s.downloads?.length  || 0), 0),
      totalDocViews:  parsed.reduce((t, s) => t + (s.docViews?.length   || 0), 0),
    };
  },

  async exportJSON() {
    const sessions = await AnalyticsSession.listAll();
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `rosie-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getCurrentSession() { return readSession(); },

  // ── Formatting helpers ────────────────────────────────────────────────

  formatDuration(seconds) {
    if (!seconds || seconds < 1) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60), sc = seconds % 60;
    if (m < 60) return sc > 0 ? `${m}m ${sc}s` : `${m}m`;
    const h = Math.floor(m / 60), rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  },
  formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  },
  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },
};

export default analytics;