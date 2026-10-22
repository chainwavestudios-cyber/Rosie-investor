/**
 * PopupMessageCard.jsx — Super Admin Command Center card. Sends a one-time
 * popup message to a single fronter, which appears on their screen until they
 * acknowledge it.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, asArray, inputStyle, btn, emptyStyle, ago } from '@/components/superadmin/kit';

export default function PopupMessageCard({ username }) {
  const [fronters, setFronters] = useState([]);
  const [sent, setSent] = useState([]);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const loadSent = async () => {
    try {
      const res = await base44.entities.FronterPopupMessage.list('-sentAt', 6);
      setSent(asArray(res));
    } catch (e) { /* the history strip is best-effort */ }
  };

  useEffect(() => {
    base44.entities.DebtCoachUser.list('-created_date', 200)
      .then((res) => setFronters(asArray(res).filter((u) => u.username && u.isActive !== false)))
      .catch(() => {});
    loadSent();
  }, []);

  const send = async () => {
    if (!recipient || !message.trim()) return;
    setBusy(true); setError(''); setNote('');
    try {
      await base44.entities.FronterPopupMessage.create({
        recipientUsername: recipient,
        message: message.trim(),
        sentBy: username || 'admin',
        sentAt: new Date().toISOString(),
        status: 'active',
      });
      setMessage('');
      setNote(`Popup sent to ${recipient}. It stays on their screen until they acknowledge it.`);
      loadSent();
    } catch (e) { setError(e?.message || 'Could not send the popup.'); }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <select
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
        >
          <option value="">Choose a fronter…</option>
          {fronters.map((u) => (
            <option key={u.id} value={u.username}>
              {u.username}{u.firstName ? ` · ${u.firstName} ${u.lastName || ''}`.trimEnd() : ''}{u.role && u.role !== 'fronter' ? ` (${u.role})` : ''}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type the message they should see…"
        rows={3}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={send}
          disabled={busy || !recipient || !message.trim()}
          style={{ ...btn(C.fronter), opacity: busy || !recipient || !message.trim() ? 0.5 : 1, cursor: busy || !recipient || !message.trim() ? 'not-allowed' : 'pointer' }}
        >
          {busy ? 'Sending…' : '🔔 Send popup'}
        </button>
        {note && <span style={{ color: C.fronter, fontSize: '10px' }}>{note}</span>}
        {error && <span style={{ color: C.danger, fontSize: '10px' }}>{error}</span>}
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Recently sent</div>
        {sent.length === 0 && <div style={emptyStyle}>No popups sent yet.</div>}
        {sent.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.fronter, fontSize: '11px', fontWeight: 'bold', minWidth: '60px' }}>{m.recipientUsername}</span>
            <span style={{ color: C.ink, fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message}</span>
            <span style={{ color: m.status === 'closed' ? C.muted : C.warn, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.status === 'closed' ? 'Acknowledged' : 'On screen'}</span>
            <span style={{ color: C.dim, fontSize: '9px' }}>{ago(m.sentAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}