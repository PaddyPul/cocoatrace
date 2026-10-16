import { describe, expect, it } from 'vitest';
import { bodyHash, requestBody, reviewBody } from './policy';
const input = {
  idempotencyKey: '00000000-0000-4000-8000-000000000001',
  subject: 'Issue',
  description: 'Details',
  context: 'home',
};
describe('support request boundaries', () => {
  it.each([
    { subject: '' },
    { subject: 'x'.repeat(121) },
    { description: 'x'.repeat(2001) },
    { context: 'https://example.test/?token=secret' },
    { entityId: 'https://example.test' },
    { email: 'user@example.test' },
    { files: [] },
    { token: 'secret' },
    { idempotencyKey: 'retry-me' },
  ])('rejects invalid or unrestricted metadata %j', (patch) => {
    expect(requestBody.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it('canonicalizes text and hashes only immutable request content', () => {
    const first = requestBody.parse(input);
    const retry = requestBody.parse({
      ...input,
      subject: ' Issue ',
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    });
    expect(bodyHash(first)).toBe(bodyHash(retry));
    expect(bodyHash({ ...first, description: 'Other' })).not.toBe(bodyHash(first));
  });
  it('requires a bounded reason and known status for every operator action', () => {
    expect(
      reviewBody.safeParse({
        status: 'resolved',
        expectedStatus: 'open',
        reason: 'Completed triage',
      }).success,
    ).toBe(true);
    for (const value of [
      { status: 'closed', reason: 'Completed triage' },
      { status: 'resolved', reason: 'short' },
      { status: 'open', reason: 'x'.repeat(1001) },
      { status: 'open', reason: 'Completed triage', description: 'replacement' },
    ])
      expect(reviewBody.safeParse({ expectedStatus: 'open', ...value }).success).toBe(false);
  });
});
