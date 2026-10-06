import type { Request } from 'express';

/** Authorization, when present, is authoritative: never fall back to cookies. */
export function bearerToken(req: Pick<Request, 'headers'>): string | undefined {
  return req.headers.authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
}

export function sessionCookie(req: Pick<Request, 'headers'>): string | undefined {
  return req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('ct_session='))
    ?.slice('ct_session='.length);
}

export function sessionCredential(req: Pick<Request, 'headers'>): string | undefined {
  return req.headers.authorization !== undefined ? bearerToken(req) : sessionCookie(req);
}
