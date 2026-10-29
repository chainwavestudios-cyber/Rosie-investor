/**
 * audioChannels.js — reach one isolated track of a multichannel hardware input.
 *
 * A mixer such as the RØDECaster publishes ONE multichannel USB input (plus a
 * Windows "Stereo Mix"), not one device per channel pair, so the isolated
 * channel (mic 1 on track 3) can never be chosen from the device list.
 * Browser audio processing (echo cancellation, noise suppression, AGC)
 * downmixes the input to stereo, which hides every track above it — so a
 * selected track is only reachable with processing off and a channelCount
 * request large enough to cover it.
 */

export const CHANNEL_LABELS = [
  'Whole input (mix)',
  'Track 1',
  'Track 2',
  'Track 3',
  'Track 4',
  'Track 5',
  'Track 6',
  'Track 7',
  'Track 8',
];

/** getUserMedia audio constraints for one input, with processing off when a track is picked. */
export function audioConstraints(deviceId, channel = 0, base = {}) {
  const audio = { ...base };
  if (deviceId) audio.deviceId = { exact: deviceId };
  if (channel > 0) {
    audio.echoCancellation = false;
    audio.noiseSuppression = false;
    audio.autoGainControl = false;
    audio.channelCount = { ideal: Math.max(8, channel) };
  }
  return { audio };
}

/** How many tracks the browser actually handed over for this stream. */
export function trackChannelCount(stream) {
  const track = stream?.getAudioTracks?.()[0];
  return Number(track?.getSettings?.()?.channelCount) || 2;
}

/** Source node for one 1-based track, or the whole stream when channel is 0. */
export function channelSource(ctx, stream, channel = 0) {
  const src = ctx.createMediaStreamSource(stream);
  if (!(channel > 0)) return { node: src, output: 0 };
  const splitter = ctx.createChannelSplitter(Math.max(trackChannelCount(stream), channel));
  src.connect(splitter);
  return { node: splitter, output: channel - 1 };
}