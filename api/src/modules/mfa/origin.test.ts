import { expect, it } from 'vitest';
import { requirePasskeyDomain } from './origin';
it('uses localhost for local passkeys and HTTPS domain names for hosted passkeys', () => {
  expect(() => requirePasskeyDomain('http://localhost:14000')).not.toThrow();
  expect(() => requirePasskeyDomain('https://app.example.test')).not.toThrow();
});
it.each([
  'http://127.0.0.1:14000',
  'https://127.0.0.1',
  'http://[::1]:14000',
  'https://[::1]',
  'http://app.example.test',
  'https://user:pass@app.example.test',
])('rejects unsupported passkey origin %s without weakening MFA', (value) => {
  expect(() => requirePasskeyDomain(value)).toThrow(
    expect.objectContaining({ code: 'MFA_ORIGIN_UNSUPPORTED', statusCode: 409 }),
  );
});
