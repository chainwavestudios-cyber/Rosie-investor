export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '40px 24px', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '48px 48px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b8933a', marginBottom: '4px' }}>NB Tech Acquisitions</div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px' }}>SMS Terms &amp; Conditions</h1>
          <p style={{ color: '#6b7280', fontSize: '13px' }}>Last updated: May 17, 2026</p>
        </div>

        <div style={{ color: '#374151', fontSize: '15px', lineHeight: 1.8 }}>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '0', marginBottom: '10px' }}>Program Description</h2>
          <p>
            NB Tech Acquisitions operates an SMS messaging program to deliver investment updates, announcements, and important communications to opted-in subscribers. By opting in, you agree to receive recurring automated text messages from NB Tech Acquisitions.
          </p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>How to Opt In</h2>
          <p>You may opt in to receive SMS messages by:</p>
          <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
            <li>Visiting <a href="https://investors.rosieai.tech/optin" style={{ color: '#b8933a' }}>investors.rosieai.tech/optin</a> and submitting the opt-in form with your mobile phone number</li>
            <li>Texting <strong>START</strong> to our designated SMS number</li>
          </ul>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>Message Frequency</h2>
          <p>Message frequency varies. You may receive messages related to investment updates, offering announcements, milestone notifications, and other important investor communications. Frequency depends on investment activity and company announcements.</p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>Message &amp; Data Rates</h2>
          <p>Message and data rates may apply. These charges are billed by and payable to your mobile carrier. NB Tech Acquisitions is not responsible for any charges imposed by your carrier.</p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>How to Opt Out — <strong>STOP</strong></h2>
          <p>
            You may opt out of receiving SMS messages at any time by replying <strong>STOP</strong> to any message from us. After opting out, you will receive a single confirmation message and no further messages will be sent unless you opt in again.
          </p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>How to Get Help — <strong>HELP</strong></h2>
          <p>
            For assistance, reply <strong>HELP</strong> to any message. You may also visit <a href="https://investors.rosieai.tech" style={{ color: '#b8933a' }}>investors.rosieai.tech</a> for additional support.
          </p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>Supported Carriers</h2>
          <p>Compatible with all major US carriers including AT&amp;T, T-Mobile, Verizon, Sprint, and others. Carrier support may vary.</p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>Privacy</h2>
          <p>
            We do not sell, rent, or share your phone number or personal information with third parties for marketing purposes. For full details, see our <a href="/privacy" style={{ color: '#b8933a' }}>Privacy Policy</a>.
          </p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>Limitation of Liability</h2>
          <p>NB Tech Acquisitions is not liable for any delays or failures in the receipt of any SMS messages. Delivery is subject to effective transmission from your network operator.</p>

          <h2 style={{ color: '#1a1a2e', fontSize: '18px', marginTop: '32px', marginBottom: '10px' }}>Contact Information</h2>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px', marginTop: '12px', fontSize: '14px' }}>
            <strong>NB Tech Acquisitions</strong><br />
            Website: <a href="https://investors.rosieai.tech" style={{ color: '#b8933a' }}>investors.rosieai.tech</a><br />
            SMS Help: Reply <strong>HELP</strong> to any message<br />
            SMS Opt-Out: Reply <strong>STOP</strong> to any message
          </div>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '16px', fontSize: '13px' }}>
          <a href="/optin" style={{ color: '#b8933a' }}>← SMS Opt-In</a>
          <a href="/privacy" style={{ color: '#b8933a' }}>Privacy Policy →</a>
        </div>
      </div>
    </div>
  );
}