import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend({});

test.beforeAll(async ({ request }) => {
  if (process.env.COCOATRACE_BROWSER_RUN !== 'true') {
    throw new Error('Use npm run test:browser:docker to provision the disposable test environment.');
  }
  const health = await request.get('/api/health/live');
  expect(health.ok()).toBe(true);
  expect((await health.json()).environment).toBe('test');
});

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const directory = path.resolve('browser-test-results/safe');
  fs.mkdirSync(directory, { recursive: true });
  try {
    await page.screenshot({
      path: path.join(directory, `${info.testId.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`),
      fullPage: true,
      mask: [page.locator('input, textarea, a[href*="token="], a[href*="accept-invite"], a[href*="reset-password"]')],
    });
  } catch { /* Preserve the original failure if the browser already crashed. */ }
});
