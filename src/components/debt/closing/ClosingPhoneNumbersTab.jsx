/**
 * ClosingPhoneNumbersTab.jsx — Manages the phone numbers given to customers
 * when they sign up (customer service, creditor relations, etc.).
 * Admins/managers can add/edit/delete; dialers can view and copy.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function ClosingPhoneNumbersTab({ canEdit = false }) {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', phoneNumber: '', description: '', sortOrder: 0 });
  const [copiedId, setCopiedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    base44.entities.ClosingPhoneNumber.list('sortOrder', 200)
      .then(rows => setNumbers(rows || []))
      .catch(() => setNumbers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ label: '', phoneNumber: '', description: '', sortOrder: 0 });

  const handleAdd = async () => {
    if (!form.label.trim() || !form.phoneNumber.trim()) return;
    setSaving(true);
    try {
      await base44.entities.ClosingPhoneNumber.create({
        label: form.label.trim(),
        phoneNumber: form.phoneNumber.trim(),
        description: form.description.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      });
      resetForm(); setAdding(false); load();
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await base44.entities.ClosingPhoneNumber.update(editingId, {
        label: form.label.trim(),
        phoneNumber: form.phoneNumber.trim(),
        description: form.description.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      });
      setEditingId(null); resetForm(); load();
    } catch (e) { alert('Update failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this phone number?')) return;
    try { await base44.entities.ClosingPhoneNumber.delete(id); load(); }
    catch (e) { alert('Delete failed: ' + (e?.message || String(e))); }
  };

  const startEdit = (n) => {
    setEditingId(n.id); setAdding(false);
    setForm({ label: n.label || '', phoneNumber: n.phoneNumber || '', description: n.description || '', sortOrder: n.sortOrder || 0 });
  };

  const copy = (n) => {
    navigator.clipboard?.writeText(n.phoneNumber || '').then(() => {
      setCopiedId(n.id); setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  const showForm = adding || editingId;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>📞 Enrollment Phone Numbers</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>Numbers to give the customer when they sign up</div>
        </div>
        {canEdit && !showForm && (
          <button onClick={() => { setAdding(true); resetForm(); }} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+ Add Number</button>
        )}
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>{editingId ? '✏️ Edit Number' : '+ Add Number'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={ls}>Label</label><input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Customer Service" style={inp} /></div>
            <div><label style={ls}>Phone Number</label><input value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="(555) 123-4567" style={inp} /></div>
          </div>
          <div style={{ marginBottom: '10px' }}><label style={ls}>Description / When to give</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Give this to the customer after enrollment for any account questions…" /></div>
          <div style={{ marginBottom: '10px', width: '100px' }}><label style={ls}>Sort Order</label><input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} style={inp} /></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={editingId ? handleUpdate : handleAdd} disabled={saving || !form.label.trim() || !form.phoneNumber.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: saving || !form.label.trim() || !form.phoneNumber.trim() ? 0.5 : 1 }}>{saving ? '⏳' : '✓ Save'}</button>
            <button onClick={() => { setAdding(false); setEditingId(null); resetForm(); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>Loading…</div>
      ) : numbers.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No phone numbers added yet.{canEdit ? ' Click "Add Number" to create the list agents give to customers at enrollment.' : ' An admin needs to add them first.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {numbers.map(n => (
            <div key={n.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>{n.label}</div>
                  <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold', fontFamily: 'Georgia, serif', marginTop: '2px' }}>{n.phoneNumber}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => copy(n)} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{copiedId === n.id ? '✓ Copied' : '📋 Copy'}</button>
                  {canEdit && <>
                    <button onClick={() => startEdit(n)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px' }}>✏️</button>
                    <button onClick={() => handleDelete(n.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                  </>}
                </div>
              </div>
              {n.description && <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '6px', lineHeight: 1.5 }}>{n.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}