/**
 * FronterHardshipField.jsx — Hardship Qualification text box with an AI button
 * that rewords what was typed into 3–5 clear, professional sentences.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function FronterHardshipField({ value, onChange, labelStyle, inputStyle }) {
  const [working, setWorking] = useState(false);

  const reword = async () => {
    if (!value?.trim() || working) return;
    setWorking(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are helping a debt relief call agent document a customer's financial hardship. Reword the agent's rough notes below into 3 to 5 clear, professional, grammatically correct sentences written in third person about the customer. Fix spelling and grammar. Keep every fact (amounts, dates, reasons, names) exactly as given. Do NOT invent any new facts or details. Return only the reworded text, no preamble.\n\nAgent notes:\n${value}`,
      });
      const text = typeof res === 'string' ? res : (res?.text || res?.output || '');
      if (text.trim()) onChange(text.trim());
    } catch (e) { alert('AI reword failed: ' + (e?.message || String(e))); }
    setWorking(false);
  };

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Hardship Qualification</label>
        <button onClick={reword} disabled={!value?.trim() || working} title="AI reword" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '4px', padding: '2px 8px', cursor: !value?.trim() || working ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: !value?.trim() ? 0.5 : 1 }}>
          {working ? '⏳ Rewording…' : '✨ AI'}
        </button>
      </div>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={4} placeholder="Job loss, medical bills, reduced hours…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }} />
    </div>
  );
}