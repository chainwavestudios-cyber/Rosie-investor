/**
 * AI KB — the knowledge base the video assistants answer from, and the switch that moves
 * them onto a different one. Entries are the questions and answers she is allowed to use.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import ProtoFaceField from './ProtoFaceField';
import ProtoFaceToggle from './ProtoFaceToggle';
import ProtoFaceKbEntryRow from './ProtoFaceKbEntryRow';

const SHARED_KB = 'Debt Settlement';
const PROTOFACE_KB = 'ProtoFace Qualification';
const BLANK_ENTRY = { question: '', answer: '', variations: '' };
const PLACEHOLDER = '(Placeholder) Replace this with the first question and answer your assistants should use on a call.';

export default function ProtoFaceKbPanel({ config, save }) {
  const [names, setNames] = useState([]);
  const [viewKb, setViewKb] = useState(config.kbName || PROTOFACE_KB);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState({ ...BLANK_ENTRY });
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const loadNames = useCallback(async () => {
    try {
      const res = await base44.entities.KnowledgeBase.list({ distinct: 'kbName' });
      setNames((res?.items || []).filter(Boolean).sort());
    } catch {
      setNames([]);
    }
  }, []);

  const loadEntries = useCallback(async (kb) => {
    setLoading(true);
    try {
      const res = await base44.entities.KnowledgeBase.filter({ kbName: kb }, { sort: '-updated_date', limit: 200 });
      setEntries(res?.items || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNames();
  }, [loadNames]);

  useEffect(() => {
    void loadEntries(viewKb);
  }, [viewKb, loadEntries]);

  const options = [viewKb, ...names].filter(Boolean).filter((name, index, all) => all.indexOf(name) === index);

  const switchAgentTo = async (kb) => {
    if (!kb) return;
    setNote('');
    try {
      await save({ kbName: kb });
      setNote(`The assistants now answer from ${kb}.`);
    } catch (err) {
      setNote(err?.message || 'That did not save.');
    }
  };

  const createKb = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setNote('');
    try {
      await base44.entities.KnowledgeBase.create({
        question: 'What should the video assistants know?',
        answer: PLACEHOLDER,
        answersJson: JSON.stringify([PLACEHOLDER]),
        kbName: name,
        category: 'protoface',
        source: 'ProtoFace tab',
      });
      setNewName('');
      await loadNames();
      setViewKb(name);
      setNote(`${name} is ready. Add its entries below, then switch the assistants onto it.`);
    } catch (err) {
      setNote(err?.message || 'The knowledge base could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const addEntry = async () => {
    const question = draft.question.trim();
    const answer = draft.answer.trim();
    if (!question || !answer) {
      setNote('A question and an answer are both needed.');
      return;
    }
    setBusy(true);
    setNote('');
    try {
      await base44.entities.KnowledgeBase.create({
        question,
        answer,
        answersJson: JSON.stringify([answer]),
        variations: draft.variations.trim(),
        kbName: viewKb,
        category: 'protoface',
        source: 'ProtoFace tab',
      });
      setDraft({ ...BLANK_ENTRY });
      await loadEntries(viewKb);
      await loadNames();
      setNote('Entry added.');
    } catch (err) {
      setNote(err?.message || 'That entry did not save.');
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async (id, patch) => {
    await base44.entities.KnowledgeBase.update(id, patch);
    await loadEntries(viewKb);
  };

  const deleteEntry = async (id) => {
    await base44.entities.KnowledgeBase.delete(id);
    await loadEntries(viewKb);
  };

  const term = search.trim().toLowerCase();
  const visible = term
    ? entries.filter((entry) => `${entry.question || ''} ${entry.answer || ''}`.toLowerCase().includes(term))
    : entries;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-emerald-300">Knowledge base the assistants answer from</h3>
          <span className="text-[11px] text-[#8a9ab8]">Live now: {config.kbName || 'not set'}</span>
        </div>
        <ProtoFaceToggle
          checked={config.kbName === PROTOFACE_KB}
          onChange={(on) => switchAgentTo(on ? PROTOFACE_KB : SHARED_KB)}
          label={`Switch between ${SHARED_KB} and ${PROTOFACE_KB}`}
          hint="On = the assistants answer only from the ProtoFace base. Off = they answer from the shared Debt Settlement base."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#8a9ab8]">
              Or switch to any knowledge base
            </span>
            <select
              value={config.kbName || ''}
              onChange={(e) => switchAgentTo(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60"
            >
              {options.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <ProtoFaceField
            label="Create a new knowledge base"
            value={newName}
            onChange={setNewName}
            placeholder="e.g. ProtoFace Qualification"
            hint="Starts it with a placeholder entry, ready to fill in."
          />
        </div>
        {newName.trim() && (
          <button
            type="button"
            onClick={createKb}
            disabled={busy}
            className="rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-[#04150f] disabled:opacity-60"
          >
            Create {newName.trim()}
          </button>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-emerald-300">Entries</h3>
          <div className="flex items-center gap-2">
            <select
              value={viewKb}
              onChange={(e) => setViewKb(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-400/60"
            >
              {options.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadEntries(viewKb)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </button>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-white/10 bg-[#0b1220]/60 p-3">
          <ProtoFaceField label="New question" value={draft.question} onChange={(v) => setDraft((c) => ({ ...c, question: v }))} />
          <ProtoFaceField label="The answer she gives" value={draft.answer} onChange={(v) => setDraft((c) => ({ ...c, answer: v }))} rows={3} />
          <ProtoFaceField
            label="Other ways they might ask it"
            value={draft.variations}
            onChange={(v) => setDraft((c) => ({ ...c, variations: v }))}
            hint="Optional — helps her find this answer when the wording is different."
          />
          <button
            type="button"
            onClick={addEntry}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-[#04150f] disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> Add to {viewKb}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ProtoFaceField label="Search these entries" value={search} onChange={setSearch} placeholder="word or phrase" />
          <span className="pt-4 text-[11px] text-[#6b7a99]">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} in {viewKb}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          </div>
        ) : visible.length === 0 ? (
          <p className="p-4 text-center text-xs text-[#8a9ab8]">
            Nothing here yet — add the questions your assistants should be able to answer.
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((entry) => (
              <ProtoFaceKbEntryRow key={entry.id} entry={entry} onSave={saveEntry} onDelete={deleteEntry} />
            ))}
          </div>
        )}

        {note && <p className="text-xs text-[#8a9ab8]">{note}</p>}
      </section>
    </div>
  );
}