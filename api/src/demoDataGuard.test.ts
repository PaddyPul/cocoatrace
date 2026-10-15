import { describe, expect, it } from 'vitest';
import { assertDemoResetAllowed } from './services/demoResetGuard';

describe('demo reset guard', () => {
  it('allows a recognized local demo database', () => {
    expect(() =>
      assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'demo', true),
    ).not.toThrow();
  });

  it('rejects production', () => {
    expect(() =>
      assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'production', true),
    ).toThrow(/disabled/);
  });

  it('rejects an unrecognized local database', () => {
    expect(() =>
      assertDemoResetAllowed('postgresql://u:p@localhost:5432/customer_data', 'demo', true),
    ).toThrow(/Refusing/);
  });

  it('rejects a remote database without an explicit override', () => {
    expect(() =>
      assertDemoResetAllowed('postgresql://u:p@db.example.com:5432/cocoatrace', 'demo', true),
    ).toThrow(/Refusing/);
  });

  it('rejects reset when demo mode is disabled', () => {
    expect(() =>
      assertDemoResetAllowed('postgresql://u:p@localhost:15433/cocoatrace', 'development', false),
    ).toThrow(/DEMO_MODE/);
  });
});

describe('demo reset non-bypass boundaries', () => {
  it.each(['staging', 'production'] as const)(
    'never resets %s, even with legacy remote override',
    (environment) => {
      for (const override of [false, true]) {
        expect(() =>
          assertDemoResetAllowed(
            'postgresql://u:p@localhost/cocoatrace',
            environment,
            true,
            override,
          ),
        ).toThrow(/disabled/);
        expect(() =>
          assertDemoResetAllowed(
            'postgresql://u:p@remote.invalid/customer_data',
            environment,
            true,
            override,
          ),
        ).toThrow(/disabled/);
      }
    },
  );
  it.each([
    'postgresql://u:p@remote.invalid/cocoatrace',
    'postgresql://u:p@localhost/customer_data',
    'postgresql://u:p@localhost/cocoatrace?host=remote.invalid',
    'postgresql://u:p@localhost/cocoatrace?service=production',
    'postgresql://u:p@localhost/cocoatrace?options=-csearch_path=other',
    'https://localhost/cocoatrace',
    'postgresql://u:p@localhost/cocoatrace#override',
  ])(
    'rejects nonlocal, unrecognized or overridden target even when legacy override is set: %s',
    (url) => {
      expect(() => assertDemoResetAllowed(url, 'demo', true, true)).toThrow(/Refusing/);
    },
  );
  it('supports explicit loopback IPv6 and never bypasses disabled demo mode', () => {
    expect(() =>
      assertDemoResetAllowed('postgresql://u:p@[::1]/cocoatrace_demo', 'demo', true, false),
    ).not.toThrow();
    expect(() =>
      assertDemoResetAllowed(
        'postgresql://u:p@localhost/cocoatrace_demo',
        'development',
        false,
        true,
      ),
    ).toThrow(/DEMO_MODE/);
  });
});
