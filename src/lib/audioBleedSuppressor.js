// Suppresses speaker bleed on the agent channel.
//
// When the caller's audio comes out of the computer speakers, the agent mic
// hears it too, so the caller's words land on the agent channel as well. The
// Realtek Stereo Mix feed is a clean copy of exactly what the speakers play,
// so it can be used as the reference: any stretch where the mic is no louder
// than the room's playback is bleed, and gets ducked. When the agent speaks
// over the caller their mic is clearly louder than the playback and is kept.
const BLOCK = 512;        // 32 ms at 16 kHz
const FLOOR = 0.012;      // reference level below which nobody is on the speaker
const DUCK_HARD = 0.08;   // mic is essentially just bleed
const DUCK_SOFT = 0.45;   // mic is only slightly above the bleed floor
const KEEP_ABOVE = 3.2;   // mic this many times louder than expected bleed = real speech

function rms(arr, from, len) {
  let sum = 0;
  for (let i = from; i < from + len; i++) sum += arr[i] * arr[i];
  return Math.sqrt(sum / len);
}

export function createBleedSuppressor() {
  let bleedGain = 0.35; // how much of the speaker playback lands back in the mic
  let gain = 1;         // gain currently applied to the agent channel

  return function process(agent, customer) {
    const len = Math.min(agent.length, customer.length);
    for (let start = 0; start < len; start += BLOCK) {
      const n = Math.min(BLOCK, len - start);
      const refRms = rms(customer, start, n);
      const micRms = rms(agent, start, n);

      let target = 1;
      // When the learned bleed coupling is high, the agent's own microphone is
      // being played back into the system output, so the loopback channel
      // carries the agent too and mic level can no longer prove "this is only
      // bleed". Ducking there would erase real agent speech and hand it to the
      // customer channel — so never duck in that case.
      const loopbackPolluted = bleedGain > 0.55;
      if (refRms > FLOOR && !loopbackPolluted) {
        const expected = refRms * bleedGain;
        if (micRms <= expected * 2) target = DUCK_HARD;
        else if (micRms <= expected * KEEP_ABOVE) target = DUCK_SOFT;
        // Learn the room: blocks that are clearly just bleed refine the estimate.
        if (target === DUCK_HARD && micRms > 0) {
          bleedGain = bleedGain * 0.995 + (micRms / refRms) * 0.005;
          if (bleedGain < 0.02) bleedGain = 0.02;
          if (bleedGain > 1) bleedGain = 1;
          if (bleedGain > 0.55) bleedGain = 1; // latch: loopback polluted, stay off
        }
      }

      // Ramp across the block so ducking never clicks.
      const from = gain;
      const delta = (target - from) / n;
      for (let i = 0; i < n; i++) {
        gain = from + delta * (i + 1);
        agent[start + i] *= gain;
      }
      gain = target;
    }
    return agent;
  };
}