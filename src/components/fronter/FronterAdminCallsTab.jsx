/**
 * FronterAdminCallsTab.jsx — Lists all fronter calls chronologically for the last 24 hours.
 * Admin can play recordings, view dispositions, click lead names to open contact cards,
 * and add comments. Comments appear in the fronter's Feedback tab.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

function fmtDuration(seconds) {
  if (!seconds) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function fmtET(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const DISPOSITION_COLORS = {
  transferred: '#a78bfa',
  connected: '#10b981',
  interested: '#10b981',
  appointment: '#f59e0b',
  booked: '#f59e0b',
  voicemail: '#f59e0b',
  no_answer: '#8a9ab8',
  hung_up: '#ef4444',
  not_interested: '#ef4444',
  queued_no_connect: '#f59e0b',
  email_sent: '#60a5fa',
};

function DispositionBadge({ disposition }) {
  if (!disposition) return <span style={{ color: '#4a5568', fontSize: '11px' }}>—</span>;
  const color = DISPOSITION_COLORS[disposition] || '#8a9ab8';
  const label = disposition.replace(/_/g, ' ');
  return (
    <span style={{ display: 'inline-block', background: `${color}22`, color, border: `1px solid ${color}55`, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</span>
  );
}

export default function FronterAdminCallsTab({ adminUsername, fronters, onOpenLead }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [loadingRecId, setLoadingRecId] = useState(null);
  const [commentingId, setCommentingId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState({});
  const [leadMap, setLeadMap] = useState({});
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.FronterCallTranscript.list('-callDate', 500);
      // Filter to last 24 hours
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = (all || []).filter(c => c.callDate && new Date(c.callDate) >= cutoff);
      setCalls(recent);

      // Load comments for these calls
      const allComments = await base44.entities.FronterCallComment.list('-commentAt', 500);
      const commentMap = {};
      for (const c of allComments || []) {
        if (!commentMap[c.transcriptId]) commentMap[c.transcriptId] = [];
        commentMap[c.transcriptId].push(c);
      }
      setComments(commentMap);

      // Batch-load lead dispositions for all calls
      const leadIds = [...new Set(recent.map(c => c.leadId).filter(Boolean))];
      if (leadIds.length > 0) {
        const leads = await base44.entities.FronterLead.filter({ id: { $in: leadIds } }, '-created_date', 500);
        const leadItems = Array.isArray(leads) ? leads : (leads?.items || []);
        const map = {};
        for (const l of leadItems) {
          map[l.id] = l;
        }
        setLeadMap(map);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Cleanup audio on unmount
  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  const playCall = async (call) => {
    if (!call.recordingUrl) { alert('No recording available for this call.'); return; }
    if (playingId === call.id) { stopPlay(); return; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setLoadingRecId(call.id);
    setPlayingId(call.id);
    try {
      let url = call.recordingUrl;
      if (!url.startsWith('http')) {
        const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url, expires_in: 3600 });
        url = res?.signed_url || url;
      }
      if (playingId !== call.id) return; // user clicked stop while loading
      const audio = new Audio(url);
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;
      await audio.play();
      setLoadingRecId(null);
      audio.onended = () => { setPlayingId(null); setLoadingRecId(null); };
      audio.onerror = () => { setPlayingId(null); setLoadingRecId(null); console.error('Audio playback error for call', call.id); };
    } catch (e) {
      setPlayingId(null);
      setLoadingRecId(null);
      console.error('Failed to play recording:', e);
      // Fallback: open the signed URL in a new tab so the browser handles it
      try {
        let url = call.recordingUrl;
        if (!url.startsWith('http')) {
          const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url, expires_in: 3600 });
          url = res?.signed_url || url;
        }
        window.open(url, '_blank');
      } catch {
        alert('Failed to play recording. Try the download button.');
      }
    }
  };

  const stopPlay = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingId(null);
    setLoadingRecId(null);
  };

  const downloadRecording = async (call) => {
    if (!call.recordingUrl) { alert('No recording available.'); return; }
    try {
      let url = call.recordingUrl;
      if (!url.startsWith('http')) {
        const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url, expires_in: 3600 });
        url = res?.signed_url || url;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${call.leadName || 'call'}.webm`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert('Failed to download recording: ' + (e?.message || String(e)));
    }
  };

  const submitComment = async (call) => {
    if (!commentText.trim()) return;
    try {
      await base44.entities.FronterCallComment.create({
        transcriptId: call.id,
        fronterUsername: call.fronterUsername,
        leadName: call.leadName,
        callDate: call.callDate,
        durationSeconds: call.durationSeconds || 0,
        recordingUrl: call.recordingUrl || '',
        comment: commentText.trim(),
        commentBy: adminUsername,
        commentAt: new Date().toISOString(),
        reviewedByFronter: false,
      });
      setCommentText('');
      setCommentingId(null);
      load();
    } catch (e) { alert('Failed to save comment: ' + (e?.message || String(e))); }
  };

  const handleNameClick = (call) => {
    if (call.leadId && onOpenLead) {
      onOpenLead(call.leadId);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📞 Calls — Last 24 Hours ({calls.length})</div>
        <button onClick={load} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : calls.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '14px' }}>No calls in the last 24 hours.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${GOLD}33` }}>
                {['Time (ET)', 'Fronter', 'Lead', 'Disposition', 'Duration', 'Recording', 'Comments', 'Actions'].map(h => (
                  <th key={h} style={{ color: GOLD, padding: '10px 12px', textAlign: 'left', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map(call => {
                const callComments = comments[call.id] || [];
                const hasComment = callComments.length > 0;
                const lead = leadMap[call.leadId];
                const disposition = lead?.lastCallResult;
                const isPlaying = playingId === call.id;
                const isLoadingRec = loadingRecId === call.id;
                return (
                  <tr key={call.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 12px', color: '#8a9ab8', fontSize: '12px', whiteSpace: 'nowrap' }}>{fmtET(call.callDate)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{call.fronterUsername}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {call.leadId ? (
                        <button
                          onClick={() => handleNameClick(call)}
                          style={{ background: 'none', border: 'none', color: GOLD, fontSize: '13px', cursor: 'pointer', padding: 0, textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 'bold' }}
                          title="Open contact card"
                        >
                          {call.leadName || '—'}
                        </button>
                      ) : (
                        <span style={{ color: '#c4cdd8', fontSize: '13px' }}>{call.leadName || '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <DispositionBadge disposition={disposition} />
                    </td>
                    <td style={{ padding: '10px 12px', color: GOLD, fontSize: '12px', fontFamily: 'monospace' }}>{fmtDuration(call.durationSeconds)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {call.recordingUrl ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {isPlaying ? (
                            <button onClick={stopPlay} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>⏸ Stop</button>
                          ) : (
                            <button
                              onClick={() => playCall(call)}
                              disabled={isLoadingRec}
                              style={{ background: isLoadingRec ? 'rgba(96,165,250,0.15)' : 'rgba(16,185,129,0.15)', color: isLoadingRec ? BLUE : GOLD, border: `1px solid ${isLoadingRec ? 'rgba(96,165,250,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: '4px', padding: '4px 10px', cursor: isLoadingRec ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: isLoadingRec ? 0.7 : 1 }}
                            >
                              {isLoadingRec ? '⏳ Loading…' : '▶ Play'}
                            </button>
                          )}
                          <button
                            onClick={() => downloadRecording(call)}
                            title="Download recording"
                            style={{ background: 'rgba(96,165,250,0.1)', color: BLUE, border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}
                          >
                            ⬇
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#4a5568', fontSize: '11px' }}>No recording</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {hasComment ? (
                        <div>
                          {callComments.map((c, i) => (
                            <div key={c.id || i} style={{ marginBottom: '4px', padding: '6px 8px', background: 'rgba(245,158,11,0.06)', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                              <div style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>{c.commentBy} · {fmtET(c.commentAt)}</div>
                              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.4 }}>{c.comment}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#4a5568', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {commentingId === call.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '250px' }}>
                          <textarea
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Type your feedback..."
                            rows={3}
                            autoFocus
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px', color: '#e8e0d0', fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => submitComment(call)} disabled={!commentText.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '5px 12px', cursor: !commentText.trim() ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: commentText.trim() ? 1 : 0.5 }}>Submit</button>
                            <button onClick={() => { setCommentingId(null); setCommentText(''); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setCommentingId(call.id); setCommentText(''); }} style={{ background: 'rgba(96,165,250,0.15)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>💬 Comment</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}