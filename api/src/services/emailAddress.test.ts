import { describe, expect, it } from 'vitest';
import { isEnvelopeAddress } from './emailAddress';

describe('email envelope address policy', () => {
  it.each(['buyer@example.test', 'buyer+trade@sub.example.test', 'a@b.c', 'a@.b.c', 'a..b@c..d'])(
    'retains the existing basic envelope policy for %s',
    (address) => {
      expect(isEnvelopeAddress(address)).toBe(true);
      expect(isEnvelopeAddress(address, true)).toBe(true);
    },
  );
  it.each([
    '',
    '@example.test',
    'buyer@',
    'buyer@example',
    'buyer@.test',
    'buyer@test.',
    'a@@b.c',
    'a@b@c.d',
    'buyer name@example.test',
    'a@b.c\r\nBcc:other@example.test',
    'a\t@b.c',
  ])('rejects malformed or header-injected address %j', (address) => {
    expect(isEnvelopeAddress(address)).toBe(false);
    expect(isEnvelopeAddress(address, true)).toBe(false);
  });
  it('keeps support-link punctuation restrictions separate from envelope compatibility', () => {
    for (const address of [
      'a<b@example.test',
      'a>b@example.test',
      'a"b@example.test',
      "a'b@example.test",
    ]) {
      expect(isEnvelopeAddress(address)).toBe(true);
      expect(isEnvelopeAddress(address, true)).toBe(false);
    }
  });
  it('handles long ambiguous domain text without a backtracking expression', () => {
    expect(isEnvelopeAddress(`buyer@${'a.'.repeat(100000)}`)).toBe(false);
    expect(isEnvelopeAddress(`buyer@${'a.'.repeat(100000)}test`)).toBe(true);
    expect(isEnvelopeAddress('a'.repeat(200000))).toBe(false);
  });
});
