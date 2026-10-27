/**
 * audioDevices.js — which inputs are allowed to carry the customer side of a call.
 *
 * A loopback input (Windows "Stereo Mix", "What U Hear", a virtual cable, or a
 * hardware mixer / line-in) carries audio that arrived from somewhere other than
 * this room. A plain microphone never belongs on the customer channel: it records
 * the whole room, so the agent's own voice lands there and both voices end up on
 * one channel — which is exactly what the split exists to prevent.
 */
const LOOPBACK = /stereo mix|what u hear|wave out|loopback|virtual|cable output|voicemeeter|rode|line in|line \(|aux|monitor of/i;

export function isLoopbackSource(label = '') {
  return LOOPBACK.test(label || '');
}

/** The best loopback input in a device list, or null when there is none. */
export function findLoopback(devices = []) {
  const ins = (devices || []).filter(d => d.kind === 'audioinput');
  return ins.find(d => /stereo mix/i.test(d.label || ''))
    || ins.find(d => /what u hear|loopback/i.test(d.label || ''))
    || ins.find(d => isLoopbackSource(d.label || ''))
    || null;
}