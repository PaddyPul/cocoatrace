import { TrustClaim, TrustSummary } from '../../types';

export function isReviewed(claim?: TrustClaim) {
  return claim?.status === 'reviewed' && (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now());
}

export function trustLabel(claim?: TrustClaim) {
  if (claim?.status === 'reviewed' && !isReviewed(claim)) return 'Expired · not verified';
  switch (claim?.status) {
    case 'reviewed': return 'Reviewed';
    case 'self_declared': return 'Supplier declared · not reviewed';
    case 'not_claimed': return 'Not claimed';
    case 'expired': return 'Expired · not verified';
    case 'revoked': return 'Revoked · not verified';
    default: return 'Review status unknown';
  }
}

function date(value?: string | null) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not recorded' : parsed.toLocaleDateString();
}

export default function TrustClaims({ trust, light = false }: { trust?: TrustSummary; light?: boolean }) {
  return <section aria-label="Claim evidence and review" className={`rounded-2xl border p-5 ${light ? 'border-stone-200 bg-white text-stone-900' : 'border-border bg-surface'}`}>
    <h3 className="font-semibold">Claim evidence and review</h3>
    <p className={`mt-2 text-xs ${light ? 'text-stone-500' : 'text-text-muted'}`}>A recorded source or approved workspace does not verify a product claim. Review applies only to the named claim and evidence.</p>
    <div className="mt-4 space-y-3">{(['organic', 'origin', 'eudr'] as const).map(key => {
      const claim = trust?.[key];
      return <details key={key} className="rounded-xl border border-current/10 p-3">
        <summary className="cursor-pointer text-sm"><strong>{key === 'eudr' ? 'EUDR inputs' : key === 'organic' ? 'Organic' : 'Origin'}</strong> · {trustLabel(claim)}</summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt>Source</dt><dd>{claim?.claimSource?.replace(/_/g, ' ') || 'Not recorded'}</dd>
          <dt>Reference</dt><dd className="break-all">{claim?.sourceReference || 'Not recorded'}</dd>
          <dt>Reviewer</dt><dd>{claim?.reviewerName || 'Not recorded'}</dd>
          <dt>Review method</dt><dd>{claim?.reviewMethod?.replace(/_/g, ' ') || 'Not recorded'}</dd>
          <dt>Reviewed</dt><dd>{date(claim?.reviewedAt)}</dd>
          <dt>Expiry</dt><dd>{date(claim?.expiresAt)}</dd>
        </dl>
      </details>;
    })}</div>
  </section>;
}
