/**
 * AIPopulateTab — Shared tab component for both FronterContactCard and
 * ClientProfileModal. Displays the AI Populate overwrite log (field name,
 * old value, new value, timestamp) and any missing fields from the last sweep.
 * Includes a manual "Run AI Populate" button that processes ALL transcripts
 * for the customer through the AIContactFiller.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const PURPLE = '#a78bfa';

// Human-readable labels for entity fields
const FIELD_LABELS = {
  firstName: 'First Name', lastName: 'Last Name', phone: 'Phone', phone2: 'Secondary Phone',
  email: 'Email', address: 'Address', city: 'City', state: 'State', zip: 'Zip', zipCode: 'Zip Code',
  dateOfBirth: 'Date of Birth', debtAmount: 'Debt Amount', creditorCount: 'Creditor Count',
  creditors: 'Creditors', employmentStatus: 'Employment Status', annualIncome: 'Annual Income',
  monthlyIncome: 'Monthly Income', creditScore: 'Credit Score', behindOnPayments: 'Behind on Payments',
  monthsBehind: 'Months Behind', preferredCallTime: 'Best Time to Call',
  hardshipQualification: 'Hardship Qualification', hardshipWhen: 'Hardship - When',
  hardshipWhy: 'Hardship - Why', hardshipHow: 'Hardship - How', referralSource: 'Lead Source',
};

function fmtTime(iso) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function AIPopulateTab({ lead, leadType = 'debt', onUpdate }) {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try { setLog(JSON.parse(lead?.aiPopulateLogJson || '[]')); } catch { setLog([]); }
  }, [lead?.aiPopulateLogJson]);

  const reversed = [...log].reverse();

  const runManualPopulate = useCallback(async () => {
    if (!lead?.id || running) return;
    setRunning(true);
    setError(null);
    setResults(null);

    try {
      const entity = leadType === 'fronter' ? base44.entities.FronterLead : base44.entities.DebtLead;
      const transcriptEntity = leadType === 'fronter' ? base44.entities.FronterCallTranscript : base44.entities.DebtCallTranscript;

      // 1. Fetch all saved transcripts for this lead
      const savedTranscripts = await transcriptEntity.filter({ leadId: lead.id }, '-callDate', 100);

      // 2. Also include the live transcript stored on the lead record itself
      const allTranscripts = [];
      if (lead.transcriptJson) {
        try {
          const liveLines = JSON.parse(lead.transcriptJson);
          if (Array.isArray(liveLines) && liveLines.length >= 2) {
            allTranscripts.push({ label: 'Live (current)', lines: liveLines, callDate: lead.lastCallAt });
          }
        } catch {}
      }
      for (const t of (savedTranscripts || [])) {
        try {
          const lines = JSON.parse(t.transcriptJson || '[]');
          if (Array.isArray(lines) && lines.length >= 2) {
            allTranscripts.push({
              label: t.callDate ? new Date(t.callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown',
              lines,
              callDate: t.callDate,
            });
          }
        } catch {}
      }

      if (allTranscripts.length === 0) {
        setError('No transcripts found for this customer. Transcripts appear after a call is connected.');
        setRunning(false);
        return;
      }

      // 3. Fetch fresh lead data for comparison
      let currentLead = await entity.get(lead.id);
      const allNewOverwrites = [];
      let totalUpdates = 0;
      const perTranscriptResults = [];

      // 4. Process each transcript through the AIContactFiller
      for (let i = 0; i < allTranscripts.length; i++) {
        const t = allTranscripts[i];
        setProgress({ current: i + 1, total: allTranscripts.length, transcriptLabel: t.label });

        try {
          const res = await base44.functions.invoke('aiContactFiller', {
            transcript: t.lines,
            leadType,
            currentLeadData: currentLead,
          });
          const data = res?.data || res;
          const updates = data?.updates || {};
          const overwrites = data?.overwrites || [];

          // Dispatch appointment info so the Activity tab can auto-fill the calendar form
          if (data?.appointment && data.appointment.appointmentDate) {
            window.dispatchEvent(new CustomEvent('ai_populate_appointment', { detail: data.appointment }));
          }

          const updateCount = Object.keys(updates).length;
          totalUpdates += updateCount;

          const now = new Date().toISOString();
          const logEntries = (overwrites || [])
            .filter(o => o.fieldName && o.oldValue != null && o.oldValue !== '' && String(o.oldValue) !== String(o.newValue))
            .map(o => ({
              fieldName: o.fieldName,
              oldValue: String(o.oldValue),
              newValue: String(o.newValue),
              timestamp: now,
              isFinal: false,
            }));

          allNewOverwrites.push(...logEntries);

          perTranscriptResults.push({
            label: t.label,
            updates: updateCount,
            overwrites: logEntries.length,
          });

          // Apply updates to the lead so the next transcript sees the latest data
          if (updateCount > 0) {
            const updatePayload = { ...updates };
            if (logEntries.length > 0) {
              let existingLog = [];
              try { existingLog = JSON.parse(currentLead.aiPopulateLogJson || '[]'); } catch {}
              updatePayload.aiPopulateLogJson = JSON.stringify([...existingLog, ...logEntries]);
            }
            await entity.update(lead.id, updatePayload);
            currentLead = { ...currentLead, ...updates };
            if (logEntries.length > 0) {
              currentLead.aiPopulateLogJson = updatePayload.aiPopulateLogJson;
            }
          }
        } catch (e) {
          perTranscriptResults.push({ label: t.label, error: e?.message || String(e) });
        }
      }

      // 5. Refresh the log display from the updated lead
      try { setLog(JSON.parse(currentLead.aiPopulateLogJson || '[]')); } catch {}

      setResults({
        totalUpdates,
        totalOverwrites: allNewOverwrites.length,
        perTranscript: perTranscriptResults,
      });
      onUpdate?.();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [lead?.id, leadType, running, onUpdate]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ color: PURPLE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>AI Populate Log</div>
        <button
          onClick={runManualPopulate}
          disabled={running || !lead?.id}
          style={{
            background: running ? 'rgba(167,139,250,0.15)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
            color: running ? PURPLE : '#fff',
            border: '1px solid rgba(167,139,250,0.4)',
            borderRadius: '4px',
            padding: '6px 14px',
            cursor: running || !lead?.id ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            opacity: running || !lead?.id ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          {running ? 'Running...' : 'Run AI Populate Now'}
        </button>
      </div>

      <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px' }}>
        The AI Contact Filler reviews the live call transcript every 5 minutes and at call end, auto-populating fields the customer provided. When it overwrites an existing value, the change is logged here so you can catch errors.
        <br /><br />
        <span style={{ color: PURPLE, fontWeight: 'bold' }}>Manual Run:</span> Click "Run AI Populate Now" to process ALL saved transcripts for this customer. The AI will extract customer-provided info from every call and merge it into the contact card.
      </div>

      {/* Progress indicator */}
      {running && progress && (
        <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: 14, height: 14, border: '2px solid rgba(167,139,250,0.3)', borderTopColor: PURPLE, borderRadius: '50%', animation: 'ai-populate-spin 1s linear infinite' }} />
            <span style={{ color: PURPLE, fontSize: '11px', fontWeight: 'bold' }}>
              Processing transcript {progress.current} of {progress.total}
            </span>
          </div>
          <div style={{ color: '#8a9ab8', fontSize: '10px', marginLeft: '22px' }}>{progress.transcriptLabel}</div>
          <div style={{ marginTop: '8px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: PURPLE, borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Results summary */}
      {results && !running && (
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>AI Populate Complete</div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
            <div>
              <span style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold' }}>{results.totalUpdates}</span>
              <span style={{ color: '#8a9ab8', fontSize: '10px', marginLeft: '4px' }}>fields updated</span>
            </div>
            <div>
              <span style={{ color: AMBER, fontSize: '16px', fontWeight: 'bold' }}>{results.totalOverwrites}</span>
              <span style={{ color: '#8a9ab8', fontSize: '10px', marginLeft: '4px' }}>overwrites logged</span>
            </div>
          </div>
          {results.perTranscript.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Per-Transcript Breakdown</div>
              {results.perTranscript.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '11px' }}>
                  <span style={{ color: '#c4cdd8' }}>{r.label}</span>
                  {r.error ? (
                    <span style={{ color: RED, fontSize: '10px' }}>{r.error.slice(0, 40)}</span>
                  ) : (
                    <span style={{ color: r.updates > 0 ? GOLD : '#6b7280', fontSize: '10px' }}>
                      {r.updates > 0 ? `${r.updates} updates` : 'no new data'}
                      {r.overwrites > 0 && <span style={{ color: AMBER, marginLeft: '6px' }}>({r.overwrites} overwrites)</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {results.totalUpdates === 0 && results.totalOverwrites === 0 && (
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>No new information found in the transcripts. The customer may not have provided additional details, or the fields are already populated.</div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: RED, fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Error</div>
          <div style={{ color: '#c4cdd8', fontSize: '11px' }}>{error}</div>
        </div>
      )}

      {reversed.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>
          No AI populate overwrites yet. The filler will log here when it updates existing fields during a call, or run it manually above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {reversed.map((entry, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${entry.isFinal ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: PURPLE, fontSize: '11px', fontWeight: 'bold' }}>{FIELD_LABELS[entry.fieldName] || entry.fieldName}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {entry.isFinal && <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(167,139,250,0.15)', color: PURPLE, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End of Call</span>}
                  <span style={{ color: '#4a5568', fontSize: '9px' }}>{fmtTime(entry.timestamp)}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '3px', padding: '6px 8px' }}>
                  <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Old</div>
                  <div style={{ color: '#ef4444', fontSize: '11px', wordBreak: 'break-word' }}>{entry.oldValue || '(empty)'}</div>
                </div>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>{"\u2192"}</span>
                <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '3px', padding: '6px 8px' }}>
                  <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>New</div>
                  <div style={{ color: GOLD, fontSize: '11px', wordBreak: 'break-word' }}>{entry.newValue || '(empty)'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}