// Rosie AI Site Visit Tracker
// Loads on external consumer/investor sites and reports back to admin app

(function() {
  // Get ref code from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref') || urlParams.get('code') || null;
  
  if (!refCode) return; // No ref code, don't track
  
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  let startTime = Date.now();
  let lastActiveTime = Date.now();
  let isVisible = true;
  
  // Detect if tab is visible to avoid counting idle time
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isVisible = false;
    } else {
      isVisible = true;
      lastActiveTime = Date.now();
    }
  });
  
  // Track mouse/keyboard activity
  const updateActivity = () => {
    if (isVisible) lastActiveTime = Date.now();
  };
  document.addEventListener('mousedown', updateActivity);
  document.addEventListener('keydown', updateActivity);
  document.addEventListener('scroll', updateActivity);
  
  // Send visit data to admin app
  const logVisit = () => {
    const endTime = Date.now();
    const timeOnPageMs = Math.max(0, endTime - startTime);
    const timeOnPageSeconds = Math.round(timeOnPageMs / 1000);
    
    // Only send if > 1 second
    if (timeOnPageSeconds < 1) return;
    
    const payload = {
      passcode: refCode,
      page: window.location.pathname,
      referrer: document.referrer || '',
      timeOnPage: timeOnPageSeconds,
      sessionId: sessionId,
      siteType: window.location.hostname.includes('investors') ? 'investor' : 'consumer',
      visitedAt: new Date().toISOString(),
    };
    
    // Post to admin app's logSiteVisit function
    // The function endpoint path is typically /api/functions/logSiteVisit
    const adminAppUrl = 'https://rosieai-admin.app'; // Replace with actual admin app URL
    const endpoint = adminAppUrl + '/api/functions/logSiteVisit';
    
    // Use sendBeacon for reliable delivery on page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(payload));
    } else {
      // Fallback to fetch with keepalive
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {}); // Silently fail
    }
  };
  
  // Send on page unload
  window.addEventListener('beforeunload', logVisit);
  
  // Also send periodically (every 30 seconds) to track multi-page sessions
  setInterval(() => {
    if (isVisible) {
      const endTime = Date.now();
      const timeOnPageMs = Math.max(0, endTime - startTime);
      const timeOnPageSeconds = Math.round(timeOnPageMs / 1000);
      
      if (timeOnPageSeconds > 1) {
        // Send intermediate ping
        const payload = {
          passcode: refCode,
          page: window.location.pathname,
          referrer: document.referrer || '',
          timeOnPage: timeOnPageSeconds,
          sessionId: sessionId,
          siteType: window.location.hostname.includes('investors') ? 'investor' : 'consumer',
          visitedAt: new Date().toISOString(),
        };
        
        const adminAppUrl = 'https://rosieai-admin.app';
        const endpoint = adminAppUrl + '/api/functions/logSiteVisit';
        
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    }
  }, 30000); // Every 30 seconds
})();
