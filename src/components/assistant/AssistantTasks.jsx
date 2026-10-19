import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';

const STATUSES = [
  { id: 'todo', label: 'To Do', color: '#8a9ab8' },
  { id: 'in_progress', label: 'In Progress', color: BLUE },
  { id: 'blocked', label: 'Blocked', color: RED },
  { id: 'done', label: 'Done', color: GOLD },
];
const PRIORITIES = [
  { id: 'low', label: 'Low', color: '#8a9ab8' },
  { id: 'medium', label: 'Medium', color: BLUE },
  { id: 'high', label: 'High', color: AMBER },
  { id: 'urgent', label: 'Urgent', color: RED },
];
const CATEGORIES = ['appointment', 'fronter', 'customer', 'compliance', 'system', 'admin', 'other'];

const fmtDue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  if (days < 0) return `⚠ ${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function AssistantTasks({ username }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', category: 'other', dueDate: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.AssistantTask.filter({ assignedTo: username }, { sort: '-priority', limit: 100 });
      setTasks(res.items || res);
    } catch (e) { console.error('tasks load', e); }
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = { ...form, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null, assignedTo: username, createdBy: username };
    try {
      if (editing) {
        await base44.entities.AssistantTask.update(editing, payload);
      } else {
        await base44.entities.AssistantTask.create(payload);
      }
      setShowForm(false); setEditing(null); setForm({ title: '', description: '', status: 'todo', priority: 'medium', category: 'other', dueDate: '' });
      load();
    } catch (e) { alert('Save failed: ' + e.message); }
  };

  const toggleStatus = async (t) => {
    const next = t.status === 'done' ? 'todo' : 'done';
    await base44.entities.AssistantTask.update(t.id, { status: next, completedAt: next === 'done' ? new Date().toISOString() : null });
    load();
  };

  const remove = async (t) => {
    if (!confirm('Delete this task?')) return;
    await base44.entities.AssistantTask.delete(t.id);
    load();
  };

  const edit = (t) => {
    setEditing(t.id);
    setForm({ title: t.title, description: t.description || '', status: t.status, priority: t.priority, category: t.category, dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 16) : '' });
    setShowForm(true);
  };

  const open = t => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, _open: !x._open } : x));

  const sorted = [...tasks].sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>✅ My Tasks</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>{tasks.filter(t => t.status !== 'done').length} open · {tasks.filter(t => t.status === 'done').length} done</div>
        </div>
        <button onClick={() => { setEditing(null); setForm({ title: '', description: '', status: 'todo', priority: 'medium', category: 'other', dueDate: '' }); setShowForm(true); }} style={{ background: `linear-gradient(135deg,#10b981,#22c55e)`, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ New Task</button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Task title…" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 12px', color: '#e8e0d0', fontSize: '14px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }} />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description / notes…" rows={2} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={sel()}>{PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={sel()}>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={sel()}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={sel()} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} style={{ background: GOLD, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{editing ? 'Update' : 'Create'} Task</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading tasks…</div>
      ) : sorted.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>No tasks yet. Click "+ New Task" to add one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sorted.map(t => {
            const st = STATUSES.find(s => s.id === t.status) || STATUSES[0];
            const pr = PRIORITIES.find(p => p.id === t.priority) || PRIORITIES[1];
            const done = t.status === 'done';
            return (
              <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${done ? 'rgba(255,255,255,0.06)' : pr.color + '33'}`, borderLeft: `3px solid ${pr.color}`, borderRadius: '4px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={() => toggleStatus(t)} style={{ background: done ? GOLD : 'transparent', border: `1.5px solid ${done ? GOLD : '#6b7280'}`, borderRadius: '3px', width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0, color: '#0a0f1e', fontSize: '11px', lineHeight: '16px' }}>{done ? '✓' : ''}</button>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => open(t)}>
                    <div style={{ color: done ? '#6b7280' : '#e8e0d0', fontSize: '13px', fontWeight: 'bold', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ color: pr.color, fontSize: '10px', fontWeight: 'bold' }}>{pr.label}</span>
                      <span style={{ color: st.color, fontSize: '10px' }}>· {st.label}</span>
                      <span style={{ color: '#6b7280', fontSize: '10px' }}>· {t.category}</span>
                      {t.dueDate && <span style={{ color: new Date(t.dueDate) < new Date() && !done ? RED : '#6b7280', fontSize: '10px' }}>· {fmtDue(t.dueDate)}</span>}
                    </div>
                  </div>
                  <button onClick={() => edit(t)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px', padding: '4px' }}>✏️</button>
                  <button onClick={() => remove(t)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px', padding: '4px' }}>🗑️</button>
                </div>
                {t._open && t.description && <div style={{ color: '#8a9ab8', fontSize: '12px', marginTop: '8px', paddingLeft: '28px', whiteSpace: 'pre-wrap' }}>{t.description}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function sel() { return { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none' }; }