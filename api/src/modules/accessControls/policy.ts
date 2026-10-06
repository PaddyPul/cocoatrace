import { AppError, ForbiddenError } from '../../errors';

export function requirePlatformAdministrator(permissions: string[]): void {
  if (!permissions.includes('*'))
    throw new ForbiddenError('Platform administrator access is required');
}
export function requireSafeTarget(protectedAccount: boolean): void {
  if (protectedAccount)
    throw new AppError(
      'Platform administration accounts require the two-reviewer privileged access procedure',
      409,
      'PRIVILEGED_ACCESS_PROTECTED',
    );
}
