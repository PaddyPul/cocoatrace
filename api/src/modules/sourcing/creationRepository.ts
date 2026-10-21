import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { createSourcingRequestSchema } from '../../validation';
import type { AuditActor } from '../../services/auditWriter';
export interface SourcingRequestRow {
  id: string;
  buyer_organization_id: string;
  created_by_user_id: string;
  title: string;
  commodity: string;
  quantity_kg: string;
  origin_countries: string[];
  quality_requirements: Record<string, unknown>;
  assurance_requirements: Record<string, unknown>;
  delivery_location: string;
  incoterm: string;
  required_by: Date | null;
  offer_deadline: Date | null;
  visibility: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}
export async function insertSourcingRequest(
  client: PoolClient,
  actor: AuditActor,
  input: z.infer<typeof createSourcingRequestSchema>,
): Promise<SourcingRequestRow> {
  const {
    title,
    commodity,
    quantityKg,
    originCountries,
    qualityRequirements,
    assuranceRequirements,
    deliveryLocation,
    incoterm,
    requiredBy,
    offerDeadline,
    visibility,
    status,
  } = input;
  const result = await client.query<SourcingRequestRow>(
    `INSERT INTO sourcing_requests (
      buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,
      origin_countries,quality_requirements,assurance_requirements,delivery_location,
      incoterm,required_by,offer_deadline,visibility,status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      actor.organizationId,
      actor.id,
      title,
      commodity,
      quantityKg,
      originCountries || [],
      qualityRequirements || {},
      assuranceRequirements || {},
      deliveryLocation,
      incoterm || 'CIF',
      requiredBy || null,
      offerDeadline || null,
      visibility || 'matched',
      status || 'draft',
    ],
  );
  return result.rows[0];
}
