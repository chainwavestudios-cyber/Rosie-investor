import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import CalendarContactCard from '@/components/assistant/CalendarContactCard';
import TaskRow from '@/components/assistant/tasks/TaskRow';
import CalendarImportBar from '@/components/assistant/tasks/CalendarImportBar';
import { GOLD, PRIORITIES, CATEGORIES, BASE_STATUSES, VIEWS, OUTCOME_IDS, inView, selectStyle } from '@/components/assistant/tasks/taskMeta';

const EMPTY_FORM = { title: '', description: '', status: 'todo', priority: 'medium', category: 'other', dueDate: '' };

export default function AssistantTasks({ username }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('open');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState('');
  const [cardLead, setCardLead] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.AssistantTask.filter({ assignedTo: username }, { sort: '-priority', limit: 200 });
      setTasks(res.items || res);
    } catch (e) { console.error('tasks load', e); }
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = { ...form, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null, assignedTo: username, createdBy: username };
    try {
      if (editing) await base44.entities.AssistantTask.update(editing, payload);
      else await base44.entities.AssistantTask.create(payload);
      setShowForm(false); setEditing(null); setForm(EMPTY_FORM);
      load();
    } catch (e) { alert('Save failed: ' + e.message); }
  };

  const toggleStatus = async (t) => {
    const next = t.status === 'done' ? 'todo' : 'done';
    await base44.entities.AssistantTask.update(t.id, { status: next, completedAt: next === 'done' ? new Date().toISOString() : null });
    load();
  };

  // Close-out outcome: the task moves into that tab of the window.
  const setOutcome = async (t, status) => {
    setBusy(`${t.id}:${status}`);
    try {
      await base44.entities.AssistantTask.update(t.id, { status, completedAt: null });
      load();
    } finally { setBusy(''); }
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

  const toggleDetails = (t) => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, _open: !x._open } : x));

  // Clicking the client's name opens their calendar contact card.
  const openCard = async (t) => {
    if (!t.relatedLeadId) return;
    try { setCardLead(await base44.entities.DebtLead.get(t.relatedLeadId)); }
    catch (e) { alert('Could not open this client: ' + e.message); }
  };

  const sorted = [...tasks].sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });
  const visible = sorted.filter(t => inView(t, view));
  const counts = VIEWS.reduce((acc, v) => ({ ...acc, [v.id]: tasks.filter(t => inView(t, v.id)).length }), {});
  const openCount = counts.open || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>✅ My Tasks</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>{openCount} open · {counts.done || 0} done{OUTCOME_IDS.reduce((s, id) => s + (counts[id] || 0), 0) ? ` · ${OUTCOME_IDS.reduce((s, id) => s + (counts[id] || 0), 0)} closed out` : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
          <CalendarImportBar username={username} tasks={tasks} onImported={load} />
          <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }} style={{ background: `linear-gradient(135deg,#10b981,#22c55e)`, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ New Task</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{ padding: '8px 14px', background: view === v.id ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${view === v.id ? GOLD : 'transparent'}`, color: view === v.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: view === v.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
            {v.label} <span style={{ color: view === v.id ? GOLD : '#4a5568' }}>({counts[v.id] || 0})</span>
          </button>
        ))}
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Task title…" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 12px', color: '#e8e0d0', fontSize: '14px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }} />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description / notes…" rows={2} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={selectStyle()}>{PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={selectStyle()}>{BASE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle()}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={selectStyle()} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} style={{ background: GOLD, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{editing ? 'Update' : 'Create'} Task</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading tasks…</div>
      ) : visible.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
          {view === 'open' ? 'Nothing open. Import calendar events or click "+ New Task" to add one.' : `No tasks in ${VIEWS.find(v => v.id === view)?.label} yet.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visible.map(t => <TaskRow key={t.id} task={t} busy={busy} inOutcomeView={OUTCOME_IDS.includes(view)} onToggle={toggleStatus} onEdit={edit} onDelete={remove} onToggleDetails={toggleDetails} onOpenCard={openCard} onOutcome={setOutcome} onReopen={t => setOutcome(t, 'todo')} />)}
        </div>
      )}

      {cardLead && <CalendarContactCard key={cardLead.id} lead={cardLead} username={username} onClose={() => setCardLead(null)} onSave={setCardLead} />}
    </div>
  );
}