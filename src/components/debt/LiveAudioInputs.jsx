import AudioSetupSwitcher from '@/components/debt/AudioSetupSwitcher';
import LiveAudioInput from '@/components/debt/LiveAudioInput';
import VirtualCableDiagnostics from '@/components/debt/VirtualCableDiagnostics';

export default function LiveAudioInputs({ phase, audio: a }) {
  const hardware = a.activeAudioMode?.transport !== 'twilio';
  const disabled = phase === 'live';
  return <>
    {hardware && <LiveAudioInput devices={a.micDevices} value={a.micDeviceId}
      onChange={a.setMicDeviceId} gain={a.agentGain} onGainChange={a.setAgentGain}
      testing={a.testingAgent} onTest={a.testingAgent ? a.stopAgentTest : a.startAgentTest}
      disabled={disabled} onScan={() => a.loadDevices(true)} />}
    {hardware && <LiveAudioInput customer devices={a.micDevices} value={a.customerMicId}
      onChange={a.setCustomerMicId} gain={a.customerGain} onGainChange={a.setCustomerGain}
      testing={a.testingCustomer} onTest={a.testingCustomer ? a.stopCustomerTest : a.startCustomerTest}
      disabled={disabled} onScan={() => a.loadDevices(true)} />}
    <AudioSetupSwitcher setups={a.modes} activeIndex={a.activeSetupIndex}
      disabled={disabled||a.testingAgent||a.testingCustomer||a.savingAudioMode}
      loading={!a.audioModeReady} dirty={a.audioModeDirty} validation={a.audioModeValidation}
      message={a.audioModeDirty&&a.activeAudioMode?.saved&&!a.savingAudioMode?'':a.audioModeMessage}
      onUse={a.useAudioSetup} onRename={a.renameAudioSetup} onSave={a.saveAudioSetup}/>
    {hardware && a.outputDevices.length>0 && <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <label style={{color:'#8a9ab8',fontSize:10,letterSpacing:2,textTransform:'uppercase'}}>Preferred Output</label>
      <select aria-label="Preferred audio output" value={a.outputDeviceId} onChange={e=>a.setOutputDeviceId(e.target.value)} disabled={disabled}
        title="Preferred playback device; browser and OS determine actual output routing"
        style={{minWidth:220,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:4,padding:'8px 12px',color:'#e8e0d0',fontSize:13}}>
        <option value="">— System default output —</option>
        {a.outputDevices.map(o=><option key={o.deviceId} value={o.deviceId}>{o.label||'Speaker '+o.deviceId.slice(0,6)}</option>)}
      </select>
    </div>}
    {a.testMode && <span style={{color:'#f59e0b',fontSize:10}}>TEST MODE — Single Feed</span>}
    <VirtualCableDiagnostics
      micDevices={a.micDevices} outputDevices={a.outputDevices}
      agentId={a.micDeviceId} customerId={a.customerMicId}
      onAgentSelect={a.setMicDeviceId} onCustomerSelect={a.setCustomerMicId}
      onRescan={()=>a.loadDevices(true)} disabled={disabled}
      deviceScanMessage={a.deviceScanMessage}
      twilioMode={!hardware}
    />
  </>;
}