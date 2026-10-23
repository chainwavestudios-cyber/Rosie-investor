/**
 * One knowledge-base entry, edited in place. Saving rewrites the primary answer and the
 * answer list together, so the search always reads the wording that is on screen.
 */
import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import ProtoFaceField from './ProtoFaceField';

export default function ProtoFaceKbEntryRow({ entry, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    question: entry.question || '',
    answer: entry.answer || '',
    variations: entry.variations || '',
  });

  const save = async () => {
    const question = form.question.trim();
    const answer = form.answer.trim();
    if (!question || !answer) {
      setError('A question and an answer are both needed.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(entry.id, {
        question,
        answer,
        answersJson: JSON.stringify([answer]),
        variations: form.variations.trim(),
      });
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'That did not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#0b1220]/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{entry.question}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-snug text-[#8a9ab8]">{entry.answer}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className="text-[#8a9ab8] hover:text-slate-200" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="text-rose-300/80 hover:text-rose-200"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-emerald-400/30 bg-[#0b1220]/80 p-3">
      <ProtoFaceField label="Question" value={form.question} onChange={(v) => setForm((c) => ({ ...c, question: v }))} />
      <ProtoFaceField label="Answer" value={form.answer} onChange={(v) => setForm((c) => ({ ...c, answer: v }))} rows={3} />
      <ProtoFaceField
        label="Other ways they might ask it"
        value={form.variations}
        onChange={(v) => setForm((c) => ({ ...c, variations: v }))}
        hint="Optional. Helps her find this answer when the words are different."
      />
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-[#04150f] disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" /> {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}