/**
 * Public Debt Call Coach Gmail welcome page.
 * Recreates the existing SoloPulse audio/photo and Google appointment calendar.
 * Personalized send tracking uses only the opaque Gmail EmailMessage token.
 * No AI assistant, qualification session, or Protoface-token generation.
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Play, Pause, CalendarDays, ExternalLink, Headphones, ShieldCheck } from 'lucide-react';

const AUDIO = 'https://media.base44.com/files/public/user_698c0a03e173fb21bfe27203/4bc8d43a8_Recording0025.mp3';
const IMAGE = 'https://media.base44.com/images/public/6ad190ed13c97cfb279c4aaf/6dc1b806b_Gemini_Generated_Image_s4jw3gs4jw3gs4jw.jpeg';
const CALENDAR = 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2-pm-4DGAK3fbv_ESQ_GV1hj1cPDUnaYord46WIejKIh_5mWbfdiV5azx_vxkxyX_JesOFrsvR';
const COMPANY_WEBSITE = 'https://www.debtadvisorsofamerica.com/';
const GREEN = '#34d399';
const GOLD = '#d9b877';
const fmt = (n) => { const t = Math.max(0, Math.floor(Number(n) || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

const newSession = () => {
  try {
    const found = sessionStorage.getItem('rosie_welcome_session');
    if (found && /^[A-Za-z0-9_-]{12,80}$/.test(found)) return found;
    const value = 's_' + [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('rosie_welcome_session', value);
    return value;
  } catch { return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }
};

export default function DebtWelcomeExperience() {
  const token = new URLSearchParams(window.location.search).get('m') || '';
  const hasToken = /^m_[A-Za-z0-9_-]{24}$/.test(token);
  const player = useRef(null);
  const session = useRef(newSession());
  const progress = useRef({ lastPosition: 0, played: 0, maxPosition: 0, reportedAt: 0 });
  const [ready, setReady] = useState(!token);
  const [invalid, setInvalid] = useState(!!token && !hasToken);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const submit = (event) => {
    if (!hasToken) return;
    base44.functions.invoke('sendDebtEmail', {
      action: 'welcomeEngagement', token, event, sessionId: session.current,
      playedSeconds: Math.round(progress.current.played * 10) / 10,
      durationSeconds: Number.isFinite(player.current?.duration) ? player.current.duration : duration,
      maxPositionSeconds: progress.current.maxPosition,
    }).catch(() => {});
  };

  useEffect(() => {
    if (!hasToken) return;
    let active = true;
    base44.functions.invoke('sendDebtEmail', { action: 'welcomeEngagement', token, event: 'config' })
      .then((result) => {
        if (!active) return;
        if (!result.data?.ok) { setInvalid(true); return; }
        setReady(true);
        base44.functions.invoke('sendDebtEmail', { action: 'welcomeEngagement', token, event: 'page_view', sessionId: session.current }).catch(() => {});
      })
      .catch(() => { if (active) setInvalid(true); });
    return () => { active = false; };
  }, [token, hasToken]);

  const onProgress = (e) => {
    const el = e.currentTarget;
    const p = progress.current;
    const current = el.currentTime;
    const delta = current - p.lastPosition;
    // Accumulate actual forward playback; seeking ahead never credits unheard time.
    if (!el.paused && delta > 0 && delta <= 1.7) p.played = Math.min(el.duration || 3600, p.played + delta);
    p.lastPosition = current;
    p.maxPosition = Math.max(p.maxPosition, current);
    setPosition(current);
    if (p.played - p.reportedAt >= 7) {
      p.reportedAt = p.played;
      submit('progress');
    }
  };

  const toggle = () => {
    if (!player.current) return;
    if (player.current.paused) player.current.play().catch(() => {});
    else player.current.pause();
  };

  const showCalendar = () => {
    if (!calendarOpen) { setCalendarOpen(true); submit('calendar_open'); }
    setTimeout(() => document.getElementById('booking-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  if (invalid) return <div style={{ minHeight: '100vh', background: '#07101a', color: '#e8e4db', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
    <div><h1>That invitation link is unavailable.</h1><p>Please open the original message or request a new link.</p></div>
  </div>;
  if (!ready) return <div style={{ minHeight: '100vh', background: '#07101a', color: '#d9b877', display: 'grid', placeItems: 'center' }}>Opening your personal message…</div>;

  return <main className="rosie-welcome" style={{ minHeight: '100vh', padding: 'clamp(18px,4vw,48px) 16px 80px', background: 'radial-gradient(ellipse at 50% -10%,#163831 0%,#0c1a28 48%,#060b13 100%)', color: '#f1f4f0', fontFamily: 'system-ui, sans-serif' }}>
    <style>{`
      @keyframes rw-appear {from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
      @keyframes rw-pulse {0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.27)}50%{box-shadow:0 0 0 15px rgba(52,211,153,0)}}
      .rosie-welcome .rw-reveal{animation:rw-appear .55s both}
      .rosie-welcome .rw-play{transition:transform .18s}
      .rosie-welcome .rw-play:hover{transform:scale(1.06)}
      .rosie-welcome .rw-pulse{animation:rw-pulse 2.5s ease-in-out infinite}
      .rosie-welcome .rw-focus:focus-visible{outline:3px solid #34d399;outline-offset:3px}
      @media(prefers-reduced-motion:reduce){.rosie-welcome *{animation:none!important;scroll-behavior:auto!important}}
    `}</style>
    <div style={{ maxWidth: 830, margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: 20 }} className="rw-reveal">
        <div style={{ fontWeight: 760, color: GOLD, letterSpacing: 3, fontSize: 10 }}>A MORE PERSONAL APPROACH</div>
        <h1 style={{ font: 'normal clamp(30px,5vw,43px)/1.13 Georgia,serif', margin: '10px 0 8px' }}>A personal message, just for you.</h1>
        <p style={{ fontSize: 13, color: '#abc0bb', margin: 0 }}>Listen at your own pace, then choose a convenient time to talk.</p>
      </header>
      <section className="rw-reveal" style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid #395e51', position: 'relative', background: '#0a131a', boxShadow: '0 22px 70px rgba(0,0,0,.35)' }}>
        <img src={IMAGE} alt="Personal welcome message from a debt relief specialist" style={{ width: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 22%,rgba(3,7,12,.78) 100%)', pointerEvents: 'none' }} />
        <audio ref={player} src={AUDIO} preload="metadata"
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          onTimeUpdate={onProgress}
          onSeeking={e => { progress.current.lastPosition = e.currentTarget.currentTime; }}
          onPlay={e => { setPlaying(true); setStarted(true); progress.current.lastPosition = e.currentTarget.currentTime; submit('play'); }}
          onPause={() => { setPlaying(false); submit('pause'); }}
          onEnded={() => { setPlaying(false); submit('ended'); }}
        />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <button type="button" onClick={toggle} aria-label={playing ? 'Pause message' : 'Listen to personal message'} className={'rw-play rw-focus ' + (!started ? 'rw-pulse' : '')}
              style={{ pointerEvents: 'auto', border: '1px solid #d1fbea', borderRadius: '50%', background: GREEN, color: '#022b20', width: 76, height: 76, display: 'inline-grid', placeItems: 'center', cursor: 'pointer' }}>
              {playing ? <Pause size={31} fill="currentColor" /> : <Play size={31} fill="currentColor" style={{ marginLeft: 4 }} />}
            </button>
            {!started && <div style={{ marginTop: 16, textShadow: '0 3px 9px #000', fontSize: 12, fontWeight: 750, letterSpacing: 1.5 }}>TAP TO LISTEN</div>}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 17, left: 18, right: 18, display: 'flex', gap: 11, alignItems: 'center' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmt(position)}</span>
          <input type="range" aria-label="Audio playback position" min="0" max={duration || 1} step=".1" value={Math.min(position, duration || 1)}
            onChange={e => { if (!player.current) return; player.current.currentTime = Number(e.target.value); progress.current.lastPosition = Number(e.target.value); }}
            style={{ minWidth: 0, flex: 1, accentColor: GREEN, cursor: 'pointer' }}/>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#b6ccc6' }}>{fmt(duration)}</span>
        </div>
      </section>
      <section className="rw-reveal" aria-label="About Debt Advisors of America" style={{ animationDelay: '.11s', marginTop: 17, display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', border: '1px solid #436a61', borderRadius: 16, background: 'linear-gradient(115deg,#17352f,#13242d)', padding: '20px clamp(18px,4vw,30px)' }}>
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ fontSize: 10, letterSpacing: 1.7, fontWeight: 750, color: GOLD, marginBottom: 7 }}>GET TO KNOW THE COMPANY</div>
          <h2 style={{ font: 'normal 22px Georgia,serif', margin: '0 0 7px' }}>Debt Advisors of America</h2>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#b8c8c5', margin: 0 }}>Visit our official website to learn about the company, our approach, and available debt relief options.</p>
        </div>
        <a className="rw-focus" href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer" onClick={() => submit('website_click')}
          style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '13px 19px', borderRadius: 9, background: GREEN, border: '1px solid #c8f7e5', color: '#09291e', fontSize: 13, fontWeight: 780, textDecoration: 'none' }}>
          Visit Our Company Website <ExternalLink size={17}/>
        </a>
        <div style={{ width: '100%', color: '#9bbab2', fontSize: 11, marginTop: -5 }}>www.debtadvisorsofamerica.com · Opens in a new tab</div>
      </section>
      <section className="rw-reveal" style={{ animationDelay: '.15s', marginTop: 17, border: '1px solid #3a4a56', borderRadius: 16, background: 'linear-gradient(115deg,#13232d,#0f2a27)', padding: '24px clamp(18px,4vw,30px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, color: GOLD }}><CalendarDays size={22}/><span style={{ fontSize: 11, fontWeight: 750, letterSpacing: 1.7 }}>YOUR NEXT STEP</span></div>
        <h2 style={{ font: 'normal 28px Georgia,serif', margin: '12px 0 9px' }}>Let's have a real conversation.</h2>
        <p style={{ color: '#b8c8c5', lineHeight: 1.7, margin: '0 0 18px', fontSize: 14 }}>Schedule a personal consultation to discuss your options. Choose a time directly on the calendar below.</p>
        <button type="button" className="rw-focus" onClick={showCalendar} style={{ background: GOLD, border: '1px solid #e7ca8e', color: '#1e251e', padding: '12px 20px', borderRadius: 9, fontWeight: 750, cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <CalendarDays size={16}/>{calendarOpen ? 'Calendar ready below' : 'View available appointments'}
        </button>
      </section>
      {calendarOpen && <section id="booking-calendar" className="rw-reveal" style={{ marginTop: 18, borderRadius: 16, overflow: 'hidden', border: '1px solid #35514c', background: 'white' }}>
        <iframe title="Google appointment booking calendar" src={CALENDAR} loading="lazy" style={{ display: 'block', width: '100%', height: 660, border: 0 }} />
        <div style={{ textAlign: 'center', padding: 12, background: '#112126' }}>
          <a href={CALENDAR} target="_blank" rel="noopener noreferrer" onClick={() => submit('calendar_external')} style={{ color: '#a3edc9', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            Open the calendar in a new window <ExternalLink size={14}/>
          </a>
        </div>
      </section>}
      <footer style={{ textAlign: 'center', marginTop: 28, color: '#8a9e9b', fontSize: 11, lineHeight: 1.6 }}>
        <Headphones size={15} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
        Play progress helps us understand whether this message was useful. Calendar opens are tracked, not confirmed bookings.
        <div style={{ marginTop: 9 }}><ShieldCheck size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }} />No AI conversation is started on this page.</div>
      </footer>
    </div>
  </main>;
}
