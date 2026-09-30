/**
 * useHotCallTracker.js — Turbo intent-engine hot-call detection that runs
 * during a live call. Monitors every ~25s; once a call is clearly NOT hot it
 * stops spending AI credits. When a hot call is established it writes a
 * HotCallAlert (and escalates to critical if the agent underperforms), which
 * the Manager Portal surfaces as a popup.
 *
 * Enabled per the HotCallSettings entity (manager-controlled, all dialers or
 * specific usernames).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const CHECK_INTERVAL = 25000;
const MIN_LINES = 4;

export function useHotCallTracker({ isActive, lead, transcript, callMode, coachUser }) {
  const [hotStatus, setHotStatus] = useState('off'); // off | monitoring | hot | cold | critical
  const [hotScore, setHotScore] = useState(null);
  const [agentScore, setAgentScore] = useState(null);
  const [enabled, setEnabled] = useState(false);

  const transcriptRef = useRef(transcript);
  const leadRef = useRef(lead);
  const callModeRef = useRef(callMode);
  const statusRef = useRef('off');
  const alertIdRef = useRef(null);
  const consecutiveColdRef = useRef(0);
  const stoppedRef = useRef(false);
  const callStartRef = useRef(null);
  const enabledRef = useRef(false);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { leadRef.current = lead; }, [lead]);
  useEffect(() => { callModeRef.current = callMode; }, [callMode]);
  useEffect(() => { statusRef.current = hotStatus; }, [hotStatus]);

  // Load settings (once) — determine if hot call AI is on for this dialer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await base44.entities.HotCallSettings.list('-created_date', 10);
        const s = (rows || [])[0];
        if (!s || !s.enabled) { enabledRef.current = false; setEnabled(false); return; }
        if (s.applyToAll) { enabledRef.current = true; setEnabled(true); return; }
        let names = [];
        try { names = JSON.parse(s.enabledUsernamesJson || '[]'); } catch {}
        const on = names.includes(coachUser?.username);
        enabledRef.current = on;
        setEnabled(on);
      } catch {
        enabledRef.current = false;
        setEnabled(false);
      }
    })();
    return () => { cancelled = true; };
  }, [coachUser?.username]);

  // Reset on call start / resolve on call end
  useEffect(() => {
    if (isActive) {
      setHotStatus('monitoring');
      setHotScore(null);
      setAgentScore(null);
      consecutiveColdRef.current = 0;
      stoppedRef.current = false;
      callStartRef.current = Date.now();
      alertIdRef.current = null;
    } else {
      // Call ended — resolve any open alert
      if (alertIdRef.current) {
        base44.entities.HotCallAlert.update(alertIdRef.current, {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      setHotStatus('off');
    }
  }, [isActive]);

  const runCheck = useCallback(async () => {
    if (!enabledRef.current || !isActive || stoppedRef.current) return;
    const t = transcriptRef.current;
    if (!t || t.length < MIN_LINES) return;
    const dur = callStartRef.current ? Math.round((Date.now() - callStartRef.current) / 1000) : 0;
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        transcript: t.slice(-24),
        mode: 'hot_call_check',
        callDurationSeconds: dur,
        priorStatus: statusRef.current === 'off' ? 'unknown' : statusRef.current,
      });
      const hot = res?.hot || res?.data?.hot;
      if (!hot) return;
      setHotScore(hot.hotScore);
      if (hot.agentPerformance) setAgentScore(hot.agentPerformance.score);

      const l = leadRef.current;
      const leadName = `${l?.firstName || ''} ${l?.lastName || ''}`.trim();

      if (hot.isHot) {
        consecutiveColdRef.current = 0;
        const critical = !!hot.critical;
        const newStatus = critical ? 'critical' : 'hot';
        setHotStatus(newStatus);
        const issues = hot.agentPerformance?.issues || [];
        const payload = {
          status: newStatus,
          hotScore: hot.hotScore,
          hotReason: hot.hotReason || '',
          agentScore: hot.agentPerformance?.score ?? null,
          agentIssuesJson: JSON.stringify(issues),
          agentSummary: hot.agentPerformance?.summary || '',
          criticalAlert: critical,
          leadId: l?.id || '',
          leadName,
          callMode: callModeRef.current || 'open',
        };
        if (!alertIdRef.current) {
          const created = await base44.entities.HotCallAlert.create({
            dialerUsername: coachUser?.username,
            sessionId: '',
            ...payload,
          });
          if (created?.id) alertIdRef.current = created.id;
        } else {
          await base44.entities.HotCallAlert.update(alertIdRef.current, payload);
        }
      } else if (hot.stopMonitoring) {
        stoppedRef.current = true;
        setHotStatus('cold');
        if (alertIdRef.current) {
          base44.entities.HotCallAlert.update(alertIdRef.current, {
            status: 'cold',
            hotScore: hot.hotScore,
            hotReason: hot.hotReason || '',
          }).catch(() => {});
        }
      } else {
        consecutiveColdRef.current += 1;
        if (consecutiveColdRef.current >= 2 && dur > 45) {
          stoppedRef.current = true;
          setHotStatus('cold');
        }
      }
    } catch {}
  }, [isActive, coachUser?.username]);

  // Run the check on an interval while the call is live
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(runCheck, CHECK_INTERVAL);
    return () => clearInterval(iv);
  }, [isActive, runCheck]);

  return { enabled, hotStatus, hotScore, agentScore };
}