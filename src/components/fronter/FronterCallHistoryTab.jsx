/**
 * FronterCallHistoryTab.jsx — Full call history with saved transcripts for a lead.
 * Shows every FronterCallTranscript record for this lead, with expandable transcript
 * text and recording playback (private file URIs get a signed URL on demand).
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const DARK = '#0a0f1e';

function fmtDuration(seconds) {
  if (!seconds) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function fmtET(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function FronterCallHistoryTab({ leadId }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [loadingRecId, setLoadingRecId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!leadId) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      try {
        const res = await base44.entities.FronterCallTranscript.filter(
          { leadId },
          { sort: '-callDate', limit: 200 }
        );
        if (!active) return;
        setCalls(res?.items || res || []);
      } catch {}
      if (active) setLoading(false);
    };
    load();
  }, [leadId]);

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  const stopPlay = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingId(null);
  };

  const playRecording = async (call) => {
    if (!call.recordingUrl) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === call.id) { setPlayingId(null); return; }
    setLoadingRecId(call.id);
    try {
      let url = call.recordingUrl;
      if (!url.startsWith('http')) {
        const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url });
        url = res?.signed_url || url;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setPlayingId(call.id);
      setLoadingRecId(null);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => { setPlayingId(null); setLoadingRecId(null); alert('Failed to play recording.'); };
    } catch (e) {
      setLoadingRecId(null);
      alert('Failed to load recording: ' + (e?.message || String(e)));
    }
  };

  const getTranscriptLines = (call) => {
    try { return JSON.parse(call.transcriptJson || '[]'); } catch { return []; }
  };

  if (loading) return <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Loading call history…</div>;

  if (calls.length === 0) {
    return <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No call history yet.</div>;
  }

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>📋 Call History — {calls.length} call{calls.length !== 1 ? 's' : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {calls.map(call => {
          const lines = getTranscriptLines(call);
          const isExpanded = expandedId === call.id;
          return (
            <div key={call.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : call.id)}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{fmtET(call.callDate)}</div>
                  <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>
                    {call.fronterUsername} · {fmtDuration(call.durationSeconds)} · {lines.length} lines
                  </div>
                </div>
                {/* Recording button */}
                {call.recordingUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); playRecording(call); }}
                    style={{
                      background: playingId === call.id ? 'rgba(239,68,68,0.15)' : loadingRecId === call.id ? 'rgba(96,165,250,0.15)' : 'rgba(16,185,129,0.15)',
                      color: playingId === call.id ? '#ef4444' : loadingRecId === call.id ? BLUE : GOLD,
                      border: `1px solid ${playingId === call.id ? 'rgba(239,68,68,0.3)' : loadingRecId === call.id ? 'rgba(96,165,250,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', flexShrink: 0,
                    }}
                  >
                    {loadingRecId === call.id ? '⏳' : playingId === call.id ? '⏸ Stop' : '▶ Play'}
                  </button>
                )}
                {/* Expand/collapse */}
                <span style={{ color: '#6b7280', fontSize: '14px', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>
              </div>
              {/* Expanded transcript */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', maxHeight: '400px', overflowY: 'auto' }}>
                  {lines.length === 0 ? (
                    <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No transcript saved for this call.</div>
                  ) : lines.map((line, i) => {
                    const isAgent = line.speaker === 0;
                    return (
                      <div key={i} style={{ display: 'flex', marginBottom: '8px', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '85%', background: isAgent ? 'rgba(96,165,250,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: isAgent ? '10px 10px 2px 10px' : '10px 10px 10px 2px', padding: '6px 10px' }}>
                          <div style={{ marginBottom: '2px' }}>
                            <span style={{ color: isAgent ? BLUE : GOLD, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAgent ? '🎙 Agent' : '👤 Customer'}</span>
                          </div>
                          <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.45 }}>{line.text}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}