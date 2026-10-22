import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import AIAgentTurnSamples from './AIAgentTurnSamples';

// Low-latency target for one full turn: the caller stops talking → the agent's
// first audio out. Anything above this is a turn the caller had to wait on.
export const LOW_LATENCY_TARGET_MS = 800;

const turnSamples = call => (call?.turnSamples || []).filter(sample => typeof sample?.ms === 'number');

function Tile({ label, value, tone = '' }) {
  return (
    <div className="min-w-0 rounded bg-muted p-3 text-xs">
      <p className="font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all text-base font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export default function AIAgentLatencyDashboard() {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['ai-agent-latency', sessionUserId],
    queryFn: async () => (await base44.functions.invoke('aiAgentPipeline', { action: 'status', sessionUserId, sessionToken })).data,
    refetchInterval: 3000, retry: false,
  });

  const bridge = data?.bridge;
  const calls = bridge?.calls || [];
  const lastCall = bridge?.lastCall || null;
  const turns = [...calls, lastCall].flatMap(turnSamples);
  const sorted = turns.map(turn => turn.ms).sort((a, b) => a - b);
  const avg = sorted.length ? Math.round(sorted.reduce((sum, ms) => sum + ms, 0) / sorted.length) : null;
  const worst = sorted.length ? sorted[sorted.length - 1] : null;
  const within = turns.filter(turn => turn.ms <= LOW_LATENCY_TARGET_MS).length;
  const fluxTurns = turns.filter(turn => turn.stt === 'flux').length;
  const activeEngine = calls[0]?.stt?.model || lastCall?.stt?.model || data?.pipeline?.sttModel || null;

  return (
    <section aria-label="Agent turn latency" className="dark mb-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Turn Latency — end of caller's turn → agent's first audio</h3>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="rounded border border-input px-3 py-2 text-xs disabled:opacity-50">
          {isFetching ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Polling the running bridge every 3s · low-latency target {LOW_LATENCY_TARGET_MS}ms · {data ? `checked ${new Date(data.checkedAt).toLocaleTimeString()}` : 'checking…'}
      </p>

      {error && <p role="alert" className="mt-2 text-sm text-destructive">Latency check failed. Previously displayed numbers are not current. {error?.response?.data?.error || error?.message || ''}</p>}
      {!data && !error && <p className="mt-2 text-sm text-muted-foreground">Querying the running bridge…</p>}

      {bridge && bridge.state !== 'connected' && (
        <p role="status" className="mt-3 text-sm text-destructive">NOT VERIFIED: {bridge.message || 'The bridge is not reachable for runtime evidence.'}</p>
      )}

      {bridge?.state === 'connected' && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Turns measured" value={turns.length} />
            <Tile label="Average" value={avg != null ? `${avg}ms` : '—'} tone={avg != null && avg <= LOW_LATENCY_TARGET_MS ? 'text-emerald-400' : avg != null ? 'text-red-400' : ''} />
            <Tile label="Worst" value={worst != null ? `${worst}ms` : '—'} tone={worst != null && worst <= LOW_LATENCY_TARGET_MS ? 'text-emerald-400' : worst != null ? 'text-red-400' : ''} />
            <Tile label={`Within ${LOW_LATENCY_TARGET_MS}ms`} value={turns.length ? `${within}/${turns.length}` : '—'} />
          </dl>

          <p className="mt-3 text-xs text-muted-foreground">Engine on the wire: <span className="font-semibold">{activeEngine || 'unknown'}</span> · Flux turns measured: <span className="font-semibold">{fluxTurns}</span></p>
          {turns.length > 0 && fluxTurns === 0 && (
            <p role="status" className="mt-2 text-xs text-amber-400">
              Every turn measured so far came in on {activeEngine || 'a non-Flux engine'} — no Flux turn has been measured yet. Flux numbers appear once the bridge is running the Flux turn-taking build and the agent is set to it.
            </p>
          )}
          {turns.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">No caller turn recorded yet. Numbers appear as soon as an active call finishes a turn — the clock starts when the caller stops talking.</p>
          )}

          {calls.map(call => (
            <div key={call.callSid} className="mt-4 rounded border border-border p-3">
              <p className="text-xs font-semibold">
                Active call · {call.callSid} · {call.state} · {call.stt?.model || 'no STT model'} · voice {call.tts?.engine || '—'}/{call.tts?.voice || call.tts?.model || '—'}
              </p>
              {call.turn && call.turn.ms == null && <p className="mt-1 text-xs text-muted-foreground">Turn in flight — waiting for the first audio of this reply.</p>}
              {call.turn?.ms != null && (
                <p className={`mt-1 text-xs font-semibold ${call.turn.ms <= LOW_LATENCY_TARGET_MS ? 'text-emerald-400' : 'text-red-400'}`}>
                  Last turn {call.turn.ms}ms {call.turn.ms <= LOW_LATENCY_TARGET_MS ? '· within target' : '· over target'}
                </p>
              )}
              {call.error && <p className="mt-1 text-xs text-destructive">{call.error}</p>}
              <AIAgentTurnSamples samples={turnSamples(call)} targetMs={LOW_LATENCY_TARGET_MS} />
            </div>
          ))}

          {!calls.length && <p className="mt-3 text-sm text-muted-foreground">No active call right now — the numbers below are from the last completed call.</p>}
          {lastCall && (
            <div className="mt-4 rounded border border-border p-3">
              <p className="text-xs font-semibold">
                Last completed call · {lastCall.callSid} · {new Date(lastCall.startedAt).toLocaleString()} · {lastCall.stt?.model || 'no STT model'} · voice {lastCall.tts?.engine || '—'}/{lastCall.tts?.voice || lastCall.tts?.model || '—'}
              </p>
              {lastCall.tts?.fallback && <p className="mt-1 text-xs text-destructive">Fallback: {lastCall.tts.fallback}</p>}
              <AIAgentTurnSamples samples={turnSamples(lastCall)} targetMs={LOW_LATENCY_TARGET_MS} />
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Measured by the bridge itself on each turn and kept per active call (last 20 turns); history resets when a call ends and is not stored long-term.
      </p>
    </section>
  );
}