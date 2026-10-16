import { z } from 'zod';
import { createSourcingRequestSchema } from '../../validation';
import { NotFoundError, ValidationError } from '../../errors';
import type { Execute } from '../catalog/paging';
export const editSourcingSchema = createSourcingRequestSchema
  .partial()
  .extend({
    quantityKg: z
      .number()
      .finite()
      .min(0.001)
      .max(999999999.999)
      .refine((value) => Number(value.toFixed(3)) === value, 'Use at most three quantity decimals')
      .optional(),
    requiredBy: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(value + 'T00:00:00Z');
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, 'Invalid calendar date')
      .nullable()
      .optional(),
    offerDeadline: z.string().datetime().nullable().optional(),
    status: z.enum(['draft', 'open', 'cancelled']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'No reviewed changes supplied');
const columns = {
  title: 'title',
  commodity: 'commodity',
  quantityKg: 'quantity_kg',
  originCountries: 'origin_countries',
  qualityRequirements: 'quality_requirements',
  assuranceRequirements: 'assurance_requirements',
  deliveryLocation: 'delivery_location',
  incoterm: 'incoterm',
  requiredBy: 'required_by',
  offerDeadline: 'offer_deadline',
  visibility: 'visibility',
  status: 'status',
} as const;
export async function editSourcingRequest(
  execute: Execute,
  actor: { organizationId: string },
  id: string,
  body: unknown,
) {
  if (!z.string().uuid().safeParse(id).success) throw new ValidationError('Invalid request ID');
  const data = editSourcingSchema.parse(body);
  const keys = Object.keys(data) as Array<keyof typeof columns>;
  const values: unknown[] = keys.map((key) => data[key]);
  const assignments = keys.map((key, index) => `${columns[key]}=$${index + 1}`);
  const result = await execute(
    `UPDATE sourcing_requests SET ${assignments.join(',')},updated_at=NOW()
    WHERE id=$${values.length + 1} AND buyer_organization_id=$${values.length + 2}
    AND status IN ('draft','open') RETURNING *`,
    [...values, id, actor.organizationId],
  );
  if (!result.rows[0]) throw new NotFoundError('Editable sourcing request');
  return result.rows[0];
}
