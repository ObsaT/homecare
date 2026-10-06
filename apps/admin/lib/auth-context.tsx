'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken, API_BASE_URL } from './api';

export interface AdminUser {
  id: string;
  role: string;
  status: string;
  full_name: string;
  email?: string;
  phone_e164?: string;
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithPassword: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  requestOtp: (phone: string) => Promise<{ success: boolean; challengeId?: string; error?: string }>;
  verifyOtp: (challengeId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const savedToken = getStoredToken();
    const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('homecare_admin_user') : null;

    if (savedToken && savedUserStr) {
      try {
        const parsedUser = JSON.parse(savedUserStr);
        setToken(savedToken);
        setUser(parsedUser);
      } catch {
        setStoredToken(null);
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithPassword = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_e164: phone, password }),
      });

      const body = await res.json();
      if (!res.ok) {
        setIsLoading(false);
        return {
          success: false,
          error: body?.error?.message || body?.message || 'Invalid phone or password',
        };
      }

      const session = body;
      setToken(session.access_token);
      setUser(session.user);
      setStoredToken(session.access_token);
      localStorage.setItem('homecare_admin_user', JSON.stringify(session.user));

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.message || 'Unable to connect to authentication service',
      };
    }
  };

  const requestOtp = async (phone: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_e164: phone, purpose: 'LOGIN' }),
      });
      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body?.error?.message || 'Failed to send OTP' };
      }
      return { success: true, challengeId: body.challenge_id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const verifyOtp = async (challengeId: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      const body = await res.json();
      if (!res.ok) {
        setIsLoading(false);
        return { success: false, error: body?.error?.message || 'Invalid verification code' };
      }

      if (body.access_token && body.user) {
        setToken(body.access_token);
        setUser(body.user);
        setStoredToken(body.access_token);
        localStorage.setItem('homecare_admin_user', JSON.stringify(body.user));
        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, error: 'User is not registered as an administrator' };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || 'Verification failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setStoredToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('homecare_admin_user');
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        loginWithPassword,
        requestOtp,
        verifyOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
