import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TOKEN_STORAGE_KEY } from '../api/client.js';
import { loginRequest, registerRequest } from '../api/auth.js';
import { decodeToken, isExpired } from '../utils/jwt.js';

const AuthContext = createContext(null);

export const ROLES = {
  USER: 'User',
  CONTENT_MANAGER: 'ContentManager',
  ANALYST: 'Analyst',
};

function readInitialToken() {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;
  if (isExpired(stored)) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
  return stored;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readInitialToken);
  const [user, setUser] = useState(() =>
    token ? decodeToken(token) : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync across tabs.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === TOKEN_STORAGE_KEY) {
        const next = e.newValue;
        setToken(next || null);
        setUser(next ? decodeToken(next) : null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const persistToken = useCallback((newToken) => {
    if (newToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      setToken(newToken);
      setUser(decodeToken(newToken));
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  const login = useCallback(
    async (credentials) => {
      setLoading(true);
      setError(null);
      try {
        const data = await loginRequest(credentials);
        const incoming = data?.token ?? data?.accessToken ?? data?.jwt;
        if (!incoming) throw new Error('No token returned by server.');
        persistToken(incoming);
        return decodeToken(incoming);
      } catch (e) {
        const message =
          e?.response?.data?.message ||
          e?.response?.data?.title ||
          e?.message ||
          'Login failed.';
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [persistToken]
  );

  const register = useCallback(
    async (payload) => {
      setLoading(true);
      setError(null);
      try {
        const data = await registerRequest(payload);
        const incoming = data?.token ?? data?.accessToken ?? data?.jwt;
        if (incoming) persistToken(incoming);
        return data;
      } catch (e) {
        const message =
          e?.response?.data?.message ||
          e?.response?.data?.title ||
          e?.message ||
          'Registration failed.';
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [persistToken]
  );

  const logout = useCallback(() => persistToken(null), [persistToken]);

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role ?? null,
      isAuthenticated: !!token && !!user,
      loading,
      error,
      login,
      register,
      logout,
    }),
    [token, user, loading, error, login, register, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
