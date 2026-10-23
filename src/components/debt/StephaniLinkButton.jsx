/**
 * StephaniLinkButton.jsx — the per-lead video link, handed out from the contact card.
 * Creates the card's token on first use, then shows the link with a copy button so
 * a rep can text or email it to the client.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';

export default function StephaniLinkButton({ leadId, clientName }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const createLink = async () => {
    if (!leadId || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('stephaniLink', { leadId });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setLink(data?.url || '');
      setOpen(true);
    } catch (e) {
      setError(e?.message || 'The video link could not be created.');
      setOpen(true);
    }
    setLoading(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={createLink}
        disabled={loading || !leadId}
        title="Create this client's link to the live video call with Stephani"
        style={{
          background: `${GOLD}18`,
          color: GOLD,
          border: `1px solid ${GOLD}55`,
          borderRadius: '4px',
          padding: '7px 14px',
          cursor: loading || !leadId ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          fontWeight: 'bold',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          opacity: loading || !leadId ? 0.5 : 1,
        }}
      >
        {loading ? '⏳' : '🎥 Stephani Link'}
      </button>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, zIndex: 9700, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div style={{ width: '100%', maxWidth: '520px', background: '#0a0f1e', border: `1px solid ${GOLD}55`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.85)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🎥 Stephani Video Link</div>
                {clientName && <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{clientName}</div>}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '16px 18px' }}>
              {error ? (
                <div style={{ color: '#ef4444', fontSize: '12px' }}>{error}</div>
              ) : (
                <>
                  <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.6, marginBottom: '12px' }}>
                    Send this to {clientName || 'the client'} however you like. It opens a live video call with Stephani, who already knows their name and state.
                  </div>
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.target.select()}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={copy} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {copied ? '✓ Copied' : '📋 Copy Link'}
                    </button>
                    <a href={link} target="_blank" rel="noreferrer" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '8px 16px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none' }}>
                      Open
                    </a>
                  </div>
                  <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '12px', lineHeight: 1.6 }}>
                    Re-opening this same link always reaches the same client's call, and whatever she captures lands back on this card.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}