import { AppError } from '../../errors';
export const buyer = [
  'listing.read',
  'offer.create',
  'contract.read',
  'shipment.read',
  'shipment.update',
  'payment.read',
  'payment.confirm',
  'evidence.read',
  'evidence.upload',
  'provenance.export',
  'batch.read',
  'farm.read',
  'certificate.read',
];
export const supplier = [
  'farm.read',
  'farm.create',
  'batch.read',
  'batch.create',
  'holding.read',
  'holding.create',
  'listing.read',
  'listing.create',
  'offer.respond',
  'contract.read',
  'shipment.read',
  'shipment.update',
  'payment.read',
  'payment.request',
  'evidence.read',
  'evidence.upload',
  'recall.manage',
];
export function family(type: string): 'buyer' | 'supplier' {
  if (type === 'importer') return 'buyer';
  if (['exporter', 'farmer', 'cooperative'].includes(type)) return 'supplier';
  throw new AppError(
    'Team management is unavailable for this organization type',
    403,
    'UNSUPPORTED_ORGANIZATION',
  );
}
export function definitions(type: string): Record<string, string[]> {
  const prefix = family(type),
    base = prefix === 'buyer' ? buyer : supplier;
  return {
    [`${prefix}_admin`]: [...base, 'member.invite', 'member.manage'],
    [`${prefix}_member`]: base,
    [`${prefix}_viewer`]: base.filter((p) => p.endsWith('.read')),
  };
}
export function boundedRole(name: string, permissions: string[], type: string): boolean {
  const allowed = definitions(type)[name];
  return (
    !!allowed &&
    permissions.length === new Set(permissions).size &&
    permissions.length === allowed.length &&
    permissions.every((p) => allowed.includes(p))
  );
}
export function assignable(
  name: string,
  permissions: string[],
  actorPermissions: string[],
  type: string,
): boolean {
  return (
    boundedRole(name, permissions, type) && permissions.every((p) => actorPermissions.includes(p))
  );
}
