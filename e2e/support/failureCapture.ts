import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

function redact(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/g, '[URL redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/[A-Za-z0-9_-]{40,}/g, '[credential redacted]');
}

/** Capture bounded visible diagnostics; never read inputs, cookies or storage. */
export async function captureFailure({ page }: { page: Page }, info: TestInfo): Promise<void> {
  if (info.status === info.expectedStatus) return;
  const directory = path.resolve('browser-test-results/safe');
  fs.mkdirSync(directory, { recursive: true });
  const name = info.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const target = path.join(directory, `${name}.json`);
  const record: { title: string; capture: string; headings?: string[]; alerts?: string[] } = {
    title: redact(info.title),
    capture: 'page unavailable',
  };
  // Retain a useful marker even when navigation/browser failure prevents capture.
  fs.writeFileSync(target, JSON.stringify(record, null, 2));
  if (page.isClosed()) return;
  try {
    const view = await page.locator('body').evaluate(
      (body) => ({
        headings: [...body.querySelectorAll('h1,h2')]
          .slice(0, 10)
          .map((node) => (node.textContent || '').slice(0, 500)),
        alerts: [...body.querySelectorAll('[role="alert"]')]
          .slice(0, 10)
          .map((node) => (node.textContent || '').slice(0, 500)),
      }),
      undefined,
      { timeout: 3000 },
    );
    record.headings = view.headings.map(redact);
    record.alerts = view.alerts.map(redact);
    record.capture = 'visible headings and alerts captured';
    fs.writeFileSync(target, JSON.stringify(record, null, 2));
    await page.screenshot({
      path: path.join(directory, `${name}.png`),
      fullPage: true,
      timeout: 3000,
      mask: [
        page.locator(
          'input, textarea, a[href*="token="], a[href*="accept-invite"], a[href*="reset-password"]',
        ),
      ],
    });
  } catch {
    /* Never replace the original failure with a diagnostic failure. */
  }
}
