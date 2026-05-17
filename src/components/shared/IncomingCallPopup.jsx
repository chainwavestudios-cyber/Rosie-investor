import { useState, useEffect } from 'react';
import { useTwilioDevice } from '@/lib/TwilioDeviceContext';

const GOLD = '#b8933a';

export default function IncomingCallPopup({ onAnswerLead, onAnswerInvestor }) {
  const { incomingCall, setIncomingCall } = useTwilioDevice();
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      setRinging(true);
    } else {
      setRinging(false);
    }
  }, [incomingCall]);

  if (!incomingCall || !ringing) return null;

  const { call, from, lead } = incomingCall;

  // Format caller info
  const isInvestor = lead && lead.username !== undefined; // InvestorUser has username
  const isLead     = lead && lead.firstName !== undefined && lead.username === undefined;

  const name = lead
    ? (isInvestor ? lead.name : `${lead.firstName || ''} ${lead.lastName || ''}`.trim())
    : 'Unknown Caller';

  const leadType = lead
    ? (isInvestor ? '✅ Investor / Portal User' : (lead.leadType === 'nb_tech' ? '💡 NB Tech Lead' : '🔵 Standard Lead'))
    : '❓ Unknown Number';

  const lastCalled = lead?.lastCalledAt
    ? new Date(lead.lastCalledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : lead?.callAttempts > 0 ? `${lead.callAttempts} attempts` : 'First contact';

  const phone = from || lead?.phone || '—';
  const status = lead?.status || lead?.disposition || '—';

  const handleAnswer = () => {
    try { call.accept(); } catch {}
    setRinging(false);
    if (isInvestor && onAnswerInvestor) {
      onAnswerInvestor(lead);
    } else if (isLead && onAnswerLead) {
      onAnswerLead(lead);
    }
    setIncomingCall(null);
  };

  const handleDecline = () => {
    try { call.reject(); } catch {}
    setRinging(false);
    setIncomingCall(null);
  };

  return (
    <>
      <style>{`
        @keyframes incoming-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4), 0 20px 60px rgba(0,0,0,0.8); }
          50%       { box-shadow: 0 0 0 16px rgba(74,222,128,0), 0 20px 60px rgba(0,0,0,0.8); }
        }
        @keyframes slide-in {
          from { transform: translateY(-20px) translateX(-50%); opacity: 0; }
          to   { transform: translateY(0) translateX(-50%); opacity: 1; }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '70px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        width: '420px',
        background: '#0d1b2a',
        border: '2px solid rgba(74,222,128,0.5)',
        borderRadius: '12px',
        padding: '20px 24px',
        fontFamily: 'Georgia, serif',
        animation: 'slide-in 0.3s ease, incoming-ring 1.2s ease-in-out infinite',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#4ade80', boxShadow: '0 0 8px #4ade80',
            animation: 'incoming-ring 0.8s ease-in-out infinite',
          }} />
          <div style={{ color: '#4ade80', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            📲 Incoming Call
          </div>
        </div>

        {/* Caller Info */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#e8e0d0', fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>{name}</div>
          <div style={{ color: '#60a5fa', fontSize: '13px', fontFamily: 'monospace', marginBottom: '8px' }}>{phone}</div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Lead Type */}
            <span style={{
              background: isInvestor ? 'rgba(74,222,128,0.12)' : 'rgba(96,165,250,0.12)',
              color: isInvestor ? '#4ade80' : '#60a5fa',
              border: `1px solid ${isInvestor ? 'rgba(74,222,128,0.3)' : 'rgba(96,165,250,0.3)'}`,
              borderRadius: '20px', padding: '3px 10px', fontSize: '11px',
            }}>
              {leadType}
            </span>

            {/* Status */}
            {status && status !== '—' && (
              <span style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#8a9ab8',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px', padding: '3px 10px', fontSize: '11px',
              }}>
                Status: {status}
              </span>
            )}
          </div>

          {/* Last Called */}
          <div style={{ marginTop: '8px', color: '#6b7280', fontSize: '11px' }}>
            🕐 Last contact: {lastCalled}
          </div>

          {/* Notes preview */}
          {lead?.notes && (
            <div style={{
              marginTop: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px',
              padding: '8px 10px',
              color: '#8a9ab8',
              fontSize: '11px',
              lineHeight: 1.5,
              maxHeight: '48px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              📝 {lead.notes.slice(0, 120)}{lead.notes.length > 120 ? '…' : ''}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAnswer}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
              letterSpacing: '1px',
            }}
          >
            📞 Answer{lead ? ' & Open Card' : ''}
          </button>
          <button
            onClick={handleDecline}
            style={{
              flex: 1,
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '8px',
              padding: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
            }}
          >
            📵 Decline
          </button>
        </div>

        {/* No match notice */}
        {!lead && (
          <div style={{
            marginTop: '10px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#f59e0b',
            fontSize: '11px',
          }}>
            ⚠ No matching lead or investor found for this number.
          </div>
        )}
      </div>
    </>
  );
}