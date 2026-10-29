import AudioSetupSwitcher from '@/components/debt/AudioSetupSwitcher';
import LiveAudioInput from '@/components/debt/LiveAudioInput';
import { isLoopbackSource } from '@/lib/audioDevices';
const warning = { color: '#f59e0b', fontSize: 9, maxWidth: 260, lineHeight: 1.4 };
export default function LiveAudioInputs({ phase, audio: a }) {
  const hardware = a.activeAudioMode?.transport !== 'twilio';
  const agentLabel = a.micDevices.find(d => d.deviceId === a.micDeviceId)?.label || '';
  return <>
    {hardware && <LiveAudioInput devices={a.micDevices} value={a.micDeviceId} onChange={a.setMicDeviceId} gain={a.agentGain} onGainChange={a.setAgentGain} testing={a.testingAgent} onTest={a.testingAgent ? a.stopAgentTest : a.startAgentTest} disabled={phase === 'live'}>
      {/rode|røde/i.test(agentLabel) && <span style={warning}>Fader down but still heard? Check the RØDECaster USB output is post-fader or linked to the main mix. Pre-fader audio ignores the physical slider.</span>}
    </LiveAudioInput>}
    {hardware && <LiveAudioInput customer devices={a.customerInputs} value={a.customerMicId} onChange={a.setCustomerMicId} gain={a.customerGain} onGainChange={a.setCustomerGain} testing={a.testingCustomer} onTest={a.testingCustomer ? a.stopCustomerTest : a.startCustomerTest} disabled={phase === 'live'} onScan={() => a.loadDevices(true)} inputCount={a.micDevices.length}>
      {a.micDevices.length > 0 && a.customerInputs.length === 0 && <span style={warning}>⚠ No loopback input found. Enable “Stereo Mix” (or your virtual cable) in Windows sound settings, then re-scan. Microphones are not allowed on this channel.</span>}
      {a.customerMicId && a.customerLabelSelected && !isLoopbackSource(a.customerLabelSelected) && <span style={warning}>⚠ “{a.customerLabelSelected}” is a microphone. Pick a customer-only loopback input.</span>}
    </LiveAudioInput>}
    <AudioSetupSwitcher setups={a.modes} activeIndex={a.activeSetupIndex} disabled={phase === 'live' || a.testingAgent || a.testingCustomer || a.savingAudioMode} loading={!a.audioModeReady} dirty={a.audioModeDirty} validation={a.audioModeValidation} message={a.audioModeDirty && a.activeAudioMode?.saved && !a.savingAudioMode ? '' : a.audioModeMessage} onUse={a.useAudioSetup} onRename={a.renameAudioSetup} onSave={a.saveAudioSetup} />
    {hardware && a.outputDevices.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ color: '#8a9ab8', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>🔊 Preferred Output</label>
      <select value={a.outputDeviceId} onChange={e => a.setOutputDeviceId(e.target.value)} disabled={phase === 'live'} title="Stored as a preferred playback device; browser/system output routing remains in effect" style={{ minWidth: 220, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '8px 12px', color: '#e8e0d0', fontSize: 13 }}>
        <option value="">— System default output —</option>
        {a.outputDevices.map(o => <option key={o.deviceId} value={o.deviceId}>{o.label || `Speaker ${o.deviceId.slice(0, 6)}`}</option>)}
      </select>
    </div>}
    {a.testMode ? <span style={{ color: '#f59e0b', fontSize: 10 }}>🧪 TEST MODE — Single Feed</span> : hardware && a.customerMicId && a.micDeviceId ? <span style={{ color: '#60a5fa', fontSize: 10 }}>DUAL CHANNEL</span> : null}
  </>;
}