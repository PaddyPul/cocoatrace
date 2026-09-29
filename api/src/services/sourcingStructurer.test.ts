import { describe, expect, it } from 'vitest';
import { structureSourcingBrief } from './sourcingStructurer';

describe('structureSourcingBrief', () => {
  it('extracts an edited organic shea request without reverting to cocoa defaults', () => {
    const result = structureSourcingBrief('35 metric tons of fully organic shea nuts from Ghana, delivered to Hamburg by 20 December 2026. Require plot geolocation and EUDR data pack.');
    expect(result.commodity).toBe('shea nuts');
    expect(result.quantityKg).toBe(35000);
    expect(result.originCountries).toContain('GH');
    expect(result.deliveryLocation).toBe('Hamburg');
    expect(result.requiredBy).toBe('2026-12-20');
    expect(result.assuranceRequirements).toMatchObject({ organic: true, plotGeolocation: true, eudrDataPack: true });
  });

  it('does not invent organic assurance for conventional material', () => {
    const result = structureSourcingBrief('10,000 kg conventional cashew from Nigeria delivered to Tema. FOB.');
    expect(result.commodity).toBe('cashew');
    expect(result.quantityKg).toBe(10000);
    expect(result.assuranceRequirements.organic).toBeUndefined();
    expect(result.incoterm).toBe('FOB');
  });
});
