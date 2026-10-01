/**
 * SmartLeadsSettings.jsx — Editable view of all keywords, subreddits, distress
 * phrases, and adjustable settings used by the scraper. Reads from SmartLeadConfig
 * entity and allows manual editing (complements the AI chatbot).
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

function safeParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export default function SmartLeadsSettings({ config, onConfigChange }) {
  const [local, setLocal] = useState(config || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newItems, setNewItems] = useState({});

  useEffect(() => { setLocal(config || {}); }, [config]);

  const update = (field, value) => {
    setLocal(prev => ({ ...prev, [field]: value }));
  };

  const save = async () => {
    if (!local.id) return;
    setSaving(true);
    try {
      await base44.functions.invoke('smartLeadsChat', {
        action: 'update_config',
        updates: {
          subredditsJson: local.subredditsJson,
          searchQueriesJson: local.searchQueriesJson,
          quoraTopicsJson: local.quoraTopicsJson,
          stackExchangeFeedsJson: local.stackExchangeFeedsJson,
          categoryAJson: local.categoryAJson,
          categoryBJson: local.categoryBJson,
          categoryCJson: local.categoryCJson,
          debtAmountMin: local.debtAmountMin,
          debtAmountMax: local.debtAmountMax,
          maxPostAgeDays: local.maxPostAgeDays,
          platformsJson: local.platformsJson,
        },
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onConfigChange?.();
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  // Helper to add/remove items from JSON array fields
  const addItem = (field, item) => {
    if (!item.trim()) return;
    const arr = safeParse(local[field], []);
    if (arr.includes(item.trim())) return;
    update(field, JSON.stringify([...arr, item.trim()]));
    setNewItems(prev => ({ ...prev, [field]: '' }));
  };

  const removeItem = (field, item) => {
    const arr = safeParse(local[field], []);
    update(field, JSON.stringify(arr.filter(v => v !== item)));
  };

  const renderListEditor = (field, label, color, placeholder) => {
    const items = safeParse(local[field], []);
    const newVal = newItems[field] || '';
    return (
      <div style={{ marginBottom: '16px' }}>
        <label style={{ ...ls, color }}>{label}</label>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            value={newVal}
            onChange={e => setNewItems(prev => ({ ...prev, [field]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') addItem(field, newVal); }}
            placeholder={placeholder}
            style={{ ...inp, fontSize: '12px', flex: 1 }}
          />
          <button onClick={() => addItem(field, newVal)} style={{ background: `${color}18`, color, border: `1px solid ${color}44`, borderRadius: '4px', padding: '0 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+ Add</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {items.length === 0 ? (
            <span style={{ color: '#4a5568', fontSize: '11px' }}>No items — add one above.</span>
          ) : items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: `${color}12`, border: `1px solid ${color}33`, borderRadius: '3px' }}>
              <span style={{ color: '#c4cdd8', fontSize: '11px' }}>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
              <button onClick={() => removeItem(field, item)} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: '11px', padding: '0' }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const platforms = safeParse(local.platformsJson, []);
  const togglePlatform = (p) => {
    const next = platforms.includes(p) ? platforms.filter(v => v !== p) : [...platforms, p];
    update('platformsJson', JSON.stringify(next));
  };

  const ALL_PLATFORMS = [
    { id: 'reddit', label: 'Reddit', color: '#ff4500' },
    { id: 'quora', label: 'Quora', color: '#b92b27' },
    { id: 'stackexchange', label: 'Stack Exchange', color: '#f48024' },
    { id: 'x_twitter', label: 'X/Twitter', color: '#1d9bf0' },
    { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {/* Left column: Sources */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📡 Sources & Keywords</div>

        {/* Platforms */}
        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>Enabled Platforms</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ALL_PLATFORMS.map(p => (
              <button key={p.id} onClick={() => togglePlatform(p.id)} style={{
                padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
                background: platforms.includes(p.id) ? `${p.color}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${platforms.includes(p.id) ? p.color + '66' : 'rgba(255,255,255,0.08)'}`,
                color: platforms.includes(p.id) ? p.color : '#6b7280',
              }}>
                {platforms.includes(p.id) ? '✓' : ''} {p.label}
              </button>
            ))}
          </div>
        </div>

        {renderListEditor('subredditsJson', 'Subreddits', '#ff4500', 'e.g. Debt, CreditCards…')}
        {renderListEditor('searchQueriesJson', 'Search Queries', BLUE, 'e.g. credit card debt, drowning in debt…')}
        {renderListEditor('quoraTopicsJson', 'Quora Topics', '#b92b27', 'e.g. Debt, Credit-Cards…')}
        {renderListEditor('stackExchangeFeedsJson', 'Stack Exchange Feed URLs', '#f48024', 'https://money.stackexchange.com/feeds…')}
      </div>

      {/* Right column: Matching & Settings */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🎯 Distress Phrases & Settings</div>

        {renderListEditor('categoryAJson', 'Category A — Screwed/Drowning', RED, 'e.g. 50k in credit card debt…')}
        {renderListEditor('categoryCJson', 'Category C — Multi-Card/Interest', PURPLE, 'e.g. paying $1000 a month in interest…')}

        {/* Category B (rules with require) — show as read-only count for now */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ ...ls, color: AMBER }}>Category B — Emotional Panic Rules</label>
          <div style={{ color: '#6b7280', fontSize: '11px' }}>
            {safeParse(local.categoryBJson, []).length} rules configured. Use the AI chat to add/modify these rules (they have context requirements).
          </div>
        </div>

        {/* Numeric settings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div>
            <label style={ls}>Min Debt ($)</label>
            <input type="number" value={local.debtAmountMin ?? 10000} onChange={e => update('debtAmountMin', Number(e.target.value))} style={inp} />
          </div>
          <div>
            <label style={ls}>Max Debt ($)</label>
            <input type="number" value={local.debtAmountMax ?? 200000} onChange={e => update('debtAmountMax', Number(e.target.value))} style={inp} />
          </div>
          <div>
            <label style={ls}>Max Post Age (days)</label>
            <input type="number" value={local.maxPostAgeDays ?? 60} onChange={e => update('maxPostAgeDays', Number(e.target.value))} style={inp} />
          </div>
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={save} disabled={saving || !local.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: saving || !local.id ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving || !local.id ? 0.5 : 1 }}>
            {saving ? '⏳ Saving…' : '💾 Save Settings'}
          </button>
          {saved && <span style={{ color: GOLD, fontSize: '12px' }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}