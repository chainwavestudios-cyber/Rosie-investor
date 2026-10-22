/**
 * VideoReviewEmailCard.jsx — The marketing email itself: its label, subject and
 * a preview of the exact HTML that goes out, so it can be checked before sending.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const AMBER = '#f59e0b';

export default function VideoReviewEmailCard({ template }) {
  const [preview, setPreview] = useState(false);

  if (!template) {
    return (
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '14px 16px', color: AMBER, fontSize: '12px' }}>
        The Stephani video-review email is not set up yet. Add it in the 📧 Emails tab with the label “Stephani Video Review”.
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>🎥 {template.label}</div>
          <div style={{ color: '#e8e0d0', fontSize: '12px', marginTop: '4px' }}>Subject: {template.subject || '(no subject)'}</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
            Sends the contact to the live video review with Stephani. Opens and link clicks are tracked on the contact card.
          </div>
        </div>
        <button
          onClick={() => setPreview(p => !p)}
          style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}
        >
          {preview ? '▾ Hide email' : '👁 Preview email'}
        </button>
      </div>

      {preview && (
        <div
          style={{ marginTop: '14px', background: '#ffffff', borderRadius: '4px', maxHeight: '520px', overflow: 'auto' }}
          dangerouslySetInnerHTML={{ __html: template.body || '<p style="padding:20px;color:#333;font-family:sans-serif">This email has no body yet.</p>' }}
        />
      )}
    </div>
  );
}