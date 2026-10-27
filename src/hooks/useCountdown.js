import { useEffect, useState } from 'react';

/** Turns a millisecond gap into a ticking "1d 02:14:09" label. */
export function formatCountdown(ms) {
  const past = ms <= 0;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return { past, label: d > 0 ? `${d}d ${clock}` : clock };
}

/** Live countdown to one date. Ticks every second. */
export default function useCountdown(dateIso) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = dateIso ? new Date(dateIso).getTime() : null;
  if (!target || Number.isNaN(target)) return { hasDate: false, ms: 0, past: false, label: '' };
  const ms = target - now;
  return { hasDate: true, ms, ...formatCountdown(ms) };
}