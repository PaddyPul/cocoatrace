import { isIP } from 'node:net';
import { AppError } from '../../errors';

export function requirePasskeyDomain(value: string): void {
  const url = new URL(value);
  if (
    isIP(url.hostname.replace(/^\[|\]$/g, '')) ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))
  ) {
    throw new AppError(
      'Passkeys require a domain name. For the local rehearsal, restart it and sign in at http://localhost:14000. IP addresses such as 127.0.0.1 cannot be used as passkey domains.',
      409,
      'MFA_ORIGIN_UNSUPPORTED',
    );
  }
}
