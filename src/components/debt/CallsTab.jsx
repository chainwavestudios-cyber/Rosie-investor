/**
 * CallsTab.jsx — Shows all calls for the logged-in user.
 * Dialers see only their own calls; managers and admins see all.
 * Each call expands to show: transcript, intent report, Q&A history,
 * coaching history, intent history, and manager comments.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', resize: 'vertical' };

const ANIMAL_COLORS = { duck: '#ef4444', cow: '#4ade80', unknown: '#6b7280' };
const ANIMAL_EMOJI = { duck: '🦆', cow: '🐄', unknown: '❓' };

export default function CallsTab() {
  const { user, canManage, isDialerRole } = useDebtCoachAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const loadCalls = useCallback(async () => {
    setLoading(true);
    try {
      let all;
      if (isDialerRole) {
        all = await base44.entities.DebtCallTranscript.filter({ agentId: user.username }, '-callDate', 200);
      } else {
        all = await base44.entities.DebtCallTranscript.list('-callDate', 200);
      }
      setCalls(all || []);
    } catch { setCalls([]); }
    setLoading(false);
  }, [user, isDialerRole]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          📞 Calls — {calls.length} {isDialerRole ? '(Your Calls)' : '(All Calls)'}
        </div>
        <button onClick={loadCalls} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : calls.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>
          {isDialerRole ? 'No calls recorded yet. Start a live call to see your call history here.' : 'No calls recorded yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {calls.map((call) => (
            <CallRow key={call.id} call={call} expanded={expandedId === call.id} onToggle={() => setExpandedId(expandedId === call.id ? null : call.id)} canManage={canManage} managerUsername={user?.username} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Call Row ────────────────────────────────────────────────────────
function CallRow({ call, expanded, onToggle, canManage, managerUsername }) {
  const duration = call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : '—';
  const callDate = call.callDate ? new Date(call.callDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const animal = call.animalType || 'unknown';

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', background: 'none', border: 'none', padding: '14px 18px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, minWidth: '140px' }}>{callDate}</span>
        <span style={{ padding: '2px 8px', borderRadius: '2px', background: call.callMode === 'close' ? 'rgba(16,185,129,0.12)' : 'rgba(96,165,250,0.12)', color: call.callMode === 'close' ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0 }}>{call.callMode || 'open'}</span>
        <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>{call.leadName || 'Unknown Lead'}</span>
        {call.leadNumber && <span style={{ color: GOLD, fontSize: '11px', flexShrink: 0 }}>({call.leadNumber})</span>}
        <span style={{ color: '#6b7280', fontSize: '11px', flexShrink: 0 }}>{duration}</span>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{ANIMAL_EMOJI[animal]}</span>
        {call.intentScore != null && <span style={{ color: ANIMAL_COLORS[animal], fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>Intent: {call.intentScore}</span>}
        {call.agentName && <span style={{ color: '#8a9ab8', fontSize: '11px', flexShrink: 0, marginLeft: 'auto' }}>👤 {call.agentName}</span>}
        <span style={{ color: '#6b7280', fontSize: '16px', flexShrink: 0 }}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && <CallDetail call={call} canManage={canManage} managerUsername={managerUsername} />}
    </div>
  );
}

// ─── Call Detail (expanded) ────────────────────────────────────────────────
function CallDetail({ call, canManage, managerUsername }) {
  const [section, setSection] = useState('transcript');
  const [qaHistory, setQaHistory] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [intentSnapshots, setIntentSnapshots] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [loadingSection, setLoadingSection] = useState(false);

  // Parse transcript lines
  let transcriptLines = [];
  try { transcriptLines = JSON.parse(call.transcriptJson || '[]'); } catch { transcriptLines = []; }

  const SECTIONS = [
    { id: 'transcript', label: '📝 Transcript' },
    { id: 'intent', label: '🎯 Intent Report' },
    { id: 'qa', label: '❓ Q&A History' },
    { id: 'coaching', label: '💡 Coaching History' },
    { id: 'intentHistory', label: '📊 Intent History' },
    { id: 'comments', label: '💬 Manager Comments' },
  ];

  // Load section data on demand
  useEffect(() => {
    if (section === 'qa') {
      setLoadingSection(true);
      base44.entities.DebtQAHistory.filter({ transcriptId: call.id }, '-askedAt', 200)
        .then(r => setQaHistory(r || []))
        .catch(() => setQaHistory([]))
        .finally(() => setLoadingSection(false));
    } else if (section === 'coaching') {
      setLoadingSection(true);
      base44.entities.DebtCoachTip.filter({ transcriptId: call.id }, '-tipTime', 200)
        .then(r => setCoachTips(r || []))
        .catch(() => setCoachTips([]))
        .finally(() => setLoadingSection(false));
    } else if (section === 'intentHistory') {
      setLoadingSection(true);
      base44.entities.DebtIntentSnapshot.filter({ transcriptId: call.id }, '-snapshotTime', 200)
        .then(r => setIntentSnapshots(r || []))
        .catch(() => setIntentSnapshots([]))
        .finally(() => setLoadingSection(false));
    } else if (section === 'comments') {
      setLoadingSection(true);
      base44.entities.ManagerComment.filter({ transcriptId: call.id }, '-createdAt', 200)
        .then(r => setComments(r || []))
        .catch(() => setComments([]))
        .finally(() => setLoadingSection(false));
    }
  }, [section, call.id]);

  const saveComment = async () => {
    if (!newComment.trim()) return;
    setSavingComment(true);
    try {
      const created = await base44.entities.ManagerComment.create({
        transcriptId: call.id,
        leadId: call.leadId || '',
        leadName: call.leadName || '',
        agentId: call.agentId || '',
        managerUsername,
        comment: newComment.trim(),
        createdAt: new Date().toISOString(),
      });
      setComments(prev => [created, ...prev]);
      setNewComment('');
    } catch (e) { alert('Failed to save comment: ' + (e?.message || String(e))); }
    setSavingComment(false);
  };

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Section tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${section === s.id ? GOLD : 'transparent'}`, color: section === s.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: section === s.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{s.label}</button>
        ))}
      </div>

      <div style={{ padding: '16px 18px', maxHeight: '500px', overflowY: 'auto' }}>
        {/* Transcript */}
        {section === 'transcript' && (
          transcriptLines.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No transcript lines recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {transcriptLines.map((msg, j) => {
                const isAgent = msg.speaker === 0;
                return (
                  <div key={j} style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0, minWidth: '50px' }}>{msg.time ? new Date(msg.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    <span style={{ color: isAgent ? '#60a5fa' : '#10b981', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '60px' }}>{isAgent ? 'Agent' : 'Customer'}</span>
                    <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{msg.text}</span>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Intent Report */}
        {section === 'intent' && (
          <div>
            {call.intentScore != null && (
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px' }}>{ANIMAL_EMOJI[call.animalType || 'unknown']}</div>
                  <div style={{ color: ANIMAL_COLORS[call.animalType || 'unknown'], fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{call.animalType || 'unknown'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#f472b6', fontSize: '28px', fontWeight: 'bold' }}>{call.intentScore}</div>
                  <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Intent Score</div>
                </div>
              </div>
            )}
            {call.intentReport ? (
              <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{call.intentReport}</div>
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No intent report generated for this call.</div>
            )}
            {call.followUpReport && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📋 Follow-Up Report</div>
                <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{call.followUpReport}</div>
              </div>
            )}
          </div>
        )}

        {/* Q&A History */}
        {section === 'qa' && (
          loadingSection ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0' }}>Loading…</div> :
          qaHistory.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No Q&A from this call.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {qaHistory.map((h, i) => (
                <div key={h.id || i} style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: h.answer ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0 }}>{h.askedAt ? new Date(h.askedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    <span style={{ color: '#e8e0d0', fontSize: '12px', flex: 1, lineHeight: 1.4 }}>{h.question}</span>
                  </div>
                  {h.answer && <div style={{ padding: '8px 12px', color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>💡 {h.answer}</div>}
                </div>
              ))}
            </div>
          )
        )}

        {/* Coaching History */}
        {section === 'coaching' && (
          loadingSection ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0' }}>Loading…</div> :
          coachTips.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No coaching tips from this call.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {coachTips.map((t, i) => (
                <div key={t.id || i} style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '5px', padding: '10px 12px' }}>
                  <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '4px' }}>{t.tipTime ? new Date(t.tipTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</div>
                  <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>💡 {t.tip}</div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Intent History */}
        {section === 'intentHistory' && (
          loadingSection ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0' }}>Loading…</div> :
          intentSnapshots.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No intent snapshots from this call.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {intentSnapshots.map((s, i) => (
                <div key={s.id || i} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(244,114,182,0.04)', border: '1px solid rgba(244,114,182,0.15)', borderRadius: '5px', padding: '8px 12px' }}>
                  <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0, minWidth: '60px' }}>{s.snapshotTime ? new Date(s.snapshotTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{ANIMAL_EMOJI[s.animalType || 'unknown']}</span>
                  <span style={{ color: ANIMAL_COLORS[s.animalType || 'unknown'], fontSize: '14px', fontWeight: 'bold', flexShrink: 0 }}>Score: {s.intentScore ?? '—'}</span>
                  {s.report && <span style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4, flex: 1 }}>{s.report}</span>}
                </div>
              ))}
            </div>
          )
        )}

        {/* Manager Comments */}
        {section === 'comments' && (
          <div>
            {loadingSection ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0' }}>Loading…</div>
            ) : (
              <>
                {canManage && (
                  <div style={{ marginBottom: '16px' }}>
                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows={3} style={inp} placeholder="Add a comment on this call for the agent to see…" />
                    <button onClick={saveComment} disabled={savingComment || !newComment.trim()} style={{ marginTop: '8px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: savingComment ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: savingComment || !newComment.trim() ? 0.5 : 1 }}>
                      {savingComment ? 'Saving…' : '💬 Add Comment'}
                    </button>
                  </div>
                )}
                {!canManage && comments.length === 0 && (
                  <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No manager comments on this call yet.</div>
                )}
                {comments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {comments.map((c, i) => (
                      <div key={c.id || i} style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: '5px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ color: '#a78bfa', fontSize: '10px', fontWeight: 'bold' }}>👤 {c.managerUsername}</span>
                          <span style={{ color: '#4a5568', fontSize: '10px' }}>{c.createdAt ? new Date(c.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                        </div>
                        <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.comment}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}