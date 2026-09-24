import { describe, it, expect } from 'vitest';
import { loginSchema, createFarmSchema, createBatchSchema, createCertificateSchema, createRecallSchema, createInvitationSchema, acceptInvitationSchema, createSourcingRequestSchema } from './validation';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.parse({ email: 'test@example.com', password: 'secret' });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('secret');
  });

  it('lowercases email', () => {
    const result = loginSchema.parse({ email: 'TEST@Example.COM', password: 'secret' });
    expect(result.email).toBe('test@example.com');
  });

  it('rejects missing password', () => {
    expect(() => loginSchema.parse({ email: 'test@test.com' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => loginSchema.parse({ email: 'not-an-email', password: 'secret' })).toThrow();
  });
});

describe('createFarmSchema', () => {
  it('accepts valid farm data', () => {
    const result = createFarmSchema.parse({
      name: 'Test Farm',
      region: 'Ashanti',
      district: 'Kumasi',
    });
    expect(result.name).toBe('Test Farm');
    expect(result.country).toBe('GH');
  });

  it('rejects missing required fields', () => {
    expect(() => createFarmSchema.parse({ name: 'Test' })).toThrow();
  });
});

describe('pilot invitation schemas', () => {
  it('normalizes an invited email address', () => {
    expect(createInvitationSchema.parse({ email: 'PILOT@Example.COM' }).email).toBe('pilot@example.com');
  });

  it('requires a strong activation password', () => {
    expect(() => acceptInvitationSchema.parse({ name: 'Pilot User', password: 'weakpassword' })).toThrow();
    expect(acceptInvitationSchema.parse({ name: 'Pilot User', password: 'LongEnough123' }).name).toBe('Pilot User');
  });
});

describe('createBatchSchema', () => {
  it('accepts valid batch data', () => {
    const result = createBatchSchema.parse({
      farmId: '550e8400-e29b-41d4-a716-446655440000',
      harvestDate: '2024-10-01',
      quantityKg: 1000,
    });
    expect(result.quantityKg).toBe(1000);
    expect(result.crop).toBe('cocoa');
  });

  it('rejects negative quantity', () => {
    expect(() => createBatchSchema.parse({
      farmId: '550e8400-e29b-41d4-a716-446655440000',
      harvestDate: '2024-10-01',
      quantityKg: -1,
    })).toThrow();
  });
});

describe('createCertificateSchema', () => {
  it('accepts valid certificate data', () => {
    const result = createCertificateSchema.parse({
      farmerOrganizationId: '550e8400-e29b-41d4-a716-446655440001',
      farmId: '550e8400-e29b-41d4-a716-446655440002',
      validFrom: '2024-01-01',
      validTo: '2025-01-01',
      issuingAuthority: 'ECOCERT',
      accreditationReference: 'EU-2024-001',
    });
    expect(result.standard).toBe('EU_ORGANIC');
  });
});

describe('createSourcingRequestSchema', () => {
  it('accepts an evidence-backed buyer requirement', () => {
    const result = createSourcingRequestSchema.parse({
      title: 'Organic cocoa for Rotterdam', commodity: 'cocoa', quantityKg: 20000,
      originCountries: ['GH'], deliveryLocation: 'Rotterdam, Netherlands', status: 'open',
      qualityRequirements: { moistureMax: 7.5 }, assuranceRequirements: { euOrganic: true },
    });
    expect(result.incoterm).toBe('CIF');
    expect(result.visibility).toBe('matched');
  });

  it('rejects non-positive sourcing quantities', () => {
    expect(() => createSourcingRequestSchema.parse({ title: 'Organic cocoa', commodity: 'cocoa', quantityKg: 0, deliveryLocation: 'Rotterdam' })).toThrow();
  });
});

describe('createRecallSchema', () => {
  const notice = {
    referenceCode: 'REC-2026-001',
    title: 'Test recall',
    reason: 'Test hazard',
    instructions: 'Hold the affected lot',
    severity: 'warning' as const,
  };

  it('accepts a quantity-aware suspect lot', () => {
    const result = createRecallSchema.parse({
      ...notice,
      lots: [{ lotId: '550e8400-e29b-41d4-a716-446655440000', quantityKg: 125.5 }],
    });
    expect(result.lots[0].quantityKg).toBe(125.5);
    expect(result.batchIds).toEqual([]);
  });

  it('rejects a recall with no batch or lot scope', () => {
    expect(() => createRecallSchema.parse(notice)).toThrow(/At least one affected batch or suspect lot/);
  });
});
