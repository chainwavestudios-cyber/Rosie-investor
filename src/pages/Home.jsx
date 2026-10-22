import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import SarahQualifySection from '@/components/sarah/SarahQualifySection';
import HomeHeader from '@/components/home/HomeHeader';
import HomeStepper from '@/components/home/HomeStepper';
import DebtAmountStep from '@/components/home/DebtAmountStep';
import HomeTrust from '@/components/home/HomeTrust';

const APP_BASE_URL = window.location.origin;

const ADMIN_PASSWORD = "rosieai@2026";
const SESSION_KEY = "home_access_granted";
const SESSION_USER_KEY = "home_access_user";

export default function Home() {
  const navigate = useNavigate();
  const [unlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  // If already unlocked, go straight to investor page
  useEffect(() => {
    if (unlocked) {
      navigate('/investor-page', { replace: true });
    }
  }, []);

  // On mount — check URL for ?code=username or ?username=username
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('username');
    if (code && !unlocked) {
      autoUnlockWithCode(code.trim().toLowerCase());
    }
  }, []);

  const autoUnlockWithCode = async (code) => {
    setChecking(true);
    setError('');

    try {
      const resp = await fetch(`${APP_BASE_URL}/functions/validateAccessCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await resp.json();

      if (!result?.valid) {
        setError('Access code not recognised. Please enter your code below.');
        setChecking(false);
        return;
      }

      sessionStorage.setItem(SESSION_KEY, 'true');
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify({
        username: code,
        name:     result.name  || '',
        email:    result.email || '',
        id:       result.id    || '',
        leadId:   result.leadId || '',
        type:     result.type  || 'lead',
      }));

      // Fire-and-forget SiteVisit
      base44.entities.SiteVisit.create({
        passcode:   code,
        leadId:     result.leadId || '',
        investorId: result.type === 'investor' ? result.id : '',
        leadName:   result.name  || code,
        page:       '/',
        referrer:   'email_link',
        timeOnPage: 0,
        sessionId:  `home-${Date.now()}`,
        siteType:   'investor',
        visitedAt:  new Date().toISOString(),
      }).catch(() => {});

      navigate('/investor-page', { replace: true });

    } catch (e) {
      console.error('[Home] validateAccessCode error:', e);
      setError('Could not verify access code. Please try again.');
      setChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    if (val === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      navigate('/investor-page', { replace: true });
      return;
    }
    setInput('');
    await autoUnlockWithCode(val.toLowerCase());
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f7ff', fontFamily: "'DM Sans', sans-serif" }}>
      <HomeHeader />

      <main style={{ width: '100%', maxWidth: '960px', margin: '0 auto', padding: '32px 16px 64px', boxSizing: 'border-box' }}>
        <HomeStepper activeIndex={0} />

        <DebtAmountStep />

        <div id="qualify" style={{ scrollMarginTop: '20px', marginTop: '44px', background: '#0b1220', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '20px', padding: '28px 20px', display: 'flex', justifyContent: 'center' }}>
          <SarahQualifySection />
        </div>

        <HomeTrust />

        <section style={{ maxWidth: '620px', margin: '44px auto 0', background: '#ffffff', border: '1px solid #d7e6f5', borderRadius: '14px', padding: '24px 22px', boxSizing: 'border-box' }}>
          <p style={{ color: '#0ea5e9', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700, textAlign: 'center' }}>
            Investor Access
          </p>
          <h2 style={{ color: '#003366', fontSize: '18px', fontWeight: 700, margin: '0 0 16px', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
            Already have an access code?
          </h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              placeholder="Your personal access code"
              style={{ width: '100%', background: '#f8fbff', border: '1px solid #cfdff0', borderRadius: '8px', padding: '13px 16px', color: '#0f172a', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", marginBottom: '10px' }}
            />
            {error && <p style={{ color: '#b91c1c', fontSize: '12px', margin: '0 0 10px', textAlign: 'center' }}>{error}</p>}
            <button type="submit" style={{ width: '100%', background: '#003366', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '13px', cursor: 'pointer', fontWeight: 700, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
              {checking ? 'Checking…' : 'Access Investor Site'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}