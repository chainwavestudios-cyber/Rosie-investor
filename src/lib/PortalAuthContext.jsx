// Investor Portal - Local Auth Context
// Manages investor users and admin access separately from base44 auth

import React, { createContext, useContext, useState, useEffect } from 'react';
import analytics from './analytics';

const PortalAuthContext = createContext();

const USERS_KEY = 'rosie_portal_users';
const PORTAL_AUTH_KEY = 'rosie_portal_auth';

const DEFAULT_ADMIN = {
  email: 'admin@rosieai.com',
  password: 'Rosie2025!',
  name: 'Admin',
  role: 'admin',
  createdAt: new Date().toISOString(),
};

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const users = raw ? JSON.parse(raw) : [];
    // Ensure admin always exists
    if (!users.find(u => u.role === 'admin')) {
      users.push(DEFAULT_ADMIN);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return users;
  } catch {
    return [DEFAULT_ADMIN];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const PortalAuthProvider = ({ children }) => {
  const [portalUser, setPortalUser] = useState(null);
  const [isPortalLoading, setIsPortalLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    try {
      const saved = sessionStorage.getItem(PORTAL_AUTH_KEY);
      if (saved) {
        const user = JSON.parse(saved);
        setPortalUser(user);
        analytics.startSession(user.email, user.name);
      }
    } catch {}
    setIsPortalLoading(false);
  }, []);

  const portalLogin = (email, password) => {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    const { password: _, ...safeUser } = user;
    setPortalUser(safeUser);
    sessionStorage.setItem(PORTAL_AUTH_KEY, JSON.stringify(safeUser));
    analytics.startSession(safeUser.email, safeUser.name);
    return { success: true, user: safeUser };
  };

  const portalLogout = () => {
    analytics.endSession();
    setPortalUser(null);
    sessionStorage.removeItem(PORTAL_AUTH_KEY);
  };

  const addUser = (userData) => {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
      return { success: false, error: 'User with this email already exists' };
    }
    const newUser = {
      ...userData,
      role: userData.role || 'investor',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers(users);
    return { success: true };
  };

  const removeUser = (email) => {
    const users = getUsers();
    const filtered = users.filter(u => u.email !== email);
    saveUsers(filtered);
  };

  const getAllUsers = () => {
    return getUsers().map(({ password: _, ...u }) => u);
  };

  const updateUser = (email, updates) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updates };
      saveUsers(users);
      return { success: true };
    }
    return { success: false, error: 'User not found' };
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