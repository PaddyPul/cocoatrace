import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && requestIdPattern.test(candidate) ? candidate : randomUUID();
}

export function assignRequestId(req: IncomingMessage, res: ServerResponse): string {
  const requestId = resolveRequestId(req.headers['x-request-id']);
  res.setHeader('X-Request-Id', requestId);
  return requestId;
}

export function requestLogContext(req: IncomingMessage & { id?: unknown }): { correlationId?: string | number } {
  const correlationId = typeof req.id === 'string' || typeof req.id === 'number' ? req.id : undefined;
  return { correlationId };
}
