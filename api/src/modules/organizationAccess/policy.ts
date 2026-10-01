import { ForbiddenError } from '../../errors';
import { AccessReviewActor } from './types';

export function requirePlatformAccessReviewer(actor: AccessReviewActor): void {
  if (!actor.permissions.includes('*')) {
    throw new ForbiddenError('Platform administrator access is required');
  }
}
