import { useCallback, useEffect, useRef, useState } from 'react';

// Browser dictation for the AI console: speak a command, ACE hears the final
// transcript and acts on it. Uses the browser's own speech engine, so no audio
// ever leaves the device for a paid transcription.
export default function useVoiceInput({ onFinal } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const SpeechRecognition =
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = Boolean(SpeechRecognition);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let text = '';
      let finished = false;
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
        if (event.results[i].isFinal) finished = true;
      }
      if (finished) {
        setInterim('');
        const spoken = text.trim();
        if (spoken) finalRef.current?.(spoken);
      } else {
        setInterim(text);
      }
    };
    rec.onerror = () => { setListening(false); setInterim(''); };
    rec.onend = () => { setListening(false); setInterim(''); };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [SpeechRecognition]);

  const toggle = useCallback(() => { if (listening) stop(); else start(); }, [listening, start, stop]);

  useEffect(() => () => { try { recRef.current?.abort?.(); } catch { /* ignore */ } }, []);

  return { supported, listening, interim, toggle, stop };
}