import { describe, it, expect } from 'vitest';
import { hashObject } from './audit';

describe('hashObject', () => {
  it('produces deterministic sha256: prefixed hash', () => {
    const obj = { foo: 'bar', num: 42 };
    const h1 = hashObject(obj);
    const h2 = hashObject(obj);
    expect(h1).toMatch(/^sha256:[a-f0-9]+$/);
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different inputs', () => {
    const h1 = hashObject({ a: 1 });
    const h2 = hashObject({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it('is canonical (key order independent)', () => {
    const h1 = hashObject({ b: 2, a: 1 });
    const h2 = hashObject({ a: 1, b: 2 });
    expect(h1).toBe(h2);
  });
});
