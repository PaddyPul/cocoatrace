import { z } from 'zod';

const inventoryQuantitySchema = z.number().finite().positive().max(999999999.999)
  .refine(value => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001, 'Quantity must have at most three decimal places');
const inventoryPriceSchema = z.number().finite().positive().max(999999.9999)
  .refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00001, 'Price must have at most four decimal places');
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0,10) === value, 'Use a valid calendar date');

export const loginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(1, 'Password required'),
});

export const securePasswordSchema = z.string().min(12).max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: securePasswordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: securePasswordSchema,
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ['newPassword'], message: 'New password must differ from the current password',
});

export const createInvitationSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  organizationId: z.string().uuid().optional(),
  role: z.enum(['farmer', 'certifier', 'exporter', 'importer', 'logistics', 'regulator', 'admin', 'buyer_admin', 'supplier_admin']).optional(),
});

export const acceptInvitationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  password: securePasswordSchema,
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
  gpsLat: z.number().finite().min(-90).max(90).optional(),
  gpsLng: z.number().finite().min(-180).max(180).optional(),
  geolocationSource: z.string().default('farmer_submitted'),
}).refine(value => (value.gpsLat === undefined) === (value.gpsLng === undefined), 'Provide both latitude and longitude');

export const createBatchSchema = z.object({
  farmId: z.string().uuid(),
  plotIds: z.array(z.string()).default([]),
  crop: z.string().default('cocoa'),
  harvestDate: z.string(),
  quantityKg: z.number().positive(),
  moisturePercent: z.number().optional(),
  grade: z.string().optional(),
});

export const createDirectInventorySchema = z.object({
  commodity: z.string().trim().min(2).max(80),
  quantityKg: z.number().positive(),
  inventoryDate: z.string(),
  sourceName: z.string().trim().max(160).optional(),
  sourceCountry: z.string().length(2).transform((value) => value.toUpperCase()),
  sourceRegion: z.string().trim().max(160).optional(),
  warehouseLocation: z.string().trim().max(240).optional(),
  moisturePercent: z.number().min(0).max(100).optional(),
  grade: z.string().trim().max(80).optional(),
});

export const structureSourcingBriefSchema = z.object({ brief: z.string().trim().min(10).max(4000) });

export const attestBatchSchema = z.object({
  certificateId: z.string().uuid(),
  notes: z.string().optional(),
});

export const createCertificateSchema = z.object({
  farmerOrganizationId: z.string().uuid(),
  farmId: z.string().uuid(),
  standard: z.string().default('EU_ORGANIC'),
  cropScope: z.array(z.string()).default(['cocoa']),
  validFrom: calendarDateSchema,
  validTo: calendarDateSchema,
  issuingAuthority: z.string().trim().min(1),
  accreditationReference: z.string().trim().min(1),
}).refine(value => value.validFrom <= value.validTo, 'Certificate end date must follow its start date');

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['farmer','cooperative','certifier','exporter','importer','logistics','bank','regulator','auditor','admin']),
  jurisdiction: z.string().length(2).default('GH'),
  legalRegistrationNumber: z.string().optional(),
});

export const createHoldingSchema = z.object({
  batchId: z.string().uuid(),
  quantityKg: inventoryQuantitySchema,
  warehouseLocation: z.string().optional(),
});

export const transferHoldingSchema = z.object({
  toOrganizationId: z.string().uuid(),
  quantityKg: inventoryQuantitySchema,
  reason: z.string().optional(),
});

export const splitHoldingSchema = z.object({
  quantities: z.array(inventoryQuantitySchema).min(2),
});

export const createListingSchema = z.object({
  holdingId: z.string().uuid(),
  availableQuantityKg: inventoryQuantitySchema,
  pricePerKg: inventoryPriceSchema,
  currency: z.string().length(3).default('EUR'),
  incoterm: z.string().default('CIF'),
  originLocation: z.string(),
  destinationLocation: z.string(),
});

export const updateListingSchema = z.object({
  availableQuantityKg: inventoryQuantitySchema.optional(),
  pricePerKg: inventoryPriceSchema.optional(),
  active: z.boolean().optional(),
});

export const createOfferSchema = z.object({
  quantityKg: inventoryQuantitySchema,
  offeredPricePerKg: inventoryPriceSchema,
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

export const updateComplianceSchema = z.object({
  scheme: z.string().trim().min(1).max(100),
  reference: z.string().trim().min(1).max(255),
});

export const createMilestoneSchema = z.object({
  milestone: z.string().min(1),
  location: z.string().optional(),
  notes: z.string().optional(),
  exceptionalDispatch: z.object({ reason: z.string().trim().min(10).max(1000), acknowledgePaymentRisk: z.literal(true) }).optional(),
});

export const updateShipmentDetailsSchema = z.object({
  serviceProviderName: z.string().trim().min(1).optional(),
  bookingReference: z.string().trim().min(1).optional(),
  transportMode: z.enum(['road', 'rail', 'sea', 'air', 'inland_waterway', 'multimodal', 'unspecified']).optional(),
  transportDocumentType: z.enum(['bill_of_lading', 'sea_waybill', 'air_waybill', 'road_consignment_note', 'rail_consignment_note', 'warehouse_release', 'other']).optional(),
  transportDocumentReference: z.string().trim().min(1).optional(),
  trackingUrl: z.string().url().optional(),
  vesselName: z.string().trim().min(1).optional(),
  containerReference: z.string().trim().min(1).optional(),
  originLocation: z.string().trim().min(1).optional(),
  destinationLocation: z.string().trim().min(1).optional(),
  etaArrival: z.string().optional(),
}).refine((value) => Object.values(value).some(Boolean), 'Provide at least one transport detail');

export const createPaymentRequestSchema = z.object({
  amountTotal: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
});

export const payPaymentSchema = z.object({
  transactionReference: z.string().min(1),
});

export const updatePaymentTermsSchema = z.object({
  paymentPlan: z.enum(['pay_before_dispatch','deposit_balance','bank_secured','documentary_collection','pay_after_delivery']),
  depositPercentage: z.number().min(5).max(90).optional(), creditDays: z.number().int().min(0).max(365).optional(), note: z.string().trim().max(1000).optional(),
}).superRefine((value,ctx) => { if(value.paymentPlan==='deposit_balance' && value.depositPercentage===undefined) ctx.addIssue({code:z.ZodIssueCode.custom,path:['depositPercentage'],message:'Deposit percentage is required'}); });
export const submitInstallmentSchema = z.object({ transactionReference:z.string().trim().min(3).max(200) });
export const rejectInstallmentSchema = z.object({ reason:z.string().trim().min(5).max(1000) });
export const submitPaymentSecuritySchema = z.object({ provider:z.string().trim().min(2).max(200), reference:z.string().trim().min(3).max(200) });

export const certificateActionSchema = z.object({
  reason: z.string().optional(),
});

export const createEvidenceUploadIntentSchema = z.object({
  type: z.string().trim().min(1).max(100),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['application/pdf','image/jpeg','image/png']),
  fileSizeBytes: z.number().int().positive(),
  linkedEntityType: z.enum(['batch','certificate','contract','farm','product_profile','shipment','recall']),
  linkedEntityId: z.string().uuid(),
  claimDescription: z.string().trim().max(2000).optional(),
});

export const evidenceListQuerySchema = z.object({
  entityType: z.enum(['batch','certificate','contract','farm','product_profile','shipment','recall']).optional(),
  entityId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (Boolean(value.entityType) !== Boolean(value.entityId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'entityType and entityId are required together' });
  }
});

export const provenanceViewQuerySchema = z.object({ contractId: z.string().uuid().optional() });
export const provenanceExportQuerySchema = provenanceViewQuerySchema.extend({ format: z.literal('json').default('json') });

export const pushToMarketplaceSchema = z.object({
  quantityKg: inventoryQuantitySchema,
  pricePerKg: inventoryPriceSchema,
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

const recallResponseNote = z.string().trim().min(10).max(2000);
const recoveryQuantity = z.number().finite().min(0).max(99999999999).refine(value => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001, 'Use at most three decimal places').default(0);
export const acknowledgeRecallSchema = z.object({note:recallResponseNote});
export const contactRecallSchema = z.object({status:z.enum(['contacted','unreachable','escalated']),note:recallResponseNote});
export const recallRecoverySchema = z.object({quarantinedKg:recoveryQuantity,returnedKg:recoveryQuantity,destroyedKg:recoveryQuantity,correctedKg:recoveryQuantity,releasedKg:recoveryQuantity,note:recallResponseNote});
export const resolveRecallSchema = z.object({reason:recallResponseNote,evidenceIds:z.array(z.string().uuid()).min(1).max(20)});
