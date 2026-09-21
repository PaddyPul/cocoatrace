import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { getClient, query } from '../db';
import * as audit from '../services/audit';
import { buildJourney, deriveSafetyStatus, JourneyEvent } from '../services/publicProduct';
import { calculateTraceForward } from '../services/recallTrace';
import { loadTraceGraph } from '../services/traceGraphRepository';

function publicProductUrl(slug: string): string {
  const base = (process.env.PUBLIC_WEB_URL || process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/p/${slug}`;
}

export async function getPublicProduct(req: Request, res: Response): Promise<void> {
  const profileRes = await query(
    `SELECT pp.*, b.crop, b.harvest_date, b.quantity_kg, b.moisture_percent, b.grade,
            b.organic_claim_status, b.provenance_hash, b.attestation_id,
            f.name AS farm_name, f.country, f.region, f.district, f.community,
            f.official_traceability_id, f.verification_status AS farm_verification_status,
            farmer.name AS farmer_name, holder.name AS current_holder_name
     FROM product_profiles pp
     JOIN harvest_batches b ON b.id = pp.batch_id
     JOIN farms f ON f.id = b.farm_id
     JOIN organizations farmer ON farmer.id = f.farmer_organization_id
     JOIN organizations holder ON holder.id = b.current_holder_id
     WHERE pp.slug = $1 AND pp.visibility = 'published'`,
    [req.params.slug]
  );
  const product = profileRes.rows[0];
  if (!product) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }

  const [plotRes, certRes, evidenceRes, transferRes, shipmentRes, recallRes] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS plot_count,
              COALESCE(SUM(area_hectares), 0)::float AS total_area_hectares,
              BOOL_AND(gps_lat IS NOT NULL AND gps_lng IS NOT NULL) AS geolocation_complete,
              BOOL_AND(eudr_cutoff_checked) AS eudr_cutoff_checked,
              BOOL_AND(deforestation_risk_status = 'clear') AS deforestation_risk_clear
       FROM farm_plots WHERE farm_id = (SELECT farm_id FROM harvest_batches WHERE id=$1)`,
      [product.batch_id]
    ),
    query(
      `SELECT c.standard, c.valid_from, c.valid_to, c.status, c.accreditation_reference,
              o.name AS certifier_name, a.attested_at, a.notes
       FROM batch_attestations a
       JOIN organic_certificates c ON c.id = a.certificate_id
       JOIN organizations o ON o.id = c.certifier_organization_id
       WHERE a.batch_id=$1`,
      [product.batch_id]
    ),
    query(
      `SELECT type, file_name, sha256_hash, review_status, claim_description, created_at
       FROM evidence_items
       WHERE linked_entity_type='batch' AND linked_entity_id=$1 AND review_status='approved'
       ORDER BY created_at`,
      [product.batch_id]
    ),
    query(
      `SELECT ct.responded_at, ct.quantity_kg, src.name AS from_name, dest.name AS to_name,
              h.warehouse_location
       FROM custody_transfers ct
       JOIN batch_holdings h ON h.id = ct.holding_id
       JOIN organizations src ON src.id = ct.from_organization_id
       JOIN organizations dest ON dest.id = ct.to_organization_id
       WHERE h.batch_id=$1 AND ct.status='accepted'
       ORDER BY ct.responded_at`,
      [product.batch_id]
    ),
    query(
      `SELECT m.milestone, m.recorded_at, m.location, m.notes, carrier.name AS organization_name
       FROM batch_holdings h
       JOIN sales_contracts c ON c.holding_id = h.id
       JOIN shipments s ON s.contract_id = c.id
       JOIN shipment_milestones m ON m.shipment_id = s.id
       LEFT JOIN organizations carrier ON carrier.id = s.logistics_organization_id
       WHERE h.batch_id=$1
       ORDER BY m.recorded_at`,
      [product.batch_id]
    ),
    query(
      `SELECT r.id, r.reference_code, r.title, r.reason, r.instructions, r.severity,
              r.status, r.initiated_at, r.resolved_at, o.name AS issued_by
       FROM recall_notices r
       JOIN recall_affected_batches ab ON ab.recall_id = r.id
       JOIN organizations o ON o.id = r.initiated_by_organization_id
       WHERE ab.batch_id=$1 AND r.status IN ('active','resolved')
       ORDER BY (r.status='active') DESC, r.initiated_at DESC`,
      [product.batch_id]
    ),
  ]);

  const certificate = certRes.rows[0] || null;
  const recallEvents: JourneyEvent[] = recallRes.rows.map((recall: any) => ({
    type: 'recall',
    title: recall.status === 'active' ? `Safety notice: ${recall.title}` : `Resolved: ${recall.title}`,
    summary: recall.reason,
    occurredAt: recall.initiated_at,
    organization: recall.issued_by,
    verified: true,
  }));
  const journey = buildJourney([
    [{
      type: 'harvest',
      title: 'Harvested at origin',
      summary: `${Number(product.quantity_kg).toLocaleString()} kg of ${product.crop} recorded`,
      occurredAt: product.harvest_date,
      location: [product.community, product.district, product.region, product.country].filter(Boolean).join(', '),
      organization: product.farmer_name,
      verified: product.farm_verification_status === 'verified',
    }],
    certificate ? [{
      type: 'verification',
      title: `${certificate.standard.replace(/_/g, ' ')} verified`,
      summary: certificate.notes || `Certificate ${certificate.accreditation_reference}`,
      occurredAt: certificate.attested_at,
      organization: certificate.certifier_name,
      verified: certificate.status === 'active',
    }] : [],
    transferRes.rows.map((transfer: any) => ({
      type: 'custody' as const,
      title: 'Custody transferred',
      summary: `${Number(transfer.quantity_kg).toLocaleString()} kg · ${transfer.from_name} → ${transfer.to_name}`,
      occurredAt: transfer.responded_at,
      location: transfer.warehouse_location,
      organization: transfer.to_name,
      verified: true,
    })),
    shipmentRes.rows.map((milestone: any) => ({
      type: 'shipment' as const,
      title: milestone.milestone.replace(/_/g, ' '),
      summary: milestone.notes || 'Logistics milestone recorded',
      occurredAt: milestone.recorded_at,
      location: milestone.location,
      organization: milestone.organization_name,
      verified: true,
    })),
    recallEvents,
  ]);

  const recalls = recallRes.rows;
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({
    profile: {
      slug: product.slug,
      displayName: product.display_name,
      brandName: product.brand_name,
      description: product.description,
      gtin: product.gtin,
      lotCode: product.lot_code,
      heroImageUrl: product.hero_image_url,
      publishedAt: product.published_at,
      profileUrl: publicProductUrl(product.slug),
      qrSvgUrl: `/public/products/${product.slug}/qr.svg`,
    },
    product: {
      crop: product.crop,
      harvestDate: product.harvest_date,
      quantityKg: Number(product.quantity_kg),
      moisturePercent: product.moisture_percent == null ? null : Number(product.moisture_percent),
      grade: product.grade,
      organicClaimStatus: product.organic_claim_status,
      provenanceHash: product.provenance_hash,
      currentHolderName: product.current_holder_name,
    },
    origin: {
      farmName: product.farm_name,
      farmerName: product.farmer_name,
      country: product.country,
      region: product.region,
      district: product.district,
      community: product.community,
      officialTraceabilityId: product.official_traceability_id,
      verificationStatus: product.farm_verification_status,
      ...plotRes.rows[0],
    },
    certificate,
    evidence: evidenceRes.rows,
    journey,
    safety: {
      status: deriveSafetyStatus(recalls),
      activeRecalls: recalls.filter((recall: any) => recall.status === 'active'),
      resolvedRecalls: recalls.filter((recall: any) => recall.status === 'resolved'),
      checkedAt: new Date().toISOString(),
    },
  });
}

export async function getProductQr(req: Request, res: Response): Promise<void> {
  const result = await query(
    "SELECT slug FROM product_profiles WHERE slug=$1 AND visibility='published'",
    [req.params.slug]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  const svg = await QRCode.toString(publicProductUrl(result.rows[0].slug), {
    type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 512,
    color: { dark: '#17251b', light: '#ffffff' },
  });
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
}

export async function recordScan(req: Request, res: Response): Promise<void> {
  const result = await query(
    `INSERT INTO product_profile_scans (product_profile_id)
     SELECT id FROM product_profiles WHERE slug=$1 AND visibility='published'
     RETURNING id`,
    [req.params.slug]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  res.status(204).send();
}

export async function getProfileForBatch(req: Request, res: Response): Promise<void> {
  const result = await query('SELECT * FROM product_profiles WHERE batch_id=$1', [req.params.batchId]);
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  const profile = result.rows[0];
  res.json({ ...profile, profileUrl: publicProductUrl(profile.slug), qrSvgUrl: `/public/products/${profile.slug}/qr.svg` });
}

export async function upsertProfile(req: Request, res: Response): Promise<void> {
  const { batchId, slug, displayName, brandName, description, gtin, lotCode, heroImageUrl } = req.body;
  const batchRes = await query('SELECT id, current_holder_id FROM harvest_batches WHERE id=$1', [batchId]);
  if (!batchRes.rows[0]) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  const perms = req.user!.permissions || [];
  if (!perms.includes('*') && batchRes.rows[0].current_holder_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Only the current holder can manage this product profile' });
    return;
  }
  const result = await query(
    `INSERT INTO product_profiles (batch_id, slug, display_name, brand_name, description, gtin, lot_code, hero_image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (batch_id) DO UPDATE SET slug=EXCLUDED.slug, display_name=EXCLUDED.display_name,
       brand_name=EXCLUDED.brand_name, description=EXCLUDED.description, gtin=EXCLUDED.gtin,
       lot_code=EXCLUDED.lot_code, hero_image_url=EXCLUDED.hero_image_url, updated_at=NOW()
     RETURNING *`,
    [batchId, slug, displayName, brandName || null, description || '', gtin || null, lotCode, heroImageUrl || null]
  );
  const profile = result.rows[0];
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'product_profile.upsert', entityType: 'product_profile', entityId: profile.id });
  res.status(201).json({ ...profile, profileUrl: publicProductUrl(profile.slug), qrSvgUrl: `/public/products/${profile.slug}/qr.svg` });
}

export async function publishProfile(req: Request, res: Response): Promise<void> {
  const result = await query(
    `UPDATE product_profiles pp SET visibility='published', published_at=COALESCE(published_at, NOW()), updated_at=NOW()
     FROM harvest_batches b
     WHERE pp.id=$1 AND b.id=pp.batch_id AND ($2::boolean OR b.current_holder_id=$3)
     RETURNING pp.*`,
    [req.params.id, (req.user!.permissions || []).includes('*'), req.user!.organizationId]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found or access denied' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'product_profile.publish', entityType: 'product_profile', entityId: result.rows[0].id });
  res.json(result.rows[0]);
}

export async function listRecalls(req: Request, res: Response): Promise<void> {
  const canManageAll = (req.user!.permissions || []).some((permission) => permission === '*' || permission === 'recall.manage.all');
  const result = await query(
    `SELECT r.*, o.name AS issued_by,
            COALESCE((SELECT array_agg(ab.batch_id) FROM recall_affected_batches ab WHERE ab.recall_id=r.id), '{}') AS batch_ids,
            COALESCE((SELECT json_agg(json_build_object(
              'lotId', al.lot_id, 'lotCode', ml.lot_code,
              'sourceEquivalentKg', al.source_equivalent_kg,
              'recallQuantityKg', al.recall_quantity_kg,
              'relationshipDepth', al.relationship_depth
            ) ORDER BY al.relationship_depth, ml.lot_code)
            FROM recall_affected_lots al JOIN material_lots ml ON ml.id=al.lot_id
            WHERE al.recall_id=r.id), '[]'::json) AS affected_lots
     FROM recall_notices r
     JOIN organizations o ON o.id=r.initiated_by_organization_id
     WHERE ($1::boolean OR r.initiated_by_organization_id=$2)
     ORDER BY r.initiated_at DESC`,
    [canManageAll, req.user!.organizationId]
  );
  res.json(result.rows);
}

export async function createRecall(req: Request, res: Response): Promise<void> {
  const { referenceCode, title, reason, instructions, severity, batchIds, lots: requestedLots } = req.body;
  const canManageAll = (req.user!.permissions || []).some((permission) => permission === '*' || permission === 'recall.manage.all');
  const graph = await loadTraceGraph();
  const seeds = [...requestedLots];
  for (const batchId of batchIds) {
    const sourceLot = graph.lots.find((lot) => lot.batchId === batchId);
    if (!sourceLot) {
      res.status(400).json({ error: `Batch ${batchId} has no source material lot and cannot be quantity-traced` });
      return;
    }
    if (!seeds.some((seed: any) => seed.lotId === sourceLot.id)) seeds.push({ lotId: sourceLot.id });
  }
  if (!canManageAll) {
    const unauthorized = seeds.find((seed: any) => graph.lots.find((lot) => lot.id === seed.lotId)?.ownerOrganizationId !== req.user!.organizationId);
    if (unauthorized) {
      res.status(403).json({ error: 'You can only initiate recalls from lots owned by your organization' });
      return;
    }
  }
  const impact = calculateTraceForward(graph, seeds);
  const affectedBatchIds = [...new Set(impact.impactedLots.map((lot) => lot.batchId).filter(Boolean))] as string[];
  const client = await getClient();
  let recall: any;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO recall_notices (reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7) RETURNING *`,
      [referenceCode, title, reason, instructions, severity, req.user!.id, req.user!.organizationId]
    );
    recall = result.rows[0];
    if (affectedBatchIds.length) {
      await client.query(
        'INSERT INTO recall_affected_batches (recall_id,batch_id) SELECT $1, unnest($2::uuid[])',
        [recall.id, affectedBatchIds]
      );
    }
    for (const lot of impact.impactedLots) {
      await client.query(
        `INSERT INTO recall_affected_lots
           (recall_id,lot_id,source_equivalent_kg,recall_quantity_kg,relationship_depth)
         VALUES ($1,$2,$3,$4,$5)`,
        [recall.id, lot.id, lot.sourceEquivalentKg, lot.recallQuantityKg, lot.relationshipDepth]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'recall.activate', entityType: 'recall_notice', entityId: recall.id, reason });
  res.status(201).json({ ...recall, batch_ids: affectedBatchIds, affected_lots: impact.impactedLots, impact: impact.totals });
}

export async function resolveRecall(req: Request, res: Response): Promise<void> {
  const canManageAll = (req.user!.permissions || []).some((permission) => permission === '*' || permission === 'recall.manage.all');
  const result = await query(
    "UPDATE recall_notices SET status='resolved', resolved_at=NOW() WHERE id=$1 AND status='active' AND ($2::boolean OR initiated_by_organization_id=$3) RETURNING *",
    [req.params.id, canManageAll, req.user!.organizationId]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Active recall not found' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'recall.resolve', entityType: 'recall_notice', entityId: result.rows[0].id });
  res.json(result.rows[0]);
}
