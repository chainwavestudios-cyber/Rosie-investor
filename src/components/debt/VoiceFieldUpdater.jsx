/**
 * VoiceFieldUpdater.jsx — Mic button for the Client Profile tabs.
 * Press it, speak field updates naturally, and the LLM parses your speech
 * into the correct fields, applies them, and autosaves.
 * Uses the browser's SpeechRecognition API (Chrome/Edge).
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const GREEN = '#4ade80';

// Which fields each tab can update via voice
export const VOICE_TABS = ['overview', 'debt', 'bills', 'hardship', 'cosigners'];

const TAB_FIELD_MAP = {
  overview: {
    simple: ['firstName', 'lastName', 'phone', 'email', 'address', 'city', 'state', 'zip', 'dateOfBirth', 'employmentStatus', 'monthlyIncome', 'creditScore', 'behindOnPayments', 'monthsBehind', 'debtAmount', 'notes'],
    json: [],
  },
  debt: {
    simple: ['debtAmount', 'creditorCount', 'creditors'],
    json: ['debtLedgerJson'],
  },
  bills: {
    simple: ['monthlyIncome', 'employmentStatus'],
    json: ['billsJson'],
  },
  hardship: {
    simple: ['hardshipWhen', 'hardshipWhy', 'hardshipHow'],
    json: [],
  },
  cosigners: {
    simple: [],
    json: ['cosignersJson'],
  },
};

export default function VoiceFieldUpdater({ tab, local, update, onSave }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRecognition;
  const fieldMap = TAB_FIELD_MAP[tab];

  const processVoiceUpdate = useCallback(async (text) => {
    if (!text || text.length < 3) return;
    setProcessing(true);
    setError('');
    try {
      // Build current values context for the LLM
      const currentValues = {};
      (fieldMap?.simple || []).forEach(f => { currentValues[f] = local[f] ?? ''; });
      (fieldMap?.json || []).forEach(jf => {
        try { currentValues[jf] = JSON.parse(local[jf] || '[]'); } catch { currentValues[jf] = []; }
      });

      const prompt = `You are a data extraction assistant for a debt settlement CRM. The agent is verbally updating client profile fields on the "${tab}" tab. Parse the spoken text and return ONLY the fields that should be updated as a JSON object.

Available fields for this tab:
- Simple fields: ${(fieldMap?.simple || []).join(', ')}
- JSON fields: ${(fieldMap?.json || []).join(', ')}

Current field values:
${JSON.stringify(currentValues, null, 2)}

Spoken text: "${text}"

Rules:
- Return a JSON object with only the fields the agent mentioned or implied should change.
- For boolean fields (behindOnPayments), use true/false.
- For number fields (monthlyIncome, creditScore, monthsBehind, debtAmount, creditorCount), return numbers.
- For dateOfBirth, return YYYY-MM-DD format.
- For employmentStatus, use one of: employed, self-employed, unemployed, retired, disabled.
- For debtLedgerJson, return the COMPLETE updated array (existing entries plus any new ones). Each entry: {creditor, balance, creditLimit, interestRate, monthlyPayment}.
- For billsJson, return the COMPLETE updated object (existing keys plus any new ones). Keys: rent, auto, autoInsurance, gas, groceries, utilities, phone, internet, studentLoans, healthInsurance, childcare, misc, or custom keys. Values are numbers.
- For cosignersJson, return the COMPLETE updated array (existing entries plus any new ones). Each entry: {name, relationship, phone, email, accounts, employed, notes}.
- If the agent said something that doesn't map to any field, ignore it.
- Only return fields that should be CHANGED. Do not return fields that weren't mentioned.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: { type: 'object', additionalProperties: true },
      });

      const updates = result?.data || result || {};
      const appliedUpdates = {};
      let count = 0;
      Object.keys(updates).forEach(key => {
        const val = updates[key];
        if (val === undefined || val === null) return;
        if ((fieldMap?.json || []).includes(key)) {
          const jsonStr = typeof val === 'string' ? val : JSON.stringify(val);
          update(key, jsonStr);
          appliedUpdates[key] = jsonStr;
          count++;
        } else if ((fieldMap?.simple || []).includes(key)) {
          update(key, val);
          appliedUpdates[key] = val;
          count++;
        }
      });

      if (count > 0) {
        setApplied(true);
        setTimeout(() => setApplied(false), 3000);
        onSave?.(appliedUpdates);
      } else {
        setError('No matching fields detected in your speech.');
      }
    } catch (e) {
      setError('Failed to process: ' + (e?.message || String(e)));
    }
    setProcessing(false);
  }, [tab, local, fieldMap, update, onSave]);

  const startListening = useCallback(() => {
    if (!supported) { setError('Voice input not supported. Use Chrome or Edge.'); return; }
    setListening(true); setTranscript(''); setApplied(false); setError(''); finalTextRef.current = '';
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTextRef.current += t + ' ';
        else interim += t;
      }
      setTranscript(finalTextRef.current + interim);
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech') setError('Mic error: ' + e.error); };
    rec.onend = () => {
      setListening(false);
      processVoiceUpdate(finalTextRef.current.trim());
    };
    recognitionRef.current = rec;
    rec.start();
  }, [supported, processVoiceUpdate]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  if (!fieldMap || !supported) return null;

  const btnStyle = {
    background: listening ? 'rgba(239,68,68,0.15)' : applied ? 'rgba(74,222,128,0.15)' : `${GOLD}18`,
    color: listening ? RED : applied ? GREEN : GOLD,
    border: `1px solid ${listening ? 'rgba(239,68,68,0.4)' : applied ? 'rgba(74,222,128,0.3)' : GOLD + '44'}`,
    borderRadius: '4px',
    padding: '6px 14px',
    cursor: processing ? 'not-allowed' : 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <button onClick={listening ? stopListening : startListening} disabled={processing} style={btnStyle}>
        {processing ? '⏳ Parsing…' : listening ? '🔴 Stop & Apply' : applied ? '✓ Applied & Saved' : '🎤 Voice Update'}
      </button>
      {listening && transcript && (
        <span style={{ color: '#8a9ab8', fontSize: '11px', fontStyle: 'italic', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          "{transcript}"
        </span>
      )}
      {listening && !transcript && (
        <span style={{ color: RED, fontSize: '11px', animation: 'pulse 1s infinite' }}>Listening…</span>
      )}
      {error && <span style={{ color: RED, fontSize: '10px' }}>⚠ {error}</span>}
    </div>
  );
}