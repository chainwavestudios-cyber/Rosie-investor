export default function OptInScreenshot() {
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif', gap: '32px' }}>
      <div>
        <div style={{ marginBottom: '24px', color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
          Rosie AI — SMS Opt-In Screenshots · <a href="/optin" style={{ color: '#b8933a' }}>investors.rosieai.tech/optin</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '1100px', width: '100%' }}>
          
          {/* Left: Opt-In Form */}
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            <div style={{ padding: '40px 36px', fontFamily: 'Georgia, serif' }}>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#b8933a', letterSpacing: '1px', marginBottom: '6px' }}>Rosie AI</div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>SMS Updates — Opt-In</div>
              </div>
              <h2 style={{ color: '#1a1a2e', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>Receive SMS Updates</h2>
              <p style={{ color: '#4b5563', fontSize: '13px', lineHeight: 1.7, margin: '0 0 24px' }}>
                Opt in to receive investment updates, announcements, and important communications from Rosie AI via text message. Message &amp; data rates may apply.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>First Name</label>
                <div style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 14px', fontSize: '15px', color: '#9ca3af', boxSizing: 'border-box' }}>Your first name</div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mobile Phone Number</label>
                <div style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 14px', fontSize: '15px', color: '#9ca3af', boxSizing: 'border-box' }}>+1 (555) 000-0000</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #d1d5db', borderRadius: '3px', flexShrink: 0, marginTop: '2px', background: '#fff' }} />
                <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
                  I agree to receive recurring automated text messages from Rosie AI at the phone number provided. Msg &amp; data rates may apply. Msg frequency varies. Reply <strong>HELP</strong> for help or <strong>STOP</strong> to cancel at any time. See our <span style={{ color: '#b8933a' }}>Terms &amp; Conditions</span> and <span style={{ color: '#b8933a' }}>Privacy Policy</span>.
                </p>
              </div>
              <div style={{ width: '100%', background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.5px' }}>
                Opt In to SMS Updates
              </div>
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '11px', marginTop: '16px', lineHeight: 1.6 }}>
                You can also opt in by texting <strong>START</strong> to our number.<br />
                Rosie AI · investors.rosieai.tech
              </p>
            </div>
          </div>

          {/* Right: Success Confirmation */}
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            <div style={{ padding: '40px 36px', fontFamily: 'Georgia, serif', textAlign: 'center' }}>
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#b8933a', letterSpacing: '1px', marginBottom: '6px' }}>Rosie AI</div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>SMS Updates — Opt-In</div>
              </div>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
              <h2 style={{ color: '#1a1a2e', fontSize: '22px', fontWeight: 'bold', margin: '0 0 10px' }}>You're opted in!</h2>
              <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>
                You'll receive a confirmation text shortly. You can reply <strong>STOP</strong> at any time to unsubscribe, or <strong>HELP</strong> for assistance.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}