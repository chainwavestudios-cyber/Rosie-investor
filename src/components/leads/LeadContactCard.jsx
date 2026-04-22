import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LeadEmailTab from './LeadEmailTab';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px', padding: '9px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '5px' };

const STATUS_OPTIONS = [
  { value: 'lead', label: '🔵 Lead' },
  { value: 'not_available', label: '📵 Not Available' },
  { value: 'callback_later', label: '📅 Callback Later' },
  { value: 'not_interested', label: '🚫 Not Interested' },
  { value: 'prospect', label: '🚀 Prospect' },
  { value: 'converted', label: '✅ Converted' },
  { value: 'abandoned', label: '⚠️ Abandoned' },
];

const STATUS_COLORS = {
  lead: '#60a5fa', not_available: '#8a9ab8', callback_later: '#a78bfa',
  not_interested: '#ef4444', prospect: '#a78bfa', converted: '#4ade80', abandoned: '#ef4444',
};

export default function LeadContactCard({ lead, onClose, onUpdate, onDialNumber }) {
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ ...lead });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => { loadHistory(); }, [lead.id]);

  const loadHistory = async () => {
    try {
      const h = await base44.entities.LeadHistory.filter({ leadId: lead.id }, '-created_date');
      setHistory(h);
    } catch(e) { console.error(e); }
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.Lead.update(lead.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        phone2: form.phone2,
        address: form.address,
        state: form.state,
        status: form.status,
        notes: form.notes,
        bestTimeToCall: form.bestTimeToCall,
        callbackAt: form.callbackAt,
      });
      setSaveMsg('Saved ✓');
      onUpdate && onUpdate();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch(e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
  };

  const addNote = async () => {
    if (!noteContent.trim()) return;
    setAddingNote(true);
    try {
      await base44.entities.LeadHistory.create({
        leadId: lead.id,
        type: 'note',
        content: noteContent.trim(),
        createdBy: 'admin',
      });
      setNoteContent('');
      await loadHistory();
    } catch(e) { console.error(e); }
    setAddingNote(false);
  };

  const TABS = [
    ['overview', '👤 Overview'],
    ['history', '📞 History'],
    ['email', '✉️ Email'],
  ];

  const typeIcons = { call: '📞', connected: '🟢', not_available: '📵', interested: '⭐', callback_later: '📅', not_interested: '🚫', abandoned: '⚠️', status_change: '🔄', note: '📝' };
  const sc = STATUS_COLORS[form.status] || '#8a9ab8';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.3)', borderRadius: '4px', width: '100%', maxWidth: '780px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 120px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `rgba(184,147,58,0.15)`, border: `2px solid ${GOLD}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              {(lead.firstName || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#e8e0d0', fontSize: '16px', fontFamily: 'Georgia, serif' }}>{lead.firstName} {lead.lastName}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px' }}>
                <span style={{ background: `${sc}22`, color: sc, border: `1px solid ${sc}55`, padding: '2px 8px', borderRadius: '2px', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{lead.status?.replace('_', ' ')}</span>
                {lead.score > 0 && <span style={{ color: GOLD, fontSize: '11px' }}>⭐ Score: {lead.score}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {lead.phone && (
              <button onClick={() => onDialNumber && onDialNumber(lead)}
                style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '2px', padding: '7px 14px', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace' }}>
                📞 {lead.phone}
              </button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', cursor: 'pointer', fontSize: '18px', width: '34px', height: '34px', borderRadius: '4px' }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ background: 'none', border: 'none', borderBottom: tab === id ? `2px solid ${GOLD}` : '2px solid transparent', color: tab === id ? GOLD : '#6b7280', padding: '11px 18px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Left */}
              <div>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>Contact Info</div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={ls}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {[['firstName', 'First Name'], ['lastName', 'Last Name'], ['email', 'Email'], ['phone', 'Phone'], ['phone2', 'Alt Phone'], ['state', 'State']].map(([key, label]) => (
                  <div key={key} style={{ marginBottom: '10px' }}>
                    <label style={ls}>{label}</label>
                    <input value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inp} />
                  </div>
                ))}
              </div>
              {/* Right */}
              <div>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>Call Details</div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={ls}>Best Time to Call</label>
                  <input value={form.bestTimeToCall || ''} onChange={e => setForm({ ...form, bestTimeToCall: e.target.value })} placeholder="e.g. Mornings, After 3pm…" style={inp} />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={ls}>Callback Date/Time</label>
                  <input type="datetime-local" value={form.callbackAt ? form.callbackAt.slice(0, 16) : ''} onChange={e => setForm({ ...form, callbackAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} style={inp} />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={ls}>Address</label>
                  <input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} style={inp} />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={ls}>Notes</label>
                  <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={4} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                  <button onClick={handleSave} disabled={saving}
                    style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '9px 24px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {saveMsg && <span style={{ color: saveMsg.startsWith('Error') ? '#ef4444' : '#4ade80', fontSize: '12px' }}>{saveMsg}</span>}
                </div>
              </div>

              {/* Stats row */}
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  ['Call Attempts', lead.callAttempts || 0, GOLD],
                  ['Last Called', lead.lastCalledAt ? new Date(lead.lastCalledAt).toLocaleDateString() : 'Never', '#60a5fa'],
                  ['Engagement Score', lead.score || 0, '#4ade80'],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ color, fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
                    <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Add Note</div>
                <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={3} placeholder="Add a note…" style={{ ...inp, resize: 'vertical', lineHeight: 1.6, marginBottom: '8px' }} />
                <button onClick={addNote} disabled={addingNote || !noteContent.trim()}
                  style={{ background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '7px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  {addingNote ? 'Adding…' : 'Add Note'}
                </button>
              </div>

              {history.length === 0 && <p style={{ color: '#4a5568', textAlign: 'center', padding: '32px' }}>No history yet.</p>}
              {history.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '18px', flexShrink: 0, marginTop: '2px' }}>{typeIcons[item.type] || '📝'}</div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ color: GOLD, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.type}</span>
                      <span style={{ color: '#4a5568', fontSize: '11px' }}>{item.created_date ? new Date(item.created_date).toLocaleString() : ''}</span>
                    </div>
                    <p style={{ color: '#c4cdd8', fontSize: '13px', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.content}</p>
                    {item.callDurationSeconds > 0 && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>⏱ {Math.floor(item.callDurationSeconds / 60)}m {item.callDurationSeconds % 60}s</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EMAIL */}
          {tab === 'email' && (
            <LeadEmailTab lead={lead} onScoreUpdate={onUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}