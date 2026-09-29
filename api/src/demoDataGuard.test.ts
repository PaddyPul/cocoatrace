import { describe, expect, it } from 'vitest';
import { assertDemoResetAllowed } from './services/demoResetGuard';

describe('demo reset guard', () => {
  it('allows a recognized local demo database', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'demo', true)).not.toThrow();
  });

  it('rejects production', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'production', true)).toThrow(/disabled/);
  });

  it('rejects an unrecognized local database', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@localhost:5432/customer_data', 'demo', true)).toThrow(/Refusing/);
  });

  it('rejects a remote database without an explicit override', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@db.example.com:5432/cocoatrace', 'demo', true)).toThrow(/Refusing/);
  });

  it('rejects reset when demo mode is disabled', () => {
    expect(() => assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'development', false)).toThrow(/DEMO_MODE/);
  });
});
