/**
 * Portal Auth Context — Base44 Backend
 * User accounts stored in entities.InvestorUser
 * Session identity kept in sessionStorage (cleared on tab close)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import analytics from './analytics';
import { InvestorUser } from '@/api/entities';

const PortalAuthContext = createContext();
const SESSION_KEY = 'rosie_portal_auth';

export const PortalAuthProvider = ({ children }) => {
  const [portalUser, setPortalUser]     = useState(null);
  const [isPortalLoading, setLoading]   = useState(true);

  useEffect(() => {
    // Restore session from sessionStorage, ensure admin row exists
    const init = async () => {
      try {
        await InvestorUser.ensureAdminExists();
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          const user = JSON.parse(saved);
          setPortalUser(user);
          analytics.startSession(user.email, user.name, user.username);
        }
      } catch (e) {
        console.error('[PortalAuth] init error:', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const portalLogin = async (usernameOrEmail, password) => {
    try {
      const user = await InvestorUser.findByCredentials(usernameOrEmail, password);
      if (!user) return { success: false, error: 'Invalid username or password' };

      const { password: _, ...safeUser } = user;
      setPortalUser(safeUser);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
      analytics.startSession(safeUser.email, safeUser.name, safeUser.username);
      return { success: true, user: safeUser };
    } catch (e) {
      console.error('[PortalAuth] login error:', e);
      return { success: false, error: 'Login failed — please try again' };
    }
  };

  const portalLogout = () => {
    analytics.endSession();
    setPortalUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const addUser = async (userData) => {
    try {
      // Check username uniqueness
      const existingByUsername = await InvestorUser.findByUsername(userData.username);
      if (existingByUsername) return { success: false, error: 'Username already taken' };

      // Check email uniqueness if provided
      if (userData.email) {
        const existingByEmail = await InvestorUser.findByEmail(userData.email);
        if (existingByEmail) return { success: false, error: 'Email already in use' };
      }

      await InvestorUser.create({
        ...userData,
        role: userData.role || 'investor',
      });
      return { success: true };
    } catch (e) {
      console.error('[PortalAuth] addUser error:', e);
      return { success: false, error: 'Failed to create user' };
    }
  };

  const removeUser = async (identifier) => {
    try {
      // Find by username or email
      let user = await InvestorUser.findByUsername(identifier);
      if (!user) user = await InvestorUser.findByEmail(identifier);
      if (user?.id) await InvestorUser.delete(user.id);
    } catch (e) {
      console.error('[PortalAuth] removeUser error:', e);
    }
  };

  const getAllUsers = async () => {
    try {
      const users = await InvestorUser.list();
      return users.map(({ password: _, ...u }) => u);
    } catch (e) {
      console.error('[PortalAuth] getAllUsers error:', e);
      return [];
    }
  };

  const updateUser = async (identifier, updates) => {
    try {
      let user = await InvestorUser.findByUsername(identifier);
      if (!user) user = await InvestorUser.findByEmail(identifier);
      if (!user?.id) return { success: false, error: 'User not found' };
      await InvestorUser.update(user.id, updates);
      return { success: true };
    } catch (e) {
      console.error('[PortalAuth] updateUser error:', e);
      return { success: false, error: 'Update failed' };
    }
  };

  const changeAdminPassword = async (currentPassword, newPassword) => {
    try {
      const admins = await InvestorUser.findByCredentials('admin', currentPassword);
      if (!admins) return { success: false, error: 'Current password is incorrect' };
      await InvestorUser.update(admins.id, { password: newPassword });
      return { success: true };
    } catch (e) {
      console.error('[PortalAuth] changeAdminPassword error:', e);
      return { success: false, error: 'Failed to update password' };
    }
  };

  const changeAdminUsername = async (currentPassword, newUsername) => {
    try {
      const admin = await InvestorUser.findByCredentials('admin', currentPassword);
      if (!admin) {
        // Try with current username from session
        const sessionAdmin = await InvestorUser.findByCredentials(
          portalUser?.username || 'admin', currentPassword
        );
        if (!sessionAdmin) return { success: false, error: 'Current password is incorrect' };
        const taken = await InvestorUser.findByUsername(newUsername);
        if (taken && taken.id !== sessionAdmin.id) return { success: false, error: 'Username already taken' };
        await InvestorUser.update(sessionAdmin.id, { username: newUsername });
        return { success: true };
      }
      const taken = await InvestorUser.findByUsername(newUsername);
      if (taken && taken.id !== admin.id) return { success: false, error: 'Username already taken' };
      await InvestorUser.update(admin.id, { username: newUsername });
      return { success: true };
    } catch (e) {
      console.error('[PortalAuth] changeAdminUsername error:', e);
      return { success: false, error: 'Failed to update username' };
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