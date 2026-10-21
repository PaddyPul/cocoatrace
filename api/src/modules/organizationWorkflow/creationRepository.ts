import { query } from '../../db';
import type { z } from 'zod';
import { createOrganizationSchema } from '../../validation';
export interface OrganizationRow {
  id: string;
  name: string;
  type: string;
  jurisdiction: string;
  legal_registration_number: string | null;
  verification_status: string;
  created_at: Date;
  access_suspended_at: Date | null;
}
export async function insertOrganization(
  input: z.infer<typeof createOrganizationSchema>,
): Promise<OrganizationRow> {
  const { name, type, jurisdiction, legalRegistrationNumber } = input;
  const { rows } = await query<OrganizationRow>(
    'INSERT INTO organizations (name, type, jurisdiction, legal_registration_number) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, type, jurisdiction, legalRegistrationNumber || null],
  );
  return rows[0];
}
