import LiveAudioInputs from '@/components/debt/LiveAudioInputs';
import LiveCallToolControls from '@/components/debt/LiveCallToolControls';
import LiveCallRecording from '@/components/debt/LiveCallRecording';
import LiveCallSearch from '@/components/debt/LiveCallSearch';
const GOLD = '#10b981';
export default function LiveCallControls({ phase, lead, showCustomerStats, setShowCustomerStats, setShowProfile, audio, tools, session, recorder, onRecord, layout, dgStatus, lineCount }) {
  const phaseColor = { idle: '#6b7280', live: '#ef4444', ended: '#8a9ab8' }[phase];
  const dgColor = dgStatus === 'connected' ? '#4ade80' : ['connecting', 'reconnecting'].includes(dgStatus) ? '#f59e0b' : dgStatus === 'error' ? '#ef4444' : '#6b7280';
  return <>
    <div className="dcc-live-utility" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '9px 12px', margin: '0 0 9px', border: '1px solid rgba(148,188,176,.20)', borderRadius: 9, background: 'linear-gradient(110deg,#12242e,#142b2d 55%,#101e2d)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 10, fontWeight: 820, letterSpacing: 1.4, color: '#d8b56d' }}>LIVE CALL CONTROL</span><span style={{ fontSize: 10, color: '#91b0ac' }}>{phase === 'live' ? 'Audio and coaching active · full contact and Q&A popped out' : 'Devices and call tools ready when you are'}</span></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="dcc-live-control" onClick={() => setShowCustomerStats(s => !s)} aria-pressed={showCustomerStats} style={{ cursor: 'pointer', padding: '7px 10px', border: '1px solid ' + (showCustomerStats ? '#64d5ab' : '#3b6b64'), background: showCustomerStats ? '#184a3d' : '#18302f', color: '#c6f2de', borderRadius: 8, fontWeight: 750, fontSize: 11 }}>◈ {showCustomerStats ? 'Hide' : 'Open'} Customer Insights</button>
        <button type="button" className="dcc-live-control" onClick={() => setShowProfile(true)} disabled={!lead.id} style={{ cursor: lead.id ? 'pointer' : 'not-allowed', padding: '7px 10px', border: '1px solid rgba(116,191,160,.44)', background: 'rgba(24,100,78,.13)', color: lead.id ? '#c6f2de' : '#657f84', borderRadius: 8, fontWeight: 750, fontSize: 11 }}>▣ Client Profile</button>
        <span style={{ fontSize: 10, letterSpacing: '.3px', color: phase === 'live' ? '#ffaf9f' : '#9bdabe', padding: '6px 9px', background: phase === 'live' ? '#352222' : '#18392e', border: '1px solid ' + (phase === 'live' ? '#97504e' : '#376b58'), borderRadius: 99, fontWeight: 850 }}>{phase === 'live' ? '● LIVE CALL' : phase === 'ended' ? 'CALL ENDED' : '● READY'}</span>
      </div>
    </div>
    <div className="dcc-live-setup-bar" style={{ marginBottom: 11, padding: '10px 12px', background: 'linear-gradient(115deg,rgba(15,38,46,.88),rgba(15,26,41,.9))', border: '1px solid rgba(122,184,163,.24)', borderRadius: 10, display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
      <LiveAudioInputs phase={phase} audio={audio} />
      <LiveCallToolControls phase={phase} tools={tools} />
      <LiveCallRecording phase={phase} recorder={recorder} onRecord={onRecord} />
      <LiveCallSearch phase={phase} session={session} />
      {phase === 'ended' && <button onClick={() => session.startCall(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>🔄 New Call</button>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: phaseColor + '18', border: '1px solid ' + phaseColor + '44', borderRadius: 20 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: phaseColor, animation: phase === 'live' ? 'pulse 1s infinite' : 'none' }} /><span style={{ color: phaseColor, fontSize: 11, fontWeight: 'bold' }}>{phase === 'live' ? '● LIVE' : phase === 'ended' ? 'Ended' : 'Ready'}</span></span>
      {phase === 'live' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: dgColor + '18', border: '1px solid ' + dgColor + '44', borderRadius: 20 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: dgColor, animation: ['connecting', 'reconnecting'].includes(dgStatus) ? 'pulse .8s infinite' : 'none' }} /><span style={{ color: dgColor, fontSize: 11, fontWeight: 'bold' }}>Deepgram: {dgStatus}</span></span>}
      <span style={{ color: '#6b7280', fontSize: 11 }}>{lineCount} lines</span>
    </div>
  </>;
}