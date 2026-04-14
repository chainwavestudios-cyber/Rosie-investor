import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const HTML_URL = "https://raw.githubusercontent.com/chainwavestudios-cyber/Rosie-investor/main/agentbman-pitchbook-v3.html";

export default function Home() {
  const navigate = useNavigate();
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    fetch(HTML_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.text())
      .then(setHtmlContent);
  }, []);

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