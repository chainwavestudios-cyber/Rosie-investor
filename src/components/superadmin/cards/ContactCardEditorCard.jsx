/**
 * ContactCardEditorCard.jsx — Debt Call Coach system: the super admin's editable
 * master of the calendar contact card. Every save writes the shared SuperAdminConfig
 * record, which the assistant portal subscribes to — so script wording and the
 * merge / transfer / fast-dial numbers change on the assistant's screen instantly.
 */
import { useEffect, useState } from 'react';
import useSuperAdminConfig, { contactCardValues } from '@/hooks/useSuperAdminConfig';
import { C, lbl, inputStyle, emptyStyle } from '@/components/superadmin/kit';
import AssistantTabsEditor from '@/components/superadmin/cards/AssistantTabsEditor';

const TEXT_FIELDS = [
  ['transferScript', 'Appointment transfer script', 'Spoken while the assistant adds the client to the queue.'],
  ['reminderScript', '1-hour reminder script', 'Supports {{firstname}} and {{Email}}.'],
  ['rebookScript', 'Rebook appointment script', 'Read on the Rebook Appointment tab. Supports {{firstname}}, {{Email}} and {{appointment}} — leave empty to use the built-in wording.'],
  ['mergeScript', 'Merge & transfer script', 'Shown in the Merge & Transfer popup. Supports {{first name}}.'],
  ['welcomeMessage', 'Welcome message', 'The welcome the assistant sends clients; shown on their contact card.'],
];

const PHONE_FIELDS = [
  ['transferPhoneNumber', 'Merge / transfer number 1'],
  ['transferLabel', 'Label 1'],
  ['transferPhoneNumber2', 'Merge / transfer number 2'],
  ['transferLabel2', 'Label 2'],
  ['chrisOfficePhone', 'Fast-dial · office'],
  ['chrisCellPhone', 'Fast-dial · mobile'],
];

export default function ContactCardEditorCard({ username }) {
  const { config, loading, save } = useSuperAdminConfig();
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dirty && config) setDraft(contactCardValues(config));
  }, [config, dirty]);

  const set = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setDirty(true); };

  const commit = async () => {
    setBusy(true); setError('');
    try {
      await save(draft, username);
      setDirty(false);
      setSavedAt(new Date());
    } catch (e) { setError(e?.message || 'Save failed'); }
    setBusy(false);
  };

  if (loading || !draft) return <div style={emptyStyle}>Loading the contact card master…</div>;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ color: C.muted, fontSize: '11px' }}>
          Editing the live contact card used by the assistant portal.
          {config?.updatedBy ? ` · last updated by ${config.updatedBy}` : ''}
          {config?.updatedAt ? ` ${new Date(config.updatedAt).toLocaleString()}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        {savedAt && <span style={{ color: C.fronter, fontSize: '11px' }}>✓ Saved {savedAt.toLocaleTimeString()} — pushed live</span>}
        {dirty && <span style={{ color: C.warn, fontSize: '11px' }}>Unsaved changes</span>}
        <button onClick={commit} disabled={busy || !dirty} style={{ background: dirty ? `linear-gradient(135deg,#10b981,#22c55e)` : 'rgba(255,255,255,0.06)', color: dirty ? C.bg : C.muted, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: dirty ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold' }}>
          {busy ? 'Saving…' : 'Save & push live'}
        </button>
      </div>

      {error && <div style={{ color: C.danger, fontSize: '11px', marginBottom: '10px' }}>⚠ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        {TEXT_FIELDS.map(([key, label, hint]) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            <textarea
              value={draft[key] || ''}
              onChange={(e) => set(key, e.target.value)}
              rows={key === 'welcomeMessage' ? 4 : 6}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
            <div style={{ color: C.dim, fontSize: '10px', marginTop: '3px' }}>{hint}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={lbl}>Welcome message link</label>
        <input
          value={draft.welcomeMessageUrl || ''}
          onChange={(e) => set('welcomeMessageUrl', e.target.value)}
          placeholder="https://… the video or audio the credentials email links to"
          style={inputStyle}
        />
        <div style={{ color: C.dim, fontSize: '10px', marginTop: '3px' }}>
          Used by the credentials email the fronters send. Clicks on it are tracked with the BBB, Trustpilot and website links.
        </div>
      </div>

      <div style={{ paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Numbers the assistant and fronters dial</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
          {PHONE_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label style={lbl}>{label}</label>
              <input value={draft[key] || ''} onChange={(e) => set(key, e.target.value)} style={inputStyle} />
            </div>
          ))}
        </div>
      </div>

      <AssistantTabsEditor value={draft.assistantScriptTabsJson || '[]'} onChange={(value) => set('assistantScriptTabsJson', value)} />
    </div>
  );
}