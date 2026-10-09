import { useCallback, useEffect, useState } from 'react';
import { recalls } from '../../api';
import { RecallResponse, RecallResponseCollection } from '../../types';
import { useAuthCtx } from '../auth/AuthProvider';
export const responseCollections: RecallResponseCollection[] = [
  'participants',
  'holdings',
  'recoveries',
  'evidence',
];
type Navigation = Record<RecallResponseCollection, { search: string; cursors: string[] }>;
const initial = (): Navigation => ({
  participants: { search: '', cursors: [] },
  holdings: { search: '', cursors: [] },
  recoveries: { search: '', cursors: [] },
  evidence: { search: '', cursors: [] },
});

export function validateRecallResponse(value: RecallResponse): RecallResponse {
  if (
    !value ||
    !value.notice ||
    typeof value.canManage !== 'boolean' ||
    typeof value.myOrganizationId !== 'string' ||
    !value.paging
  )
    throw new Error('Invalid recall response. Retry to refresh.');
  for (const name of responseCollections) {
    const page = value.paging[name];
    if (
      !Array.isArray(value[name]) ||
      value[name].length > 100 ||
      !page ||
      !Number.isSafeInteger(page.count) ||
      page.count < value[name].length ||
      typeof page.hasMore !== 'boolean' ||
      !(
        page.nextCursor === null ||
        (typeof page.nextCursor === 'string' && page.nextCursor.length > 0)
      ) ||
      page.hasMore !== (page.nextCursor !== null)
    )
      throw new Error('Invalid recall response page. Retry to refresh.');
  }
  return value;
}
export function useRecallResponsePages(recallId: string, selectedHoldingId?: string) {
  const { user } = useAuthCtx();
  const context = JSON.stringify([user?.id, user?.organizationId, user?.permissions, recallId]);
  const [navigation, setNavigation] = useState<{ context: string; value: Navigation }>({
    context,
    value: initial(),
  });
  const currentNavigation = navigation.context === context ? navigation.value : initial();
  const key = JSON.stringify([context, currentNavigation, selectedHoldingId]);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    context: string;
    key: string;
    data: RecallResponse | null;
    loading: boolean;
    error: string;
  }>({ context: '', key: '', data: null, loading: true, error: '' });
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    setState((previous) => ({
      context,
      key,
      data: previous.context === context ? previous.data : null,
      loading: true,
      error: '',
    }));
    const parameters: Record<string, string> = { limit: '50' };
    if (selectedHoldingId) parameters.selectedHoldingId = selectedHoldingId;
    for (const name of responseCollections) {
      const page = currentNavigation[name];
      parameters[`${name}Search`] = page.search;
      const cursor = page.cursors[page.cursors.length - 1];
      if (cursor) parameters[`${name}Cursor`] = cursor;
    }
    recalls
      .response(recallId, parameters)
      .then(validateRecallResponse)
      .then((value) => {
        if (
          selectedHoldingId &&
          (!Object.prototype.hasOwnProperty.call(value, 'selectedHolding') ||
            (value.selectedHolding && value.selectedHolding.id !== selectedHoldingId))
        )
          throw new Error('Invalid selected holding response. Retry to refresh.');
        return value;
      })
      .then((data) => {
        if (active) setState({ context, key, data, loading: false, error: '' });
      })
      .catch((error) => {
        if (active)
          setState({
            context,
            key,
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Recall response unavailable',
          });
      });
    return () => {
      active = false;
    };
  }, [key, version]);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  const update = (name: RecallResponseCollection, page: Navigation[RecallResponseCollection]) =>
    setNavigation({ context, value: { ...currentNavigation, [name]: page } });
  return {
    context,
    data: state.context === context ? state.data : null,
    loading: state.key !== key || state.loading,
    error: state.context === context ? state.error : '',
    refresh,
    navigation: currentNavigation,
    search: (name: RecallResponseCollection, search: string) =>
      update(name, { search, cursors: [] }),
    next: (name: RecallResponseCollection) => {
      const cursor = state.data?.paging?.[name].nextCursor;
      if (cursor && !state.loading && state.key === key)
        update(name, {
          ...currentNavigation[name],
          cursors: [...currentNavigation[name].cursors, cursor],
        });
    },
    previous: (name: RecallResponseCollection) =>
      update(name, {
        ...currentNavigation[name],
        cursors: currentNavigation[name].cursors.slice(0, -1),
      }),
  };
}
export function RecallCollectionNavigation({
  name,
  pages,
}: {
  name: RecallResponseCollection;
  pages: ReturnType<typeof useRecallResponsePages>;
}) {
  const navigation = pages.navigation[name];
  const metadata = pages.data?.paging?.[name];
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs"
      aria-label={`Recall ${name} navigation`}
    >
      <label>
        Search {name}
        <input
          aria-label={`Search recall ${name}`}
          className="form-input"
          maxLength={80}
          value={navigation.search}
          onChange={(event) => pages.search(name, event.target.value)}
        />
      </label>
      <span>
        {metadata ? `${metadata.count.toLocaleString()} recorded` : 'Total unavailable'} · Page{' '}
        {navigation.cursors.length + 1}
      </span>
      <button
        className="btn btn-sm"
        disabled={pages.loading || !navigation.cursors.length}
        onClick={() => pages.previous(name)}
      >
        Previous {name}
      </button>
      <button
        className="btn btn-sm"
        disabled={pages.loading || !metadata?.hasMore}
        onClick={() => pages.next(name)}
      >
        Next {name}
      </button>
    </div>
  );
}
