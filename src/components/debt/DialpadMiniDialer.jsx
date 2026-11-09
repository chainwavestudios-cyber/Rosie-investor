/**
 * DialpadMiniDialer.jsx — the embedded Dialpad phone for the coach workspace.
 *
 * It stays mounted so inbound calls ring inside the app; collapsed it slides off
 * screen and a small pill brings it back. Inbound ringing is read from the CTI's
 * postMessage payload, which names the line that was dialed, so the agent sees
 * whether it came in on one number or the other before answering.
 */
import { useEffect, useRef, useState } from 'react';
import { Phone, X, PhoneIncoming } from 'lucide-react';
import {
  DIALPAD_CALL_CENTER, DIALPAD_CTI_ORIGIN, DIALPAD_CTI_URL,
  registerDialpadFrame, unregisterDialpadFrame,
} from '@/lib/dialpadCti';

export default function DialpadMiniDialer() {
  const frameRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [seenNumbers, setSeenNumbers] = useState([]);

  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    if (win) registerDialpadFrame(win);
    return () => unregisterDialpadFrame(win);
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== DIALPAD_CTI_ORIGIN) return;
      const data = event.data;
      if (!data || data.api !== 'opencti_dialpad') return;

      // Any number the CTI reports belongs to a line in this account. Reading
      // them off the session is how the call center's own numbers surface here,
      // since the embed exposes no list of them on its own.
      const found = String(JSON.stringify(data.payload || {})).match(/\+?\d[\d\s().-]{8,}\d/g) || [];
      const normalized = found
        .map((n) => n.replace(/\D/g, ''))
        .filter((n) => n.length === 10 || n.length === 11)
        .map((n) => (n.length === 10 ? `+1${n}` : `+${n}`));
      if (normalized.length) {
        setSeenNumbers((prev) => Array.from(new Set([...prev, ...normalized])).slice(0, 6));
      }

      if (data.method === 'user_authentication') {
        setSignedIn(!!data.payload?.user_authenticated);
        return;
      }
      if (data.method === 'call_ringing') {
        if (data.payload?.state === 'on') {
          setRinging({
            caller: data.payload?.external_number || data.payload?.contact?.phone || 'Unknown number',
            name: data.payload?.contact?.name || '',
            line: data.payload?.internal_number || '',
            lineName: data.payload?.target?.name || DIALPAD_CALL_CENTER,
          });
          setOpen(true);
        } else {
          setRinging(null);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      <div style={{ position: 'fixed', right: 0, bottom: 0, zIndex: 15600, transform: open ? 'translateY(0)' : 'translateY(110%)', transition: 'transform .22s ease', pointerEvents: open ? 'auto' : 'none' }}>
        <div style={{ width: '412px', maxWidth: '96vw', background: '#0b1520', border: '1px solid #23445c', borderTopLeftRadius: '10px', boxShadow: '0 18px 48px rgba(0,0,0,.55)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: '1px solid #18293a' }}>
            <Phone size={13} color="#5eead4" />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#cfe9e3', letterSpacing: '.04em' }}>DIALPAD · {DIALPAD_CALL_CENTER}</span>
            <span style={{ fontSize: '10px', color: signedIn ? '#6ee7b7' : '#9aa7b4', marginLeft: 'auto' }}>{signedIn ? 'Signed in' : 'Log in inside the dialer'}</span>
            <button type="button" onClick={() => setOpen(false)} title="Hide the dialer" style={{ background: 'transparent', border: 0, color: '#8fa4b8', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
          </div>
          {seenNumbers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '6px 10px', borderBottom: '1px solid #18293a', background: '#0e1c28' }}>
              <span style={{ fontSize: '9px', letterSpacing: '.08em', color: '#7f97ab', fontWeight: 800 }}>LINES SEEN</span>
              {seenNumbers.map((n) => (
                <button key={n} type="button" onClick={() => navigator.clipboard?.writeText(n)}
                  title="Copy this number so it can be pinned as a caller ID"
                  style={{ fontSize: '10px', fontWeight: 750, color: '#bfe9dd', background: '#173e38', border: '1px solid #3f6659', borderRadius: '999px', padding: '2px 8px', cursor: 'pointer' }}>
                  {n}
                </button>
              ))}
            </div>
          )}
          {ringing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'rgba(16,185,129,.16)', borderBottom: '1px solid rgba(16,185,129,.35)', color: '#d6ffee', fontSize: '11px' }}>
              <PhoneIncoming size={14} />
              <span><strong>{ringing.name || ringing.caller}</strong> ringing {ringing.lineName}{ringing.line ? ` · ${ringing.line}` : ''}</span>
            </div>
          )}
          <iframe
            ref={frameRef}
            src={DIALPAD_CTI_URL}
            title="Dialpad"
            allow="microphone; speaker-selection; autoplay; camera; display-capture; hid"
            sandbox="allow-popups allow-scripts allow-same-origin allow-forms"
            frameBorder="0"
            style={{ width: '100%', height: '520px', border: 0, background: '#fff' }}
          />
        </div>
      </div>

      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          title={`Open the Dialpad dialer (${DIALPAD_CALL_CENTER})`}
          style={{ position: 'fixed', right: '16px', bottom: '16px', zIndex: 15590, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 13px', borderRadius: '999px', border: '1px solid #648e80', background: '#173e38', color: '#c2f2db', fontSize: '11px', fontWeight: 760, cursor: 'pointer', boxShadow: '0 10px 26px rgba(0,0,0,.45)' }}>
          <Phone size={14} /> Dialpad
        </button>
      )}
    </>
  );
}