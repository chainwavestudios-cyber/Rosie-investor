import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { base44 } from '@/api/base44Client';

const TwilioDeviceContext = createContext(null);

export function TwilioDeviceProvider({ children }) {
  const deviceRef    = useRef(null);
  const initPromise  = useRef(null);
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState('');

  const getDevice = useCallback(async () => {
    // Already ready
    if (deviceRef.current && ready) return deviceRef.current;
    // Init already in flight — wait for it
    if (initPromise.current) return initPromise.current;

    initPromise.current = (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Stable ID for this browser session — prevents multi-admin identity collisions on Twilio
        if (!sessionStorage.getItem('twilio_agent_id')) {
          sessionStorage.setItem('twilio_agent_id', 'agent-' + Math.random().toString(36).slice(2, 10));
        }
        const agentId = sessionStorage.getItem('twilio_agent_id');
        const res   = await base44.functions.invoke('twilioClientToken', { headers: { 'x-agent-id': agentId } });
        const token = res?.data?.token || res?.token;
        if (!token) throw new Error('No token received');

        const device = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true,
          logLevel: 'error',
        });

        await new Promise((resolve, reject) => {
          device.once('registered', resolve);
          device.once('error', reject);
          device.register();
        });

        device.on('error', (e) => setError(`Twilio: ${e.message}`));
        device.on('unregistered', () => { setReady(false); deviceRef.current = null; initPromise.current = null; });
        device.on('tokenWillExpire', async () => {
          try {
            const r = await base44.functions.invoke('twilioClientToken', {});
            const t = r?.data?.token || r?.token;
            if (t) device.updateToken(t);
          } catch {}
        });

        deviceRef.current = device;
        setReady(true);
        setError('');
        return device;
      } catch (e) {
        setError(e.message || 'Init failed');
        initPromise.current = null;
        throw e;
      }
    })();

    return initPromise.current;
  }, [ready]);

  // Destroy on unmount
  useEffect(() => () => {
    try { deviceRef.current?.destroy(); } catch {}
  }, []);

  return (
    <TwilioDeviceContext.Provider value={{ getDevice, ready, error, deviceRef }}>
      {children}
    </TwilioDeviceContext.Provider>
  );
}

export function useTwilioDevice() {
  return useContext(TwilioDeviceContext);
}