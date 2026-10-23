import { describe, expect, it } from 'vitest';
import { structureSourcingBrief } from './sourcingStructurer';

describe('structureSourcingBrief', () => {
  it.each(['cocoyam', 'sorghum', 'millet', 'sweet potato', 'hibiscus flowers'])('extracts arbitrary material %s without a whitelist', (crop) => {
    const result = structureSourcingBrief(`10 metric tonnes of ${crop} from Ghana delivered to Berlin.`);
    expect(result.commodity).toBe(crop);
    expect(result.quantityKg).toBe(10000);
    expect(result.deliveryLocation).toBe('Berlin');
  });
  it('leaves unspecified material for manual review', () => {
    expect(structureSourcingBrief('10 tonnes of unspecified goods from Ghana.').commodity).toBe('');
  });
  it('extracts yam, metric tonnes and zero moisture without a cocoa fallback', () => {
    const result = structureSourcingBrief('1 metric tonne of Yam from Ghana. Moisture maximum 0%, delivered to Berlin by 15 November 2026. FOB.');
    expect(result).toMatchObject({ commodity: 'yam', quantityKg: 1000, qualityRequirements: { moistureMax: 0 }, deliveryLocation: 'Berlin', incoterm: 'FOB' });
    expect(result.unresolved).not.toContain('Commodity');
    expect(structureSourcingBrief('100 kg scorn from Ghana delivered to Tema.').commodity).toBe('scorn');
  });
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
