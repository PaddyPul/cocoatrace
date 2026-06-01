import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(1, 'Password required'),
});

export const createFarmSchema = z.object({
  name: z.string().min(1),
  country: z.string().length(2).default('GH'),
  region: z.string().min(1),
  district: z.string().min(1),
  community: z.string().optional(),
  officialTraceabilityId: z.string().optional(),
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

export const updateEudrSchema = z.object({
  eudrDueDiligenceReference: z.string().min(1),
});

export const createShipmentSchema = z.object({
  logisticsOrganizationId: z.string().uuid().optional(),
  vesselName: z.string().optional(),
  containerReference: z.string().optional(),
  originPort: z.string().default('Tema Port, Ghana'),
  destinationPort: z.string().default('Port of Rotterdam, Netherlands'),
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
