/**
 * LiveScriptsPanel.jsx — Separate pop-out-able scripts panel for live calls.
 * Contains: My Scripts (personal teleprompter) + Closer Pitches.
 * Uses usePopOutPanel for drag/resize with database-backed layout persistence.
 */
import { FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import LiveWindowChrome from './LiveWindowChrome';
import { DebtPitchPanel } from '@/components/debt/DebtPitchTab';
import { MyScriptsTab } from '@/components/debt/DebtScriptEditor';
import { useDebtCoachValue } from '@/lib/debtCoachStorage';

const GOLD = '#10b981';

export default function LiveScriptsPanel({ transcript, phase, panel, lead, micLabel, username, onScriptPositionChange }) {
  const [tab, setTab] = useDebtCoachValue(username, 'popout_scripts_tab', 'scripts');

  const tabs = (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={() => setTab('scripts')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${tab === 'scripts' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: tab === 'scripts' ? `${GOLD}18` : 'transparent', color: tab === 'scripts' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Scripts</button>
      <button onClick={() => setTab('pitches')} style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${tab === 'pitches' ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: tab === 'pitches' ? `${GOLD}18` : 'transparent', color: tab === 'pitches' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Pitches</button>
    </div>
  );

  const renderScripts = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '14px 16px' }}>
      <MyScriptsTab liveTranscript={transcript} phase={phase} lead={lead} clientFirstName={lead?.firstName} clientLastName={lead?.lastName} micLabel={micLabel} onScriptPositionChange={onScriptPositionChange} username={username} />
    </div>
  );

  const renderPitches = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
      <DebtPitchPanel />
    </div>
  );

  if (panel.poppedOut) {
    // Detach the floating script from the Live Call grid. An ancestor can be
    // hidden or reflowed while a new call initializes; the script must survive.
    return createPortal(
      <LiveWindowChrome panel={panel} title="Live Scripts" subtitle="Teleprompter and approved pitches" icon={FileText} onDock={panel.toggle}>
        <div style={{ flexShrink: 0, padding: '8px 12px', display: 'flex', gap: 7, background: '#101f2a', borderBottom: '1px solid #ffffff12' }}>{tabs}</div>
        {tab === 'scripts' ? renderScripts() : renderPitches()}
      </LiveWindowChrome>,
      document.body
    );
  }

  // Docked — inline with pop-out button
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {tabs}
        <button onClick={panel.toggle} style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⬆ Pop Out</button>
      </div>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: '500px', maxHeight: '70vh', overflow: 'hidden', position: 'relative' }}>
        {tab === 'scripts' ? renderScripts() : renderPitches()}
      </div>
    </div>
  );
}