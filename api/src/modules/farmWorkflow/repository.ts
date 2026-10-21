import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { createFarmSchema, createPlotSchema } from '../../validation';
export interface FarmRow {
  id: string;
  farmer_organization_id: string;
  cooperative_organization_id: string | null;
  name: string;
  country: string;
  region: string;
  district: string;
  community: string | null;
  official_traceability_id: string | null;
  verification_status: string;
  created_at: Date;
}
export interface PlotRow {
  id: string;
  farm_id: string;
  plot_code: string;
  area_hectares: string;
  crops: string[];
  gps_lat: string | null;
  gps_lng: string | null;
  geolocation_source: string;
  verification_status: string;
  deforestation_risk_status: string | null;
  eudr_cutoff_checked: boolean;
  created_at: Date;
}
export async function lockOwnedFarm(
  client: PoolClient,
  id: string,
  organizationId: string,
): Promise<boolean> {
  const farm = await client.query<{ id: string }>(
    'SELECT id FROM farms WHERE id=$1 AND farmer_organization_id=$2 FOR SHARE',
    [id, organizationId],
  );
  return Boolean(farm.rows[0]);
}
export async function insertFarm(
  client: PoolClient,
  organizationId: string,
  input: z.infer<typeof createFarmSchema>,
): Promise<FarmRow> {
  const {
    name,
    country,
    region,
    district,
    community,
    officialTraceabilityId,
    cooperativeOrganizationId,
  } = input;
  const created = (
    await client.query<FarmRow>(
      'INSERT INTO farms (farmer_organization_id,name,country,region,district,community,official_traceability_id,cooperative_organization_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [
        organizationId,
        name,
        country,
        region,
        district,
        community || null,
        officialTraceabilityId || null,
        cooperativeOrganizationId || null,
      ],
    )
  ).rows[0];
  return created;
}
export async function insertPlot(
  client: PoolClient,
  id: string,
  input: z.infer<typeof createPlotSchema>,
): Promise<PlotRow> {
  const { plotCode, areaHectares, crops, gpsLat, gpsLng, geolocationSource } = input;
  const created = (
    await client.query<PlotRow>(
      'INSERT INTO farm_plots (farm_id,plot_code,area_hectares,crops,gps_lat,gps_lng,geolocation_source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id, plotCode, areaHectares, crops, gpsLat ?? null, gpsLng ?? null, geolocationSource],
    )
  ).rows[0];
  return created;
}
