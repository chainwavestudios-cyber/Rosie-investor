import AudioSetupSwitcher from '@/components/debt/AudioSetupSwitcher';
import LiveAudioInput from '@/components/debt/LiveAudioInput';
import { findIsolatedInput, isLoopbackSource, isMasterMixInput, isRodeVirtualMicInput } from '@/lib/audioDevices';
import { RODE_VIRTUAL_INPUT_GUIDE } from '@/lib/audioChannels';

const warning = { color: '#ffcd8b', fontSize: 11, lineHeight: 1.6, maxWidth: 340 };
const mixHint = {
  background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)',
  color: '#fbd48b', borderRadius: 5, padding: '7px 10px', cursor: 'pointer',
  fontSize: 10, lineHeight: 1.5, textAlign: 'left', maxWidth: 340
};
const okHint = { color: '#84e2b0', fontSize: 11, lineHeight: 1.5 };
const linkStyle = { color: '#e2bd7c', fontWeight: 800, textDecoration: 'underline' };

const TrackHint = ({ channel, capture }) => {
  if (!channel || !capture) return null;
  if (!capture.supported) return (
    <div style={warning} role="status">
      <strong>USB Track {channel} is not available to this browser.</strong>
      <div>{capture.reason}</div>
      <div style={{ color: '#abbfbd', marginTop: 5 }}>
        The mixer can transmit multitrack while Chrome/Windows receives only
        mono or stereo. Re-selecting the same device cannot reveal its hidden channels.
      </div>
    </div>
  );
  return <div style={okHint} role="status">
    Browser confirmed {capture.actual} captured channel{capture.actual===1?'':'s'}.
    USB Track {channel} can now be tested for an isolated mic signal.
  </div>;
};

/**
 * RØDE's 2026 Windows Virtual Devices Driver exposes individual fader sources
 * as actual browser-selectable microphones. This avoids trying to reach USB 3
 * from getUserMedia(), which may silently downmix the interface to stereo.
 */
function RodeInputGuide({ devices, currentDevice, channel, capture, onSelect, onChannelChange, onRescan, disabled, testing }) {
  const label = devices.find(d=>d.deviceId===currentDevice)?.label||'';
  const isRode = /r[øo]de|rodecaster/i.test(label) || devices.some(d=>/rodecaster/i.test(d.label||''));
  if (!isRode) return null;
  const virtualInputs = devices.filter(d=>isRodeVirtualMicInput(d.label||'') && d.deviceId!=='default' && d.deviceId!=='communications');
  const selectedIsVirtual = isRodeVirtualMicInput(label);
  const blocked = channel>0 && capture && !capture.supported;
  return (
    <section aria-label="RØDECaster isolated microphone setup" style={{
      background: blocked?'#34251c':'#0d2330',border:'1px solid '+(blocked?'#c39855':'#4e7779'),
      borderRadius:8,padding:'12px 13px',marginTop:9,maxWidth:390,
      display:'flex',flexDirection:'column',gap:8,
    }}>
      <strong style={{fontSize:12,color:'#efd49c'}}>RØDECaster · Isolated Mic Setup</strong>
      {selectedIsVirtual
        ? <div style={okHint}>Independent fader input selected. Keep the Track menu at <strong>Whole input</strong> — the virtual device is already an isolated channel.</div>
        : <div style={{color:'#d1ddd8',fontSize:11,lineHeight:1.65}}>
          USB multitrack is a mixer setting, but it does not guarantee that a browser can capture channel 3.
          Select <strong>USB 3 — Isolated Mic 1</strong>, then press <strong>Test</strong> to see the actual capture count.
        </div>
      }
      {capture && <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <strong style={{background: capture.supported?'#1a553e':'#65331f',color:capture.supported?'#a4f7c1':'#ffd0aa',border:'1px solid #ffffff24',padding:'6px 9px',borderRadius:5,fontSize:11}}>
          Browser delivered: {capture.known?capture.actual+' channel'+(capture.actual===1?'':'s'):'unreported'}
        </strong>
        <span style={{fontSize:10,color:'#a9bdb7'}}>Requested: {channel ? 'USB '+channel+' of 16' : 'whole input'}</span>
      </div>}
      {virtualInputs.length>0 && (
        <>
          <label style={{color:'#d3b983',fontSize:10,fontWeight:850}} htmlFor="rode-isolated-fader">AVAILABLE INDIVIDUAL FADER INPUTS</label>
          <select id="rode-isolated-fader" disabled={disabled||testing}
            value={selectedIsVirtual?currentDevice:''}
            onChange={e=>{if(!e.target.value)return;onSelect(e.target.value);onChannelChange(0)}}
            style={{width:'100%',background:'#12232b',border:'1px solid #d1b27888',borderRadius:5,color:'#f8e4bc',padding:'9px',fontSize:11}}>
            <option value="">— Choose the fader carrying your microphone —</option>
            {virtualInputs.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
          </select>
          <div style={{fontSize:10,color:'#9ebfba',lineHeight:1.5}}>
            If your microphone is on fader 3, select its matching virtual fader here, then press Test.
          </div>
        </>
      )}
      {!virtualInputs.length && <div style={warning}>
        No individual RØDECaster fader inputs detected. On Windows with a Pro II/Duo,
        install RØDE Virtual Devices, enable USB 1 Output: Multitrack and
        USB 1 Input: Expanded, then re-scan. This exposes each fader as a separate input device.
      </div>}
      <div style={{display:'flex',alignItems:'center',gap:13,flexWrap:'wrap'}}>
        <button type="button" disabled={disabled||testing} onClick={onRescan}
          style={{border:'1px solid #71a199',borderRadius:5,padding:'6px 10px',background:'#25433d',color:'#d2f0e5',fontSize:11,cursor:'pointer'}}>
          Re-scan RØDE inputs
        </button>
        <a href={RODE_VIRTUAL_INPUT_GUIDE} target="_blank" rel="noopener noreferrer"
          style={{...linkStyle,fontSize:11}}>RØDE driver & setup instructions ↗</a>
      </div>
      <div style={{fontSize:10,color:'#a5b3b7'}}>
        Pro II/Duo Windows instructions; if your unit is an original RØDECaster Pro,
        or you're using another OS, multichannel access may require an OS audio router or dedicated bridge.
      </div>
    </section>
  );
}

export default function LiveAudioInputs({ phase, audio: a }) {
  const hardware = a.activeAudioMode?.transport !== 'twilio';
  const agentLabel = a.micDevices.find(d => d.deviceId === a.micDeviceId)?.label || '';
  const customerLabel = a.micDevices.find(d => d.deviceId === a.customerMicId)?.label || '';
  const isolated = findIsolatedInput(a.micDevices, [a.micDeviceId, a.customerMicId]);
  const disabled = phase==='live';
  return <>
    {hardware && <LiveAudioInput devices={a.micDevices} value={a.micDeviceId}
      onChange={id=>{a.setMicDeviceId(id);}} gain={a.agentGain} onGainChange={a.setAgentGain}
      testing={a.testingAgent} onTest={a.testingAgent ? a.stopAgentTest : a.startAgentTest}
      disabled={disabled} onScan={()=>a.loadDevices(true)}
      channel={a.agentChannel} onChannelChange={a.setAgentChannel}>
      <TrackHint channel={a.agentChannel} capture={a.agentCapture}/>
      {isMasterMixInput(agentLabel) && isolated &&
        <button type="button" onClick={()=>{a.setMicDeviceId(isolated.deviceId);a.setAgentChannel(0)}} disabled={disabled} style={mixHint}>
          Choose isolated input “{isolated.label}” instead of the master mix.
        </button>}
      <RodeInputGuide devices={a.micDevices} currentDevice={a.micDeviceId}
        channel={a.agentChannel} capture={a.agentCapture}
        onSelect={a.setMicDeviceId} onChannelChange={a.setAgentChannel}
        onRescan={()=>a.loadDevices(true)} disabled={disabled} testing={a.testingAgent}/>
    </LiveAudioInput>}
    {hardware && <LiveAudioInput customer devices={a.customerInputs} value={a.customerMicId}
      onChange={a.setCustomerMicId} gain={a.customerGain} onGainChange={a.setCustomerGain}
      testing={a.testingCustomer} onTest={a.testingCustomer ? a.stopCustomerTest : a.startCustomerTest}
      disabled={disabled} onScan={()=>a.loadDevices(true)} inputCount={a.micDevices.length}
      channel={a.customerChannel} onChannelChange={a.setCustomerChannel}>
      <TrackHint channel={a.customerChannel} capture={a.customerCapture}/>
      {a.micDevices.length > 0 && a.customerInputs.length === 0 &&
        <span style={warning}>No customer-only loopback input found. Enable Stereo Mix / virtual cable and re-scan. A room microphone does not safely isolate the caller.</span>}
      {a.customerMicId && a.customerLabelSelected && !isLoopbackSource(a.customerLabelSelected) &&
        <span style={warning}>“{a.customerLabelSelected}” is a microphone. Pick a customer-only loopback input.</span>}
      {isMasterMixInput(customerLabel) && isolated &&
        <button type="button" onClick={()=>{a.setCustomerMicId(isolated.deviceId);a.setCustomerChannel(0)}} disabled={disabled} style={mixHint}>
          “{customerLabel}” may carry the master mix. Choose the isolated customer feed only if it contains no agent mic: “{isolated.label}”.
        </button>}
    </LiveAudioInput>}
    <AudioSetupSwitcher setups={a.modes} activeIndex={a.activeSetupIndex}
      disabled={disabled||a.testingAgent||a.testingCustomer||a.savingAudioMode}
      loading={!a.audioModeReady} dirty={a.audioModeDirty} validation={a.audioModeValidation}
      message={a.audioModeDirty&&a.activeAudioMode?.saved&&!a.savingAudioMode?'':a.audioModeMessage}
      onUse={a.useAudioSetup} onRename={a.renameAudioSetup} onSave={a.saveAudioSetup}/>
    {hardware && a.outputDevices.length>0 && <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <label style={{color:'#8a9ab8',fontSize:10,letterSpacing:2,textTransform:'uppercase'}}>Preferred Output</label>
      <select value={a.outputDeviceId} onChange={e=>a.setOutputDeviceId(e.target.value)} disabled={disabled}
        title="Preferred playback device; browser and OS determine actual output routing"
        style={{minWidth:220,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:4,padding:'8px 12px',color:'#e8e0d0',fontSize:13}}>
        <option value="">— System default output —</option>
        {a.outputDevices.map(o=><option key={o.deviceId} value={o.deviceId}>{o.label||'Speaker '+o.deviceId.slice(0,6)}</option>)}
      </select>
    </div>}
    {a.testMode?<span style={{color:'#f59e0b',fontSize:10}}>TEST MODE — Single Feed</span>
      :hardware&&a.customerMicId&&a.micDeviceId?<span style={{color:'#60a5fa',fontSize:10}}>DUAL CHANNEL (requires verified separate inputs)</span>:null}
  </>;
}
