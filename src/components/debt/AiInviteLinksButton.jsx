/**
 * AiInviteLinksButton.jsx — the AI invitation links for one contact card.
 * Creates the card's token on first use, then hands over one link per assistant so a
 * rep can text or email the client whichever face they want to offer.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';

export default function AiInviteLinksButton({ leadId, clientName }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState([]);
  const [copiedKey, setCopiedKey] = useState('');
  const [error, setError] = useState('');

  const createLinks = async () => {
    if (!leadId || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('aiInviteLinks', { leadId });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      const rows = Array.isArray(data?.links) && data.links.length
        ? data.links
        : [{ key: 'link', name: 'Video link', url: data?.url || '' }];
      setLinks(rows);
      setOpen(true);
    } catch (e) {
      setError(e?.message || 'The invitation links could not be created.');
      setOpen(true);
    }
    setLoading(false);
  };

  const copy = async (row) => {
    try {
      await navigator.clipboard.writeText(row.url);
    } catch {
      const el = document.createElement('textarea');
      el.value = row.url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedKey(row.key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  return (
    <>
      <button
        onClick={createLinks}
        disabled={loading || !leadId}
        title="Create this client's links to the live AI video call"
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
        {loading ? '⏳' : '🤖 AI Invitation'}
      </button>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, zIndex: 9700, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div style={{ width: '100%', maxWidth: '560px', background: '#0a0f1e', border: `1px solid ${GOLD}55`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.85)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 AI Invitation</div>
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
                    Send whichever one you like to {clientName || 'the client'}. Each opens a live video call with that assistant, who already knows their name and state, and lands the conversation back on this card.
                  </div>

                  {links.map((row) => (
                    <div key={row.key} style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px 12px' }}>
                      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>{row.name}</div>
                      <input
                        readOnly
                        value={row.url}
                        onFocus={(e) => e.target.select()}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button onClick={() => copy(row)} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '7px 16px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          {copiedKey === row.key ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <a href={row.url} target="_blank" rel="noreferrer" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '7px 14px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none' }}>
                          Open
                        </a>
                      </div>
                    </div>
                  ))}

                  <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px', lineHeight: 1.6 }}>
                    Same links every time for this client, so the invitation in an email always reaches the same call.
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