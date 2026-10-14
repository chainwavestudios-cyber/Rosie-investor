/**
 * DebtBadge.jsx — Visual debt-type badge with amount overlay.
 * Shows the badge image (Credit Card Debt or Unsecured Personal Loans) with
 * the confirmed debt amount overlaid at the bottom of the badge.
 */
import React from 'react';

const BADGE_IMAGES = {
  'Unsecured Credit Card': 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/0e275c1ab_Untitleddesign21.png',
  'Unsecured Loans': 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/64572592b_Untitleddesign22.png',
};

export default function DebtBadge({ debtType, amount, size = 80 }) {
  const img = BADGE_IMAGES[debtType];
  if (!img) return null;

  const formatted = amount != null && amount !== ''
    ? `$${Number(amount).toLocaleString()}`
    : '';

  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
      <img src={img} alt={debtType} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {formatted && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          padding: '4px 6px 6px',
          textAlign: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: Math.max(10, size * 0.14) + 'px', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.9)', fontFamily: 'sans-serif' }}>
            {formatted}
          </span>
        </div>
      )}
    </div>
  );
}