/**
 * ScriptTeleprompter.jsx — Real-time speech-synchronized teleprompter.
 * Feature A: Active-line highlighting with voice sync (Web Speech API) + manual controls.
 * Feature B: Inline cue blocks (non-spoken annotations) visible in-line but skipped by teleprompter.
 *
 * Used in the Scripts tab by both Live Call and BOB Training (via MyScriptsTab).
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const GOLD = '#10b981';

// ─── Cue Block System ──────────────────────────────────────────────────────────
export const CUE_REGEX = /^@@CUE:(reminder|objection|tone):(.*)@@$/;

export const CUE_CATEGORIES = {
  reminder:  { label: 'Reminder',  icon: '💡', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.35)' },
  objection: { label: 'Objection', icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)' },
  tone:      { label: 'Tone',     icon: '🎯', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.35)' },
};

/**
 * Parse raw script content into an ordered array of elements.
 * Cue blocks (lines matching @@CUE:category:content@@) become cue_block elements.
 * Blank lines are skipped. Everything else is a script line.
 */
export function parseScriptElements(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const elements = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(CUE_REGEX);
    if (m) {
      elements.push({ id: `cue-${i}`, type: 'cue_block', category: m[1], content: m[2], origLine: i });
    } else if (line.trim() === '') {
      continue;
    } else {
      elements.push({ id: `script-${i}`, type: 'script', content: line, origLine: i });
    }
  }
  return elements;
}

// ─── Speech Matching ──────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','is','are','was','were','to','of','in','on','at',
  'i','you','me','my','your','this','that','it','for','with','have','has','do','does',
  'will','would','can','could','should','been','being','am','as','by','from','he','she',
  'they','them','his','her','their','our','we','us','so','if','then','than','also','just',
  'very','really','okay','ok','yeah','uh','um','like','right','now','here','there','all',
  'any','some','no','not','be','got','get',
]);

function keyWords(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/** Returns 0–1 overlap ratio between spoken text and target script line. */
function wordOverlap(spoken, target) {
  const spokenWords = keyWords(spoken);
  const targetWords = keyWords(target);
  if (targetWords.length === 0) return 0;
  let matched = 0;
  for (const tw of targetWords) {
    if (spokenWords.some(sw => sw.includes(tw) || tw.includes(sw))) matched++;
  }
  return matched / targetWords.length;
}

// ─── Cue Block View ───────────────────────────────────────────────────────────
export function CueBlockView({ element }) {
  const cat = CUE_CATEGORIES[element.category] || CUE_CATEGORIES.reminder;
  return (
    <div style={{
      margin: '8px 0', padding: '8px 12px',
      background: cat.bg, border: `1px dashed ${cat.border}`, borderRadius: '6px',
      display: 'flex', gap: '8px', alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '13px', flexShrink: 0 }}>{cat.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: cat.color, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>{cat.label}</div>
        <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{element.content}</div>
      </div>
    </div>
  );
}

// ─── Teleprompter Component ────────────────────────────────────────────────────
export default function ScriptTeleprompter({ content, color = '#e8e0d0', fontSize = 14 }) {
  const elements = useMemo(() => parseScriptElements(content), [content]);
  const scriptLines = useMemo(() => elements.filter(e => e.type === 'script'), [elements]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [speechOn, setSpeechOn] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speechSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));

  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const activeIdxRef = useRef(0);
  const scriptLinesRef = useRef([]);
  const speechOnRef = useRef(false);
  const recognitionRef = useRef(null);
  const lastAdvanceTime = useRef(0);

  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);
  useEffect(() => { scriptLinesRef.current = scriptLines; }, [scriptLines]);
  useEffect(() => { speechOnRef.current = speechOn; }, [speechOn]);

  // Reset position when script content changes
  useEffect(() => { setActiveIdx(0); setInterimText(''); }, [content]);

  // Check if spoken text matches the NEXT script line enough to advance
  const checkAdvance = useCallback((spoken) => {
    const now = Date.now();
    if (now - lastAdvanceTime.current < 700) return; // throttle
    const idx = activeIdxRef.current;
    const lines = scriptLinesRef.current;
    const nextLine = lines[idx + 1];
    if (!nextLine) return;
    if (wordOverlap(spoken, nextLine.content) >= 0.35) {
      lastAdvanceTime.current = now;
      setActiveIdx(idx + 1);
    }
  }, []);

  // Speech recognition lifecycle
  useEffect(() => {
    if (!speechOn) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechOn(false); return; }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) checkAdvance(final);
      if (interim) { setInterimText(interim); checkAdvance(interim); }
      if (final) setInterimText('');
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setSpeechOn(false);
    };

    rec.onend = () => {
      if (speechOnRef.current) { try { rec.start(); } catch {} }
    };

    try { rec.start(); } catch {}
    recognitionRef.current = rec;

    return () => {
      speechOnRef.current = false;
      rec.onend = null;
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [speechOn, checkAdvance]);

  // Keyboard controls: ↓/Space = next, ↑ = prev, R = reset
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setActiveIdx(p => Math.min(p + 1, scriptLines.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(p => Math.max(p - 1, 0));
      } else if (e.key === 'r' || e.key === 'R') {
        setActiveIdx(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [scriptLines.length]);

  // Auto-scroll active line to center
  useEffect(() => {
    const el = lineRefs.current[activeIdx];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIdx]);

  if (scriptLines.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontSize: '13px', padding: '40px' }}>
        No script lines yet. Switch to <strong style={{ color: GOLD, margin: '0 4px' }}>Edit</strong> mode to add content.
      </div>
    );
  }

  const kbdStyle = { background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Controls bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSpeechOn(p => !p)}
          disabled={!speechSupported}
          style={{
            padding: '6px 14px', borderRadius: '4px',
            border: `1px solid ${speechOn ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
            background: speechOn ? 'rgba(239,68,68,0.15)' : `${GOLD}18`,
            color: speechOn ? '#ef4444' : GOLD,
            cursor: speechSupported ? 'pointer' : 'not-allowed',
            fontSize: '11px', fontWeight: 'bold',
            opacity: speechSupported ? 1 : 0.4,
          }}
        >
          {speechOn ? '⏹ Stop Voice Sync' : '🎤 Voice Sync'}
        </button>
        <button onClick={() => setActiveIdx(0)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', cursor: 'pointer', fontSize: '11px' }}>↻ Reset</button>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setActiveIdx(p => Math.max(p - 1, 0))} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', cursor: 'pointer', fontSize: '11px' }}>▲ Prev</button>
          <button onClick={() => setActiveIdx(p => Math.min(p + 1, scriptLines.length - 1))} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', cursor: 'pointer', fontSize: '11px' }}>▼ Next</button>
        </div>
        <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: 'auto' }}>
          Line {activeIdx + 1} / {scriptLines.length}
          {!speechSupported && <span style={{ color: '#ef4444', marginLeft: '8px' }}>(voice sync not supported in this browser)</span>}
          {speechOn && interimText && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>🎤 "{interimText.slice(0, 40)}…"</span>}
        </span>
      </div>

      {/* Keyboard hint */}
      <div style={{ marginBottom: '8px', color: '#4a5568', fontSize: '10px', flexShrink: 0 }}>
        ⌨️ <kbd style={kbdStyle}>↓</kbd>/<kbd style={kbdStyle}>Space</kbd> next · <kbd style={kbdStyle}>↑</kbd> prev · click line to jump · <kbd style={kbdStyle}>R</kbd> reset
      </div>

      {/* Script display with active-line highlighting */}
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px' }}>
        {elements.map((el) => {
          if (el.type === 'cue_block') {
            return <CueBlockView key={el.id} element={el} />;
          }
          const scriptIdx = scriptLines.indexOf(el);
          const isActive = scriptIdx === activeIdx;
          const isPast = scriptIdx < activeIdx;
          return (
            <div
              key={el.id}
              ref={r => { if (r) lineRefs.current[scriptIdx] = r; }}
              onClick={() => setActiveIdx(scriptIdx)}
              style={{
                padding: '10px 14px',
                marginBottom: '4px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: isActive ? 'rgba(250,204,21,0.18)' : 'transparent',
                borderLeft: isActive ? '4px solid #facc15' : '4px solid transparent',
                color: isActive ? '#fef3c7' : isPast ? `${color}99` : color,
                fontSize: isActive ? `${fontSize + 2}px` : `${fontSize}px`,
                fontWeight: isActive ? 'bold' : 'normal',
                opacity: isPast ? 0.5 : 1,
                lineHeight: 1.7,
                fontFamily: 'Georgia, serif',
                whiteSpace: 'pre-wrap',
              }}
            >
              {el.content}
            </div>
          );
        })}
        {/* Bottom spacer so last line can scroll to center */}
        <div style={{ height: '200px' }} />
      </div>
    </div>
  );
}