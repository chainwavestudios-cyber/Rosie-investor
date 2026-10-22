/**
 * useSuperAdminConfig.js — the shared, realtime source of truth the Super Admin
 * Command Center edits and the assistant portal reads.
 * One singleton record (configName: 'default'). Changes are pushed live to every
 * open screen through an entity subscription, so an edit made by the super admin
 * appears on the assistant's contact card without a refresh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const CONFIG_NAME = 'default';

export const DEFAULT_CONTACT_CARD = {
  transferScript: `Hello, this is Michie. I am calling in regards to your appointment in the next few minutes from the offices of Chris Bongiorno and Debt Advisors of America.

I will go ahead and add you to his call queue, and he will answer shortly…`,
  reminderScript: '{{firstname}},\n\nThis is Chris Bongiorno\'s assistant from Debt Advisors of America. I just wanted to remind you of your upcoming appointment with Chris Bongiorno in 1 hour. Did you get a chance to review the email he sent, and watch his welcome message?\n\nIf they did: Great! I\'ll be calling back in one hour to connect you with Chris.\n\nIf no: Would you like me to send that email again to you at this email address {{Email}}?',
  mergeScript: "Alright {{first name}}, I've got a senior debt advisor ready to help you through this. I'm going to connect you now — stay on the line and they'll be right with you.",
  welcomeMessage: '',
  // Where “listen to my personal welcome message” points in the credentials email.
  welcomeMessageUrl: '',
  // Empty = the built-in wording from calendarScripts.js is used instead.
  rebookScript: '',
  assistantScriptTabsJson: '[]',
  transferPhoneNumber: '+16193530919',
  transferPhoneNumber2: '+12162586934',
  transferLabel: '619-353-0919',
  transferLabel2: '216-258-6934',
  chrisOfficePhone: '+16193530919',
  chrisOfficeLabel: 'Chris · Office',
  chrisCellPhone: '+12162586934',
  chrisMobileLabel: 'Chris · Mobile',
};

export default function useSuperAdminConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const recordRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const found = await base44.entities.SuperAdminConfig.filter({ configName: CONFIG_NAME });
      const rec = Array.isArray(found) ? found[0] : found?.items?.[0];
      recordRef.current = rec || null;
      setConfig(rec || { configName: CONFIG_NAME, ...DEFAULT_CONTACT_CARD });
    } catch {
      setConfig({ configName: CONFIG_NAME, ...DEFAULT_CONTACT_CARD });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: any screen holding this hook updates the moment the super admin saves.
  useEffect(() => {
    const unsub = base44.entities.SuperAdminConfig.subscribe((event) => {
      if (event.data?.configName !== CONFIG_NAME) return;
      if (event.type === 'delete') { recordRef.current = null; setConfig({ configName: CONFIG_NAME, ...DEFAULT_CONTACT_CARD }); return; }
      recordRef.current = event.data;
      setConfig(event.data);
    });
    return unsub;
  }, []);

  const save = useCallback(async (patch, username) => {
    const payload = { ...patch, configName: CONFIG_NAME, updatedBy: username || 'super_admin', updatedAt: new Date().toISOString() };
    if (recordRef.current?.id) {
      const updated = await base44.entities.SuperAdminConfig.update(recordRef.current.id, payload);
      recordRef.current = { ...recordRef.current, ...payload };
      setConfig((prev) => ({ ...prev, ...payload }));
      return updated;
    }
    const created = await base44.entities.SuperAdminConfig.create(payload);
    recordRef.current = created;
    setConfig(created);
    return created;
  }, []);

  return { config, loading, save, reload: load };
}

/** Contact-card values with defaults applied — safe to read before the record loads. */
export const contactCardValues = (config) => ({ ...DEFAULT_CONTACT_CARD, ...(config || {}) });

/**
 * The quick-dial buttons at the top of the portal — a number plus the tag the admin
 * gave it. Read by every user; the master lives on the shared config record.
 */
export const fastDialButtons = (config) => {
  const m = contactCardValues(config);
  return [
    { key: 'office', number: m.chrisOfficePhone, label: m.chrisOfficeLabel || 'Chris · Office' },
    { key: 'mobile', number: m.chrisCellPhone, label: m.chrisMobileLabel || 'Chris · Mobile' },
  ].filter((d) => String(d.number || '').trim());
};

/** Raw editor rows (including half-typed ones) behind the extra script tabs. */
export const parseScriptTabRows = (json) => {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed.map((row) => ({
      label: row?.label || '',
      script: row?.script || '',
      bookAppointment: !!row?.bookAppointment,
      credentials: !!row?.credentials,
      followUpNote: !!row?.followUpNote,
      callClient: !!row?.callClient,
      merge: !!row?.merge,
    })) : [];
  } catch { return []; }
};

/**
 * The extra script tabs the super admin added, in order, ready for the assistant's
 * calendar contact card. Rows still being typed (no label, and neither a script nor a
 * button) are skipped, so a blank tab never reaches the assistant.
 */
export const assistantScriptTabs = (config) => parseScriptTabRows(contactCardValues(config).assistantScriptTabsJson)
  .filter((row) => String(row.label).trim() && (String(row.script).trim() || row.bookAppointment || row.credentials || row.followUpNote || row.callClient || row.merge))
  .map((row, index) => ({
    id: `custom-${index}`,
    label: String(row.label).trim(),
    script: row.script,
    bookAppointment: row.bookAppointment,
    credentials: row.credentials,
    followUpNote: row.followUpNote,
    callClient: row.callClient,
    merge: row.merge,
  }));