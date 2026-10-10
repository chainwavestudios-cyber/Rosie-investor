/**
 * FronterChatBox.jsx — Floating, draggable, minimizable chat box.
 * Fronters have 3 send options: Sr Debt Advisor (private), Broadcast to All, or Fronters Chatroom.
 * Admins can select "All Fronters" (broadcast), a specific fronter, or the Chatroom.
 * Broadcast messages are clearly labeled so fronters know it's a broadcast, not a private message.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const CHATROOM_RECIPIENT = '__chatroom__';

export default function FronterChatBox({ username, role = 'fronter', adminUsername = 'chris', onOpenChatroom }) {
  const [minimized, setMinimized] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pos, setPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 340 : 800, y: typeof window !== 'undefined' ? window.innerHeight - 500 : 200 });
  const [unread, setUnread] = useState(0);
  const [fronters, setFronters] = useState([]);
  const [recipientFilter, setRecipientFilter] = useState(''); // admin: '' = broadcast, 'username' = private, '__chatroom__' = chatroom
  const [sendMode, setSendMode] = useState('admin'); // fronter: 'admin' = Sr Debt Advisor, 'broadcast' = all, 'chatroom' = chatroom, 'private' = specific fronter
  const [privateRecipient, setPrivateRecipient] = useState('');
  const dragRef = useRef(null);
  const scrollRef = useRef(null);
  const frontersLoadedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.FronterChatMessage.list('-created_date', 200);
      let sorted = (all || []).reverse();

      // Load fronter list for admin dropdown (once)
      if (!frontersLoadedRef.current) {
        frontersLoadedRef.current = true;
        try {
          const users = await base44.entities.DebtCoachUser.list('-created_date', 500);
          setFronters((users || []).filter(u => (u.role === 'fronter' || u.role === 'super_admin') && u.isActive && u.username !== username));
        } catch {}
      }

      // Filter messages based on role and mode
      if (role === 'fronter') {
        if (sendMode === 'admin') {
          // Private chat with admin: messages between me and admin (not broadcast, not chatroom)
          sorted = sorted.filter(m =>
            m.recipientUsername !== '' && m.recipientUsername !== CHATROOM_RECIPIENT &&
            (m.senderUsername === adminUsername || (m.senderUsername === username && m.recipientUsername === adminUsername))
          );
        } else if (sendMode === 'broadcast') {
          // Broadcast messages: recipientUsername === '' (broadcast to all)
          sorted = sorted.filter(m => m.recipientUsername === '');
        } else if (sendMode === 'chatroom') {
          sorted = [];
        } else if (sendMode === 'private' && privateRecipient) {
          sorted = sorted.filter(m =>
            m.recipientUsername !== '' && m.recipientUsername !== CHATROOM_RECIPIENT &&
            ((m.senderUsername === privateRecipient && m.recipientUsername === username) ||
             (m.senderUsername === username && m.recipientUsername === privateRecipient))
          );
        }
      } else if (role === 'admin') {
        if (recipientFilter === CHATROOM_RECIPIENT) {
          sorted = sorted.filter(m => m.recipientUsername === CHATROOM_RECIPIENT);
        } else if (recipientFilter) {
          // Private chat with specific fronter
          sorted = sorted.filter(m =>
            m.senderUsername === recipientFilter ||
            (m.senderUsername === username && m.recipientUsername === recipientFilter)
          );
        } else {
          // Broadcast messages (recipientFilter === '')
          sorted = sorted.filter(m => m.recipientUsername === '');
        }
      }

      setMessages(sorted);

      // Count unread from displayed messages (only when minimized)
      if (minimized) {
        const unreadCount = sorted.filter(m =>
          m.senderUsername !== username &&
          ((role === 'fronter' && !m.readByFronter) || (role === 'admin' && !m.readByAdmin))
        ).length;
        setUnread(unreadCount);
      }
    } catch {}
  }, [username, role, recipientFilter, minimized, sendMode, adminUsername, privateRecipient]);

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
      let recipient = '';
      if (role === 'fronter') {
        if (sendMode === 'admin') recipient = adminUsername;
        else if (sendMode === 'broadcast') recipient = '';
        else if (sendMode === 'chatroom') recipient = CHATROOM_RECIPIENT;
        else if (sendMode === 'private') recipient = privateRecipient;
      } else {
        recipient = recipientFilter; // '' = broadcast, 'username' = private, '__chatroom__' = chatroom
      }

      await base44.entities.FronterChatMessage.create({
        senderUsername: username,
        senderRole: role,
        message: msg,
        recipientUsername: recipient,
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

  // Determine header label
  const getHeaderLabel = () => {
    if (role === 'fronter') {
      if (sendMode === 'admin') return 'CHRIS (SR ADVISOR)';
      if (sendMode === 'broadcast') return 'BROADCAST TO ALL';
      if (sendMode === 'chatroom') return 'FRONTERS CHATROOM';
      if (sendMode === 'private') return `PRIVATE: ${privateRecipient.toUpperCase()}`;
    } else {
      if (recipientFilter === CHATROOM_RECIPIENT) return 'FRONTERS CHATROOM';
      if (recipientFilter) return recipientFilter.toUpperCase();
      return 'ALL FRONTERS (BROADCAST)';
    }
  };

  const getHeaderColor = () => {
    if (role === 'fronter') {
      if (sendMode === 'admin') return GOLD;
      if (sendMode === 'broadcast') return AMBER;
      if (sendMode === 'chatroom') return PURPLE;
      if (sendMode === 'private') return BLUE;
    } else {
      if (recipientFilter === CHATROOM_RECIPIENT) return PURPLE;
      if (recipientFilter) return BLUE;
      return AMBER;
    }
    return GOLD;
  };

  // If fronter selects chatroom, open the chatroom popup instead
  useEffect(() => {
    if (role === 'fronter' && sendMode === 'chatroom' && onOpenChatroom) {
      onOpenChatroom();
      setSendMode('admin'); // Reset back to admin after opening
    }
  }, [sendMode]); // eslint-disable-line

  // Minimized bar
  if (minimized) {
    const hdrColor = getHeaderColor();
    return (
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 280, zIndex: 10002 }}>
        <div
          onMouseDown={onDragStart}
          style={{ background: 'linear-gradient(135deg, #0d1b2a, #102530)', border: `1px solid ${hdrColor}44`, borderRadius: '8px', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>💬</span>
            <span style={{ color: hdrColor, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>{getHeaderLabel()}</span>
            {unread > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>{unread}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setMinimized(false); }} style={{ background: `${hdrColor}18`, color: hdrColor, border: `1px solid ${hdrColor}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Open</button>
        </div>
      </div>
    );
  }

  const hdrColor = getHeaderColor();

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 340, height: 480, background: '#0d1b2a', border: `1px solid ${hdrColor}44`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 10002, display: 'flex', flexDirection: 'column' }}>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: `linear-gradient(135deg, ${hdrColor}10, transparent)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>💬</span>
          <span style={{ color: hdrColor, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>{getHeaderLabel()}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setMinimized(true); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px' }}>—</button>
      </div>

      {/* Fronter send mode selector */}
      {role === 'fronter' && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <select
            value={sendMode === 'private' ? `private:${privateRecipient}` : sendMode}
            onChange={e => {
              const val = e.target.value;
              if (val.startsWith('private:')) { setSendMode('private'); setPrivateRecipient(val.replace('private:', '')); }
              else { setSendMode(val); setPrivateRecipient(''); }
            }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' }}
          >
            <option value="admin">⭐ Chris (Sr Debt Advisor)</option>
            <option value="broadcast">📢 Broadcast to All</option>
            <option value="chatroom">🗣️ Fronters Chatroom</option>
            {fronters.length > 0 && (
              <optgroup label="── Private Messages ──">
                {fronters.map(f => <option key={f.id} value={`private:${f.username}`}>💬 {f.username}</option>)}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* Admin recipient selector */}
      {role === 'admin' && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <select value={recipientFilter} onChange={e => setRecipientFilter(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' }}>
            <option value="">📢 All Fronters (Broadcast)</option>
            <option value={CHATROOM_RECIPIENT}>🗣️ Fronters Chatroom</option>
            {fronters.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
          </select>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
            {role === 'fronter' && sendMode === 'admin' ? 'No messages from Sr Debt Advisor yet.' : role === 'fronter' && sendMode === 'broadcast' ? 'No broadcast messages yet.' : role === 'fronter' && sendMode === 'private' ? `No messages with ${privateRecipient} yet.` : 'No messages yet. Say hi! 👋'}
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderUsername === username;
            const isBroadcast = m.recipientUsername === '' && m.senderRole === 'admin';
            const isChatroomMsg = m.recipientUsername === CHATROOM_RECIPIENT;
            return (
              <div key={m.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!isMe && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                    <span style={{ color: m.senderRole === 'admin' ? GOLD : BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{m.senderUsername}</span>
                    {isBroadcast && <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(245,158,11,0.15)', color: AMBER, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>📢 Broadcast</span>}
                    {isChatroomMsg && <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(167,139,250,0.15)', color: PURPLE, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>🗣️ Chatroom</span>}
                  </div>
                )}
                {isMe && isBroadcast && (
                  <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(245,158,11,0.15)', color: AMBER, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px', alignSelf: 'flex-end' }}>📢 Broadcast to All</span>
                )}
                {isMe && isChatroomMsg && (
                  <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(167,139,250,0.15)', color: PURPLE, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px', alignSelf: 'flex-end' }}>🗣️ Chatroom</span>
                )}
                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: '10px', background: isMe ? 'rgba(16,185,129,0.12)' : isBroadcast ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isMe ? 'rgba(16,185,129,0.2)' : isBroadcast ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'}`, color: '#e8e0d0', fontSize: '13px', lineHeight: 1.4, fontFamily: 'Georgia, serif' }}>
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
          placeholder={role === 'fronter' && sendMode === 'admin' ? 'Message Sr Debt Advisor...' : role === 'fronter' && sendMode === 'broadcast' ? 'Broadcast to all fronters...' : role === 'fronter' && sendMode === 'private' ? `Message ${privateRecipient}...` : role === 'admin' && !recipientFilter ? 'Broadcast to all fronters...' : role === 'admin' && recipientFilter === CHATROOM_RECIPIENT ? 'Message the chatroom...' : 'Type a message...'}
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif' }}
        />
        <button onClick={send} disabled={!input.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '0 16px', cursor: !input.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: input.trim() ? 1 : 0.5 }}>Send</button>
      </div>
    </div>
  );
}