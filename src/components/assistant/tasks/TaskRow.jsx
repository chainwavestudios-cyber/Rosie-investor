/**
 * TaskRow.jsx — One line of the assistant task list. Tasks imported from the calendar show
 * the client's name (opens the calendar contact card) and the close-out buttons:
 * Not Interested, Rebooked, Unavailable — which move the task into that tab of the window.
 */
import { GOLD, RED, AMBER, STATUS_META, PRIORITY_META, OUTCOMES, fmtDue } from '@/components/assistant/tasks/taskMeta';

const outcomeStyle = (color, disabled) => ({ background: `${color}1f`, color, border: `1px solid ${color}66`, borderRadius: '3px', padding: '5px 9px', cursor: disabled ? 'wait' : 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1 });

export default function TaskRow({ task, inOutcomeView, busy, onToggle, onEdit, onDelete, onToggleDetails, onOpenCard, onOutcome, onReopen }) {
  const st = STATUS_META[task.status] || STATUS_META.todo;
  const pr = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const done = task.status === 'done';
  const imported = !!task.relatedLeadId;
  const overdue = task.dueDate && new Date(task.dueDate) < new Date();
  return <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${done ? 'rgba(255,255,255,0.06)' : pr.color + '33'}`, borderLeft: `3px solid ${pr.color}`, borderRadius: '4px', padding: '12px 14px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {!inOutcomeView && <button onClick={() => onToggle(task)} title="Mark done" style={{ background: done ? GOLD : 'transparent', border: `1.5px solid ${done ? GOLD : '#6b7280'}`, borderRadius: '3px', width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0, color: '#0a0f1e', fontSize: '11px', lineHeight: '16px' }}>{done ? '✓' : ''}</button>}
      <div style={{ flex: 1, minWidth: '180px', cursor: 'pointer' }} onClick={() => onToggleDetails(task)}>
        <div style={{ color: done ? '#6b7280' : '#e8e0d0', fontSize: '13px', fontWeight: 'bold', textDecoration: done ? 'line-through' : 'none' }}>{task.title}</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: pr.color, fontSize: '10px', fontWeight: 'bold' }}>{pr.label}</span>
          <span style={{ color: st.color, fontSize: '10px' }}>· {st.label}</span>
          <span style={{ color: '#6b7280', fontSize: '10px' }}>· {task.category}</span>
          {task.dueDate && <span style={{ color: overdue && !done ? RED : '#6b7280', fontSize: '10px' }}>· {fmtDue(task.dueDate)}</span>}
        </div>
      </div>
      {imported && <button onClick={() => onOpenCard(task)} title="Open the calendar contact card" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '3px', padding: '5px 9px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>👤 {task.relatedLeadName || 'Client'}</button>}
      {imported && !inOutcomeView && OUTCOMES.map(o => <button key={o.id} disabled={!!busy} onClick={() => onOutcome(task, o.id)} style={outcomeStyle(o.color, !!busy)}>{busy === `${task.id}:${o.id}` ? 'Saving…' : o.label}</button>)}
      {imported && inOutcomeView && <button disabled={!!busy} onClick={() => onReopen(task)} style={{ background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '3px', padding: '5px 9px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>↩ Reopen</button>}
      <button onClick={() => onEdit(task)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px', padding: '4px' }}>✏️</button>
      <button onClick={() => onDelete(task)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px', padding: '4px' }}>🗑️</button>
    </div>
    {task._open && task.description && <div style={{ color: '#8a9ab8', fontSize: '12px', marginTop: '8px', paddingLeft: '28px', whiteSpace: 'pre-wrap' }}>{task.description}</div>}
  </div>;
}

export { GOLD, RED, AMBER };