import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { auth, setAuthToken } from '../api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ct_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await auth.login(email, password);
      setAuthToken(data.accessToken);
      const u = data.user as User;
      localStorage.setItem('ct_user', JSON.stringify(u));
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem('ct_user');
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
