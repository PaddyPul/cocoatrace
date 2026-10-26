import fs from 'node:fs';
import path from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

function sanitized(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/g, '[URL redacted]')
    .replace(/[A-Za-z0-9_-]{40,}/g, '[credential redacted]');
}

export default class SafeReporter implements Reporter {
  private results: {
    title: string;
    status: string;
    durationMs: number;
    errors: string[];
    sourceLocations: string[];
  }[] = [];
  onTestEnd(test: TestCase, result: TestResult): void {
    const title = test.titlePath().filter(Boolean).join(' > ');
    const errors = result.errors.map((error) => sanitized(error.message || 'Test failed'));
    const sourceLocations = [
      ...new Set(
        result.errors.flatMap((error) =>
          [...(error.stack || '').matchAll(/e2e[\\/][A-Za-z0-9_./\\-]+\.ts:\d+:\d+/g)].map(
            (match) => match[0],
          ),
        ),
      ),
    ];
    this.results.push({
      title,
      status: result.status,
      durationMs: result.duration,
      errors,
      sourceLocations,
    });
    console.log(`${result.status.toUpperCase()}: ${title}`);
    for (const error of errors) console.error(error);
    for (const location of sourceLocations) console.error(`Source: ${location}`);
  }
  onError(error: { message?: string }): void {
    console.error(sanitized(error.message || 'Browser suite failed'));
  }
  onEnd(result: FullResult): void {
    const directory = path.resolve('browser-test-results/safe');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'summary.json'),
      JSON.stringify({ status: result.status, tests: this.results }, null, 2),
    );
    console.log(
      `Browser suite: ${result.status}. Sanitized report: browser-test-results/safe/summary.json`,
    );
  }
}
