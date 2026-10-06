import { describe, expect, it } from 'vitest';
import { buildTradeActions as policy, type DealFact, type OfferFact } from './tradeNextAction';

const buildTradeActions = (
  offers: OfferFact[],
  deals: DealFact[],
  organizationId: string,
  grants: readonly string[] = ['*'],
) => policy(offers, deals, organizationId, grants);

const seller = 'seller',
  buyer = 'buyer';
const deal = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'deal',
    seller_organization_id: seller,
    buyer_organization_id: buyer,
    seller_name: 'Supplier',
    buyer_name: 'Buyer',
    payment_terms_status: 'draft',
    payment_plan: 'deposit_balance',
    status: 'accepted',
    ...extra,
  }) as DealFact;

describe('role-aware trade next actions', () => {
  it('asks the supplier to configure terms before the buyer can confirm', () => {
    expect(buildTradeActions([], [deal()], seller)[0]).toMatchObject({
      kind: 'configure_terms',
      requiresAction: true,
    });
    expect(buildTradeActions([], [deal()], buyer)[0]).toMatchObject({
      kind: 'waiting',
      requiresAction: false,
      title: 'Offer accepted—supplier preparing payment terms',
    });
  });
  it('asks only the buyer to confirm proposed terms', () => {
    expect(
      buildTradeActions([], [deal({ payment_terms_status: 'proposed' })], buyer)[0],
    ).toMatchObject({ kind: 'confirm_terms', requiresAction: true });
    expect(
      buildTradeActions([], [deal({ payment_terms_status: 'proposed' })], seller)[0].requiresAction,
    ).toBe(false);
  });
  it('separates buyer payment submission from seller verification', () => {
    const due = deal({
      payment_terms_status: 'agreed',
      installment_status: 'due',
      amount_due: 200,
      currency: 'EUR',
    });
    expect(buildTradeActions([], [due], buyer)[0].kind).toBe('payment');
    const submitted = deal({
      payment_terms_status: 'agreed',
      installment_status: 'payment_submitted',
    });
    expect(buildTradeActions([], [submitted], seller)[0].kind).toBe('payment_verification');
  });
  it('puts a pending offer on the seller action list and buyer waiting list', () => {
    const offer = {
      id: 'offer',
      status: 'pending',
      seller_organization_id: seller,
      buyer_organization_id: buyer,
    };
    expect(buildTradeActions([offer], [], seller)[0]).toMatchObject({
      kind: 'offer_decision',
      requiresAction: true,
    });
    expect(buildTradeActions([offer], [], buyer)[0]).toMatchObject({
      kind: 'offer_waiting',
      requiresAction: false,
    });
  });
});

describe('delivery consent', () => {
  it('prompts the buyer to inspect delivered goods independently of payment', () => {
    const delivered = deal({
      payment_terms_status: 'agreed',
      current_milestone: 'delivered',
      payment_status: 'settled',
    });
    expect(buildTradeActions([], [delivered], buyer)[0]).toMatchObject({
      kind: 'delivery',
      requiresAction: true,
      title: 'Inspect and accept delivered goods',
    });
    expect(buildTradeActions([], [delivered], seller)[0].requiresAction).toBe(false);
  });
  it('prioritizes supplier resolution and buyer approval during a discrepancy', () => {
    expect(
      buildTradeActions([], [deal({ delivery_discrepancy_status: 'open' })], seller)[0]
        .requiresAction,
    ).toBe(true);
    expect(
      buildTradeActions(
        [],
        [deal({ delivery_discrepancy_status: 'resolution_proposed' })],
        buyer,
      )[0].requiresAction,
    ).toBe(true);
  });
});

it('prioritizes the other organization’s cancellation review and never asks a cancelled trade to pay', () => {
  expect(
    buildTradeActions([], [deal({ cancellation_requested_by_organization_id: seller })], buyer)[0],
  ).toMatchObject({ requiresAction: true, title: 'Review cancellation request' });
  expect(
    buildTradeActions([], [deal({ cancellation_requested_by_organization_id: seller })], seller)[0]
      .requiresAction,
  ).toBe(false);
  expect(
    buildTradeActions([], [deal({ status: 'cancelled', installment_status: 'due' })], buyer)[0],
  ).toMatchObject({ requiresAction: false, title: 'Trade cancelled', kind: 'complete' });
});

describe('separate platform fee action', () => {
  it('keeps trade completed while prompting only the recorded fee payer', () => {
    const d = deal({
      status: 'settled',
      fee_status: 'invoiced',
      fee_payer_organization_id: seller,
      fee_amount: '0.20',
    });
    const supplierActions = buildTradeActions([], [d], seller);
    expect(supplierActions.some((a) => a.title === 'Trade completed')).toBe(true);
    expect(supplierActions[0]).toMatchObject({
      title: 'Review and pay the platform fee',
      requiresAction: true,
    });
    expect(buildTradeActions([], [d], buyer).some((a) => a.id.endsWith(':fee'))).toBe(false);
  });
  it('submitted fee waits for platform receipt and zero fees never prompt payment', () => {
    const d = deal({
      status: 'settled',
      fee_status: 'invoiced',
      fee_payer_organization_id: seller,
      fee_amount: '0.20',
      fee_payment_submitted: true,
    });
    expect(buildTradeActions([], [d], seller)[0]).toMatchObject({
      title: 'Platform fee awaiting receipt verification',
      requiresAction: false,
    });
    expect(
      buildTradeActions([], [deal({ ...d, fee_amount: '0.00' })], seller).some((a) =>
        a.id.endsWith(':fee'),
      ),
    ).toBe(false);
  });
});

describe('Incoterm dashboard handoffs', () => {
  it('FOB cargo preparation belongs to seller after buyer booking', () => {
    const d = deal({
      incoterm: 'FOB',
      payment_terms_status: 'agreed',
      current_milestone: 'booked',
      transport_coordinator_organization_id: buyer,
    });
    expect(buildTradeActions([], [d], seller)[0]).toMatchObject({
      requiresAction: true,
      title: 'Next transport action: cargo ready',
    });
    expect(buildTradeActions([], [d], buyer)[0]).toMatchObject({
      requiresAction: false,
      title: 'Awaiting seller: cargo ready',
    });
  });
  it('DDP clearance and DPU unloading stay with seller before buyer receipt', () => {
    for (const [incoterm, current_milestone] of [
      ['DDP', 'arrived'],
      ['DPU', 'customs_cleared'],
    ]) {
      const d = deal({
        incoterm,
        current_milestone,
        payment_terms_status: 'agreed',
        transport_coordinator_organization_id: seller,
      });
      expect(buildTradeActions([], [d], seller)[0].requiresAction).toBe(true);
      expect(buildTradeActions([], [d], buyer)[0].requiresAction).toBe(false);
    }
  });
});

describe('one permitted action policy across workspaces', () => {
  const ready = (extra: Partial<DealFact> = {}) =>
    deal({
      payment_terms_status: 'agreed',
      payment_plan: 'pay_before_dispatch',
      payment_request_id: 'payment',
      incoterm: 'FOB',
      transport_coordinator_organization_id: buyer,
      shipment_id: 'shipment',
      amount_confirmed: '20.00',
      dispatch_required_amount: '20.00',
      ...extra,
    });
  it('never leaks foreign or ambiguous-party actions, including pending offers', () => {
    expect(buildTradeActions([], [ready()], 'outsider')).toEqual([]);
    expect(buildTradeActions([], [ready({ buyer_organization_id: seller })], seller)).toEqual([]);
    expect(
      buildTradeActions(
        [
          {
            id: 'offer',
            status: 'pending',
            buyer_organization_id: buyer,
            seller_organization_id: seller,
          },
        ],
        [],
        'outsider',
      ),
    ).toEqual([]);
    expect(buildTradeActions([], [ready()], buyer, [])).toEqual([]);
  });
  it('a read-only colleague sees the dependency without being prompted to mutate', () => {
    expect(
      buildTradeActions([], [ready({ installment_status: 'due', installment_id: 'i' })], buyer, [
        'contract.read',
      ])[0],
    ).toMatchObject({
      requiresAction: false,
      operation: 'view',
      title: 'Awaiting an authorized colleague',
    });
    expect(
      buildTradeActions(
        [],
        [ready({ installment_status: 'payment_submitted', installment_id: 'i' })],
        seller,
        ['contract.read'],
      )[0].requiresAction,
    ).toBe(false);
    expect(
      buildTradeActions([], [ready({ current_milestone: 'booked' })], seller, ['contract.read'])[0]
        .requiresAction,
    ).toBe(false);
  });
  it('selects the exact installment for buyer submission and seller verification', () => {
    expect(
      buildTradeActions(
        [],
        [ready({ installment_status: 'due', installment_id: 'deposit' })],
        buyer,
      )[0],
    ).toMatchObject({ operation: 'submit_payment', installmentId: 'deposit' });
    expect(
      buildTradeActions(
        [],
        [ready({ installment_status: 'payment_submitted', installment_id: 'deposit' })],
        seller,
      )[0],
    ).toMatchObject({ operation: 'verify_payment', installmentId: 'deposit' });
  });
  it.each([
    'pay_before_dispatch',
    'deposit_balance',
    'bank_secured',
    'documentary_collection',
    'pay_after_delivery',
  ])('keeps %s supplier preparation before buyer confirmation', (payment_plan) => {
    const draft = deal({ payment_plan });
    expect(buildTradeActions([], [draft], seller)[0].operation).toBe('configure_terms');
    expect(buildTradeActions([], [draft], buyer)[0].operation).toBe('view');
    expect(
      buildTradeActions([], [deal({ ...draft, payment_terms_status: 'proposed' })], buyer)[0]
        .operation,
    ).toBe('confirm_terms');
  });
  it('uses exact dispatch money, including JPY, instead of a floating tolerance', () => {
    for (const [amount_confirmed, dispatch_required_amount, currency_minor_units] of [
      ['19.99', '20.00', 2],
      ['19', '20', 0],
    ] as const) {
      expect(
        buildTradeActions(
          [],
          [ready({ amount_confirmed, dispatch_required_amount, currency_minor_units })],
          buyer,
        )[0],
      ).toMatchObject({ title: 'Dispatch remains blocked', requiresAction: false });
    }
  });
  it('never recommends dispatch while a payment issue or recall hold is active', () => {
    expect(
      buildTradeActions([], [ready({ payment_issue_status: 'open' })], buyer)[0],
    ).toMatchObject({ title: 'Resolve the payment issue', requiresAction: false });
    expect(buildTradeActions([], [ready({ recall_held: true })], seller)[0]).toMatchObject({
      title: 'Trade on recall safety hold',
      requiresAction: false,
    });
  });
  it('presents documents after handover, before document-triggered payment or delivery acceptance', () => {
    const d = ready({
      payment_plan: 'documentary_collection',
      dispatch_required_amount: '0',
      amount_confirmed: '0',
      documents_pending: true,
      current_milestone: 'loaded',
    });
    expect(buildTradeActions([], [d], seller)[0]).toMatchObject({
      operation: 'documents',
      requiresAction: true,
    });
    expect(buildTradeActions([], [d], buyer)[0]).toMatchObject({
      title: 'Awaiting supplier trade documents',
      requiresAction: false,
    });
    expect(
      buildTradeActions([], [ready({ ...d, current_milestone: 'delivered' })], buyer)[0].kind,
    ).toBe('waiting');
  });
  it('keeps due payments visible after delivery and then prompts buyer acceptance', () => {
    const delivered = ready({
      current_milestone: 'delivered',
      installment_status: 'due',
      installment_id: 'final',
    });
    expect(buildTradeActions([], [delivered], buyer)[0].operation).toBe('submit_payment');
    expect(
      buildTradeActions([], [ready({ ...delivered, installment_status: undefined })], buyer)[0]
        .kind,
    ).toBe('delivery');
  });
  it.each(['EXW', 'FCA', 'FAS', 'FOB', 'CPT', 'CIP', 'CFR', 'CIF', 'DAP', 'DPU', 'DDP'])(
    '%s has one responsible party for onward departure',
    (incoterm) => {
      const d = ready({
        incoterm,
        current_milestone: 'loaded',
        transport_coordinator_organization_id: ['EXW', 'FCA', 'FAS', 'FOB'].includes(incoterm)
          ? buyer
          : seller,
      });
      const a = buildTradeActions([], [d], buyer)[0],
        b = buildTradeActions([], [d], seller)[0];
      expect(Number(a.requiresAction) + Number(b.requiresAction)).toBe(1);
      expect((a.requiresAction ? a : b).operation).toBe('transport');
    },
  );
});

it('defaults to no permissions and fails closed on hydrated missing payment protection', () => {
  expect(policy([], [deal()], seller)).toEqual([]);
  expect(
    buildTradeActions(
      [],
      [deal({ facts_loaded: true, payment_terms_status: 'agreed' })],
      seller,
    )[0],
  ).toMatchObject({ requiresAction: false, title: 'Payment protection needs review' });
});
