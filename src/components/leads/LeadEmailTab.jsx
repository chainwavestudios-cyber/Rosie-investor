import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' };

const STATUS_ICONS = { sent: '📤', delivered: '✅', opened: '📬', clicked: '🖱️', bounced: '❌', replied: '💬' };
const STATUS_COLORS = { sent: '#8a9ab8', delivered: '#60a5fa', opened: '#f59e0b', clicked: '#4ade80', bounced: '#ef4444', replied: '#a78bfa' };

export default function LeadEmailTab({ lead, onScoreUpdate }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => { loadEmails(); }, [lead.id]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.LeadEmail.filter({ leadId: lead.id }, '-sentAt');
      setEmails(all);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!subject.trim()) return;
    if (!lead.email) { setSendMsg('⚠ Lead has no email address.'); return; }
    setSending(true); setSendMsg('');
    try {
      await base44.functions.invoke('mailjetSend', {
        leadId: lead.id,
        leadEmail: lead.email,
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadFirstName: lead.firstName,
        subject: subject.trim(),
      });
      setSendMsg('✅ Email sent! +5 points awarded.');
      setSubject(''); setComposing(false);
      await loadEmails();
      onScoreUpdate && onScoreUpdate();
    } catch(e) {
      setSendMsg('❌ Failed: ' + e.message);
    }
    setSending(false);
    setTimeout(() => setSendMsg(''), 4000);
  };

  const handleAdminReply = async (emailRecord) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      // Send the reply via Mailjet
      await base44.functions.invoke('mailjetSend', {
        leadId: lead.id,
        leadEmail: lead.email,
        leadName: `${lead.firstName} ${lead.lastName}`,
        subject: `Re: ${emailRecord.subject}`,
        body: replyText.trim(),
      });

      // Record the reply in the email record
      const updatedReplies = [...(emailRecord.replies || [])];
      const lastReply = updatedReplies[updatedReplies.length - 1];
      if (lastReply && !lastReply.adminReply) {
        lastReply.adminReply = replyText.trim();
        lastReply.adminRepliedAt = new Date().toISOString();
      }
      await base44.entities.LeadEmail.update(emailRecord.id, { replies: updatedReplies });

      // Award 20 points for reply
      const currentLead = await base44.entities.Lead.filter({ id: lead.id });
      if (currentLead[0]) {
        const newScore = (currentLead[0].score || 0) + 20;
        await base44.entities.Lead.update(lead.id, { score: newScore });
        await base44.entities.LeadHistory.create({
          leadId: lead.id,
          type: 'note',
          content: `💬 Admin replied to email: "Re: ${emailRecord.subject}" — +20 points`,
          createdBy: 'admin',
        });
      }

      setReplyText('');
      await loadEmails();
      onScoreUpdate && onScoreUpdate();
    } catch(e) { console.error(e); }
    setReplying(false);
  };

  return (
    <div>
      {/* Compose button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Email History ({emails.length})
        </div>
        {!composing && (
          <button onClick={() => setComposing(true)}
            style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '7px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>
            ✉️ Compose Email
          </button>
        )}
      </div>

      {sendMsg && (
        <div style={{ background: sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '2px', padding: '10px 14px', color: sendMsg.startsWith('✅') ? '#4ade80' : '#ef4444', fontSize: '13px', marginBottom: '12px' }}>
          {sendMsg}
        </div>
      )}

      {/* Compose form */}
      {composing && (
        <div style={{ background: 'rgba(184,147,58,0.05)', border: '1px solid rgba(184,147,58,0.25)', borderRadius: '4px', padding: '18px', marginBottom: '16px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>New Email to {lead.firstName} {lead.lastName}</div>
          {!lead.email && (
            <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '10px' }}>⚠ No email address on file for this lead.</div>
          )}
          <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '2px', padding: '10px 12px', marginBottom: '12px', color: '#8a9ab8', fontSize: '12px' }}>
            📋 Uses the <strong style={{ color: '#60a5fa' }}>"email"</strong> Mailjet template. The greeting <code>Dear {lead.firstName},</code> is injected automatically.
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" style={inp} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSend} disabled={sending || !subject.trim() || !lead.email}
              style={{ background: (!subject.trim() || !lead.email) ? 'rgba(184,147,58,0.2)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '9px 22px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
              {sending ? 'Sending…' : '📤 Send Email'}
            </button>
            <button onClick={() => { setComposing(false); setSubject(''); }}
              style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px', padding: '9px 16px', cursor: 'pointer', fontSize: '12px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Email list */}
      {loading && <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px' }}>Loading…</p>}
      {!loading && emails.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#4a5568' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '13px' }}>No emails sent yet.</div>
        </div>
      )}

      {emails.map(email => {
        const statusColor = STATUS_COLORS[email.status] || '#8a9ab8';
        const isExpanded = expandedEmail === email.id;
        const replies = email.replies || [];
        const hasReplies = replies.length > 0;

        return (
          <div key={email.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${email.status === 'opened' || email.status === 'clicked' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', marginBottom: '10px', overflow: 'hidden' }}>
            {/* Email header row */}
            <div onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
              style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>{STATUS_ICONS[email.status] || '📤'}</span>
                  <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</span>
                  {hasReplies && <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: '10px', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap' }}>💬 {replies.length} reply</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', flexWrap: 'wrap' }}>
                  <span style={{ color: statusColor, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{email.status}</span>
                  {email.openCount > 0 && <span style={{ color: '#f59e0b' }}>📬 Opened {email.openCount}×</span>}
                  {email.clickCount > 0 && <span style={{ color: '#4ade80' }}>🖱️ Clicked {email.clickCount}×</span>}
                  <span style={{ color: '#4a5568' }}>{email.sentAt ? new Date(email.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                </div>
              </div>
              <span style={{ color: '#4a5568', fontSize: '14px' }}>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
                {/* Tracking info */}
                {(email.openedAt || email.clickedAt) && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {email.openedAt && (
                      <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '3px 10px', fontSize: '11px' }}>
                        📬 First opened {new Date(email.openedAt).toLocaleString()}
                      </span>
                    )}
                    {email.clickedAt && (
                      <span style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '20px', padding: '3px 10px', fontSize: '11px' }}>
                        🖱️ Clicked {email.clickedUrl ? `"${email.clickedUrl}"` : ''} {new Date(email.clickedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Body */}
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '2px', padding: '12px', marginBottom: '12px', color: '#c4cdd8', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                  {email.body?.replace(/<[^>]*>/g, '') || '(no body)'}
                </div>

                {/* Replies */}
                {replies.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ color: '#a78bfa', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Replies</div>
                    {replies.map((r, i) => (
                      <div key={i} style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '2px', padding: '10px 12px', marginBottom: '8px' }}>
                        <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>From {r.fromEmail} · {r.receivedAt ? new Date(r.receivedAt).toLocaleString() : ''}</div>
                        <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6 }}>{r.content}</div>
                        {r.adminReply && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ color: GOLD, fontSize: '10px', marginBottom: '3px' }}>Your reply · {r.adminRepliedAt ? new Date(r.adminRepliedAt).toLocaleString() : ''}</div>
                            <div style={{ color: '#c4cdd8', fontSize: '12px' }}>{r.adminReply}</div>
                          </div>
                        )}
                        {/* Reply input for unreplied messages */}
                        {!r.adminReply && (
                          <div style={{ marginTop: '10px' }}>
                            <textarea value={expandedEmail === email.id ? replyText : ''} onChange={e => setReplyText(e.target.value)} rows={2} placeholder="Write a reply… (+20 pts)" style={{ ...inp, fontSize: '12px', resize: 'vertical', marginBottom: '6px' }} />
                            <button onClick={() => handleAdminReply(email)} disabled={replying || !replyText.trim()}
                              style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '2px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>
                              {replying ? 'Sending…' : '↩️ Reply (+20 pts)'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick reply (no existing replies) */}
                {replies.length === 0 && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Reply to this email</div>
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} placeholder="Write a reply… (+20 pts when sent)" style={{ ...inp, fontSize: '12px', resize: 'vertical', marginBottom: '8px' }} />
                    <button onClick={() => handleAdminReply(email)} disabled={replying || !replyText.trim()}
                      style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '7px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                      {replying ? 'Sending…' : '↩️ Send Reply (+20 pts)'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}