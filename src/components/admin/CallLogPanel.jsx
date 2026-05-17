import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function formatDur(sec) {
  if (!sec || sec < 1) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_COLORS = {
  answered:  { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: '📞' },
  completed: { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  icon: '✅' },
  missed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '📵' },
  voicemail: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '📩' },
  ringing:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  icon: '🔔' },
  'no-answer':{ color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '📵' },
};

export default function CallLogPanel({ onClose, onOpenLead }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [numberFilter, setNumberFilter] = useState('all');
  const [playingVm, setPlayingVm] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.CallLog.list('-calledAt', 100);
      setLogs(data || []);
    } catch {}
    setLoading(false);
  };

  const markVmListened = async (log) => {
    if (!log.vmListened) {
      await base44.entities.CallLog.update(log.id, { vmListened: true, dismissed: true }).catch(() => {});
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, vmListened: true, dismissed: true } : l));
    }
    setPlayingVm(log.id === playingVm ? null : log.id);
  };

  const dismissAll = async () => {
    const unread = logs.filter(l => !l.dismissed);
    await Promise.all(unread.map(l => base44.entities.CallLog.update(l.id, { dismissed: true }).catch(() => {})));
    setLogs(prev => prev.map(l => ({ ...l, dismissed: true, vmListened: l.vmRecordingUrl ? l.vmListened : true })));
  };

  // Unique numbers for filter
  const allNumbers = [...new Set(logs.map(l => l.fromNumber || l.toNumber).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (numberFilter === 'all') return true;
    return l.fromNumber === numberFilter || l.toNumber === numberFilter;
  });

  const unlistenedVm = logs.filter(l => l.vmRecordingUrl && !l.vmListened).length;
  const missedCount = logs.filter(l => (l.status === 'missed' || l.status === 'no-answer') && !l.dismissed).length;

  return (
    <div style={{
      position: 'fixed', top: '70px', right: '20px', zIndex: 99990,
      width: '480px', maxHeight: '80vh',
      background: '#0d1b2a', border: `1px solid rgba(184,147,58,0.3)`,
      borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: GOLD, fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>📋 Call Log</span>
          {unlistenedVm > 0 && (
            <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '10px', padding: '1px 8px', fontSize: '10px', fontWeight: 'bold' }}>
              📩 {unlistenedVm} VM
            </span>
          )}
          {missedCount > 0 && (
            <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '1px 8px', fontSize: '10px', fontWeight: 'bold' }}>
              📵 {missedCount} Missed
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={dismissAll} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>Mark All Read</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <select value={numberFilter} onChange={e => setNumberFilter(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif', colorScheme: 'dark', width: '100%' }}>
          <option value="all">📱 All Numbers ({logs.length} calls)</option>
          {allNumbers.map(num => (
            <option key={num} value={num}>{num} ({logs.filter(l => l.fromNumber === num || l.toNumber === num).length} calls)</option>
          ))}
        </select>
      </div>

      {/* Call list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            No call records yet.
          </div>
        )}
        {filtered.map((log) => {
          const st = STATUS_COLORS[log.status] || STATUS_COLORS.ringing;
          const isUnread = !log.dismissed && (log.status === 'missed' || log.status === 'no-answer' || (log.vmRecordingUrl && !log.vmListened));
          const displayName = log.callerName || (log.direction === 'inbound' ? log.fromNumber : log.toNumber) || '—';
          const displayNum = log.direction === 'inbound' ? log.fromNumber : log.toNumber;
          const isPlayingThis = playingVm === log.id;

          return (
            <div key={log.id} style={{
              background: isUnread ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${isUnread ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
              borderLeft: `3px solid ${st.color}`,
              borderRadius: '6px', padding: '10px 12px', marginBottom: '6px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                {/* Left: name + number */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px' }}>{st.icon}</span>
                    <span style={{ color: isUnread ? '#e8e0d0' : '#c4cdd8', fontSize: '13px', fontWeight: isUnread ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                    <span style={{ background: log.direction === 'inbound' ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.12)', color: log.direction === 'inbound' ? '#60a5fa' : '#a78bfa', fontSize: '9px', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
                      {log.direction === 'inbound' ? '↙ In' : '↗ Out'}
                    </span>
                    {!log.dismissed && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, display: 'inline-block' }} />}
                  </div>
                  <div style={{ color: '#60a5fa', fontSize: '11px', fontFamily: 'monospace' }}>{displayNum || '—'}</div>
                </div>

                {/* Right: time + duration */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>{fmtDateTime(log.calledAt)}</div>
                  <div style={{ color: st.color, fontSize: '10px', marginTop: '2px' }}>
                    <span style={{ background: st.bg, padding: '1px 6px', borderRadius: '3px' }}>{log.status}</span>
                    {log.durationSeconds > 0 && <span style={{ color: '#6b7280', marginLeft: '4px' }}>⏱ {formatDur(log.durationSeconds)}</span>}
                  </div>
                </div>
              </div>

              {/* Voicemail row */}
              {log.vmRecordingUrl && (
                <div style={{ marginTop: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '7px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPlayingThis ? '6px' : '0' }}>
                    <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>📩 Voicemail {!log.vmListened && '· NEW'}</span>
                    <button onClick={() => markVmListened(log)}
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                      {isPlayingThis ? '⏹ Close' : '▶ Play'}
                    </button>
                  </div>
                  {log.vmTranscription && (
                    <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, fontStyle: 'italic', marginTop: '4px' }}>
                      "{log.vmTranscription.slice(0, 200)}{log.vmTranscription.length > 200 ? '…' : ''}"
                    </div>
                  )}
                  {isPlayingThis && (
                    <audio ref={audioRef} src={log.vmRecordingUrl} controls autoPlay
                      style={{ width: '100%', marginTop: '6px', height: '32px' }} />
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {(log.leadId) && onOpenLead && (
                  <button onClick={() => onOpenLead(log.leadId)}
                    style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>
                    📋 Open Lead Card
                  </button>
                )}
                {!log.dismissed && (
                  <button onClick={async () => {
                    await base44.entities.CallLog.update(log.id, { dismissed: true }).catch(() => {});
                    setLogs(prev => prev.map(l => l.id === log.id ? { ...l, dismissed: true } : l));
                  }}
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>
                    ✓ Dismiss
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}