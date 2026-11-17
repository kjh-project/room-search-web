/** 로그인 상태 전역 관리: 저장된 JWT 로 /api/me 를 불러와 user 를 채운다. */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '../api/client.js';
import { track } from '../lib/analytics.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) return setReady(true);
    api.me()
      .then(setUser)
      .catch(() => tokenStore.clear()) // 만료·위조 토큰
      .finally(() => setReady(true));
  }, []);

  const completeLogin = useCallback(async (provider, code, redirectUri) => {
    const { token, user: u } = await api.loginWithCode(provider, code, redirectUri);
    tokenStore.set(token);
    setUser(u);
    track('login', { method: provider });
    return u;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, ready, completeLogin, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
