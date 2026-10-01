import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { auth, setAuthToken } from '../api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ct_user');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem('ct_user')) { setLoading(false); return; }
    auth.me().then((data) => {
      if (!active) return;
      const restored: User = {
        id: data.id, email: data.email, name: data.name,
        organizationId: data.organization_id, orgName: data.org_name, orgType: data.org_type,
        roles: data.roles || [], permissions: data.permissions || [],
      };
      localStorage.setItem('ct_user', JSON.stringify(restored));
      setUser(restored);
    }).catch(() => {
      if (!active) return;
      localStorage.removeItem('ct_user');
      setUser(null);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Initial-session restoration owns global loading. LoginPage owns its
    // submitting state; toggling global loading unmounts it and loses errors.
    const data = await auth.login(email, password);
    // Keep the session in its HttpOnly cookie, never in browser storage.
    setAuthToken(null);
    const u = data.user as User;
    localStorage.setItem('ct_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    auth.logout().catch(() => undefined);
    setAuthToken(null);
    localStorage.removeItem('ct_user');
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
