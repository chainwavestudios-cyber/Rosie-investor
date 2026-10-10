import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import VoiceLoginPanel from '@/components/debt/VoiceLoginPanel';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px 16px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function DebtCoachLogin() {
  const { login, voiceLogin, enrollVoice, resetMyPassword, isAuthenticated, mustResetPassword, user } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'voice' | 'enroll'

  useEffect(() => {
    if (isAuthenticated && !mustResetPassword) navigate(user?.role === 'fronter' ? '/fronter' : '/debt-call-coach', { replace: true });
    if (isAuthenticated && mustResetPassword) setShowReset(true);
  }, [isAuthenticated, mustResetPassword, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.mustResetPassword) {
        setShowReset(true);
      } else {
        navigate(res.user?.role === 'fronter' ? '/fronter' : '/debt-call-coach', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleVoiceLogin = async (voiceUsername, audioBase64, phrase) => {
    const res = await voiceLogin(voiceUsername, audioBase64, phrase);
    if (res.mustResetPassword) {
      setShowReset(true);
    } else {
      navigate(res.user?.role === 'fronter' ? '/fronter' : '/debt-call-coach', { replace: true });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await resetMyPassword(newPassword);
      // mustResetPassword flips to false in context → useEffect navigates to the right page
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/cad8ccab3_UntitledOvalStickerLandscape.png" alt="Settlement IQ — Realtime Call Intelligence" style={{ width: '220px', height: 'auto', objectFit: 'contain', marginBottom: '10px' }} />
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '10px' }}>Sign in to your account</div>
        </div>

        {showReset ? (
          <form onSubmit={handleResetPassword} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '28px' }}>
            <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>🔑 Set Your New Password</div>
            <div style={{ color: '#8a9ab8', fontSize: '12px', marginBottom: '20px' }}>This is your first login. Please set a new password to continue.</div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" style={inp} autoFocus />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" style={inp} />
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>⚠ {error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '28px' }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '4px' }}>
              <button onClick={() => { setLoginMode('password'); setError(''); }} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', background: loginMode === 'password' ? `${GOLD}18` : 'transparent', color: loginMode === 'password' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🔑 Password</button>
              <button onClick={() => { setLoginMode('voice'); setError(''); }} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', background: loginMode === 'voice' ? `${GOLD}18` : 'transparent', color: loginMode === 'voice' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🎙️ Voice</button>
              <button onClick={() => { setLoginMode('enroll'); setError(''); }} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', background: loginMode === 'enroll' ? `${GOLD}18` : 'transparent', color: loginMode === 'enroll' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📝 Enroll</button>
            </div>

            {loginMode === 'password' && (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" style={inp} autoFocus />
                </div>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" style={inp} />
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>⚠ {error}</div>}
                <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: loading ? 0.5 : 1 }}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            )}

            {loginMode === 'voice' && (
              <>
                {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>⚠ {error}</div>}
                <VoiceLoginPanel mode="login" onLogin={handleVoiceLogin} onEnroll={enrollVoice} />
              </>
            )}

            {loginMode === 'enroll' && (
              <>
                {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>⚠ {error}</div>}
                <VoiceLoginPanel mode="enroll" onLogin={handleVoiceLogin} onEnroll={enrollVoice} />
              </>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <div style={{ color: '#4a5568', fontSize: '11px' }}>Default password for new accounts: Debt@2026!!</div>
        </div>
      </div>
    </div>
  );
}