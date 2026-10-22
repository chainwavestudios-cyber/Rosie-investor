import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Panel from '@/components/homeadmin/Panel';

/** A list of plain rules or facts the assistant follows. */
export default function ListPanel({ title, description, items, onChange, placeholder }) {
  const update = (index, value) => onChange(items.map((item, i) => (i === index ? value : item)));

  return (
    <Panel
      title={title}
      description={description}
      action={
        <Button variant="outline" size="sm" onClick={() => onChange([...items, ''])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add line
        </Button>
      }
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <Textarea
            rows={2}
            value={item}
            placeholder={placeholder}
            onChange={(event) => update(index, event.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="mt-1"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            disabled={items.length === 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </Panel>
  );
}