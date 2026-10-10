/**
 * FronterFeedbackTab.jsx — Shows fronters calls with admin comments.
 * Fronter clicks "Read Comments" to mark as reviewed; the comment auto-deletes 24h later.
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

export default function FronterFeedbackTab({ username }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.FronterCallComment.filter({ fronterUsername: username }, '-commentAt', 200);
      // Only show comments not yet reviewed, or reviewed but not yet auto-deleted
      const now = new Date();
      const visible = (all || []).filter(c => {
        if (!c.reviewedByFronter) return true;
        // If reviewed, show until deleteAfter passes
        if (c.deleteAfter && new Date(c.deleteAfter) > now) return true;
        return false;
      });
      setComments(visible);
    } catch {}
    setLoading(false);
  }, [username]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const playCall = (comment) => {
    if (!comment.recordingUrl) { alert('No recording available for this call.'); return; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio(comment.recordingUrl);
    audioRef.current = audio;
    audio.play();
    setPlayingId(comment.id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => { setPlayingId(null); alert('Failed to play recording.'); };
  };

  const stopPlay = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingId(null);
  };

  const markRead = async (comment) => {
    try {
      const deleteAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await base44.entities.FronterCallComment.update(comment.id, {
        reviewedByFronter: true,
        reviewedAt: new Date().toISOString(),
        deleteAfter,
      });
      load();
    } catch (e) { alert('Failed to mark as read: ' + (e?.message || String(e))); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>💬 Feedback — Admin Comments on Your Calls ({comments.length})</div>
        <button onClick={load} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
      </div>

      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '14px', color: '#8a9ab8', fontSize: '11px' }}>
        Admin comments on your calls appear here. Click <strong style={{ color: GOLD }}>"Read Comments"</strong> to acknowledge feedback. The comment will auto-delete 24 hours after you mark it as read.
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : comments.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px', fontSize: '14px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
          No feedback yet. When an admin comments on one of your calls, it will appear here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comments.map(c => {
            const isReviewed = c.reviewedByFronter;
            return (
              <div key={c.id} style={{ background: '#0d1b2a', border: `1px solid ${isReviewed ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '6px', padding: '16px', borderLeft: `4px solid ${isReviewed ? GOLD : '#f59e0b'}` }}>
                {/* Call info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Lead</div>
                      <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{c.leadName || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Call Date</div>
                      <div style={{ color: '#c4cdd8', fontSize: '13px' }}>{fmtET(c.callDate)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Duration</div>
                      <div style={{ color: GOLD, fontSize: '13px', fontFamily: 'monospace' }}>{fmtDuration(c.durationSeconds)}</div>
                    </div>
                    {c.recordingUrl && (
                      <div>
                        {playingId === c.id ? (
                          <button onClick={stopPlay} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>⏸ Stop</button>
                        ) : (
                          <button onClick={() => playCall(c)} style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>▶ Play Call</button>
                        )}
                      </div>
                    )}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', background: isReviewed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: isReviewed ? GOLD : '#f59e0b' }}>
                    {isReviewed ? '✓ Reviewed' : 'New'}
                  </span>
                </div>

                {/* Comment */}
                <div style={{ padding: '12px', background: 'rgba(245,158,11,0.06)', borderRadius: '4px', marginBottom: '10px' }}>
                  <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>💬 Comment from {c.commentBy} · {fmtET(c.commentAt)}</div>
                  <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.6, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{c.comment}</div>
                </div>

                {/* Action */}
                {!isReviewed ? (
                  <button onClick={() => markRead(c)} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✓ Read Comments</button>
                ) : (
                  <div style={{ color: '#4a5568', fontSize: '11px' }}>
                    ✓ Reviewed at {fmtET(c.reviewedAt)} · Auto-deletes at {fmtET(c.deleteAfter)}
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