import useAIAgentPipeline from '@/hooks/useAIAgentPipeline';
import AIAgentRuntimeCall from '@/components/fronter/aiagent/AIAgentRuntimeCall';

export default function AIAgentLiveConfig({ config }) {
  const { data, error, isFetching, refetch } = useAIAgentPipeline();
  const fields = ['llmModel', 'sttEngine', 'ttsEngine', 'ttsVoiceModel', 'ttsSynthesisModel'];
  const defaults = { ttsSynthesisModel: 'eleven_turbo_v2_5' };
  const dirty = !!(config && data?.config && fields.some(field => (config[field] ?? defaults[field] ?? '') !== (data.config[field] ?? defaults[field] ?? '')));
  const pipeline = data?.pipeline;
  const bridge = data?.bridge;
  return <section aria-label="Agent pipeline cross-check" data-testid="pipeline-cross-check" className="dark mb-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">Agent Pipeline Cross-check</h3>
      <button type="button" onClick={() => refetch()} disabled={isFetching} className="rounded border border-input px-3 py-2 text-xs disabled:opacity-50">{isFetching ? 'Checking…' : 'Refresh cross-check'}</button>
    </div>
    {dirty && <p role="status" className="my-2 font-semibold">Unsaved selections — not used by calls yet.</p>}
    {error && <p role="alert" className="mt-2 text-destructive">Cross-check failed. Previously displayed evidence is not current. {error?.response?.data?.error || error?.message || ''}</p>}
    {!data && !error && <p className="mt-2 text-sm text-muted-foreground">Loading saved settings and querying the running bridge…</p>}
    {pipeline && <><p className="my-2 text-xs text-muted-foreground">Saved / next call (not runtime proof) · checked {new Date(data.checkedAt).toLocaleTimeString()}</p>
      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div className="min-w-0 rounded bg-muted p-3"><dt className="font-semibold">LLM</dt><dd className="break-all">{pipeline.llmModel} → {pipeline.llmRequestModel || 'Unsupported'}</dd></div>
        <div className="min-w-0 rounded bg-muted p-3"><dt className="font-semibold">STT</dt><dd>{pipeline.sttEngine} → {pipeline.sttModel || 'Unsupported'}</dd></div>
        <div className="min-w-0 rounded bg-muted p-3"><dt className="font-semibold">TTS / voice</dt><dd className="break-all">{pipeline.ttsEngine} · {pipeline.ttsSynthesisModel} · {pipeline.ttsEngine === 'elevenlabs' ? (pipeline.elevenLabsVoiceId || 'No voice selected') : (pipeline.deepgramTtsVoice || 'No voice selected')}</dd></div>
      </dl>{pipeline.errors.map(message => <p key={message} className="mt-2 text-xs text-destructive">{message}</p>)}
      {pipeline.warnings?.map(message => <p key={message} className="mt-2 text-xs text-muted-foreground">{message}</p>)}</>}
    {bridge && <p role="status" className="mt-3 text-sm">{bridge.state === 'connected' ? `Bridge connected · ${bridge.version}` : `NOT VERIFIED: ${bridge.message}`}</p>}
    {bridge?.state === 'connected' && <><p className="mt-1 text-xs text-muted-foreground">{bridge.credentials?.deepgram ? 'Deepgram key present' : 'Deepgram key missing'} · {bridge.credentials?.elevenlabs ? 'ElevenLabs key present' : 'ElevenLabs key missing'} (presence does not verify account access)</p>
      {!bridge.calls?.length && <p className="mt-2 text-sm">No active call. Runtime models are unverified until a call produces evidence.</p>}
      {bridge.calls?.map(call => <AIAgentRuntimeCall key={call.callSid} call={call} expected={pipeline} />)}
      {bridge.lastCall && <AIAgentRuntimeCall call={bridge.lastCall} expected={pipeline} historical />}
      <p className="mt-2 text-xs text-muted-foreground">Refreshes every 10 seconds. Last-call evidence is retained only until this bridge restarts. Settings changes apply to new calls, not a call already in progress.</p></>}
    <p className="mt-3 text-xs text-muted-foreground">Scope: AI greeting, live conversation, and bridge announcements. Legacy announcements after a failed advisor transfer still use Twilio speech, outside this pipeline; they are not verified by these selectors.</p>
    {config && <p className="mt-3 text-xs text-muted-foreground">Transfer: {config.transferPhoneNumber || 'Not set'} · Secondary: {config.transferPhoneNumber2 || 'Not set'}</p>}
  </section>;
}