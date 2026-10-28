import React from 'react';

const GOLD = '#10b981';

/**
 * Two saved audio setups (e.g. computer + Rodecaster, cell + Realtek).
 * "Use" loads that setup's saved devices; the name is editable in place and any
 * device picked afterwards is saved into the active setup.
 */
export default function AudioSetupSwitcher({ setups, activeIndex, disabled, onUse, onRename }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 0 }}>🎚 Audio Setup</label>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {(setups || []).map((s, i) => {
          const active = i === activeIndex;
          return (
            <div
              key={i}
              title={s.saved ? `Saved: ${s.micLabel || 'no mic'} → ${s.customerLabel || 'no customer input'}` : 'Nothing saved yet — pick this setup, then choose its devices'}
              style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 4px', borderRadius: '4px', border: `1px solid ${active ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(16,185,129,0.1)' : 'transparent' }}
            >
              <input
                value={s.name}
                onChange={e => onRename(i, e.target.value)}
                disabled={disabled}
                title="Click to rename this setup"
                style={{ width: '104px', background: 'transparent', border: 'none', outline: 'none', color: active ? GOLD : '#8a9ab8', fontSize: '10px', fontWeight: 'bold' }}
              />
              <button
                onClick={() => onUse(i)}
                disabled={disabled}
                title={s.saved ? `Load “${s.name}”` : `Make “${s.name}” the setup being edited`}
                style={{ background: active ? `${GOLD}22` : 'rgba(255,255,255,0.05)', color: active ? GOLD : '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '2px 6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '9px', fontWeight: 'bold', opacity: disabled ? 0.5 : 1 }}
              >
                {active ? '● Using' : 'Use'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}