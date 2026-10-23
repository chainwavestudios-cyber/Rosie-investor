/**
 * useEngagementReport — the report behind the Email Engagement page.
 * One call returns the campaign table, the ranked leads and the activity tail;
 * a new tracked event re-reads it (throttled, and after the crawler filter).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

export default function useEngagementReport(days = 30) {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    const unsubscribe = base44.entities.EmailTrackingEvent.subscribe(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 15000);
    });
    return () => { clearTimeout(timer.current); try { unsubscribe(); } catch { /* ignore */ } };
  }, [load]);

  return { report, loading, error, refresh: load };
}