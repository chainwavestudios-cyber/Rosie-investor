import { useEffect, useRef, useState } from 'react';
import { Device } from '@twilio/voice-sdk';
import { base44 } from '@/api/base44Client';

export default function useCalendarCall(lead, username) {
  const [lines, setLines] = useState([]), [lineKey, setLineKey] = useState('');
  const [status, setStatus] = useState('idle'), [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [callSid, setCallSid] = useState('');
  const device = useRef(null), call = useRef(null), timer = useRef(null), starting = useRef(false), attempt = useRef(0);
  const answeredAt = useRef(0), answeredSid = useRef('');
  const active = ['calling', 'ringing', 'connected'].includes(status);
  useEffect(() => {
    base44.functions.invoke('twilioGetLines', {}).then(({ data }) => {
      if (data.error) throw new Error(data.error);
      const ls = data.lines || [];
      setLines(ls);
      // Default to the line assigned to this user (Fronter admin → Lines). With no
      // assignment, take a line nobody owns rather than someone else's number.
      const mine = ls.find(l => (l.assignedTo || '').toLowerCase() === String(username || '').toLowerCase());
      const unowned = ls.find(l => !l.assignedTo);
      setLineKey(mine?.key || unowned?.key || ls[0]?.key || '');
    }).catch(e => setError('Could not load outbound lines: ' + e.message)).finally(() => setLoading(false));
    return () => { attempt.current += 1; clearInterval(timer.current); call.current?.disconnect(); device.current?.destroy(); };
  }, []);
  // Ending a call writes its length onto the client's history so every call placed from
  // the calendar card is logged alongside the rest of the client's activity.
  const finish = () => {
    clearInterval(timer.current); call.current = null;
    const started = answeredAt.current;
    answeredAt.current = 0;
    if (started && lead?.id) {
      const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
      const durationMin = Math.max(1, Math.round(seconds / 60));
      base44.entities.DebtLeadActivity.create({
        leadId: lead.id,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        activityType: 'call',
        activityText: `Outbound call from the calendar card — ${durationMin} min`,
        createdBy: username,
        metadataJson: JSON.stringify({ scope: 'assistant_calendar', durationMin, durationSeconds: seconds, callSid: answeredSid.current }),
      }).catch(() => {});
    }
    answeredSid.current = '';
    setStatus('idle'); setMuted(false); setCallSid('');
  };
  const dial = async (target) => {
    if (active || starting.current) return;
    const raw = String(target || lead?.phone || '').trim(), digits = raw.replace(/\D/g, '');
    const to = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : raw;
    if (!/^\+[1-9]\d{7,14}$/.test(to)) { setError(target ? 'Enter a valid phone number.' : 'This client needs a valid phone number.'); return; }
    const line = lines.find(l => l.key === lineKey);
    if (!line) { setError('Select an outbound line first.'); return; }
    const dialAttempt = ++attempt.current;
    starting.current = true; setError(''); setStatus('calling'); setSeconds(0);
    try {
      if (!device.current) {
        const { data } = await base44.functions.invoke('fronterClientToken', { username });
        if (!data?.token) throw new Error('Could not initialize the Twilio dialer.');
        const next = new Device(data.token, { codecPreferences: ['opus', 'pcmu'], fakeLocalDTMF: true, enableRingingState: true, logLevel: 'error' });
        device.current = next;
        await new Promise((resolve, reject) => { next.once('registered', resolve); next.once('error', reject); next.register(); });
      }
      if (attempt.current !== dialAttempt) return;
      const next = await device.current.connect({ params: { To: to, CallerId: line.number } });
      if (attempt.current !== dialAttempt) { next.disconnect(); return; }
      call.current = next;
      next.on('ringing', () => { setStatus('ringing'); setCallSid(next.parameters?.CallSid || ''); });
      next.on('accept', () => { setStatus('connected'); setCallSid(next.parameters?.CallSid || ''); answeredAt.current = Date.now(); answeredSid.current = next.parameters?.CallSid || ''; const start = answeredAt.current; clearInterval(timer.current); timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000); });
      next.on('disconnect', finish); next.on('cancel', finish);
      next.on('error', e => { setError(e.message); finish(); });
    } catch (e) { setError(e.message || 'Call failed.'); device.current?.destroy(); device.current = null; finish(); }
    finally { starting.current = false; }
  };
  const dialNumber = (target) => dial(target);
  const hangup = () => { attempt.current += 1; call.current?.disconnect(); finish(); };
  const toggleMute = () => { if (call.current) { call.current.mute(!muted); setMuted(!muted); } };
  return { lines, lineKey, setLineKey, loading, status, seconds, muted, error, active, callSid, dial, dialNumber, hangup, toggleMute };
}