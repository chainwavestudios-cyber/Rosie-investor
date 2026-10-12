/**
 * FronterBobCallsTab.jsx — Admin review of BOB training calls from the last 24h.
 * Lists BobSession records (sourceType 'fronter') created in the past 24 hours.
 * Admin can play the recording, download it, and read the transcript preview.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

function fmtDuration(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function fmtAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtExpiresIn(iso) {
  if (!iso) return '—';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  if (diff <= 0) return 'expired';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m left`;
}

export default function FronterBobCallsTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [traineeFilter, setTraineeFilter] = useState('');
  const [trainees, setTrainees] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await base44.entities.BobSession.filter(
        { sourceType: 'fronter', createdAt: { $gte: since } },
        { sort: '-createdAt', limit: 200 }
      );
      const rows = res?.items || res || [];
      setSessions(rows);
      const names = Array.from(new Set(rows.map(r => r.traineeUsername).filter(Boolean)));
      setTrainees(names);
    } catch (e) {
      console.warn('BobCalls load failed:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const shown = traineeFilter
    ? sessions.filter(s => (s.traineeUsername || '').toLowerCase() === traineeFilter.toLowerCase())
    : sessions;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 BOB Training Calls — Last 24h</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{shown.length} session{shown.length === 1 ? '' : 's'} · auto-refreshes every 30s · recordings auto-delete after 24h</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {trainees.length > 0 && (
            <select value={traineeFilter} onChange={e => setTraineeFilter(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', fontFamily: 'Georgia, serif' }}>
              <option value="">All Fronters</option>
              {trainees.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button onClick={load} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : shown.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No BOB training calls in the last 24 hours.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shown.map(s => {
            const isOpen = expanded === s.id;
            let previewLines = [];
            try { previewLines = JSON.parse(s.transcriptJson || '[]'); } catch {}
            return (
              <div key={s.id} style={{ background: '#0d1b2a', border: `1px solid ${isOpen ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isOpen ? null : s.id)} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.recordingUrl ? '#4ade80' : '#4a5568' }} />
                    <div>
                      <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>
                        {s.traineeUsername || 'Unknown'} <span style={{ color: '#6b7280', fontWeight: 'normal', fontSize: '11px' }}>· {s.sessionLabel || s.bobName || 'BOB'}</span>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>
                        {fmtAgo(s.createdAt)} · {fmtDuration(s.durationSeconds)} · {s.transcriptLineCount || 0} lines · expires {fmtExpiresIn(s.expiresAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {s.recordingUrl && (
                      <>
                        <a href={s.recordingUrl} target="_blank" rel="noopener noreferrer" download style={{ background: 'rgba(96,165,250,0.15)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', textDecoration: 'none', fontWeight: 'bold' }}>⬇ Download</a>
                      </>
                    )}
                    <span style={{ color: isOpen ? GOLD : '#6b7280', fontSize: '11px' }}>{isOpen ? '▲ Hide' : '▼ Review'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>
                    {s.recordingUrl && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>🎵 Recording</div>
                        <audio controls src={s.recordingUrl} style={{ width: '100%', height: '32px' }} />
                      </div>
                    )}
                    <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📝 Transcript Preview {s.transcriptFileUrl && <span style={{ color: '#6b7280', textTransform: 'none', letterSpacing: '0' }}>(last {previewLines.length} lines)</span>}</div>
                    {previewLines.length === 0 ? (
                      <div style={{ color: '#4a5568', fontSize: '12px', padding: '12px 0' }}>No transcript available.</div>
                    ) : (
                      <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '4px 0' }}>
                        {previewLines.map((m, i) => {
                          const isBob = m.role === 'bob' || m.speaker === 'bob';
                          const text = m.text || m.content || '';
                          return (
                            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', justifyContent: isBob ? 'flex-start' : 'flex-end' }}>
                              <div style={{ maxWidth: '85%', background: isBob ? 'rgba(16,185,129,0.08)' : 'rgba(96,165,250,0.08)', border: `1px solid ${isBob ? 'rgba(16,185,129,0.2)' : 'rgba(96,165,250,0.2)'}`, borderRadius: isBob ? '10px 10px 10px 2px' : '10px 10px 2px 10px', padding: '6px 10px' }}>
                                <div style={{ color: isBob ? GOLD : BLUE, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>{isBob ? '🤖 BOB' : '🎙 Trainee'}</div>
                                <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.4 }}>{text}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {s.transcriptFileUrl && (
                      <a href={s.transcriptFileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', color: PURPLE, fontSize: '10px', textDecoration: 'underline' }}>View full transcript JSON ↗</a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}