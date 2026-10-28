/**
 * Low-latency, local-only live objection engine. The path from transcript to
 * detected response never makes a network/LLM call; data is loaded ahead of time.
 * Every matched objection is available in the compact activity rail.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { recentCustomerTurn, findObjectionMatches } from '@/lib/objectionDetection';

export function useObjectionEngine(transcript, active = true) {
  const [objections, setObjections] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [activeObjection, setActiveObjection] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const lastCheckedKeyRef = useRef('');
  const firedAtRef = useRef({});

  useEffect(() => {
    const load = () => base44.entities.Objection.list('-created_date', 200)
      .then(rows => setObjections(rows || []))
      .catch(e => console.error('[objection engine] catalog unavailable:', e));
    load();
    window.addEventListener('objections_updated', load);
    let unsubscribe;
    try { unsubscribe = base44.entities.Objection.subscribe?.(load); } catch {}
    return () => {
      window.removeEventListener('objections_updated', load);
      if (unsubscribe) try { unsubscribe(); } catch {}
    };
  }, []);

  // KB alternatives must actually belong to this objection. A fuzzy match
  // across the whole KB can show unrelated or unsupported answers.
  useEffect(() => {
    const load = () => base44.entities.KnowledgeBase.filter({ category: 'debt_objections' }, '-created_date', 200)
      .then(rows => setKbEntries(Array.isArray(rows) ? rows : rows?.items || []))
      .catch(() => setKbEntries([]));
    load();
    window.addEventListener('kb_updated', load);
    window.addEventListener('debt_kb_updated', load);
    return () => {
      window.removeEventListener('kb_updated', load);
      window.removeEventListener('debt_kb_updated', load);
    };
  }, []);

  useEffect(() => {
    if (active) return;
    setActiveObjection(null);
    setRecentMatches([]);
    firedAtRef.current = {};
    lastCheckedKeyRef.current = '';
  }, [active]);

  useEffect(() => {
    if (!active || !Array.isArray(transcript) || !transcript.length) return;
    const turn = recentCustomerTurn(transcript);
    if (!turn) return;
    const key = (turn.latest.time || '') + '|' + turn.text;
    if (key === lastCheckedKeyRef.current) return;
    lastCheckedKeyRef.current = key;
    const now = Date.now();
    const found = findObjectionMatches(turn.text, objections, firedAtRef.current, now);
    if (!found.length) return;
    const { objection, family, score, phrase } = found[0];
    firedAtRef.current[family] = now;

    const responseText = String(objection.responseText || '').trim();
    const kbOptions = [];
    const tag = 'objection_id:' + objection.id;
    for (const kb of kbEntries) {
      if (!String(kb.tags || '').split(/\s+/).includes(tag)) continue;
      // Skip synchronized copies of the same objection, and do not treat
      // unapproved recorded-call examples as verified facts.
      if (kb.answer && kb.answer.trim() !== responseText &&
          !kb.answer.includes('[Customer Mindset:') && kb.verified === true) {
        kbOptions.push({ answer: kb.answer, source: kb.kbName || kb.source || 'Approved KB', question: kb.question });
      }
    }

    const event = {
      ...objection, objectionId: objection.id,
      lineText: turn.text.slice(-300), lineTime: turn.latest.time,
      detectedAt: now, matchedPhrase: phrase, matchScore: score,
      kbOptions,
    };
    setRecentMatches(prev => [event, ...prev].slice(0, 20));
    if (objection.priority === 'high') setActiveObjection(event);
  }, [active, transcript, objections, kbEntries]);

  const dismiss = useCallback(() => setActiveObjection(null), []);
  const openMatch = useCallback(event => setActiveObjection({ ...event, manualOpenAt: Date.now() }), []);
  const clearRecent = useCallback(() => setRecentMatches([]), []);
  return { objections, activeObjection, dismiss, dismissObjection: dismiss,
    openMatch, recentMatches, clearRecent };
}
