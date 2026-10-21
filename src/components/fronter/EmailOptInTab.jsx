/**
 * EmailOptInTab — dedicated admin tab for the email consent system.
 * Holds everything in one place: the public opt-in form link, the verbal
 * opt-in logging, the Mailjet list subscription, and the full searchable
 * roster of opted-in contacts (see EmailOptInPanel).
 */
import EmailOptInPanel from './EmailOptInPanel';

const GOLD = '#10b981';

export default function EmailOptInTab({ username }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>✉️ Email Opt-In</div>
      <EmailOptInPanel username={username} />
    </div>
  );
}