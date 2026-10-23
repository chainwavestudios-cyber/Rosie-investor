/**
 * useEngagementReport — the report behind the Email Engagement page.
 * One call returns the campaign table, the ranked leads, the activity tail and the
 * permanent hot-lead record; a new tracked event re-reads it (throttled, and after
 * the crawler filter).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

export default function useEngagementReport(days = 30) {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [handlingId, setHandlingId] = useState('');
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const response = await base44.functions.invoke('engagementReport', { days, sessionUserId, sessionToken });
      setReport(response.data);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load engagement');
    }
    setLoading(false);
  }, [days, sessionUserId, sessionToken]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    let unsubscribe = null;
    try {
      unsubscribe = base44.entities.EmailTrackingEvent.subscribe(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(load, 15000);
      });
    } catch { /* live tail is a bonus — the report still loads on demand */ }
    return () => { clearTimeout(timer.current); try { unsubscribe?.(); } catch { /* already gone */ } };
  }, [load]);

  // "A person has worked this one" — the only write the console makes.
  const markHandled = useCallback(async (recordId, handled, system) => {
    setHandlingId(recordId);
    try {
      const response = await base44.functions.invoke('engagementReport', {
        action: 'handleHotLead', recordId, handled, system, sessionUserId, sessionToken,
      });
      const history = response.data?.history;
      if (history) {
        setReport((prev) => (prev ? {
          ...prev,
          systems: { ...prev.systems, [system]: { ...prev.systems[system], hotHistory: history } },
        } : prev));
      }
    } finally {
      setHandlingId('');
    }
  }, [sessionUserId, sessionToken]);

  return { report, loading, error, refresh: load, markHandled, handlingId };
}