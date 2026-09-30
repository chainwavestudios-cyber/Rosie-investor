/**
 * CustomerStatsPopup.jsx — Floating popup that captures customer insights during live calls.
 * Auto-detects location/occupation/hobby mentions, lets agent research them with AI,
 * generate small talk questions, and mark important details for follow-up.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

const INSIGHT_TYPES = [
  { id: 'location', label: '📍 Location', color: '#60a5fa' },
  { id: 'occupation', label: '💼 Occupation', color: '#34d399' },
  { id: 'hobby', label: '🎯 Hobby', color: '#f472b6' },
  { id: 'family', label: '👨‍👩‍👧 Family', color: '#f59e0b' },
  { id: 'life_event', label: '🎉 Life Event', color: '#a78bfa' },
  { id: 'other', label: '📌 Other', color: '#8a9ab8' },
];

export default function CustomerStatsPopup({ lead, transcript, isActive, agentUsername, onInsightsChange, phase, onStartCall, onStopCall, isInbound, onToggleInbound }) {
  const [collapsed, setCollapsed] = useState(false);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(null);
  const [expandedResearch, setExpandedResearch] = useState(null);
  const [smallTalk, setSmallTalk] = useState([]);
  const [generatingSmallTalk, setGeneratingSmallTalk] = useState(false);
  const [showSmallTalk, setShowSmallTalk] = useState(false);
  const [newInsightFlash, setNewInsightFlash] = useState(new Set());
  const lastExtractLineCount = useRef(0);
  const existingInsightKeys = useRef(new Set());
  const [pos, setPos] = useState(() => ({ x: 24, y: typeof window !== 'undefined' ? window.innerHeight - 350 : 100 }));
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => { dragMoved.current = true; setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }); };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging]);

  const handleDragStart = (e) => {
    e.stopPropagation();
    dragMoved.current = false;
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  };

  // Load existing insights for this lead
  const loadInsights = useCallback(async () => {
    if (!lead?.id) return;
    try {
      const rows = await base44.entities.CustomerInsight.filter({ leadId: lead.id }, '-created_date', 200);
      setInsights(rows || []);
      (rows || []).forEach(ins => {
        existingInsightKeys.current.add(`${ins.insightType}:${(ins.insightText || '').toLowerCase()}`);
      });
      onInsightsChange?.(rows || []);
    } catch { setInsights([]); }
  }, [lead?.id, onInsightsChange]);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  // Auto-extract insights from transcript periodically during live call
  useEffect(() => {
    if (!isActive || !lead?.id || !transcript) return;
    const lineCount = transcript.length;
    // Only extract when new lines arrive and enough time has passed
    if (lineCount < lastExtractLineCount.current + 8) return;

    const timer = setTimeout(async () => {
      lastExtractLineCount.current = lineCount;
      setLoading(true);
      try {
        const res = await base44.functions.invoke('liveAssistantAI', {
          mode: 'extract_insights',
          transcript,
          existingInsights: insights.map(ins => ({ insightType: ins.insightType, insightText: ins.insightText })),
        });
        const newInsights = res?.insights || [];
        if (newInsights.length > 0) {
          const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
          const flashKeys = new Set();
          for (const ins of newInsights) {
            const key = `${ins.insightType}:${(ins.insightText || '').toLowerCase()}`;
            if (!existingInsightKeys.current.has(key)) {
              existingInsightKeys.current.add(key);
              flashKeys.add(key);
              // Find the transcript line for timestamp
              const lineIdx = ins.transcriptLineIndex ?? 0;
              const transcriptLine = transcript[lineIdx] || transcript[transcript.length - 1];
              await base44.entities.CustomerInsight.create({
                leadId: lead.id,
                leadName,
                insightType: ins.insightType,
                insightText: ins.insightText,
                transcriptLineIndex: lineIdx,
                transcriptTimestamp: transcriptLine?.time || new Date().toISOString(),
                transcriptSnippet: ins.transcriptSnippet || transcriptLine?.text || '',
                createdBy: agentUsername,
              });
            }
          }
          if (flashKeys.size > 0) {
            setNewInsightFlash(flashKeys);
            setTimeout(() => setNewInsightFlash(new Set()), 3000);
          }
          loadInsights();
        }
      } catch {}
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isActive, lead?.id, transcript, insights, agentUsername, loadInsights]);

  // Research an insight with AI
  const handleResearch = useCallback(async (insight) => {
    setResearching(insight.id);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        mode: 'research_insight',
        insightType: insight.insightType,
        insightText: insight.insightText,
      });
      const research = res?.research || res?.data?.research;
      if (research) {
        await base44.entities.CustomerInsight.update(insight.id, {
          researchJson: JSON.stringify(research),
          isResearched: true,
        });
        setExpandedResearch(insight.id);
        loadInsights();
      }
    } catch {}
    setResearching(null);
  }, [loadInsights]);

  // Toggle important flag
  const handleToggleImportant = useCallback(async (insight) => {
    try {
      await base44.entities.CustomerInsight.update(insight.id, { isImportant: !insight.isImportant });
      loadInsights();
    } catch {}
  }, [loadInsights]);

  // Generate small talk questions from all insights
  const handleGenerateSmallTalk = useCallback(async () => {
    if (insights.length === 0) return;
    setGeneratingSmallTalk(true);
    setShowSmallTalk(true);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', {
        mode: 'generate_smalltalk',
        insights: insights.map(ins => ({
          insightType: ins.insightType,
          insightText: ins.insightText,
          researchJson: ins.researchJson,
        })),
      });
      const questions = res?.questions || res?.data?.questions || [];
      setSmallTalk(questions);
    } catch { setSmallTalk([]); }
    setGeneratingSmallTalk(false);
  }, [insights]);

  // Delete an insight
  const handleDelete = useCallback(async (id) => {
    try {
      await base44.entities.CustomerInsight.delete(id);
      loadInsights();
    } catch {}
  }, [loadInsights]);

  // Manually add an insight
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState({ insightType: 'other', insightText: '' });
  const handleManualAdd = useCallback(async () => {
    if (!manualForm.insightText.trim() || !lead?.id) return;
    try {
      const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
      const lastLine = transcript?.[transcript.length - 1];
      await base44.entities.CustomerInsight.create({
        leadId: lead.id,
        leadName,
        insightType: manualForm.insightType,
        insightText: manualForm.insightText.trim(),
        transcriptLineIndex: transcript?.length - 1 || 0,
        transcriptTimestamp: lastLine?.time || new Date().toISOString(),
        transcriptSnippet: lastLine?.text || '',
        createdBy: agentUsername,
      });
      setManualForm({ insightType: 'other', insightText: '' });
      setShowManualAdd(false);
      loadInsights();
    } catch {}
  }, [manualForm, lead, transcript, agentUsername, loadInsights]);

  const importantCount = insights.filter(i => i.isImportant).length;
  const researchedCount = insights.filter(i => i.isResearched).length;

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 8500,
      width: collapsed ? 220 : 380,
      background: DARK, border: `1px solid ${GOLD}44`, borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column',
      maxHeight: collapsed ? 'auto' : '70vh',
      transition: 'width 0.2s',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.07)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', flexShrink: 0,
      }} onMouseDown={handleDragStart} onClick={() => { if (!dragMoved.current) setCollapsed(p => !p); }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🔍 Customer Stats</span>
          {insights.length > 0 && (
            <span style={{ padding: '1px 6px', borderRadius: '8px', background: `${GOLD}18`, color: GOLD, fontSize: '9px', fontWeight: 'bold' }}>{insights.length}</span>
          )}
          {importantCount > 0 && (
            <span style={{ padding: '1px 6px', borderRadius: '8px', background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontSize: '9px', fontWeight: 'bold' }}>★ {importantCount}</span>
          )}
          {loading && <span style={{ color: '#6b7280', fontSize: '9px' }}>scanning…</span>}
        </div>
        <span style={{ color: '#6b7280', fontSize: '14px' }}>{collapsed ? '▸' : '▾'}</span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {insights.length === 0 && !loading ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 8px', fontSize: '11px' }}>
              No insights yet. As the customer mentions where they're from, their job, or hobbies, they'll appear here automatically.
            </div>
          ) : (
            <>
              {/* Insights list */}
              {insights.map(ins => {
                const typeInfo = INSIGHT_TYPES.find(t => t.id === ins.insightType) || INSIGHT_TYPES.find(t => t.id === 'other');
                const isFlashing = newInsightFlash.has(`${ins.insightType}:${(ins.insightText || '').toLowerCase()}`);
                const isExpanded = expandedResearch === ins.id;
                const research = ins.researchJson ? (() => { try { return JSON.parse(ins.researchJson); } catch { return null; } })() : null;
                return (
                  <div key={ins.id} style={{
                    marginBottom: '6px', background: isFlashing ? `${typeInfo.color}10` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isFlashing ? typeInfo.color + '44' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '5px', overflow: 'hidden',
                    transition: 'background 0.3s',
                  }}>
                    {/* Insight header */}
                    <div style={{ padding: '8px 10px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ padding: '1px 5px', borderRadius: '3px', background: `${typeInfo.color}18`, color: typeInfo.color, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0, marginTop: '2px' }}>{typeInfo.label.split(' ')[1]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', wordBreak: 'break-word' }}>{ins.insightText}</div>
                        {ins.transcriptTimestamp && (
                          <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>
                            {new Date(ins.transcriptTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {ins.transcriptSnippet && ` · "${ins.transcriptSnippet.slice(0, 50)}${ins.transcriptSnippet.length > 50 ? '…' : ''}"`}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                        <button onClick={(e) => { e.stopPropagation(); handleToggleImportant(ins); }} title="Mark important" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: ins.isImportant ? '#f59e0b' : '#4a5568', padding: '2px' }}>★</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(ins.id); }} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#4a5568', padding: '2px' }}>✕</button>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div style={{ padding: '0 10px 8px', display: 'flex', gap: '4px' }}>
                      {!ins.isResearched ? (
                        <button onClick={() => handleResearch(ins)} disabled={researching === ins.id} style={{
                          padding: '4px 10px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold', cursor: researching === ins.id ? 'not-allowed' : 'pointer',
                          background: `${typeInfo.color}12`, color: typeInfo.color, border: `1px solid ${typeInfo.color}33`,
                        }}>
                          {researching === ins.id ? '⏳ Researching…' : '🔍 Get More Info'}
                        </button>
                      ) : (
                        <button onClick={() => setExpandedResearch(isExpanded ? null : ins.id)} style={{
                          padding: '4px 10px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer',
                          background: isExpanded ? `${typeInfo.color}18` : 'rgba(255,255,255,0.05)', color: isExpanded ? typeInfo.color : '#8a9ab8', border: `1px solid ${isExpanded ? typeInfo.color + '44' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                          {isExpanded ? '▾ Hide Research' : '▸ View Research'}
                        </button>
                      )}
                    </div>
                    {/* Collapsible research panel */}
                    {isExpanded && research && (
                      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                        {research.summary && <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, marginBottom: '8px' }}>{research.summary}</div>}
                        {research.neighboringCities && research.neighboringCities.length > 0 && <ResearchField label="Neighboring Cities" items={research.neighboringCities} color="#60a5fa" />}
                        {research.landmarks && research.landmarks.length > 0 && <ResearchField label="Landmarks" items={research.landmarks} color="#34d399" />}
                        {research.famousRestaurants && research.famousRestaurants.length > 0 && <ResearchField label="Famous Restaurants" items={research.famousRestaurants} color="#f472b6" />}
                        {research.population && <div style={{ marginBottom: '4px' }}><span style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Population: </span><span style={{ color: '#c4cdd8', fontSize: '11px' }}>{research.population}</span></div>}
                        {research.sportsTeams && research.sportsTeams.length > 0 && <ResearchField label="Sports Teams" items={research.sportsTeams} color="#f59e0b" />}
                        {research.lastChampionship && <div style={{ marginBottom: '4px' }}><span style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Last Championship: </span><span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>{research.lastChampionship}</span></div>}
                        {research.funFacts && research.funFacts.length > 0 && <ResearchField label="Fun Facts" items={research.funFacts} color="#a78bfa" />}
                        {research.conversationStarters && research.conversationStarters.length > 0 && <ResearchField label="Conversation Starters" items={research.conversationStarters} color={GOLD} />}
                        {research.commonChallenges && research.commonChallenges.length > 0 && <ResearchField label="Common Challenges" items={research.commonChallenges} color="#ef4444" />}
                        {research.relatedTopics && research.relatedTopics.length > 0 && <ResearchField label="Related Topics" items={research.relatedTopics} color="#8a9ab8" />}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Small talk section */}
              <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px' }}>
                <button onClick={handleGenerateSmallTalk} disabled={generatingSmallTalk || insights.length === 0} style={{
                  width: '100%', padding: '8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: generatingSmallTalk ? 'not-allowed' : 'pointer',
                  background: generatingSmallTalk ? 'rgba(255,255,255,0.05)' : `${GOLD}18`, color: generatingSmallTalk ? '#6b7280' : GOLD, border: `1px solid ${GOLD}44`,
                  letterSpacing: '1px', textTransform: 'uppercase', opacity: insights.length === 0 ? 0.5 : 1,
                }}>
                  {generatingSmallTalk ? '⏳ Generating…' : '💬 Generate Small Talk Questions'}
                </button>
                {showSmallTalk && smallTalk.length > 0 && (
                  <div style={{ marginTop: '6px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '8px' }}>
                    <div style={{ color: GOLD, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Small Talk Questions</div>
                    {smallTalk.map((q, i) => (
                      <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, marginBottom: '4px', paddingLeft: '12px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: GOLD }}>•</span> {q}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual add */}
              <div style={{ marginTop: '6px' }}>
                {showManualAdd ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px' }}>
                    <select value={manualForm.insightType} onChange={e => setManualForm(p => ({ ...p, insightType: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '4px 6px', color: '#e8e0d0', fontSize: '11px', marginBottom: '4px' }}>
                      {INSIGHT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <input value={manualForm.insightText} onChange={e => setManualForm(p => ({ ...p, insightText: e.target.value }))} placeholder="e.g. From Austin, TX" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '4px 8px', color: '#e8e0d0', fontSize: '11px', marginBottom: '6px', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && handleManualAdd()} />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={handleManualAdd} style={{ flex: 1, padding: '4px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44` }}>Add</button>
                      <button onClick={() => setShowManualAdd(false)} style={{ padding: '4px 8px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowManualAdd(true)} style={{ width: '100%', padding: '6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px dashed rgba(255,255,255,0.1)' }}>+ Add Insight Manually</button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Call controls — Start/End Live Call + Inbound checkbox */}
      {!collapsed && (
        <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8a9ab8', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Check for inbound calls — listens for transfer agent intro (name, debt amount, hardship, address, phone, account details)">
            <input type="checkbox" checked={isInbound || false} onChange={e => onToggleInbound?.(e.target.checked)} style={{ cursor: 'pointer' }} />
            📥 Inbound
          </label>
          {phase !== 'live' ? (
            <button onClick={onStartCall} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🔴 Start Live Call</button>
          ) : (
            <button onClick={onStopCall} style={{ flex: 1, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⏹ End Live Call</button>
          )}
        </div>
      )}
    </div>
  );
}

function ResearchField({ label, items, color }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
      {items.map((item, i) => (
        <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4, paddingLeft: '10px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, color }}>•</span> {item}
        </div>
      ))}
    </div>
  );
}