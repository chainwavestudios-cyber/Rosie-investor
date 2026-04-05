import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";
const GOLD = '#b8933a';
const DARK = '#0a0f1e';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { portalLogin, isPortalLoading } = usePortalAuth();
  const navigate = useNavigate();

  if (isPortalLoading) {
    return (
      <div style={{ minHeight:'100vh', background:DARK, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:'32px', height:'32px', border:`3px solid rgba(184,147,58,0.2)`, borderTop:`3px solid ${GOLD}`, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await portalLogin(username, password);
      if (result.success) {
        if (result.user.role === 'admin') {
          navigate('/admin');
        } else {
          setError('This login is for administrators only.');
        }
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Login failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #060c18 0%, #0a0f1e 50%, #060c18 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', position: 'relative', overflow: 'hidden',
    }}>
      {/* Top gold line */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, transparent, #b8933a, transparent)' }} />
      {/* Background radial */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 50% 40%, rgba(184,147,58,0.06) 0%, transparent 60%)' }} />

      <div style={{ position:'relative', width:'100%', maxWidth:'400px', padding:'0 20px' }}>
        <div style={{
          background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(184,147,58,0.2)',
          borderRadius:'2px', padding:'44px 40px',
          boxShadow:'0 32px 80px rgba(0,0,0,0.7)',
        }}>
          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:'32px' }}>
            <img src={LOGO_URL} alt="Rosie AI" style={{ height:'44px', width:'auto' }} />
            <div style={{ marginTop:'18px', borderTop:'1px solid rgba(184,147,58,0.15)', paddingTop:'18px' }}>
              <p style={{ color:GOLD, fontSize:'9px', letterSpacing:'5px', textTransform:'uppercase', margin:0 }}>
                Admin Portal
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:'18px' }}>
              <label style={{ display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'7px' }}>
                Admin Username
              </label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                required autoComplete="username" placeholder="admin"
                style={{
                  width:'100%', background:'rgba(255,255,255,0.05)',
                  border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px',
                  padding:'11px 14px', color:'#e8e0d0', fontSize:'14px',
                  outline:'none', boxSizing:'border-box', transition:'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(184,147,58,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div style={{ marginBottom:'24px' }}>
              <label style={{ display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'7px' }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="••••••••"
                style={{
                  width:'100%', background:'rgba(255,255,255,0.05)',
                  border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px',
                  padding:'11px 14px', color:'#e8e0d0', fontSize:'14px',
                  outline:'none', boxSizing:'border-box', transition:'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(184,147,58,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {error && (
              <div style={{
                background:'rgba(220,60,60,0.1)', border:'1px solid rgba(220,60,60,0.25)',
                borderRadius:'2px', padding:'11px 14px', marginBottom:'18px',
                color:'#fca5a5', fontSize:'13px', textAlign:'center',
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width:'100%',
                background: loading ? 'rgba(184,147,58,0.3)' : 'linear-gradient(135deg, #b8933a, #d4aa50)',
                border:'none', borderRadius:'2px', padding:'13px',
                color: DARK, fontSize:'11px', letterSpacing:'3px',
                textTransform:'uppercase', fontWeight:'700',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily:'Georgia, serif',
              }}
            >
              {loading ? 'Authenticating…' : 'Enter Admin'}
            </button>
          </form>

          <p style={{ textAlign:'center', color:'#2d3748', fontSize:'11px', marginTop:'24px', letterSpacing:'1px' }}>
            Admin access only · Rosie AI LLC
          </p>
        </div>

        <div style={{ textAlign:'center', marginTop:'16px' }}>
          <a href="/portal-login" style={{ color:'#3a4a5e', fontSize:'11px', textDecoration:'none' }}>
            ← Investor Portal Login
          </a>
        </div>
      </div>
    </div>
  );
}