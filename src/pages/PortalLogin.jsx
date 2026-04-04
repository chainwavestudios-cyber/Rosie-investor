import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";

export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { portalLogin } = usePortalAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    await new Promise(r => setTimeout(r, 600));
    const result = portalLogin(email, password);
    setLoading(false);
    
    if (result.success) {
      if (result.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/portal');
      }
    } else {
      setError(result.error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #0a1628 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Georgia", serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(180, 140, 60, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(180, 140, 60, 0.06) 0%, transparent 40%)',
      }} />
      
      {/* Decorative lines */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent, #b8933a, transparent)',
      }} />

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '440px',
        padding: '0 20px',
      }}>
        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(184, 147, 58, 0.25)',
          borderRadius: '2px',
          padding: '48px 44px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <img src={LOGO_URL} alt="Rosie AI" style={{ height: '52px', width: 'auto', objectFit: 'contain' }} />
            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(184, 147, 58, 0.2)', paddingTop: '20px' }}>
              <p style={{ color: '#b8933a', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', margin: 0 }}>
                Investor Data Portal
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', color: '#8a9ab8', fontSize: '10px',
                letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px'
              }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px',
                  padding: '12px 16px', color: '#e8e0d0', fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(184,147,58,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                placeholder="investor@example.com"
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block', color: '#8a9ab8', fontSize: '10px',
                letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px'
              }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px',
                  padding: '12px 16px', color: '#e8e0d0', fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(184,147,58,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(220, 60, 60, 0.12)', border: '1px solid rgba(220,60,60,0.3)',
                borderRadius: '2px', padding: '12px 16px', marginBottom: '20px',
                color: '#ff8a8a', fontSize: '13px', textAlign: 'center'
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'rgba(184,147,58,0.4)' : 'linear-gradient(135deg, #b8933a, #d4aa50)',
                border: 'none', borderRadius: '2px',
                padding: '14px', color: '#0a0f1e',
                fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
                fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'Georgia, serif',
              }}
            >
              {loading ? 'Authenticating...' : 'Access Portal'}
            </button>
          </form>

          <p style={{
            textAlign: 'center', color: '#4a5568', fontSize: '11px',
            marginTop: '28px', letterSpacing: '1px'
          }}>
            Authorized investors only · Confidential
          </p>
        </div>

        <p style={{
          textAlign: 'center', color: '#2d3748', fontSize: '11px',
          marginTop: '20px', letterSpacing: '1px'
        }}>
          © 2025 Rosie AI · All Rights Reserved
        </p>
      </div>
    </div>
  );
}