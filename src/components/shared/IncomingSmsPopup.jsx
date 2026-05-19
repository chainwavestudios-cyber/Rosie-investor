import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import SmsTab from '@/components/shared/SmsTab';

const GOLD = '#b8933a';

function fmtPhone(p) {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return p || '';
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Confetti burst
function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999;';
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const pieces = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    r: Math.random() * 8 + 4,
    color: ['#b8933a','#4ade80','#60a5fa','#a78bfa','#f59e0b','#ef4444'][Math.floor(Math.random()*6)],
    vx: (Math.random() - 0.5) * 6,
    vy: Math.random() * 4 + 2,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));
  let frame = 0;
  const anim = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rot += p.rotV;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / 120);
      if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      }
      ctx.restore();
    });
    frame++;
    if (frame < 150) requestAnimationFrame(anim);
    else document.body.removeChild(canvas);
  };
  requestAnimationFrame(anim);
}

// Ding sound
function playDing() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.frequency.setValueAtTime(880, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.5);
  } catch {}
}

export default function IncomingSmsPopup({ onOpenConversations }) {
  const [messages, setMessages] = useState([]);
  const [minimized, setMinimized] = useState(false);
  const [closed, setClosed] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [pos, setPos] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 520 });
  const [size, setSize] = useState({ w: 400, h: 480 });
  const lastCountRef = useRef(0);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragStart = useRef({});
  const resStart = useRef({});
  const pollRef = useRef(null);

  const loadUnread = useCallback(async () => {
    try {
      const msgs = await base44.entities.SmsMessage.filter({ direction: 'inbound', read: false });
      const sorted = (msgs || []).sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
      const newCount = sorted.length;
      if (newCount > lastCountRef.current && newCount > 0) {
        playDing();
        triggerConfetti();
        setClosed(false);
        setMinimized(false);
      }
      lastCountRef.current = newCount;
      setMessages(sorted);
    } catch {}
  }, []);

  useEffect(() => {
    loadUnread();
    pollRef.current = setInterval(loadUnread, 30000);
    return () => clearInterval(pollRef.current);
  }, [loadUnread]);

  // Drag & resize
  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 200, dragStart.current.px + e.clientX - dragStart.current.mx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.py + e.clientY - dragStart.current.my)),
        });
      }
      if (resizing.current) {
        setSize({
          w: Math.max(300, resStart.current.w + e.clientX - resStart.current.mx),
          h: Math.max(250, resStart.current.h + e.clientY - resStart.current.my),
        });
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Don't show if no unread messages and not showing a thread
  if (closed) return null;
  if (messages.length === 0 && !selectedPhone) return null;

  const selectedMsg = messages.find(m => {
    const norm = (m.fromNumber || '').replace(/\D/g,'').slice(-10);
    return norm === (selectedPhone || '').replace(/\D/g,'').slice(-10);
  });

  // Group by phone
  const byPhone = {};
  messages.forEach(m => {
    const norm = (m.fromNumber || '').replace(/\D/g,'').slice(-10);
    if (!byPhone[norm]) byPhone[norm] = { phone: norm, rawPhone: m.fromNumber, name: m.contactName || '', messages: [], leadId: m.leadId, investorId: m.investorId };
    byPhone[norm].messages.push(m);
    if (m.contactName && !byPhone[norm].name) byPhone[norm].name = m.contactName;
  });
  const convos = Object.values(byPhone);

  return (
    <div style={{
      position: 'fixed',
      left: pos.x, top: pos.y,
      width: minimized ? '280px' : size.w,
      height: minimized ? '44px' : size.h,
      zIndex: 88888,
      background: '#080d18',
      border: '1px solid rgba(74,222,128,0.4)',
      borderRadius: '10px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.8), 0 0 20px rgba(74,222,128,0.15)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Georgia, serif',
      transition: 'height 0.2s ease, width 0.2s ease',
    }}>

      {/* Header (drag handle) */}
      <div
        onMouseDown={e => {
          if (e.target.closest('button')) return;
          dragging.current = true;
          dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
          e.preventDefault();
        }}
        style={{ padding: '10px 14px', background: 'rgba(74,222,128,0.08)', borderBottom: minimized ? 'none' : '1px solid rgba(74,222,128,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px' }}>💬</span>
          <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>
            Incoming SMS
          </span>
          {messages.length > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '9px', fontWeight: 'bold', animation: 'smsPulse 1s ease-in-out infinite' }}>
              {messages.length} unread
            </span>
          )}
        </div>
        <style>{`@keyframes smsPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
        <div style={{ display: 'flex', gap: '4px' }}>
          {onOpenConversations && (
            <button onClick={onOpenConversations}
              title="Open full SMS tab"
              style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '9px' }}>
              ↗ Full
            </button>
          )}
          <button onClick={() => setMinimized(v => !v)}
            style={{ background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}>
            {minimized ? '▲' : '▼'}
          </button>
          <button onClick={() => setClosed(true)}
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '13px' }}>
            ×
          </button>
        </div>
      </div>

      {!minimized && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: contact list */}
          <div style={{ width: '140px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto' }}>
            {convos.map(c => {
              const isSelected = (selectedPhone || '').replace(/\D/g,'').slice(-10) === c.phone;
              return (
                <div key={c.phone}
                  onClick={() => setSelectedPhone(c.phone)}
                  style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(74,222,128,0.1)' : 'transparent', borderLeft: isSelected ? '2px solid #4ade80' : '2px solid transparent' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name || fmtPhone(c.rawPhone)}
                  </div>
                  {c.name && <div style={{ color: '#4a5568', fontSize: '9px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtPhone(c.rawPhone)}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: '8px', padding: '1px 5px', fontSize: '9px', fontWeight: 'bold' }}>{c.messages.length} new</span>
                    <span style={{ color: '#4a5568', fontSize: '8px' }}>{fmtTime(c.messages[0]?.sentAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: thread */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedPhone ? (
              (() => {
                const c = byPhone[(selectedPhone || '').replace(/\D/g,'').slice(-10)];
                if (!c) return null;
                return (
                  <SmsTab
                    toPhone={c.rawPhone}
                    toName={c.name || ''}
                    leadId={c.leadId || null}
                    investorId={c.investorId || null}
                    sentBy="admin"
                  />
                );
              })()
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontSize: '11px', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '28px' }}>←</div>
                Select a contact
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!minimized && (
        <div
          onMouseDown={e => {
            resizing.current = true;
            resStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };
            e.preventDefault(); e.stopPropagation();
          }}
          style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', cursor: 'se-resize', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '3px' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 9L9 2M5 9L9 5" stroke="rgba(74,222,128,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}