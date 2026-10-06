import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './e2e/support/environment';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: './e2e/support/safeReporter.ts',
  outputDir: 'browser-test-results/private',
  use: {
    baseURL,
    // APIRequestContext cookie writes explicitly declare the disposable app origin.
    extraHTTPHeaders: { Origin: baseURL },
    ...devices['Desktop Chrome'],
    // Traces include network credentials. Never publish them as CI artifacts.
    trace: !process.env.CI && process.env.COCOATRACE_BROWSER_PRIVATE_TRACES === 'true' ? 'retain-on-failure' : 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: process.env.COCOATRACE_BROWSER_EXECUTABLE ? { executablePath: process.env.COCOATRACE_BROWSER_EXECUTABLE } : {},
  },
  projects: [{ name: 'chromium' }],
});
