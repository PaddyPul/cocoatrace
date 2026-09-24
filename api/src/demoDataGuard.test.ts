import { describe, expect, it } from 'vitest';
import { assertDemoResetAllowed } from './services/demoResetGuard';

describe('demo reset guard', () => {
  it('allows a recognized local demo database', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'development')).not.toThrow();
  });

  it('rejects production', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'production')).toThrow(/disabled/);
  });

  it('rejects an unrecognized local database', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@localhost:5432/customer_data', 'development')).toThrow(/Refusing/);
  });

  it('rejects a remote database without an explicit override', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@db.example.com:5432/cocoatrace', 'development')).toThrow(/Refusing/);
  });
});
