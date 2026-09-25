/**
 * KeyFactsPanel.jsx — Displays key facts/memories about a prospect that persist across calls.
 * Shows personal details, family info, life events, follow-ups, and hot buttons.
 * Memories are surfaced in the AI Coach so the agent can reference them naturally.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const FACT_TYPES = [
  { id: 'personal', label: '👤 Personal', color: '#60a5fa' },
  { id: 'family', label: '👨‍👩‍👧 Family', color: '#f472b6' },
  { id: 'financial', label: '💰 Financial', color: '#4ade80' },
  { id: 'preference', label: '⚙️ Preference', color: '#8a9ab8' },
  { id: 'life_event', label: '📅 Life Event', color: '#f59e0b' },
  { id: 'follow_up', label: '🔔 Follow Up', color: '#fb923c' },
  { id: 'hot_button', label: '🔥 Hot Button', color: '#ef4444' },
  { id: 'commitment', label: '✅ Commitment', color: '#a78bfa' },
  { id: 'objection', label: '🚫 Objection', color: '#dc2626' },
];

const TYPE_COLORS = {
  personal: '#60a5fa', family: '#f472b6', financial: '#4ade80', preference: '#8a9ab8',
  life_event: '#f59e0b', follow_up: '#fb923c', hot_button: '#ef4444', commitment: '#a78bfa', objection: '#dc2626',
};

export default function KeyFactsPanel({ leadId, leadName, compact = false }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newFact, setNewFact] = useState({ factType: 'personal', factText: '', context: '', importance: 'medium' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!leadId) { setMemories([]); return; }
    setLoading(true);
    try {
      const rows = await base44.entities.LeadMemory.filter({ leadId }, '-created_date', 200);
      setMemories(rows || []);
    } catch { setMemories([]); }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  // Listen for memory updates from fact extraction
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('lead_memories_updated', handler);
    return () => window.removeEventListener('lead_memories_updated', handler);
  }, [load]);

  const addFact = async () => {
    if (!newFact.factText.trim() || !leadId) return;
    setSaving(true);
    try {
      await base44.entities.LeadMemory.create({
        leadId,
        leadName: leadName || '',
        factType: newFact.factType,
        factText: newFact.factText.trim(),
        context: newFact.context.trim(),
        importance: newFact.importance,
        callDate: new Date().toISOString(),
      });
      setNewFact({ factType: 'personal', factText: '', context: '', importance: 'medium' });
      setShowAdd(false);
      await load();
      window.dispatchEvent(new CustomEvent('lead_memories_updated'));
    } catch (e) { alert('Failed to save: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const deleteFact = async (id) => {
    if (!window.confirm('Delete this memory?')) return;
    await base44.entities.LeadMemory.delete(id);
    await load();
    window.dispatchEvent(new CustomEvent('lead_memories_updated'));
  };

  const resolveFact = async (id, resolved) => {
    await base44.entities.LeadMemory.update(id, { isResolved: !resolved });
    await load();
  };

  // Group by type
  const grouped = memories.reduce((acc, m) => {
    const t = m.factType || 'personal';
    if (!acc[t]) acc[t] = [];
    acc[t].push(m);
    return acc;
  }, {});

  // Sort: high importance first, then by date
  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const aHigh = grouped[a].some(m => m.importance === 'high');
    const bHigh = grouped[b].some(m => m.importance === 'high');
    if (aHigh && !bHigh) return -1;
    if (!aHigh && bHigh) return 1;
    return 0;
  });

  const now = Date.now();
  const isOverdue = (m) => m.followUpDate && new Date(m.followUpDate).getTime() < now && !m.isResolved;
  const isUpcoming = (m) => m.followUpDate && new Date(m.followUpDate).getTime() >= now && !m.isResolved;

  if (compact) {
    // Compact mode — for embedding in the AI popup coach section
    const highPriority = memories.filter(m => m.importance === 'high' || isOverdue(m) || isUpcoming(m));
    if (highPriority.length === 0 && memories.length === 0) {
      return (
        <div style={{ padding: '8px 10px', color: '#4a5568', fontSize: '11px', textAlign: 'center' }}>
          No key facts stored yet. They auto-extract from calls, or add manually in User Profiles.
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {(highPriority.length > 0 ? highPriority : memories.slice(0, 5)).map(m => {
          const color = TYPE_COLORS[m.factType] || '#8a9ab8';
          const overdue = isOverdue(m);
          return (
            <div key={m.id} style={{ background: overdue ? 'rgba(239,68,68,0.08)' : `${color}08`, border: `1px solid ${overdue ? 'rgba(239,68,68,0.3)' : color + '22'}`, borderRadius: '4px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '10px', flexShrink: 0 }}>{FACT_TYPES.find(t => t.id === m.factType)?.label.split(' ')[0] || '📌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: overdue ? '#ef4444' : '#e8e0d0', fontSize: '11px', lineHeight: 1.4 }}>{m.factText}</div>
                  {m.followUpDate && !m.isResolved && (
                    <div style={{ color: overdue ? '#ef4444' : '#fb923c', fontSize: '9px', marginTop: '2px' }}>
                      {overdue ? '⚠ OVERDUE — ' : '🔔 '}{new Date(m.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
                {m.importance === 'high' && <span style={{ color: '#ef4444', fontSize: '9px', flexShrink: 0 }}>★</span>}
              </div>
            </div>
          );
        })}
        {memories.length > highPriority.length && highPriority.length > 0 && (
          <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', padding: '2px' }}>
            +{memories.length - highPriority.length} more facts
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🧠 Key Facts & Memory</div>
          <div style={{ color: '#6b7280', fontSize: '11px' }}>{memories.length} facts stored — surfaced in AI Coach on follow-up calls</div>
        </div>
        <button onClick={() => setShowAdd(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+ Add Fact</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ marginBottom: '14px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={ls}>Type</label>
              <select value={newFact.factType} onChange={e => setNewFact(p => ({ ...p, factType: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                {FACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={ls}>Importance</label>
              <select value={newFact.importance} onChange={e => setNewFact(p => ({ ...p, importance: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                <option value="high">★ High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={ls}>Key Fact</label>
            <input value={newFact.factText} onChange={e => setNewFact(p => ({ ...p, factText: e.target.value }))} placeholder="e.g., Wife's name is Sarah, birthday is October 15" style={inp} />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={ls}>Context (optional)</label>
            <input value={newFact.context} onChange={e => setNewFact(p => ({ ...p, context: e.target.value }))} placeholder="How it came up" style={inp} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addFact} disabled={saving || !newFact.factText.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (saving || !newFact.factText.trim()) ? 0.5 : 1 }}>{saving ? '⏳ Saving…' : '💾 Save Fact'}</button>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>Loading memories…</div>}

      {/* Empty state */}
      {!loading && memories.length === 0 && !showAdd && (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 20px', fontSize: '13px', background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🧠</div>
          No key facts stored yet for this prospect.<br />
          <span style={{ fontSize: '11px' }}>Facts auto-extract from calls. The AI Coach will surface them on follow-up calls to build rapport.</span>
        </div>
      )}

      {/* Memories grouped by type */}
      {!loading && sortedTypes.map(type => {
        const facts = grouped[type];
        const typeInfo = FACT_TYPES.find(t => t.id === type) || { label: '📌 Other', color: '#8a9ab8' };
        const color = TYPE_COLORS[type] || '#8a9ab8';
        return (
          <div key={type} style={{ marginBottom: '14px' }}>
            <div style={{ color, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 'bold' }}>{typeInfo.label} ({facts.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {facts.map(m => {
                const overdue = isOverdue(m);
                const upcoming = isUpcoming(m);
                return (
                  <div key={m.id} style={{ background: overdue ? 'rgba(239,68,68,0.06)' : m.isResolved ? 'rgba(255,255,255,0.02)' : `${color}06`, border: `1px solid ${overdue ? 'rgba(239,68,68,0.25)' : m.isResolved ? 'rgba(255,255,255,0.06)' : color + '22'}`, borderRadius: '4px', padding: '10px 12px', opacity: m.isResolved ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: m.isResolved ? '#6b7280' : '#e8e0d0', fontSize: '12px', lineHeight: 1.5, textDecoration: m.isResolved ? 'line-through' : 'none' }}>{m.factText}</div>
                        {m.context && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px', fontStyle: 'italic' }}>Context: {m.context}</div>}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {m.importance === 'high' && <span style={{ color: '#ef4444', fontSize: '9px', fontWeight: 'bold' }}>★ HIGH</span>}
                          {m.callDate && <span style={{ color: '#4a5568', fontSize: '9px' }}>{new Date(m.callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                          {upcoming && <span style={{ color: '#fb923c', fontSize: '9px', fontWeight: 'bold' }}>🔔 Follow up by {new Date(m.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                          {overdue && <span style={{ color: '#ef4444', fontSize: '9px', fontWeight: 'bold' }}>⚠ OVERDUE — follow up now!</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => resolveFact(m.id, m.isResolved)} title={m.isResolved ? 'Mark as active' : 'Mark as resolved'} style={{ background: 'none', border: 'none', color: m.isResolved ? '#4ade80' : '#4a5568', cursor: 'pointer', fontSize: '14px' }}>{m.isResolved ? '↩' : '✓'}</button>
                        <button onClick={() => deleteFact(m.id)} style={{ background: 'none', border: 'none', color: '#ef444466', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}