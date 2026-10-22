import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import Panel from '@/components/homeadmin/Panel';
import { fieldLabel } from '@/components/homeadmin/QuestionsPanel';

/** Which answers must be on file before the "call me now" box appears. */
export default function GatePanel({ questions, readyFields, onChange }) {
  const toggle = (key, checked) =>
    onChange(checked ? [...readyFields, key] : readyFields.filter((field) => field !== key));

  return (
    <Panel
      title="Before the call is offered"
      description="The visitor only sees the call-me-now box once these answers are on file."
    >
      {questions.map((item, index) => (
        <label
          key={`${item.field}-${index}`}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
        >
          <Checkbox
            checked={readyFields.includes(item.field)}
            onCheckedChange={(checked) => toggle(item.field, checked === true)}
          />
          <span>{fieldLabel(item.field)}</span>
        </label>
      ))}
    </Panel>
  );
}