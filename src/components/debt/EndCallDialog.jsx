/**
 * EndCallDialog.jsx — Modal shown when ending a live call.
 * Asks the agent whether to keep or delete the profile and lead contact card.
 * Either way, the call is logged and the transcript is kept.
 * Delete = soft-delete (kept for 7 days before permanent deletion).
 */
import { useState } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function EndCallDialog({ lead, transcriptLineCount, onKeep, onDelete, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const leadName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || 'New Lead';

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(); } catch {}
    setDeleting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: DARK, border: `1px solid ${GOLD}44`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', width: '460px', maxWidth: '90vw', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color: GOLD, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>⏹ End Live Call</div>
          <div style={{ color: '#c4cdd8', fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>{leadName}</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{transcriptLineCount} transcript lines · Call will be logged & transcript saved</div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {!confirming ? (
            <>
              <div style={{ color: '#e8e0d0', fontSize: '14px', marginBottom: '16px', lineHeight: 1.5 }}>
                Do you want to keep or delete the profile and lead contact card?
              </div>
              <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '10px 12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
                ℹ️ Either way, the call is logged in activity history and the transcript is saved. Delete removes the profile/contact card from your active list — it's kept for 7 days before permanent deletion.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onKeep} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  ✓ Keep Profile
                </button>
                <button onClick={() => setConfirming(true)} style={{ flex: 1, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  🗑 Delete Profile
                </button>
              </div>
              <button onClick={onCancel} style={{ width: '100%', marginTop: '8px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '11px', padding: '6px' }}>
                Cancel — keep call going
              </button>
            </>
          ) : (
            <>
              <div style={{ color: '#e8e0d0', fontSize: '14px', marginBottom: '12px', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>{leadName}</strong>'s profile and contact card?
              </div>
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px', padding: '10px 12px', marginBottom: '16px', color: '#f59e0b', fontSize: '11px', lineHeight: 1.5 }}>
                ⚠️ The profile and contact card will be removed from your active list and kept for <strong>7 days</strong> before being permanently deleted. The call log and transcript are still saved.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', padding: '12px', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? '⏳ Deleting…' : '✓ Yes, Delete'}
                </button>
                <button onClick={() => setConfirming(false)} disabled={deleting} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}