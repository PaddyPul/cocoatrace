import { farmCertificateCollection } from '../modules/catalog/certificates';
import { legacySourceList } from '../modules/catalog/sourceRecords';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';
import { query } from '../db';
import { inTradeTransaction as inTransaction, recordTradeAudit } from '../modules/trading/transaction';
import { hasExplicitPermission, hasFarmRelationship } from '../services/resourcePolicy';

export async function listFarms(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute=>legacySourceList(execute,req.user!,'farms')));
}

export async function getFarm(req: Request, res: Response): Promise<void> {
  const farmRes = await query('SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.id = $1', [req.params.id]);
  if (!farmRes.rows[0]) {
    res.status(404).json({ error: 'Farm not found' });
    return;
  }
  const canSeeAll = hasExplicitPermission(req.user!, 'farm.read.all');
  if (!canSeeAll && !await hasFarmRelationship(req.user!, req.params.id)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const plotRes = await query('SELECT * FROM farm_plots WHERE farm_id = $1 ORDER BY plot_code', [req.params.id]);
  const certificateCollection = await withCatalogRead(execute=>farmCertificateCollection(execute,req.user!,req.params.id as string,req.query.certificateMode));
  res.json({ farm: farmRes.rows[0], plots: plotRes.rows, ...certificateCollection });
}

export async function createFarm(req: Request, res: Response): Promise<void> {
  const { name, country, region, district, community, officialTraceabilityId, cooperativeOrganizationId } = req.body;
  const farm = await inTransaction(async client => {
    const created = (await client.query(
      'INSERT INTO farms (farmer_organization_id,name,country,region,district,community,official_traceability_id,cooperative_organization_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user!.organizationId,name,country,region,district,community || null,officialTraceabilityId || null,cooperativeOrganizationId || null]
    )).rows[0];
    await recordTradeAudit(client,req.user!,'farm.create','farm',created.id,{claimSource:'supplier_declaration'});
    return created;
  });
  res.status(201).json(farm);
}

export async function createPlot(req: Request, res: Response): Promise<void> {
  const { plotCode, areaHectares, crops, gpsLat, gpsLng, geolocationSource } = req.body;
  const plot = await inTransaction(async client => {
    const farm = await client.query('SELECT id FROM farms WHERE id=$1 AND farmer_organization_id=$2 FOR SHARE',[req.params.id,req.user!.organizationId]);
    if (!farm.rows[0]) return null;
    const created = (await client.query(
      'INSERT INTO farm_plots (farm_id,plot_code,area_hectares,crops,gps_lat,gps_lng,geolocation_source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.params.id,plotCode,areaHectares,crops,gpsLat ?? null,gpsLng ?? null,geolocationSource]
    )).rows[0];
    await recordTradeAudit(client,req.user!,'plot.create','plot',created.id,{claimSource:'supplier_declaration',geolocationSource});
    return created;
  });
  if (!plot) { res.status(404).json({error:'Farm not found'}); return; }
  res.status(201).json(plot);
}
