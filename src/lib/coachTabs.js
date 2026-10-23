// Tab registry for the Debt Call Coach page.
// row 0 = the top row, row 1 = the bottom (original) row. Users can drag tabs
// between and within rows — the arrangement is saved per user in SavedLayout.
export const COACH_TAB_LAYOUT = 'debtCoachTabs';

export const COACH_TABS = [
  { id: 'live', label: '📞 Live Call', row: 1, show: () => true },
  { id: 'scripts', label: '📜 Scripts', row: 1, show: () => true },
  { id: 'closing', label: '🏁 Closing', row: 1, show: () => true },
  { id: 'calls', label: '📋 Calls', row: 1, show: () => true },
  { id: 'newleads', label: '📥 New Leads', row: 1, show: () => true },
  { id: 'hotleads', label: '🔥 Hot Leads', row: 1, show: () => true },
  { id: 'bob', label: '🤖 BOB Training', row: 1, show: () => true },

  { id: 'marketing', label: '📣 Marketing', row: 0, show: (c) => c.isAdmin },
  { id: 'leadgen', label: '🎯 Lead Gen', row: 0, show: (c) => c.isAdmin },
  { id: 'smartleads', label: '🧠 Smart Leads', row: 0, show: (c) => c.isAdmin },
  { id: 'pipeline', label: '📊 Pipeline', row: 0, show: () => true },
  { id: 'pitches', label: '🎤 Pitches', row: 0, show: () => true },
  { id: 'emails', label: '📧 Emails', row: 0, show: () => true },
  { id: 'campaigns', label: '📮 Email Campaigns', row: 0, show: (c) => c.isAdmin },
  { id: 'objections', label: '🛡️ Objections', row: 0, show: () => true },
  { id: 'kb', label: '🧠 Knowledge Base', row: 0, show: () => true },
  { id: 'kbchat', label: '💬 AI KB Chat', row: 0, show: (c) => !c.isDialerRole },
  { id: 'profile', label: '👤 Prospects', row: 0, show: () => true },
  { id: 'stats', label: '📊 My Stats', row: 0, show: (c) => c.isDialerRole },
  { id: 'compliance', label: '🛡 Compliance', row: 0, show: (c) => c.isSuperManager },
  { id: 'aicredits', label: '💳 AI Credits', row: 0, show: (c) => c.isSuperAdmin },
  { id: 'aireports', label: '🧾 AI Reports', row: 0, show: (c) => c.isAdmin },
  { id: 'protoface', label: '🎥 ProtoFace', row: 0, show: (c) => c.isAdmin },
  { id: 'admin', label: '⚙️ Admin', row: 0, show: (c) => c.isAdmin },
];

export function visibleTabs(flags) {
  return COACH_TABS.filter((t) => t.show(flags || {}));
}

export function tabMapFor(flags) {
  const map = {};
  for (const t of visibleTabs(flags)) map[t.id] = t;
  return map;
}

export function defaultRows(flags) {
  const tabs = visibleTabs(flags);
  return [0, 1].map((row) => tabs.filter((t) => t.row === row).map((t) => t.id));
}

// Layer a saved arrangement over the tabs this user may see: keep the saved
// order, append tabs added since (AI Reports, …), drop ones they can't access.
export function reconcileRows(savedRows, flags) {
  const tabs = visibleTabs(flags);
  const allowed = new Set(tabs.map((t) => t.id));
  const rows = [[], []];
  if (Array.isArray(savedRows)) {
    savedRows.slice(0, 2).forEach((row, i) => {
      for (const id of (Array.isArray(row) ? row : [])) {
        if (allowed.has(id) && !rows[0].includes(id) && !rows[1].includes(id)) rows[i].push(id);
      }
    });
  }
  for (const t of tabs) {
    if (!rows[0].includes(t.id) && !rows[1].includes(t.id)) rows[t.row].push(t.id);
  }
  return rows;
}

// Pure move used by the drag handler.
export function moveTabBetweenRows(rows, source, destination) {
  const next = rows.map((r) => [...r]);
  if (!next[source.row] || !next[destination.row]) return rows;
  const [moved] = next[source.row].splice(source.index, 1);
  if (moved === undefined) return rows;
  const at = Math.max(0, Math.min(destination.index, next[destination.row].length));
  next[destination.row].splice(at, 0, moved);
  return next;
}