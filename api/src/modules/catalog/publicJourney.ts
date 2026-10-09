import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors';
import type { JourneyEvent } from '../../services/publicProduct';
import { loadBatchTrust } from '../trust/assessment';
import { type Execute, literal, pageResult, parsePage, text, withCatalogRead } from './paging';

// Small sortable index rows first; hydrate only the chosen page's source IDs.
export const journeyIndex = `
 SELECT b.id AS source_id,'harvest'::text AS kind,b.harvest_date::timestamptz AS occurred_at,
 concat_ws(' ',CASE WHEN b.source_mode='direct_inventory' THEN 'Inventory recorded' ELSE 'Harvested at origin' END,b.crop,b.source_name,f.name,f.region,f.country) AS search_text
 FROM harvest_batches b LEFT JOIN farms f ON f.id=b.farm_id WHERE b.id=$1::uuid
 UNION ALL SELECT a.id,'verification',a.attested_at,concat_ws(' ',c.standard,c.accreditation_reference,o.name,a.notes)
 FROM harvest_batches b JOIN batch_attestations a ON a.id=b.attestation_id JOIN organic_certificates c ON c.id=a.certificate_id JOIN organizations o ON o.id=c.certifier_organization_id WHERE b.id=$1::uuid
 UNION ALL SELECT ct.id,'custody',ct.responded_at,concat_ws(' ','Custody transferred',ct.quantity_kg,src.name,dest.name,h.warehouse_location)
 FROM custody_transfers ct JOIN batch_holdings h ON h.id=ct.holding_id JOIN organizations src ON src.id=ct.from_organization_id JOIN organizations dest ON dest.id=ct.to_organization_id WHERE h.batch_id=$1::uuid AND ct.status='accepted'
 UNION ALL SELECT m.id,'shipment',m.recorded_at,concat_ws(' ',replace(m.milestone,'_',' '),m.location,m.notes,carrier.name)
 FROM batch_holdings h JOIN sales_contracts c ON c.holding_id=h.id JOIN shipments s ON s.contract_id=c.id JOIN shipment_milestones m ON m.shipment_id=s.id LEFT JOIN organizations carrier ON carrier.id=s.logistics_organization_id WHERE h.batch_id=$1::uuid
 UNION ALL SELECT r.id,'recall',r.initiated_at,concat_ws(' ',r.title,r.reason,o.name,r.reference_code)
 FROM recall_notices r JOIN recall_affected_batches ab ON ab.recall_id=r.id JOIN organizations o ON o.id=r.initiated_by_organization_id WHERE ab.batch_id=$1::uuid AND r.status IN ('active','resolved')`;
const orderedIndex = `SELECT md5(kind||':'||source_id::text)::uuid AS id,source_id,kind,occurred_at,
 (extract(epoch FROM occurred_at)*1000+62135596800000)::numeric AS sort_key,search_text
 FROM (${journeyIndex}) events WHERE occurred_at IS NOT NULL`;
const detailQueries = {
  harvest: `SELECT b.id,b.crop,b.quantity_kg,b.source_mode,f.community,f.district,f.region,f.country,farmer.name AS farmer_name FROM harvest_batches b LEFT JOIN farms f ON f.id=b.farm_id LEFT JOIN organizations farmer ON farmer.id=f.farmer_organization_id WHERE b.id=ANY($1::uuid[])`,
  verification: `SELECT a.id,c.standard,c.accreditation_reference,a.notes,o.name AS certifier_name FROM batch_attestations a JOIN organic_certificates c ON c.id=a.certificate_id JOIN organizations o ON o.id=c.certifier_organization_id WHERE a.id=ANY($1::uuid[])`,
  custody: `SELECT ct.id,ct.quantity_kg,src.name AS from_name,dest.name AS to_name,h.warehouse_location FROM custody_transfers ct JOIN batch_holdings h ON h.id=ct.holding_id JOIN organizations src ON src.id=ct.from_organization_id JOIN organizations dest ON dest.id=ct.to_organization_id WHERE ct.id=ANY($1::uuid[])`,
  shipment: `SELECT m.id,m.milestone,m.location,m.notes,carrier.name AS organization_name FROM shipment_milestones m JOIN shipments s ON s.id=m.shipment_id LEFT JOIN organizations carrier ON carrier.id=s.logistics_organization_id WHERE m.id=ANY($1::uuid[])`,
  recall: `SELECT r.id,r.title,r.reason,r.status,o.name AS issued_by FROM recall_notices r JOIN organizations o ON o.id=r.initiated_by_organization_id WHERE r.id=ANY($1::uuid[])`,
};
type Kind = keyof typeof detailQueries;
function event(
  kind: Kind,
  row: Record<string, unknown>,
  occurredAt: string,
  originReviewed: boolean,
  organicStatus: string,
): JourneyEvent {
  const base = { type: kind, occurredAt, verified: true };
  switch (kind) {
    case 'harvest':
      return {
        ...base,
        title:
          row.source_mode === 'direct_inventory' ? 'Inventory recorded' : 'Harvested at origin',
        summary: `${Number(row.quantity_kg).toLocaleString('en')} kg of ${row.crop} recorded${row.source_mode === 'direct_inventory' ? ' from supplier-declared source information' : ''}`,
        location: [row.community, row.district, row.region, row.country].filter(Boolean).join(', '),
        organization: row.farmer_name as string | null,
        verified: originReviewed,
      };
    case 'verification':
      return {
        ...base,
        title: `${String(row.standard).replace(/_/g, ' ')} · ${organicStatus}`,
        summary: String(row.notes || `Certificate ${row.accreditation_reference}`),
        organization: String(row.certifier_name),
        verified: organicStatus === 'reviewed',
      };
    case 'custody':
      return {
        ...base,
        title: 'Custody transferred',
        summary: `${Number(row.quantity_kg).toLocaleString('en')} kg · ${row.from_name} → ${row.to_name}`,
        location: row.warehouse_location as string | null,
        organization: String(row.to_name),
      };
    case 'shipment':
      return {
        ...base,
        title: String(row.milestone).replace(/_/g, ' '),
        summary: String(row.notes || 'Logistics milestone recorded'),
        location: row.location as string | null,
        organization: row.organization_name as string | null,
      };
    case 'recall':
      return {
        ...base,
        title: row.status === 'active' ? `Safety notice: ${row.title}` : `Resolved: ${row.title}`,
        summary: String(row.reason),
        organization: String(row.issued_by),
      };
  }
}
export async function publicJourneyPage(
  execute: Execute,
  slug: string,
  parameters: Record<string, unknown> = {},
  expected?: { id: string; batchId: string },
) {
  const name = text(slug, 'product slug', 100);
  const profile = (
    await execute(
      "SELECT id,batch_id FROM product_profiles WHERE slug=$1 AND visibility='published' LIMIT 1",
      [name],
    )
  ).rows[0];
  if (
    !profile ||
    (expected && (profile.id !== expected.id || profile.batch_id !== expected.batchId))
  )
    throw new NotFoundError('Product profile');
  const input = parsePage(
    parameters,
    ['public-journey', profile.id, profile.batch_id],
    [],
    ['time'],
  );
  const candidates = (
    await execute(
      `SELECT id,source_id,kind,occurred_at,sort_key FROM (${orderedIndex}) timeline
 WHERE ($2::numeric IS NULL OR (sort_key,id)>($2::numeric,$3::uuid))
 AND ($4::text='' OR search_text ILIKE $5::text ESCAPE '\\') ORDER BY sort_key,id LIMIT $6::int`,
      [
        profile.batch_id,
        input.cursor?.key || null,
        input.cursor?.id || null,
        input.search,
        literal(input.search),
        input.limit + 1,
      ],
    )
  ).rows;
  const total = (
    await execute(`SELECT COUNT(*)::int AS count FROM (${orderedIndex}) timeline`, [
      profile.batch_id,
    ])
  ).rows[0];
  const page = pageResult(candidates, input, 'sort_key');
  const details = new Map<string, Record<string, unknown>>();
  for (const kind of Object.keys(detailQueries) as Kind[]) {
    const ids = page.items.filter((row) => row.kind === kind).map((row) => row.source_id);
    if (ids.length)
      for (const row of (await execute(detailQueries[kind], [ids])).rows)
        details.set(kind + ':' + row.id, row);
  }
  const needsTrust = page.items.some(
    (row) => row.kind === 'harvest' || row.kind === 'verification',
  );
  const trust = needsTrust
    ? (await loadBatchTrust([String(profile.batch_id)], execute, true)).get(
        String(profile.batch_id),
      )
    : undefined;
  return {
    ...page,
    count: total.count,
    items: page.items.map((row) => ({
      id: row.id,
      ...event(
        row.kind as Kind,
        details.get(row.kind + ':' + row.source_id)!,
        new Date(row.occurred_at as string | Date).toISOString(),
        trust?.origin.status === 'reviewed',
        trust?.organic.status || 'unknown',
      ),
    })),
  };
}
export const readPublicJourney = (
  slug: string,
  parameters: Record<string, unknown> = {},
  expected?: { id: string; batchId: string },
) => withCatalogRead((execute) => publicJourneyPage(execute, slug, parameters, expected));
export async function getPublicJourneyPage(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store').json(await readPublicJourney(req.params.slug, req.query));
}
