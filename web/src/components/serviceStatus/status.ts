export type ObservedStatus = 'available' | 'unavailable' | 'unknown';
export type StatusObservation = { process: ObservedStatus; dependencies: ObservedStatus };

export function projectStatus(
  ok: boolean,
  value: unknown,
  expected: 'ok' | 'ready',
): ObservedStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'unknown';
  const status = (value as Record<string, unknown>).status;
  if (ok && status === expected) return 'available';
  if (!ok && expected === 'ready' && status === 'not_ready') return 'unavailable';
  return 'unknown';
}

export async function observeService(
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<StatusObservation> {
  const read = async (path: string, expected: 'ok' | 'ready'): Promise<ObservedStatus> => {
    try {
      const response = await fetcher(path, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        signal,
        headers: { Accept: 'application/json' },
      });
      return projectStatus(response.ok, await response.json(), expected);
    } catch {
      return 'unknown';
    }
  };
  const [process, dependencies] = await Promise.all([
    read('/api/health/live', 'ok'),
    read('/api/health/ready', 'ready'),
  ]);
  return { process, dependencies };
}
