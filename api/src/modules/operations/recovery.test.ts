import { describe, expect, it } from 'vitest';
import { safeEmailError } from './recovery';

describe('terminal email error redaction', () => {
  it.each(['SMTP_SUBMISSION_FAILED', 'FINAL_LEASE_EXPIRED'])('retains %s', (code) => {
    expect(safeEmailError(code)).toBe(code);
  });
  it('retains an absent error without inventing an incident', () => {
    expect(safeEmailError(null)).toBeNull();
  });
  it('redacts recipient addresses and arbitrary provider diagnostics', () => {
    expect(safeEmailError('SMTP error for private@example.test: secret provider payload')).toBe(
      'UNKNOWN_EMAIL_FAILURE',
    );
  });
  it('does not coerce non-string input into a permitted incident', () => {
    expect(safeEmailError({ toString: () => 'SMTP_SUBMISSION_FAILED' })).toBe(
      'UNKNOWN_EMAIL_FAILURE',
    );
  });
});
