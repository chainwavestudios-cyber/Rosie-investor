/**
 * audioDevices.js — which inputs are allowed to carry the customer side of a call.
 *
 * A loopback input (Windows "Stereo Mix", "What U Hear", a virtual cable, or a
 * hardware mixer / line-in) carries audio that arrived from somewhere other than
 * this room. A plain microphone never belongs on the customer channel: it records
 * the whole room, so the agent's own voice lands there and both voices end up on
 * one channel — which is exactly what the split exists to prevent.
 */
const LOOPBACK = /stereo mix|what u hear|wave out|loopback|virtual|cable output|voicemeeter|rode|røde|multichannel|line in|line \(|aux|monitor of/i;

export function isLoopbackSource(label = '') {
  return LOOPBACK.test(label || '');
}

/**
 * A hardware mixer publishes several USB channel pairs. Pair 1-2 is the master
 * mix (every voice at once); the isolated channels carry one source each.
 * Capturing the master mix puts both voices on the channel, which is the
 * crosstalk this split exists to avoid.
 */
const ISOLATED_CHANNEL = /isolat|individual|\bchat\b|usb\s*3|usb\s*[4-9]|3\s*[-&/]\s*4|channel\s*3|sub\s*mix/i;
const MASTER_MIX = /main mix|master mix|main out|master out|usb\s*1\s*[-&/]\s*2|\bmain\b|\bmaster\b/i;

/** An isolated (single-source) channel pair, e.g. USB 3. */
export function isIsolatedInput(label = '') {
  return ISOLATED_CHANNEL.test(label || '');
}

/** The full mix pair (USB 1-2) — carries both voices. */
export function isMasterMixInput(label = '') {
  return MASTER_MIX.test(label || '') && !isIsolatedInput(label || '');
}

/** The best isolated input not already in use, or null. */
export function findIsolatedInput(devices = [], excludeIds = []) {
  const usable = (devices || []).filter(d => d.kind === 'audioinput'
    && !excludeIds.includes(d.deviceId)
    && !['default', 'communications'].includes(d.deviceId));
  return usable.find(d => isIsolatedInput(d.label || '')) || null;
}

/** The best loopback input in a device list, or null when there is none. */
export function findLoopback(devices = []) {
  const ins = (devices || []).filter(d => d.kind === 'audioinput');
  return ins.find(d => /stereo mix/i.test(d.label || ''))
    || ins.find(d => /what u hear|loopback/i.test(d.label || ''))
    || ins.find(d => isLoopbackSource(d.label || ''))
    || null;
}