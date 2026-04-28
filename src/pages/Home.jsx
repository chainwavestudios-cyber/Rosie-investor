import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';

const HTML_URL = "https://raw.githubusercontent.com/chainwavestudios-cyber/Rosie-investor/main/agentbman-pitchbook-v4%20(3).html";
const ADMIN_PASSWORD = "rosieai@2026";
const SESSION_KEY = "home_access_granted";
const SESSION_USER_KEY = "home_access_user";

export default function Home() {
  const navigate = useNavigate();
  const [htmlContent, setHtmlContent] = useState('');
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [checking, setChecking] = useState(false);

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

    let result = null;

    // ── STEP 1: Try server-side function via SDK ───────────────────────
    try {
      const fnResult = await base44.functions.invoke('validateAccessCode', { code });
      console.log('[Home] validateAccessCode server result:', fnResult);
      // SDK may return the data directly or wrapped — handle both
      result = fnResult?.valid !== undefined ? fnResult : fnResult?.data || fnResult;
    } catch (fnErr) {
      console.warn('[Home] server function failed:', fnErr?.message || fnErr);
    }

    // ── STEP 2: Client-side fallbacks if server function didn't work ──
    if (!result?.valid) {
      console.log('[Home] Trying client-side fallbacks for code:', code);

      // 2a. InvestorUser.siteAccessCode
      try {
        const rows = await base44.entities.InvestorUser.filter({ siteAccessCode: code });
        console.log('[Home] siteAccessCode filter result:', rows?.length);
        if (rows?.length > 0) {
          const u = rows[0];
          result = { valid: true, type: 'investor', name: u.name, email: u.email, id: u.id, leadId: u.leadId || null };
        }
      } catch (e) { console.warn('[Home] siteAccessCode filter failed:', e?.message); }

      // 2b. InvestorUser.username
      if (!result?.valid) {
        try {
          const rows = await base44.entities.InvestorUser.filter({ username: code });
          console.log('[Home] username filter result:', rows?.length);
          if (rows?.length > 0) {
            const u = rows[0];
            result = { valid: true, type: 'investor', name: u.name, email: u.email, id: u.id, leadId: u.leadId || null };
          }
        } catch (e) { console.warn('[Home] username filter failed:', e?.message); }
      }

      // 2c. Lead.portalPasscode direct filter
      if (!result?.valid) {
        try {
          const rows = await base44.entities.Lead.filter({ portalPasscode: code });
          console.log('[Home] portalPasscode filter result:', rows?.length);
          if (rows?.length > 0) {
            const l = rows[0];
            result = { valid: true, type: 'lead', name: `${l.firstName || ''} ${l.lastName || ''}`.trim(), email: l.email || '', id: l.id, leadId: l.id };
          }
        } catch (e) { console.warn('[Home] portalPasscode filter failed:', e?.message); }
      }

      // 2d. In-memory lead scan — last resort
      if (!result?.valid) {
        try {
          const allLeads = await base44.entities.Lead.list('-created_date', 500);
          console.log('[Home] scanning', allLeads?.length, 'leads in memory for code:', code);
          const match = (allLeads || []).find(l => (l.portalPasscode || '').trim().toLowerCase() === code);
          if (match) {
            console.log('[Home] Found match via in-memory scan:', match.firstName, match.lastName);
            result = { valid: true, type: 'lead', name: `${match.firstName || ''} ${match.lastName || ''}`.trim(), email: match.email || '', id: match.id, leadId: match.id };
          } else {
            console.warn('[Home] No match found in', allLeads?.length, 'leads. Sample passcodes:', (allLeads || []).slice(0, 5).map(l => l.portalPasscode));
          }
        } catch (e) { console.warn('[Home] in-memory scan failed:', e?.message); }
      }
    }

    // ── STEP 3: Grant access or show error ────────────────────────────
    if (!result?.valid) {
      console.warn('[Home] All strategies exhausted — code not found:', code);
      setError('Access code not recognised. Please enter your code below.');
      setChecking(false);
      return;
    }

    console.log('[Home] Access granted for:', code, result);
    sessionStorage.setItem(SESSION_KEY, 'true');
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify({
      username:  code,
      name:      result.name  || '',
      email:     result.email || '',
      id:        result.id    || '',
      leadId:    result.leadId || '',
      type:      result.type  || 'lead',
    }));
    setChecking(false);
    setUnlocked(true);
    window.history.replaceState({}, '', '/');

    // ── Fire-and-forget SiteVisit ─────────────────────────────────────
    try {
      await base44.entities.SiteVisit.create({
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
      });
    } catch (e) { console.warn('[Home] SiteVisit create failed (non-blocking):', e?.message); }
  };

  useEffect(() => {
    if (!unlocked) return;
    setLoadingHtml(true);
    fetch(HTML_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.text())
      .then(html => { setHtmlContent(html); setLoadingHtml(false); })
      .catch(() => setLoadingHtml(false));
  }, [unlocked]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    // Admin password
    if (val === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setUnlocked(true);
      return;
    }
    // Try as a username access code (server-side validation)
    setInput('');
    await autoUnlockWithCode(val.toLowerCase());
  };

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', background: '#060c18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
        <div style={{ background: '#0a0f1e', border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '48px', maxWidth: '400px', width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
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

  return (
    <div className="w-full h-screen" style={{ position: 'relative', background: '#060c18' }}>
      {loadingHtml && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060c18', zIndex: 10 }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(184,147,58,0.2)', borderTop: '3px solid #b8933a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {htmlContent && <iframe srcDoc={htmlContent} className="w-full h-full border-0" title="Rosie Pitchbook" style={{ display: loadingHtml ? 'none' : 'block' }} />}
      {!loadingHtml && htmlContent && <button
        onClick={() => navigate('/portal-login')}
        style={{
          position: 'fixed', bottom: '32px', left: '32px',
          background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
          color: '#0a0f1e', border: 'none', borderRadius: '2px',
          padding: '10px 22px', cursor: 'pointer',
          fontSize: '11px', fontWeight: '700', letterSpacing: '2px',
          textTransform: 'uppercase', fontFamily: 'Georgia, serif',
          zIndex: 9999, boxShadow: '0 4px 20px rgba(184,147,58,0.4)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        🔐 Investor Data Portal
      </button>}
    </div>
  );
}