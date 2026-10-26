import { captureFailure } from './failureCapture';
import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend({});

test.beforeAll(async ({ request }) => {
  if (process.env.COCOATRACE_BROWSER_RUN !== 'true') {
    throw new Error(
      'Use npm run test:browser:docker to provision the disposable test environment.',
    );
  }
  const health = await request.get('/api/health/live');
  expect(health.ok()).toBe(true);
  expect((await health.json()).environment).toBe('test');
});

test.afterEach(captureFailure);
