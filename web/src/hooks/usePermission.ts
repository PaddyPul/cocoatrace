import { useCallback } from 'react';
import { useAuthCtx } from '../components/auth/AuthProvider';

export function usePermission() {
  const { canDo } = useAuthCtx();
  const canAny = useCallback((...perms: string[]) => perms.some((p) => canDo(p)), [canDo]);
  return { canDo, canAny };
}
