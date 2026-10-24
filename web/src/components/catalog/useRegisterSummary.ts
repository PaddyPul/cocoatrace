import { useCallback, useEffect, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';

// Registers keep full scoped totals separate from their filtered, paginated rows.
export function useRegisterSummary<T>(
  read: () => Promise<T>,
  countFields: readonly (keyof T)[],
  refreshRows: () => void,
) {
  const { user } = useAuthCtx();
  const scope = JSON.stringify([user?.id, user?.organizationId, user?.permissions]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ scope: string; summary: T | null; failed: boolean }>({
    scope: '',
    summary: null,
    failed: false,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    let request = 0;
    const load = async () => {
      const version = ++request;
      try {
        const row = await read();
        if (
          !row ||
          !countFields.every((key) => Number.isInteger(row[key]) && Number(row[key]) >= 0)
        )
          throw new Error('Invalid register totals');
        if (active && version === request) setState({ scope, summary: row, failed: false });
      } catch {
        if (active && version === request) setState({ scope, summary: null, failed: true });
      }
    };
    void load();
    const focus = () => {
      refreshRows();
      void load();
    };
    window.addEventListener('focus', focus);
    return () => {
      active = false;
      window.removeEventListener('focus', focus);
    };
  }, [read, countFields, refreshRows, attempt, scope]);
  return {
    summary: state.scope === scope ? state.summary : null,
    failed: state.scope === scope && state.failed,
    retry,
  };
}
