export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '40px 24px', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '48px 48px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b8933a', marginBottom: '4px' }}>Rosie AI</div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px' }}>Privacy Policy</h1>
          <p style={{ color: '#6b7280', fontSize: '13px' }}>Last updated: May 17, 2026</p>
        </div>

        <div style={{ color: '#374151', fontSize: '15px', lineHeight: 1.8 }}>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>1. Information We Collect</h2>
          <p>Rosie AI ("Company," "we," "us") collects the following information when you opt in to receive SMS communications:</p>
          <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
            <li>Your name</li>
            <li>Your mobile phone number</li>
            <li>Date and time of opt-in</li>
            <li>IP address at time of opt-in</li>
          </ul>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>2. How We Use Your Information</h2>
          <p>We use your information solely to:</p>
          <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
            <li>Send you investment updates, announcements, and communications you have opted in to receive</li>
            <li>Respond to your replies and requests for assistance</li>
            <li>Maintain records of consent in compliance with applicable regulations</li>
          </ul>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>3. Data Sharing</h2>
          <p>
            <strong>We do not sell, rent, or share your personal information or phone number with third parties for marketing purposes.</strong> Your information is not shared with any outside organizations except as required by law or as necessary to deliver SMS services (e.g., our SMS platform provider, Twilio, Inc., solely for the purpose of message transmission).
          </p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>4. SMS Communications</h2>
          <p>By opting in, you consent to receive recurring automated text messages from Rosie AI. Message and data rates may apply. Message frequency varies based on investment activity and announcements.</p>
          <p style={{ marginTop: '10px' }}>
            To opt out at any time, reply <strong>STOP</strong> to any message. You will receive a final confirmation and no further messages will be sent. To request help, reply <strong>HELP</strong> or contact us at the information below.
          </p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>5. Data Retention</h2>
          <p>We retain your opt-in records and associated data for as long as necessary to comply with legal obligations and to maintain accurate consent records. You may request deletion of your data at any time by contacting us.</p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>6. Security</h2>
          <p>We implement industry-standard measures to protect your personal information from unauthorized access, disclosure, or misuse.</p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
            <li>Opt out of SMS messages at any time by replying <strong>STOP</strong></li>
            <li>Request access to the personal data we hold about you</li>
            <li>Request deletion of your personal data</li>
          </ul>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>8. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px', marginTop: '12px', fontSize: '14px' }}>
            <strong>Rosie AI</strong><br />
            Website: <a href="https://investors.rosieai.tech" style={{ color: '#b8933a' }}>investors.rosieai.tech</a><br />
            SMS: Reply <strong>HELP</strong> to any message
          </div>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '16px', fontSize: '13px' }}>
          <a href="/optin" style={{ color: '#b8933a' }}>← SMS Opt-In</a>
          <a href="/terms" style={{ color: '#b8933a' }}>Terms &amp; Conditions →</a>
        </div>
      </div>
    </div>
  );
}