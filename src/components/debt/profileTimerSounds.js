/**
 * Debt Call Coach contact-card reminder sounds.
 *
 * Built-in sounds are original Web Audio tones: no external file dependencies.
 * A user may upload a short personal sound to Base44, persist its URL in
 * DebtCoachUserSetting, and choose it for an individual reminder.
 *
 * A shared AudioContext stays alive after the profile modal closes so the
 * global ProfileTimerWatcher can play the selected sound when the timer fires.
 */
export const PROFILE_TIMER_SOUNDS = Object.freeze([
  { id: 'bell', label: 'Bell' },
  { id: 'chime', label: 'Soft chime' },
  { id: 'digital', label: 'Digital alert' },
  { id: 'gentle', label: 'Gentle ping' },
  { id: 'none', label: 'Silent (popup only)' },
]);

export const MAX_TIMER_SOUND_BYTES = 5 * 1024 * 1024;

let sharedContext = null;
const decodedSounds = new Map();

function audioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioContext();
  return sharedContext;
}

export function normalizeProfileTimerSound(sound) {
  if (!sound || typeof sound !== 'object') return { id: 'bell' };
  if (sound.id === 'custom') {
    const url = String(sound.url || '');
    if (/^https:\/\/[^ ]{1,2000}$/.test(url)) {
      return { id: 'custom', url, name: String(sound.name || 'Custom sound').slice(0,120) };
    }
    return { id: 'bell' };
  }
  return PROFILE_TIMER_SOUNDS.some(option => option.id === sound.id)
    ? { id: sound.id } : { id: 'bell' };
}

/** A silent unlock on a real click; keeps the sound engine eligible to play later. */
export function primeProfileTimerAudio(sound) {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    ctx.resume().catch(() => {});
    const o = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.00001;
    o.connect(gain);
    gain.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.012);
  } catch (e) {
    console.warn('[ProfileTimer] Sound engine could not be primed:', e?.message);
  }
  if (sound?.id === 'custom' && sound.url) void prepareCustomSound(ctx, sound.url).catch(() => {});
}

async function prepareCustomSound(ctx, url) {
  if (decodedSounds.has(url)) return decodedSounds.get(url);
  const pending = (async () => {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Audio file is unavailable');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_TIMER_SOUND_BYTES) throw new Error('Audio file is too large');
    return await ctx.decodeAudioData(buffer);
  })();
  decodedSounds.set(url, pending);
  try { return await pending; }
  catch (e) { decodedSounds.delete(url); throw e; }
}

const sequences = {
  bell: [
    { t: 0, freq: 1047, length: .65, gain: .14, type: 'sine' },
    { t: .06, freq: 1568, length: .76, gain: .09, type: 'sine' },
    { t: .65, freq: 1047, length: .65, gain: .12, type: 'sine' },
  ],
  chime: [
    { t: 0, freq: 659.25, length: .36, gain: .12, type: 'sine' },
    { t: .25, freq: 783.99, length: .4, gain: .13, type: 'sine' },
    { t: .56, freq: 987.77, length: .72, gain: .13, type: 'sine' },
  ],
  digital: [
    { t: 0, freq: 880, length: .13, gain: .09, type: 'square' },
    { t: .19, freq: 880, length: .13, gain: .09, type: 'square' },
    { t: .39, freq: 1108.73, length: .24, gain: .09, type: 'triangle' },
  ],
  gentle: [
    { t: 0, freq: 783.99, length: .64, gain: .075, type: 'sine' },
    { t: .36, freq: 1174.66, length: .73, gain: .07, type: 'sine' },
  ],
};

/** Plays the complete selected tone, or at most 8 seconds of an uploaded clip. */
export async function playProfileTimerSound(sound = { id: 'bell' }) {
  const selected = normalizeProfileTimerSound(sound);
  if (selected.id === 'none') return true;
  const ctx = audioContext();
  if (!ctx) return false;
  try {
    if (ctx.state !== 'running') await ctx.resume();
    if (selected.id === 'custom') {
      const buffer = await prepareCustomSound(ctx, selected.url);
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = .8;
      src.buffer = buffer;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + Math.min(8, buffer.duration));
      return true;
    }
    for (const note of sequences[selected.id] || sequences.bell) {
      const oscillator = ctx.createOscillator();
      const volume = ctx.createGain();
      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.freq, ctx.currentTime + note.t);
      const begin = ctx.currentTime + note.t;
      volume.gain.setValueAtTime(0.0001, begin);
      volume.gain.exponentialRampToValueAtTime(note.gain, begin + .018);
      volume.gain.exponentialRampToValueAtTime(.0001, begin + note.length);
      oscillator.connect(volume);
      volume.connect(ctx.destination);
      oscillator.start(begin);
      oscillator.stop(begin + note.length + .03);
    }
    return true;
  } catch (error) {
    // Uploaded file cross-origin/decoding issue: play via browser media element
    // as a fallback. A visible in-app reminder is always shown regardless.
    if (selected.id === 'custom') {
      try {
        const el = new Audio(selected.url);
        el.volume = .85;
        const stop = () => { el.pause(); el.src = ''; };
        el.addEventListener('ended', stop, { once: true });
        setTimeout(stop, 8000);
        await el.play();
        return true;
      } catch (secondary) {
        console.warn('[ProfileTimer] Uploaded sound blocked:', secondary?.message);
      }
    }
    console.warn('[ProfileTimer] Notification sound unavailable:', error?.message);
    return false;
  }
}

export function isValidProfileTimerSoundFile(file) {
  if (!file || file.size <= 0 || file.size > MAX_TIMER_SOUND_BYTES) return false;
  const ext = String(file.name || '').split('.').pop()?.toLowerCase();
  return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm'].includes(ext);
}
