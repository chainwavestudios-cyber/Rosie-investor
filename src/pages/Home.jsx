import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';

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
    <div style={{ minHeight: '100vh', background: '#060c18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ background: '#0a0f1e', border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '32px 24px', maxWidth: '400px', width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png" alt="Rosie AI" style={{ height: '48px', marginBottom: '20px' }} />
          <p style={{ color: '#b8933a', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', margin: '0 0 8px' }}>Restricted Access</p>
          <h2 style={{ color: '#e8e0d0', fontSize: '20px', fontWeight: 'normal', margin: 0 }}>{checking ? 'Verifying access…' : 'Enter Your Access Code'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            placeholder="Your personal access code"
            autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '2px', padding: '12px 16px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', marginBottom: '12px' }}
          />
          {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}
          <button type="submit" style={{ width: '100%', background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: '#0a0f1e', border: 'none', borderRadius: '2px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'Georgia, serif' }}>
            {checking ? 'Checking…' : 'Access Investor Site'}
          </button>
        </form>
      </div>
    </div>
  );
}