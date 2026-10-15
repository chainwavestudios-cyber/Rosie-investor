/**
 * FronterKBTab.jsx — Knowledge Base manager for the fronter system.
 * Add, edit, delete, search, and categorize Q&A entries used by the Live Q&A Copilot.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const emptyForm = { question: '', answer: '', alternativeQuestions: '', category: '', tags: '', sortOrder: 0 };

export default function FronterKBTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.FronterKnowledgeBase.list('-created_date', 500);
      setEntries(all || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(entries.map(e => e.category).filter(Boolean))].sort();

  const filtered = entries.filter(e => {
    const q = (e.question || '').toLowerCase();
    const a = (e.answer || '').toLowerCase();
    const alt = (e.alternativeQuestions || '').toLowerCase();
    const term = search.toLowerCase();
    const matchSearch = !term || q.includes(term) || a.includes(term) || alt.includes(term);
    const matchCat = !filterCat || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) { alert('Question and Answer are required.'); return; }
    try {
      const data = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        alternativeQuestions: form.alternativeQuestions.trim(),
        category: form.category.trim(),
        tags: form.tags.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editingId) {
        await base44.entities.FronterKnowledgeBase.update(editingId, data);
      } else {
        await base44.entities.FronterKnowledgeBase.create({ ...data, sourceType: 'manual' });
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      question: entry.question || '',
      answer: entry.answer || '',
      alternativeQuestions: entry.alternativeQuestions || '',
      category: entry.category || '',
      tags: entry.tags || '',
      sortOrder: entry.sortOrder || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  const remove = async (id) => {
    if (!confirm('Delete this Q&A entry?')) return;
    await base44.entities.FronterKnowledgeBase.delete(id);
    if (editingId === id) cancelEdit();
    load();
  };

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📚 Fronter Knowledge Base — Q&A Manager</div>
      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '10px 12px', marginBottom: '14px', color: '#8a9ab8', fontSize: '11px' }}>
        These Q&A entries power the Live Q&A Copilot that surfaces answers to fronters during live calls. Add the customer's exact question and the answer to read verbatim.
      </div>

      {/* Add / Edit form */}
      <div style={{ background: '#0d1b2a', border: `1px solid ${editingId ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ color: editingId ? '#f59e0b' : GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
          {editingId ? '✎ Edit Q&A Entry' : '+ Add Q&A Entry'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          <div>
            <label style={ls}>Question (customer's exact phrase) *</label>
            <input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="How much does this cost?" style={inp} />
          </div>
          <div>
            <label style={ls}>Answer (read verbatim to customer) *</label>
            <textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} rows={3} placeholder="Our program fee is 15-25% of your enrolled debt, and there's no upfront cost..." style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div>
            <label style={ls}>Alternative Questions (one per line — other ways the customer might phrase it)</label>
            <textarea value={form.alternativeQuestions} onChange={e => setForm(p => ({ ...p, alternativeQuestions: e.target.value }))} rows={2} placeholder={"What's the fee?\nHow much do you charge?"} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={ls}>Category</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Pricing" list="kb-categories" style={inp} />
              <datalist id="kb-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label style={ls}>Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="pricing, fees, cost" style={inp} />
            </div>
            <div>
              <label style={ls}>Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} style={inp} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={save} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {editingId ? 'Save Changes' : 'Add Entry'}
          </button>
          {editingId && (
            <button onClick={cancelEdit} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'end' }}>
        <div style={{ flex: 1 }}>
          <label style={ls}>Search</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions or answers..." style={inp} />
        </div>
        <div style={{ minWidth: '180px' }}>
          <label style={ls}>Category</label>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={inp}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '8px' }}>{filtered.length} of {entries.length} entries</div>

      {/* Entry list */}
      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No Q&A entries yet. Add one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(e => (
            <div key={e.id} style={{ background: '#0d1b2a', border: editingId === e.id ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{e.question}</span>
                    {e.category && <span style={{ padding: '1px 8px', borderRadius: '10px', background: 'rgba(96,165,250,0.15)', color: BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{e.category}</span>}
                    {e.sourceType && e.sourceType !== 'manual' && <span style={{ padding: '1px 6px', borderRadius: '10px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '9px' }}>{e.sourceType}</span>}
                  </div>
                  <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5, marginBottom: e.alternativeQuestions ? '8px' : 0 }}>{e.answer}</div>
                  {e.alternativeQuestions && (
                    <div style={{ color: '#6b7280', fontSize: '10px', fontFamily: 'monospace' }}>
                      <span style={{ color: '#8a9ab8' }}>Alt: </span>{e.alternativeQuestions.split('\n').filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {e.tags && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>Tags: {e.tags}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <button onClick={() => startEdit(e)} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '11px', textAlign: 'right' }}>✎ Edit</button>
                  <button onClick={() => remove(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', textAlign: 'right' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}