import AIAgentPipelineField from '@/components/fronter/aiagent/AIAgentPipelineField';
import useAIAgentPipeline from '@/hooks/useAIAgentPipeline';
import useElevenLabsVoices from '@/hooks/useElevenLabsVoices';

export default function AIAgentVoiceSection({ config, update }) {
  const { data, error } = useAIAgentPipeline();
  const catalog = data?.catalog;
  const voicesQuery = useElevenLabsVoices();
  const elevenLabsVoices = voicesQuery.data?.voices || [];

  const change = (field, value) => {
    update(field, value);
    if (field === 'ttsEngine') update('ttsVoiceModel', '');
  };

  const selectElevenLabsVoice = (voiceId) => {
    update('elevenLabsVoiceId', voiceId);
    update('ttsVoiceModel', voiceId);
  };

  const selectDeepgramVoice = (voiceId) => {
    update('deepgramTtsVoice', voiceId);
    update('ttsVoiceModel', voiceId);
  };

  const elevenLabsValue = config.elevenLabsVoiceId || config.ttsVoiceModel || '';
  const deepgramValue = config.deepgramTtsVoice || config.ttsVoiceModel || '';

  return (
    <div className="dark grid grid-cols-1 gap-4 text-foreground sm:grid-cols-2">
      {error && <p role="alert" className="text-destructive sm:col-span-2">Could not load the supported model catalog. Refresh the cross-check.</p>}
      <AIAgentPipelineField label="STT Engine" field="sttEngine" value={config.sttEngine} options={catalog?.stt} update={change} />
      <AIAgentPipelineField label="TTS Engine" field="ttsEngine" value={config.ttsEngine} options={catalog?.tts} update={change} />
      <AIAgentPipelineField label="LLM Model" field="llmModel" value={config.llmModel} options={catalog?.llm} update={change} />
      {config.ttsEngine === 'elevenlabs' && (
        <AIAgentPipelineField label="TTS Synthesis Model" field="ttsSynthesisModel" value={config.ttsSynthesisModel || 'eleven_flash_v2_5'} options={catalog?.synthesis} update={change} />
      )}

      {config.ttsEngine === 'elevenlabs' ? (
        <>
          <label className="block min-w-0 text-xs text-muted-foreground">
            ElevenLabs Voice
            {voicesQuery.isLoading && <span className="mt-1 block text-foreground/60">Loading voices…</span>}
            {voicesQuery.error && <span className="mt-1 block text-destructive">Could not load voices. <button type="button" onClick={() => voicesQuery.refetch()} className="underline">Retry</button></span>}
            {voicesQuery.data && (
              <select aria-label="ElevenLabs Voice" className="mt-1 w-full rounded border border-input bg-background p-2 text-sm text-foreground" value={elevenLabsValue} onChange={e => selectElevenLabsVoice(e.target.value)}>
                <option value="">— Select a voice —</option>
                {elevenLabsVoices.map(v => (
                  <option key={v.voice_id} value={v.voice_id}>{v.name}{v.category ? ` (${v.category})` : ''}</option>
                ))}
              </select>
            )}
          </label>
          <label className="block min-w-0 text-xs text-muted-foreground">Exact ElevenLabs Voice ID (custom voices supported)
            <input aria-label="Exact ElevenLabs Voice ID" className="mt-1 w-full rounded border border-input bg-background p-2 text-sm text-foreground" value={elevenLabsValue} onChange={event => selectElevenLabsVoice(event.target.value.trim())} />
          </label>
        </>
      ) : (
        <>
          <AIAgentPipelineField label="Deepgram Voice Presets" field="deepgramTtsVoice" value={deepgramValue} options={catalog?.voices['deepgram-aura']} update={(_f, v) => selectDeepgramVoice(v)} />
          <label className="block min-w-0 text-xs text-muted-foreground">Exact Deepgram Voice ID
            <input aria-label="Exact Deepgram Voice ID" className="mt-1 w-full rounded border border-input bg-background p-2 text-sm text-foreground" value={deepgramValue} onChange={event => selectDeepgramVoice(event.target.value.trim())} />
          </label>
        </>
      )}

      <p className="text-xs text-muted-foreground sm:col-span-2">Voice IDs are stored separately per provider — changing one never corrupts the other. Save Configuration applies these choices to the next call. Active calls retain their starting selections. Catalog support is not proof of account access; the cross-check shows actual provider acceptance or failure.</p>
    </div>
  );
}