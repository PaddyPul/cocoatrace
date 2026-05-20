import { createContext, useContext, ReactNode } from 'react';
import { User } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | undefined>;
  logout: () => void;
  canDo: (perm: string) => boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const canDo = (perm: string) => {
    const perms = auth.user?.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  };
  return (
    <AuthContext.Provider value={{ ...auth, canDo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthCtx() {
  return useContext(AuthContext);
}
