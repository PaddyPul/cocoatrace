import { describe, expect, it } from 'vitest';
import { requireDisposableTestDatabase } from './databaseSafety';

describe('integration database safety guard', () => {
  it('accepts a clearly named PostgreSQL test database', () => {
    const value = 'postgresql://user:password@localhost:5432/cocoatrace_test';
    expect(requireDisposableTestDatabase(value)).toBe(value);
  });

  it.each([
    undefined,
    'mysql://user:password@localhost/cocoatrace_test',
    'postgresql://user:password@localhost/cocoatrace',
    'not-a-url',
  ])('rejects an unsafe target: %s', (value) => {
    expect(() => requireDisposableTestDatabase(value)).toThrow();
  });
});

