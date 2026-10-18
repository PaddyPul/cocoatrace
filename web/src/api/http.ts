import { ApiError, responseCode, responseError } from './errors';
export { ApiError } from './errors';
export const API_BASE = '/api';

export type CatalogPage<T> = { items: T[]; hasMore: boolean; nextCursor: string | null };

let token: string | null = null;

export function setAuthToken(t: string | null) {
  token = t;
  localStorage.removeItem('ct_token');
}

export function getToken() {
  return token;
}

export async function api<T = any>(
  method: string,
  path: string,
  body?: any,
  isForm = false,
  mfaRetry = false,
): Promise<T> {
  const opts: RequestInit = {
    method,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
  if (body && !isForm) {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isForm) {
    opts.body = body;
  }
  let res: Response;
  try {
    res = await fetch(API_BASE + path, opts);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(
      'Connection unavailable. Check your connection and retry.',
      0,
      'NETWORK_ERROR',
    );
  }
  // Invalid login credentials are a form error, not an expired workspace
  // session. Redirecting here reloads the form and hides the useful error.
  if (res.status === 401 && path !== '/auth/login') {
    token = null;
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    if (typeof window.dispatchEvent === 'function')
      window.dispatchEvent(new Event('ct:security-navigation'));
    window.location.href = '/login';
    throw new ApiError('Session expired', 401, 'AUTHENTICATION_ERROR');
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (
    res.status === 403 &&
    responseCode(data) === 'MFA_STEP_UP_REQUIRED' &&
    !mfaRetry &&
    !path.startsWith('/auth/mfa')
  ) {
    const { verifyPasskey } = await import('../mfa');
    await verifyPasskey();
    return api<T>(method, path, body, isForm, true);
  }
  if (
    res.status === 403 &&
    responseCode(data) === 'MFA_REQUIRED' &&
    !path.startsWith('/auth/mfa')
  ) {
    if (typeof window.dispatchEvent === 'function')
      window.dispatchEvent(new Event('ct:security-navigation'));
    window.location.assign('/account/passkeys');
    throw new ApiError('Passkey verification required', 403, 'MFA_REQUIRED');
  }
  if (!res.ok) throw responseError(res, data);
  return data as T;
}
