/**
 * CreditAlertPopup.jsx — Global popup that appears when Deepgram or Anthropic/AI
 * credits are exhausted. Listens for 'credit-exhaustion' window events.
 * Mount once in the app layout; any component can trigger it via notifyCreditExhaustion().
 */
import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const GOLD = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';

export default function CreditAlertPopup() {
  const [alert, setAlert] = useState(null); // { service, detail } | null

  useEffect(() => {
    const handler = (e) => {
      const { service, detail } = e.detail || {};
      setAlert({ service: service || 'anthropic', detail: detail || '', timestamp: Date.now() });
    };
    window.addEventListener('credit-exhaustion', handler);
    return () => window.removeEventListener('credit-exhaustion', handler);
  }, []);

  // Prevent duplicate popups within 10 seconds
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(null), 15000);
    return () => clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;

  const isDeepgram = alert.service === 'deepgram';
  const serviceLabel = isDeepgram ? 'Deepgram' : 'Anthropic / AI';
  const icon = isDeepgram ? '🎙️' : '🤖';
  const accentColor = isDeepgram ? ORANGE : RED;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{
        background: '#0d1b2a', border: `2px solid ${accentColor}`, borderRadius: '8px',
        maxWidth: '480px', width: '90%', padding: '0',
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${accentColor}33`,
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${accentColor}33`,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <AlertTriangle size={22} color={accentColor} />
          <div style={{ flex: 1 }}>
            <div style={{ color: accentColor, fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {serviceLabel} Credits Exhausted
            </div>
          </div>
          <button onClick={() => setAlert(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>{icon}</div>
          <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
            <strong style={{ color: accentColor }}>{serviceLabel}</strong> has run out of credits or hit a rate limit.
            {!isDeepgram && ' AI coaching, Q&A, and intent analysis will stop working until credits are replenished.'}
            {isDeepgram && ' Live call transcription will stop working until credits are replenished.'}
          </div>
          {alert.detail && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px', padding: '10px 12px', marginBottom: '16px',
            }}>
              <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Error Detail</div>
              <div style={{ color: '#8a9ab8', fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-word' }}>{alert.detail}</div>
            </div>
          )}
          <div style={{
            background: `${GOLD}08`, border: `1px solid ${GOLD}22`, borderRadius: '4px',
            padding: '10px 12px', marginBottom: '16px',
          }}>
            <div style={{ color: GOLD, fontSize: '11px', lineHeight: 1.5 }}>
              💡 <strong>To fix:</strong> Add credits to your {serviceLabel} account, or update the API key in app secrets.
              {!isDeepgram && ' The system will automatically fall back to platform credits when available.'}
            </div>
          </div>
          <button
            onClick={() => setAlert(null)}
            style={{
              width: '100%', background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              color: '#fff', border: 'none', borderRadius: '4px', padding: '12px',
              cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
            }}
          >
            Got it — Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}