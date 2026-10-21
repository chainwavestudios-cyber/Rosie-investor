import { useState } from 'react';
import CalendarAppointmentPanel from '@/components/assistant/calendar/CalendarAppointmentPanel';
import CalendarRebookPanel from '@/components/assistant/calendar/CalendarRebookPanel';
import CalendarScriptPanel from '@/components/assistant/calendar/CalendarScriptPanel';
import CalendarScriptTabPanel from '@/components/assistant/calendar/CalendarScriptTabPanel';
import CalendarEmailPanel from '@/components/assistant/calendar/CalendarEmailPanel';
import CalendarFollowUpNotes from '@/components/assistant/calendar/CalendarFollowUpNotes';
import CalendarHistoryPanel from '@/components/assistant/calendar/CalendarHistoryPanel';
import CalendarHoldAudio from '@/components/assistant/calendar/CalendarHoldAudio';
import FronterMergePopup from '@/components/fronter/FronterMergePopup';
import { TRANSFER_SCRIPT } from '@/components/assistant/calendar/calendarScripts';
import useSuperAdminConfig, { contactCardValues, DEFAULT_CONTACT_CARD, assistantScriptTabs } from '@/hooks/useSuperAdminConfig';

const BASE_TABS = [['appointment', 'Appointment & Follow-up'], ['rebook', 'Rebook Appointment'], ['reminder', '1-Hour Call Script'], ['calltrans', 'Call & Transfer'], ['emails', 'Credentials & Welcome'], ['notes', 'Calendar Notes'], ['history', 'Client History']];

export default function CalendarCardWorkspace({ lead, username, call, onSave }) {
  const [tab, setTab] = useState('appointment'), [mergeOpen, setMergeOpen] = useState(false), [outcome, setOutcome] = useState('');
  // Contact-card master values, pushed live by the super admin command center.
  const { config } = useSuperAdminConfig();
  const master = contactCardValues(config);
  const mergeNumbers = [master.transferPhoneNumber, master.transferPhoneNumber2];
  const mergeLabels = [master.transferLabel, master.transferLabel2];
  const mergeScript = master.mergeScript && master.mergeScript !== DEFAULT_CONTACT_CARD.mergeScript ? master.mergeScript : TRANSFER_SCRIPT;
  // Extra script tabs the super admin added in the contact card editor.
  const extraTabs = assistantScriptTabs(config);
  const tabs = [...BASE_TABS, ...extraTabs.map((extra) => [extra.id, extra.label])];
  // If the super admin removes the tab the assistant is on, fall back to the first tab.
  const active = tabs.some(([id]) => id === tab) ? tab : 'appointment';
  const customTab = extraTabs.find((extra) => extra.id === active);
  const width = Math.min(560, window.innerWidth - 20), height = Math.min(700, window.innerHeight - 24);
  return <>
    <nav aria-label="Calendar contact card sections" className="flex shrink-0 flex-wrap border-b border-assistant-border bg-assistant-surface px-3 sm:px-5">
      {tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} aria-current={active === id ? 'page' : undefined} className={active === id ? 'border-b-2 border-assistant-primary px-3 py-3 text-sm font-semibold text-assistant-primary' : 'border-b-2 border-transparent px-3 py-3 text-sm font-medium text-assistant-muted'}>{label}</button>)}
    </nav>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" data-calendar-content>
      {active === 'appointment' && <CalendarAppointmentPanel lead={lead} onSave={onSave} onTab={setTab} />}
      {active === 'rebook' && <CalendarRebookPanel lead={lead} call={call} onSave={onSave} />}
      {active === 'reminder' && <CalendarScriptPanel lead={lead} reminder call={call} onEmails={() => setTab('emails')} />}
      {active === 'calltrans' && <><CalendarScriptPanel lead={lead} call={call} onMerge={() => { setOutcome(''); setMergeOpen(true); }} outcome={outcome} /><CalendarHoldAudio /></>}
      {active === 'emails' && <CalendarEmailPanel lead={lead} />}
      {active === 'notes' && <CalendarFollowUpNotes lead={lead} username={username} />}
      {active === 'history' && <CalendarHistoryPanel lead={lead} />}
      {customTab && <CalendarScriptTabPanel tab={customTab} lead={lead} call={call} username={username} onSave={onSave} onMerge={() => { setOutcome(''); setMergeOpen(true); }} />}
    </div>
    {mergeOpen && <FronterMergePopup lead={lead} username={username} fronterFirstName="Michie" isAdmin={false} callActive={call.status === 'connected'} callDuration={call.seconds} callSid={call.callSid} lineKey={call.lineKey} transferScript={mergeScript} mergeNumbers={mergeNumbers} mergeLabels={mergeLabels} onClose={() => setMergeOpen(false)} onMerge={() => { setOutcome('Transfer complete. Client connected with Chris.'); setMergeOpen(false); }} onNoConnect={() => { setOutcome('Client left in the queue on hold.'); setMergeOpen(false); }} popupProps={{ zIndex: 35000, initialPos: { x: Math.max(10, (window.innerWidth - width) / 2), y: 12 }, initialSize: { w: width, h: height }, minW: Math.min(380, width), minH: Math.min(480, height) }} />}
  </>;
}