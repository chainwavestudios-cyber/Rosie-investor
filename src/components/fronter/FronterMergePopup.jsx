/**
 * FronterMergePopup.jsx — Popup shown when all checklist items are complete.
 * Shows the merge call script (super admin can edit on the fly) + phone controls.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import { renderFormatted } from '@/components/debt/ScriptRichText';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

const DEFAULT_MERGE_SCRIPT = `Alright {{firstname}}, I've got a senior debt advisor ready to help you through this. I'm going to connect you now — stay on the line and they'll be right with you.`;

export default function FronterMergePopup({ lead, username, fronterFirstName, isAdmin, callActive, callDuration, onMerge, onClose, transferScript }) {
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const loadScript = useCallback(async () => {
    // If a transfer script was passed from the Completed Steps button, use it directly
    if (transferScript) {
      setScript({ content: transferScript });
      setLoading(false);
      return;
    }
    try {
      const results = await base44.entities.FronterScript.filter({ name: '🔀 Merge Call Script' });
      const all = Array.isArray(results) ? results : (results?.items || []);
      const existing = all[0];
      if (existing) {
        setScript(existing);
      } else {
        const created = await base44.entities.FronterScript.create({
          name: '🔀 Merge Call Script',
          scriptType: 'close',
          content: DEFAULT_MERGE_SCRIPT,
          color: '#e8e0d0',
          fontSize: 16,
          sortOrder: 999,
        });
        setScript(created);
      }
    } catch (e) { console.error('Merge script load:', e); }
    setLoading(false);
  }, [transferScript]);

  useEffect(() => { loadScript(); }, [loadScript]);

  const handleSave = async () => {
    if (!script) return;
    setSaving(true);
    try {
      await base44.entities.FronterScript.update(script.id, { content: editText });
      setScript(prev => ({ ...prev, content: editText }));
      setEditMode(false);
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const fmtDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <FronterPopup title="🔀 Merge Call" subtitle="All checklist items complete" accent={GOLD} onClose={onClose} initialSize={{ w: 480, h: 580 }} minW={360} minH={400} zIndex={10500}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Call status — phone screen copy */}
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: callActive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${callActive ? GOLD + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: callActive ? GOLD : '#6b7280', fontSize: '11px', fontWeight: 'bold' }}>
              {callActive ? '📞 Call Active' : '📞 No Active Call'}
            </div>
            {callActive && <div style={{ color: '#e8e0d0', fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtDuration(callDuration)}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{lead?.firstName} {lead?.lastName}</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{lead?.phone}</div>
          </div>
        </div>

        {/* Merge script */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Merge Script</span>
            {isAdmin && !editMode && (
              <button onClick={() => { setEditText(script?.content || ''); setEditMode(true); }} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✏️ Edit</button>
            )}
            {editMode && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{saving ? '⏳' : '💾 Save'}</button>
                <button onClick={() => setEditMode(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
              </div>
            )}
          </div>
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading…</div>
          ) : editMode ? (
            <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1, width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '14px', color: '#e8e0d0', fontSize: '14px', lineHeight: 1.7, fontFamily: 'Georgia, serif', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ color: '#e8e0d0', fontSize: '16px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
                {renderFormatted(substituteScriptVars(script?.content || DEFAULT_MERGE_SCRIPT, { lead, fronterFirstName }))}
              </div>
            </div>
          )}
        </div>

        {/* Phone controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={onMerge}
            disabled={!callActive}
            style={{
              flex: 1,
              background: callActive ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(255,255,255,0.05)',
              color: callActive ? DARK : '#6b7280',
              border: 'none',
              borderRadius: '6px',
              padding: '14px',
              cursor: callActive ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: callActive ? 1 : 0.5,
            }}
          >
            🔀 Merge & Transfer
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#6b7280',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '14px 20px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </FronterPopup>
  );
}