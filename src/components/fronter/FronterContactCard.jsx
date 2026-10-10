/**
 * FronterContactCard.jsx — Pop-up contact card for a fronter lead.
 * Fields: Name, Phone (click-to-dial), Address, Debt Amount, Debt Type
 * (Unsecured Credit Card / Unsecured Loans — select one or both).
 * Notes log with Eastern Time timestamps. Every dial auto-logs a note.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const DEBT_TYPES = ['Unsecured Credit Card', 'Unsecured Loans'];

function fmtET(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function FronterContactCard({ lead, username, onClose, onSave, onDial }) {
  const [local, setLocal] = useState(lead || {});
  const [notesLog, setNotesLog] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocal(lead || {});
    try { setNotesLog(JSON.parse(lead?.notesLogJson || '[]')); } catch { setNotesLog([]); }
  }, [lead]);

  const update = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  const debtTypes = (() => { try { return JSON.parse(local.debtTypesJson || '[]'); } catch { return []; } })();
  const toggleDebtType = (type) => {
    const next = debtTypes.includes(type) ? debtTypes.filter(t => t !== type) : [...debtTypes, type];
    update('debtTypesJson', JSON.stringify(next));
  };

  const addNote = async () => {
    if (!newNote.trim() || !lead?.id) return;
    const entry = { text: newNote.trim(), timestamp: new Date().toISOString(), author: username, type: 'note' };
    const nextLog = [...notesLog, entry];
    setNotesLog(nextLog);
    setNewNote('');
    try { await base44.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(nextLog) }); } catch {}
  };

  const save = async () => {
    if (!lead?.id) return;
    setSaving(true);
    try {
      await base44.entities.FronterLead.update(lead.id, {
        firstName: local.firstName, lastName: local.lastName, phone: local.phone,
        address: local.address, debtAmount: local.debtAmount, debtTypesJson: local.debtTypesJson,
        notesLogJson: JSON.stringify(notesLog),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onSave?.(local);
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📇 Contact Card</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={ls}>First Name</label>
              <input value={local.firstName || ''} onChange={e => update('firstName', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={ls}>Last Name</label>
              <input value={local.lastName || ''} onChange={e => update('lastName', e.target.value)} style={inp} />
            </div>
          </div>

          {/* Phone — click to dial */}
          <div style={{ marginBottom: '14px' }}>
            <label style={ls}>Phone (click to dial)</label>
            <button onClick={() => onDial?.(local)} style={{ ...inp, textAlign: 'left', cursor: 'pointer', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
              📞 {local.phone || '—'}
            </button>
          </div>

          {/* Address */}
          <div style={{ marginBottom: '14px' }}>
            <label style={ls}>Address</label>
            <input value={local.address || ''} onChange={e => update('address', e.target.value)} style={inp} placeholder="123 Main St, City, State 12345" />
          </div>

          {/* Debt Amount */}
          <div style={{ marginBottom: '14px' }}>
            <label style={ls}>Amount of Debt ($)</label>
            <input type="number" value={local.debtAmount ?? ''} onChange={e => update('debtAmount', e.target.value ? Number(e.target.value) : null)} style={inp} placeholder="0" />
          </div>

          {/* Debt Type — checkboxes */}
          <div style={{ marginBottom: '14px' }}>
            <label style={ls}>Type of Debt (select at least one)</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {DEBT_TYPES.map(type => {
                const selected = debtTypes.includes(type);
                return (
                  <button key={type} onClick={() => toggleDebtType(type)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '4px', border: `1px solid ${selected ? GOLD + '66' : 'rgba(255,255,255,0.12)'}`, background: selected ? `${GOLD}18` : 'rgba(255,255,255,0.03)', color: selected ? GOLD : '#8a9ab8', cursor: 'pointer', fontSize: '12px', fontWeight: selected ? 'bold' : 'normal', fontFamily: 'Georgia, serif' }}>
                    <span style={{ color: selected ? GOLD : '#4a5568', fontSize: '14px' }}>{selected ? '☑' : '☐'}</span>
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes Log */}
          <div style={{ marginBottom: '14px' }}>
            <label style={ls}>Notes (Eastern Time)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNote(); }} placeholder="Add a note..." style={inp} />
              <button onClick={addNote} disabled={!newNote.trim()} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '0 14px', cursor: !newNote.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: newNote.trim() ? 1 : 0.5, fontFamily: 'Georgia, serif' }}>Add</button>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {notesLog.length === 0 ? (
                <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '12px' }}>No notes yet.</div>
              ) : (
                [...notesLog].reverse().map((n, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: n.type === 'dial' ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${n.type === 'dial' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '4px' }}>
                    <div style={{ color: n.type === 'dial' ? '#60a5fa' : '#c4cdd8', fontSize: '12px' }}>{n.text}</div>
                    <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '3px' }}>{fmtET(n.timestamp)} · {n.author || '—'}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Save */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>
              {saving ? '⏳ Saving…' : '💾 Save'}
            </button>
            {saved && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓ Saved</span>}
          </div>
        </div>
      </div>
    </div>
  );
}