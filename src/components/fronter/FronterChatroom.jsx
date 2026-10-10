/**
 * FronterChatroom.jsx — Floating, draggable, resizable chatroom popup for fronters.
 * Shows a group chat room where all fronters can chat together.
 * Displays who is currently in the room (active fronters).
 * AI-generated motivational quotes from "Chris" appear here twice daily.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const CHATROOM_RECIPIENT = '__chatroom__';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };

export default function FronterChatroom({ username, role = 'fronter', onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [members, setMembers] = useState([]);
  const [pos, setPos] = useState({ x: 200, y: 80 });
  const [size, setSize] = useState({ w: 520, h: 560 });
  const [unread, setUnread] = useState(0);
  const [showMembers, setShowMembers] = useState(false);
  const dragRef = useRef(null);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.FronterChatMessage.filter(
        { recipientUsername: CHATROOM_RECIPIENT },
        '-created_date', 200
      );
      const sorted = (all || []).reverse();
      setMessages(sorted);

      // Count unread (messages not from me, not read by fronter)
      if (role === 'fronter') {
        const unreadCount = sorted.filter(m => m.senderUsername !== username && !m.readByFronter).length;
        setUnread(unreadCount);
      }

      // Load active members
      const users = await base44.entities.DebtCoachUser.list('-created_date', 500);
      const activeFronters = (users || []).filter(u =>
        (u.role === 'fronter' || u.role === 'super_admin') && u.isActive
      );
      setMembers(activeFronters);
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

  // Mark as read when loaded
  useEffect(() => {
    const markRead = async () => {
      try {
        const unreadMsgs = messages.filter(m =>
          m.senderUsername !== username && !m.readByFronter && role === 'fronter'
        );
        for (const m of unreadMsgs) {
          await base44.entities.FronterChatMessage.update(m.id, { readByFronter: true });
        }
      } catch {}
    };
    if (messages.length > 0) markRead();
  }, [messages.length]); // eslint-disable-line

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
        recipientUsername: CHATROOM_RECIPIENT,
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

  const isQuoteMessage = (m) => {
    return m.senderUsername === 'chris' && m.senderRole === 'admin' && (m.message || '').startsWith('💬 "');
  };

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `1px solid ${PURPLE}44`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 10003, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(167,139,250,0.06), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🗣️</span>
          <span style={{ color: PURPLE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>FRONTERS CHATROOM</span>
          <span style={{ color: '#4a5568', fontSize: '10px' }}>· {members.length} members</span>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setShowMembers(p => !p)} style={{ background: showMembers ? `${PURPLE}30` : `${PURPLE}18`, color: PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>👥 {showMembers ? 'Hide' : 'Members'}</button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '14px' }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Messages area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗣️</div>
                Welcome to the Fronters Chatroom!<br />
                <span style={{ fontSize: '11px' }}>Chat with your fellow fronters. Motivational quotes from Chris appear here twice daily.</span>
              </div>
            ) : (
              messages.map((m, i) => {
                const isMe = m.senderUsername === username;
                const isQuote = isQuoteMessage(m);
                const isAdmin = m.senderRole === 'admin';

                if (isQuote) {
                  return (
                    <div key={m.id || i} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                      <div style={{ maxWidth: '90%', padding: '14px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(16,185,129,0.04))', border: '1px solid rgba(167,139,250,0.25)', textAlign: 'center' }}>
                        <div style={{ color: PURPLE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>✨ Daily Motivation</div>
                        <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.6, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{m.message}</div>
                        <span style={{ color: '#4a5568', fontSize: '9px', marginTop: '4px', display: 'block' }}>{fmtTime(m.created_date)}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && (
                      <span style={{ color: isAdmin ? GOLD : BLUE, fontSize: '9px', fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {isAdmin ? '⭐ ' : ''}{m.senderUsername}
                      </span>
                    )}
                    <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: '10px', background: isMe ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isMe ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}`, color: '#e8e0d0', fontSize: '13px', lineHeight: 1.4, fontFamily: 'Georgia, serif' }}>
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
              placeholder="Message the chatroom..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif' }}
            />
            <button onClick={send} disabled={!input.trim()} style={{ background: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 16px', cursor: !input.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: input.trim() ? 1 : 0.5 }}>Send</button>
          </div>
        </div>

        {/* Members sidebar */}
        {showMembers && (
          <div style={{ width: '180px', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: PURPLE, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>👥 In the Room</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '4px', marginBottom: '3px', background: m.username === username ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
                  <span style={{ color: m.username === username ? GOLD : '#e8e0d0', fontSize: '12px', fontWeight: m.username === username ? 'bold' : 'normal' }}>{m.username}</span>
                  {m.role === 'super_admin' && <span style={{ color: GOLD, fontSize: '8px' }}>⭐</span>}
                </div>
              ))}
              {members.length === 0 && <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '20px 0' }}>No active members</div>}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(400, startW + ev.clientX - startX), h: Math.max(350, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}