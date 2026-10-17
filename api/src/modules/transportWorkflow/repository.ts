import type { PoolClient } from 'pg';
import type { ArrangementRow, ShipmentRow, ProgressRow } from './model';
export function lockArrangement(
  client: PoolClient,
  parameters: [shipmentId: string, organizationId: string],
) {
  return client.query<ArrangementRow>(
    `SELECT c.status,c.incoterm,c.seller_organization_id,c.buyer_organization_id,sh.transport_coordinator_organization_id FROM sales_contracts c JOIN shipments sh ON sh.contract_id=c.id WHERE sh.id=$1 AND sh.transport_coordinator_organization_id=$2 FOR UPDATE OF c`,
    parameters,
  );
}
export function saveArrangement(
  client: PoolClient,
  parameters: [
    provider: string | null,
    booking: string | null,
    mode: string | null,
    documentType: string | null,
    documentReference: string | null,
    trackingUrl: string | null,
    vessel: string | null,
    container: string | null,
    origin: string | null,
    destination: string | null,
    eta: string | null,
    shipmentId: string,
    organizationId: string,
  ],
) {
  return client.query<ShipmentRow>(
    `UPDATE shipments sh SET
       service_provider_name=COALESCE($1, service_provider_name),
       booking_reference=COALESCE($2, booking_reference),
       transport_mode=COALESCE($3, transport_mode),
       transport_document_type=COALESCE($4, transport_document_type),
       transport_document_reference=COALESCE($5, transport_document_reference),
       tracking_url=COALESCE($6, tracking_url),
       vessel_name=COALESCE($7, vessel_name),
       container_reference=COALESCE($8, container_reference),
       origin_port=COALESCE($9, origin_port),
       destination_port=COALESCE($10, destination_port),
       eta_arrival=CASE WHEN $11::date IS NULL THEN eta_arrival ELSE eta_arrival END,
       bill_of_lading_number=CASE WHEN $4='bill_of_lading' THEN COALESCE($5, bill_of_lading_number) ELSE bill_of_lading_number END,
       current_milestone=CASE WHEN current_milestone='planning' AND ($1 IS NOT NULL OR $2 IS NOT NULL) THEN 'booked' ELSE current_milestone END
     FROM sales_contracts c
     WHERE sh.id=$12 AND c.id=sh.contract_id
       AND sh.transport_coordinator_organization_id=$13
       AND sh.current_milestone <> 'delivered'
     RETURNING sh.*`,
    parameters,
  );
}
export function recordBooking(
  client: PoolClient,
  parameters: [shipmentId: string, userId: string],
) {
  return client.query<Record<string, unknown>>(
    `INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, notes)
       SELECT $1, 'booked', $2, 'External transport arrangement recorded'
       WHERE NOT EXISTS (SELECT 1 FROM shipment_milestones WHERE shipment_id=$1 AND milestone='booked')`,
    parameters,
  );
}
export function startFulfilment(client: PoolClient, parameters: [contractId: string]) {
  return client.query<Record<string, unknown>>(
    "UPDATE sales_contracts SET status='fulfilment_in_progress' WHERE id=$1 AND status='accepted'",
    parameters,
  );
}
export function lockProgress(client: PoolClient, parameters: [shipmentId: string]) {
  return client.query<ProgressRow>(
    `SELECT sh.*,c.seller_organization_id,c.buyer_organization_id,c.incoterm,c.payment_plan,c.payment_terms_status,c.credit_days,c.currency AS contract_currency,p.currency AS payment_currency,c.currency_minor_units AS contract_minor_units,p.currency_minor_units AS payment_minor_units,c.holding_id,c.quantity_kg as contract_quantity_kg,c.status as contract_status,p.id payment_request_id,p.amount_confirmed,p.dispatch_required_amount,p.security_status
    FROM shipments sh JOIN sales_contracts c ON c.id=sh.contract_id JOIN payment_requests p ON p.contract_id=c.id WHERE sh.id=$1 FOR UPDATE OF sh,c,p`,
    parameters,
  );
}
export function findHolding(client: PoolClient, parameters: [holdingId: string]) {
  return client.query<{ batch_id: string }>(
    'SELECT batch_id FROM batch_holdings WHERE id=$1',
    parameters,
  );
}
export function findPaymentIssue(client: PoolClient, parameters: [paymentRequestId: string]) {
  return client.query<{ id: string }>(
    "SELECT id FROM payment_issues WHERE payment_request_id=$1 AND status<>'resolved' LIMIT 1",
    parameters,
  );
}
export function recordDispatchException(
  client: PoolClient,
  parameters: [reason: string, userId: string, shipmentId: string],
) {
  return client.query<Record<string, unknown>>(
    `UPDATE shipments SET dispatch_exception=TRUE,dispatch_exception_reason=$1,dispatch_exception_recorded_at=NOW(),dispatch_exception_recorded_by_user_id=$2 WHERE id=$3`,
    parameters,
  );
}
export function insertMilestone(
  client: PoolClient,
  parameters: [
    shipmentId: string,
    milestone: string,
    userId: string,
    location: string | null,
    notes: string | null,
  ],
) {
  return client.query<Record<string, unknown>>(
    'INSERT INTO shipment_milestones(shipment_id,milestone,recorded_by_user_id,location,notes)VALUES($1,$2,$3,$4,$5)',
    parameters,
  );
}
export function markInTransit(
  client: PoolClient,
  parameters: [status: string, contractId: string],
) {
  return client.query<Record<string, unknown>>(
    'UPDATE sales_contracts SET status=$1 WHERE id=$2',
    parameters,
  );
}
export function findDueInstallment(client: PoolClient, parameters: [paymentRequestId: string]) {
  return client.query<Record<string, unknown>>(
    "SELECT 1 FROM payment_installments WHERE payment_request_id=$1 AND status='due' LIMIT 1",
    parameters,
  );
}
export function markPaymentDue(client: PoolClient, parameters: [paymentRequestId: string]) {
  return client.query<Record<string, unknown>>(
    "UPDATE payment_requests SET status='payment_due',updated_at=NOW() WHERE id=$1",
    parameters,
  );
}
export function markDelivered(
  client: PoolClient,
  parameters: [status: string, contractId: string],
) {
  return client.query<Record<string, unknown>>(
    'UPDATE sales_contracts SET status=$1 WHERE id=$2',
    parameters,
  );
}
export function recordDistribution(
  client: PoolClient,
  parameters: [
    shipmentId: string,
    buyerId: string,
    quantityKg: string,
    reference: string,
    holdingId: string,
  ],
) {
  return client.query<Record<string, unknown>>(
    `INSERT INTO lot_distributions(lot_id,shipment_id,recipient_organization_id,quantity_kg,distribution_reference,dispatched_at) SELECT ml.id,$1,$2,$3,$4,COALESCE((SELECT recorded_at FROM shipment_milestones WHERE shipment_id=$1 AND milestone IN('loaded','departed') ORDER BY recorded_at LIMIT 1),NOW()) FROM batch_holdings h JOIN material_lots ml ON ml.batch_id=h.batch_id WHERE h.id=$5 ON CONFLICT(distribution_reference) DO UPDATE SET recipient_organization_id=EXCLUDED.recipient_organization_id,quantity_kg=EXCLUDED.quantity_kg`,
    parameters,
  );
}
export function saveMilestone(
  client: PoolClient,
  parameters: [milestone: string, shipmentId: string],
  milestone: string,
) {
  return client.query<ShipmentRow>(
    `UPDATE shipments SET current_milestone=$1${milestone === 'delivered' ? ', delivered_at=NOW()' : ''} WHERE id=$2 RETURNING *`,
    parameters,
  );
}
