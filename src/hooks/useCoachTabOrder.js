import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { COACH_TAB_LAYOUT, defaultRows, reconcileRows, tabMapFor, moveTabBetweenRows } from '@/lib/coachTabs';

// Owns the two-row tab arrangement for the Debt Call Coach page and persists it
// per user (SavedLayout), so each user keeps their own tab order.
export default function useCoachTabOrder({ username, isAdmin, isSuperAdmin, isSuperManager, isDialerRole }) {
  const flags = useMemo(
    () => ({ isAdmin: !!isAdmin, isSuperAdmin: !!isSuperAdmin, isSuperManager: !!isSuperManager, isDialerRole: !!isDialerRole }),
    [isAdmin, isSuperAdmin, isSuperManager, isDialerRole],
  );
  const [rows, setRows] = useState(() => defaultRows(flags));
  const [recordId, setRecordId] = useState(null);

  useEffect(() => { setRows(defaultRows(flags)); }, [flags]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    base44.entities.SavedLayout.filter({ layoutName: COACH_TAB_LAYOUT, username }, '-created_date', 5)
      .then((res) => {
        const record = (res?.items || res || [])[0];
        if (cancelled || !record) return;
        setRecordId(record.id);
        try {
          const parsed = JSON.parse(record.layoutDataJson || '{}');
          if (Array.isArray(parsed.rows)) setRows(reconcileRows(parsed.rows, flags));
        } catch { /* keep defaults */ }
      })
      .catch(() => { /* keep defaults */ });
    return () => { cancelled = true; };
  }, [username, flags]);

  const persist = useCallback((nextRows, id) => {
    if (!username) return;
    const payload = { layoutName: COACH_TAB_LAYOUT, username, layoutDataJson: JSON.stringify({ rows: nextRows }) };
    const save = id ? base44.entities.SavedLayout.update(id, payload) : base44.entities.SavedLayout.create(payload);
    save.then((saved) => { if (saved?.id) setRecordId(saved.id); }).catch(() => { /* silent — order still applies this session */ });
  }, [username]);

  const moveTab = useCallback((source, destination) => {
    setRows((prev) => {
      const next = moveTabBetweenRows(prev, source, destination);
      persist(next, recordId);
      return next;
    });
  }, [persist, recordId]);

  const reset = useCallback(() => {
    const defaults = defaultRows(flags);
    setRows(defaults);
    persist(defaults, recordId);
  }, [flags, persist, recordId]);

  const tabMap = useMemo(() => tabMapFor(flags), [flags]);

  return { rows, tabMap, moveTab, reset };
}