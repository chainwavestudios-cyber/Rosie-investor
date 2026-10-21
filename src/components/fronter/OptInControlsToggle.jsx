/**
 * OptInControlsToggle.jsx — super-admin Hide switch, sits beside the Time Card.
 * Pressed, it takes the mass opt-in buttons (Spread over days, Opt In Every Lead,
 * Subscribe All To Email List) out of every user's view; pressed again they return.
 * The state is kept on the server, so it holds for everyone until it is pressed again.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';

export default function OptInControlsToggle({ username }) {
  const [hidden, setHidden] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    base44.functions.invoke('emailOptIn', { action: 'uiState' })
      .then((res) => {
        const d = res?.data || {};
        if (typeof d.hidden === 'boolean') setHidden(d.hidden);
      })
      .catch(() => { /* switch unavailable */ });
  }, []);

  const toggle = async () => {
    if (busy || hidden === null) return;
    const next = !hidden;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('emailOptIn', { action: 'setUiHidden', hidden: next, adminUsername: username });
      if (res?.data?.error) throw new Error(res.data.error);
      setHidden(next);
      window.dispatchEvent(new CustomEvent('optin-controls-visibility', { detail: { hidden: next } }));
    } catch { /* leave the switch as it was */ }
    setBusy(false);
  };

  if (hidden === null) return null;

  const color = hidden ? '#f59e0b' : GOLD;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={hidden ? 'Show the opt-in buttons to everyone again' : 'Hide the opt-in buttons from everyone'}
      style={{ background: `${color}18`, color, border: `1px solid ${color}44`, borderRadius: '4px', padding: '6px 12px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
    >
      {hidden ? '👁 Unhide' : '🙈 Hide'}
    </button>
  );
}