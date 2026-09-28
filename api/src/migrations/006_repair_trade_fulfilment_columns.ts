import type { Knex } from 'knex';

/**
 * Compatibility repair for databases that recorded an earlier version of
 * migration 005 before the generic transport workflow was finalized.
 * Every operation is idempotent so fresh and existing installations are safe.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'documentary_collection_dp';
    ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS due_trigger TEXT NOT NULL DEFAULT 'documents_presented';

    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS compliance_scheme TEXT;
    ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS compliance_reference TEXT;

    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_coordinator_organization_id UUID REFERENCES organizations(id);
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS service_provider_name TEXT;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS booking_reference TEXT;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_mode TEXT NOT NULL DEFAULT 'unspecified';
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_document_type TEXT;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_document_reference TEXT;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS tracking_url TEXT;

    UPDATE sales_contracts
       SET compliance_scheme='EUDR',
           compliance_reference=eudr_due_diligence_reference
     WHERE eudr_due_diligence_reference IS NOT NULL
       AND compliance_reference IS NULL;

    UPDATE shipments sh
       SET transport_coordinator_organization_id=CASE
             WHEN UPPER(c.incoterm) IN ('EXW','FCA','FAS','FOB') THEN c.buyer_organization_id
             ELSE c.seller_organization_id
           END,
           service_provider_name=COALESCE(
             sh.service_provider_name,
             (SELECT name FROM organizations WHERE id=sh.logistics_organization_id)
           ),
           transport_document_type=CASE
             WHEN sh.bill_of_lading_number IS NOT NULL THEN 'bill_of_lading'
             ELSE sh.transport_document_type
           END,
           transport_document_reference=COALESCE(
             sh.transport_document_reference,
             sh.bill_of_lading_number
           )
      FROM sales_contracts c
     WHERE sh.contract_id=c.id
       AND sh.transport_coordinator_organization_id IS NULL;

    UPDATE roles
       SET permissions=array_append(permissions, 'shipment.update')
     WHERE name IN ('exporter','importer')
       AND NOT ('shipment.update'=ANY(permissions));

    INSERT INTO payment_requests (
      contract_id, requested_by_organization_id, amount_total, currency, status
    )
    SELECT c.id, c.seller_organization_id,
           c.quantity_kg * c.price_per_kg, c.currency, 'awaiting_documents'
      FROM sales_contracts c
     WHERE NOT EXISTS (
       SELECT 1 FROM payment_requests p WHERE p.contract_id=c.id
     );

    INSERT INTO shipments (
      contract_id, transport_coordinator_organization_id,
      origin_port, destination_port, current_milestone, transport_mode
    )
    SELECT c.id,
           CASE
             WHEN UPPER(c.incoterm) IN ('EXW','FCA','FAS','FOB') THEN c.buyer_organization_id
             ELSE c.seller_organization_id
           END,
           l.origin_location, l.destination_location, 'planning', 'unspecified'
      FROM sales_contracts c
      JOIN listings l ON l.id=c.listing_id
     WHERE NOT EXISTS (
       SELECT 1 FROM shipments sh WHERE sh.contract_id=c.id
     );
  `);
}

// This migration repairs schema owned by migration 005. Rolling it back must
// not remove columns or data that 005 may already have created.
export async function down(_knex: Knex): Promise<void> {}
