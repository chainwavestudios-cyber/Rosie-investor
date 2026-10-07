/**
 * ObjectionsEngineTab — management interface for the Objection Engine.
 * Lists all objections sorted by priority, lets admins add/edit/delete,
 * set priority (high = live popup, medium = highlight, low = log only),
 * and enable/disable each. Pre-seeded with the core cold-call objections.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const PRIO_COLORS = { high: RED, medium: AMBER, low: '#6b7280' };
const PRIO_LABELS = { high: 'HIGH — Live Popup', medium: 'Medium — Highlight', low: 'Low — Log Only' };

function blankForm() {
  return { title: '', triggerPhrases: '', responseText: '', mindset: '', goal: '', priority: 'medium', enabled: true, sortOrder: 0 };
}

export default function ObjectionsEngineTab({ readOnly }) {
  const [objections, setObjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm());

  const load = useCallback(() => {
    setLoading(true);
    base44.entities.Objection.list('-created_date', 200)
      .then(rows => {
        const sorted = (rows || []).sort((a, b) => {
          const pr = { high: 0, medium: 1, low: 2 };
          const pd = (pr[a.priority] ?? 1) - (pr[b.priority] ?? 1);
          if (pd !== 0) return pd;
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
        setObjections(sorted);
      })
      .catch(() => setObjections([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const startAdd = () => { setForm(blankForm()); setEditing('new'); };
  const startEdit = (o) => {
    setForm({
      title: o.title || '', triggerPhrases: o.triggerPhrases || '', responseText: o.responseText || '',
      mindset: o.mindset || '', goal: o.goal || '', priority: o.priority || 'medium',
      enabled: o.enabled !== false, sortOrder: o.sortOrder || 0,
    });
    setEditing(o.id);
  };
  const cancel = () => { setEditing(null); setForm(blankForm()); };

  const save = async () => {
    if (!form.title.trim() || !form.responseText.trim()) { alert('Title and response are required.'); return; }
    let phrases = [];
    try { phrases = JSON.parse(form.triggerPhrases || '[]'); if (!Array.isArray(phrases)) throw new Error(); }
    catch { alert('Trigger phrases must be a valid JSON array, e.g. ["not interested", "i\'m good"]'); return; }
    const payload = { ...form, triggerPhrases: JSON.stringify(phrases) };
    try {
      if (editing === 'new') await base44.entities.Objection.create(payload);
      else await base44.entities.Objection.update(editing, payload);
      window.dispatchEvent(new CustomEvent('objections_updated'));
      cancel();
      load();
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this objection?')) return;
    try { await base44.entities.Objection.delete(id); window.dispatchEvent(new CustomEvent('objections_updated')); load(); }
    catch (e) { alert('Delete failed: ' + (e?.message || String(e))); }
  };

  const setPriority = async (id, priority) => {
    try { await base44.entities.Objection.update(id, { priority }); window.dispatchEvent(new CustomEvent('objections_updated')); load(); }
    catch (e) { alert('Update failed: ' + (e?.message || String(e))); }
  };

  const toggleEnabled = async (id, enabled) => {
    try { await base44.entities.Objection.update(id, { enabled }); window.dispatchEvent(new CustomEvent('objections_updated')); load(); }
    catch (e) { alert('Update failed: ' + (e?.message || String(e))); }
  };

  const parsePhrases = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>🛡️ Objection Engine</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>Live transcript scanner — detects customer objections and surfaces the response for the agent in real time.</div>
        </div>
        {!readOnly && <button onClick={startAdd} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>+ Add Objection</button>}
      </div>

      {/* Priority legend */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {Object.entries(PRIO_LABELS).map(([k, label]) => (
          <div key={k} style={{ padding: '6px 12px', background: `${PRIO_COLORS[k]}12`, border: `1px solid ${PRIO_COLORS[k]}33`, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIO_COLORS[k] }} />
            <span style={{ color: PRIO_COLORS[k], fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Loading objections…</div>
      ) : objections.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No objections yet. Click "Add Objection" to create one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {objections.map(o => {
            const phrases = parsePhrases(o.triggerPhrases);
            return (
              <div key={o.id} style={{ background: '#0d1b2a', border: `1px solid ${o.enabled !== false ? PRIO_COLORS[o.priority] + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '3px', background: `${PRIO_COLORS[o.priority]}22`, color: PRIO_COLORS[o.priority], fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{o.priority || 'medium'}</span>
                        <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{o.title}</span>
                        {o.enabled === false && <span style={{ color: '#6b7280', fontSize: '10px', fontStyle: 'italic' }}>(disabled)</span>}
                      </div>
                      {phrases.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          {phrases.map((p, i) => <span key={i} style={{ padding: '2px 7px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '3px', color: BLUE, fontSize: '10px' }}>"{p}"</span>)}
                        </div>
                      )}
                      <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, marginTop: '6px', padding: '8px 10px', background: 'rgba(16,185,129,0.05)', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.15)' }}>
                        💬 {o.responseText}
                      </div>
                    </div>
                    {!readOnly && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => startEdit(o)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>✏️ Edit</button>
                        <button onClick={() => toggleEnabled(o.id, !(o.enabled !== false))} style={{ background: o.enabled !== false ? 'rgba(107,113,128,0.15)' : 'rgba(16,185,129,0.15)', color: o.enabled !== false ? '#6b7280' : GOLD, border: `1px solid ${o.enabled !== false ? 'rgba(107,113,128,0.3)' : GOLD + '44'}`, borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{o.enabled !== false ? '⏸ Disable' : '▶ Enable'}</button>
                        <button onClick={() => remove(o.id)} style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>🗑 Delete</button>
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Priority:</span>
                      {['high', 'medium', 'low'].map(p => (
                        <button key={p} onClick={() => setPriority(o.id, p)} style={{ padding: '3px 10px', borderRadius: '3px', border: `1px solid ${o.priority === p ? PRIO_COLORS[p] + '66' : 'rgba(255,255,255,0.1)'}`, background: o.priority === p ? `${PRIO_COLORS[p]}18` : 'transparent', color: o.priority === p ? PRIO_COLORS[p] : '#6b7280', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{p}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={cancel}>
          <div onClick={e => e.stopPropagation()} style={{ background: DARK, border: `1px solid ${GOLD}44`, borderRadius: '8px', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '16px' }}>{editing === 'new' ? '+ Add Objection' : '✏️ Edit Objection'}</div>
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. I'm not interested / I'm good" style={inp} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Trigger Phrases (JSON array — customer says any of these) *</label>
              <textarea value={form.triggerPhrases} onChange={e => setForm(p => ({ ...p, triggerPhrases: e.target.value }))} rows={3} placeholder={'["not interested", "i\'m good", "im good", "not interested right now"]'} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace' }} />
              <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '3px' }}>Case-insensitive substring match against the customer's transcript line.</div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Agent Response (read this to the customer) *</label>
              <textarea value={form.responseText} onChange={e => setForm(p => ({ ...p, responseText: e.target.value }))} rows={5} style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={ls}>Customer Mindset</label>
                <textarea value={form.mindset} onChange={e => setForm(p => ({ ...p, mindset: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={ls}>Agent Goal</label>
                <textarea value={form.goal} onChange={e => setForm(p => ({ ...p, goal: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={ls}>Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={inp}>
                  <option value="high">High — Live Popup</option>
                  <option value="medium">Medium — Highlight</option>
                  <option value="low">Low — Log Only</option>
                </select>
              </div>
              <div>
                <label style={ls}>Enabled</label>
                <select value={form.enabled ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, enabled: e.target.value === 'yes' }))} style={inp}>
                  <option value="yes">Active in live calls</option>
                  <option value="no">Disabled</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={cancel} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button onClick={save} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{editing === 'new' ? '✓ Create' : '✓ Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}