import AIAgentPipelineField from '@/components/fronter/aiagent/AIAgentPipelineField';
import useAIAgentPipeline from '@/hooks/useAIAgentPipeline';

export default function AIAgentVoiceSection({ config, update }) {
  const { data, error } = useAIAgentPipeline();
  const catalog = data?.catalog;
  const change = (field, value) => {
    update(field, value);
    if (field === 'ttsEngine') update('ttsVoiceModel', catalog?.voices[value]?.[0]?.value || '');
  };
  return <div className="dark grid grid-cols-1 gap-4 text-foreground sm:grid-cols-2">
    {error && <p role="alert" className="text-destructive sm:col-span-2">Could not load the supported model catalog. Refresh the cross-check.</p>}
    <AIAgentPipelineField label="STT Engine" field="sttEngine" value={config.sttEngine} options={catalog?.stt} update={change} />
    <AIAgentPipelineField label="TTS Engine" field="ttsEngine" value={config.ttsEngine} options={catalog?.tts} update={change} />
    <AIAgentPipelineField label="LLM Model" field="llmModel" value={config.llmModel} options={catalog?.llm} update={change} />
    {config.ttsEngine === 'elevenlabs' && <AIAgentPipelineField label="TTS Synthesis Model" field="ttsSynthesisModel" value={config.ttsSynthesisModel || 'eleven_turbo_v2_5'} options={catalog?.synthesis} update={change} />}
    <AIAgentPipelineField label="Voice Presets" field="ttsVoiceModel" value={config.ttsVoiceModel} options={catalog?.voices[config.ttsEngine]} update={change} />
    <label className="block min-w-0 text-xs text-muted-foreground">Exact Voice ID (custom voices supported)
      <input aria-label="Exact Voice ID" className="mt-1 w-full rounded border border-input bg-background p-2 text-sm text-foreground" value={config.ttsVoiceModel || ''} onChange={event => update('ttsVoiceModel', event.target.value.trim())} />
    </label>
    <p className="text-xs text-muted-foreground sm:col-span-2">Save Configuration applies these choices to the next call. Active calls retain their starting selections. Catalog support is not proof of account access; the cross-check shows actual provider acceptance or failure. Explicit LLM selections can use more integration credits.</p>
  </div>;
}