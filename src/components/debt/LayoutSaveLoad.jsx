/**
 * LayoutSaveLoad.jsx — Save and restore popped-out panel layouts to/from the database.
 * Save: collects all `popout_*` entries from database-backed storage, prompts for
 *       a name, and stores the bundle in the SavedLayout entity.
 * Open: lists the current user's saved layouts, writes the chosen one back to
 *       database-backed storage, and dispatches a `layout_restored` event so all
 *       pop-out panels (usePopOutPanel + CustomerStatsPopup) re-read their positions.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getAllDebtCoachValues, setAllDebtCoachValues } from '@/lib/debtCoachStorage';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';

const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

// Collect every popout_* entry from database-backed storage into a single object
async function collectLayoutData(username) {
  const allValues = await getAllDebtCoachValues(username);
  const data = {};
  for (const [key, val] of Object.entries(allValues)) {
    if (key.startsWith('popout_')) data[key] = val;
  }
  return data;
}

// Write a saved layout bundle back to database-backed storage and notify all panels
async function applyLayoutData(username, layoutData) {
  const entries = {};
  for (const [key, val] of Object.entries(layoutData)) {
    if (key.startsWith('popout_')) entries[key] = val;
  }
  await setAllDebtCoachValues(username, entries);
  window.dispatchEvent(new CustomEvent('layout_restored'));
}

export default function LayoutSaveLoad({ username }) {
  const [showSave, setShowSave] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [layouts, setLayouts] = useState([]);
  const [loadingLayouts, setLoadingLayouts] = useState(false);
  const [error, setError] = useState('');

  const loadLayouts = useCallback(async () => {
    if (!username) return;
    setLoadingLayouts(true);
    try {
      const rows = await base44.entities.SavedLayout.filter({ username }, '-created_date', 100);
      setLayouts(rows || []);
    } catch (e) { setError('Failed to load layouts: ' + (e?.message || String(e))); }
    setLoadingLayouts(false);
  }, [username]);

  const handleSave = async () => {
    if (!layoutName.trim() || !username) return;
    setSaving(true); setError('');
    try {
      const data = await collectLayoutData(username);
      await base44.entities.SavedLayout.create({
        layoutName: layoutName.trim(),
        username,
        layoutDataJson: JSON.stringify(data),
      });
      setSaveMsg('✓ Layout saved!');
      setLayoutName('');
      setShowSave(false);
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e) { setError('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const handleOpen = async (layout) => {
    try {
      const data = JSON.parse(layout.layoutDataJson);
      await applyLayoutData(username, data);
      setShowOpen(false);
      setSaveMsg('✓ Layout applied!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e) { setError('Failed to apply layout: ' + (e?.message || String(e))); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this layout?')) return;
    try {
      await base44.entities.SavedLayout.delete(id);
      loadLayouts();
    } catch (e) { setError('Delete failed: ' + (e?.message || String(e))); }
  };

  // Clear message when opening a new modal
  useEffect(() => { setError(''); }, [showSave, showOpen]);

  return (
    <>
      {/* Buttons row */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
        <button
          onClick={() => { setShowSave(true); setSaveMsg(''); }}
          style={{ flex: 1, padding: '6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, letterSpacing: '1px', textTransform: 'uppercase' }}
        >
          💾 Save Layout
        </button>
        <button
          onClick={() => { setShowOpen(true); loadLayouts(); }}
          style={{ flex: 1, padding: '6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, letterSpacing: '1px', textTransform: 'uppercase' }}
        >
          📂 Open Layout
        </button>
      </div>
      {saveMsg && <div style={{ color: '#4ade80', fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>{saveMsg}</div>}

      {/* Save modal */}
      {showSave && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowSave(false)}>
          <div style={{ background: DARK, border: `1px solid ${GOLD}44`, borderRadius: '8px', maxWidth: '400px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>💾 Save Current Layout</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '14px' }}>Enter a name for this layout. All popped-out window positions and sizes will be saved.</div>
            <input value={layoutName} onChange={e => setLayoutName(e.target.value)} placeholder="e.g. Dual Monitor, Single Screen…" style={inp} autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
            {error && <div style={{ color: RED, fontSize: '11px', marginTop: '8px' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={handleSave} disabled={saving || !layoutName.trim()} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: saving || !layoutName.trim() ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving || !layoutName.trim() ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowSave(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 16px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Open modal */}
      {showOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowOpen(false)}>
          <div style={{ background: DARK, border: `1px solid ${BLUE}44`, borderRadius: '8px', maxWidth: '420px', width: '100%', padding: '24px', maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>📂 Open Saved Layout</div>
            {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '10px' }}>⚠ {error}</div>}
            {loadingLayouts ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px', fontSize: '12px' }}>Loading layouts…</div>
            ) : layouts.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No saved layouts yet. Click "Save Layout" to create one.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {layouts.map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px' }}>
                    <button onClick={() => handleOpen(l)} style={{ flex: 1, background: 'none', border: 'none', color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}>
                      {l.layoutName}
                    </button>
                    <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0 }}>{l.created_date ? new Date(l.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                    <button onClick={() => handleDelete(l.id)} title="Delete layout" style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: '12px', padding: '2px 6px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowOpen(false)} style={{ marginTop: '14px', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '11px' }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}