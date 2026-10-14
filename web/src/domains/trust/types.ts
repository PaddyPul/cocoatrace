export type TrustStatus =
  | 'not_claimed'
  | 'self_declared'
  | 'reviewed'
  | 'expired'
  | 'revoked'
  | 'unknown';

export interface TrustClaim {
  status: TrustStatus;
  claimSource?: string | null;
  sourceReference?: string | null;
  reviewMethod?: string | null;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  reviewerName?: string | null;
}

export interface TrustSummary {
  organic: TrustClaim;
  origin: TrustClaim;
  eudr: TrustClaim;
}
