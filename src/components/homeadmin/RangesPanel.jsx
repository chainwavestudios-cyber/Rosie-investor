import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Panel from '@/components/homeadmin/Panel';

/** The debt labels the assistant records, and the estimate written on the contact card. */
export default function RangesPanel({ ranges, onChange }) {
  const update = (index, changes) =>
    onChange(ranges.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  return (
    <Panel
      title="Debt ranges"
      description="The assistant records a debt amount as one of these labels. The estimate is what the contact card is written with."
      action={
        <Button variant="outline" size="sm" onClick={() => onChange([...ranges, { label: '', amount: 0 }])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add range
        </Button>
      }
    >
      {ranges.map((range, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={range.label}
            placeholder="Range shown to the visitor"
            onChange={(event) => update(index, { label: event.target.value })}
          />
          <Input
            type="number"
            className="w-28 flex-none"
            value={range.amount}
            placeholder="Estimate"
            onChange={(event) => update(index, { amount: Number(event.target.value) || 0 })}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(ranges.filter((_, i) => i !== index))}
            disabled={ranges.length === 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </Panel>
  );
}