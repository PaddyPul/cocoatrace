import { privateShipmentDetail } from '../transport/privateShipmentDetail';
import { legacyShipments } from '../catalog/shipments';
import { withCatalogRead } from '../catalog/paging';
import { writeTiming, lockTimingActor } from '../transportTiming/write';
import { loadOriginConfirmations } from '../transport/confirmations';
import {
  canArrange,
  progressPrerequisite,
  milestoneOrder,
  missingDepartureArrangement,
} from '../transport/responsibilities';
import { activatePaymentInstallments } from '../payments/dueDates';
import { lockRecallBoundary, assertBatchNotRecalled } from '../recall/safety';
import { getClient } from '../../db';
import { transitionDenial, crossesDispatchBoundary, authorizePaymentDispatch } from './policy';
import { recordTradeAudit } from '../trading/transaction';
import { completeTradeIfReady } from '../../services/tradeSettlement';
import type { AuthenticatedActor } from '../../services/authSessionService';
import type { ArrangementInput, MilestoneInput, WorkflowResult } from './model';
import * as repository from './repository';
const MILESTONE_ORDER: readonly string[] = milestoneOrder;
export async function updateArrangement(
  actor: AuthenticatedActor,
  id: string,
  input: ArrangementInput,
): Promise<WorkflowResult> {
  const {
    serviceProviderName,
    bookingReference,
    transportMode,
    transportDocumentType,
    transportDocumentReference,
    trackingUrl,
    vesselName,
    containerReference,
    originLocation,
    destinationLocation,
    etaArrival,
    delayReason,
    timingRevision,
  } = input;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    if (etaArrival) await lockTimingActor(client, actor);
    await lockRecallBoundary(client);
    const selected = await repository.lockArrangement(client, [id, actor.organizationId]);
    if (!selected.rows[0] || !canArrange(selected.rows[0], actor.organizationId)) {
      await client.query('ROLLBACK');
      return {
        status: 403,
        body: {
          error: 'Only the assigned contract party may edit this arrangement',
          code: 'TRANSPORT_ACTION_FORBIDDEN',
        },
      };
    }
    if (selected.rows[0]?.status === 'cancelled') {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: 'This trade has been cancelled' } };
    }
    if (etaArrival) await writeTiming(client, actor, id, etaArrival, delayReason, timingRevision);
    const { rows } = await repository.saveArrangement(client, [
      serviceProviderName || null,
      bookingReference || null,
      transportMode || null,
      transportDocumentType || null,
      transportDocumentReference || null,
      trackingUrl || null,
      vesselName || null,
      containerReference || null,
      originLocation || null,
      destinationLocation || null,
      etaArrival || null,
      id,
      actor.organizationId,
    ]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return {
        status: 403,
        body: {
          error:
            'Only the buyer or seller assigned by the Incoterm can edit the transport arrangement',
        },
      };
    }
    if (rows[0].current_milestone === 'booked') {
      await repository.recordBooking(client, [id, actor.id]);
      await repository.startFulfilment(client, [rows[0].contract_id]);
    }
    await recordTradeAudit(client, actor, 'transport.arrangement.update', 'shipment', id);
    await client.query('COMMIT');
    return { status: 200, body: rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordMilestone(
  actor: AuthenticatedActor,
  id: string,
  input: MilestoneInput,
): Promise<WorkflowResult> {
  const { milestone, location, notes, exceptionalDispatch } = input,
    client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const r = await repository.lockProgress(client, [id]);
    const s = r.rows[0],
      org = actor.organizationId;
    const denial = transitionDenial(s, org, milestone);
    if (denial) {
      await client.query('ROLLBACK');
      return denial;
    }
    const next = MILESTONE_ORDER.indexOf(milestone);
    // A safety recall cannot be overridden by the exceptional-payment dispatch option.
    // Arrival, customs and receipt records stay available for containment and recovery.
    const crosses = crossesDispatchBoundary(s.current_milestone, milestone);
    if (crosses) {
      const holding = await repository.findHolding(client, [s.holding_id]);
      if (holding.rows[0]) await assertBatchNotRecalled(client, holding.rows[0].batch_id);
    }
    let exception = false;
    let exceptionReason: string | null = null;
    if (
      crosses &&
      (s.contract_currency !== s.payment_currency ||
        s.contract_minor_units !== s.payment_minor_units)
    ) {
      await client.query('ROLLBACK');
      return {
        status: 409,
        body: {
          error:
            'Payment currency differs from the contract; resolve the discrepancy before dispatch.',
          code: 'CURRENCY_MISMATCH',
        },
      };
    }
    if (crosses) {
      const issue = await repository.findPaymentIssue(client, [s.payment_request_id]);
      if (issue.rows[0]) {
        await client.query('ROLLBACK');
        return {
          status: 409,
          body: {
            error: 'Resolve the active payment issue before dispatch',
            code: 'PAYMENT_ISSUE_HOLD',
          },
        };
      }
    }
    if (crosses) {
      const authorization = authorizePaymentDispatch(s, org, exceptionalDispatch);
      if (authorization.kind === 'denied') {
        await client.query('ROLLBACK');
        return authorization.response;
      }
      if (authorization.kind === 'exception') {
        exception = true;
        exceptionReason = authorization.reason;
        await repository.recordDispatchException(client, [authorization.reason, actor.id, id]);
      }
    }
    if (milestone === 'departed') {
      const missingFields = missingDepartureArrangement(s);
      if (missingFields.length) {
        await client.query('ROLLBACK');
        return {
          status: 409,
          body: {
            error: `The arranging party must complete ${missingFields.join(', ')} in the transport arrangement before departure.`,
            code: 'TRANSPORT_ARRANGEMENT_REQUIRED',
            missingFields,
          },
        };
      }
    }
    const confirmations = await loadOriginConfirmations(client, id, s);
    const prerequisite = progressPrerequisite({ ...s, ...confirmations }, milestone);
    if (prerequisite) {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: prerequisite, code: 'TRANSPORT_PREREQUISITE' } };
    }
    await repository.insertMilestone(client, [
      id,
      milestone,
      actor.id,
      location || null,
      notes || null,
    ]);
    if (next >= MILESTONE_ORDER.indexOf('loaded'))
      await repository.markInTransit(client, [
        exception || s.dispatch_exception ? 'payment_risk_exception' : 'in_transit',
        s.contract_id,
      ]);
    if (milestone === 'delivered') {
      await activatePaymentInstallments(client, s.payment_request_id, 'delivery', {
        creditDays: Number(s.credit_days || 0),
      });
      const due = await repository.findDueInstallment(client, [s.payment_request_id]);
      if (due.rows[0]) await repository.markPaymentDue(client, [s.payment_request_id]);
      await repository.markDelivered(client, [
        exception || s.dispatch_exception ? 'delivered_payment_risk' : 'delivered',
        s.contract_id,
      ]);
      await repository.recordDistribution(client, [
        id,
        s.buyer_organization_id,
        s.contract_quantity_kg,
        `SHIP-${id}`,
        s.holding_id,
      ]);
    }
    const { rows } = await repository.saveMilestone(client, [milestone, id], milestone);
    if (milestone === 'delivered') await completeTradeIfReady(client, s.contract_id, actor);
    await recordTradeAudit(client, actor, `transport.milestone.${milestone}`, 'shipment', id, {
      reason: exceptionReason,
      incoterm: s.incoterm,
      recordingParty: org === s.seller_organization_id ? 'seller' : 'buyer',
      source: ['departed', 'arrived'].includes(milestone)
        ? 'party_report_of_external_provider'
        : 'contract_party_confirmation',
    });
    await client.query('COMMIT');
    return { status: 200, body: { ...rows[0], dispatchExceptionRecorded: exception } };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listShipments(actor: AuthenticatedActor) {
  return {
    status: 200,
    body: await withCatalogRead((execute) => legacyShipments(execute, actor.organizationId)),
  };
}
export async function getShipment(actor: AuthenticatedActor, id: string) {
  const detail = await withCatalogRead((execute) =>
    privateShipmentDetail(execute, id, actor.organizationId),
  );
  return detail
    ? { status: 200, body: detail }
    : { status: 404, body: { error: 'Transport record not found' } };
}
