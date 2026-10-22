/**
 * DebtScriptsPanel.jsx — Standalone scripts panel for the Scripts tab.
 * Shows personal scripts (teleprompter-ready) with a Pitches sub-tab.
 * Designed to be wrapped in PopOutTab for pop-out/drag/resize behavior.
 */
import { useState } from 'react';
import { DebtPitchPanel } from '@/components/debt/DebtPitchTab';
import { MyScriptsTab } from '@/components/debt/DebtScriptEditor';

const GOLD = '#10b981';

export default function DebtScriptsPanel({ username, lead, liveTranscript, phase }) {
  const [tab, setTab] = useState('scripts');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexShrink: 0 }}>
        <button
          onClick={() => setTab('scripts')}
          style={{
            padding: '6px 14px', borderRadius: '4px',
            border: `1px solid ${tab === 'scripts' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`,
            background: tab === 'scripts' ? `${GOLD}18` : 'transparent',
            color: tab === 'scripts' ? GOLD : '#6b7280',
            cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
            fontFamily: 'Georgia, serif',
          }}
        >
          📝 My Scripts
        </button>
        <button
          onClick={() => setTab('pitches')}
          style={{
            padding: '6px 14px', borderRadius: '4px',
            border: `1px solid ${tab === 'pitches' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`,
            background: tab === 'pitches' ? `${GOLD}18` : 'transparent',
            color: tab === 'pitches' ? GOLD : '#6b7280',
            cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
            fontFamily: 'Georgia, serif',
          }}
        >
          🎤 Pitches
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'scripts'
          ? <MyScriptsTab username={username} lead={lead} liveTranscript={liveTranscript} phase={phase} clientFirstName={lead?.firstName} clientLastName={lead?.lastName} />
          : <DebtPitchPanel />}
      </div>
    </div>
  );
}