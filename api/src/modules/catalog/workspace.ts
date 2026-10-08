import type { Request, Response } from 'express';
import { ValidationError } from '../../errors';
import { type Actor, hasExplicitPermission } from '../../services/resourcePolicy';
import { batchFrom, batchVisible, farmSummary } from './sourceRecords';
import { reviewedOrganicSql, listingSummary } from './repository';
import { contractSummary } from './contracts';
import { offerSummary } from './offers';
import { shipmentSummary } from './shipments';
import { paymentSummary } from './payments';
import { activeBatchRecallSql } from '../recall/safety';
import { type Execute, withCatalogRead } from './paging';
// Product-profile scope deliberately matches its existing metadata list, not public visibility.
export const productScope = `($2::boolean OR b.current_holder_id=$1::uuid
 OR f.farmer_organization_id=$1::uuid OR f.cooperative_organization_id=$1::uuid
 OR EXISTS(SELECT 1 FROM batch_holdings h JOIN sales_contracts c ON c.holding_id=h.id WHERE h.batch_id=b.id AND (c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid))
 OR EXISTS(SELECT 1 FROM batch_attestations a WHERE a.batch_id=b.id AND a.certifier_organization_id=$1::uuid))`;
export async function batchTotals(execute: Execute, actor: Actor) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE ${reviewedOrganicSql})::int AS reviewed_count ${batchFrom} WHERE ${batchVisible}`,
      [actor.organizationId, hasExplicitPermission(actor, 'batch.read.all')],
    )
  ).rows[0];
}
export async function productTotals(execute: Execute, actor: Actor) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE pp.visibility='published')::int AS published_count,
 COUNT(*) FILTER(WHERE ${activeBatchRecallSql('b.id')})::int AS held_count
 FROM product_profiles pp JOIN harvest_batches b ON b.id=pp.batch_id LEFT JOIN farms f ON f.id=b.farm_id WHERE ${productScope}`,
      [actor.organizationId, hasExplicitPermission(actor, 'product_profile.read.all')],
    )
  ).rows[0];
}
export async function lotTotals(execute: Execute, actor: Actor) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,COALESCE(SUM(ml.quantity_kg) FILTER(WHERE ml.lot_type='source'),0)::text AS source_kg
 FROM material_lots ml WHERE ($2::boolean OR ml.owner_organization_id=$1::uuid
 OR EXISTS(SELECT 1 FROM batch_holdings h WHERE h.batch_id=ml.batch_id AND h.holder_organization_id=$1::uuid)
 OR EXISTS(SELECT 1 FROM batch_holdings h JOIN sales_contracts c ON c.holding_id=h.id WHERE h.batch_id=ml.batch_id AND (c.seller_organization_id=$1::uuid OR c.buyer_organization_id=$1::uuid))
 OR EXISTS(SELECT 1 FROM lot_distributions d WHERE d.lot_id=ml.id AND d.recipient_organization_id=$1::uuid))`,
      [
        actor.organizationId,
        hasExplicitPermission(actor, 'traceability.read.network', 'recall.manage.all'),
      ],
    )
  ).rows[0];
}
export async function recallTotals(execute: Execute, actor: Actor) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE r.status='active')::int AS active_count FROM recall_notices r
 WHERE ($2::boolean OR r.initiated_by_organization_id=$1::uuid OR EXISTS(SELECT 1 FROM recall_participants p WHERE p.recall_id=r.id AND p.organization_id=$1::uuid))`,
      [actor.organizationId, hasExplicitPermission(actor, 'recall.manage.all')],
    )
  ).rows[0];
}
export async function evidenceTotals(execute: Execute, actor: Actor) {
  return (
    await execute(
      `SELECT COUNT(*)::int AS count FROM evidence_items WHERE $2::boolean OR uploader_organization_id=$1::uuid`,
      [actor.organizationId, hasExplicitPermission(actor, 'evidence.read.all')],
    )
  ).rows[0];
}
export async function workspaceTotals(execute: Execute, actor: Actor) {
  const allowed = (permission: string) => hasExplicitPermission(actor, permission);
  // Run sequentially in one read snapshot; never infer access from create/update or generic analytics permissions.
  return {
    batches: allowed('batch.read') ? await batchTotals(execute, actor) : null,
    products: allowed('batch.read') ? await productTotals(execute, actor) : null,
    lots: allowed('batch.read') ? await lotTotals(execute, actor) : null,
    recalls: await recallTotals(execute, actor),
    evidence: allowed('evidence.read') ? await evidenceTotals(execute, actor) : null,
    shipments: allowed('shipment.read')
      ? await shipmentSummary(execute, actor.organizationId)
      : null,
    farms: allowed('farm.read') ? await farmSummary(execute, actor) : null,
    listings: allowed('listing.read') ? await listingSummary(execute, actor.organizationId) : null,
    contracts: allowed('contract.read')
      ? await contractSummary(execute, actor.organizationId)
      : null,
    offers:
      allowed('offer.create') || allowed('offer.respond')
        ? await offerSummary(execute, actor.organizationId)
        : null,
    payments: allowed('payment.read') ? await paymentSummary(execute, actor.organizationId) : null,
  };
}
export async function getWorkspaceTotals(req: Request, res: Response) {
  if (Object.keys(req.query).length)
    throw new ValidationError('Workspace totals do not accept page filters');
  res.json(await withCatalogRead((execute) => workspaceTotals(execute, req.user!)));
}
