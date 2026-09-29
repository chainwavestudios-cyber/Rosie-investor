/**
 * NextCallBriefing.jsx — "Ready for Next Call" button that generates a pre-call briefing
 * the agent reads before dialing back. Includes all insights, important reminders,
 * small talk topics, and what happened on the last call.
 */
import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function NextCallBriefing({ lead, agentUsername, compact = false }) {
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = useCallback(async () => {
    if (!lead?.id) return;
    setGenerating(true); setError(''); setBriefing(null); setOpen(true);
    try {
      // Load insights and memories in parallel
      const [insights, memories, transcripts] = await Promise.all([
        base44.entities.CustomerInsight.filter({ leadId: lead.id }, '-created_date', 200),
        base44.entities.LeadMemory.filter({ leadId: lead.id }, '-created_date', 100),
        base44.entities.DebtCallTranscript.filter({ leadId: lead.id }, '-callDate', 1),
      ]);

      const lastCall = (transcripts || [])[0];
      const lastCallSummary = lastCall?.followUpReport || lastCall?.intentReport || '';

      const res = await base44.functions.invoke('liveAssistantAI', {
        mode: 'next_call_briefing',
        insights: insights || [],
        memories: memories || [],
        lastCallSummary,
        leadData: { firstName: lead.firstName, lastName: lead.lastName, city: lead.city, state: lead.state, employmentStatus: lead.employmentStatus },
      });

      const text = res?.briefing || res?.data?.briefing || '';
      setBriefing(text);

      // Save briefing to lead record
      await base44.entities.DebtLead.update(lead.id, {
        nextCallBriefing: text,
        nextCallBriefingAt: new Date().toISOString(),
      });
    } catch (e) { setError('Failed to generate briefing: ' + (e?.message || String(e))); }
    setGenerating(false);
  }, [lead]);

  // Load existing briefing from lead record
  const loadExisting = useCallback(async () => {
    if (lead?.nextCallBriefing) {
      setBriefing(lead.nextCallBriefing);
      setOpen(true);
    } else {
      generate();
    }
  }, [lead, generate]);

  if (compact) {
    return (
      <>
        <button onClick={loadExisting} disabled={!lead?.id} style={{
          padding: '6px 14px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: lead?.id ? 'pointer' : 'not-allowed',
          background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap',
          opacity: lead?.id ? 1 : 0.5,
        }}>
          📋 Ready for Next Call
        </button>
        {open && <BriefingModal briefing={briefing} generating={generating} error={error} onClose={() => setOpen(false)} onRegenerate={generate} lead={lead} />}
      </>
    );
  }

  return (
    <>
      <button onClick={loadExisting} disabled={!lead?.id} style={{
        padding: '10px 20px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: lead?.id ? 'pointer' : 'not-allowed',
        background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', letterSpacing: '1px', textTransform: 'uppercase',
        boxShadow: lead?.id ? '0 4px 12px rgba(16,185,129,0.3)' : 'none', opacity: lead?.id ? 1 : 0.5,
      }}>
        📋 Ready for Next Call
      </button>
      {open && <BriefingModal briefing={briefing} generating={generating} error={error} onClose={() => setOpen(false)} onRegenerate={generate} lead={lead} />}
    </>
  );
}

function BriefingModal({ briefing, generating, error, onClose, onRegenerate, lead }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: '700px', maxHeight: '85vh', background: DARK, border: `1px solid ${GOLD}44`, borderRadius: '8px',
        display: 'flex', flexDirection: 'column', boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 Pre-Call Briefing</div>
            <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{lead?.firstName} {lead?.lastName}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {briefing && <button onClick={onRegenerate} disabled={generating} style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '10px', cursor: generating ? 'not-allowed' : 'pointer', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, fontWeight: 'bold' }}>{generating ? '⏳' : '🔄 Regenerate'}</button>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: '0 4px' }}>×</button>
          </div>
        </div>
        {/* Warning banner */}
        <div style={{ padding: '8px 20px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>
          <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⚠️ Read this before dialing</div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {generating ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>⏳ Generating briefing from call insights and memories…</div>
          ) : error ? (
            <div style={{ color: '#ef4444', fontSize: '12px' }}>⚠ {error}</div>
          ) : briefing ? (
            <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{briefing}</div>
          ) : (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No briefing generated yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}