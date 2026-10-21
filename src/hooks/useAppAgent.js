import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { extractAgentNavigation, navigationUrl } from '@/lib/agentNav';

// Drives the ⌘A command console: keeps the running conversation (so it survives
// page changes and reloads), sends each turn to the appAgent function, and turns
// the agent's navigation directives into real page changes.
const HISTORY_KEY = 'aceConsoleHistory';
const MAX_STORED = 24;
const MAX_SENT = 12;

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The Debt Call Coach portals use their own session, stored outside Base44 auth.
function readPortalSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem('debtCoachSession') || 'null');
    return parsed?.userId && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export default function useAppAgent() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(loadHistory);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch { /* history is a convenience, never fatal */ }
  }, [messages]);

  const reset = useCallback(() => {
    setMessages([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  }, []);

  const send = useCallback(async (text) => {
    const content = String(text || '').trim();
    if (!content || busy) return;

    const withUser = [...messages, { role: 'user', content, at: Date.now() }];
    setMessages(withUser);
    setBusy(true);

    try {
      const session = readPortalSession();
      const res = await base44.functions.invoke('appAgent', {
        messages: withUser.slice(-MAX_SENT).map((m) => ({ role: m.role, content: m.content })),
        sessionUserId: session?.userId,
        sessionToken: session?.token,
        context: {
          path: window.location.pathname,
          tab: new URLSearchParams(window.location.search).get('tab') || '',
          now: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true }),
        },
      });
      const data = res?.data || res || {};
      const { clean, actions } = extractAgentNavigation(data.reply || '');

      let landed = null;
      if (actions.length) {
        const url = navigationUrl(actions[0]);
        navigate(url);
        landed = url;
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: clean || 'Done.',
        toolLog: data.toolLog || [],
        landed,
        at: Date.now(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'I could not reach the console service just now. Try again in a moment.',
        at: Date.now(),
      }]);
    } finally {
      setBusy(false);
    }
  }, [messages, busy, navigate]);

  return { messages, busy, send, reset };
}