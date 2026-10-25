/**
 * deepgramKey.js — the one place that decides which Deepgram key a browser session uses.
 *
 * Always ask the server first: server secrets are read live, so rotating a key takes
 * effect immediately. A value compiled into the page (VITE_DEEPGRAM_API_KEY) is whatever
 * existed at build time and goes stale, so it is only a last resort.
 */
import { base44 } from '@/api/base44Client';

// Training key first (BOB sessions run long), then the production key.
const SOURCES = ['deepgramToken2', 'deepgramToken'];

export async function resolveDeepgramKey() {
  for (const fn of SOURCES) {
    try {
      const res = await base44.functions.invoke(fn, {});
      const key = res?.key || res?.data?.key || '';
      if (key) return key;
    } catch { /* try the next source */ }
  }
  return import.meta.env.VITE_DEEPGRAM_API_KEY || '';
}