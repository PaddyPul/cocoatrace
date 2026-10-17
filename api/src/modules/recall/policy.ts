import type { RecallActor, RecallNotice } from './responseModel';

/** Network scope is explicit; a tenant manager never acquires it from ownership. */
export function hasNetworkRecallAuthority(actor: RecallActor): boolean {
  return actor.permissions.some(
    (permission) => permission === '*' || permission === 'recall.manage.all',
  );
}

/** Contact and resolution use the same existing manager boundary. */
export function canManageRecall(
  actor: RecallActor,
  notice: Pick<RecallNotice, 'initiated_by_organization_id'>,
): boolean {
  return (
    hasNetworkRecallAuthority(actor) ||
    (notice.initiated_by_organization_id === actor.organizationId &&
      actor.permissions.includes('recall.manage'))
  );
}

/** Activation and investigation also pass the route's recall.manage permission gate. */
export function canInitiateRecall(actor: RecallActor): boolean {
  return actor.permissions.includes('*') || actor.permissions.includes('recall.manage');
}
