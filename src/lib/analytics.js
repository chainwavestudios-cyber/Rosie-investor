/**
 * Rosie AI Investor Portal — Analytics Engine v2
 */

const STORE_KEY   = 'rosie_analytics';
const SESSION_KEY = 'rosie_session';

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { users: {}, sessions: [], version: 2 };
    const parsed = JSON.parse(raw);
    if (!parsed.users)    parsed.users = {};
    if (!parsed.sessions) parsed.sessions = [];
    return parsed;
  } catch { return { users: {}, sessions: [], version: 2 }; }
}

function writeStore(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  catch (e) { console.warn('[Analytics] store write failed:', e); }
}

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

/** Derive a clean persistable snapshot from a live session */
function snapshot(session, closing = false) {
  const s = { ...session };
  const nowTs = nowISO();

  // Close open section
  const openSecs = [...(s._openSections || [])];
  if (s._curSection && s._secStart) {
    openSecs.push({ section: s._curSection, enteredAt: s._secStart, exitedAt: nowTs, durationSeconds: secondsSince(s._secStart) });
  }

  // Close open page
  const pages = [...(s.pages || [])];
  if (s._curPage && s._pageStart) {
    pages.push({ page: s._curPage, enteredAt: s._pageStart, exitedAt: nowTs, durationSeconds: secondsSince(s._pageStart), sections: openSecs });
  }

  return {
    id: s.id, userEmail: s.userEmail, username: s.username, userName: s.userName,
    startTime: s.startTime,
    endTime: closing ? nowTs : s.endTime,
    durationSeconds: closing ? secondsSince(s.startTime) : (s.durationSeconds || 0),
    pages,
    downloads: s.downloads || [],
    docViews: s.docViews || [],
  };
}

function persist(session) {
  const clean = snapshot(session);
  const store = readStore();
  const si = store.sessions.findIndex(x => x.id === clean.id);
  if (si >= 0) store.sessions[si] = clean; else store.sessions.push(clean);

  const key = clean.userEmail;
  if (!store.users[key]) {
    store.users[key] = { email: clean.userEmail, username: clean.username, name: clean.userName, firstSeen: clean.startTime, sessions: [] };
  }
  store.users[key].lastSeen = clean.startTime;
  const ui = store.users[key].sessions.findIndex(x => x.id === clean.id);
  if (ui >= 0) store.users[key].sessions[ui] = clean; else store.users[key].sessions.push(clean);
  writeStore(store);
}

export const analytics = {
  startSession(userEmail, userName, username) {
    const existing = readSession();
    if (existing) { persist(existing); }

    const id = `${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
    const s = {
      id, userEmail: userEmail || 'unknown', username: username || userEmail || 'unknown',
      userName: userName || 'Unknown', startTime: nowISO(), endTime: null, durationSeconds: 0,
      pages: [], downloads: [], docViews: [],
      _curPage: null, _pageStart: null, _curSection: null, _secStart: null, _openSections: [],
    };
    writeSession(s);
    persist(s);
    return id;
  },

  endSession() {
    const s = readSession();
    if (!s) return;
    const clean = snapshot(s, true);
    const store = readStore();
    const si = store.sessions.findIndex(x => x.id === clean.id);
    if (si >= 0) store.sessions[si] = clean; else store.sessions.push(clean);
    const key = clean.userEmail;
    if (store.users[key]) {
      const ui = store.users[key].sessions.findIndex(x => x.id === clean.id);
      if (ui >= 0) store.users[key].sessions[ui] = clean; else store.users[key].sessions.push(clean);
      store.users[key].lastSeen = clean.endTime;
    }
    writeStore(store);
    sessionStorage.removeItem(SESSION_KEY);
  },

  trackPageView(pageName) {
    const s = readSession();
    if (!s) return;
    const nowTs = nowISO();
    if (s._curSection && s._secStart) {
      if (!s._openSections) s._openSections = [];
      s._openSections.push({ section: s._curSection, enteredAt: s._secStart, exitedAt: nowTs, durationSeconds: secondsSince(s._secStart) });
    }
    if (s._curPage && s._pageStart) {
      s.pages.push({ page: s._curPage, enteredAt: s._pageStart, exitedAt: nowTs, durationSeconds: secondsSince(s._pageStart), sections: s._openSections || [] });
    }
    s._curPage = pageName; s._pageStart = nowTs; s._curSection = null; s._secStart = null; s._openSections = [];
    writeSession(s); persist(s);
  },

  trackSection(sectionName) {
    const s = readSession();
    if (!s) return;
    const nowTs = nowISO();
    if (s._curSection && s._secStart) {
      if (!s._openSections) s._openSections = [];
      s._openSections.push({ section: s._curSection, enteredAt: s._secStart, exitedAt: nowTs, durationSeconds: secondsSince(s._secStart) });
    }
    s._curSection = sectionName; s._secStart = nowTs;
    writeSession(s); persist(s);
  },

  trackDocumentOpen(docName, docType) {
    const s = readSession();
    if (!s) return null;
    if (!s.docViews) s.docViews = [];
    const id = `${Date.now()}-${docName}`;
    s.docViews.push({ id, docName, docType, openedAt: nowISO(), closedAt: null, durationSeconds: 0, pagesViewed: [], page: s._curPage, _curDocPage: null, _docPageStart: null });
    writeSession(s); persist(s);
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
      entry.pagesViewed.push({ pageNum: entry._curDocPage, enteredAt: entry._docPageStart, exitedAt: nowTs, durationSeconds: secondsSince(entry._docPageStart) });
    }
    entry._curDocPage = pageNum; entry._docPageStart = nowTs;
    writeSession(s); persist(s);
  },

  trackDocumentClose(docId) {
    const s = readSession();
    if (!s || !s.docViews) return;
    const entry = s.docViews.find(d => d.id === docId);
    if (!entry) return;
    const nowTs = nowISO();
    if (entry._curDocPage !== null && entry._curDocPage !== undefined && entry._docPageStart) {
      if (!entry.pagesViewed) entry.pagesViewed = [];
      entry.pagesViewed.push({ pageNum: entry._curDocPage, enteredAt: entry._docPageStart, exitedAt: nowTs, durationSeconds: secondsSince(entry._docPageStart) });
    }
    entry._curDocPage = null; entry._docPageStart = null;
    entry.closedAt = nowTs; entry.durationSeconds = secondsSince(entry.openedAt);
    writeSession(s); persist(s);
  },

  trackDownload(fileName, fileType) {
    const s = readSession();
    if (!s) return;
    if (!s.downloads) s.downloads = [];
    s.downloads.push({ fileName, fileType: fileType || 'file', downloadedAt: nowISO(), page: s._curPage, section: s._curSection });
    writeSession(s); persist(s);
  },

  getAllData() { return readStore(); },
  getCurrentSession() { return readSession(); },

  getUserSessions(emailOrUsername) {
    const store = readStore();
    const user = store.users[emailOrUsername]
      || Object.values(store.users).find(u => u.username === emailOrUsername || u.email === emailOrUsername);
    if (!user) return [];
    return (user.sessions || []).slice().sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
  },

  getUserStats(emailOrUsername) {
    const sessions = analytics.getUserSessions(emailOrUsername);
    const totalTime      = sessions.reduce((s, sess) => s + (sess.durationSeconds || 0), 0);
    const totalDownloads = sessions.reduce((s, sess) => s + (sess.downloads?.length || 0), 0);
    const totalDocViews  = sessions.reduce((s, sess) => s + (sess.docViews?.length  || 0), 0);
    const allPages       = sessions.flatMap(s => s.pages || []);
    const pageTime = {};
    allPages.forEach(p => { pageTime[p.page] = (pageTime[p.page] || 0) + (p.durationSeconds || 0); });
    const sectionTime = {};
    allPages.forEach(p => { (p.sections||[]).forEach(sec => { const k = `${p.page} › ${sec.section}`; sectionTime[k] = (sectionTime[k]||0) + (sec.durationSeconds||0); }); });
    const logins = sessions.map(s => ({ date: s.startTime, duration: s.durationSeconds, pagesCount: s.pages?.length||0, downloadsCount: s.downloads?.length||0, docViewsCount: s.docViews?.length||0 }));
    return {
      sessionCount: sessions.length, totalTime, totalDownloads, totalDocViews,
      pageTime, sectionTime, logins,
      lastSeen:  sessions.length > 0 ? sessions[0].startTime : null,
      firstSeen: sessions.length > 0 ? sessions[sessions.length-1].startTime : null,
    };
  },

  getGlobalStats() {
    const store = readStore();
    const sessions = store.sessions || [];
    return {
      totalSessions:  sessions.length,
      totalTime:      sessions.reduce((s, sess) => s + (sess.durationSeconds||0), 0),
      totalDownloads: sessions.reduce((s, sess) => s + (sess.downloads?.length||0), 0),
      totalDocViews:  sessions.reduce((s, sess) => s + (sess.docViews?.length||0), 0),
      uniqueUsers:    Object.keys(store.users).length,
    };
  },

  formatDuration(seconds) {
    if (!seconds || seconds < 1) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60), sc = seconds % 60;
    if (m < 60) return sc > 0 ? `${m}m ${sc}s` : `${m}m`;
    const h = Math.floor(m / 60), rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  },
  formatTime(iso) { if (!iso) return '—'; return new Date(iso).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }); },
  formatDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); },
  formatDateTime(iso) { if (!iso) return '—'; return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }); },

  exportJSON() {
    const data = readStore();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rosie-analytics-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  },

  clearAll() { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(SESSION_KEY); },
};

export default analytics;