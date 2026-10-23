import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProtofaceClient } from 'protoface-client/react';
import { Loader2, Mic, MicOff, PhoneOff, Video } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useStephaniAgent from '@/hooks/useStephaniAgent';

const STATUS_LABEL = {
  idle: 'Ready when you are',
  joining: 'Joining the call…',
  requesting_device_access: 'Waiting for your microphone…',
  live: 'Live',
  speaking: 'Speaking…',
  ended: 'Call ended',
  failed: 'Connection problem',
};

const STARTABLE = ['idle', 'ended', 'failed'];

/**
 * The agent-driven video call: the avatar only renders the face. Her words come from our
 * own knowledge-base answer, spoken by our voice and streamed to the avatar as audio.
 */
export default function StephaniAgentStage({
  sessionToken,
  agentName = 'Stephani',
  leadName,
  startSignal = 0,
  endSignal = 0,
  assistant = '',
  autoStart = false,
  onLine,
  onStatus,
  onEnded,
}) {
  const videoRef = useRef(null);
  const tokenRef = useRef(sessionToken);
  tokenRef.current = sessionToken;

  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('idle');
  const [setupError, setSetupError] = useState('');
  const startSignalRef = useRef(startSignal);
  const endSignalRef = useRef(endSignal);
  const clientStartedRef = useRef(null);

  // The avatar service is only ever called through our backend, which holds its key.
  const apiClientRef = useRef(null);
  if (!apiClientRef.current) {
    apiClientRef.current = {
      createLiveKitSession: async (request) => {
        const res = await base44.functions.invoke('stephaniAgent', {
          action: 'createSession',
          sessionToken: tokenRef.current,
          ...request,
        });
        const session = res?.data?.session;
        if (!session) throw new Error(res?.data?.error || 'The video assistant could not join the call.');
        return session;
      },
      endSession: async (sessionId) => {
        await base44.functions
          .invoke('stephaniAgent', { action: 'endSession', sessionToken: tokenRef.current, sessionId })
          .catch(() => null);
      },
    };
  }

  const { client, status: clientStatus, error: clientError } = useProtofaceClient({
    avatarId: room?.avatarId,
    livekitUrl: room?.livekitUrl,
    roomName: room?.roomName,
    participantToken: room?.participantToken,
    workerToken: room?.workerToken,
    workerIdentity: room?.workerIdentity,
    metadata: { sessionToken },
    apiClient: apiClientRef.current,
    videoRef,
  });

  const report = useCallback(
    (next) => {
      setStatus(next);
      onStatus?.(next);
    },
    [onStatus],
  );

  const agent = useStephaniAgent({
    client,
    clientStatus,
    sessionToken,
    room,
    opening: room?.opening,
    tuning: room?.tuning,
    enabled: !!room,
    onLine,
    onStatus: report,
    onEnded,
  });

  // Once the room passes are in hand the browser joins, which brings her on screen.
  const startClient = useCallback(async () => {
    if (!room || !client || clientStartedRef.current === client) return;
    clientStartedRef.current = client;
    client.setMediaElements({ videoElement: videoRef.current });
    try {
      await client.start();
    } catch (err) {
      setSetupError(err?.message || 'The call could not start.');
      report('failed');
    }
  }, [room, client, report]);

  useEffect(() => {
    void startClient();
  }, [startClient]);

  // A room that never comes up tells the visitor so, and lets them try again.
  useEffect(() => {
    if (!room || clientStatus === 'started') return undefined;
    const timer = setTimeout(() => {
      clientStartedRef.current = null;
      setRoom(null);
      setSetupError('We could not bring the video up on this connection. Please try again, or call us and we will help right away.');
      report('failed');
    }, 25000);
    return () => clearTimeout(timer);
  }, [room, clientStatus, report]);

  const begin = useCallback(async () => {
    if (room) {
      void startClient();
      return;
    }
    setSetupError('');
    report('joining');
    try {
      const res = await base44.functions.invoke('stephaniAgent', { action: 'room', sessionToken: tokenRef.current, assistant });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'The video assistant is unavailable right now.');
      setRoom(res.data);
      base44.analytics.track({ eventName: 'video_qualify_agent_call_start' });
    } catch (err) {
      setSetupError(err?.response?.data?.error || err?.message || 'The video assistant is unavailable right now.');
      report('failed');
    }
  }, [room, report, startClient, assistant]);

  useEffect(() => {
    if (startSignal === startSignalRef.current) return;
    startSignalRef.current = startSignal;
    void begin();
  }, [startSignal, begin]);

  // They just picked this assistant, so the call starts as soon as the stage appears.
  useEffect(() => {
    if (!autoStart) return undefined;
    void begin();
    return undefined;
    // Mount-time only: later starts come from the button above or from startSignal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (endSignal === endSignalRef.current) return;
    endSignalRef.current = endSignal;
    void agent.end();
  }, [endSignal, agent]);

  // Once the room is up the hang-up control stays reachable, even if her voice line failed.
  const onStage = status === 'live' || clientStatus === 'started';
  const busy = status === 'joining' || status === 'requesting_device_access' || clientStatus === 'starting';
  const canStart = !busy && STARTABLE.includes(status);
  const label = agent.speaking ? STATUS_LABEL.speaking : STATUS_LABEL[status] || 'Ready';
  const detail = setupError || agent.error || clientError?.message || '';

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-400/20 bg-[#0b1220] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="relative aspect-video w-full">
        <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />

        {!onStage && (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.28),#0b1220_68%)] px-6 text-center">
            <div className="relative flex max-w-md flex-col items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-sky-600 text-2xl font-semibold text-[#0b1220]">
                {agentName.charAt(0)}
              </span>
              <div>
                <p className="text-base font-semibold text-slate-100">Talk with {agentName}</p>
                <p className="mt-1 text-sm text-slate-300">
                  A live video review of your balances — no paperwork, no obligation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void begin()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 px-4 py-3 text-sm font-semibold text-[#0b1220] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                {busy ? 'Starting…' : `Start video call with ${agentName}`}
              </button>

              {detail && <p className="text-xs text-rose-300">{detail}</p>}
            </div>
          </div>
        )}

        {onStage && (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button
              type="button"
              onClick={agent.toggleMute}
              aria-label={agent.muted ? 'Unmute microphone' : 'Mute microphone'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0d1117]/80 text-slate-200 backdrop-blur hover:bg-white/10"
            >
              {agent.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void agent.end()}
              aria-label="End call"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/20 text-rose-100 backdrop-blur hover:bg-rose-500/30"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1117]/80 px-3 py-1.5 backdrop-blur">
          <span className={`h-2 w-2 rounded-full ${onStage ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          <span className="text-xs font-medium text-slate-200">{agentName}</span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/85 to-transparent px-3 pb-3 pt-8">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              onStage ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300'
            }`}
          >
            {onStage ? <Mic className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5" />}
            {label}
          </span>
          <span className="text-[11px] text-slate-400">
            {leadName ? `Qualifying ${leadName}` : 'Live video qualification'}
          </span>
        </div>
      </div>
    </div>
  );
}