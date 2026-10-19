import { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react';
import type { OnboardingState, User } from '../../domains/identity/types';
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
  onboardingError: string;
  refreshOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [onboardingError, setOnboardingError] = useState('');
  const [onboardingLoading, setOnboardingLoading] = useState(Boolean(auth.user));
  const refreshOnboarding = useCallback(async () => {
    if (!auth.user || (auth.user.mfa?.required && !auth.user.mfa.verified)) {
      setOnboarding(null);
      setOnboardingError('');
      setOnboardingLoading(false);
      return;
    }
    setOnboardingLoading(true);
    setOnboardingError('');
    try {
      const value = await workspace.getOnboarding();
      if (!value || !['not_started', 'in_progress', 'completed'].includes(value.status)) {
        throw new Error('Invalid workspace setup response.');
      }
      setOnboarding(value);
    } catch {
      setOnboarding(null);
      setOnboardingError(
        'Workspace setup status could not be loaded. Retry to read the current setup status.',
      );
    } finally {
      setOnboardingLoading(false);
    }
  }, [auth.user?.id, auth.user?.mfa?.verified]);
  useEffect(() => {
    refreshOnboarding();
  }, [refreshOnboarding]);
  const canDo = (perm: string) => {
    const perms = auth.user?.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  };
  return (
    <AuthContext.Provider
      value={{ ...auth, canDo, onboarding, onboardingLoading, onboardingError, refreshOnboarding }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthCtx() {
  return useContext(AuthContext);
}
