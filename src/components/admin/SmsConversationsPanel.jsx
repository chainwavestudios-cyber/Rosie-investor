import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import SmsTab from '@/components/shared/SmsTab';

const GOLD = '#b8933a';
const OUR_NUMBER = '+13232080505';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtPhone(p) {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  }
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return p || '';
}

// Group messages by contact phone
function buildConversations(messages) {
  const map = {};
  messages.forEach(msg => {
    const phone = msg.direction === 'inbound' ? msg.fromNumber : msg.toNumber;
    if (!phone) return;
    const norm = phone.replace(/\D/g, '').slice(-10);
    if (!map[norm]) {
      map[norm] = {
        phone: norm,
        rawPhone: phone,
        contactName: msg.contactName || '',
        leadId: msg.leadId || null,
        investorId: msg.investorId || null,
        messages: [],
        unreadCount: 0,
      };
    }
    map[norm].messages.push(msg);
    if (msg.direction === 'inbound' && !msg.read) map[norm].unreadCount++;
    // Use latest contactName
    if (msg.contactName && !map[norm].contactName) map[norm].contactName = msg.contactName;
    if (msg.leadId && !map[norm].leadId) map[norm].leadId = msg.leadId;
    if (msg.investorId && !map[norm].investorId) map[norm].investorId = msg.investorId;
  });
  // Sort each convo by date, then return convos sorted by latest message
  return Object.values(map).map(c => {
    c.messages.sort((a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0));
    c.lastMessage = c.messages[c.messages.length - 1];
    return c;
  }).sort((a, b) => new Date(b.lastMessage?.sentAt || 0) - new Date(a.lastMessage?.sentAt || 0));
}

export default function SmsConversationsPanel({ initialPhone = null }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | unread | inbound | outbound
  const [selectedPhone, setSelectedPhone] = useState(initialPhone);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const msgs = await base44.entities.SmsMessage.list('- sentAt', 500);
      setMessages(msgs || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 30000) // Was 6s — caused rate limits;
    return () => clearInterval(pollRef.current);
  }, [load]);

  // Auto-select initialPhone when it arrives
  useEffect(() => {
    if (initialPhone) setSelectedPhone(initialPhone);
  }, [initialPhone]);

  const conversations = buildConversations(messages);

  const filtered = conversations.filter(c => {
    if (filter === 'unread' && c.unreadCount === 0) return false;
    if (filter === 'inbound' && !c.messages.some(m => m.direction === 'inbound')) return false;
    if (filter === 'outbound' && !c.messages.some(m => m.direction === 'outbound')) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.contactName || '').toLowerCase().includes(q) || c.phone.includes(q) || c.rawPhone.includes(q);
    }
    return true;
  });

  const selectedConvo = selectedPhone
    ? conversations.find(c => c.phone === selectedPhone.replace(/\D/g,'').slice(-10))
    : null;

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#0a0f1e', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* ── Left sidebar: conversation list ── */}
      <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', background: '#080d18' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>💬 SMS Conversations</span>
            {totalUnread > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>{totalUnread}</span>
            )}
          </div>
          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or number…"
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '7px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
          />
          {/* Filters */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            {[['all','All'],['unread','Unread'],['inbound','In'],['outbound','Out']].map(([id,label]) => (
              <button key={id} onClick={() => setFilter(id)}
                style={{ flex:1, background: filter===id ? `${GOLD}22` : 'rgba(255,255,255,0.04)', color: filter===id ? GOLD : '#6b7280', border: `1px solid ${filter===id ? GOLD+'55' : 'rgba(255,255,255,0.08)'}`, borderRadius: '4px', padding: '4px 0', cursor: 'pointer', fontSize: '9px', fontWeight: filter===id ? 'bold' : 'normal', letterSpacing: '0.5px' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* From number */}
        <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(184,147,58,0.05)' }}>
          <span style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '1px' }}>FROM: </span>
          <span style={{ color: GOLD, fontSize: '10px', fontFamily: 'monospace' }}>{OUR_NUMBER}</span>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ color: '#4a5568', textAlign: 'center', padding: '32px', fontSize: '12px' }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ color: '#374151', textAlign: 'center', padding: '40px 20px', fontSize: '12px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
              No conversations yet
            </div>
          )}
          {filtered.map(c => {
            const isSelected = selectedPhone && c.phone === selectedPhone.replace(/\D/g,'').slice(-10);
            const last = c.lastMessage;
            const preview = (last?.body || '').slice(0, 60) || (last?.mediaUrls ? '📎 Media' : '');
            const isInbound = last?.direction === 'inbound';
            return (
              <div key={c.phone}
                onClick={() => setSelectedPhone(c.phone)}
                style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(184,147,58,0.1)' : 'transparent', borderLeft: isSelected ? `3px solid ${GOLD}` : '3px solid transparent', transition: 'all 0.15s', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>

                {/* Avatar */}
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: c.unreadCount > 0 ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)', border: `2px solid ${c.unreadCount > 0 ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px', fontWeight: 'bold', color: c.unreadCount > 0 ? '#4ade80' : '#6b7280' }}>
                  {c.contactName ? c.contactName[0].toUpperCase() : '#'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ color: c.unreadCount > 0 ? '#e8e0d0' : '#8a9ab8', fontSize: '12px', fontWeight: c.unreadCount > 0 ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.contactName || fmtPhone(c.rawPhone)}
                      </span>
                      {c.unreadCount > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: '8px', padding: '1px 5px', fontSize: '9px', fontWeight: 'bold', flexShrink: 0 }}>{c.unreadCount}</span>
                      )}
                    </div>
                    <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0 }}>{fmtTime(last?.sentAt)}</span>
                  </div>
                  {c.contactName && (
                    <div style={{ color: '#4a5568', fontSize: '10px', fontFamily: 'monospace', marginBottom: '3px' }}>{fmtPhone(c.rawPhone)}</div>
                  )}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {!isInbound && <span style={{ color: '#4a5568', fontSize: '10px' }}>↗</span>}
                    {isInbound && <span style={{ color: '#4ade80', fontSize: '10px' }}>↙</span>}
                    <span style={{ color: c.unreadCount > 0 ? '#c4cdd8' : '#4a5568', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preview || '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: message thread ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedConvo ? (
          <>
            {/* Thread header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(184,147,58,0.15)', border: '2px solid rgba(184,147,58,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', color: GOLD, flexShrink: 0 }}>
                {selectedConvo.contactName ? selectedConvo.contactName[0].toUpperCase() : '#'}
              </div>
              <div>
                <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>
                  {selectedConvo.contactName || fmtPhone(selectedConvo.rawPhone)}
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px', fontFamily: 'monospace' }}>
                  {selectedConvo.contactName ? fmtPhone(selectedConvo.rawPhone) : ''}
                </div>
              </div>
            </div>
            {/* SmsTab handles the thread + compose */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <SmsTab
                toPhone={selectedConvo.rawPhone}
                toName={selectedConvo.contactName || ''}
                leadId={selectedConvo.leadId}
                investorId={selectedConvo.investorId}
                sentBy="admin"
              />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '56px' }}>💬</div>
            <div style={{ color: '#4a5568', fontSize: '15px' }}>Select a conversation</div>
            <div style={{ color: '#374151', fontSize: '12px' }}>or wait for an incoming message</div>
          </div>
        )}
      </div>
    </div>
  );
}