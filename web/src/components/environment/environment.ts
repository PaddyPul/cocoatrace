export type WorkspaceEnvironment =
  | 'development'
  | 'test'
  | 'demo'
  | 'staging'
  | 'production'
  | 'unknown';

export function parseWorkspaceEnvironment(input: unknown): WorkspaceEnvironment {
  if (!input || typeof input !== 'object') return 'unknown';
  const row = input as Record<string, unknown>;
  if (row.status !== 'ok') return 'unknown';
  return ['development', 'test', 'demo', 'staging', 'production'].includes(
    String(row.environment),
  ) && typeof row.environment === 'string'
    ? (row.environment as WorkspaceEnvironment)
    : 'unknown';
}

export async function readWorkspaceEnvironment(
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<WorkspaceEnvironment> {
  try {
    const response = await fetcher('/api/health/live', {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return 'unknown';
    return parseWorkspaceEnvironment(await response.json());
  } catch {
    return 'unknown';
  }
}
