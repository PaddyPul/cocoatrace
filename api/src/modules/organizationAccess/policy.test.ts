import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../errors';
import { requirePlatformAccessReviewer } from './policy';

describe('organization access review policy', () => {
  it('requires the platform wildcard rather than an organization-scoped admin permission', () => {
    expect(() => requirePlatformAccessReviewer({ id: 'u', organizationId: 'o', permissions: ['organization.admin'] }))
      .toThrow(ForbiddenError);
    expect(() => requirePlatformAccessReviewer({ id: 'u', organizationId: 'o', permissions: ['*'] }))
      .not.toThrow();
  });
});
