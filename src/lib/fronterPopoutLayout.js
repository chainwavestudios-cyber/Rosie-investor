/**
 * fronterPopoutLayout.js — Shared per-fronter layout storage for the three
 * call popouts (Q&A, script, transcript). Saves to localStorage so Alt-L /
 * Command-L can persist all three at once and calls can restore them.
 */

const STORAGE_KEY_PREFIX = 'fronter_popout_layout_';

const DEFAULT_LAYOUT = {
  qa: { x: 30, y: 80, w: 700, h: 600 },
  script: { x: 660, y: 80, w: 800, h: 500 },
  transcript: { x: 20, y: 20, w: 340, h: 800 },
};

export function loadFronterLayout(username) {
  if (!username) return { ...DEFAULT_LAYOUT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + username);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw);
    return {
      qa: { ...DEFAULT_LAYOUT.qa, ...parsed.qa },
      script: { ...DEFAULT_LAYOUT.script, ...parsed.script },
      transcript: { ...DEFAULT_LAYOUT.transcript, ...parsed.transcript },
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function saveFronterLayout(username, layout) {
  if (!username) return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + username, JSON.stringify(layout));
  } catch {}
}