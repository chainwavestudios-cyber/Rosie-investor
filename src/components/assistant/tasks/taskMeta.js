/**
 * taskMeta.js — Shared lookups for the assistant task list: status/priority labels,
 * the calendar close-out outcomes, the window tabs and the little style helpers.
 */
export const GOLD = '#10b981';
export const RED = '#ef4444';
export const AMBER = '#f59e0b';
export const BLUE = '#60a5fa';

export const BASE_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#8a9ab8' },
  { id: 'in_progress', label: 'In Progress', color: BLUE },
  { id: 'blocked', label: 'Blocked', color: RED },
  { id: 'done', label: 'Done', color: GOLD },
];

// Close-out outcomes for a calendar event: where the client ended up.
export const OUTCOMES = [
  { id: 'not_interested', label: 'Not Interested', color: RED },
  { id: 'rebooked', label: 'Rebooked', color: GOLD },
  { id: 'unavailable', label: 'Unavailable', color: AMBER },
];
export const OUTCOME_IDS = OUTCOMES.map(o => o.id);

export const STATUS_META = [...BASE_STATUSES, ...OUTCOMES].reduce((acc, s) => ({ ...acc, [s.id]: s }), {});

export const PRIORITIES = [
  { id: 'low', label: 'Low', color: '#8a9ab8' },
  { id: 'medium', label: 'Medium', color: BLUE },
  { id: 'high', label: 'High', color: AMBER },
  { id: 'urgent', label: 'Urgent', color: RED },
];
export const PRIORITY_META = PRIORITIES.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

export const CATEGORIES = ['appointment', 'fronter', 'customer', 'compliance', 'system', 'admin', 'other'];

// The task window: open items plus one tab per close-out outcome.
export const VIEWS = [
  { id: 'open', label: 'Open' },
  { id: 'rebooked', label: 'Rebooked' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'unavailable', label: 'Unavailable' },
  { id: 'done', label: 'Completed' },
];

export const inView = (task, view) => view === 'open'
  ? task.status !== 'done' && !OUTCOME_IDS.includes(task.status)
  : task.status === view;

export const fmtDue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  if (days < 0) return `⚠ ${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function selectStyle() {
  return { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none' };
}