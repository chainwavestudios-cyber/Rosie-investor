/**
 * AutomationCenter.jsx — every automation this app runs, in plain English, and the
 * scoring rules behind the hot-lead cue with the numbers an admin can change.
 *
 * Saved rules are read by the engagement scorer itself, so a change here moves the
 * scores on the contact cards, the hot-lead cue and the follow-up email at once.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import PortalNavButtons from '@/components/shared/PortalNavButtons';
import AutomationsTab from '@/components/automation/AutomationsTab';
import ScoringRulesTab from '@/components/automation/ScoringRulesTab';
import AutomationControlTab from '@/components/automation/AutomationControlTab';
import { C, emptyStyle } from '@/components/superadmin/kit';

const TABS = [
  { key: 'controls', label: '🎛 Automations & AI rules', note: 'Every automation in one place — timed, event-driven and the AI / scoring rules — each with its own switch, its timing and when it last ran.' },
  { key: 'automations', label: '📖 What each one does', note: 'The same automations written out in plain English: what starts it, what it then does, how often.' },
  { key: 'scoring', label: '🎯 Scoring rules', note: 'What each behaviour is worth, and where the hot, engaged and warming lines sit.' },
];

const buildAutomationDraft = (state) => ({
  enabled: { ...(state?.enabled || {}) },
  intervals: { ...(state?.intervals || {}) },
});

const buildDraft = (scoring) => ({
  thresholds: { ...scoring.thresholds },
  patterns: { ...scoring.patterns },
  families: scoring.families.map((family) => ({ key: family.key, label: family.label, system: family.system, weights: { ...family.weights } })),
});

export default function AutomationCenter() {
  const { isAdmin, sessionUserId, sessionToken } = useDebtCoachAuth();
  const [overview, setOverview] = useState(null);
  const [draft, setDraft] = useState(null);
  const [automationDraft, setAutomationDraft] = useState(null);
  const [tab, setTab] = useState('controls');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await base44.functions.invoke('automationOverview', { sessionUserId, sessionToken });
      if (response.data?.error) throw new Error(response.data.error);
      setOverview(response.data);
      setDraft(buildDraft(response.data.scoring));
      setAutomationDraft(buildAutomationDraft(response.data.automationState));
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load the automations');
    }
    setLoading(false);
  }, [sessionUserId, sessionToken]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const send = async (payload) => {
    const response = await base44.functions.invoke('automationOverview', { ...payload, sessionUserId, sessionToken });
    if (response.data?.error) throw new Error(response.data.error);
    setOverview(response.data);
    setDraft(buildDraft(response.data.scoring));
    setAutomationDraft(buildAutomationDraft(response.data.automationState));
  };

  const commit = async (payload, message) => {
    setSaving(true);
    setNote('');
    try {
      await send(payload);
      setNote(message || 'Saved — every score in the app now uses these numbers.');
    } catch (err) {
      setNote(err?.response?.data?.error || err?.message || 'Could not save the rules');
    }
    setSaving(false);
  };

  const save = () => draft && commit({
    action: 'save',
    thresholds: draft.thresholds,
    patterns: draft.patterns,
    families: draft.families.map((family) => ({ ...family.weights, key: family.key })),
  });

  const restore = async () => {
    const defaults = overview?.scoring?.defaults;
    if (!defaults) return;
    await commit({
      action: 'save',
      thresholds: { ...defaults.thresholds },
      patterns: { ...defaults.patterns },
      families: defaults.families.map((family) => ({ ...family.weights, key: family.key })),
    });
  };

  const saveAutomations = () => automationDraft && commit({
    action: 'saveAutomations',
    enabled: automationDraft.enabled,
    intervals: automationDraft.intervals,
  }, 'Saved — every automation now runs exactly as switched above.');

  const restoreAutomations = () => commit(
    { action: 'saveAutomations', enabled: {}, intervals: {} },
    'Back to the app’s own settings — every automation on, no throttle.',
  );

  const active = TABS.find((entry) => entry.key === tab) || TABS[0];

  return (
    <div style={{ fontFamily: 'Georgia, serif', background: C.bg, color: C.ink, minHeight: '100vh', padding: '4px 0 40px' }}>
      <div style={{ color: C.fronter, fontSize: '17px', fontWeight: 'bold' }}>⚙️ Automations &amp; Scoring</div>
      <div style={{ color: C.muted, fontSize: '11px' }}>
        Every rule that runs on its own, and the numbers that decide which leads go hot.
      </div>

      <PortalNavButtons current="automations" isAdmin={isAdmin} />

      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {TABS.map((entry) => {
          const on = entry.key === tab;
          return (
            <button key={entry.key} onClick={() => setTab(entry.key)} style={{
              background: on ? `${C.coach}1f` : 'rgba(255,255,255,0.04)',
              color: on ? C.coach : C.muted,
              border: `1px solid ${on ? `${C.coach}66` : C.border}`,
              borderLeft: `3px solid ${C.coach}`,
              borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
            }}>{entry.label}</button>
          );
        })}
      </div>

      <div style={{ color: C.muted, fontSize: '11px', marginBottom: '12px' }}>{active.note}</div>

      {loading && <div style={emptyStyle}>Loading every automation…</div>}
      {!loading && error && <div style={{ color: C.danger, fontSize: '12px' }}>{error}</div>}

      {!loading && overview && automationDraft && tab === 'controls' && (
        <AutomationControlTab
          overview={overview}
          draft={automationDraft}
          onToggle={(key, next) => setAutomationDraft((prev) => ({ ...prev, enabled: { ...prev.enabled, [key]: next } }))}
          onInterval={(key, value) => setAutomationDraft((prev) => ({ ...prev, intervals: { ...prev.intervals, [key]: value } }))}
          onSave={saveAutomations}
          onRestore={restoreAutomations}
          saving={saving}
          note={note}
        />
      )}

      {!loading && overview && draft && tab === 'automations' && (
        <AutomationsTab
          overview={overview}
          draft={draft}
          onDraft={(patch) => setDraft((prev) => ({ ...prev, thresholds: { ...prev.thresholds, ...patch } }))}
          onSave={save}
          onRestore={restore}
          saving={saving}
          note={note}
        />
      )}

      {!loading && overview && draft && tab === 'scoring' && (
        <ScoringRulesTab
          draft={draft}
          defaults={overview.scoring.defaults}
          updatedBy={overview.scoring.updatedBy}
          updatedAt={overview.scoring.updatedAt}
          onSave={{ save, merge: (patch) => setDraft((prev) => ({ ...prev, ...patch })) }}
          onRestore={restore}
          saving={saving}
          note={note}
        />
      )}
    </div>
  );
}