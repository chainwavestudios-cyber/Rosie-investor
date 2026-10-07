/**
 * useObjectionEngine — watches the live transcript for customer objections.
 * Loads all enabled Objection records, scans each new customer line against
 * their trigger phrases (case-insensitive substring match), and surfaces the
 * highest-priority match. High-priority objections trigger a blocking popup
 * (ObjectionPopup); all matches are collected as recentMatches for highlight.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const PRIO_RANK = { high: 0, medium: 1, low: 2 };

export function useObjectionEngine(transcript) {
  const [objections, setObjections] = useState([]);
  const [activeObjection, setActiveObjection] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const lastCheckedKeyRef = useRef('');

  // Load enabled objections; reload when the management tab saves changes.
  useEffect(() => {
    const load = () => base44.entities.Objection.list('-created_date', 200)
      .then(rows => setObjections(rows || []))
      .catch(() => setObjections([]));
    load();
    const handler = () => load();
    window.addEventListener('objections_updated', handler);
    let unsub;
    try { unsub = base44.entities.Objection.subscribe?.(() => load()); } catch {}
    return () => {
      window.removeEventListener('objections_updated', handler);
      if (unsub) try { unsub(); } catch {}
    };
  }, []);

  // Watch the latest committed customer line for objection matches.
  useEffect(() => {
    if (!transcript || transcript.length === 0) return;
    const customerLines = transcript.filter(l => l.speaker !== 0 && !l.interim && l.text);
    if (customerLines.length === 0) return;
    const latest = customerLines[customerLines.length - 1];
    const key = (latest.time || '') + '|' + (latest.text || '').slice(0, 60);
    if (key === lastCheckedKeyRef.current) return;
    lastCheckedKeyRef.current = key;

    const text = (latest.text || '').toLowerCase();
    const matched = objections
      .filter(o => o.enabled !== false)
      .filter(o => {
        try {
          const phrases = JSON.parse(o.triggerPhrases || '[]');
          return phrases.some(p => p && text.includes(String(p).toLowerCase()));
        } catch { return false; }
      })
      .sort((a, b) => (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1));

    if (matched.length === 0) return;
    const top = matched[0];

    setRecentMatches(prev => {
      if (prev.some(m => m.objectionId === top.id)) return prev;
      return [{ objectionId: top.id, title: top.title, lineText: latest.text, time: latest.time, priority: top.priority }, ...prev].slice(0, 20);
    });

    // High priority → blocking popup with the response text
    if (top.priority === 'high') {
      setActiveObjection({ ...top, lineText: latest.text, lineTime: latest.time });
    }
  }, [transcript, objections]);

  const dismiss = useCallback(() => setActiveObjection(null), []);
  const clearRecent = useCallback(() => setRecentMatches([]), []);

  return { objections, activeObjection, dismiss, recentMatches, clearRecent };
}