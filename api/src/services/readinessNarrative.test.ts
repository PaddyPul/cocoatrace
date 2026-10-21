import { describe, expect, it } from 'vitest';
import { extractNarrativeText } from './readinessNarrative';

describe('optional external narrative parsing', () => {
  it('accepts explicit text and nested output text without coercing other data', () => {
    expect(extractNarrativeText({ output_text: 'Measured facts only.' })).toBe(
      'Measured facts only.',
    );
    expect(
      extractNarrativeText({
        output: [
          null,
          {
            content: [
              { type: 'other', text: 'skip' },
              { type: 'output_text', text: 'Summary' },
            ],
          },
        ],
      }),
    ).toBe('Summary');
  });
  it('rejects malformed provider envelopes so the deterministic fallback remains available', () => {
    for (const value of [
      null,
      42,
      'text',
      {},
      { output_text: {} },
      { output: {} },
      { output: [{ content: 'wrong' }] },
      { output: [{ content: [{ type: 'output_text', text: 10 }] }] },
    ]) {
      expect(extractNarrativeText(value)).toBeNull();
    }
  });
});
