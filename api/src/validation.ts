import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(1, 'Password required'),
});

export const createInvitationSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  organizationId: z.string().uuid().optional(),
  role: z.enum(['farmer', 'certifier', 'exporter', 'importer', 'logistics', 'regulator', 'admin']).optional(),
});

export const acceptInvitationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number'),
});

export const createFarmSchema = z.object({
  name: z.string().min(1),
  country: z.string().length(2).default('GH'),
  region: z.string().min(1),
  district: z.string().min(1),
  community: z.string().optional(),
  officialTraceabilityId: z.string().optional(),
  cooperativeOrganizationId: z.string().optional(),
});

export const createPlotSchema = z.object({
  plotCode: z.string().min(1),
  areaHectares: z.number().positive(),
  crops: z.array(z.string()).default(['cocoa']),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  geolocationSource: z.string().default('farmer_submitted'),
});

export const createBatchSchema = z.object({
  farmId: z.string().uuid(),
  plotIds: z.array(z.string()).default([]),
  crop: z.string().default('cocoa'),
  harvestDate: z.string(),
  quantityKg: z.number().positive(),
  moisturePercent: z.number().optional(),
  grade: z.string().optional(),
});

export const attestBatchSchema = z.object({
  certificateId: z.string().uuid(),
  notes: z.string().optional(),
});

export const createCertificateSchema = z.object({
  farmerOrganizationId: z.string().uuid(),
  farmId: z.string().uuid(),
  standard: z.string().default('EU_ORGANIC'),
  cropScope: z.array(z.string()).default(['cocoa']),
  validFrom: z.string(),
  validTo: z.string(),
  issuingAuthority: z.string(),
  accreditationReference: z.string(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['farmer','cooperative','certifier','exporter','importer','logistics','bank','regulator','auditor','admin']),
  jurisdiction: z.string().length(2).default('GH'),
  legalRegistrationNumber: z.string().optional(),
});

export const createHoldingSchema = z.object({
  batchId: z.string().uuid(),
  quantityKg: z.number().positive(),
  warehouseLocation: z.string().optional(),
});

export const transferHoldingSchema = z.object({
  toOrganizationId: z.string().uuid(),
  quantityKg: z.number().positive(),
  reason: z.string().optional(),
});

export const splitHoldingSchema = z.object({
  quantities: z.array(z.number().positive()).min(2),
});

export const createListingSchema = z.object({
  holdingId: z.string().uuid(),
  availableQuantityKg: z.number().positive(),
  pricePerKg: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  incoterm: z.string().default('CIF'),
  originLocation: z.string(),
  destinationLocation: z.string(),
});

export const createOfferSchema = z.object({
  quantityKg: z.number().positive(),
  offeredPricePerKg: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  validUntil: z.string().optional(),
});

export const createSourcingRequestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  commodity: z.string().trim().min(2).max(80),
  quantityKg: z.number().positive(),
  originCountries: z.array(z.string().length(2)).max(30).default([]),
  qualityRequirements: z.record(z.unknown()).default({}),
  assuranceRequirements: z.record(z.unknown()).default({}),
  deliveryLocation: z.string().trim().min(2).max(160),
  incoterm: z.string().trim().min(2).max(20).default('CIF'),
  requiredBy: z.string().optional(),
  offerDeadline: z.string().optional(),
  visibility: z.enum(['matched','invited','private']).default('matched'),
  status: z.enum(['draft','open']).default('draft'),
});

export const updateEudrSchema = z.object({
  eudrDueDiligenceReference: z.string().min(1),
});

export const createShipmentSchema = z.object({
  logisticsOrganizationId: z.string().uuid().optional(),
  vesselName: z.string().optional(),
  containerReference: z.string().optional(),
  originPort: z.string().min(1),
  destinationPort: z.string().min(1),
  etaArrival: z.string().optional(),
});

export const createMilestoneSchema = z.object({
  milestone: z.string().min(1),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const createPaymentRequestSchema = z.object({
  amountTotal: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
});

export const payPaymentSchema = z.object({
  transactionReference: z.string().min(1),
});

export const certificateActionSchema = z.object({
  reason: z.string().optional(),
});

export const uploadEvidenceSchema = z.object({
  type: z.string().optional(),
  linkedEntityType: z.string(),
  linkedEntityId: z.string(),
  claimDescription: z.string().optional(),
});

export const pushToMarketplaceSchema = z.object({
  quantityKg: z.number().positive('Quantity must be positive'),
  pricePerKg: z.number().positive('Price must be positive'),
  currency: z.string().length(3).default('EUR'),
  incoterm: z.string().default('CIF'),
  originLocation: z.string().min(1, 'Origin location required'),
  destinationLocation: z.string().min(1, 'Destination location required'),
});

export const productProfileSchema = z.object({
  batchId: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens'),
  displayName: z.string().min(2).max(120),
  brandName: z.string().max(120).optional(),
  description: z.string().max(600).optional(),
  gtin: z.string().regex(/^\d{8,14}$/).optional(),
  lotCode: z.string().min(2).max(80),
  heroImageUrl: z.string().url().optional(),
});

export const createRecallSchema = z.object({
  referenceCode: z.string().min(3).max(80),
  title: z.string().min(3).max(160),
  reason: z.string().min(3).max(1000),
  instructions: z.string().min(3).max(1000),
  severity: z.enum(['advisory', 'warning', 'critical']),
  batchIds: z.array(z.string().uuid()).default([]),
  lots: z.array(z.object({
    lotId: z.string().uuid(),
    quantityKg: z.number().positive().optional(),
  })).max(100).default([]),
}).refine((value) => value.batchIds.length > 0 || value.lots.length > 0, {
  message: 'At least one affected batch or suspect lot is required',
});

const traceLotSchema = z.object({
  lotId: z.string().uuid(),
  quantityKg: z.number().positive().optional(),
});

export const recallImpactSchema = z.object({
  lots: z.array(traceLotSchema).min(1).max(100),
});

export const traceQuantityQuerySchema = z.object({
  quantityKg: z.coerce.number().positive().optional(),
});

export const onboardingSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']),
  currentStep: z.number().int().min(0).max(4),
  primaryGoal: z.string().min(2).max(120).optional(),
  pilotMode: z.boolean().default(false),
});

export const pilotFeedbackSchema = z.object({
  page: z.string().min(1).max(160),
  task: z.string().min(1).max(160),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).default(''),
});
