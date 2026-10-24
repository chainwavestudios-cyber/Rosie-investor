/**
 * The script she follows and the pacing that keeps her lips and her voice together.
 * Everything here lands on the next call.
 */
import { useState } from 'react';
import ProtoFaceField from './ProtoFaceField';

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ProtoFaceScriptPanel({ config, save }) {
  const [form, setForm] = useState({
    agentVoiceId: config.agentVoiceId || '',
    firstMessage: config.firstMessage || '',
    systemPrompt: config.systemPrompt || '',
    llmModel: config.llmModel || '',
    temperature: config.temperature ?? 0.6,
    salesLine: config.salesLine || '',
    bridgeWhisper: config.bridgeWhisper || '',
    speechChunkMs: config.speechChunkMs ?? 100,
    speechGapMs: config.speechGapMs ?? 100,
    voiceDelayMs: config.voiceDelayMs ?? 1200,
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const commit = async () => {
    setBusy(true);
    setNote('');
    try {
      await save({
        ...form,
        temperature: num(form.temperature, 0.6),
        speechChunkMs: num(form.speechChunkMs, 100),
        speechGapMs: num(form.speechGapMs, 100),
        voiceDelayMs: num(form.voiceDelayMs, 1200),
      });
      setNote('Saved. Takes effect on the next call.');
    } catch (err) {
      setNote(err?.message || 'That did not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-emerald-300">Voice</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProtoFaceField
            label="Default voice — ElevenLabs id"
            value={form.agentVoiceId}
            onChange={(v) => set('agentVoiceId', v)}
            hint="Every assistant without a voice of its own speaks in this one."
          />
          <ProtoFaceField label="Model" value={form.llmModel} onChange={(v) => set('llmModel', v)} placeholder="gpt-4o" />
          <ProtoFaceField
            label="Temperature"
            value={form.temperature}
            onChange={(v) => set('temperature', v)}
            hint="Lower is steadier, higher is more conversational. 0.4 – 0.8 works well on calls."
          />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-emerald-300">Script & opening</h3>
        <ProtoFaceField
          label="Opening line (fallback for any assistant without its own)"
          value={form.firstMessage}
          onChange={(v) => set('firstMessage', v)}
          rows={3}
          hint="{{name}} and {{state}} are filled in from the lead's record."
        />
        <ProtoFaceField
          label="Full script she follows"
          value={form.systemPrompt}
          onChange={(v) => set('systemPrompt', v)}
          rows={10}
          hint="This is where the debt floor and the order of her questions live — anything written here is what she is told to do."
        />
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-emerald-300">Lip sync</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <ProtoFaceField
            label="Voice chunk (ms)"
            value={form.speechChunkMs}
            onChange={(v) => set('speechChunkMs', v)}
            hint="How much audio is handed to the avatar at a time. 100 = a tenth of a second."
          />
          <ProtoFaceField
            label="Gap between chunks (ms)"
            value={form.speechGapMs}
            onChange={(v) => set('speechGapMs', v)}
            hint="Keep it equal to the chunk length: that is true speaking speed. Smaller makes her voice run ahead of her lips."
          />
          <ProtoFaceField
            label="Voice delay (ms)"
            value={form.voiceDelayMs}
            onChange={(v) => set('voiceDelayMs', v)}
            hint="How long her voice waits before the visitor hears it — the beat the face needs to come up. Raise it if her lips lag behind her voice, lower it if her mouth moves before the visitor hears her."
          />
        </div>
        <p className="text-[11px] leading-snug text-[#6b7a99]">
          Her voice is played to the visitor here while the same audio drives the face on the avatar. These three numbers
          are what line the two up.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-emerald-300">Transfer to a specialist</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProtoFaceField label="Sales line she patches into (E.164)" value={form.salesLine} onChange={(v) => set('salesLine', v)} placeholder="+16193530919" />
          <ProtoFaceField label="What the rep hears first" value={form.bridgeWhisper} onChange={(v) => set('bridgeWhisper', v)} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={commit}
          disabled={busy}
          className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-[#04150f] disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save script'}
        </button>
        {note && <span className="text-xs text-[#8a9ab8]">{note}</span>}
      </div>
    </div>
  );
}