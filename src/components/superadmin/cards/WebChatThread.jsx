/**
 * WebChatThread.jsx — one homepage visitor's conversation in the command center:
 * the transcript (visitor, bot and specialist), what the bot has collected, and the
 * human takeover controls.
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, btn, chip, emptyStyle, fmtTime, inputStyle } from '@/components/superadmin/kit';

const POLL_MS = 4000;

const bubble = (role) => {
  if (role === 'visitor') return { background: 'rgba(56,189,248,0.14)', color: '#dbeafe', label: 'Visitor', align: 'flex-end' };
  if (role === 'specialist') return { background: 'rgba(16,185,129,0.16)', color: '#d1fae5', label: 'Specialist', align: 'flex-start' };
  return { background: 'rgba(255,255,255,0.05)', color: C.ink, label: 'Bot', align: 'flex-start' };
};

export default function WebChatThread({ session, adminUserId, adminToken, onChanged }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const endRef = useRef(null);

  const invoke = async (payload) => {
    const res = await base44.functions.invoke('homeQualifyChat', { ...payload, adminUserId, adminToken });
    return res?.data || {};
  };

  const load = async () => {
    try {
      const data = await invoke({ action: 'admin_transcript', sessionToken: session.sessionToken });
      if (!data.error) setMessages(data.messages || []);
    } catch {
      /* the next tick retries */
    }
  };

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setNote('');
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [session.sessionToken]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const act = async (action, text) => {
    setBusy(true);
    setNote('');
    try {
      const data = await invoke({ action, text });
      if (data.error) {
        setNote(data.error);
      } else {
        setDraft('');
        onChanged?.();
        await load();
      }
    } catch {
      setNote('That did not go through — try again.');
    } finally {
      setBusy(false);
    }
  };

  const human = session.status === 'human';
  const facts = [
    session.firstName && `Name: ${session.firstName}`,
    session.state && `State: ${session.state}`,
    session.debtTier && `Debt: ${session.debtTier}`,
  ].filter(Boolean);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        {facts.map((fact) => <span key={fact} style={chip(C.coach)}>{fact}</span>)}
        <span style={chip(human ? C.fronter : C.purple)}>{human ? 'You are in this chat' : 'Bot answering'}</span>
        {human && session.takenOverBy && (
          <span style={{ color: C.dim, fontSize: '10px' }}>taken over by {session.takenOverBy}</span>
        )}
        <div style={{ flex: 1 }} />
        {human ? (
          <>
            <button type="button" onClick={() => act('handback')} disabled={busy} style={btn(C.warn)}>Hand back to bot</button>
            <button type="button" onClick={() => act('close')} disabled={busy} style={btn(C.danger)}>End chat</button>
          </>
        ) : (
          <button type="button" onClick={() => act('takeover')} disabled={busy} style={btn(C.fronter)}>✋ Human takeover</button>
        )}
      </div>

      <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
        {messages.length === 0 && <div style={emptyStyle}>No messages on this chat yet.</div>}
        {messages.map((message) => {
          const style = bubble(message.role);
          return (
            <div key={message.id} style={{ display: 'flex', justifyContent: style.align }}>
              <div style={{ maxWidth: '86%' }}>
                <div style={{ color: C.dim, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
                  {message.role === 'specialist' ? (message.authorName || 'Specialist') : style.label}
                </div>
                <div style={{ background: style.background, color: style.color, borderRadius: '8px', padding: '7px 10px', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {message.text}
                </div>
                <div style={{ color: C.dim, fontSize: '9px', marginTop: '2px' }}>{fmtTime(message.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (text && human && !busy) act('agent_reply', text);
        }}
        style={{ display: 'flex', gap: '6px', marginTop: '10px' }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!human || busy}
          placeholder={human ? `Type to ${session.firstName || 'the visitor'} as a specialist` : 'Take over the chat to type'}
          style={inputStyle}
        />
        <button type="submit" disabled={!human || busy || !draft.trim()} style={btn(C.fronter)}>Send</button>
      </form>
      {note && <div style={{ color: C.warn, fontSize: '11px', marginTop: '6px' }}>{note}</div>}
    </div>
  );
}