/**
 * LiveProfileAgent.jsx — A chat-style AI agent for the Client Profile.
 * Type natural-language commands and the agent fills profile fields and/or
 * creates Google Calendar appointments on your behalf.
 *
 * Examples:
 *   "Set monthly income to 4000 and debt amount to 25000"
 *   "Note: customer was laid off 3 months ago"
 *   "Schedule a follow-up for tomorrow at 2pm"
 *   "Set hardship when to 'lost job in January', income to 3500, and book a callback Friday morning"
 */
import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAgentVoice } from '@/hooks/useAgentVoice';
import AgentVoiceBar from '@/components/debt/agent/AgentVoiceBar';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const PURPLE = '#a78bfa';
const DARK = '#0a0f1e';

const SIMPLE_FIELDS = [
  'firstName', 'lastName', 'phone', 'email', 'address', 'city', 'state', 'zip',
  'dateOfBirth', 'employmentStatus', 'monthlyIncome', 'creditScore',
  'behindOnPayments', 'monthsBehind', 'debtAmount', 'creditorCount',
  'creditors', 'notes', 'hardshipWhen', 'hardshipWhy', 'hardshipHow',
];
const JSON_FIELDS = ['debtLedgerJson', 'billsJson', 'cosignersJson'];

export default function LiveProfileAgent({ local, update, onSave, lead, username }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I can fill profile fields, save notes, set status, tag hot leads, and book appointments. Type it, or hit 🎙 Talk to Agent and just say it. Try: "note: he lost his job in January" or "book a callback tomorrow at 2pm".' },
  ]);
  const scrollRef = useRef(null);

  const voice = useAgentVoice({ onUtterance: (spoken) => send(spoken) });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Never leave the mic hot after the panel closes
  useEffect(() => {
    if (!open && voice.status !== 'off') voice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async (spoken) => {
    const text = (spoken ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMessages(prev => [...prev, { role: 'user', text }]);
    try {
      const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      const currentValues = {};
      SIMPLE_FIELDS.forEach(f => { currentValues[f] = local[f] ?? ''; });
      JSON_FIELDS.forEach(jf => {
        try { currentValues[jf] = JSON.parse(local[jf] || '[]'); } catch { currentValues[jf] = []; }
      });

      const prompt = `You are a CRM assistant for a debt settlement agent. The agent types natural-language commands. Parse the command and return a JSON object describing what to do.

Current datetime (America/New_York): ${nowET}

Current lead field values:
${JSON.stringify(currentValues, null, 2)}

Agent command: "${text}"

Return JSON with these keys:
- fieldUpdates: object of fieldName → newValue, ONLY for simple fields the agent asked to change. Use proper types (numbers for numeric fields, booleans for behindOnPayments, YYYY-MM-DD for dateOfBirth, one of employed/self-employed/unemployed/retired/disabled for employmentStatus).
- jsonUpdates: object of jsonFieldName → COMPLETE updated JSON array/object (existing + changes). Only for debtLedgerJson, billsJson, or cosignersJson if mentioned.
- appointment: { requested: boolean, startISO: string|null, summary: string }. If the agent asked to schedule/book a callback or follow-up, set requested=true and convert the requested time to an ISO 8601 UTC string (convert from America/New_York). Use 10:00 AM ET for "morning/AM", 2:00 PM ET for "afternoon/PM", 5:00 PM ET for "evening". summary = 1-sentence agenda. If no appointment requested, set { requested: false, startISO: null, summary: "" }.
- note: string|null. When the agent dictates something to remember about this client ("note: he lost his job in January", "she wants a callback after payday"), put the note text here. null when there is no note.
- status: string|null. Only when the agent explicitly asks to change the lead's pipeline status. One of: new, contacted, qualified, enrolled, declined, completed, callback. null otherwise.
- hotLead: boolean|null. true only when the agent says the client is a hot lead or ready to close. null otherwise.
- reply: a friendly 1-sentence confirmation of what you did (e.g. "Done — set monthly income to $4,000 and scheduled a follow-up for tomorrow at 2:00 PM ET."), or the answer when the agent asked a question.

Rules:
- Only include fields the agent actually asked to change. Do not echo unchanged fields.
- If the agent asked a QUESTION ("what does he owe?", "when did he last pay?"), leave fieldUpdates/jsonUpdates empty and appointment.requested=false, and answer it in reply using only the field values above. Say plainly when the data isn't on file.
- If the command is unclear or doesn't map to any action, set empty fieldUpdates/jsonUpdates and appointment.requested=false, and explain in reply.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            fieldUpdates: { type: 'object' },
            jsonUpdates: { type: 'object' },
            appointment: { type: 'object' },
            note: { type: 'string' },
            status: { type: 'string' },
            hotLead: { type: 'boolean' },
            reply: { type: 'string' },
          },
        },
      });

      const data = result?.data || result || {};
      const reply = data.reply || 'Done.';
      const actions = [];

      // Apply simple field updates
      const fieldUpdates = data.fieldUpdates || {};
      const applied = {};
      let fieldCount = 0;
      Object.keys(fieldUpdates).forEach(key => {
        const val = fieldUpdates[key];
        if (val === undefined || val === null) return;
        if (SIMPLE_FIELDS.includes(key)) {
          update(key, val);
          applied[key] = val;
          fieldCount++;
        }
      });

      // Apply JSON field updates
      const jsonUpdates = data.jsonUpdates || {};
      let jsonCount = 0;
      Object.keys(jsonUpdates).forEach(key => {
        const val = jsonUpdates[key];
        if (val === undefined || val === null) return;
        if (JSON_FIELDS.includes(key)) {
          const jsonStr = typeof val === 'string' ? val : JSON.stringify(val);
          update(key, jsonStr);
          applied[key] = jsonStr;
          jsonCount++;
        }
      });

      // Whatever else the agent was told to do: a dictated note, a status change, a hot-lead tag
      if (data.note && String(data.note).trim()) {
        const noteText = String(data.note).trim();
        let log = [];
        try { log = JSON.parse(local.notesLogJson || '[]'); } catch { log = []; }
        if (!Array.isArray(log)) log = [];
        const noteStr = JSON.stringify([...log, { text: noteText, timestamp: new Date().toISOString(), author: username || 'agent', type: 'ai_agent' }]);
        update('notesLogJson', noteStr);
        applied.notesLogJson = noteStr;
        actions.push('Note saved');
      }
      if (data.status && String(data.status).trim()) {
        const nextStatus = String(data.status).trim();
        update('status', nextStatus);
        applied.status = nextStatus;
        actions.push(`Status → ${nextStatus}`);
      }
      if (data.hotLead === true) {
        update('isHotLead', true);
        applied.isHotLead = true;
        actions.push('Tagged hot lead');
      }

      if (Object.keys(applied).length > 0) {
        actions.unshift(`${Object.keys(applied).length} field(s) updated`);
        onSave?.(applied);
      }

      // Create appointment if requested
      const appt = data.appointment || {};
      if (appt.requested && appt.startISO) {
        try {
          const leadName = `${local.firstName || ''} ${local.lastName || ''}`.trim();
          const res = await base44.functions.invoke('autoScheduleAppointment', {
            action: 'create',
            startISO: appt.startISO,
            leadId: local.id,
            leadName,
            agentName: username || '',
            summary: appt.summary || 'Follow-up call',
            attendeeEmail: local.email || null,
          });
          const apptData = res?.data || res;
          if (apptData?.scheduled) {
            actions.push(`📅 Appointment scheduled: ${apptData.resolvedTime}`);
          } else {
            actions.push(`⚠ Appointment failed: ${apptData?.error || 'unknown'}`);
          }
        } catch (e) {
          actions.push(`⚠ Appointment failed: ${e?.message || String(e)}`);
        }
      }

      const fullReply = actions.length > 0 ? `${reply} (${actions.join('; ')}.)` : reply;
      setMessages(prev => [...prev, { role: 'assistant', text: fullReply }]);
      voice.speakIfActive(fullReply);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `⚠ Error: ${e?.message || String(e)}`, error: true }]);
      voice.speakIfActive('Sorry, that command did not work.');
      voice.idle();
    }
    setBusy(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      {/* Toggle button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setOpen(o => !o)} style={{ background: open ? `${PURPLE}18` : `${GOLD}18`, color: open ? PURPLE : GOLD, border: `1px solid ${open ? PURPLE + '44' : GOLD + '44'}`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          {open ? '✕ Close Agent' : '🤖 Live Agent'}
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <div style={{ marginTop: '8px', background: '#0d1b2a', border: `1px solid ${PURPLE}33`, borderRadius: '6px', overflow: 'hidden' }}>
          {/* Messages */}
          <div ref={scrollRef} style={{ maxHeight: '180px', overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ background: m.role === 'user' ? `${GOLD}15` : m.error ? `${RED}12` : 'rgba(255,255,255,0.04)', border: `1px solid ${m.role === 'user' ? GOLD + '33' : m.error ? RED + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', padding: '6px 10px', color: m.error ? RED : m.role === 'user' ? GOLD : '#c4cdd8', fontSize: '11px', lineHeight: 1.4, fontFamily: 'Georgia, serif' }}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: 'flex-start', color: PURPLE, fontSize: '11px', fontStyle: 'italic' }}>🤖 Working…</div>
            )}
          </div>
          {/* Voice in / voice out */}
          <AgentVoiceBar voice={voice} />

          {/* Input */}
          <div style={{ display: 'flex', gap: '6px', padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a command… (e.g. set income to 4000, schedule follow-up tomorrow 2pm)"
              disabled={busy}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', fontFamily: 'Georgia, serif' }}
            />
            <button onClick={send} disabled={busy || !input.trim()} style={{ background: `linear-gradient(135deg,${PURPLE},#8b5cf6)`, color: DARK, border: 'none', borderRadius: '4px', padding: '7px 14px', cursor: (busy || !input.trim()) ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (busy || !input.trim()) ? 0.5 : 1 }}>
              {busy ? '⏳' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}