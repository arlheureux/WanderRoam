import React, { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cookies are sent automatically with /api/auth/me
    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
      })
      .catch(() => {
        // Stay logged out
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    // Token is now in httpOnly cookie, no need to store in localStorage
    setUser(res.data.user);
    return res.data;
  };

  const register = async (username, password) => {
    const res = await api.post('/auth/register', { username, password });
    // Token is now in httpOnly cookie, no need to store in localStorage
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    await api.post('/auth/logout'); // Call backend to clear cookie
    setUser(null);
  };

  const updateSettings = async (settings) => {
    const res = await api.put('/auth/settings', settings);
    setUser(res.data.user);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
};
