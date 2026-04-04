// Investor Portal Analytics & User Tracking
// Tracks: logins, session duration, page visits, section dwell time, downloads

const STORAGE_KEY = 'rosie_analytics';
const SESSION_KEY = 'rosie_session';

function getStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: {}, sessions: [] };
  } catch {
    return { users: {}, sessions: [] };
  }
}

function setStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Analytics storage error:', e);
  }
}

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Session storage error:', e);
  }
}

export const analytics = {
  // Start a new session when user logs in
  startSession(userEmail, userName) {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      userEmail,
      userName,
      startTime: new Date().toISOString(),
      endTime: null,
      durationSeconds: 0,
      pages: [],
      downloads: [],
      currentPage: null,
      currentSection: null,
      pageStartTime: null,
      sectionStartTime: null,
    };
    setSession(session);

    // Save to persistent storage
    const store = getStorage();
    if (!store.users[userEmail]) {
      store.users[userEmail] = { email: userEmail, name: userName, sessions: [] };
    }
    store.sessions.push({ ...session });
    setStorage(store);

    return sessionId;
  },

  // Track page navigation
  trackPageView(page) {
    const session = getSession();
    if (!session) return;

    const now = new Date().toISOString();

    // Close previous page
    if (session.currentPage && session.pageStartTime) {
      const durationSeconds = Math.round((Date.now() - new Date(session.pageStartTime).getTime()) / 1000);
      session.pages.push({
        page: session.currentPage,
        enteredAt: session.pageStartTime,
        exitedAt: now,
        durationSeconds,
        sections: session.currentPageSections || [],
      });
    }

    session.currentPage = page;
    session.pageStartTime = now;
    session.currentPageSections = [];
    session.currentSection = null;
    session.sectionStartTime = null;

    setSession(session);
    analytics._persistSession(session);
  },

  // Track section/tab focus within a page
  trackSection(section) {
    const session = getSession();
    if (!session) return;

    const now = new Date().toISOString();

    // Close previous section
    if (session.currentSection && session.sectionStartTime) {
      const durationSeconds = Math.round((Date.now() - new Date(session.sectionStartTime).getTime()) / 1000);
      if (!session.currentPageSections) session.currentPageSections = [];
      session.currentPageSections.push({
        section: session.currentSection,
        enteredAt: session.sectionStartTime,
        exitedAt: now,
        durationSeconds,
      });
    }

    session.currentSection = section;
    session.sectionStartTime = now;
    setSession(session);
  },

  // Track file downloads
  trackDownload(fileName, fileType) {
    const session = getSession();
    if (!session) return;

    session.downloads = session.downloads || [];
    session.downloads.push({
      fileName,
      fileType,
      downloadedAt: new Date().toISOString(),
      page: session.currentPage,
    });

    setSession(session);
    analytics._persistSession(session);
  },

  // End session (on logout or window close)
  endSession() {
    const session = getSession();
    if (!session) return;

    const now = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000);

    // Close current page
    if (session.currentPage && session.pageStartTime) {
      if (session.currentSection && session.sectionStartTime) {
        const secDuration = Math.round((Date.now() - new Date(session.sectionStartTime).getTime()) / 1000);
        if (!session.currentPageSections) session.currentPageSections = [];
        session.currentPageSections.push({
          section: session.currentSection,
          enteredAt: session.sectionStartTime,
          exitedAt: now,
          durationSeconds: secDuration,
        });
      }
      const pageDuration = Math.round((Date.now() - new Date(session.pageStartTime).getTime()) / 1000);
      session.pages.push({
        page: session.currentPage,
        enteredAt: session.pageStartTime,
        exitedAt: now,
        durationSeconds: pageDuration,
        sections: session.currentPageSections || [],
      });
    }

    session.endTime = now;
    session.durationSeconds = durationSeconds;

    analytics._persistSession(session);
    sessionStorage.removeItem(SESSION_KEY);
  },

  _persistSession(session) {
    const store = getStorage();
    const idx = store.sessions.findIndex(s => s.id === session.id);
    const clean = { ...session };
    delete clean.pageStartTime;
    delete clean.sectionStartTime;
    delete clean.currentPageSections;

    if (idx >= 0) {
      store.sessions[idx] = clean;
    } else {
      store.sessions.push(clean);
    }

    // Update user summary
    if (!store.users[session.userEmail]) {
      store.users[session.userEmail] = { email: session.userEmail, name: session.userName, sessions: [] };
    }
    const userSessionIdx = store.users[session.userEmail].sessions?.findIndex(s => s.id === session.id) ?? -1;
    if (!store.users[session.userEmail].sessions) store.users[session.userEmail].sessions = [];
    if (userSessionIdx >= 0) {
      store.users[session.userEmail].sessions[userSessionIdx] = clean;
    } else {
      store.users[session.userEmail].sessions.push(clean);
    }

    setStorage(store);
  },

  // Get all analytics data (for admin)
  getAllData() {
    return getStorage();
  },

  // Get sessions for a specific user
  getUserSessions(email) {
    const store = getStorage();
    return store.users[email]?.sessions || [];
  },

  // Clear all data
  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },

  formatDuration(seconds) {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  },

  getCurrentSession() {
    return getSession();
  }
};

export default analytics;