import { useCallback, useEffect, useRef, useState } from 'react';
import { audioConstraints, channelSource, captureChannelInfo } from '@/lib/audioChannels';
import { isLoopbackSource } from '@/lib/audioDevices';

/**
 * Level meters for the two live-call inputs.
 * A multichannel mixer only exposes its isolated tracks inside one device, so
 * each meter listens to the selected track (mic 1 = track 3) rather than the mix.
 */
export default function useInputLevelTest({
  micDeviceId, agentChannel = 0, customerMicId, customerChannel = 0,
  agentGain = 1, customerGain = 1, micDevices = [], onError,
}) {
  const [testingAgent, setTestingAgent] = useState(false);
  const [agentLevel, setAgentLevel] = useState(0);
  const [agentTracks, setAgentTracks] = useState(0);
  const [agentCapture, setAgentCapture] = useState(null);
  const [testingCustomer, setTestingCustomer] = useState(false);
  const [customerLevel, setCustomerLevel] = useState(0);
  const [customerTracks, setCustomerTracks] = useState(0);
  const [customerCapture, setCustomerCapture] = useState(null);
  const agentCtxRef = useRef(null);
  const agentStreamRef = useRef(null);
  const agentAnimRef = useRef(null);
  const customerCtxRef = useRef(null);
  const customerStreamRef = useRef(null);
  const customerAnimRef = useRef(null);

  // Never display diagnostic results measured on a previously selected input.
  useEffect(() => { setAgentCapture(null); setAgentTracks(0); setAgentLevel(0); }, [micDeviceId, agentChannel]);
  useEffect(() => { setCustomerCapture(null); setCustomerTracks(0); setCustomerLevel(0); }, [customerMicId, customerChannel]);

  const meter = (analyser, onLevel, animRef) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let mx = 0;
      for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i] - 128) / 128; if (v > mx) mx = v; }
      onLevel(Math.round(mx * 100));
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const startAgentTest = useCallback(async () => {
    if (!micDeviceId) { onError('Select the actual agent microphone before testing.'); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      agentCtxRef.current = ctx;
      const stream = await navigator.mediaDevices.getUserMedia(
        agentChannel > 0
          ? audioConstraints(micDeviceId, agentChannel)
          : audioConstraints(micDeviceId, 0, { echoCancellation: true, noiseSuppression: true, autoGainControl: false }),
      );
      agentStreamRef.current = stream;
      const info = captureChannelInfo(stream, agentChannel);
      setAgentCapture(info);
      setAgentTracks(info.actual);
      if (agentChannel > 0 && !info.supported) {
        stream.getTracks().forEach(t=>t.stop());
        agentStreamRef.current = null;
        void ctx.close(); agentCtxRef.current = null;
        onError(info.reason + ' USB multitrack can be enabled in the RØDECaster while Chrome still captures only stereo. On Windows, use the RØDECaster Virtual Devices Driver to expose an individual fader as an input device.');
        return;
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const gain = ctx.createGain();
      gain.gain.value = agentGain;
      const src = channelSource(ctx, stream, agentChannel);
      src.node.connect(gain, src.output);
      gain.connect(analyser);
      meter(analyser, setAgentLevel, agentAnimRef);
      setTestingAgent(true);
    } catch (e) {
      agentStreamRef.current?.getTracks().forEach(t=>t.stop());
      agentStreamRef.current = null;
      if(agentCtxRef.current){void agentCtxRef.current.close().catch(()=>{});agentCtxRef.current=null;}
      onError('Agent mic test failed: ' + (e?.message || String(e)));
    }
  }, [micDeviceId, agentChannel, agentGain, onError]);

  const stopAgentTest = useCallback(() => {
    if (agentAnimRef.current) cancelAnimationFrame(agentAnimRef.current);
    agentAnimRef.current = null;
    if (agentStreamRef.current) agentStreamRef.current.getTracks().forEach(t => t.stop());
    if (agentCtxRef.current) { try { agentCtxRef.current.close(); } catch {} }
    agentCtxRef.current = null; agentStreamRef.current = null;
    setTestingAgent(false); setAgentLevel(0);
  }, []);

  const startCustomerTest = useCallback(async () => {
    if (!customerMicId) return;
    // Never open a microphone here. Testing through a mic only proves the mic hears
    // the room — the agent's own voice included — which is the bug this split exists
    // to prevent. Only a loopback input can be tested as the customer channel.
    const label = micDevices.find(m => m.deviceId === customerMicId)?.label || '';
    if (label && !isLoopbackSource(label)) {
      onError(`That input is a microphone (${label}), not the customer line. Pick Stereo Mix / What U Hear — a mic would capture your own voice on the customer channel.`);
      return;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      customerCtxRef.current = ctx;
      // Must be `exact` — an `ideal` match silently falls back to the default mic,
      // which would make this test pass while the mic sits on that channel.
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints(customerMicId, customerChannel))
        .catch(() => { throw new Error('Customer device unavailable — re-scan and pick it again.'); });
      customerStreamRef.current = stream;
      const info = captureChannelInfo(stream, customerChannel);
      setCustomerCapture(info);
      setCustomerTracks(info.actual);
      if(customerChannel>0 && !info.supported){
        stream.getTracks().forEach(t=>t.stop());
        customerStreamRef.current=null;
        void ctx.close();customerCtxRef.current=null;
        onError(info.reason + ' Select the individual customer virtual input, or use a stereo loopback source.');
        return;
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const gain = ctx.createGain();
      gain.gain.value = customerGain;
      const src = channelSource(ctx, stream, customerChannel);
      src.node.connect(gain, src.output);
      gain.connect(analyser);
      meter(analyser, setCustomerLevel, customerAnimRef);
      setTestingCustomer(true);
    } catch (e) {
      customerStreamRef.current?.getTracks().forEach(t=>t.stop());
      customerStreamRef.current=null;
      if(customerCtxRef.current){void customerCtxRef.current.close().catch(()=>{});customerCtxRef.current=null;}
      onError('Customer input test failed: ' + (e?.message || String(e)));
    }
  }, [customerMicId, customerChannel, customerGain, micDevices, onError]);

  const stopCustomerTest = useCallback(() => {
    if (customerAnimRef.current) cancelAnimationFrame(customerAnimRef.current);
    customerAnimRef.current = null;
    if (customerStreamRef.current) customerStreamRef.current.getTracks().forEach(t => t.stop());
    if (customerCtxRef.current) { try { customerCtxRef.current.close(); } catch {} }
    customerCtxRef.current = null; customerStreamRef.current = null;
    setTestingCustomer(false); setCustomerLevel(0);
  }, []);

  useEffect(() => () => { stopAgentTest(); stopCustomerTest(); }, [stopAgentTest, stopCustomerTest]);

  return {
    testingAgent, agentLevel, agentTracks, agentCapture, startAgentTest, stopAgentTest,
    testingCustomer, customerLevel, customerTracks, customerCapture, startCustomerTest, stopCustomerTest,
  };
}