import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const HTML_URL = "https://raw.githubusercontent.com/chainwavestudios-cyber/Rosie-investor/main/agentbman-pitchbook-v4%20(1).html";
const ACCESS_PASSWORD = "rosieai@2026";
const SESSION_KEY = "home_access_granted";

export default function Home() {
  const navigate = useNavigate();
  const [htmlContent, setHtmlContent] = useState('');
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!unlocked) return;
    fetch(HTML_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.text())
      .then(setHtmlContent);
  }, [unlocked]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === ACCESS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setUnlocked(true);
    } else {
      setError('Incorrect password. Please try again.');
      setInput('');
    }
  };

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', background: '#060c18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
        <div style={{ background: '#0a0f1e', border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '48px', maxWidth: '400px', width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png" alt="Rosie AI" style={{ height: '48px', marginBottom: '20px' }} />
            <p style={{ color: '#b8933a', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', margin: '0 0 8px' }}>Restricted Access</p>
            <h2 style={{ color: '#e8e0d0', fontSize: '20px', fontWeight: 'normal', margin: 0 }}>Enter Access Password</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              placeholder="Password"
              autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '2px', padding: '12px 16px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', marginBottom: '12px' }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}
            <button type="submit" style={{ width: '100%', background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: '#0a0f1e', border: 'none', borderRadius: '2px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'Georgia, serif' }}>
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen" style={{ position: 'relative' }}>
      <iframe srcDoc={htmlContent} className="w-full h-full border-0" title="Rosie Pitchbook" />
      <button
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
      </button>
    </div>
  );
}