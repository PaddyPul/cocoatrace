import { describe, expect, it } from 'vitest';
import { buildJourney, deriveSafetyStatus } from './publicProduct';

describe('public product helpers', () => {
  it('orders farm-to-fork events chronologically', () => {
    const journey = buildJourney([
      [{ type: 'shipment', title: 'Shipped', summary: '', occurredAt: '2024-11-04T06:00:00Z' }],
      [{ type: 'harvest', title: 'Harvested', summary: '', occurredAt: '2024-10-12T00:00:00Z' }],
    ]);
    expect(journey.map((event) => event.type)).toEqual(['harvest', 'shipment']);
  });

  it('uses the highest active recall severity', () => {
    expect(deriveSafetyStatus([
      { status: 'resolved', severity: 'critical' },
      { status: 'active', severity: 'warning' },
      { status: 'active', severity: 'advisory' },
    ])).toBe('warning');
  });

  it('is clear when there are no active recalls', () => {
    expect(deriveSafetyStatus([])).toBe('clear');
  });
});
