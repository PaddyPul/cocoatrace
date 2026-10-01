import { z } from 'zod';

export const requestOrganizationAccessSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  organizationType: z.enum(['buyer', 'supplier']),
  jurisdiction: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  legalRegistrationNumber: z.string().trim().min(2).max(120).optional(),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().email().transform((value) => value.toLowerCase()),
});

export const verifyOrganizationAccessSchema = z.object({
  token: z.string().trim().min(32).max(200),
});

export const reviewOrganizationAccessSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const organizationAccessIdSchema = z.object({ id: z.string().uuid() });
