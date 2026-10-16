import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, [logout]);

  const authenticate = useCallback(async (path, payload) => {
    const { data } = await api.post(path, payload);
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, logout, login: (p) => authenticate('/auth/login', p), register: (p) => authenticate('/auth/register', p) }),
    [user, loading, logout, authenticate],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
