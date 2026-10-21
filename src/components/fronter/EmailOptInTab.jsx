/**
 * EmailOptInTab — dedicated admin tab for the email consent system.
 * Holds everything in one place: the public opt-in form link, the verbal
 * opt-in logging, the Mailjet list subscription, and the full searchable
 * roster of opted-in contacts (see EmailOptInPanel).
 */
import EmailOptInPanel from './EmailOptInPanel';

const GOLD = '#10b981';
const BLUE = '#60a5fa';

export default function EmailOptInTab({ username }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', marginBottom: '6px' }}>✉️ Email Opt-In</div>
      <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
        Every recorded email consent lives here — who opted in, how, when, for whom it was logged, and whether they are on the “Debt Solutions” email list in Mailjet.
        <br />• <span style={{ color: BLUE }}>Public form</span> — copy the link and send it, or use it in an email; a submission is the recorded consent (single opt-in).
        <br />• <span style={{ color: BLUE }}>Verbal opt-ins</span> — logged from vault lists and lead records, marked confirmed.
        <br />• <span style={{ color: BLUE }}>Email list</span> — “Subscribe All To Email List” pushes every confirmed contact to Mailjet; anything not yet on the list is flagged in the roster.
      </div>

      <EmailOptInPanel username={username} />
    </div>
  );
}