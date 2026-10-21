// Client-side map + directive parser for the ⌘A AI command console.
// The agent answers in prose and appends [[GOTO:<path>?tab=<id>]] when the user
// should be taken somewhere. Those targets are validated here against the real
// router before anything navigates.
import { COACH_TABS } from '@/lib/coachTabs';

// Keep in sync with the <Route> list in src/App.jsx.
export const AGENT_ROUTE_PATHS = [
  '/',
  '/debt-call-coach',
  '/debt-call-coach-login',
  '/fronter',
  '/manager-portal',
  '/compliance-portal',
  '/superadmin-portal',
  '/assistant-portal',
  '/interviews',
  '/training',
  '/credit',
  '/admin',
  '/portal',
  '/offering',
  '/investor-page',
  '/aboutdebt',
  '/request-access',
  '/optin',
  '/privacy',
  '/terms',
  '/log',
  '/work-report',
  '/reschedule',
  '/growth-plan',
  '/live-codebase-explorer',
  '/DirectD',
];

export const COACH_TAB_IDS = COACH_TABS.map((t) => t.id);
export const COACH_PATH = '/debt-call-coach';

// Pull every [[GOTO:...]] directive out of an agent reply and validate it.
export function extractAgentNavigation(text) {
  const actions = [];
  const clean = String(text || '')
    .replace(/\[\[\s*GOTO:\s*([^\]\s]+)\s*\]\]/gi, (_match, target) => {
      const [rawPath, query] = String(target).split('?');
      const path = (rawPath.replace(/\/+$/, '') || '/');
      if (!AGENT_ROUTE_PATHS.includes(path)) return '';
      const tab = new URLSearchParams(query || '').get('tab');
      if (tab && !COACH_TAB_IDS.includes(tab)) return '';
      if (!actions.some((a) => a.path === path && a.tab === (tab || null))) {
        actions.push({ path, tab: tab || null });
      }
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { clean, actions };
}

export function navigationUrl(action) {
  if (!action) return null;
  return action.tab ? `${action.path}?tab=${action.tab}` : action.path;
}