import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Panel from '@/components/homeadmin/Panel';

/** The widget chrome and the first message the visitor reads. */
export default function WidgetPanel({ config, onChange }) {
  return (
    <Panel title="The widget itself" description="What the visitor sees before they type anything.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-slate-500">Title</Label>
          <Input
            className="mt-1"
            value={config.widgetTitle}
            onChange={(event) => onChange({ widgetTitle: event.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500">Status line</Label>
          <Input
            className="mt-1"
            value={config.widgetStatusText}
            onChange={(event) => onChange({ widgetStatusText: event.target.value })}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-500">Opening message</Label>
        <Textarea
          className="mt-1"
          rows={2}
          value={config.openingMessage}
          onChange={(event) => onChange({ openingMessage: event.target.value })}
        />
      </div>
    </Panel>
  );
}