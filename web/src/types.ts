// Compatibility exports for existing integrations. Domain consumers import their owner directly.
export type { TrustStatus, TrustClaim, TrustSummary } from './domains/trust/types';
export type { User, OnboardingState } from './domains/identity/types';
export type { Farm, Batch, Holding } from './domains/source/types';
export type {
  Listing,
  StructuredSourcingBrief,
  SourcingRequest,
  Offer,
} from './domains/marketplace/types';
export type { Contract } from './domains/trade/types';
export type { Shipment } from './domains/fulfillment/types';
export type { Payment } from './domains/payments/types';
export type { Evidence } from './domains/evidence/types';
export type { AuditEvent } from './domains/audit/types';
export type { Certificate } from './domains/certification/types';
export type { ProvenancePack } from './domains/provenance/types';
export type {
  ProductProfile,
  ProductProfileSummary,
  JourneyEvent,
  PublicProduct,
} from './domains/product/types';
export type {
  PublicNotice,
  PublicNoticeSafety,
  RecallRegisterRow,
  RecallNotice,
  RecallRecovery,
  RecallResponseCollection,
  RecallResponsePaging,
  RecallResponse,
} from './domains/recall/types';
export type {
  MaterialLot,
  TraceLotResult,
  TraceBackResult,
  RecallImpactResult,
} from './domains/traceability/types';
