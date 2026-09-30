/**
 * CallAnalysisDiagram.jsx — Visual post-call analysis component.
 * Renders: timeline diagram of strengths/issues, manager quality report,
 * pitch suggestions, and detailed follow-up based on customer personality.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const GREEN = '#4ade80';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

const TYPE_COLORS = {
  strength: GREEN,
  issue: RED,
  milestone: AMBER,
  neutral: '#6b7280',
};

const TYPE_ICONS = {
  strength: '✓',
  issue: '⚠',
  milestone: '◆',
  neutral: '•',
};

const GRADE_COLORS = {
  A: GREEN, B: BLUE, C: AMBER, D: '#f97316', F: RED,
};

function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallAnalysisDiagram({ analysisJson, durationSeconds }) {
  const [selectedMoment, setSelectedMoment] = useState(null);

  let analysis = null;
  try { analysis = typeof analysisJson === 'string' ? JSON.parse(analysisJson) : analysisJson; } catch { return null; }
  if (!analysis) return null;

  const timeline = analysis.timeline || [];
  const mgr = analysis.managerReport || {};
  const suggestions = analysis.pitchSuggestions || [];
  const followUp = analysis.detailedFollowUp || {};

  const maxSeconds = durationSeconds || (timeline.length > 0 ? Math.max(...timeline.map(t => t.offsetSeconds || 0)) : 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── 1. CALL TIMELINE DIAGRAM ────────────────────────────────── */}
      <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}33`, borderRadius: '6px', padding: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📊 Call Timeline — Strengths & Issues</div>

        {/* Timeline bar */}
        <div style={{ position: 'relative', height: '40px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Time gridlines */}
          {[0, 25, 50, 75, 100].map(pct => (
            <div key={pct} style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.06)' }} />
          ))}
          {/* Markers */}
          {timeline.map((m, i) => {
            const pct = maxSeconds > 0 ? Math.min(100, Math.max(0, ((m.offsetSeconds || 0) / maxSeconds) * 100)) : 50;
            const color = TYPE_COLORS[m.type] || '#6b7280';
            return (
              <div key={i}
                onClick={() => setSelectedMoment(selectedMoment === i ? null : i)}
                style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
                title={`${formatTime(m.offsetSeconds)} — ${m.label}`}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: color, border: `2px solid ${selectedMoment === i ? '#fff' : 'rgba(0,0,0,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 'bold', color: '#0a0f1e',
                  boxShadow: selectedMoment === i ? `0 0 8px ${color}` : 'none',
                  transition: 'box-shadow 0.15s',
                }}>{TYPE_ICONS[m.type] || '•'}</div>
              </div>
            );
          })}
        </div>

        {/* Time labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ color: '#4a5568', fontSize: '9px' }}>0:00</span>
          <span style={{ color: '#4a5568', fontSize: '9px' }}>{formatTime(Math.floor(maxSeconds * 0.25))}</span>
          <span style={{ color: '#4a5568', fontSize: '9px' }}>{formatTime(Math.floor(maxSeconds * 0.5))}</span>
          <span style={{ color: '#4a5568', fontSize: '9px' }}>{formatTime(Math.floor(maxSeconds * 0.75))}</span>
          <span style={{ color: '#4a5568', fontSize: '9px' }}>{formatTime(maxSeconds)}</span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <LegendItem color={GREEN} icon="✓" label="Strength" />
          <LegendItem color={RED} icon="⚠" label="Issue" />
          <LegendItem color={AMBER} icon="◆" label="Milestone" />
        </div>

        {/* Selected moment detail */}
        {selectedMoment != null && timeline[selectedMoment] ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '4px', padding: '10px 12px', borderLeft: `3px solid ${TYPE_COLORS[timeline[selectedMoment].type] || '#6b7280'}` }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: TYPE_COLORS[timeline[selectedMoment].type] || '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{timeline[selectedMoment].type}</span>
              <span style={{ color: '#4a5568', fontSize: '10px' }}>{formatTime(timeline[selectedMoment].offsetSeconds)}</span>
              <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{timeline[selectedMoment].label}</span>
            </div>
            <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{timeline[selectedMoment].detail}</div>
          </div>
        ) : (
          <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center' }}>Click any marker on the timeline to see details.</div>
        )}

        {/* All moments list */}
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {timeline.map((m, i) => (
            <button key={i} onClick={() => setSelectedMoment(i)} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: selectedMoment === i ? 'rgba(255,255,255,0.04)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '6px 4px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ color: TYPE_COLORS[m.type] || '#6b7280', fontSize: '12px', flexShrink: 0, width: '14px' }}>{TYPE_ICONS[m.type] || '•'}</span>
              <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0, minWidth: '36px' }}>{formatTime(m.offsetSeconds)}</span>
              <span style={{ color: '#c4cdd8', fontSize: '11px', flex: 1 }}>{m.label}</span>
              {m.severity && m.type === 'issue' && <span style={{ color: m.severity === 'high' ? RED : m.severity === 'medium' ? AMBER : '#6b7280', fontSize: '9px', textTransform: 'uppercase' }}>{m.severity}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. MANAGER QUALITY REPORT ───────────────────────────────── */}
      {mgr && Object.keys(mgr).length > 0 && (
        <div style={{ background: '#0d1b2a', border: `1px solid ${PURPLE}33`, borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ color: PURPLE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>👔 Manager's Quality Assessment</div>
            {mgr.overallGrade && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Overall Grade</span>
                <span style={{ background: `${GRADE_COLORS[mgr.overallGrade] || '#6b7280'}22`, color: GRADE_COLORS[mgr.overallGrade] || '#6b7280', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${GRADE_COLORS[mgr.overallGrade] || '#6b7280'}44` }}>{mgr.overallGrade}</span>
              </div>
            )}
          </div>

          {mgr.summary && <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.6, marginBottom: '14px', fontStyle: 'italic' }}>"{mgr.summary}"</div>}

          {/* Score bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            <ScoreBar label="Clarity — Getting Points Across" score={mgr.clarityScore} notes={mgr.clarityNotes} color={BLUE} />
            <ScoreBar label="Objection Handling" score={mgr.objectionHandlingScore} notes={mgr.objectionHandlingNotes} color={AMBER} />
            <ScoreBar label="Call Control" score={mgr.callControlScore} notes={mgr.callControlNotes} color={mgr.controlledBy === 'agent' ? GREEN : mgr.controlledBy === 'customer' ? RED : AMBER} extra={mgr.controlledBy ? `Controlled by: ${mgr.controlledBy}` : ''} />
            <ScoreBar label="Closing" score={mgr.closingScore} notes={mgr.closingNotes} color={GOLD} />
          </div>

          {/* Strengths & Weaknesses */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {mgr.strengths?.length > 0 && (
              <div>
                <div style={{ color: GREEN, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>✓ Strengths</div>
                {mgr.strengths.map((s, i) => <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, paddingLeft: '12px', position: 'relative', marginBottom: '3px' }}><span style={{ position: 'absolute', left: 0, color: GREEN }}>✓</span> {s}</div>)}
              </div>
            )}
            {mgr.weaknesses?.length > 0 && (
              <div>
                <div style={{ color: RED, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>⚠ Areas to Improve</div>
                {mgr.weaknesses.map((w, i) => <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, paddingLeft: '12px', position: 'relative', marginBottom: '3px' }}><span style={{ position: 'absolute', left: 0, color: RED }}>⚠</span> {w}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. PITCH SUGGESTIONS ────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div style={{ background: '#0d1b2a', border: `1px solid ${AMBER}33`, borderRadius: '6px', padding: '16px' }}>
          <div style={{ color: AMBER, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>💡 Pitch & Interaction Suggestions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${AMBER}18`, color: AMBER, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{s.area}</span>
                </div>
                <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '4px' }}>⚠ {s.issue}</div>
                <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>→ {s.suggestion}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. DETAILED FOLLOW-UP ───────────────────────────────────── */}
      {followUp && Object.keys(followUp).length > 0 && (
        <div style={{ background: '#0d1b2a', border: `1px solid ${GREEN}33`, borderRadius: '6px', padding: '16px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📋 Detailed Follow-Up Plan</div>

          {followUp.personalityType && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>🧬 Customer Personality</div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{followUp.personalityType}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            {followUp.questionProfile && (
              <div>
                <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>❓ Question Profile</div>
                <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5 }}>{followUp.questionProfile}</div>
              </div>
            )}
            <div>
              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>📊 Engagement Level</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${followUp.engagementLevel === 'high' ? GREEN : followUp.engagementLevel === 'medium' ? AMBER : RED}22`, color: followUp.engagementLevel === 'high' ? GREEN : followUp.engagementLevel === 'medium' ? AMBER : RED, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>{followUp.engagementLevel || '—'}</span>
              </div>
              {followUp.engagementNotes && <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>{followUp.engagementNotes}</div>}
            </div>
          </div>

          {followUp.recommendedApproach && (
            <div style={{ marginBottom: '12px', background: 'rgba(16,185,129,0.06)', border: `1px solid ${GREEN}22`, borderRadius: '4px', padding: '10px 12px' }}>
              <div style={{ color: GOLD, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>🎯 Recommended Approach</div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{followUp.recommendedApproach}</div>
            </div>
          )}

          {followUp.talkingPoints?.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>💬 Talking Points for Next Call</div>
              {followUp.talkingPoints.map((tp, i) => <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, paddingLeft: '12px', position: 'relative', marginBottom: '3px' }}><span style={{ position: 'absolute', left: 0, color: GOLD }}>•</span> {tp}</div>)}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {followUp.bestTiming && (
              <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '10px 12px' }}>
                <div style={{ color: BLUE, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>⏰ Best Timing</div>
                <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5 }}>{followUp.bestTiming}</div>
              </div>
            )}
            {followUp.followUpActions?.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '10px 12px' }}>
                <div style={{ color: AMBER, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>✅ Follow-Up Actions</div>
                {followUp.followUpActions.map((a, i) => <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, paddingLeft: '12px', position: 'relative', marginBottom: '3px' }}><span style={{ position: 'absolute', left: 0, color: AMBER }}>→</span> {a}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, icon, label }) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', color: '#0a0f1e' }}>{icon}</div>
      <span style={{ color: '#8a9ab8', fontSize: '10px' }}>{label}</span>
    </div>
  );
}

function ScoreBar({ label, score, notes, color, extra }) {
  const s = typeof score === 'number' ? Math.min(100, Math.max(0, score)) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ color: '#c4cdd8', fontSize: '11px', fontWeight: 'bold' }}>{label}</span>
        <span style={{ color, fontSize: '14px', fontWeight: 'bold' }}>{score != null ? `${score}/100` : '—'}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
        <div style={{ width: `${s}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      {notes && <div style={{ color: '#8a9ab8', fontSize: '10px', lineHeight: 1.4 }}>{notes}</div>}
      {extra && <div style={{ color, fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>{extra}</div>}
    </div>
  );
}