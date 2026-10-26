/**
 * EmailActivityTimeline — the Email Activity section every contact card shows.
 *
 * One entry per email sent to this contact: when it went out, the subject and the
 * template it came from, which Gmail account and person sent it, whether Gmail
 * accepted it, and everything that happened afterwards — the open pixel, each
 * link clicked, and the unsubscribe. Replies and bounces appear on each entry as
 * soon as the mailbox is connected with read access.
 *
 * A send that just went out carries an Unsend button for the first few minutes:
 * it pulls the message back out of the sending Gmail account and marks the entry
 * unsent, so a template picked by mistake does not stay on the record.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import moment from 'moment';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const MUTED = '#6b7280';
const TEXT = '#e8e0d0';

// How long after a send the Unsend button is offered.
const UNSEND_WINDOW_MS = 5 * 60 * 1000;

const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' };
const chip = { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', marginRight: '6px', marginTop: '6px' };

const at = (value) => (value ? moment(value).format('MMM D, YYYY · h:mm A') : '');

function statusChip(message) {
  if (message.unsentAt) return { label: '↩ Unsent', color: AMBER };
  if (message.status === 'failed') return { label: '⚠️ Gmail send failed', color: RED };
  if (message.status === 'sending') return { label: '⏳ Sending', color: AMBER };
  return { label: '✓ Sent', color: GOLD };
}

// Milliseconds left in the undo window; 0 or less means it is a delivered email.
function undoMsLeft(message, now) {
  const sentAt = new Date(message.sentAt || message.created_date).getTime();
  if (Number.isNaN(sentAt)) return 0;
  return UNSEND_WINDOW_MS - (now - sentAt);
}

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function linkLabel(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    const label = `${parsed.hostname.replace(/^www\./, '')}${path}`;
    return label.length > 52 ? `${label.slice(0, 52)}…` : label;
  } catch {
    return url;
  }
}

function clicksOf(message) {
  try {
    const parsed = JSON.parse(message.clickedUrlsJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function EmailActivityTimeline({ contactId, title = '📧 Email Activity' }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [now, setNow] = useState(Date.now());
  const [unsending, setUnsending] = useState(null);
  const [unsendError, setUnsendError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!contactId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    base44.entities.EmailMessage.filter({ contactId }, { sort: '-created_date', limit: 100 })
      .then((page) => { if (alive) setMessages(page?.items || []); })
      .catch(() => { if (alive) setMessages([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [contactId]);

  // Live: an open or a click appears here the moment it is recorded.
  useEffect(() => {
    if (!contactId) return undefined;
    return base44.entities.EmailMessage.subscribe((event) => {
      const record = event?.data;
      if (!record || record.contactId !== contactId) return;
      setMessages((prev) => {
        if (event.type === 'delete') return prev.filter((m) => m.id !== record.id);
        return [record, ...prev.filter((m) => m.id !== record.id)];
      });
    });
  }, [contactId]);

  // The undo window is a timer, so it ticks down while any send is still inside it.
  useEffect(() => {
    const open = messages.some((m) => m.status === 'sent' && !m.unsentAt && undoMsLeft(m, Date.now()) > 0);
    if (!open) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [messages]);

  const unsend = async (message) => {
    if (!window.confirm(`Unsend "${message.subject || 'this email'}"?\n\nIt is pulled back out of the sending Gmail account.`)) return;
    setUnsending(message.id);
    setUnsendError('');
    try {
      const res = await base44.functions.invoke('unsendEmail', { messageId: message.id, unsentBy: message.sentBy || '' });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      const unsentAt = data?.unsentAt || new Date().toISOString();
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, unsentAt } : m)));
    } catch (e) {
      setUnsendError(`✗ ${e?.message || String(e)}`);
    }
    setUnsending(null);
  };

  const opened = messages.filter((m) => m.openCount > 0 || m.openedAt).length;
  const clicked = messages.filter((m) => m.clickCount > 0 || m.clickedAt).length;
  const unsubscribed = messages.filter((m) => m.unsubscribedAt).length;
  const unsent = messages.filter((m) => m.unsentAt).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>{title}</div>
        {!loading && messages.length > 0 && (
          <div style={{ color: MUTED, fontSize: '10px' }}>
            {messages.length} sent · {opened} opened · {clicked} clicked{unsent > 0 ? ` · ${unsent} unsent` : ''}{unsubscribed > 0 ? ` · ${unsubscribed} unsubscribed` : ''}
          </div>
        )}
      </div>

      {unsendError && <div style={{ color: RED, fontSize: '11px', marginBottom: '8px' }}>{unsendError}</div>}

      {loading ? (
        <div style={{ color: MUTED, fontSize: '12px', padding: '20px 0', textAlign: 'center' }}>Loading email activity…</div>
      ) : messages.length === 0 ? (
        <div style={{ color: '#4a5568', fontSize: '12px', padding: '24px 0', textAlign: 'center' }}>No emails sent to this contact yet.</div>
      ) : (
        <div>
          {messages.map((message) => {
            const status = statusChip(message);
            const clicks = clicksOf(message);
            const isOpen = Boolean(expanded[message.id]);
            const when = message.sentAt || message.created_date;
            const left = undoMsLeft(message, now);
            const canUnsend = !message.unsentAt && message.status === 'sent' && left > 0;
            return (
              <div key={message.id} style={{ ...panel, opacity: message.unsentAt ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: TEXT, fontSize: '13px', fontWeight: 'bold', wordBreak: 'break-word', textDecoration: message.unsentAt ? 'line-through' : 'none' }}>{message.subject || '(no subject)'}</div>
                    <div style={{ color: MUTED, fontSize: '10px', marginTop: '3px' }}>
                      {at(when)}{message.templateName ? ` · ${message.templateName}` : ''}
                    </div>
                    <div style={{ color: MUTED, fontSize: '10px', marginTop: '2px' }}>
                      From {message.senderEmail || 'the connected Gmail account'}{message.sentBy ? ` · sent by ${message.sentBy}` : ''}
                      {message.source ? ` · ${String(message.source).replace('_', ' ')}` : ''}
                    </div>
                  </div>
                  <span style={{ ...chip, background: `${status.color}22`, color: status.color, marginTop: 0 }}>{status.label}</span>
                </div>

                {message.status === 'failed' && message.error && (
                  <div style={{ color: RED, fontSize: '11px', marginTop: '6px' }}>{message.error}</div>
                )}

                <div>
                  {canUnsend && (
                    <button
                      onClick={() => unsend(message)}
                      disabled={unsending === message.id}
                      title="Pull this email back out of the sending Gmail account"
                      style={{ ...chip, background: `${AMBER}22`, color: AMBER, border: 'none', cursor: unsending === message.id ? 'wait' : 'pointer', opacity: unsending === message.id ? 0.6 : 1 }}
                    >
                      {unsending === message.id ? '⏳ Unsending…' : `↩ Unsend · ${clock(left)}`}
                    </button>
                  )}

                  {message.unsentAt && (
                    <span style={{ ...chip, background: `${AMBER}22`, color: AMBER }}>↩ Pulled back {at(message.unsentAt)}</span>
                  )}

                  {message.openCount > 0 || message.openedAt ? (
                    <span style={{ ...chip, background: `${BLUE}22`, color: BLUE }}>
                      👁 Opened{message.openCount > 1 ? ` ×${message.openCount}` : ''}
                      {message.openedAt ? ` · first ${at(message.openedAt)}` : ''}
                    </span>
                  ) : (
                    <span style={{ ...chip, background: 'rgba(255,255,255,0.05)', color: MUTED }}>👁 Not opened yet</span>
                  )}

                  {clicks.length > 0 && (
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                      style={{ ...chip, background: `${GOLD}22`, color: GOLD, border: 'none', cursor: 'pointer' }}
                    >
                      🔗 {clicks.length} link{clicks.length === 1 ? '' : 's'} clicked {isOpen ? '▲' : '▼'}
                    </button>
                  )}

                  {message.unsubscribedAt && (
                    <span style={{ ...chip, background: `${RED}22`, color: RED }}>🚫 Unsubscribed · {at(message.unsubscribedAt)}</span>
                  )}
                  {message.repliedAt && (
                    <span style={{ ...chip, background: `${BLUE}22`, color: BLUE }}>↩️ Replied · {at(message.repliedAt)}</span>
                  )}
                  {message.bouncedAt && (
                    <span style={{ ...chip, background: `${RED}22`, color: RED }}>⚠️ Bounced · {at(message.bouncedAt)}</span>
                  )}
                </div>

                {isOpen && clicks.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '6px' }}>
                    {clicks.map((entry, index) => (
                      <div key={`${message.id}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: TEXT, padding: '2px 0' }}>
                        <span style={{ wordBreak: 'break-all' }}>{linkLabel(entry.url)}</span>
                        <span style={{ color: MUTED, whiteSpace: 'nowrap' }}>{at(entry.at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '8px' }}>
        Unsend is offered for the first few minutes after a send. Replies and bounces appear here once the mailbox is connected with read access.
      </div>
    </div>
  );
}