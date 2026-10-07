import { useCallback, useEffect, useState } from 'react';
import { CatalogPage } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';

export function useCatalogPage<T>(
  fetch: (parameters: Record<string, string>) => Promise<CatalogPage<T>>,
  parameters: Record<string, string>,
) {
  const { user } = useAuthCtx();
  const key = JSON.stringify([user?.id, parameters]);
  const [state, setState] = useState<{
    key: string;
    cursors: string[];
    items: T[];
    next: string | null;
    loading: boolean;
    error: string;
  }>({ key: '', cursors: [], items: [], next: null, loading: true, error: '' });
  const refresh = useCallback(() => setRefreshVersion((value) => value + 1), []);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const cursors = state.key === key ? state.cursors : [];
  const cursor = cursors[cursors.length - 1];
  useEffect(() => {
    let active = true;
    setState((current) => ({
      ...current,
      key,
      cursors,
      items: [],
      next: null,
      loading: true,
      error: '',
    }));
    fetch({ ...parameters, ...(cursor ? { cursor } : {}) })
      .then((page) => {
        if (
          !page ||
          !Array.isArray(page.items) ||
          typeof page.hasMore !== 'boolean' ||
          !(
            page.nextCursor === null ||
            (typeof page.nextCursor === 'string' && page.nextCursor.length > 0)
          ) ||
          page.hasMore !== (page.nextCursor !== null)
        )
          throw new Error('Invalid page response. Retry or contact the platform operator.');
        if (active)
          setState((current) => ({
            ...current,
            items: page.items,
            next: page.nextCursor,
            loading: false,
          }));
      })
      .catch((error) => {
        if (active)
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : 'Unable to load records',
          }));
      });
    return () => {
      active = false;
    };
  }, [key, cursor, refreshVersion]);
  const change = (next: string[]) =>
    setState((current) => ({
      ...current,
      key,
      cursors: next,
      items: [],
      next: null,
      loading: true,
      error: '',
    }));
  return {
    items: state.key === key ? state.items : [],
    loading: state.key !== key || state.loading,
    error: state.key === key ? state.error : '',
    pageNumber: cursors.length + 1,
    next: () => {
      if (state.next) change([...cursors, state.next]);
    },
    previous: () => change(cursors.slice(0, -1)),
    hasNext: Boolean(state.next),
    hasPrevious: cursors.length > 0,
    refresh,
  };
}
