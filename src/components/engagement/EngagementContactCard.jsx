/**
 * EngagementContactCard.jsx — opens the right contact card for a name in the engagement
 * console: the Debt Call Coach card for a lead, the fronter card for a prospect.
 * Reads the full record by id, so it works from any host (coach, super admin, assistant).
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import FronterContactCard from '@/components/fronter/FronterContactCard';
import { C } from '@/components/superadmin/kit';

export default function EngagementContactCard({ target, username, onClose }) {
  const [lead, setLead] = useState(null);
  const [state, setState] = useState('loading');
  const leadId = target?.leadId;

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setState('loading');
    setLead(null);
    const entity = target.source === 'fronter' ? base44.entities.FronterLead : base44.entities.DebtLead;
    entity.get(leadId)
      .then((record) => {
        if (cancelled) return;
        if (!record?.id) { setState('missing'); return; }
        setLead(record);
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('missing'); });
    return () => { cancelled = true; };
  }, [leadId, target?.source]);

  if (!target) return null;

  if (state === 'ready' && lead) {
    const onSave = (updated) => setLead(updated || lead);
    if (target.source === 'fronter') {
      return <FronterContactCard lead={lead} username={username} onClose={onClose} onSave={onSave} embedded />;
    }
    return <ClientProfileModal lead={lead} username={username} onClose={onClose} onSave={onSave} />;
  }

  const message = state === 'loading'
    ? `Opening ${target.name || 'the contact card'}…`
    : `${target.name || 'That contact card'} is no longer on file.`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 14900 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '20px 22px', minWidth: '280px', textAlign: 'center' }}>
        <div style={{ color: C.ink, fontSize: '13px' }}>{message}</div>
        {state !== 'loading' && (
          <button onClick={onClose} style={{ marginTop: '14px', background: 'rgba(255,255,255,0.06)', color: C.ink, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Close</button>
        )}
      </div>
    </div>
  );
}