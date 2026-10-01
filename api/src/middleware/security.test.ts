import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { sensitiveActionLimit } from './security';

function client(path: string) {
  const ip = randomUUID();
  return (body: Record<string, string>, params: Record<string, string> = {}) => {
    const next = vi.fn();
    const response = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    sensitiveActionLimit({ ip, path, body, params } as unknown as Request, response as unknown as Response, next);
    return { next, response };
  };
}

describe('sensitive action rate limits', () => {
  it('limits repeated body-token verification without locking another token', () => {
    const call = client('/auth/request-access/verify');
    for (let i = 0; i < 10; i++) expect(call({ token: 'same-prefix-first-token' }).next).toHaveBeenCalledOnce();
    expect(call({ token: 'same-prefix-first-token' }).response.status).toHaveBeenCalledWith(429);
    expect(call({ token: 'same-prefix-second-token' }).next).toHaveBeenCalledOnce();
  });

  it('normalizes admin email targets and keeps applications independent', () => {
    const call = client('/auth/request-access');
    for (let i = 0; i < 10; i++) call({ adminEmail: 'Admin@browser.test' });
    expect(call({ adminEmail: ' admin@browser.test ' }).response.status).toHaveBeenCalledWith(429);
    expect(call({ adminEmail: 'other@browser.test' }).next).toHaveBeenCalledOnce();
  });

  it('uses full URL tokens and retains limits for anonymous requests', () => {
    const tokenCall = client('/invitations/accept');
    for (let i = 0; i < 10; i++) tokenCall({}, { token: 'shared-prefix-012345-first' });
    expect(tokenCall({}, { token: 'shared-prefix-012345-first' }).response.status).toHaveBeenCalledWith(429);
    expect(tokenCall({}, { token: 'shared-prefix-012345-second' }).next).toHaveBeenCalledOnce();
    const anonymousCall = client('/auth/request-access/verify');
    for (let i = 0; i < 10; i++) anonymousCall({});
    expect(anonymousCall({}).response.status).toHaveBeenCalledWith(429);
  });
});
