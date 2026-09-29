import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const DebtCoachAuthContext = createContext(null);
const STORAGE_KEY = 'debtCoachSession';

export function DebtCoachAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        base44.functions.invoke('debtCoachAuth', { action: 'me', sessionUserId: session.userId, sessionToken: session.token })
          .then((res) => {
            const data = res?.data || res;
            if (data?.user) {
              setUser(data.user);
              setSessionToken(session.token);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          })
          .catch(() => localStorage.removeItem(STORAGE_KEY))
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await base44.functions.invoke('debtCoachAuth', { action: 'login', username, password });
    const data = res?.data || res;
    if (data?.error) throw new Error(data.error);
    setUser(data.user);
    setSessionToken(data.sessionToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: data.user.id, token: data.sessionToken }));
    // Mark old sessions offline, then create a new DialerSession for presence tracking
    try {
      const oldSessions = await base44.entities.DialerSession.filter({ username });
      const active = (oldSessions || []).filter(s => s.status === 'logged_in' || s.status === 'on_call');
      for (const s of active) {
        await base44.entities.DialerSession.update(s.id, { status: 'offline', logoutAt: new Date().toISOString() });
      }
      await base44.entities.DialerSession.create({ username, loginAt: new Date().toISOString(), status: 'logged_in' });
    } catch {}
    return data;
  }, []);

  const logout = useCallback(async () => {
    // Update DialerSession to offline
    if (user?.username) {
      try {
        const sessions = await base44.entities.DialerSession.filter({ username: user.username });
        const active = (sessions || []).filter(s => s.status === 'logged_in' || s.status === 'on_call');
        for (const s of active) {
          await base44.entities.DialerSession.update(s.id, { status: 'offline', logoutAt: new Date().toISOString() });
        }
      } catch {}
    }
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await base44.functions.invoke('debtCoachAuth', {
      action: 'changePassword',
      sessionUserId: user?.id,
      sessionToken,
      currentPassword,
      newPassword,
    });
    const data = res?.data || res;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [user, sessionToken]);

  const permissions = (() => {
    try { return JSON.parse(user?.permissions || '{}'); } catch { return {}; }
  })();

  const value = {
    user,
    sessionToken,
    sessionUserId: user?.id,
    loading,
    login,
    logout,
    changePassword,
    isAuthenticated: !!user,
    mustResetPassword: !!user?.mustResetPassword,
    isDialer: user?.role === 'dialer',
    isManager: user?.role === 'manager',
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    // Managers have full feature access (like admins) but no user management
    canManage: user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin',
    permissions,
    can: (perm) => {
      if (!user) return false;
      if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'manager') return true;
      try {
        const perms = JSON.parse(user.permissions || '{}');
        return !!perms[perm];
      } catch { return false; }
    },
  };

  return <DebtCoachAuthContext.Provider value={value}>{children}</DebtCoachAuthContext.Provider>;
}

export function useDebtCoachAuth() {
  const ctx = useContext(DebtCoachAuthContext);
  if (!ctx) throw new Error('useDebtCoachAuth must be used within DebtCoachAuthProvider');
  return ctx;
}