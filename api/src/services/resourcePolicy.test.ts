import { describe, expect, it } from 'vitest';
import { hasExplicitPermission } from './resourcePolicy';

describe('explicit network permission policy', () => {
  it('does not treat an ordinary read permission as network access', () => {
    expect(hasExplicitPermission({ organizationId: 'org-a', permissions: ['farm.read'] }, 'farm.read.all')).toBe(false);
  });

  it('accepts only the named network permission or platform wildcard', () => {
    expect(hasExplicitPermission({ organizationId: 'org-a', permissions: ['farm.read.all'] }, 'farm.read.all')).toBe(true);
    expect(hasExplicitPermission({ organizationId: 'org-a', permissions: ['*'] }, 'farm.read.all')).toBe(true);
  });
});
