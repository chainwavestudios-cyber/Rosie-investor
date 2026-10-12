import React from 'react';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function AIAgentKnowledgeSection({ config, update, fronterKbCount, debtKbCount }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      <div>
        <label style={ls}>Primary Knowledge Base (authoritative)</label>
        <select value={config.kbPrimary || 'fronter'} onChange={e => update('kbPrimary', e.target.value)} style={inp}>
          <option value="fronter">/fronter KB ({fronterKbCount} entries)</option>
          <option value="debtcallcoach">/debtcallcoach KB ({debtKbCount} entries)</option>
        </select>
      </div>
      <div>
        <label style={ls}>Secondary Knowledge Base (supplementary)</label>
        <select value={config.kbSecondary || 'debtcallcoach'} onChange={e => update('kbSecondary', e.target.value)} style={inp}>
          <option value="fronter">/fronter KB ({fronterKbCount} entries)</option>
          <option value="debtcallcoach">/debtcallcoach KB ({debtKbCount} entries)</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>
  );
}