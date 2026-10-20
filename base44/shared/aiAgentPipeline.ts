// One catalog and resolver for the settings UI, validation, and call relay.
export const PIPELINE_VERSION = 'selector-runtime-v1';
const option = (value, label, model = value) => ({ value, label, model });
export const pipelineCatalog = {
  llm: [
    option('automatic', 'Automatic (provider model not disclosed)'),
    option('gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite (fastest, lowest cost)'),
    option('gemini-2.5-flash', 'Gemini 2.5 Flash (fast, low cost)'),
    option('gemini_3_flash', 'Gemini 3 Flash (fast, low cost)'),
    ...['gemini_3_8_flash', 'gpt_6_luna', 'claude-sonnet-5', 'claude_opus_5_5', 'gpt_6_sol', 'gpt_6_astra', 'claude_fable_5_1', 'glm_5_2'].map(id => option(id, id)),
  ],
  stt: [option('deepgram-nova-2', 'Deepgram Nova-2', 'nova-2'), option('deepgram-nova-3', 'Deepgram Nova-3', 'nova-3'), option('flux', 'Deepgram Flux (v2 — conversational turn-taking)', 'flux-general-en')],
  tts: [option('elevenlabs', 'ElevenLabs'), option('deepgram-aura', 'Deepgram Aura-2'), option('flux', 'Deepgram Flux (v2 — streaming-first)')],
  synthesis: [option('eleven_v3', 'ElevenLabs v3 (highest quality)'), option('eleven_multilingual_v2', 'ElevenLabs Multilingual v2 (high quality)'), option('eleven_turbo_v2_5', 'ElevenLabs Turbo v2.5'), option('eleven_flash_v2_5', 'ElevenLabs Flash v2.5 (fastest)')],
  voices: {
    'deepgram-aura': ['thalia', 'asteria', 'arcas', 'orpheus'].map(name => option(`aura-2-${name}-en`, name)),
    flux: [
      option('flux-alexis-en', 'Alexis (professional, calm)'),
      option('flux-sienna-en', 'Sienna (warm, professional)'),
      option('flux-haley-en', 'Haley (caring, empathetic)'),
      option('flux-cliff-en', 'Cliff (deep, confident)'),
      option('flux-hannah-en', 'Hannah (clear, confident)'),
      option('flux-kit-en', 'Kit (friendly, energetic)'),
      option('flux-brooke-en', 'Brooke (fast, confident)'),
      option('flux-miles-en', 'Miles (calm, sincere)'),
    ],
    elevenlabs: [],
  },
};
const legacyLlmAliases = { 'gemini-3-flash': 'gemini_3_flash', 'gpt-5-mini': 'gpt_5_mini', 'claude-opus-5': 'claude_opus_5', 'claude-sonnet-4-6': 'claude_sonnet_4_6', 'gpt-5-4': 'gpt_5_4', 'gemini-3-1-pro': 'gemini_3_1_pro' };
// Catalog models that InvokeLLM doesn't directly accept — map to the closest supported model.
// Without this, every LLM call fails and the agent loops "I'm sorry, could you repeat that?"
const catalogLlmAliases = { 'gemini-2.5-flash-lite': 'gemini_3_flash', 'gemini-2.5-flash': 'gemini_3_flash', 'gemini_3_8_flash': 'gemini_3_flash', 'gpt_6_luna': 'gpt_5_6_luna', 'claude_opus_5_5': 'claude_opus_5', 'gpt_6_sol': 'gpt_5_6_sol', 'gpt_6_astra': 'gpt_5_4', 'claude_fable_5_1': 'claude-sonnet-5', 'glm_5_2': 'automatic' };
export function resolvePipeline(config = {}) {
  const errors = [];
  const warnings = [];
  const resolve = (key, value) => {
    const item = pipelineCatalog[key].find(item => item.value === value);
    if (!item) errors.push(`Unsupported ${key} selection: ${value || '(empty)'}`);
    return item?.model || null;
  };
  const llmModel = config.llmModel || 'automatic';
  const sttEngine = config.sttEngine || 'deepgram-nova-2';
  const ttsEngine = config.ttsEngine || 'deepgram-aura';
  const ttsVoiceModel = config.ttsVoiceModel || '';
  const ttsSynthesisModel = config.ttsSynthesisModel || 'eleven_flash_v2_5';
  // Separate voice IDs per provider (with ttsVoiceModel fallback for backward compat)
  const elevenLabsVoiceId = config.elevenLabsVoiceId || (ttsEngine === 'elevenlabs' ? ttsVoiceModel : '');
  const deepgramTtsVoice = config.deepgramTtsVoice || (ttsEngine === 'deepgram-aura' ? ttsVoiceModel : '');
  // Preserve an existing legacy selection without advertising old IDs as new choices.
  const llmRequestModel = legacyLlmAliases[llmModel] || catalogLlmAliases[llmModel] || resolve('llm', llmModel);
  if (legacyLlmAliases[llmModel]) warnings.push(`Saved legacy LLM alias: ${llmModel} → ${llmRequestModel}. Choose a current catalog model when changing it; actual acceptance is verified only on a call.`);
  const sttModel = resolve('stt', sttEngine);
  resolve('tts', ttsEngine);
  // Flux voices share the deepgramTtsVoice field; resolve by engine
  const fluxVoiceId = ttsEngine === 'flux' ? (deepgramTtsVoice || ttsVoiceModel || '') : '';
  const activeVoiceId = ttsEngine === 'elevenlabs' ? elevenLabsVoiceId : ttsEngine === 'flux' ? fluxVoiceId : deepgramTtsVoice;
  if (!activeVoiceId) { errors.push('Select a voice belonging to the selected TTS provider.'); }
  else if (ttsEngine === 'deepgram-aura' && !/^aura-2-[a-z]+-(en|es|de|fr|nl|it|ja)$/.test(activeVoiceId)) { errors.push('Select an Aura-2 voice (e.g. aura-2-thalia-en).'); }
  else if (ttsEngine === 'flux' && !/^flux-[a-z]+-en$/.test(activeVoiceId)) { errors.push('Select a Flux voice (e.g. flux-alexis-en).'); }
  else if (ttsEngine === 'elevenlabs' && !/^[A-Za-z0-9_-]{8,100}$/.test(activeVoiceId)) { errors.push('Select a valid ElevenLabs voice ID.'); }
  if (ttsEngine === 'elevenlabs') resolve('synthesis', ttsSynthesisModel);
  return { version: PIPELINE_VERSION, llmModel, llmRequestModel, sttEngine, sttModel, ttsEngine, ttsVoiceModel, elevenLabsVoiceId, deepgramTtsVoice: ttsEngine === 'flux' ? fluxVoiceId : deepgramTtsVoice, fluxVoiceId, ttsSynthesisModel: ttsEngine === 'elevenlabs' ? ttsSynthesisModel : (ttsEngine === 'flux' ? fluxVoiceId : deepgramTtsVoice), errors, warnings, valid: errors.length === 0 };
}
export async function loadAgentConfig(client) {
  const page = await client.entities.AIAgentConfig.filter({ configName: 'default' }, { limit: 1 });
  return page.items[0] || null;
}