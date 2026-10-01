import { describe, expect, it } from 'vitest';
import { requestLogContext, resolveRequestId } from './requestContext';

describe('request correlation IDs', () => {
  it('preserves a safe caller-provided request ID', () => {
    expect(resolveRequestId('trace-123:attempt.2')).toBe('trace-123:attempt.2');
  });

  it('generates an ID instead of accepting unsafe or oversized values', () => {
    const unsafe = resolveRequestId('trace id\nforged-log-line');
    const oversized = resolveRequestId('a'.repeat(129));

    expect(unsafe).toMatch(/^[0-9a-f-]{36}$/);
    expect(oversized).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('adds the assigned ID to each request log context', () => {
    expect(requestLogContext({ id: 'trace-123' } as never)).toEqual({ correlationId: 'trace-123' });
  });
});
