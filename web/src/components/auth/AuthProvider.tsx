import { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { OnboardingState, User } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { workspace } from '../../api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | undefined>;
  logout: () => void;
  canDo: (perm: string) => boolean;
  onboarding: OnboardingState | null;
  onboardingLoading: boolean;
  refreshOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(Boolean(auth.user));
  const refreshOnboarding = useCallback(async () => {
    if (!auth.user) { setOnboarding(null); setOnboardingLoading(false); return; }
    setOnboardingLoading(true);
    try { setOnboarding(await workspace.getOnboarding()); }
    catch { setOnboarding(null); }
    finally { setOnboardingLoading(false); }
  }, [auth.user?.id]);
  useEffect(() => { refreshOnboarding(); }, [refreshOnboarding]);
  const canDo = (perm: string) => {
    const perms = auth.user?.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  };
  return (
    <AuthContext.Provider value={{ ...auth, canDo, onboarding, onboardingLoading, refreshOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthCtx() {
  return useContext(AuthContext);
}
