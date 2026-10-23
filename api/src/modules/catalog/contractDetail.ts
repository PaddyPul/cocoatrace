import type { AuthenticatedActor } from '../../services/authSessionService';
import { withCatalogRead } from './paging';
import { loadTradeActions } from '../../services/tradeActionRepository';
import { dispatchDecision } from '../../services/paymentProtection';
import { AppError } from '../../errors';
export async function readContractDetail(actor: AuthenticatedActor, id: string) {
  return withCatalogRead(async (snapshot) => {
    const execute = snapshot;
    const { rows } = await execute(
      `SELECT c.*, s.name as seller_name, b.name as buyer_name,
            ship.id as shipment_id, ship.vessel_name, ship.current_milestone, ship.eta_arrival, ship.container_reference,
            ship.dispatch_exception, ship.dispatch_exception_reason,
            ship.transport_coordinator_organization_id, ship.service_provider_name, ship.booking_reference,
            ship.transport_mode, ship.transport_document_type, ship.transport_document_reference, ship.tracking_url,
            coordinator.name as transport_coordinator_name,
            pay.id as payment_request_id, pay.status as payment_status, pay.amount_total as payment_amount,
            pay.currency as payment_currency, pay.payment_reference_external, pay.dispatch_required_amount, pay.amount_confirmed,
            pay.documents_submission_error_code,pay.documents_submission_checked_at,pay.security_status,pay.security_provider,pay.security_reference,pay.release_status,pay.documents_presented_at,
            fee.id as platform_fee_invoice_id,fee.fee_payer,fee.rate_bps as platform_fee_rate_bps,fee.amount_total as platform_fee_amount,fee.status as platform_fee_status
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     LEFT JOIN LATERAL (SELECT * FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) ship ON TRUE
     LEFT JOIN organizations coordinator ON coordinator.id=ship.transport_coordinator_organization_id
     LEFT JOIN LATERAL (SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) pay ON TRUE
     LEFT JOIN platform_fee_invoices fee ON fee.contract_id=c.id
     WHERE c.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
      [id, actor.organizationId],
    );
    if (!rows[0]) {
      return null;
    }
    const contract = rows[0] as Record<string, unknown> & {
      payment_plan: Parameters<typeof dispatchDecision>[0]['plan'];
      payment_terms_status: string;
      amount_confirmed: string | number;
      dispatch_required_amount: string | number;
      security_status: string;
      currency_minor_units: number;
    };
    const documents = await execute(
      `SELECT e.id, e.type, e.file_name, e.file_size_bytes, e.mime_type, e.sha256_hash,
            e.claim_description, e.review_status, e.validation_status, e.malware_scan_status, e.created_at, e.uploader_organization_id, o.name as uploader_name
     FROM evidence_items e
     JOIN organizations o ON o.id=e.uploader_organization_id
     WHERE e.linked_entity_type='contract' AND e.linked_entity_id=$1
     ORDER BY e.created_at DESC, e.id DESC LIMIT 1001`,
      [id],
    );
    const installments = contract.payment_request_id
      ? await execute(
          'SELECT * FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number LIMIT 1001',
          [contract.payment_request_id],
        )
      : { rows: [] };
    if (documents.rows.length > 1000 || installments.rows.length > 1000) {
      throw new AppError(
        'Contract detail exceeds the complete record limit. Contact the platform operator.',
        422,
        'CATALOG_READ_LIMIT',
      );
    }
    const acceptance = await execute(
      'SELECT accepted_at FROM delivery_acceptances WHERE contract_id=$1',
      [id],
    );
    const discrepancy = await execute(
      "SELECT status FROM delivery_discrepancies WHERE contract_id=$1 AND status<>'resolved' LIMIT 1",
      [id],
    );
    const nextAction = (await loadTradeActions(actor, id, snapshot))[0] || null;
    const dispatchGate =
      !contract.payment_request_id ||
      contract.amount_confirmed == null ||
      contract.dispatch_required_amount == null
        ? { allowed: false, reason: 'Payment protection record is missing.' }
        : nextAction?.id.endsWith(':hold') || nextAction?.id.endsWith(':unavailable')
          ? { allowed: false, reason: nextAction.description }
          : dispatchDecision({
              plan: contract.payment_plan,
              termsStatus: contract.payment_terms_status,
              amountConfirmed: contract.amount_confirmed || '0',
              dispatchRequiredAmount: contract.dispatch_required_amount || '0',
              securityStatus: contract.security_status,
              currencyMinorUnits: contract.currency_minor_units,
            });
    return {
      ...contract,
      nextAction,
      dispatchGate,
      delivery_accepted_at: acceptance.rows[0]?.accepted_at || null,
      delivery_discrepancy_status: discrepancy.rows[0]?.status || null,
      documents: documents.rows,
      installments: installments.rows,
    };
  });
}
