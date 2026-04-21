import React, { createContext, useContext, useState, useEffect } from 'react';

const PortalAuthContext = createContext();
const SESSION_KEY = 'rosie_portal_auth';

// Hardcoded admin base profile
const ADMIN_USER = {
  username: 'admin',
  name: 'Admin',
  email: 'admin@rosieai.com',
  role: 'admin',
  company: 'Rosie AI LLC',
};
const ADMIN_PASSWORD_DEFAULT = 'password';
const ADMIN_CREDS_KEY = 'rosie_admin_creds';

// Load admin creds from localStorage (persists across reloads)
const getAdminCreds = () => {
  try {
    const saved = localStorage.getItem(ADMIN_CREDS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { username: 'admin', password: ADMIN_PASSWORD_DEFAULT };
};

const saveAdminCreds = (creds) => {
  localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify(creds));
};

export const PortalAuthProvider = ({ children }) => {
  const [portalUser, setPortalUser]   = useState(null);
  const [isPortalLoading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on page load
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        setPortalUser(JSON.parse(saved));
      }
    } catch {}
    setLoading(false);
  }, []);

  const portalLogin = async (usernameOrEmail, password) => {
    const u = (usernameOrEmail || '').toLowerCase().trim();

    // Admin check — credentials stored in localStorage
    const adminCreds = getAdminCreds();
    if ((u === adminCreds.username || u === 'admin@rosieai.com') && password === adminCreds.password) {
      setPortalUser(ADMIN_USER);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(ADMIN_USER));
      // Fire analytics in background — don't let it block login
      try {
        const { analytics } = await import('./analytics');
        analytics.startSession(ADMIN_USER.email, ADMIN_USER.name, ADMIN_USER.username);
      } catch {}
      return { success: true, user: ADMIN_USER };
    }

    // Investor users — from Base44
    try {
      const { InvestorUser } = await import('@/api/entities');
      const user = await InvestorUser.findByCredentials(usernameOrEmail, password);
      if (!user) return { success: false, error: 'Invalid username or password' };
      const { password: _, ...safeUser } = user;
      setPortalUser(safeUser);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
      try {
        const { analytics } = await import('./analytics');
        analytics.startSession(safeUser.email, safeUser.name, safeUser.username);
      } catch {}
      return { success: true, user: safeUser };
    } catch (e) {
      console.error('[PortalAuth] login error:', e);
      return { success: false, error: 'Login failed — please try again' };
    }
  };

  const portalLogout = () => {
    try {
      import('./analytics').then(({ analytics }) => analytics.endSession()).catch(() => {});
    } catch {}
    setPortalUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const addUser = async (userData) => {
    try {
      const { InvestorUser } = await import('@/api/entities');
      const existing = await InvestorUser.findByUsername(userData.username);
      if (existing) return { success: false, error: 'Username already taken' };
      if (userData.email) {
        const existingEmail = await InvestorUser.findByEmail(userData.email);
        if (existingEmail) return { success: false, error: 'Email already in use' };
      }
      await InvestorUser.create({ ...userData, role: userData.role || 'investor' });
      return { success: true };
    } catch (e) {
      console.error('[PortalAuth] addUser:', e);
      return { success: false, error: 'Failed to create user' };
    }
  };

  const removeUser = async (identifier) => {
    try {
      const { InvestorUser } = await import('@/api/entities');
      let user = await InvestorUser.findByUsername(identifier);
      if (!user) user = await InvestorUser.findByEmail(identifier);
      if (user?.id) await InvestorUser.delete(user.id);
    } catch (e) {
      console.error('[PortalAuth] removeUser:', e);
    }
  };

  const getAllUsers = async () => {
    try {
      const { InvestorUser } = await import('@/api/entities');
      const users = await InvestorUser.list();
      return users.map(({ password: _, ...u }) => u);
    } catch (e) {
      console.error('[PortalAuth] getAllUsers:', e);
      return [];
    }
  };

  const updateUser = async (identifier, updates) => {
    try {
      const { InvestorUser } = await import('@/api/entities');
      let user = await InvestorUser.findByUsername(identifier);
      if (!user) user = await InvestorUser.findByEmail(identifier);
      if (!user?.id) return { success: false, error: 'User not found' };
      await InvestorUser.update(user.id, updates);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Update failed' };
    }
  };

  const changeAdminPassword = (currentPassword, newPassword) => {
    const creds = getAdminCreds();
    if (currentPassword !== creds.password) {
      return { success: false, error: 'Current password is incorrect' };
    }
    saveAdminCreds({ ...creds, password: newPassword });
    return { success: true };
  };

  const changeAdminUsername = (currentPassword, newUsername) => {
    const creds = getAdminCreds();
    if (currentPassword !== creds.password) {
      return { success: false, error: 'Current password is incorrect' };
    }
    saveAdminCreds({ ...creds, username: newUsername });
    // Update session to reflect new username
    const updatedUser = { ...ADMIN_USER, username: newUsername };
    setPortalUser(updatedUser);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
    return { success: true };
  };

  return (
    <PortalAuthContext.Provider value={{
      portalUser,
      isPortalLoading,
      isAdmin: portalUser?.role === 'admin',
      portalLogin,
      portalLogout,
      addUser,
      removeUser,
      getAllUsers,
      updateUser,
      changeAdminPassword,
      changeAdminUsername,
    }}>
      {children}
    </PortalAuthContext.Provider>
  );
};

export const usePortalAuth = () => {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
};