/**
 * Diagnose and select a virtual-audio-cable recording device directly.
 *
 * Browser enumerating a device is not evidence that the browser is receiving
 * any audio from it. This independent test captures the EXACT audioinput ID
 * and measures its left/right PCM data. It never sends audio to a server.
 *
 * VB-Audio convention: "CABLE Input" is a PLAYBACK/audiooutput endpoint.
 * The browser must capture "CABLE Output" from audioinput instead.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Headphones, Mic2, RefreshCw, Square, Volume2 } from 'lucide-react';
import { audioInputConstraints, explainCaptureError, describeAudioTrack } from '@/lib/browserAudioInput';

const CABLE = /(?:vb[\s-]?audio|virtual|cable|voicemeeter|blackhole|loopback|rode|røde|rodecaster|vac|line\s?\d)/i;
const CABLE_OUT = /(?:cable.*output|voicemeeter.*output|(?:blackhole|loopback).*)/i;
const CABLE_IN = /(?:cable.*input|voicemeeter.*input)/i;

const text = {
  label: {fontSize:10,fontWeight:800,color:'#deb97c',letterSpacing:'.10em',textTransform:'uppercase'},
  hint: {fontSize:11,color:'#b9c9c6',lineHeight:1.65},
  surface: {background:'#0d1e29',border:'1px solid #4c796d88',borderRadius:8,padding:13},
  button: {border:'1px solid #c6a066',borderRadius:7,background:'#273c38',color:'#f2d6a9',padding:'9px 12px',fontWeight:800,fontSize:11,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7},
};

function PercentMeter({value,label}){
  return <div style={{flex:'1 1 100px',minWidth:90}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:5,marginBottom:5,fontSize:10,color:'#c9d3c9'}}>
      <span>{label}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{value}%</span>
    </div>
    <div style={{height:11,borderRadius:5,background:'#293942',border:'1px solid #56706555',overflow:'hidden'}}>
      <div style={{height:'100%',width:value+'%',transition:'width .09s',borderRadius:5,
        background:value>1?'linear-gradient(90deg,#55bd85,#d9b66e)':'#4a6170'}}/>
    </div>
  </div>;
}

export default function VirtualCableDiagnostics({
  micDevices=[],outputDevices=[],agentId='',customerId='',
  onAgentSelect,onCustomerSelect,onRescan,deviceScanMessage='',disabled=false,twilioMode=false,
}) {
  const [open,setOpen]=useState(false);
  const candidates=useMemo(()=>micDevices.filter(d=>d.kind==='audioinput'&&CABLE.test(d.label||'')),[micDevices]);
  const cableOutputs=useMemo(()=>outputDevices.filter(d=>d.kind==='audiooutput'&&CABLE.test(d.label||'')),[outputDevices]);
  const preferred=useMemo(()=>candidates.find(d=>d.deviceId===agentId)||
    candidates.find(d=>CABLE_OUT.test(d.label||''))||candidates[0]||null,[candidates,agentId]);
  const [chosenId,setChosenId]=useState('');
  const selectedId=micDevices.some(d=>d.deviceId===chosenId)?chosenId:(preferred?.deviceId||'');
  const selectedDevice=micDevices.find(d=>d.deviceId===selectedId);
  const [status,setStatus]=useState('idle');
  const [detail,setDetail]=useState(null);
  const [message,setMessage]=useState('');
  const [meter,setMeter]=useState({left:0,right:0});
  const ctxRef=useRef(null);
  const streamRef=useRef(null);
  const frameRef=useRef(null);
  const tokenRef=useRef(0);
  const observedRef=useRef(false);

  const stop=useCallback(()=>{
    ++tokenRef.current;
    if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);
    frameRef.current=null;
    streamRef.current?.getTracks?.().forEach(t=>t.stop());
    streamRef.current=null;
    const ctx=ctxRef.current;ctxRef.current=null;
    if(ctx)void ctx.close().catch(()=>{});
    setStatus('idle');
    setMeter({left:0,right:0});
  },[]);

  useEffect(()=>()=>{ // stops browser input on unmount without leaving microphone active
    ++tokenRef.current;
    if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks?.().forEach(t=>t.stop());
    if(ctxRef.current)void ctxRef.current.close().catch(()=>{});
  },[]);
  useEffect(()=>{if(status!=='idle')stop();setDetail(null);},[selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(disabled)stop();},[disabled,stop]);

  const test=async()=>{
    if(!selectedId){setStatus('error');setMessage('No selectable recording endpoint was found. Press Refresh Inputs and allow microphone access.');return;}
    stop();
    const token=++tokenRef.current;
    setStatus('opening');
    setMessage('Opening the selected recording endpoint directly in Chrome…');
    setDetail(null);
    observedRef.current=false;
    let stream=null,ctx=null;
    try{
      stream=await navigator.mediaDevices.getUserMedia(audioInputConstraints(selectedId));
      if(token!==tokenRef.current){stream.getTracks().forEach(t=>t.stop());return;}
      streamRef.current=stream;
      const track=stream.getAudioTracks()[0];
      if(!track||track.readyState!=='live')throw new Error('The selected device did not produce an active audio track.');
      const info=describeAudioTrack(track,selectedDevice?.label||'');
      setDetail(info);
      ctx=new (window.AudioContext||window.webkitAudioContext)();
      ctxRef.current=ctx;
      if(ctx.state==='suspended')await ctx.resume();
      if(token!==tokenRef.current)return;
      // The virtual cable normally carries mono or stereo audio. Inspect both
      // channels independently so right-only routing is not mistaken for silence.
      const source=ctx.createMediaStreamSource(stream);
      const splitter=ctx.createChannelSplitter(2);
      source.connect(splitter);
      const analyserL=ctx.createAnalyser();
      const analyserR=ctx.createAnalyser();
      analyserL.fftSize=1024;analyserR.fftSize=1024;
      splitter.connect(analyserL,0);
      splitter.connect(analyserR,1);
      // Analyser nodes need a destination-connected path in some Chromium builds.
      // A zero-gain sink is inaudible and prevents microphone feedback.
      const mute=ctx.createGain();mute.gain.value=0;
      analyserL.connect(mute);analyserR.connect(mute);mute.connect(ctx.destination);
      const dataL=new Float32Array(analyserL.fftSize);
      const dataR=new Float32Array(analyserR.fftSize);
      const rmsPercent=(analyser,data)=>{
        analyser.getFloatTimeDomainData(data);
        let sum=0;
        for(let i=0;i<data.length;i++)sum+=data[i]*data[i];
        const rms=Math.sqrt(sum/data.length);
        return Math.min(100,Math.round(rms*430));
      };
      let lastPaint=0;
      const started=performance.now();
      const tick=now=>{
        if(token!==tokenRef.current)return;
        if(!track || track.readyState==='ended'){
          stop();setStatus('error');setMessage('Chrome closed this audio input. Reconnect the cable and test again.');return;
        }
        const l=rmsPercent(analyserL,dataL);
        const r=rmsPercent(analyserR,dataR);
        if(l>=2||r>=2)observedRef.current=true;
        if(now-lastPaint>90){
          setMeter({left:l,right:r});
          if(observedRef.current){
            setStatus('signal');
            setMessage('Signal detected. Chrome is receiving audio from this exact recording endpoint.');
          }else if(now-started>2300){
            setStatus('silent');
            setMessage('Chrome opened this input, but no audio samples have been detected. Check the signal reaching the cable playback/Input side and the OS recording/Output meter.');
          }else setStatus('capturing');
          lastPaint=now;
        }
        frameRef.current=requestAnimationFrame(tick);
      };
      setStatus('capturing');
      setMessage('Recording endpoint opened. Speak into your RØDECaster microphone now.');
      frameRef.current=requestAnimationFrame(tick);
    }catch(error){
      if(token!==tokenRef.current)return;
      stream?.getTracks?.().forEach(t=>t.stop());
      if(ctx)void ctx.close().catch(()=>{});
      ctxRef.current=null;streamRef.current=null;
      setStatus('error');
      setMessage(explainCaptureError(error));
    }
  };

  const assign=(role)=>{
    if(!selectedId||!selectedDevice||disabled)return;
    stop();
    if(role==='agent')onAgentSelect?.(selectedId);
    else onCustomerSelect?.(selectedId);
    setMessage('Selected '+(selectedDevice.label||'the cable')+' as '+(role==='agent'?'Agent Mic':'Customer Audio')+'. Press Save on your audio mode to retain it.');
    setStatus('selected');
  };

  return <section style={{flex:'1 0 100%',minWidth:0}}>
    <button type="button" onClick={()=>{if(open)stop();setOpen(!open);}}
      aria-expanded={open} aria-controls="dcc-virtual-cable-panel"
      style={{...text.button,background:open?'#3a412d':'#20323b',borderColor:open?'#e4bc7c':'#4e716f'}}>
      <AudioLines size={16}/> Virtual Cable / RØDECaster Signal Check
      {candidates.length>0&&<span style={{background:'#315e45',color:'#d5f9dc',borderRadius:20,padding:'2px 7px'}}>{candidates.length} input{candidates.length===1?'':'s'}</span>}
      {open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
    </button>
    {open&&<div id="dcc-virtual-cable-panel" style={{...text.surface,marginTop:10,maxWidth:850}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:15,flexWrap:'wrap',marginBottom:13}}>
        <div>
          <strong style={{color:'#f2d6a5',fontSize:15}}>Virtual cable — direct Chrome capture</strong>
          <div style={text.hint}>If the mic is already routed into a virtual cable, choose its <b>recording endpoint</b> as the Agent Mic. Do not select RØDECaster USB Track 3 again.</div>
        </div>
        <button type="button" style={text.button} onClick={()=>onRescan?.()} disabled={disabled||status==='opening'}>
          <RefreshCw size={15}/> Refresh Inputs
        </button>
      </div>
      {deviceScanMessage&&<div role="status" style={{...text.hint,border:'1px solid #50776666',borderRadius:6,padding:'8px 10px',marginBottom:10,background:'#182e31'}}>{deviceScanMessage}</div>}
      {twilioMode&&<p style={{...text.hint,color:'#ffc889',margin:'9px 0'}}>
        <CircleAlert size={15} style={{verticalAlign:'middle',marginRight:6}}/>
        Your selected <b>Twilio Stream</b> mode uses Twilio WebRTC audio instead of the local cable.
        Switch to Computer Setup or Cell Setup to capture this virtual cable.
      </p>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(245px,1fr))',gap:13}}>
        <div>
          <label style={text.label} htmlFor="dcc-virtual-input">CHROME RECORDING INPUTS ({micDevices.length})</label>
          <select id="dcc-virtual-input" disabled={status==='opening'} value={selectedId}
            onChange={e=>{stop();setChosenId(e.target.value);setDetail(null);setMessage('');}}
            style={{width:'100%',marginTop:6,padding:'10px 11px',background:'#122731',border:'1px solid #9bb1a277',color:'#f2eddf',borderRadius:7,fontSize:12}}>
            <option value="">— Select an actual recording input —</option>
            {micDevices.filter(d=>d.deviceId).map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Unnamed microphone '+d.deviceId.slice(0,6)}</option>)}
          </select>
          {selectedId && agentId===selectedId && customerId===selectedId && <p style={{...text.hint,color:'#ffc394',margin:'8px 0'}}>
        The same cable is selected for Agent and Customer. Use separate audio sources for distinct transcription channels.
      </p>}
          {selectedDevice&&<p style={{...text.hint,margin:'8px 0'}}>
            {CABLE_OUT.test(selectedDevice.label||'')?'✓ Likely cable recording endpoint.':CABLE_IN.test(selectedDevice.label||'')?'Check endpoint direction: this name usually means the playback side.':'The input will be captured by its exact Chrome device ID.'}
          </p>}
          {candidates.length===0&&<p style={{...text.hint,color:'#ffc88f'}}>
            No labeled virtual cable was exposed as an audio input. Refresh and allow the website microphone permission. If Chrome lists only CABLE Input under speakers, it cannot be used as a microphone.
          </p>}
        </div>
        <div>
          <div style={text.label}>VIRTUAL CABLE PLAYBACK ENDPOINTS ({cableOutputs.length})</div>
          <div style={{...text.hint,marginTop:7}}>
            {cableOutputs.length?cableOutputs.map(d=><div key={d.deviceId} style={{padding:'5px 0',borderBottom:'1px solid #ffffff10'}}>{d.label||'Unnamed output'} <span style={{color:'#e6bb7e'}}>— playback only</span></div>):'No matching playback endpoint is currently labeled in Chrome.'}
          </div>
          <p style={{...text.hint,margin:'8px 0 0',color:'#c0a879'}}>
            VB-Audio naming: sound is <b>sent to CABLE Input</b> (playback), then captured from <b>CABLE Output</b> (recording).
          </p>
        </div>
      </div>
      <div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:14}}>
        <button type="button" disabled={!selectedId||disabled||status==='opening'} onClick={()=>assign('agent')}
          style={{...text.button,background:'#33523b'}}><Mic2 size={16}/> Use as Agent Mic</button>
        <button type="button" disabled={!selectedId||disabled||status==='opening'} onClick={()=>assign('customer')}
          style={text.button}><Headphones size={16}/> Use as Customer Audio</button>
        <button type="button" disabled={!selectedId||status==='opening'||!!disabled} onClick={status==='signal'||status==='silent'||status==='capturing'?stop:test}
          style={{...text.button,background:'#675026',borderColor:'#f3ce8e'}}>
          {status==='signal'||status==='silent'||status==='capturing'?<Square size={14}/>:<Volume2 size={15}/>}
          {status==='signal'||status==='silent'||status==='capturing'?'Stop Signal Test':'Test Selected Cable'}
        </button>
      </div>
      {(detail||message)&&<div role="status" aria-live="polite" style={{marginTop:13,padding:12,border:'1px solid '+(status==='signal'?'#45ab78':status==='error'?'#d76b6b':'#9a804b'),borderRadius:7,background:'#101e29'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,color:status==='signal'?'#9de7b6':status==='error'?'#ffb1a5':'#ecd4a2',fontWeight:800,fontSize:12}}>
          {status==='signal'?<CheckCircle2 size={17}/>:status==='error'?<CircleAlert size={17}/>:<AudioLines size={17}/>}
          {status==='signal'?'LIVE AUDIO DETECTED':status==='error'?'CABLE CAPTURE ERROR':status==='silent'?'CABLE OPEN — NO SIGNAL':status==='opening'?'OPENING DEVICE':'INPUT DIAGNOSTIC'}
        </div>
        <p style={{...text.hint,margin:'7px 0'}}>{message}</p>
        {detail&&<div style={{...text.hint,margin:'4px 0 10px'}}>
          <b>Chrome opened:</b> {detail.label||'unnamed device'} ·
          <b> captured channels:</b> {detail.channelCount||'not reported'} ·
          <b> sample rate:</b> {detail.sampleRate?detail.sampleRate+' Hz':'not reported'} ·
          <b> track:</b> {detail.readyState||'unknown'}
        </div>}
        {['capturing','signal','silent'].includes(status)&&<div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          <PercentMeter label="LEFT CHANNEL" value={meter.left}/>
          <PercentMeter label="RIGHT CHANNEL" value={meter.right}/>
        </div>}
      </div>}
      <div style={{...text.hint,fontSize:10,marginTop:12}}>
        This test reads local signal levels only. It does not start a call, record a file, or send audio to Deepgram.
        If levels move here but Live Call does not transcribe, the problem is downstream in the application's live audio feed.
      </div>
    </div>}
  </section>;
}
