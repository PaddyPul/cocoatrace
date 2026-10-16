import { AppError, ValidationError } from '../../errors';
import { z } from 'zod';
export function listingExpired(expiresAt: unknown, now = Date.now()): boolean {
  return (
    expiresAt != null &&
    (!Number.isFinite(new Date(expiresAt as string).getTime()) ||
      new Date(expiresAt as string).getTime() <= now)
  );
}
export function assertListingCurrent(expiresAt: unknown, expired?: boolean): void {
  if (expired === true || (expired === undefined && listingExpired(expiresAt)))
    throw new AppError(
      'Listing has expired; the supplier must review and renew it',
      409,
      'LISTING_EXPIRED',
    );
}
const renewalSchema = z
  .object({
    reason: z.string().trim().min(10).max(1000),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();
export function renewalInput(body: unknown, now = Date.now()) {
  const parsed = renewalSchema.safeParse(body);
  if (!parsed.success)
    throw new ValidationError(
      'Provide only a reviewed ISO expiry and a renewal reason of 10 to 1000 characters',
    );
  const reason = parsed.data.reason;
  const expiry = new Date(parsed.data.expiresAt);
  if (
    !Number.isFinite(expiry.getTime()) ||
    expiry.getTime() <= now ||
    expiry.getTime() > now + 90 * 86400000
  ) {
    throw new ValidationError('Reviewed expiry must be in the future and within 90 days');
  }
  return { reason, expiry };
}
