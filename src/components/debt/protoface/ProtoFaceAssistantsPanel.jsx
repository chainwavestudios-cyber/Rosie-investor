/**
 * Who the visitor talks to: the faces they pick between, the avatar behind each one,
 * the voice each speaks with, and the line each opens with. The live switches save
 * the moment they are flipped; the fields save with the button.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ProtoFaceField from './ProtoFaceField';
import ProtoFaceToggle from './ProtoFaceToggle';

function parseList(json) {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const BLANK = { key: '', name: '', avatarId: '', voiceId: '', blurb: '', firstMessage: '' };

export default function ProtoFaceAssistantsPanel({ config, save }) {
  const [rows, setRows] = useState(() => parseList(config.assistantsJson));
  const [agentName, setAgentName] = useState(config.agentName || '');
  const [fallbackAvatar, setFallbackAvatar] = useState(config.protofaceAvatarId || '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const patchRow = (index, field, value) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const commit = async () => {
    setBusy(true);
    setNote('');
    try {
      await save({ assistantsJson: JSON.stringify(rows), agentName, protofaceAvatarId: fallbackAvatar });
      setNote('Saved. The next call opens with this.');
    } catch (err) {
      setNote(err?.message || 'That did not save.');
    } finally {
      setBusy(false);
    }
  };

  const flip = async (field, value) => {
    setNote('');
    try {
      await save({ [field]: value });
    } catch (err) {
      setNote(err?.message || 'That did not save.');
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-emerald-300">Widget</h3>
        <ProtoFaceToggle
          checked={config.isActive === true}
          onChange={(on) => flip('isActive', on)}
          label="Widget live"
          hint="Off hides the video qualification from every invitation link and the qualification page."
        />
        <ProtoFaceToggle
          checked={config.agentDrivenMode === true}
          onChange={(on) => flip('agentDrivenMode', on)}
          label="Our own agent drives the avatar"
          hint="On = every word comes from our script and knowledge base, spoken in our voice. Off = the Protoface embed answers instead."
        />
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-emerald-300">Assistants a visitor can pick</h3>
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { ...BLANK }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" /> Add assistant
          </button>
        </div>

        <p className="text-[11px] leading-snug text-[#6b7a99]">
          The key is what an invitation link asks for (?assistant=rosie). Leave a voice empty to use the default voice
          in the script tab. An assistant with no opening line uses the fallback line there.
        </p>

        {rows.map((row, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-white/10 bg-[#0b1220]/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">{row.name || `Assistant ${index + 1}`}</span>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ProtoFaceField label="Name (shown to the visitor)" value={row.name} onChange={(v) => patchRow(index, 'name', v)} />
              <ProtoFaceField label="Key (invitation links)" value={row.key} onChange={(v) => patchRow(index, 'key', v)} placeholder="rosie" />
              <ProtoFaceField label="Face — Protoface avatar id" value={row.avatarId} onChange={(v) => patchRow(index, 'avatarId', v)} placeholder="av_..." />
              <ProtoFaceField label="Voice — ElevenLabs id (empty = default)" value={row.voiceId} onChange={(v) => patchRow(index, 'voiceId', v)} />
            </div>
            <ProtoFaceField label="One-line description" value={row.blurb} onChange={(v) => patchRow(index, 'blurb', v)} />
            <ProtoFaceField
              label="Opening line ({{name}} and {{state}} are filled in)"
              value={row.firstMessage}
              onChange={(v) => patchRow(index, 'firstMessage', v)}
              rows={3}
            />
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-emerald-300">Single-avatar fallback</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <ProtoFaceField label="Fallback agent name" value={agentName} onChange={setAgentName} />
          <ProtoFaceField label="Fallback face — avatar id" value={fallbackAvatar} onChange={setFallbackAvatar} placeholder="av_..." />
        </div>
        <p className="text-[11px] leading-snug text-[#6b7a99]">
          Used only when the assistant list above is empty.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={commit}
          disabled={busy}
          className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-[#04150f] disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save assistants'}
        </button>
        {note && <span className="text-xs text-[#8a9ab8]">{note}</span>}
      </div>
    </div>
  );
}