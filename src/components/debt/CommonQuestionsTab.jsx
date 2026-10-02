/**
 * CommonQuestionsTab.jsx — Most common Q&A for debt settlement calls.
 * Shows searchable list of common questions + answers, with manual add/edit/delete.
 * Stored in KnowledgeBase entity with category 'debt_common_qa'.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const CATEGORY = 'debt_common_qa';

const ls = { color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function CommonQuestionsTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ question: '', answer: '' });
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.filter({ category: CATEGORY }, '-created_date', 500);
      setEntries(all || []);
    } catch (e) {
      console.error('Failed to load common Q&A:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const filtered = search.trim()
    ? entries.filter(e => {
        const q = (e.question || '').toLowerCase();
        const a = (e.answer || '').toLowerCase();
        const s = search.toLowerCase();
        return q.includes(s) || a.includes(s);
      })
    : entries;

  const startAdd = () => {
    setEditingId(null);
    setFormData({ question: '', answer: '' });
    setShowForm(true);
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setFormData({ question: entry.question || '', answer: entry.answer || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await base44.entities.KnowledgeBase.update(editingId, {
          question: formData.question.trim(),
          answer: formData.answer.trim(),
        });
      } else {
        await base44.entities.KnowledgeBase.create({
          question: formData.question.trim(),
          answer: formData.answer.trim(),
          category: CATEGORY,
          kbName: 'Debt Settlement',
          source: 'manual',
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ question: '', answer: '' });
      loadEntries();
    } catch (e) {
      alert('Failed to save: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Q&A entry?')) return;
    try {
      await base44.entities.KnowledgeBase.delete(id);
      loadEntries();
    } catch (e) {
      alert('Failed to delete: ' + (e?.message || String(e)));
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ question: '', answer: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header + search */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>❓ Common Q&A</span>
        <span style={{ color: '#6b7280', fontSize: '10px' }}>{entries.length} entries</span>
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search questions or answers…"
          style={{ ...inp, width: '200px', fontSize: '11px', padding: '5px 10px' }}
        />
        <button onClick={startAdd} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>+ Add Q&A</button>
      </div>

      {/* Form — add/edit */}
      {showForm && (
        <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(16,185,129,0.04)', flexShrink: 0 }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={ls}>Question</label>
            <input
              value={formData.question}
              onChange={e => setFormData(prev => ({ ...prev, question: e.target.value }))}
              placeholder="e.g. How does this affect my credit score?"
              style={inp}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={ls}>Answer</label>
            <textarea
              value={formData.answer}
              onChange={e => setFormData(prev => ({ ...prev, answer: e.target.value }))}
              placeholder="Type the answer the agent should give…"
              style={{ ...inp, minHeight: '80px', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave} disabled={saving || !formData.question.trim() || !formData.answer.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (saving || !formData.question.trim() || !formData.answer.trim()) ? 0.5 : 1 }}>
              {saving ? 'Saving…' : editingId ? '✓ Update' : '✓ Save'}
            </button>
            <button onClick={cancelForm} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
        {loading ? (
          <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '40px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center', padding: '40px' }}>
            {search ? 'No matching Q&A found.' : 'No common Q&A yet. Click "+ Add Q&A" to create one.'}
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div key={entry.id} style={{ marginBottom: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', flex: 1 }}>
                  <span style={{ color: '#6b7280', fontSize: '10px', marginRight: '6px' }}>{i + 1}.</span>
                  {entry.question}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button onClick={() => startEdit(entry)} title="Edit" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>✏ Edit</button>
                  <button onClick={() => handleDelete(entry.id)} title="Delete" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>🗑</button>
                </div>
              </div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', paddingLeft: '22px' }}>{entry.answer}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}