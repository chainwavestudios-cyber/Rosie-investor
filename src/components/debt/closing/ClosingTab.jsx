/**
 * ClosingTab.jsx — Closing checklist tab for the Client Profile modal.
 * Loads saved closing progress from the lead record (closingProgressJson),
 * lets the agent check off steps, and persists to the database with a
 * Save button so progress carries across calls and devices.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import ClosingChecklist from './ClosingChecklist';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function ClosingTab({ lead, update, username }) {
  const [done, setDone] = useState(() => {
    if (lead?.closingProgressJson) { try { return JSON.parse(lead.closingProgressJson); } catch {} }
    try { return JSON.parse(localStorage.getItem(`closing_progress_${lead?.id || 'general'}`) || '{}'); } catch { return {}; }
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(lead?.closingProgressUpdatedAt || null);
  const [error, setError] = useState('');
  const saveTimerRef = useRef(null);

  // Reload when lead changes
  useEffect(() => {
    if (lead?.closingProgressJson) { try { setDone(JSON.parse(lead.closingProgressJson)); } catch {} }
    else { try { setDone(JSON.parse(localStorage.getItem(`closing_progress_${lead?.id || 'general'}`) || '{}')); } catch { setDone({}); } }
    setSavedAt(lead?.closingProgressUpdatedAt || null);
  }, [lead?.id]);

  // Persist to localStorage (fast cache)
  useEffect(() => {
    try { localStorage.setItem(`closing_progress_${lead?.id || 'general'}`, JSON.stringify(done)); } catch {}
  }, [done, lead?.id]);

  // Auto-save to DB (debounced 3s)
  useEffect(() => {
    if (!lead?.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await base44.entities.DebtLead.update(lead.id, {
          closingProgressJson: JSON.stringify(done),
          closingProgressUpdatedAt: new Date().toISOString(),
        });
        setSavedAt(new Date().toISOString());
      } catch {}
    }, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [done, lead?.id]);

  const handleToggle = (key) => setDone(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    if (!lead?.id) return;
    setSaving(true); setError('');
    try {
      await base44.entities.DebtLead.update(lead.id, {
        closingProgressJson: JSON.stringify(done),
        closingProgressUpdatedAt: new Date().toISOString(),
      });
      setSavedAt(new Date().toISOString());
    } catch (e) { setError('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🏁 Closing Flow Checklist</div>
      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '14px', color: '#8a9ab8', fontSize: '11px' }}>
        Track your progress through the close. Progress is saved to the client record so you can pick up exactly where you left off on the next call.
      </div>

      <ClosingChecklist leadId={lead?.id} done={done} onToggle={handleToggle} />

      {/* Save button */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={handleSave} disabled={saving || !lead?.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: saving || !lead?.id ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving || !lead?.id ? 0.5 : 1 }}>
          {saving ? '⏳ Saving…' : '💾 Save Progress'}
        </button>
        {savedAt && <span style={{ color: '#6b7280', fontSize: '10px' }}>✓ Saved {new Date(savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
      </div>
      {error && <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '11px' }}>⚠ {error}</div>}
    </div>
  );
}