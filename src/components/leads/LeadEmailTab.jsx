import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

const STATUS_CONFIG = {
  sent:      { color: '#60a5fa', icon: '📤', label: 'Sent' },
  delivered: { color: '#4ade80', icon: '✅', label: 'Delivered' },
  opened:    { color: '#f59e0b', icon: '📬', label: 'Opened' },
  clicked:   { color: '#a78bfa', icon: '🔗', label: 'Clicked' },
  bounced:   { color: '#ef4444', icon: '❌', label: 'Bounced' },
  spam:      { color: '#ef4444', icon: '⚠️', label: 'Spam' },
};

export default function LeadEmailTab({ lead, onUpdate }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEmails();
  }, [lead.id]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const logs = await base44.entities.EmailLog.filter({ leadId: lead.id }, '-created_date');
      setEmails(logs);
    } catch {}
    setLoading(false);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === emails.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(emails.map(e => e.id)));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map(id => base44.entities.EmailLog.delete(id)));
      setSelected(new Set());
      await loadEmails();
    } catch {}
    setDeleting(false);
  };

  const handleSendReply = async (emailLog) => {
    if (!replyText.trim()) return;
    setSendingReply(true); setReplyMsg('');
    try {
      await base44.functions.invoke('sendLeadEmail', {
        leadId: lead.id,
        toEmail: lead.email,
        toName: lead.name || `${lead.firstName} ${lead.lastName}`,
        firstName: lead.firstName,
        customBody: replyText.trim(),
        isReply: true,
      });
      setReplyMsg('✓ Reply sent! +20 pts');
      await base44.entities.Lead.update(lead.id, {
        engagementScore: (lead.engagementScore || 0) + 20,
      });
      await base44.entities.LeadHistory.create({
        leadId: lead.id,
        type: 'note',
        content: `✉️ Email reply sent to ${lead.email}. +20 engagement points.`,
      });
      setReplyText('');
      setReplyingTo(null);
      await loadEmails();
      onUpdate && onUpdate();
      setTimeout(() => setReplyMsg(''), 3000);
    } catch (e) {
      setReplyMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSendingReply(false);
  };

  if (loading) return <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading emails…</div>;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={{ color: GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>Email History</div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ color:'#6b7280', fontSize:'11px' }}>{emails.length} email{emails.length !== 1 ? 's' : ''}</span>
          {emails.length > 0 && (
            <>
              <button onClick={toggleAll}
                style={{ background:'rgba(255,255,255,0.06)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>
                {selected.size === emails.length ? 'Deselect All' : 'Select All'}
              </button>
              {selected.size > 0 && (
                <button onClick={deleteSelected} disabled={deleting}
                  style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'2px', padding:'3px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
                  {deleting ? 'Deleting…' : `🗑 Delete (${selected.size})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {emails.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>✉️</div>
          <div style={{ color:'#4a5568', fontSize:'13px' }}>No emails sent yet. Use the Send Email button above.</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {emails.map(email => {
          const sc = STATUS_CONFIG[email.status] || STATUS_CONFIG.sent;
          const isOpen = replyingTo === email.id;
          const isSelected = selected.has(email.id);
          return (
            <div key={email.id}
              style={{ background: isSelected ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)', border:`1px solid ${isSelected ? 'rgba(239,68,68,0.4)' : sc.color + '33'}`, borderLeft:`3px solid ${isSelected ? '#ef4444' : sc.color}`, borderRadius:'4px', padding:'12px 16px', cursor:'pointer', transition:'all 0.15s' }}
              onClick={() => toggleSelect(email.id)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', marginBottom:'6px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  {/* Checkbox */}
                  <div style={{ width:'14px', height:'14px', borderRadius:'2px', border:`2px solid ${isSelected ? '#ef4444' : '#4a5568'}`, background: isSelected ? '#ef4444' : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {isSelected && <span style={{ color:'#fff', fontSize:'10px', lineHeight:1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:'16px' }}>{sc.icon}</span>
                  <div>
                    <div style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold' }}>
                      To: {email.toEmail}
                    </div>
                    <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'1px' }}>
                      Template #{email.templateId} · ID: {email.messageId || 'pending'}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                  <span style={{ background:`${sc.color}22`, color:sc.color, border:`1px solid ${sc.color}44`, borderRadius:'20px', padding:'2px 10px', fontSize:'10px', letterSpacing:'1px' }}>
                    {sc.icon} {sc.label}
                  </span>
                  <span style={{ color:'#4a5568', fontSize:'10px' }}>
                    {email.sentAt ? new Date(email.sentAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''}
                  </span>
                </div>
              </div>

              {email.openedAt && (
                <div style={{ color:'#f59e0b', fontSize:'11px', marginBottom:'3px' }}>
                  📬 Opened: {new Date(email.openedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                </div>
              )}
              {email.clickedAt && (
                <div style={{ color:'#a78bfa', fontSize:'11px', marginBottom:'3px' }}>
                  🔗 Clicked: {email.clickedUrl || ''} — {new Date(email.clickedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                </div>
              )}
              {email.sentBy && (
                <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'4px' }}>
                  Sent by: {email.sentBy}
                </div>
              )}

              {/* Reply button — stop propagation so clicking it doesn't toggle select */}
              <div style={{ marginTop:'8px' }} onClick={e => e.stopPropagation()}>
                <button onClick={() => setReplyingTo(isOpen ? null : email.id)}
                  style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'2px', padding:'5px 14px', cursor:'pointer', fontSize:'11px' }}>
                  {isOpen ? 'Cancel' : '↩ Reply'}
                </button>
              </div>

              {isOpen && (
                <div style={{ marginTop:'12px' }} onClick={e => e.stopPropagation()}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={4}
                    placeholder={`Reply to ${email.toEmail}…`}
                    style={{ ...inp, resize:'vertical', marginBottom:'8px', fontSize:'12px' }}
                  />
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <button onClick={() => handleSendReply(email)} disabled={sendingReply || !replyText.trim()}
                      style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:'#0a0f1e', border:'none', borderRadius:'2px', padding:'8px 18px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>
                      {sendingReply ? 'Sending…' : '✉️ Send Reply (+20 pts)'}
                    </button>
                    {replyMsg && <span style={{ color: replyMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize:'12px' }}>{replyMsg}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}