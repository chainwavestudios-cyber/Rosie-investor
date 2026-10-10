/**
 * FronterQuoteTab.jsx — Super admin tab for managing motivational quotes.
 * Admin can create custom quotes and schedule when they should be broadcasted
 * to the fronter chatroom. Also shows AI-scheduled quotes and sent history.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInputValue(localStr) {
  if (!localStr) return '';
  return new Date(localStr).toISOString();
}

export default function FronterQuoteTab({ adminUsername }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ quoteText: '', authorName: 'Chris - Sr. Debt Advisor', scheduledTime: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ quoteText: '', authorName: 'Chris - Sr. Debt Advisor', scheduledTime: '' });
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.FronterQuote.list('-scheduledTime', 200);
      setQuotes(all || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addQuote = async () => {
    if (!form.quoteText.trim() || !form.scheduledTime) return;
    try {
      await base44.entities.FronterQuote.create({
        quoteText: form.quoteText.trim(),
        authorName: form.authorName.trim() || 'Chris - Sr. Debt Advisor',
        scheduledTime: fromLocalInputValue(form.scheduledTime),
        sourceType: 'admin_custom',
        isActive: true,
      });
      setForm({ quoteText: '', authorName: 'Chris - Sr. Debt Advisor', scheduledTime: '' });
      load();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const saveEdit = async (id) => {
    if (!editForm.quoteText.trim() || !editForm.scheduledTime) return;
    try {
      await base44.entities.FronterQuote.update(id, {
        quoteText: editForm.quoteText.trim(),
        authorName: editForm.authorName.trim() || 'Chris - Sr. Debt Advisor',
        scheduledTime: fromLocalInputValue(editForm.scheduledTime),
      });
      setEditingId(null);
      load();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const deleteQuote = async (id) => {
    if (!confirm('Delete this quote?')) return;
    await base44.entities.FronterQuote.delete(id);
    load();
  };

  const toggleActive = async (id, current) => {
    await base44.entities.FronterQuote.update(id, { isActive: !current });
    load();
  };

  const generateAiNow = async () => {
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: 'Write a short, powerful motivational quote about greatness, perseverance, or hard work. It should be 1-3 sentences, punchy, and inspiring. Think of something a sales leader would send to their team to fire them up. Do not include quotation marks around the whole thing. Do not attribute it to anyone. Just the quote itself.',
      });
      setForm(p => ({ ...p, quoteText: (res || '').trim() }));
    } catch (e) { alert('AI generation failed: ' + (e?.message || String(e))); }
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  const filtered = quotes.filter(q => {
    if (filter === 'pending') return !q.sentAt && q.isActive;
    if (filter === 'sent') return !!q.sentAt;
    if (filter === 'ai') return q.sourceType === 'ai_scheduled';
    if (filter === 'admin') return q.sourceType === 'admin_custom';
    return true;
  });

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>💬 Motivational Quotes — Chatroom Broadcast</div>

      <div style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '4px', padding: '10px 14px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px' }}>
        💡 Quotes are posted to the Fronters Chatroom at their scheduled time. AI generates 2 quotes daily (9am & 3pm ET) about greatness, perseverance, and hard work — attributed to Chris. Create custom quotes below to broadcast at any time.
      </div>

      {/* Create form */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>+ Create Custom Quote</div>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ ...ls, marginBottom: 0 }}>Quote Text</label>
            <button onClick={generateAiNow} style={{ background: `${PURPLE}18`, color: PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✨ Generate with AI</button>
          </div>
          <textarea value={form.quoteText} onChange={e => setForm(p => ({ ...p, quoteText: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Greatness is not born, it is built one call at a time..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div><label style={ls}>Author Name</label><input value={form.authorName} onChange={e => setForm(p => ({ ...p, authorName: e.target.value }))} style={inp} /></div>
          <div><label style={ls}>Broadcast At (ET)</label><input type="datetime-local" value={form.scheduledTime} onChange={e => setForm(p => ({ ...p, scheduledTime: e.target.value }))} style={inp} /></div>
        </div>
        <button onClick={addQuote} disabled={!form.quoteText.trim() || !form.scheduledTime} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (!form.quoteText.trim() || !form.scheduledTime) ? 0.5 : 1 }}>✓ Schedule Quote</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '12px' }}>
        {[{ id: 'pending', label: '⏳ Pending' }, { id: 'sent', label: '✓ Sent' }, { id: 'ai', label: '🤖 AI Quotes' }, { id: 'admin', label: '✍️ Custom' }, { id: 'all', label: 'All' }].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{ background: 'none', border: 'none', borderBottom: filter === t.id ? `2px solid ${GOLD}` : '2px solid transparent', color: filter === t.id ? GOLD : '#6b7280', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: filter === t.id ? 'bold' : 'normal' }}>{t.label}</button>
        ))}
      </div>

      {/* Quote list */}
      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No quotes in this category.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(q => {
            const isSent = !!q.sentAt;
            const isAi = q.sourceType === 'ai_scheduled';
            return (
              <div key={q.id} style={{ background: '#0d1b2a', border: `1px solid ${isSent ? 'rgba(255,255,255,0.05)' : isAi ? 'rgba(167,139,250,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '6px', padding: '14px', opacity: isSent ? 0.6 : 1 }}>
                {editingId === q.id ? (
                  <>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={ls}>Quote Text</label>
                      <textarea value={editForm.quoteText} onChange={e => setEditForm(p => ({ ...p, quoteText: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div><label style={ls}>Author</label><input value={editForm.authorName} onChange={e => setEditForm(p => ({ ...p, authorName: e.target.value }))} style={inp} /></div>
                      <div><label style={ls}>Broadcast At</label><input type="datetime-local" value={editForm.scheduledTime} onChange={e => setEditForm(p => ({ ...p, scheduledTime: e.target.value }))} style={inp} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => saveEdit(q.id)} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✓ Save</button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ color: '#e8e0d0', fontSize: '13px', lineHeight: 1.6, fontFamily: 'Georgia, serif', fontStyle: 'italic', flex: 1 }}>"{q.quoteText}"</div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {!isSent && <button onClick={() => { setEditingId(q.id); setEditForm({ quoteText: q.quoteText, authorName: q.authorName || 'Chris - Sr. Debt Advisor', scheduledTime: toLocalInputValue(q.scheduledTime) }); }} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '11px' }}>✎</button>}
                        <button onClick={() => deleteQuote(q.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: '#8a9ab8', fontSize: '11px' }}>— {q.authorName}</span>
                      {isAi && <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(167,139,250,0.12)', color: PURPLE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>🤖 AI</span>}
                      {!isAi && <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(96,165,250,0.12)', color: BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>✍️ Custom</span>}
                      <span style={{ color: AMBER, fontSize: '11px' }}>📅 {fmtTime(q.scheduledTime)}</span>
                      {isSent ? (
                        <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(16,185,129,0.12)', color: GOLD, fontSize: '9px', fontWeight: 'bold' }}>✓ Sent {fmtTime(q.sentAt)}</span>
                      ) : q.isActive ? (
                        <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(245,158,11,0.12)', color: AMBER, fontSize: '9px', fontWeight: 'bold' }}>⏳ Pending</span>
                      ) : (
                        <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '9px', fontWeight: 'bold' }}>⏸ Paused</span>
                      )}
                      {!isSent && (
                        <button onClick={() => toggleActive(q.id, q.isActive)} style={{ background: 'none', border: 'none', color: q.isActive ? '#f59e0b' : GOLD, cursor: 'pointer', fontSize: '10px', marginLeft: 'auto' }}>{q.isActive ? '⏸ Pause' : '▶ Activate'}</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}