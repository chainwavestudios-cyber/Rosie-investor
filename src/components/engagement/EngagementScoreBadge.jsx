/**
 * EngagementScoreBadge.jsx — the contact card's engagement score.
 * One function call scores the lead from its tracked email activity, and a new
 * tracked event re-scores it live (after the 30-second mail-crawler filter).
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { tierStyle, scoreTooltip } from '@/lib/engagementTiers';

export default function EngagementScoreBadge({ leadId }) {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const [lead, setLead] = useState(null);
  const [ready, setReady] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!leadId) return undefined;
    let mounted = true;
    const load = async () => {
      try {
        const response = await base44.functions.invoke('engagementReport', { leadId, sessionUserId, sessionToken });
        if (mounted) setLead(response.data?.lead || null);
      } catch {
        if (mounted) setLead(null);
      }
      if (mounted) setReady(true);
    };
    load();
    const unsubscribe = base44.entities.EmailTrackingEvent.subscribe((event) => {
      if (String(event?.data?.leadId) !== String(leadId)) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 4000);
    });
    return () => { mounted = false; clearTimeout(timer.current); try { unsubscribe(); } catch { /* ignore */ } };
  }, [leadId, sessionUserId, sessionToken]);

  const style = tierStyle(lead?.tier);
  const label = ready && lead ? `${style.icon} ${lead.score} ${style.label}` : ready ? '❄️ — Cold' : '🎯 scoring…';

  return (
    <span
      title={scoreTooltip(lead)}
      style={{
        padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap',
        background: ready && lead ? `${style.color}22` : 'rgba(255,255,255,0.05)',
        color: ready && lead ? style.color : '#6b7280',
        border: `1px solid ${ready && lead ? `${style.color}55` : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {label}
    </span>
  );
}