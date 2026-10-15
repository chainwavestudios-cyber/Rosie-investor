/**
 * useAIContactFiller — Runs the AI Contact Filler every 5 minutes during a live
 * call and on-demand at call end. Autosaves extracted fields to the lead entity
 * and appends overwrites to aiPopulateLogJson for the AI Populate tab.
 *
 * @param {object} opts
 * @param {string} opts.leadId — The lead entity ID
 * @param {string} opts.leadType — 'fronter' | 'debt'
 * @param {array}  opts.transcript — Live transcript lines (speaker/role based)
 * @param {boolean} opts.isActive — Whether the call is currently active
 * @returns {{ runFiller: (isFinal?: boolean) => Promise<void>, lastRunAt: string|null }}
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { base44 } from '@/api/base44Client';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useAIContactFiller({ leadId, leadType, transcript, isActive }) {
  const transcriptRef = useRef([]);
  const intervalRef = useRef(null);
  const runningRef = useRef(false);
  const [lastRunAt, setLastRunAt] = useState(null);

  useEffect(() => { transcriptRef.current = transcript || []; }, [transcript]);

  const runFiller = useCallback(async (isFinal = false, transcriptOverride = null) => {
    if (!leadId || !leadType) return;
    if (runningRef.current) return; // Prevent overlapping runs
    const lines = transcriptOverride || transcriptRef.current;
    if (!lines || lines.length < 3) return; // Not enough transcript yet

    runningRef.current = true;
    try {
      const entity = leadType === 'fronter' ? base44.entities.FronterLead : base44.entities.DebtLead;
      // Fetch fresh lead data so we compare against the latest saved values
      const currentLead = await entity.get(leadId);
      if (!currentLead) return;

      const res = await base44.functions.invoke('aiContactFiller', {
        transcript: lines,
        leadType,
        currentLeadData: currentLead,
      });
      const data = res?.data || res;
      const updates = data?.updates || {};
      const newOverwrites = data?.overwrites || [];
      const appointment = data?.appointment || null;

      // Dispatch appointment info so the Activity tab can auto-fill the calendar form
      if (appointment && appointment.appointmentDate) {
        window.dispatchEvent(new CustomEvent('ai_populate_appointment', { detail: appointment }));
      }

      if (Object.keys(updates).length === 0) {
        setLastRunAt(new Date().toISOString());
        return;
      }

      // Build overwrite log entries for fields that had existing values replaced
      const now = new Date().toISOString();
      const logEntries = newOverwrites
        .filter(o => o.fieldName && o.oldValue != null && o.oldValue !== '' && String(o.oldValue) !== String(o.newValue))
        .map(o => ({
          fieldName: o.fieldName,
          oldValue: String(o.oldValue),
          newValue: String(o.newValue),
          timestamp: now,
          isFinal: !!isFinal,
        }));

      // Append to existing AI populate log
      let existingLog = [];
      try { existingLog = JSON.parse(currentLead.aiPopulateLogJson || '[]'); } catch {}
      const updatedLog = [...existingLog, ...logEntries];

      // Autosave: update entity with extracted values + log
      const updatePayload = { ...updates };
      if (logEntries.length > 0) {
        updatePayload.aiPopulateLogJson = JSON.stringify(updatedLog);
      }
      await entity.update(leadId, updatePayload);

      setLastRunAt(now);
    } catch (e) {
      console.error('AIContactFiller failed:', e?.message || String(e));
    } finally {
      runningRef.current = false;
    }
  }, [leadId, leadType]);

  // Run every 5 minutes while the call is active
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    // Start the 5-minute interval
    intervalRef.current = setInterval(() => {
      runFiller(false);
    }, FIVE_MINUTES);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [isActive, runFiller]);

  return { runFiller, lastRunAt };
}