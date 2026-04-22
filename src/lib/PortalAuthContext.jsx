import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadPortalSettings, savePortalSettings } from './portalSettings';

const PortalAuthContext = createContext();
const SESSION_KEY = 'rosie_portal_auth';

const ADMIN_USER = {
  username: 'admin',
  name: 'Admin',
  email: 'admin@rosieai.com',
  role: 'admin',
  company: 'Rosie AI LLC',
};

const ADMIN_PASSWORD_DEFAULT = 'password';
const ADMIN_USERNAME_DEFAULT = 'admin';

export const PortalAuthProvider = ({ children }) => {
  const [portalUser, setPortalUser]   = useState(null);
  const [isPortalLoading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) setPortalUser(JSON.parse(saved));
    } catch {}
    setLoading(false);
  }, []);

  // Load admin creds from DB (PortalSettings)
  const getAdminCreds = async () => {
    try {
      const settings = await loadPortalSettings();
      return {
        username: settings.adminUsername || ADMIN_USERNAME_DEFAULT,
        password: settings.adminPassword || ADMIN_PASSWORD_DEFAULT,
      };
    } catch {
      return { username: ADMIN_USERNAME_DEFAULT, password: ADMIN_PASSWORD_DEFAULT };
    }
  };

  const portalLogin = async (usernameOrEmail, password) => {
    const u = (usernameOrEmail || '').toLowerCase().trim();

    // Admin check — credentials stored in DB via PortalSettings
    const adminCreds = await getAdminCreds();
    const adminUsername = (adminCreds.username || ADMIN_USERNAME_DEFAULT).toLowerCase();
    if ((u === adminUsername || u === 'admin@rosieai.com') && password === adminCreds.password) {
      const adminUserWithUsername = { ...ADMIN_USER, username: adminCreds.username || ADMIN_USERNAME_DEFAULT };
      setPortalUser(adminUserWithUsername);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(adminUserWithUsername));
      try {
        const { analytics } = await import('./analytics');
        analytics.startSession(adminUserWithUsername.email, adminUserWithUsername.name, adminUserWithUsername.username);
      } catch {}
      return { success: true, user: adminUserWithUsername };
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
      console.error('[PortalAuth] addUser error:', e);
      return { success: false, error: e?.response?.data?.error || e?.message || 'Failed to create user' };
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

  // Store admin password in DB so it works across all devices
  const changeAdminPassword = async (currentPassword, newPassword) => {
    const creds = await getAdminCreds();
    if (currentPassword !== creds.password) {
      return { success: false, error: 'Current password is incorrect' };
    }
    try {
      await savePortalSettings({ adminPassword: newPassword });
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to save: ' + e.message };
    }
  };

  const changeAdminUsername = async (currentPassword, newUsername) => {
    const creds = await getAdminCreds();
    if (currentPassword !== creds.password) {
      return { success: false, error: 'Current password is incorrect' };
    }
    try {
      await savePortalSettings({ adminUsername: newUsername });
      const updatedUser = { ...ADMIN_USER, username: newUsername };
      setPortalUser(updatedUser);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to save: ' + e.message };
    }
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