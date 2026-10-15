/**
 * emailSignature.ts — Chris Bongiorno's email signature HTML.
 * Used in appointment reminder emails sent via Gmail.
 * The signature image goes between the fax line and the confidentiality notice.
 */

const SIGNATURE_IMAGE_URL = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/5e39b3d40_Screenshot2026-10-14at92451PM.png';

export function getEmailSignature(): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#333;font-size:14px;line-height:1.5;">
  <p style="margin:0 0 12px 0;">
    <strong style="font-size:16px;">Chris Bongiorno</strong><br>
    Senior Certified Debt Specialist<br>
    Christian.B@contactdaa.com<br>
    Office &amp; Text (619) 353-0919<br>
    Fax (833) 705-9290
  </p>
  <img src="${SIGNATURE_IMAGE_URL}" alt="Debt Advisors of America" style="max-width:500px;width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
  <p style="font-size:10px;color:#888;margin:12px 0 0 0;line-height:1.4;">
    <strong>CONFIDENTIALITY NOTICE:</strong> This e-mail message is for the sole use of the intended recipient(s) and may contain confidential and privileged information. Any unauthorized review, use, disclosure or distribution of any kind is strictly prohibited. If you are not the intended recipient, please contact the sender via reply email and destroy all copies of the original message. Thank you.<br><br>
    <strong>IRS REQUIRED DISCLOSURE:</strong> The IRS requires us to inform you that any federal tax advice in this email and any attached documents is not intended or written to be used, and cannot be used, (1) for the purpose of avoiding federal tax penalties or (2) promoting, marketing or recommending any transaction discussed in this communication to another person unless we expressly indicate otherwise.
  </p>
</div>`;
}