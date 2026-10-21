/**
 * FronterBobMailerSim.jsx — The simulated digital mailer for BOB training.
 *
 * Mirrors the contact card's Mailer tab: during a practice call the fronter can
 * open the Rate Drop notice this customer received and practice the
 * address/notice-number/debt verification against it. Built from the current
 * training scenario — nothing is stored and no email is sent.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import FronterPopup from './FronterPopup';

const GOLD = '#10b981';
const BLUE = '#60a5fa';

export default function FronterBobMailerSim({ firstName, address, city, state, zipCode, debtAmount, noticeId, onClose }) {
  const [html, setHtml] = useState('');
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setMsg('');
    try {
      const debt = Number(debtAmount) || 0;
      const res = await base44.functions.invoke('rateDropGenerateMailer', {
        action: 'preview',
        card: {
          firstName: firstName || 'Bob',
          lastName: '',
          address: address || '',
          city: city || '',
          state: state || '',
          zipCode: zipCode || '',
          noticeId,
          ...(debt > 0 ? { debtAmount: debt } : {}),
        },
      });
      const built = res?.data?.html || '';
      setHtml(built);
      if (!built) setMsg('The mailer came back empty — check the saved Rate Drop Engine template.');
    } catch (e) {
      setMsg('Could not build the simulated mailer: ' + (e?.message || 'unknown error'));
    }
    setBusy(false);
  }, [firstName, address, city, state, zipCode, debtAmount, noticeId]);

  useEffect(() => { load(); }, [load]);

  return (
    <FronterPopup
      title="📨 Digital Mailer — Training"
      subtitle="The notice this customer received — simulated, nothing is stored or emailed"
      accent={GOLD}
      onClose={onClose}
      initialPos={{ x: 280, y: 60 }}
      initialSize={{ w: 720, h: 780 }}
      minW={420}
      minH={420}
      zIndex={21000}
    >
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ color: '#6b7280', fontSize: '10px' }}>
            Simulated notice for <span style={{ color: '#e8e0d0' }}>{firstName || 'this customer'}</span> · File Number <span style={{ color: BLUE }}>{noticeId}</span>
          </div>
          <button onClick={load} disabled={busy} style={{ background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 12px', cursor: busy ? 'wait' : 'pointer', fontSize: '10px' }}>
            {busy ? 'Rebuilding…' : '↻ Rebuild from template'}
          </button>
        </div>

        {msg && <div style={{ color: '#f87171', fontSize: '11px' }}>{msg}</div>}
        {busy && !html && <div style={{ color: '#6b7280', fontSize: '12px' }}>Building the simulated mailer…</div>}

        {html && (
          <iframe
            title="Simulated Rate Drop digital mailer"
            srcDoc={html}
            style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', background: '#ffffff' }}
          />
        )}
      </div>
    </FronterPopup>
  );
}