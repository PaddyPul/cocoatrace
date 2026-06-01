import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listFarms(req: Request, res: Response): Promise<void> {
  const canSeeAll = req.user!.permissions?.includes('*') || req.user!.permissions?.includes('farm.read');
  let sql: string, params: any[];
  if (canSeeAll) {
    sql = `SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id ORDER BY f.name`;
    params = [];
  } else {
    sql = `SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.farmer_organization_id = $1 ORDER BY f.name`;
    params = [req.user!.organizationId];
  }
  const { rows } = await query(sql, params);
  res.json(rows);
}

export async function getFarm(req: Request, res: Response): Promise<void> {
  const farmRes = await query('SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.id = $1', [req.params.id]);
  if (!farmRes.rows[0]) {
    res.status(404).json({ error: 'Farm not found' });
    return;
  }
  const canSeeAll = req.user!.permissions?.includes('*') || req.user!.permissions?.includes('farm.read');
  if (!canSeeAll && farmRes.rows[0].farmer_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const plotRes = await query('SELECT * FROM farm_plots WHERE farm_id = $1 ORDER BY plot_code', [req.params.id]);
  const certRes = await query('SELECT * FROM organic_certificates WHERE farm_id = $1 ORDER BY valid_to DESC', [req.params.id]);
  res.json({ farm: farmRes.rows[0], plots: plotRes.rows, certificates: certRes.rows });
}

export async function createFarm(req: Request, res: Response): Promise<void> {
  const { name, country, region, district, community, officialTraceabilityId, cooperativeOrganizationId } = req.body;
  const { rows } = await query(
    'INSERT INTO farms (farmer_organization_id, name, country, region, district, community, official_traceability_id, cooperative_organization_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.user!.organizationId, name, country, region, district, community || null, officialTraceabilityId || null, cooperativeOrganizationId || null]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'farm.create', entityType: 'farm', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function createPlot(req: Request, res: Response): Promise<void> {
  const { plotCode, areaHectares, crops, gpsLat, gpsLng, geolocationSource } = req.body;
  const farmRes = await query('SELECT id FROM farms WHERE id=$1 AND farmer_organization_id=$2', [req.params.id, req.user!.organizationId]);
  if (!farmRes.rows[0]) {
    res.status(404).json({ error: 'Farm not found' });
    return;
  }
  const { rows } = await query(
    'INSERT INTO farm_plots (farm_id, plot_code, area_hectares, crops, gps_lat, gps_lng, geolocation_source) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.params.id, plotCode, areaHectares, crops, gpsLat || null, gpsLng || null, geolocationSource]
  );
  res.status(201).json(rows[0]);
}
