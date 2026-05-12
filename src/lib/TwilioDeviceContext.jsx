import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { base44 } from '@/api/base44Client';

const TwilioDeviceContext = createContext(null);

export function TwilioDeviceProvider({ children }) {
  const deviceRef    = useRef(null);
  const initPromise  = useRef(null);
  const [ready, setReady]               = useState(false);
  const [error, setError]               = useState('');
  const [incomingCall, setIncomingCall] = useState(null);   // { call, from, lead }
  const onIncomingRef = useRef(null); // external handler registered by AdminDashboard

  // Allow AdminDashboard (or any parent) to register a handler for inbound calls
  // so it can open the ContactCardModal for the matched lead.
  const registerIncomingHandler = useCallback((fn) => {
    onIncomingRef.current = fn;
  }, []);

  const getDevice = useCallback(async () => {
    if (deviceRef.current && ready) return deviceRef.current;
    if (initPromise.current) return initPromise.current;

    initPromise.current = (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

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
        device.on('unregistered', () => {
          setReady(false);
          deviceRef.current = null;
          initPromise.current = null;
        });
        device.on('tokenWillExpire', async () => {
          try {
            const r = await base44.functions.invoke('twilioClientToken', {});
            const t = r?.data?.token || r?.token;
            if (t) device.updateToken(t);
          } catch {}
        });

        // ── Inbound call handler ──────────────────────────────────────
        device.on('incoming', async (call) => {
          const from = call.parameters?.From || '';
          console.log('[TwilioDevice] Incoming call from:', from);

          // Try to match caller to a lead/investor in the database
          let matchedLead = null;
          if (from) {
            try {
              // Normalize: strip non-digits then try +1XXXXXXXXXX and plain 10-digit
              const digits = from.replace(/\D/g, '');
              const e164   = digits.length === 10 ? `+1${digits}` : `+${digits}`;
              const plain10 = digits.slice(-10);

              // Search InvestorUser first
              const investors = await base44.entities.InvestorUser.list();
              matchedLead = investors.find(u => {
                const p = (u.phone || '').replace(/\D/g, '');
                return p === digits || p === plain10 || p.slice(-10) === plain10;
              }) || null;

              // Fallback: search Lead entity if no investor match
              if (!matchedLead) {
                const leads = await base44.entities.Lead.list();
                matchedLead = leads.find(l => {
                  const p = (l.phone || '').replace(/\D/g, '');
                  return p === digits || p === plain10 || p.slice(-10) === plain10;
                }) || null;
              }
            } catch (e) {
              console.warn('[TwilioDevice] Lead lookup failed:', e.message);
            }
          }

          const incomingData = { call, from, lead: matchedLead };
          setIncomingCall(incomingData);

          // Notify external handler (AdminDashboard) so it can open the card
          if (onIncomingRef.current) {
            onIncomingRef.current(incomingData);
          }

          // Auto-clear incomingCall state when call ends (cancelled, rejected, etc.)
          call.on('disconnect', () => setIncomingCall(null));
          call.on('cancel',     () => setIncomingCall(null));
          call.on('reject',     () => setIncomingCall(null));
          call.on('error',      () => setIncomingCall(null));
        });
        // ─────────────────────────────────────────────────────────────

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
    <TwilioDeviceContext.Provider value={{
      getDevice, ready, error, deviceRef,
      incomingCall, setIncomingCall,
      registerIncomingHandler,
    }}>
      {children}
    </TwilioDeviceContext.Provider>
  );
}

export function useTwilioDevice() {
  return useContext(TwilioDeviceContext);
}