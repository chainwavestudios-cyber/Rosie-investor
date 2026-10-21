/**
 * RateDropMailerTab.jsx — The Mailer tab on a contact card.
 *
 * Shows the digital mailer generated for this card (built when the card was
 * issued, refreshed on demand). This is the mailer Mailjet injects when a Rate
 * Drop campaign emails the prospect.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';

export default function RateDropMailerTab({ lead }) {
  const [mailer, setMailer] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async (regenerate) => {
    if (!lead?.id) return;
    setBusy(regenerate ? 'regen' : 'load');
    setMsg('');
    try {
      if (regenerate) await base44.functions.invoke('rateDropGenerateMailer', { action: 'generate', leadIds: [lead.id] });
      const res = await base44.functions.invoke('rateDropGenerateMailer', { action: 'get', leadId: lead.id });
      setMailer(res?.data?.mailer || null);
    } catch (e) {
      setMsg('Could not load the mailer: ' + (e?.message || 'unknown error'));
    }
    setBusy('');
  }, [lead?.id]);

  useEffect(() => { load(false); }, [load]);

  if (!lead?.id) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>📨 Rate Drop Digital Mailer</div>
          <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>
            {mailer
              ? <>Notice ID <span style={{ color: BLUE }}>{mailer.noticeId || '—'}</span> · phone {mailer.phone || '—'} · generated {mailer.generatedAt ? new Date(mailer.generatedAt).toLocaleString() : '—'}{mailer.lastSentAt ? ` · emailed ${new Date(mailer.lastSentAt).toLocaleString()}` : ''}</>
              : 'No mailer generated for this card yet'}
          </div>
        </div>
        <button onClick={() => load(true)} disabled={!!busy} style={{ background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '10px' }}>
          {busy === 'regen' ? 'Rebuilding…' : '↻ Regenerate from template'}
        </button>
      </div>

      {msg && <div style={{ color: '#f87171', fontSize: '11px' }}>{msg}</div>}

      {busy === 'load' && !mailer && <div style={{ color: '#6b7280', fontSize: '12px' }}>Generating the digital mailer…</div>}

      {mailer?.html && (
        <iframe
          title="Rate Drop digital mailer"
          srcDoc={mailer.html}
          style={{ width: '100%', height: '880px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', background: '#ffffff' }}
        />
      )}

      {!busy && !mailer?.html && (
        <div style={{ color: '#6b7280', fontSize: '11px' }}>
          Press “Regenerate from template” to build this card's mailer from the saved Rate Drop Engine template.
        </div>
      )}
    </div>
  );
}