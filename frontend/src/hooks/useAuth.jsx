import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Axios instance pointing at the Vite reverse proxy for same-origin cookies
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Required to send/receive httpOnly cookies (refresh token)
});

export function AuthProvider({ children }) {
  // Access token lives in memory only — never localStorage
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silently restore session from httpOnly refresh cookie on page load
  useEffect(() => {
    async function restoreSession() {
      try {
        const res = await api.post('/auth/refresh');
        setAccessToken(res.data.accessToken);
        // Decode email from JWT payload (non-sensitive)
        const payload = JSON.parse(atob(res.data.accessToken.split('.')[1]));
        setUser({ userId: payload.userId, email: payload.email });
      } catch {
        // No valid refresh cookie — user needs to log in
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Attach access token to every outgoing request
  useEffect(() => {
    const interceptor = api.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });
    return () => api.interceptors.request.eject(interceptor);
  }, [accessToken]);

  // Automatically refresh access token on 401 responses
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      async (err) => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry && !original.url?.includes('/refresh')) {
          original._retry = true;
          try {
            const res = await api.post('/auth/refresh');
            setAccessToken(res.data.accessToken);
            original.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return api(original);
          } catch {
            setAccessToken(null);
            setUser(null);
          }
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const login = useCallback((token) => {
    setAccessToken(token);
    const payload = JSON.parse(atob(token.split('.')[1]));
    setUser({ userId: payload.userId, email: payload.email });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — clear local state regardless
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ accessToken, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
