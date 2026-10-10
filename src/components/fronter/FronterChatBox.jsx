/**
 * FronterChatBox.jsx — Floating, draggable, minimizable chat box.
 * Fronters chat with Chris (the super admin). Minimizes to a bar.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

export default function FronterChatBox({ username, role = 'fronter', adminUsername = 'chris' }) {
  const [minimized, setMinimized] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 500 });
  const [unread, setUnread] = useState(0);
  const dragRef = useRef(null);
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.FronterChatMessage.list('-created_date', 100);
      const sorted = (all || []).reverse();
      setMessages(sorted);
      // Count unread
      if (sorted.length > lastCountRef.current) {
        const newOnes = sorted.slice(lastCountRef.current);
        const unreadNew = newOnes.filter(m =>
          m.senderUsername !== username &&
          ((role === 'fronter' && !m.readByFronter) || (role === 'admin' && !m.readByAdmin))
        ).length;
        if (unreadNew > 0) setUnread(u => u + unreadNew);
      }
      lastCountRef.current = sorted.length;
    } catch {}
  }, [username, role]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Mark as read when opened
  useEffect(() => {
    if (!minimized) {
      setUnread(0);
      const markRead = async () => {
        try {
          const unread = messages.filter(m =>
            m.senderUsername !== username &&
            ((role === 'fronter' && !m.readByFronter) || (role === 'admin' && !m.readByAdmin))
          );
          for (const m of unread) {
            const updates = role === 'fronter' ? { readByFronter: true } : { readByAdmin: true };
            await base44.entities.FronterChatMessage.update(m.id, updates);
          }
        } catch {}
      };
      markRead();
    }
  }, [minimized]); // eslint-disable-line

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const send = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    try {
      await base44.entities.FronterChatMessage.create({
        senderUsername: username,
        senderRole: role,
        message: msg,
        recipientUsername: role === 'fronter' ? adminUsername : '',
        readByFronter: role === 'fronter',
        readByAdmin: role === 'admin',
      });
      load();
    } catch {}
  };

  const fmtTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  // Minimized bar
  if (minimized) {
    return (
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 280, zIndex: 10002 }}>
        <div
          onMouseDown={onDragStart}
          style={{ background: 'linear-gradient(135deg, #0d1b2a, #102530)', border: `1px solid ${GOLD}44`, borderRadius: '8px', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>💬</span>
            <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>CHAT WITH {role === 'fronter' ? 'ADMIN' : 'FRONTERS'}</span>
            {unread > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>{unread}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setMinimized(false); }} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Open</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 320, height: 460, background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 10002, display: 'flex', flexDirection: 'column' }}>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(16,185,129,0.06), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>💬</span>
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>CHAT WITH {role === 'fronter' ? 'ADMIN' : 'FRONTERS'}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setMinimized(true); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px' }}>—</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No messages yet. Say hi! 👋</div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderUsername === username;
            return (
              <div key={m.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!isMe && <span style={{ color: m.senderRole === 'admin' ? GOLD : BLUE, fontSize: '9px', fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>{m.senderUsername}</span>}
                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: '10px', background: isMe ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isMe ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}`, color: '#e8e0d0', fontSize: '13px', lineHeight: 1.4, fontFamily: 'Georgia, serif' }}>
                  {m.message}
                </div>
                <span style={{ color: '#4a5568', fontSize: '9px', marginTop: '3px' }}>{fmtTime(m.created_date)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif' }}
        />
        <button onClick={send} disabled={!input.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '0 16px', cursor: !input.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: input.trim() ? 1 : 0.5 }}>Send</button>
      </div>
    </div>
  );
}