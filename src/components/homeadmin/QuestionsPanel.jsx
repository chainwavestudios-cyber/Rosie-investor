import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Panel from '@/components/homeadmin/Panel';

/** The answers the visitor gives — each one lands in this field on their file. */
export const FIELD_OPTIONS = [
  { key: 'name', label: 'Name (first and last)' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'state', label: 'State' },
  { key: 'debtTier', label: 'Debt range' },
  { key: 'monthlyPayment', label: 'Monthly payment' },
  { key: 'cardholderStatus', label: 'Cards / co-signer' },
  { key: 'hardship', label: 'Hardship' },
];

export const fieldLabel = (key) => FIELD_OPTIONS.find((option) => option.key === key)?.label || key;

/** Every question the assistant asks, in the order it asks them. */
export default function QuestionsPanel({ questions, onChange }) {
  const update = (index, changes) =>
    onChange(questions.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const move = (index, delta) => {
    const next = [...questions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => {
    const used = questions.map((item) => item.field);
    const free = FIELD_OPTIONS.find((option) => !used.includes(option.key)) || FIELD_OPTIONS[0];
    onChange([...questions, { field: free.key, question: '', guidance: '' }]);
  };

  return (
    <Panel
      title="Qualification questions"
      description="Asked one at a time, in this exact order. The assistant never asks for two things at once or jumps ahead."
      action={
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add question
        </Button>
      }
    >
      {questions.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <select
                  value={item.field}
                  onChange={(event) => update(index, { field: event.target.value })}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
                >
                  {FIELD_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                rows={2}
                value={item.question}
                placeholder="What the assistant says to ask for this answer"
                onChange={(event) => update(index, { question: event.target.value })}
              />
              <Input
                value={item.guidance}
                placeholder="Optional note for the assistant on how to handle the answer"
                onChange={(event) => update(index, { guidance: event.target.value })}
              />
            </div>
            <div className="flex flex-none flex-col gap-1">
              <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => move(index, 1)}
                disabled={index === questions.length - 1}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange(questions.filter((_, i) => i !== index))}
                disabled={questions.length === 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </Panel>
  );
}