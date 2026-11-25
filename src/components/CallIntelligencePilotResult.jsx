const intentLabels = {
  ready_to_proceed: 'Ready to proceed', considering: 'Considering options',
  needs_information: 'Needs more information', declined: 'Declined', unknown: 'Intent unclear',
};

export function ApprovedKnowledgeSources({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  return <small aria-label="Approved sources">
    {sources.map(source => `${source.title} · v${source.version}`).join(' | ')}
  </small>;
}

export default function CallIntelligencePilotResult({ job, pending, failed, onRetry }) {
  if (!job && !pending && !failed) return null;
  const result = job?.superseded ? null : job?.result;
  const retry = !pending && (failed || job?.status === 'queued' || job?.status === 'metering' || job?.status === 'processing');
  return <section aria-label="Post-call intent" aria-live="polite">
    <h4>Post-call intent</h4>
    {pending && <p>Analyzing the finalized transcript…</p>}
    {failed && <p>Post-call intent is temporarily unavailable.</p>}
    {job?.superseded && <p>A newer finalized transcript is available.</p>}
    {job?.status === 'reconciliation_required' && <p>Waiting for Core to reconcile provider usage.</p>}
    {job?.status === 'failed' && <p>The analysis could not produce a usable result.</p>}
    {result && <>
      <p>{intentLabels[result.intent] || intentLabels.unknown}{result.intent !== 'unknown' &&
        <> · {Math.round(result.confidence * 100)}% confidence</>}</p>
      {result.objections?.length > 0 && <><h5>Unresolved objections</h5><ul>
        {result.objections.map((item, index) => <li key={index}>{item}</li>)}
      </ul></>}
      {result.suggested_next_actions?.length > 0 && <><h5>Suggested next actions</h5><ul>
        {result.suggested_next_actions.map((item, index) => <li key={index}>{item}</li>)}
      </ul></>}
      <ApprovedKnowledgeSources sources={result.sources}/>
    </>}
    {retry && <button type="button" onClick={onRetry}>Check post-call intent</button>}
  </section>;
}
