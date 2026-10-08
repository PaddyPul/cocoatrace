import { legacyOffers } from '../modules/catalog/offers';
import { withCatalogRead } from '../modules/catalog/paging';
import { loadTradeActions } from '../services/tradeActionRepository';
import {dispatchDecision} from '../services/paymentProtection';
import { agreePaymentTerms, proposePaymentTerms, type PaymentTermsInput } from '../modules/payments/terms';
import { config } from '../config/env';
import { AppError } from '../errors';
import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';
import { acceptTradeOffer, createTradeOffer, rejectTradeOffer } from '../modules/trading/offers';

export async function listOffers(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute=>legacyOffers(execute,req.user!.organizationId)));
}

export async function makeOffer(req: Request, res: Response): Promise<void> {
  const offer = await createTradeOffer(req.user!, req.params.id as string, req.body);
  res.status(201).json(offer);
}

export async function acceptOffer(req: Request, res: Response): Promise<void> {
  res.json(await acceptTradeOffer(req.user!, req.params.id as string, req.body?.feeRateBps));
}

export async function rejectOffer(req: Request, res: Response): Promise<void> {
  res.json(await rejectTradeOffer(req.user!, req.params.id as string));
}

export async function listContracts(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name, h.quantity_kg as holding_qty
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     JOIN batch_holdings h ON h.id = c.holding_id
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY c.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function getContract(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name,
            ship.id as shipment_id, ship.vessel_name, ship.current_milestone, ship.eta_arrival, ship.container_reference,
            ship.dispatch_exception, ship.dispatch_exception_reason,
            ship.transport_coordinator_organization_id, ship.service_provider_name, ship.booking_reference,
            ship.transport_mode, ship.transport_document_type, ship.transport_document_reference, ship.tracking_url,
            coordinator.name as transport_coordinator_name,
            pay.id as payment_request_id, pay.status as payment_status, pay.amount_total as payment_amount,
            pay.currency as payment_currency, pay.payment_reference_external, pay.dispatch_required_amount, pay.amount_confirmed,
            pay.security_status,pay.security_provider,pay.security_reference,pay.release_status,pay.documents_presented_at,
            fee.id as platform_fee_invoice_id,fee.fee_payer,fee.rate_bps as platform_fee_rate_bps,fee.amount_total as platform_fee_amount,fee.status as platform_fee_status
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     LEFT JOIN LATERAL (SELECT * FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) ship ON TRUE
     LEFT JOIN organizations coordinator ON coordinator.id=ship.transport_coordinator_organization_id
     LEFT JOIN LATERAL (SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) pay ON TRUE
     LEFT JOIN platform_fee_invoices fee ON fee.contract_id=c.id
     WHERE c.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
    [id, req.user!.organizationId]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }
  const documents = await query(
    `SELECT e.id, e.type, e.file_name, e.file_size_bytes, e.mime_type, e.sha256_hash,
            e.claim_description, e.review_status, e.validation_status, e.malware_scan_status, e.created_at, o.name as uploader_name
     FROM evidence_items e
     JOIN organizations o ON o.id=e.uploader_organization_id
     WHERE e.linked_entity_type='contract' AND e.linked_entity_id=$1
     ORDER BY e.created_at DESC`,
    [id]
  );
  const installments=rows[0].payment_request_id?await query('SELECT * FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number',[rows[0].payment_request_id]):{rows:[]};
  const acceptance = await query('SELECT accepted_at FROM delivery_acceptances WHERE contract_id=$1', [id]);
  const discrepancy = await query("SELECT status FROM delivery_discrepancies WHERE contract_id=$1 AND status<>'resolved' LIMIT 1", [id]);
  const nextAction=(await loadTradeActions(req.user!,id))[0]||null;
  const dispatchGate=(!rows[0].payment_request_id||rows[0].amount_confirmed==null||rows[0].dispatch_required_amount==null)?{allowed:false,reason:'Payment protection record is missing.'}:(nextAction?.id.endsWith(':hold')||nextAction?.id.endsWith(':unavailable'))?{allowed:false,reason:nextAction.description}:dispatchDecision({plan:rows[0].payment_plan,termsStatus:rows[0].payment_terms_status,amountConfirmed:rows[0].amount_confirmed||'0',dispatchRequiredAmount:rows[0].dispatch_required_amount||'0',securityStatus:rows[0].security_status,currencyMinorUnits:rows[0].currency_minor_units});
  res.json({ ...rows[0], nextAction, dispatchGate, delivery_accepted_at: acceptance.rows[0]?.accepted_at || null, delivery_discrepancy_status: discrepancy.rows[0]?.status || null, documents: documents.rows, installments:installments.rows });
}

// Preserve the existing HTTP response shape while the service owns transaction policy.
export async function updatePaymentTerms(req: Request, res: Response): Promise<void> {
  try {
    res.json(await proposePaymentTerms(req.user!, req.params.id as string, req.body as PaymentTermsInput));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    res.status(error.statusCode).json({ error: error.message });
  }
}

export async function confirmPaymentTerms(req: Request, res: Response): Promise<void> {
  try {
    res.json(await agreePaymentTerms(req.user!, req.params.id as string));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    res.status(error.statusCode).json({ error: error.message });
  }
}

export async function updateEudrReference(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { eudrDueDiligenceReference } = req.body;
  const { rows } = await query('UPDATE sales_contracts SET eudr_due_diligence_reference=$1 WHERE id=$2 AND buyer_organization_id=$3 RETURNING *', [eudrDueDiligenceReference, id, req.user!.organizationId]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found or not your contract' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'contract.eudr.update', entityType: 'sales_contract', entityId: id });
  res.json(rows[0]);
}

export async function updateComplianceReference(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { scheme, reference } = req.body;
  const isEudr = String(scheme).trim().toUpperCase() === 'EUDR';
  const { rows } = await query(
    `UPDATE sales_contracts
        SET compliance_scheme=$1,
            compliance_reference=$2,
            eudr_due_diligence_reference=CASE WHEN $3 THEN $2 ELSE eudr_due_diligence_reference END
      WHERE id=$4 AND buyer_organization_id=$5
      RETURNING *`,
    [scheme.trim(), reference.trim(), isEudr, id, req.user!.organizationId]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found or not your contract' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'contract.compliance.update', entityType: 'sales_contract', entityId: id });
  res.json(rows[0]);
}
