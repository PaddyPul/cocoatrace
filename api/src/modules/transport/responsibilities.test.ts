import { describe, expect, it } from 'vitest';
import {
  canArrange,
  canRecord,
  coordinatorParty,
  incoterms,
  milestoneOrder,
  progressPrerequisite,
  transportPermissions,
} from './responsibilities';
const seller = 's',
  buyer = 'b';
const expected: Record<string, string[]> = {
  EXW: ['buyer', 'seller', 'buyer', 'buyer', 'buyer', 'buyer', 'buyer', 'buyer', 'buyer'],
  FCA: ['buyer', 'seller', 'seller', 'seller', 'buyer', 'buyer', 'buyer', 'buyer', 'buyer'],
  FAS: ['buyer', 'seller', 'seller', 'buyer', 'buyer', 'buyer', 'buyer', 'buyer', 'buyer'],
  FOB: ['buyer', 'seller', 'seller', 'seller', 'buyer', 'buyer', 'buyer', 'buyer', 'buyer'],
  CFR: ['seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'buyer', 'buyer', 'buyer'],
  CIF: ['seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'buyer', 'buyer', 'buyer'],
  CPT: ['seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'buyer', 'buyer', 'buyer'],
  CIP: ['seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'buyer', 'buyer', 'buyer'],
  DAP: ['seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'buyer', 'buyer', 'buyer'],
  DPU: ['seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'buyer', 'seller', 'buyer'],
  DDP: ['seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'seller', 'buyer', 'buyer'],
};
const milestones = [
  'booked',
  'cargo_ready',
  'export_cleared',
  'loaded',
  'departed',
  'arrived',
  'customs_cleared',
  'unloaded',
  'delivered',
];
describe('Incoterm contract-party authority', () => {
  for (const term of incoterms)
    it(`${term}: every action belongs to exactly one contract party`, () => {
      const f = {
        incoterm: term,
        seller_organization_id: seller,
        buyer_organization_id: buyer,
        transport_coordinator_organization_id: expected[term][0] === 'buyer' ? buyer : seller,
        current_milestone: 'planning',
      };
      for (const [i, m] of milestones.entries()) {
        expect(canRecord(f, seller, m)).toBe(expected[term][i] === 'seller');
        expect(canRecord(f, buyer, m)).toBe(expected[term][i] === 'buyer');
        expect(canRecord(f, 'other', m)).toBe(false);
      }
      expect(canArrange(f, seller)).toBe(expected[term][0] === 'seller');
      expect(canArrange(f, buyer)).toBe(expected[term][0] === 'buyer');
      expect(canArrange(f, 'other')).toBe(false);
      for (const m of milestoneOrder)
        expect([canRecord(f, seller, m), canRecord(f, buyer, m)].filter(Boolean)).toHaveLength(1);
    });
  it('fails closed for unsupported terms, ambiguous self-trades and coordinator drift', () => {
    const f = {
      incoterm: 'FOB',
      seller_organization_id: seller,
      buyer_organization_id: buyer,
      transport_coordinator_organization_id: seller,
    };
    expect(canArrange(f, seller)).toBe(false);
    expect(canArrange(f, buyer)).toBe(false);
    expect(coordinatorParty('CUSTOM')).toBeNull();
    expect(canRecord({ ...f, incoterm: 'CUSTOM' }, seller, 'loaded')).toBe(false);
    expect(canRecord({ ...f, buyer_organization_id: seller }, seller, 'loaded')).toBe(false);
    expect(canRecord(f, seller, 'invented')).toBe(false);
  });
  it('cannot infer origin confirmation from a skipped later status', () => {
    const f = {
      incoterm: 'FOB',
      seller_organization_id: seller,
      buyer_organization_id: buyer,
      current_milestone: 'arrived',
      origin_confirmed: false,
    };
    expect(progressPrerequisite(f, 'delivered')).toBeTruthy();
    expect(progressPrerequisite({ ...f, origin_confirmed: true }, 'delivered')).toBeNull();
    expect(progressPrerequisite({ ...f, incoterm: 'EXW' }, 'loaded')).toBeTruthy();
    expect(progressPrerequisite({ ...f, incoterm: 'FAS' }, 'loaded')).toBeTruthy();
  });
  it('requires DPU unloading and DDP clearance independently of buyer receipt', () => {
    const f = {
      seller_organization_id: seller,
      buyer_organization_id: buyer,
      current_milestone: 'arrived',
      origin_confirmed: true,
    };
    expect(
      progressPrerequisite({ ...f, incoterm: 'DPU', unloading_confirmed: false }, 'delivered'),
    ).toBeTruthy();
    expect(
      progressPrerequisite({ ...f, incoterm: 'DDP', import_confirmed: false }, 'delivered'),
    ).toBeTruthy();
  });
  it('returns role-specific future actions rather than a broad coordinator entitlement', () => {
    const f = {
      incoterm: 'FOB',
      seller_organization_id: seller,
      buyer_organization_id: buyer,
      current_milestone: 'booked',
    };
    expect(transportPermissions(f, buyer).milestones).not.toContain('cargo_ready');
    expect(transportPermissions(f, seller).milestones).toContain('cargo_ready');
  });
});
