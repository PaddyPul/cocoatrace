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
  const res = await fetch(API_BASE + path, opts);
  // Invalid login credentials are a form error, not an expired workspace
  // session. Redirecting here reloads the form and hides the useful error.
  if (res.status === 401 && path !== '/auth/login') {
    token = null;
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (
    res.status === 403 &&
    data?.code === 'MFA_STEP_UP_REQUIRED' &&
    !mfaRetry &&
    !path.startsWith('/auth/mfa')
  ) {
    const { verifyPasskey } = await import('../mfa');
    await verifyPasskey();
    return api<T>(method, path, body, isForm, true);
  }
  if (res.status === 403 && data?.code === 'MFA_REQUIRED' && !path.startsWith('/auth/mfa')) {
    window.location.assign('/account/passkeys');
    throw new Error('Passkey verification required');
  }
  if (!res.ok) {
    const msg = data?.details
      ? `${data.error}: ${data.details.map((d: any) => d.message).join('; ')}`
      : data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
