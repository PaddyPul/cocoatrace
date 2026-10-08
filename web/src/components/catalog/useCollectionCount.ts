import { useEffect, useState } from 'react';
import { useAuthCtx } from '../auth/AuthProvider';
export function useCollectionCount(
  fetch: () => Promise<{ count: number }>,
  scope: string,
  version: number,
) {
  const { user } = useAuthCtx();
  const key = JSON.stringify([user?.id, scope, version]);
  const [state, setState] = useState<{ key: string; count: number | null; error: string }>({
    key: '',
    count: null,
    error: '',
  });
  useEffect(() => {
    let active = true;
    setState({ key, count: null, error: '' });
    fetch()
      .then((value) => {
        if (!Number.isSafeInteger(value.count) || value.count < 0) throw new Error('Invalid total');
        if (active) setState({ key, count: value.count, error: '' });
      })
      .catch(() => {
        if (active) setState({ key, count: null, error: 'Total unavailable. Retry to refresh.' });
      });
    return () => {
      active = false;
    };
  }, [key]);
  return state.key === key ? state : { key, count: null, error: '' };
}
