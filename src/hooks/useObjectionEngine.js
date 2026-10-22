/**
 * useObjectionEngine — watches the live transcript for customer objections.
 * Loads all enabled Objection records, scans each new customer line against
 * their trigger phrases (case-insensitive substring match), and surfaces the
 * highest-priority match. High-priority objections trigger a blocking popup
 * (ObjectionPopup); all matches are collected as recentMatches for highlight.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { isStrongWord, matchPhrase, parsePhrases } from '@/lib/objectionMatch';

const PRIO_RANK = { high: 0, medium: 1, low: 2 };

export function useObjectionEngine(transcript) {
  const [objections, setObjections] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [activeObjection, setActiveObjection] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const lastCheckedKeyRef = useRef('');
  const dismissedKeyRef = useRef('');
  // When each objection last fired, so the same one can't pop up over and over.
  const firedAtRef = useRef({});

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

  // Load KB entries so we can cross-reference objection matches against
  // recorded-call answers — if the KB answer differs, the agent gets both.
  useEffect(() => {
    const load = () => base44.entities.KnowledgeBase.list('-created_date', 500)
      .then(rows => setKbEntries(rows || []))
      .catch(() => setKbEntries([]));
    load();
    const handler = () => load();
    window.addEventListener('kb_updated', handler);
    return () => window.removeEventListener('kb_updated', handler);
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
    // Don't re-trigger an objection the user already dismissed for this line
    if (key === dismissedKeyRef.current) return;

    // What the caller just said — the last few lines, so an objection that
    // arrives in pieces is still read as one statement.
    const window = customerLines.slice(-4).map(l => l.text || '').join(' ');

    // Triggers are written as whole sentences while callers say it their own way
    // (and the transcript arrives in fragments), so phrases are matched on their
    // words: two of the phrase's words said together, in order, one of them a
    // real content word. A single trigger word on its own identifies the few
    // objections written as one phrase ("this is a scam").
    const now = Date.now();
    const matched = [];
    for (const o of objections) {
      if (o.enabled === false) continue;
      // Give the agent time with an objection before it can fire again.
      if (now - (firedAtRef.current[o.id] || 0) < 90000) continue;
      let best = null;
      for (const phrase of parsePhrases(o.triggerPhrases)) {
        const m = matchPhrase(window, phrase);
        if (!m) continue;
        const strong = m.needed === 1 ? m.words.some(isStrongWord) : String(m.pair || '').split(' ').some(isStrongWord);
        if (!strong) continue;
        if (!best || m.score > best.score) best = m;
      }
      if (best) matched.push({ objection: o, ...best });
    }
    matched.sort((a, b) => (PRIO_RANK[a.objection.priority] ?? 1) - (PRIO_RANK[b.objection.priority] ?? 1) || b.score - a.score);

    if (matched.length === 0) return;
    const top = matched[0].objection;
    firedAtRef.current[top.id] = now;

    setRecentMatches(prev => {
      if (prev.some(m => m.objectionId === top.id)) return prev;
      return [{ objectionId: top.id, title: top.title, lineText: latest.text, time: latest.time, priority: top.priority }, ...prev].slice(0, 20);
    });

    // High priority → blocking popup with the response text
    if (top.priority === 'high') {
      // Cross-reference the KB for recorded-call answers to this objection.
      // If the KB answer differs from the engine's response, include it as an
      // alternative option so the agent can choose which to read back.
      const phrases = parsePhrases(top.triggerPhrases);
      const objectionResponse = (top.responseText || '').trim();
      const kbOptions = [];
      const seen = new Set([objectionResponse]);
      for (const kb of kbEntries) {
        const q = (kb.question || '').toLowerCase();
        const v = (kb.variations || '').toLowerCase();
        // Word-level too, so a KB entry worded differently from the trigger still
        // lines up with the objection that just fired.
        const kbText = `${q} ${v}`;
        if (!phrases.some(p => { const m = matchPhrase(kbText, p); return m && (m.pair || m.words.length >= 2); })) continue;
        const allAnswers = [];
        if (kb.answer) allAnswers.push(kb.answer);
        try {
          const extra = JSON.parse(kb.answersJson || '[]');
          if (Array.isArray(extra)) extra.forEach(a => { if (a && !allAnswers.includes(a)) allAnswers.push(a); });
        } catch {}
        for (const ans of allAnswers) {
          const t = (ans || '').trim();
          if (t && !seen.has(t)) {
            seen.add(t);
            kbOptions.push({ answer: ans, source: kb.kbName || kb.source || 'Knowledge Base', question: kb.question });
          }
        }
      }
      setActiveObjection({ ...top, lineText: latest.text, lineTime: latest.time, kbOptions });
    }
  }, [transcript, objections, kbEntries]);

  const dismiss = useCallback(() => {
    dismissedKeyRef.current = lastCheckedKeyRef.current;
    setActiveObjection(null);
  }, []);
  const clearRecent = useCallback(() => setRecentMatches([]), []);

  return { objections, activeObjection, dismiss, recentMatches, clearRecent };
}