/**
 * VoicemailNotificationPopup
 * Polls CallLog every 30s. When a new unlistened voicemail appears,
 * shows a toast-style popup with audio playback + click-to-open lead card.
 *
 * Usage in AdminDashboardMain:
 *   import VoicemailNotificationPopup from './VoicemailNotificationPopup';
 *   ...
 *   <VoicemailNotificationPopup
 *     onOpenLead={(leadId) => { handleViewChange('leads'); setOpenLeadId(leadId); }}
 *     onOpenInvestor={(investorId) => openInvestorById(investorId)}
 *     onOpenCallLog={() => setShowCallLog(true)}
 *   />
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const POLL_MS = 30000;

export default function VoicemailNotificationPopup({ onOpenLead, onOpenInvestor, onOpenCallLog }) {
  const [notifications, setNotifications] = useState([]); // [{log, id}]
  const [playing, setPlaying]             = useState(null); // log.id
  const seenIdsRef   = useRef(new Set());
  const audioRef     = useRef(null);

  useEffect(() => {
    // Seed seen IDs from already-listened VMs on mount — don't alert on stale ones
    base44.entities.CallLog.list('-calledAt', 100).then(logs => {
      (logs || []).forEach(l => {
        if (l.vmListened || !l.vmRecordingUrl) seenIdsRef.current.add(l.id);
      });
      // After seeding, start polling
      poll();
      const interval = setInterval(poll, POLL_MS);
      return () => clearInterval(interval);
    }).catch(() => {});
  }, []);

  const poll = async () => {
    try {
      const logs = await base44.entities.CallLog.list('-calledAt', 50);
      const newVms = (logs || []).filter(l =>
        l.vmRecordingUrl && !l.vmListened && !seenIdsRef.current.has(l.id)
      );
      newVms.forEach(l => seenIdsRef.current.add(l.id));
      if (newVms.length > 0) {
        setNotifications(prev => [
          ...newVms.map(l => ({ log: l, uid: l.id + '-' + Date.now() })),
          ...prev,
        ].slice(0, 5)); // keep max 5 at once
        // Play a soft notification sound if browser allows
        try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA==').play().catch(()=>{}); } catch {}
      }
    } catch {}
  };

  const dismiss = (uid) => setNotifications(prev => prev.filter(n => n.uid !== uid));

  const markListened = async (log) => {
    await base44.entities.CallLog.update(log.id, { vmListened: true, dismissed: true }).catch(() => {});
  };

  if (notifications.length === 0) return null;

  return (
    <div style={{ position:'fixed', bottom:'24px', right:'24px', zIndex:999999, display:'flex', flexDirection:'column', gap:'8px', maxWidth:'340px' }}>
      {notifications.map(({ log, uid }) => (
        <div key={uid} style={{ background:'#0d1a2e', border:`1px solid rgba(245,158,11,0.5)`, borderLeft:`4px solid #f59e0b`, borderRadius:'10px', padding:'14px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.8)', fontFamily:'Georgia, serif', animation:'slideInRight 0.3s ease' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'20px' }}>📩</span>
              <div>
                <div style={{ color:'#f59e0b', fontSize:'11px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase' }}>New Voicemail</div>
                <div style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', marginTop:'2px' }}>
                  {log.callerName || log.fromNumber || 'Unknown Caller'}
                </div>
                {log.callerName && <div style={{ color:'#60a5fa', fontSize:'11px', fontFamily:'monospace' }}>{log.fromNumber}</div>}
              </div>
            </div>
            <button onClick={() => dismiss(uid)} style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'18px', lineHeight:1, flexShrink:0, padding:'0 0 0 8px' }}>×</button>
          </div>

          {log.vmTranscription && (
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'8px', marginBottom:'8px', color:'#8a9ab8', fontSize:'11px', lineHeight:1.5, fontStyle:'italic' }}>
              "{log.vmTranscription.slice(0, 120)}{log.vmTranscription.length > 120 ? '…' : ''}"
            </div>
          )}

          {/* Audio player */}
          {playing === log.id && (
            <audio ref={audioRef} src={log.vmRecordingUrl} controls autoPlay style={{ width:'100%', height:'32px', marginBottom:'8px' }} />
          )}

          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            <button
              onClick={() => { setPlaying(playing === log.id ? null : log.id); markListened(log); }}
              style={{ background: playing===log.id?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)', color: playing===log.id?'#ef4444':'#f59e0b', border:`1px solid ${playing===log.id?'rgba(239,68,68,0.4)':'rgba(245,158,11,0.4)'}`, borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
              {playing === log.id ? '⏹ Stop' : '▶ Play'}
            </button>
            {log.leadId && onOpenLead && (
              <button onClick={() => { markListened(log); dismiss(uid); onOpenLead(log.leadId); }}
                style={{ background:'rgba(167,139,250,0.15)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.35)', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                📋 Open Lead
              </button>
            )}
            {log.investorId && onOpenInvestor && (
              <button onClick={() => { markListened(log); dismiss(uid); onOpenInvestor(log.investorId); }}
                style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.35)', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                👤 Open Investor
              </button>
            )}
            <button onClick={() => { markListened(log); dismiss(uid); onOpenCallLog && onOpenCallLog(); }}
              style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>
              View All
            </button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}