import { describe, expect, it } from 'vitest';
import { authorizePaymentDispatch, crossesDispatchBoundary, transitionDenial } from './policy';
import type { ProgressRow } from './model';

const shipment: ProgressRow = {
  id: 'shipment',
  contract_id: 'contract',
  current_milestone: 'cargo_ready',
  dispatch_exception: false,
  service_provider_name: null,
  booking_reference: null,
  transport_mode: null,
  origin_port: null,
  destination_port: null,
  seller_organization_id: 'seller',
  buyer_organization_id: 'buyer',
  transport_coordinator_organization_id: 'buyer',
  incoterm: 'FOB',
  payment_plan: 'pay_before_dispatch',
  payment_terms_status: 'agreed',
  credit_days: 0,
  contract_currency: 'EUR',
  payment_currency: 'EUR',
  contract_minor_units: 2,
  payment_minor_units: 2,
  holding_id: 'holding',
  contract_quantity_kg: '10.000',
  contract_status: 'accepted',
  payment_request_id: 'payment',
  amount_confirmed: '0',
  dispatch_required_amount: '100',
  security_status: 'not_required',
};
describe('transport transition authority and order', () => {
  it('keeps missing, foreign and other-party denials separate', () => {
    expect(transitionDenial(undefined, 'seller', 'loaded')?.status).toBe(404);
    expect(transitionDenial(shipment, 'outsider', 'loaded')).toEqual({
      status: 403,
      body: { error: 'Only a party can report progress' },
    });
    expect(transitionDenial(shipment, 'buyer', 'loaded')).toMatchObject({
      status: 403,
      body: { code: 'TRANSPORT_ACTION_FORBIDDEN' },
    });
    expect(transitionDenial(shipment, 'seller', 'loaded')).toBeNull();
  });
  it('rejects cancelled, terminal and repeated transitions without reordering authority', () => {
    expect(
      transitionDenial({ ...shipment, contract_status: 'cancelled' }, 'seller', 'loaded')?.status,
    ).toBe(409);
    expect(
      transitionDenial({ ...shipment, current_milestone: 'loaded' }, 'seller', 'loaded')?.status,
    ).toBe(400);
    expect(
      transitionDenial({ ...shipment, current_milestone: 'delivered' }, 'buyer', 'delivered')
        ?.status,
    ).toBe(400);
    expect(transitionDenial(shipment, 'seller', 'invented')).toMatchObject({
      status: 403,
      body: { code: 'TRANSPORT_ACTION_FORBIDDEN' },
    });
  });
  it('checks pickup crossing even when skipped, while keeping later arrival containment available', () => {
    expect(crossesDispatchBoundary('cargo_ready', 'arrived')).toBe(true);
    expect(crossesDispatchBoundary('cargo_ready', 'warehouse_received')).toBe(true);
    expect(crossesDispatchBoundary('loaded', 'departed')).toBe(true);
    expect(crossesDispatchBoundary('departed', 'arrived')).toBe(false);
    expect(crossesDispatchBoundary('arrived', 'delivered')).toBe(false);
    expect(crossesDispatchBoundary('planning', 'cargo_ready')).toBe(false);
  });
});
describe('payment-only exceptional dispatch authorization', () => {
  const exception = {
    reason: 'Seller accepts the recorded payment risk',
    acknowledgePaymentRisk: true as const,
  };
  it('requires the normal payment gate unless the seller explicitly accepts the exception', () => {
    expect(authorizePaymentDispatch(shipment, 'seller', undefined)).toMatchObject({
      kind: 'denied',
      response: { status: 409, body: { code: 'PAYMENT_DISPATCH_GATE' } },
    });
    expect(authorizePaymentDispatch(shipment, 'buyer', exception)).toMatchObject({
      kind: 'denied',
      response: { status: 403 },
    });
    expect(authorizePaymentDispatch(shipment, 'seller', exception)).toEqual({
      kind: 'exception',
      reason: exception.reason,
    });
  });
  it('does not manufacture exceptional risk when ordinary payment is sufficient', () => {
    expect(
      authorizePaymentDispatch({ ...shipment, amount_confirmed: '100' }, 'buyer', exception),
    ).toEqual({ kind: 'ordinary' });
  });
  it('preserves bank security and unagreed terms as gates', () => {
    expect(
      authorizePaymentDispatch(
        { ...shipment, payment_plan: 'bank_secured', amount_confirmed: '100' },
        'seller',
        undefined,
      ),
    ).toMatchObject({ kind: 'denied', response: { status: 409 } });
    expect(
      authorizePaymentDispatch(
        { ...shipment, payment_terms_status: 'proposed', amount_confirmed: '100' },
        'seller',
        undefined,
      ),
    ).toMatchObject({ kind: 'denied', response: { status: 409 } });
  });
});
