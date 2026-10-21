import type { AuditActor } from '../../services/auditWriter';
import type { TrustSummary } from '../trust/assessment';
export type ListingActor = AuditActor;
export interface ListingRow {
  id: string;
  seller_organization_id: string;
  holding_id: string;
  available_quantity_kg: string | number;
  price_per_kg: string | number;
  currency: string;
  incoterm: string;
  origin_location: string;
  destination_location: string;
  active: boolean;
  expires_at: string | Date | null;
}
export interface CurrentListingRow extends ListingRow {
  listing_expired: boolean;
}
export interface ListingDetailRow extends ListingRow {
  batch_id: string;
  seller_name: string;
  crop: string;
  organic_claim_status: string;
  grade: string | null;
  harvest_date: string | Date;
  source_mode: string;
  source_name: string | null;
  source_country: string | null;
  source_region: string | null;
  activeRecall: boolean;
  farm_name: string | null;
  farm_region: string | null;
  farm_country: string | null;
}
export interface HoldingRow {
  id: string;
  batch_id: string;
  holder_organization_id: string;
  status: string;
  quantity_kg: string | number;
}
export interface PublishListingInput {
  holdingId: string;
  availableQuantityKg: number;
  pricePerKg: number;
  currency?: string;
  incoterm?: string;
  originLocation?: string;
  destinationLocation?: string;
}
export interface EditListingInput {
  pricePerKg?: unknown;
  availableQuantityKg?: unknown;
  active?: unknown;
}
export interface ListingTransaction {
  lockRecallBoundary(): Promise<void>;
  findOwnedHolding(holdingId: string, organizationId: string): Promise<HoldingRow | undefined>;
  discoverHolding(id: string, organizationId: string): Promise<string | undefined>;
  lockHolding(holdingId: string): Promise<HoldingRow>;
  lockListings(holdingId: string): Promise<void>;
  findOwnedListing(id: string, organizationId: string): Promise<CurrentListingRow | undefined>;
  assertNotRecalled(batchId: string): Promise<void>;
  publishedQuantity(holdingId: string, excludingId?: string): Promise<number>;
  pendingQuantity(holdingId: string): Promise<number>;
  insert(actor: ListingActor, input: PublishListingInput): Promise<ListingRow>;
  update(
    id: string,
    price: number | undefined,
    quantity: number,
    active: boolean,
  ): Promise<ListingRow>;
  withdraw(id: string): Promise<void>;
  reconcile(holdingId: string, quantity: number): Promise<void>;
  audit(actor: ListingActor, action: string, id: string): Promise<void>;
}
export interface ListingRepository {
  detail(id: string): Promise<ListingDetailRow | undefined>;
  trust(batchId: string): Promise<TrustSummary>;
  transaction<T>(work: (tx: ListingTransaction) => Promise<T>): Promise<T>;
}
export type ListingFailureKind = 'invalid' | 'not_found' | 'unavailable' | 'insufficient';
export class ListingWorkflowError extends Error {
  constructor(
    readonly kind: ListingFailureKind,
    message: string,
  ) {
    super(message);
  }
}
