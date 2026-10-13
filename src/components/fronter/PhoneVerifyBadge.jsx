/**
 * PhoneVerifyBadge.jsx — Shield badge for validated phone numbers.
 * Shows the Land Line or Mobile badge image based on line type.
 * Compact mode shows a small inline pill; detail mode shows the full shield image.
 */

const LANDLINE_BADGE = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/21213ca75_Untitleddesign20.png';
const MOBILE_BADGE = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/4630b1754_Untitleddesign19.png';

/**
 * @param {object} props
 * @param {boolean} props.phoneValid
 * @param {string} props.phoneLineType - mobile | landline | voip | unknown
 * @param {boolean} [props.compact] - small inline pill instead of full shield
 * @param {number} [props.size] - badge size in px (detail mode)
 */
export default function PhoneVerifyBadge({ phoneValid, phoneLineType, compact = false, size = 48 }) {
  if (!phoneValid || !phoneLineType) return null;
  if (phoneLineType === 'voip' || phoneLineType === 'unknown') return null;

  const isLandline = phoneLineType === 'landline';
  const badgeUrl = isLandline ? LANDLINE_BADGE : MOBILE_BADGE;
  const label = isLandline ? 'Verified Landline' : 'Verified Mobile';
  const color = isLandline ? '#60a5fa' : '#10b981';

  if (compact) {
    return (
      <span
        title={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          padding: '1px 6px',
          borderRadius: '8px',
          fontSize: '9px',
          fontWeight: 'bold',
          background: `${color}15`,
          color,
          border: `1px solid ${color}33`,
          whiteSpace: 'nowrap',
        }}
      >
        🛡 {isLandline ? 'Landline' : 'Mobile'}
      </span>
    );
  }

  return (
    <img
      src={badgeUrl}
      alt={label}
      title={label}
      style={{
        width: size,
        height: 'auto',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}