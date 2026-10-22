import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Panel from '@/components/homeadmin/Panel';

/** What the assistant says once the questions are done, and how it offers the call. */
export default function OutcomePanel({ config, onChange }) {
  return (
    <Panel
      title="Eligibility line and the call offer"
      description="The assistant says the eligibility line once, after the last answer, then offers the live call."
    >
      <div>
        <Label className="text-xs text-slate-500">Eligibility line</Label>
        <Textarea
          className="mt-1"
          rows={3}
          value={config.eligibilityLine}
          onChange={(event) => onChange({ eligibilityLine: event.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs text-slate-500">How the call is offered</Label>
        <Textarea
          className="mt-1"
          rows={3}
          value={config.callOfferText}
          onChange={(event) => onChange({ callOfferText: event.target.value })}
        />
      </div>
    </Panel>
  );
}