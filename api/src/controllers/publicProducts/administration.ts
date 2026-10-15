import { Request, Response } from 'express';
import { query } from '../../db';
import * as audit from '../../services/audit';
import { hasBatchRelationship, hasExplicitPermission } from '../../services/resourcePolicy';
import { legacyProducts } from '../../modules/catalog/productProfiles';
import { withCatalogRead } from '../../modules/catalog/paging';
import { publicProductUrl } from './publicUrl';

export async function listProductProfiles(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyProducts(execute, req.user!, req.query)));
}

export async function getProfileForBatch(req: Request, res: Response): Promise<void> {
  const allowed =
    hasExplicitPermission(req.user!, 'product_profile.read.all') ||
    (await hasBatchRelationship(req.user!, req.params.batchId));
  if (!allowed) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const result = await query('SELECT * FROM product_profiles WHERE batch_id=$1', [
    req.params.batchId,
  ]);
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found' });
    return;
  }
  const profile = result.rows[0];
  res.json({
    ...profile,
    profileUrl: publicProductUrl(profile.slug),
    qrSvgUrl: `/public/products/${profile.slug}/qr.svg`,
  });
}

export async function upsertProfile(req: Request, res: Response): Promise<void> {
  const { batchId, slug, displayName, brandName, description, gtin, lotCode, heroImageUrl } =
    req.body;
  const batchRes = await query('SELECT id, current_holder_id FROM harvest_batches WHERE id=$1', [
    batchId,
  ]);
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
    [
      batchId,
      slug,
      displayName,
      brandName || null,
      description || '',
      gtin || null,
      lotCode,
      heroImageUrl || null,
    ],
  );
  const profile = result.rows[0];
  await audit.record({
    actorUserId: req.user!.id,
    actorOrganizationId: req.user!.organizationId,
    action: 'product_profile.upsert',
    entityType: 'product_profile',
    entityId: profile.id,
  });
  res.status(201).json({
    ...profile,
    profileUrl: publicProductUrl(profile.slug),
    qrSvgUrl: `/public/products/${profile.slug}/qr.svg`,
  });
}

export async function publishProfile(req: Request, res: Response): Promise<void> {
  const result = await query(
    `UPDATE product_profiles pp SET visibility='published', published_at=COALESCE(published_at, NOW()), updated_at=NOW()
     FROM harvest_batches b
     WHERE pp.id=$1 AND b.id=pp.batch_id AND ($2::boolean OR b.current_holder_id=$3)
     RETURNING pp.*`,
    [req.params.id, (req.user!.permissions || []).includes('*'), req.user!.organizationId],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Product profile not found or access denied' });
    return;
  }
  await audit.record({
    actorUserId: req.user!.id,
    actorOrganizationId: req.user!.organizationId,
    action: 'product_profile.publish',
    entityType: 'product_profile',
    entityId: result.rows[0].id,
  });
  res.json(result.rows[0]);
}
