/**
 * ComplianceContactCard.jsx — Full compliance ticket modal with tabs:
 * Overview | Transcript & Issues | Notes Thread | Remedy
 * Shows violations, AI explanations, dialogue, and remedy acknowledgment workflow.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { isComplianceManager, canCloseCompliance, canAssignRemedy } from '@/lib/complianceRoles';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const STATUS_COLORS = { OPEN: '#ef4444', UNDER_REVIEW: '#f59e0b', REMEDIED: '#60a5fa', CLOSED: '#6b7280' };
const SEVERITY_COLORS = { LOW: '#f59e0b', MEDIUM: '#f97316', CRITICAL: '#ef4444' };
const RULE_LABELS = {
  regulatory_disclosure: 'Regulatory Disclosure',
  factual_misrepresentation: 'Factual Misrepresentation',
  script_deviation: 'Script Deviation',
  unapproved_claim: 'Unapproved Claim',
  missing_disclosure: 'Missing Disclosure',
  rate_misrepresentation: 'Rate Misrepresentation',
};

const TABS = [
  { id: 'overview', label: '📋 Overview' },
  { id: 'transcript', label: '📝 Transcript & Issues' },
  { id: 'notes', label: '💬 Notes Thread' },
  { id: 'remedy', label: '🎓 Remedy' },
];

export default function ComplianceContactCard({ recordId, onClose }) {
  const { user } = useDebtCoachAuth();
  const [tab, setTab] = useState('overview');
  const [record, setRecord] = useState(null);
  const [issues, setIssues] = useState([]);
  const [notes, setNotes] = useState([]);
  const [remedies, setRemedies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const [showAddRemedy, setShowAddRemedy] = useState(false);
  const [remedyForm, setRemedyForm] = useState({ mediaType: 'TEXT', title: '', description: '', fileUrl: '' });
  const [addingRemedy, setAddingRemedy] = useState(false);
  const [closingRecord, setClosingRecord] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [generatingQuiz, setGeneratingQuiz] = useState(null);

  const canManage = isComplianceManager(user?.role);
  const canClose = canCloseCompliance(user?.role);
  const canAssign = canAssignRemedy(user?.role);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'getRecord', recordId });
      const data = res?.data || res;
      setRecord(data.record);
      setIssues(data.issues || []);
      setNotes(data.notes || []);
      setRemedies(data.remedies || []);
    } catch {}
    setLoading(false);
  }, [recordId]);

  useEffect(() => { load(); }, [load]);

  const sendNote = async () => {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      await base44.functions.invoke('complianceAdmin', { action: 'addNote', recordId, message: noteText });
      setNoteText('');
      load();
    } catch {}
    setSendingNote(false);
  };

  const addRemedy = async () => {
    if (!remedyForm.title.trim()) return;
    setAddingRemedy(true);
    try {
      await base44.functions.invoke('complianceAdmin', {
        action: 'addRemedy', recordId,
        mediaType: remedyForm.mediaType, title: remedyForm.title,
        description: remedyForm.description, fileUrl: remedyForm.fileUrl,
      });
      setRemedyForm({ mediaType: 'TEXT', title: '', description: '', fileUrl: '' });
      setShowAddRemedy(false);
      load();
    } catch {}
    setAddingRemedy(false);
  };

  const acknowledgeRemedy = async (remedyId, passedQuiz) => {
    try {
      await base44.functions.invoke('complianceAdmin', {
        action: 'acknowledgeRemedy', remedyId,
        quizAnswersJson: JSON.stringify(quizAnswers[remedyId] || {}),
        quizPassed: passedQuiz,
      });
      load();
    } catch {}
  };

  const generateQuiz = async (remedyId) => {
    setGeneratingQuiz(remedyId);
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'generateQuiz', remedyId });
      const quiz = res?.data?.quiz || res?.quiz || [];
      setActiveQuiz({ remedyId, questions: quiz });
      setQuizAnswers(prev => ({ ...prev, [remedyId]: {} }));
    } catch {}
    setGeneratingQuiz(null);
  };

  const closeRecord = async () => {
    setClosingRecord(true);
    try {
      await base44.functions.invoke('complianceAdmin', { action: 'closeRecord', recordId, closeNote });
      setCloseNote('');
      load();
    } catch {}
    setClosingRecord(false);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading compliance record…</div>;
  if (!record) return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Record not found.</div>;

  const transcriptLines = (() => { try { return JSON.parse(record.transcriptJson || '[]'); } catch { return []; } })();
  const statusColor = STATUS_COLORS[record.status] || '#6b7280';

  return (
    <div style={{ position: 'fixed', inset: '20px', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.7)' }}>
      <div style={{ width: '95%', maxWidth: '1100px', height: '90vh', background: '#0a0f1e', border: `1px solid ${statusColor}44`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>🛡 Compliance ID</span>
              <span style={{ padding: '3px 10px', borderRadius: '3px', background: `${statusColor}18`, color: statusColor, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{record.status}</span>
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold' }}>{record.complianceId}</div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
              User: <strong style={{ color: '#c4cdd8' }}>{record.username}</strong> · Monitor: <strong style={{ color: '#c4cdd8' }}>{record.monitoredByUsername || '—'}</strong> · {new Date(record.created_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {canClose && record.status !== 'CLOSED' && (
              <button onClick={closeRecord} disabled={closingRecord} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: closingRecord ? 0.5 : 1 }}>
                {closingRecord ? '⏳ Closing…' : '✓ Close ID'}
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: '0 4px' }}>×</button>
          </div>
        </div>

        {/* Score bar */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
          <ScoreBadge label="Compliance Score" value={`${record.complianceScore ?? '—'}%`} color={record.complianceScore >= 80 ? '#4ade80' : record.complianceScore >= 60 ? '#f59e0b' : '#ef4444'} />
          <ScoreBadge label="Compliant Hooks" value={record.compliantHooks || 0} color="#60a5fa" />
          <ScoreBadge label="Total Violations" value={record.violationsCount || 0} color="#ef4444" />
          <ScoreBadge label="Critical" value={record.criticalCount || 0} color="#ef4444" />
          <ScoreBadge label="Minor" value={record.minorCount || 0} color="#f59e0b" />
          <ScoreBadge label="Sensitivity" value={record.sensitivityLevel || 'balanced'} color="#a78bfa" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {tab === 'overview' && (
            <div>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📋 Compliance Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <InfoRow label="Lead" value={record.leadName || '—'} />
                <InfoRow label="Call Mode" value={record.callMode || '—'} />
                <InfoRow label="Sensitivity" value={record.sensitivityLevel || 'balanced'} />
                <InfoRow label="Remedy Acknowledged" value={record.remedyAcknowledged ? '✓ Yes' : '✗ No'} />
              </div>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>⚠️ Flagged Issues ({issues.length})</div>
              {issues.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No issues flagged.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {issues.map((iss, i) => {
                    const sevColor = SEVERITY_COLORS[iss.severity] || '#6b7280';
                    return (
                      <div key={iss.id || i} style={{ background: `${sevColor}08`, border: `1px solid ${sevColor}33`, borderRadius: '4px', padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${sevColor}18`, color: sevColor, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{iss.severity}</span>
                          <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{RULE_LABELS[iss.ruleViolated] || iss.ruleViolated}</span>
                          <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: 'auto' }}>Confidence: {iss.confidenceScore || 0}%</span>
                        </div>
                        <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '4px' }}><strong>Flagged:</strong> "{iss.flaggedText}"</div>
                        {iss.expectedText && <div style={{ color: '#4ade80', fontSize: '12px', marginBottom: '4px' }}><strong>Expected:</strong> "{iss.expectedText}"</div>}
                        {iss.groundTruthValue && <div style={{ color: '#60a5fa', fontSize: '11px' }}><strong>Ground Truth:</strong> {iss.groundTruthValue} · <strong>Claimed:</strong> {iss.claimedValue || '—'}</div>}
                        <div style={{ color: '#c4cdd8', fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}>{iss.aiExplanation}</div>
                        {iss.ruleReference && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>Rule Ref: {iss.ruleReference}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'transcript' && (
            <div>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📝 Call Transcript with Violation Highlights</div>
              {transcriptLines.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px', fontSize: '12px' }}>No transcript recorded.</div> : (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1, maxHeight: '55vh', overflowY: 'auto', padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                    {transcriptLines.map((msg, j) => {
                      const isAgent = msg.speaker === 0;
                      const issueForLine = issues.find(iss => iss.transcriptLineIndex === j);
                      const highlightColor = issueForLine ? SEVERITY_COLORS[issueForLine.severity] : null;
                      return (
                        <div key={j} style={{ marginBottom: '8px', padding: issueForLine ? '8px' : '4px', borderRadius: '4px', background: highlightColor ? `${highlightColor}11` : 'transparent', borderLeft: highlightColor ? `3px solid ${highlightColor}` : '3px solid transparent' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0, minWidth: '50px' }}>{msg.time ? new Date(msg.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                            <span style={{ color: isAgent ? '#60a5fa' : '#10b981', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '60px' }}>{isAgent ? 'Agent' : 'Customer'}</span>
                            <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{msg.text}</span>
                          </div>
                          {issueForLine && <div style={{ color: SEVERITY_COLORS[issueForLine.severity], fontSize: '10px', marginTop: '4px', marginLeft: '58px' }}>⚠ {RULE_LABELS[issueForLine.ruleViolated]} — {issueForLine.aiExplanation?.slice(0, 120)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>💬 Notes & Dialogue Thread</div>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notes.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px', fontSize: '12px' }}>No messages yet. Start the conversation.</div> : notes.map((n, i) => (
                  <div key={n.id || i} style={{ padding: '10px 14px', borderRadius: '6px', background: n.isSystem ? 'rgba(107,114,128,0.08)' : n.authorUsername === user?.username ? 'rgba(16,185,129,0.06)' : 'rgba(96,165,250,0.06)', border: `1px solid ${n.isSystem ? 'rgba(107,114,128,0.2)' : n.authorUsername === user?.username ? 'rgba(16,185,129,0.2)' : 'rgba(96,165,250,0.2)'}` }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: n.isSystem ? '#6b7280' : n.authorUsername === user?.username ? GOLD : '#60a5fa', fontSize: '11px', fontWeight: 'bold' }}>{n.isSystem ? '🤖 System' : n.authorUsername}</span>
                      {n.authorRole && !n.isSystem && <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase' }}>{n.authorRole}</span>}
                    </div>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.message}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendNote()} placeholder="Type a message…" style={{ ...inp, flex: 1 }} />
                <button onClick={sendNote} disabled={sendingNote || !noteText.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '0 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: sendingNote || !noteText.trim() ? 0.5 : 1 }}>Send</button>
              </div>
            </div>
          )}

          {tab === 'remedy' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🎓 Remedy & Training Materials</div>
                {canAssign && record.status !== 'CLOSED' && (
                  <button onClick={() => setShowAddRemedy(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{showAddRemedy ? '✕ Cancel' : '+ Assign Remedy'}</button>
                )}
              </div>

              {showAddRemedy && canAssign && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
                  <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>+ New Remedy Assignment</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div><label style={ls}>Title</label><input value={remedyForm.title} onChange={e => setRemedyForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Rate Disclosure Training" style={inp} /></div>
                    <div><label style={ls}>Media Type</label><select value={remedyForm.mediaType} onChange={e => setRemedyForm(p => ({ ...p, mediaType: e.target.value }))} style={inp}><option value="TEXT">Text</option><option value="PDF">PDF</option><option value="AUDIO">Audio (MP3)</option><option value="LINK">Link</option><option value="VIDEO">Video</option></select></div>
                  </div>
                  <div style={{ marginBottom: '10px' }}><label style={ls}>File URL (if applicable)</label><input value={remedyForm.fileUrl} onChange={e => setRemedyForm(p => ({ ...p, fileUrl: e.target.value }))} placeholder="https://…" style={inp} /></div>
                  <div style={{ marginBottom: '10px' }}><label style={ls}>Description / Instructions</label><textarea value={remedyForm.description} onChange={e => setRemedyForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
                  <button onClick={addRemedy} disabled={addingRemedy || !remedyForm.title.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: addingRemedy || !remedyForm.title.trim() ? 0.5 : 1 }}>{addingRemedy ? '⏳ Assigning…' : '✓ Assign Remedy'}</button>
                </div>
              )}

              {remedies.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px', fontSize: '12px' }}>No remedy materials assigned yet.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {remedies.map((r, i) => {
                    const isActiveQuiz = activeQuiz?.remedyId === r.id;
                    return (
                      <div key={r.id || i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <span style={{ padding: '2px 8px', borderRadius: '2px', background: 'rgba(167,139,250,0.18)', color: '#a78bfa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{r.mediaType}</span>
                            <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginLeft: '8px' }}>{r.title}</span>
                          </div>
                          {r.isAcknowledged ? <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 'bold' }}>✓ Acknowledged</span> : r.assignedBy === user?.username ? <span style={{ color: '#6b7280', fontSize: '10px' }}>Assigned by you</span> : null}
                        </div>
                        {r.description && <div style={{ color: '#c4cdd8', fontSize: '12px', marginBottom: '8px', lineHeight: 1.5 }}>{r.description}</div>}
                        {r.fileUrl && <a href={r.fileUrl} target="_blank" rel="noreferrer" style={{ color: GOLD, fontSize: '11px', textDecoration: 'underline' }}>📎 Open Material →</a>}
                        {r.assignedBy && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px' }}>Assigned by {r.assignedBy} · {r.assignedAt ? new Date(r.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>}

                        {/* Quiz section */}
                        {canAssign && !r.quizJson && (
                          <button onClick={() => generateQuiz(r.id)} disabled={generatingQuiz === r.id} style={{ marginTop: '8px', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', opacity: generatingQuiz === r.id ? 0.5 : 1 }}>{generatingQuiz === r.id ? '⏳ Generating…' : '🧪 Generate Quiz'}</button>
                        )}
                        {r.quizJson && !r.isAcknowledged && !canManage && (
                          <QuizSection remedy={r} quiz={isActiveQuiz ? activeQuiz.questions : (() => { try { return JSON.parse(r.quizJson); } catch { return []; } })()} answers={quizAnswers[r.id] || {}} setAnswers={(a) => setQuizAnswers(prev => ({ ...prev, [r.id]: a }))} onAcknowledge={(passed) => acknowledgeRemedy(r.id, passed)} />
                        )}
                        {r.quizJson && r.quizPassed && <div style={{ color: '#4ade80', fontSize: '11px', marginTop: '6px' }}>✓ Quiz passed</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {canClose && record.status !== 'CLOSED' && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <input value={closeNote} onChange={e => setCloseNote(e.target.value)} placeholder="Optional close note…" style={{ ...inp, flex: 1 }} />
            <button onClick={closeRecord} disabled={closingRecord} style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '0 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: closingRecord ? 0.5 : 1 }}>Close ID</button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizSection({ remedy, quiz, answers, setAnswers, onAcknowledge }) {
  const [showQuiz, setShowQuiz] = useState(false);
  if (!quiz || quiz.length === 0) return null;
  const allAnswered = quiz.every((_, i) => answers[i] !== undefined);
  const score = quiz.filter((q, i) => answers[i] === q.correctIndex).length;
  const passed = score === quiz.length;

  return (
    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px' }}>
      {!showQuiz ? (
        <button onClick={() => setShowQuiz(true)} style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>🧪 Take Quiz ({quiz.length} questions)</button>
      ) : (
        <div>
          {quiz.map((q, i) => (
            <div key={i} style={{ marginBottom: '10px' }}>
              <div style={{ color: '#e8e0d0', fontSize: '12px', marginBottom: '6px' }}>{i + 1}. {q.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(q.options || []).map((opt, j) => (
                  <button key={j} onClick={() => setAnswers({ ...answers, [i]: j })} style={{ textAlign: 'left', padding: '6px 10px', borderRadius: '3px', border: `1px solid ${answers[i] === j ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`, background: answers[i] === j ? 'rgba(167,139,250,0.15)' : 'transparent', color: answers[i] === j ? '#a78bfa' : '#c4cdd8', cursor: 'pointer', fontSize: '12px' }}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
          {allAnswered && <div style={{ color: passed ? '#4ade80' : '#ef4444', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Score: {score}/{quiz.length} {passed ? '✓ Passed' : '✗ Must answer all correctly'}</div>}
          <button onClick={() => onAcknowledge(passed)} disabled={!allAnswered} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: !allAnswered ? 0.5 : 1 }}>Acknowledge & {passed ? 'Mark Remedied' : 'Submit'}</button>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '10px 14px' }}>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ color: '#c4cdd8', fontSize: '13px', marginTop: '2px' }}>{value}</div>
    </div>
  );
}