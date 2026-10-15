export default function AIAgentRuntimeCall({ call, expected, historical = false }) {
  const rows = [
    ['LLM request', expected?.llmRequestModel, call.llm?.model, call.llm],
    ['STT model', expected?.sttModel, call.stt?.model, call.stt],
    ['TTS provider', expected?.ttsEngine, call.tts?.engine, call.tts],
    ['TTS model', expected?.ttsSynthesisModel, call.tts?.model, call.tts],
    ['TTS voice', expected?.ttsVoiceModel, call.tts?.voice, call.tts],
  ];
  return <div className="mt-3 rounded border border-border p-3 text-xs" data-testid="runtime-call">
    <p className="mb-2 break-all font-semibold">{historical ? 'Last completed call (historical)' : 'Active call'} · {call.callSid} · {call.state}</p>
    {call.error && <p className="mb-2 text-destructive">{call.error}</p>}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{rows.map(([label, target, actual, evidence]) => <div key={label} className="min-w-0 rounded bg-muted p-2">
      <p className="font-semibold">{label}: {evidence?.state === 'error' ? 'Failed' : evidence?.state !== 'accepted' ? 'Not yet confirmed' : target === actual ? 'Matches saved' : 'MISMATCH / fallback'}</p>
      <p className="break-all">Saved: {target || 'Not set'}</p><p className="break-all">Observed request: {actual || 'None'}</p>
      <p className="text-muted-foreground">{evidence?.state || 'Waiting for evidence'}{evidence?.ms != null ? ` · ${evidence.ms}ms` : ''}{evidence?.at ? ` · ${new Date(evidence.at).toLocaleTimeString()}` : ''}</p>
      {evidence?.providerModel && <p className="break-all">Provider reports: {evidence.providerModel}</p>}
      {evidence?.fallback && <p className="text-destructive">Fallback: {evidence.fallback}</p>}
      {evidence?.error && <p className="text-destructive">{evidence.error}</p>}
    </div>)}</div>
    <p className="mt-2 text-muted-foreground">LLM evidence confirms the accepted request ID, not the provider’s internal model; that identity is not exposed. STT/TTS evidence comes from provider responses.</p>
  </div>;
}