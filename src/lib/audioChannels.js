/**
 * One RØDECaster USB multitrack device is not the same as a browser-captured
 * multichannel stream. In particular, Chrome/Windows may expose only 1–2
 * channels of its 16-channel USB 1 source. Never promise an isolated USB 3
 * signal until getUserMedia() actually reports >= 3 channels.
 *
 * USB order on RØDECaster Pro / Pro II and Duo:
 * 1/2 master L/R; USB 3 Mic 1; USB 4 Mic 2; USB 5 Mic 3; USB 6 Mic 4.
 * The 2026 Windows RØDECaster Virtual Devices Driver alternatively publishes
 * faders as independent selectable inputs — then choose Whole Input.
 */
export const RODE_VIRTUAL_INPUT_GUIDE =
  'https://help.rode.com/hc/en-us/articles/15514570006927-The-R%C3%98DECaster-Pro-II-Duo-Virtual-Devices-Multitrack-Output';

export const CHANNEL_LABELS = [
  'Whole input (default mix)',
  'USB 1 — Main mix left',
  'USB 2 — Main mix right',
  'USB 3 — Isolated Mic 1 (XLR 1)',
  'USB 4 — Isolated Mic 2 (XLR 2)',
  'USB 5 — Isolated Mic 3 (XLR 3)',
  'USB 6 — Isolated Mic 4 (XLR 4)',
  'USB 7 — Bluetooth left (Pro II)',
  'USB 8 — Bluetooth right (Pro II)',
  'USB 9 — SMART Pads left (Pro II)',
  'USB 10 — SMART Pads right (Pro II)',
  'USB 11 — USB Main left (Pro II)',
  'USB 12 — USB Main right (Pro II)',
  'USB 13 — USB Chat left (Pro II)',
  'USB 14 — USB Chat right (Pro II)',
  'USB 15 — USB Secondary left (Pro II)',
  'USB 16 — USB Secondary right (Pro II)',
];

export const isRodeDevice = label => /r[øo]de|rodecaster/i.test(String(label||''));
export const isRodeFaderInput = label =>
  isRodeDevice(label) && /\bfader\s*[\d]+|mic(?:rophone)?\s*[\d]+|combo\s*[\d]+|isolated\s*input/i.test(String(label||''));

/** Request all available source channels without echo-cancel downmix. */
export function audioConstraints(deviceId, channel = 0, base = {}) {
  const audio = { ...base };
  if (deviceId) audio.deviceId = { exact: deviceId };
  if (channel > 0) {
    audio.echoCancellation = false;
    audio.noiseSuppression = false;
    audio.autoGainControl = false;
    // Ask for all 16 channels. Browser may legally grant fewer; caller MUST
    // inspect track.getSettings().channelCount and warn before using USB 3+.
    audio.channelCount = { ideal: 16 };
  }
  return { audio };
}

/** The *actual* channel count from browser capture, not available USB tracks. */
export function trackChannelCount(stream) {
  const count = Number(stream?.getAudioTracks?.()[0]?.getSettings?.()?.channelCount);
  return Number.isFinite(count) && count >= 1 ? Math.floor(count) : 0;
}

export function captureChannelInfo(stream, requestedChannel = 0) {
  const track = stream?.getAudioTracks?.()[0];
  const settings = track?.getSettings?.() || {};
  const capabilities = track?.getCapabilities?.() || {};
  const actual = trackChannelCount(stream);
  const maxAdvertised = Number(capabilities.channelCount?.max);
  return {
    actual,
    known: actual > 0,
    requested: Number(requestedChannel) || 0,
    supported: requestedChannel === 0 || (actual > 0 && actual >= requestedChannel),
    label: track?.label || '',
    sampleRate: Number(settings.sampleRate) || null,
    availableMax: Number.isFinite(maxAdvertised) ? maxAdvertised : null,
    echoCancellation: settings.echoCancellation,
    reason: requestedChannel>0 && actual===0
      ? 'The browser did not report a channel count. Isolated input cannot be verified.'
      : requestedChannel>actual && actual>0
        ? 'The browser exposed only '+actual+' audio channel'+(actual===1?'':'s')+' from this USB device, not USB '+requestedChannel+'.'
        : '',
  };
}

/** Source node for the selected 1-based USB channel or whole mixed input. */
export function channelSource(ctx, stream, channel = 0) {
  const src = ctx.createMediaStreamSource(stream);
  if (!(channel > 0)) return { node: src, output: 0 };
  const splitter = ctx.createChannelSplitter(Math.max(trackChannelCount(stream), channel));
  src.connect(splitter);
  return { node: splitter, output: channel - 1 };
}
