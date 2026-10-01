import { describe, expect, it } from 'vitest';
import { requestOrganizationAccessSchema, reviewOrganizationAccessSchema } from './schemas';

describe('organization access schemas', () => {
  it('normalizes the canonical buyer/supplier request payload', () => {
    expect(requestOrganizationAccessSchema.parse({
      organizationName: '  Serious Materials Ltd  ',
      organizationType: 'supplier',
      jurisdiction: 'gh',
      legalRegistrationNumber: ' REG-123 ',
      adminName: ' Ama Admin ',
      adminEmail: 'AMA@EXAMPLE.COM',
    })).toEqual({
      organizationName: 'Serious Materials Ltd',
      organizationType: 'supplier',
      jurisdiction: 'GH',
      legalRegistrationNumber: 'REG-123',
      adminName: 'Ama Admin',
      adminEmail: 'ama@example.com',
    });
  });

  it('rejects platform organization types and accepts an omitted review reason', () => {
    expect(requestOrganizationAccessSchema.safeParse({
      organizationName: 'Platform Admin',
      organizationType: 'admin',
      jurisdiction: 'GH',
      adminName: 'Admin User',
      adminEmail: 'admin@example.com',
    }).success).toBe(false);
    expect(reviewOrganizationAccessSchema.parse({})).toEqual({});
  });
});
