/**
 * FronterMonitorPanel.jsx — Floating, draggable, resizable live monitor for super admins.
 * Checkbox-select up to 3 fronters. Each box shows: status (view-only), call status,
 * live transcript, call duration, customer name, calls today, time logged on, time in status.
 * Listen and Barge buttons for active calls (requires conference).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const RED = '#ef4444';

const STATUS_CONFIG = {
  dialing: { label: 'Dialing', color: GOLD, icon: '📞' },
  lunch_break: { label: 'Lunch Break', color: AMBER, icon: '🍽️' },
  bathroom_break: { label: 'Bathroom Break', color: BLUE, icon: '🚻' },
  offline: { label: 'Offline', color: '#6b7280', icon: '⭕' },
};

function fmtDur(seconds) {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtCallDur(s) {
  if (!s || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function FronterMonitorPanel({ onClose, adminUsername, onOpenLead }) {
  const [fronters, setFronters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [transcripts, setTranscripts] = useState({});
  const [callsToday, setCallsToday] = useState({});
  const [credsToday, setCredsToday] = useState({});
  const [refreshing, setRefreshing] = useState({});
  const [lineAssignments, setLineAssignments] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState({ x: 30, y: 70 });
  const [size, setSize] = useState({ w: 860, h: 520 });
  const [showCheckboxes, setShowCheckboxes] = useState(true);
  const [listenStatus, setListenStatus] = useState({}); // {username: 'listening' | 'barged' | ''}
  const [viewTab, setViewTab] = useState('monitor');
  const [transferQueue, setTransferQueue] = useState([]);
  const [takeoverStatus, setTakeoverStatus] = useState({}); // {headsUpId: 'taking_over' | 'done' | ''}
  const [deviceReady, setDeviceReady] = useState(false);
  // Email alert: { [username]: { leadName, leadId, type, blinkKey, shownAt } }
  const [emailAlerts, setEmailAlerts] = useState({});
  const leadCacheRef = useRef({});
  const alertTimersRef = useRef({});
  const dragRef = useRef(null);
  const deviceRef = useRef(null);
  const incomingCallRef = useRef(null);

  // ── Email tracking subscription: blink + ding when a monitored fronter's lead opens/clicks ──
  useEffect(() => {
    const getLead = async (leadId) => {
      if (leadCacheRef.current[leadId]) return leadCacheRef.current[leadId];
      try {
        const lead = await base44.entities.FronterLead.get(leadId);
        leadCacheRef.current[leadId] = lead;
        return lead;
      } catch { return null; }
    };

    const playDing = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch {}
    };

    const unsub = base44.entities.EmailTrackingEvent.subscribe(async (event) => {
      if (event.type !== 'create' || !event.data?.leadId) return;
      const ev = event.data;
      const eventId = ev.id || `${ev.leadId}_${ev.trackedAt}_${ev.eventType}_${Math.random()}`;
      // 30-second bot filter delay
      alertTimersRef.current[eventId] = setTimeout(async () => {
        const lead = await getLead(ev.leadId);
        if (!lead?.assignedTo) return;
        const fronterUsername = lead.assignedTo;
        const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
        setEmailAlerts(prev => ({
          ...prev,
          [fronterUsername]: {
            leadName,
            leadId: ev.leadId,
            type: ev.eventType,
            blinkKey: Date.now(),
            shownAt: Date.now(),
          },
        }));
        playDing();
        // Auto-clear after 12 seconds
        setTimeout(() => {
          setEmailAlerts(prev => {
            const next = { ...prev };
            delete next[fronterUsername];
            return next;
          });
        }, 12000);
      }, 30000);
    });
    return () => {
      try { unsub(); } catch {}
      Object.values(alertTimersRef.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // Initialize Twilio device for the admin so they can receive listen/barge/takeover calls
  useEffect(() => {
    let destroyed = false;
    const initDevice = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const res = await base44.functions.invoke('fronterClientToken', { username: adminUsername });
        const token = res?.data?.token || res?.token;
        if (!token) throw new Error('No Twilio token');
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
        if (destroyed) { try { device.destroy(); } catch {} return; }
        // Auto-accept incoming calls (listen/barge/takeover)
        device.on('incoming', (call) => {
          incomingCallRef.current = call;
          call.accept();
          call.on('disconnect', () => { incomingCallRef.current = null; });
          call.on('cancel', () => { incomingCallRef.current = null; });
          call.on('error', () => { incomingCallRef.current = null; });
        });
        deviceRef.current = device;
        setDeviceReady(true);
      } catch (e) { console.warn('Monitor Twilio device init failed:', e.message); }
    };
    initDevice();
    return () => {
      destroyed = true;
      try { incomingCallRef.current?.disconnect(); } catch {}
      try { deviceRef.current?.destroy(); } catch {}
      deviceRef.current = null;
    };
  }, [adminUsername]);

  // Load fronters + line assignments
  useEffect(() => {
    Promise.all([
      base44.entities.DebtCoachUser.list('-created_date', 500),
      base44.entities.FronterLineAssignment.list('-assignedAt', 100),
    ]).then(([users, assignments]) => {
      const f = (users || []).filter(u => (u.role === 'fronter' || u.role === 'super_admin') && u.isActive);
      setFronters(f);
      setLineAssignments(assignments || []);
      setSelected(f.slice(0, 3).map(u => u.username));
    }).catch(() => {});
  }, []);

  // Poll sessions, transcripts, calls, creds
  const poll = useCallback(async (fronterUsername) => {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();
      const [allSessions, todayTranscripts, credsLeads] = await Promise.all([
        base44.entities.DialerSession.filter({ status: { $in: ['logged_in', 'on_call'] } }, '-loginAt', 100),
        base44.entities.FronterCallTranscript.filter({ callDate: { $gte: todayISO } }, '-callDate', 200),
        base44.entities.FronterLead.filter({ credsSentAt: { $gte: todayISO } }, '-created_date', 200),
      ]);
      setSessions(allSessions || []);

      const callCounts = {};
      (todayTranscripts || []).forEach(t => {
        callCounts[t.fronterUsername] = (callCounts[t.fronterUsername] || 0) + 1;
      });
      setCallsToday(callCounts);

      const credCounts = {};
      (credsLeads || []).forEach(l => {
        const owner = l.assignedTo;
        if (owner) credCounts[owner] = (credCounts[owner] || 0) + 1;
      });
      setCredsToday(credCounts);

      const onCallSessions = (allSessions || []).filter(s => s.status === 'on_call');
      const latest = {};
      for (const s of onCallSessions) {
        const fronterTranscripts = (todayTranscripts || []).filter(t => t.fronterUsername === s.username);
        if (fronterTranscripts.length > 0) latest[s.username] = fronterTranscripts[0];
      }
      setTranscripts(latest);

      // Fetch transfer queue (active headsUp alerts)
      const queueRaw = await base44.entities.FronterHeadsUp.filter({ status: 'active' }, '-createdAt', 20);
      const queueItems = queueRaw || [];
      const leadIds = queueItems.map(q => q.leadId).filter(Boolean);
      let leadMap = {};
      if (leadIds.length > 0) {
        try {
          const leadsData = await base44.entities.FronterLead.filter({ id: { $in: leadIds } }, '-created_date', 50);
          (leadsData || []).forEach(l => { leadMap[l.id] = l; });
        } catch {}
      }
      setTransferQueue(queueItems.map(q => ({ ...q, lead: leadMap[q.leadId] })));
    } catch {}
    if (fronterUsername) setRefreshing(prev => ({ ...prev, [fronterUsername]: false }));
  }, []);

  // Poll sessions, transcripts, calls
  useEffect(() => {
    poll();
    const interval = setInterval(() => poll(), 3000);
    return () => clearInterval(interval);
  }, [poll]);

  const refreshFronter = (username) => {
    setRefreshing(prev => ({ ...prev, [username]: true }));
    poll(username);
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const toggleFronter = (username) => {
    setSelected(prev => {
      if (prev.includes(username)) return prev.filter(u => u !== username);
      if (prev.length >= 3) return prev;
      return [...prev, username];
    });
  };

  const getSession = (username) => sessions.find(s => s.username === username);

  // Listen / Barge / End
  const handleListen = async (username) => {
    const session = getSession(username);
    if (!session?.currentCallConferenceName) { alert('No active conference for this fronter. The fronter must merge or hold the call first.'); return; }
    const assignment = lineAssignments.find(a => a.username === username);
    try {
      await base44.functions.invoke('fronterCall', {
        action: 'listen',
        conferenceName: session.currentCallConferenceName,
        adminUsername: adminUsername || 'admin',
        lineKey: assignment?.twilioLineKey || 'TWILIO_FROM_NUMBER',
      });
      setListenStatus(prev => ({ ...prev, [username]: 'listening' }));
    } catch (e) { alert('Listen failed: ' + (e?.message || String(e))); }
  };

  const handleBarge = async (username) => {
    const session = getSession(username);
    if (!session?.currentCallConferenceName) { alert('No active conference for this fronter. The fronter must merge or hold the call first.'); return; }
    const assignment = lineAssignments.find(a => a.username === username);
    try {
      await base44.functions.invoke('fronterCall', {
        action: 'barge',
        conferenceName: session.currentCallConferenceName,
        adminUsername: adminUsername || 'admin',
        lineKey: assignment?.twilioLineKey || 'TWILIO_FROM_NUMBER',
      });
      setListenStatus(prev => ({ ...prev, [username]: 'barged' }));
    } catch (e) { alert('Barge failed: ' + (e?.message || String(e))); }
  };

  const handleEndListen = async (username) => {
    const session = getSession(username);
    if (!session?.currentCallConferenceName) return;
    try {
      await base44.functions.invoke('fronterCall', {
        action: 'endListen',
        conferenceName: session.currentCallConferenceName,
        adminUsername: adminUsername || 'admin',
      });
      setListenStatus(prev => ({ ...prev, [username]: '' }));
    } catch {}
  };

  const handleTakeover = async (item) => {
    if (!item.conferenceName) { alert('No active conference for this transfer. The fronter needs to merge the call first.'); return; }
    if (!deviceReady) { alert('Twilio device not ready. Please allow microphone access and try again.'); return; }
    setTakeoverStatus(prev => ({ ...prev, [item.id]: 'taking_over' }));
    try {
      await base44.functions.invoke('fronterCall', {
        action: 'takeover',
        conferenceName: item.conferenceName,
        adminUsername: adminUsername || 'admin',
        lineKey: item.lineKey || 'TWILIO_FROM_NUMBER',
      });
      setTakeoverStatus(prev => ({ ...prev, [item.id]: 'done' }));
      // Close the headsUp alert since the admin took over
      try { await base44.entities.FronterHeadsUp.update(item.id, { status: 'closed' }); } catch {}
    } catch (e) {
      alert('Takeover failed: ' + (e?.message || String(e)));
      setTakeoverStatus(prev => ({ ...prev, [item.id]: '' }));
    }
  };

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes emailAlertBlink{0%,100%{border-color:rgba(16,185,129,0.3);box-shadow:0 0 4px rgba(16,185,129,0.1)}50%{border-color:#10b981;box-shadow:0 0 20px rgba(16,185,129,0.6)}}`}</style>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📡 Fronter Monitor</span>
          <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
            <button onClick={() => setViewTab('monitor')} style={{ padding: '3px 10px', background: viewTab === 'monitor' ? `${BLUE}18` : 'transparent', border: `1px solid ${viewTab === 'monitor' ? BLUE + '44' : 'rgba(255,255,255,0.1)'}`, borderRadius: '3px', color: viewTab === 'monitor' ? BLUE : '#8a9ab8', cursor: 'pointer', fontSize: '10px', fontWeight: viewTab === 'monitor' ? 'bold' : 'normal' }}>Monitor</button>
            <button onClick={() => setViewTab('queue')} style={{ padding: '3px 10px', background: viewTab === 'queue' ? `${RED}18` : 'transparent', border: `1px solid ${viewTab === 'queue' ? RED + '44' : 'rgba(255,255,255,0.1)'}`, borderRadius: '3px', color: viewTab === 'queue' ? RED : '#8a9ab8', cursor: 'pointer', fontSize: '10px', fontWeight: viewTab === 'queue' ? 'bold' : 'normal' }}>🚨 Transfer Queue {transferQueue.length > 0 && `(${transferQueue.length})`}</button>
          </div>
          {viewTab === 'monitor' && <span style={{ color: '#6b7280', fontSize: '10px' }}>{selected.length}/3 selected</span>}
          {!deviceReady && <span style={{ color: AMBER, fontSize: '9px' }}>⚠ Mic needed for takeover</span>}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {viewTab === 'monitor' && <button onClick={() => setShowCheckboxes(p => !p)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>{showCheckboxes ? 'Hide' : 'Show'} Fronters</button>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Checkbox section */}
      {showCheckboxes && viewTab === 'monitor' && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0, maxHeight: '80px', overflowY: 'auto' }}>
          {fronters.map(f => {
            const isSel = selected.includes(f.username);
            const disabled = !isSel && selected.length >= 3;
            return (
              <button key={f.id} onClick={() => toggleFronter(f.username)} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '3px', border: `1px solid ${isSel ? BLUE + '66' : 'rgba(255,255,255,0.1)'}`, background: isSel ? `${BLUE}18` : 'rgba(255,255,255,0.03)', color: isSel ? BLUE : '#8a9ab8', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: isSel ? 'bold' : 'normal', opacity: disabled ? 0.4 : 1, fontFamily: 'Georgia, serif' }}>
                <span style={{ fontSize: '13px' }}>{isSel ? '☑' : '☐'}</span>
                {f.username}
              </button>
            );
          })}
          {fronters.length === 0 && <span style={{ color: '#4a5568', fontSize: '11px' }}>No active fronters.</span>}
        </div>
      )}

      {/* Transfer Queue tab */}
      {viewTab === 'queue' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
          {transferQueue.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No leads waiting in the transfer queue.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transferQueue.map(item => {
                const holdSeconds = item.createdAt ? Math.floor((now - new Date(item.createdAt).getTime()) / 1000) : 0;
                const holdMin = Math.floor(holdSeconds / 60);
                const holdSec = holdSeconds % 60;
                const status = takeoverStatus[item.id] || '';
                const hasConf = !!item.conferenceName;
                return (
                  <div key={item.id} style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${hasConf ? RED + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Hold time badge */}
                    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '60px' }}>
                      <div style={{ color: holdSeconds > 60 ? RED : AMBER, fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>{holdMin}:{holdSec.toString().padStart(2, '0')}</div>
                      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>On Hold</div>
                    </div>
                    {/* Lead info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{item.leadName || 'Unknown Lead'}</div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
                        {item.lead?.debtAmount ? <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>${Number(item.lead.debtAmount).toLocaleString()}</span> : <span style={{ color: '#4a5568', fontSize: '12px' }}>Debt: —</span>}
                        <span style={{ color: '#6b7280', fontSize: '11px' }}>from {item.fronterUsername}</span>
                        {item.leadPhone && <span style={{ color: '#4a5568', fontSize: '11px' }}>· {item.leadPhone}</span>}
                      </div>
                    </div>
                    {/* Takeover button */}
                    <button
                      onClick={() => handleTakeover(item)}
                      disabled={!hasConf || status === 'taking_over' || status === 'done'}
                      style={{
                        background: status === 'done' ? 'rgba(74,222,128,0.15)' : hasConf ? 'linear-gradient(135deg,#ef4444,#f87171)' : 'rgba(255,255,255,0.05)',
                        color: status === 'done' ? '#4ade80' : hasConf ? '#fff' : '#6b7280',
                        border: `1px solid ${status === 'done' ? 'rgba(74,222,128,0.3)' : hasConf ? RED + '66' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '4px',
                        padding: '8px 18px',
                        cursor: (!hasConf || status === 'taking_over' || status === 'done') ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        opacity: (!hasConf || status === 'taking_over') ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {status === 'taking_over' ? '⏳ Taking over…' : status === 'done' ? '✓ Taken Over' : hasConf ? '🎯 Takeover' : 'No Conference'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Monitor tab — Grid of selected fronters */}
      {viewTab === 'monitor' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '10px', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, selected.length)}, 1fr)`, gap: '10px', minWidth: 0 }}>
          {selected.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px', gridColumn: '1 / -1' }}>Select fronters above to monitor them.</div>
          ) : (
            selected.map(username => {
              const session = getSession(username);
              return <FronterBox key={username} username={username} session={session} transcript={transcripts[username]} callsTodayCount={callsToday[username] || 0} credsTodayCount={credsToday[username] || 0} now={now} listenStatus={listenStatus[username] || ''} refreshing={!!refreshing[username]} emailAlert={emailAlerts[username] || null} onOpenLead={onOpenLead} onRefresh={() => refreshFronter(username)} onListen={() => handleListen(username)} onBarge={() => handleBarge(username)} onEndListen={() => handleEndListen(username)} />;
            })
          )}
        </div>
      )}

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(400, startW + ev.clientX - startX), h: Math.max(300, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}

function FronterBox({ username, session, transcript, callsTodayCount, credsTodayCount, now, listenStatus, refreshing, emailAlert, onOpenLead, onRefresh, onListen, onBarge, onEndListen }) {
  const status = session?.fronterStatus || 'offline';
  const isOnCall = session?.status === 'on_call';
  const hasConference = !!session?.currentCallConferenceName;
  const callDur = isOnCall && session?.currentCallStartedAt ? Math.floor((now - new Date(session.currentCallStartedAt).getTime()) / 1000) : 0;
  const loggedOn = session?.loginAt ? Math.floor((now - new Date(session.loginAt).getTime()) / 1000) : 0;
  const statusDur = session?.fronterStatusAt ? Math.floor((now - new Date(session.fronterStatusAt).getTime()) / 1000) : 0;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;

  let transcriptLines = [];
  if (transcript?.transcriptJson) {
    try { transcriptLines = JSON.parse(transcript.transcriptJson); } catch {}
  }

  const hasEmailAlert = !!emailAlert;
  const alertKey = `emailBlink_${username}_${emailAlert?.blinkKey || 0}`;

  return (
    <div key={alertKey} style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${hasEmailAlert ? '#10b981' : statusCfg.color + '33'}`, borderRadius: '6px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', animation: hasEmailAlert ? 'emailAlertBlink 0.5s ease-in-out 3' : 'none', boxShadow: hasEmailAlert ? '0 0 16px rgba(16,185,129,0.4)' : 'none' }}>
      {/* Name + status badge (view-only) */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button onClick={onRefresh} disabled={refreshing} title="Refresh data" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '2px 7px', cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '11px', color: '#8a9ab8', lineHeight: 1 }}>
            {refreshing ? '⏳' : '↻'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '10px', background: `${statusCfg.color}18`, border: `1px solid ${statusCfg.color}33` }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.color }} />
            <span style={{ color: statusCfg.color, fontSize: '9px', fontWeight: 'bold' }}>{statusCfg.icon} {statusCfg.label}</span>
          </div>
        </div>
      </div>

      {/* Email alert banner */}
      {hasEmailAlert && (
        <div style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{emailAlert.type === 'open' ? '📧' : '🖱️'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#10b981', fontSize: '10px', fontWeight: 'bold' }}>{emailAlert.type === 'open' ? 'EMAIL OPENED' : 'LINK CLICKED'}</div>
            <button onClick={() => onOpenLead?.(emailAlert.leadId)} style={{ background: 'none', border: 'none', color: '#e8e0d0', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}>{emailAlert.leadName} →</button>
          </div>
        </div>
      )}

      {/* Call status + Listen/Barge buttons */}
      <div style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {isOnCall ? (
          <>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1s infinite', flexShrink: 0 }} />
            <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 'bold' }}>● On Call</span>
            <span style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtCallDur(callDur)}</span>
            {hasConference && !listenStatus && (
              <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                <button onClick={onListen} style={{ background: 'rgba(96,165,250,0.15)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>🎧 Listen</button>
                <button onClick={onBarge} style={{ background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>📢 Barge</button>
              </div>
            )}
            {listenStatus && (
              <button onClick={onEndListen} style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>
                {listenStatus === 'barged' ? '📢 Barged · End' : '🎧 Listening · End'}
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
            <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold' }}>○ No Call</span>
          </>
        )}
      </div>

      {/* On call details: customer name + transcript */}
      {isOnCall && (
        <div style={{ flex: 1, minHeight: 0, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 10px', color: BLUE, fontSize: '11px', fontWeight: 'bold' }}>👤 {session?.currentCallLeadName || 'Unknown'}</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px', fontSize: '10px', lineHeight: 1.4 }}>
            {transcriptLines.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '8px' }}>Waiting for transcript…</div>
            ) : (
              transcriptLines.slice(-8).map((l, i) => (
                <div key={i} style={{ marginBottom: '2px', display: 'flex', gap: '4px' }}>
                  <span style={{ color: l.speaker === 0 ? BLUE : GOLD, fontWeight: 'bold', flexShrink: 0, minWidth: '32px' }}>{l.speaker === 0 ? 'Agent' : 'Cust'}</span>
                  <span style={{ color: '#c4cdd8' }}>{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom stats */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '12px', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold' }}>{callsTodayCount}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Calls</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#4ade80', fontSize: '13px', fontWeight: 'bold' }}>{credsTodayCount}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Creds Sent</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>{fmtDur(loggedOn)}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logged On</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: statusCfg.color, fontSize: '13px', fontWeight: 'bold' }}>{fmtDur(statusDur)}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Status</div>
        </div>
      </div>
    </div>
  );
}