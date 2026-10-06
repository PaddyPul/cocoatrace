export const FRESH_MFA_MS = 5 * 60 * 1000;
export interface MfaState {
  required: boolean;
  enrolled: boolean;
  verified: boolean;
  fresh: boolean;
}
export const PRIVILEGED_PERMISSIONS = [
  '*',
  'member.invite',
  'organization.admin',
  'certificate.issue',
  'batch.attest',
  'audit.read.all',
  'audit.export.all',
  'recall.manage.all',
] as const;
export function privileged(roles: string[], permissions: string[]): boolean {
  return (
    PRIVILEGED_PERMISSIONS.some((permission) => permissions.includes(permission)) ||
    roles.some((role) => /(^|_)(admin|certifier|regulator)$/.test(role))
  );
}
export function mfaState(
  enforced: boolean,
  roles: string[],
  permissions: string[],
  enrolled: boolean,
  verifiedAt: Date | null,
  now = Date.now(),
  history = false,
): MfaState {
  const age = verifiedAt ? now - verifiedAt.getTime() : Infinity;
  return {
    required: history || enrolled || (enforced && privileged(roles, permissions)),
    enrolled,
    verified: enrolled && age >= 0 && Number.isFinite(age),
    fresh: enrolled && age >= 0 && age < FRESH_MFA_MS,
  };
}
export function bypassPath(path: string): boolean {
  return path === '/me' || path === '/auth/logout' || /^\/auth\/mfa(?:\/|$)/.test(path);
}
