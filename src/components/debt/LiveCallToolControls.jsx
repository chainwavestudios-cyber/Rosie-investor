import NoMissedMeetingsButton from '@/components/debt/NoMissedMeetingsButton';
const GOLD = '#10b981';
const types = [{ id: 'front_to_back', label: 'Front → Back', title: 'Inbound transfer — full open + close' }, { id: 'open_only', label: 'Open Only', title: 'Inbound transfer — open only, transfer at SSN' }, { id: 'cold_call', label: 'Cold Call', title: 'Outgoing cold call — ask for name, save on interest' }, { id: 'closer_call', label: 'Closer Call', title: 'Inbound — opener got SSN, transferred to you (account manager) for the close' }];
export default function LiveCallToolControls({ phase, tools: t }) {
  return <>
    <button onClick={() => t.setStatsPaused(p => !p)} title="Pause/resume auto customer stats extraction during calls" style={{ padding: '8px 14px', borderRadius: 4, border: `1px solid ${t.statsPaused ? 'rgba(107,113,128,0.2)' : GOLD + '44'}`, background: t.statsPaused ? 'rgba(255,255,255,0.03)' : GOLD + '18', color: t.statsPaused ? '#6b7280' : GOLD, cursor: 'pointer', fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{t.statsPaused ? '⏸ Stats Paused' : '▶ Stats On'}</button>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <label style={{ color: '#8a9ab8', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Call Type</label>
      <div className="dcc-call-type-options" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {types.map(type => <button key={type.id} onClick={() => t.handleCallTypeChange(type.id)} disabled={phase === 'live'} title={type.title} style={{ padding: '8px 12px', borderRadius: 4, border: `1px solid ${t.callType === type.id ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: t.callType === type.id ? GOLD + '18' : 'transparent', color: t.callType === type.id ? GOLD : '#6b7280', cursor: phase === 'live' ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{type.label}</button>)}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
      <span style={{ color: '#8a9ab8', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginRight: 4 }}>🤖 Auto:</span>
      {[{ label: '❓ Q&A', value: t.autoQA, setter: t.setAutoQA, color: '#f59e0b' }, { label: '🎯 Coach', value: t.autoCoach, setter: t.setAutoCoach, color: '#a78bfa' }, { label: '🦆 Intent', value: t.autoIntent, setter: t.setAutoIntent, color: '#60a5fa' }].filter(() => t.canLiveAI).map(({ label, value, setter, color }) => <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', whiteSpace: 'nowrap' }} title={`Auto-enable ${label} on call start (saved in layout)`}>
        <input type="checkbox" checked={value} onChange={e => setter(e.target.checked)} style={{ cursor: 'pointer', accentColor: color }} /><span style={{ color: value ? color : '#6b7280', fontSize: 10, fontWeight: value ? 'bold' : 'normal' }}>{label}</span>
      </label>)}
    </div>
    <NoMissedMeetingsButton />
    {phase === 'live' && t.canLiveAI && t.canLiveQA && <button onClick={t.toggleAgentQuestion} title="Press once, ask your question — it auto-answers when you stop speaking (Alt+Q)" style={{ padding: '8px 14px', borderRadius: 4, border: `1px solid ${t.agentQuestionActive ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.3)'}`, background: t.agentQuestionActive ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.08)', color: t.agentQuestionActive ? '#ef4444' : '#f59e0b', cursor: 'pointer', fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap', animation: t.agentQuestionActive ? 'pulse 1s infinite' : 'none' }}>{t.agentQuestionActive ? '🔴 Listening… (auto-answers when you stop)' : '🎤 Agent Question (Alt+Q)'}</button>}
  </>;
}