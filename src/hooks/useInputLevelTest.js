import { useCallback, useEffect, useRef, useState } from 'react';
import { audioInputConstraints } from '@/lib/browserAudioInput';

/** Silent level meters for the two browser-selected audio inputs. */
export default function useInputLevelTest({
  micDeviceId, customerMicId, agentGain = 1, customerGain = 1, onError,
}) {
  const [testingAgent, setTestingAgent] = useState(false);
  const [agentLevel, setAgentLevel] = useState(0);

  const [testingCustomer, setTestingCustomer] = useState(false);
  const [customerLevel, setCustomerLevel] = useState(0);

  const agentCtxRef = useRef(null);
  const agentStreamRef = useRef(null);
  const agentAnimRef = useRef(null);
  const customerCtxRef = useRef(null);
  const customerStreamRef = useRef(null);
  const customerAnimRef = useRef(null);

  useEffect(() => { setAgentLevel(0); }, [micDeviceId]);
  useEffect(() => { setCustomerLevel(0); }, [customerMicId]);

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
      const stream = await navigator.mediaDevices.getUserMedia(audioInputConstraints(micDeviceId));
      agentStreamRef.current = stream;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const gain = ctx.createGain();
      gain.gain.value = agentGain;
      ctx.createMediaStreamSource(stream).connect(gain);
      gain.connect(analyser);
      meter(analyser, setAgentLevel, agentAnimRef);
      setTestingAgent(true);
    } catch (e) {
      agentStreamRef.current?.getTracks().forEach(t=>t.stop());
      agentStreamRef.current = null;
      if(agentCtxRef.current){void agentCtxRef.current.close().catch(()=>{});agentCtxRef.current=null;}
      onError('Agent mic test failed: ' + (e?.message || String(e)));
    }
  }, [micDeviceId, agentGain, onError]);

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
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      customerCtxRef.current = ctx;
      const stream = await navigator.mediaDevices.getUserMedia(audioInputConstraints(customerMicId));
      customerStreamRef.current = stream;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const gain = ctx.createGain();
      gain.gain.value = customerGain;
      ctx.createMediaStreamSource(stream).connect(gain);
      gain.connect(analyser);
      meter(analyser, setCustomerLevel, customerAnimRef);
      setTestingCustomer(true);
    } catch (e) {
      customerStreamRef.current?.getTracks().forEach(t=>t.stop());
      customerStreamRef.current=null;
      if(customerCtxRef.current){void customerCtxRef.current.close().catch(()=>{});customerCtxRef.current=null;}
      onError('Customer input test failed: ' + (e?.message || String(e)));
    }
  }, [customerMicId, customerGain, onError]);

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
    testingAgent, agentLevel, startAgentTest, stopAgentTest,
    testingCustomer, customerLevel, startCustomerTest, stopCustomerTest,
  };
}