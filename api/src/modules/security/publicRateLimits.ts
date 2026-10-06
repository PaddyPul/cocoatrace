import type { Request } from 'express';
import { rateKey, type RateDecision, type RateStore } from './rateLimits';

export const publicBudgets = {
  profile: { ip: 600, deployment: 6000 },
  qr: { ip: 120, deployment: 1200 },
  scan: { ip: 60, deployment: 3000 },
  invitationPreview: { ip: 180, deployment: 3000 },
  uploadIntent: { ip: 300, deployment: 5000, user: 60, organization: 200 },
  uploadContent: { ip: 120, deployment: 2000 },
  invitationCreate: { ip: 120, deployment: 1000, user: 20, organization: 50 },
} as const;
export type PublicOperation = keyof typeof publicBudgets;
type Budget = { ip: number; deployment: number; user?: number; organization?: number };

/** Fixed operation names bound cardinality. Never key counters by slug, URL, body or upload token. */
export async function checkPublicAction(
  req: Request,
  store: RateStore,
  operation: PublicOperation,
): Promise<RateDecision> {
  const budget: Budget = publicBudgets[operation];
  const deployment = await store.consume(
    rateKey(`public:${operation}`, 'deployment', 'all'),
    budget.deployment,
    true,
  );
  if (!deployment.allowed) return deployment;
  const peer = await store.consume(
    rateKey(`public:${operation}`, 'ip', req.ip || 'unknown'),
    budget.ip,
  );
  if (!peer.allowed) return peer;
  if (budget.user || budget.organization) {
    // Actor scope is trusted middleware context, never a body/query organization ID.
    if (!req.user) throw new Error('Authenticated rate policy requires a live actor');
    const organization = await store.consume(
      rateKey(`public:${operation}`, 'organization', req.user.organizationId),
      budget.organization!,
    );
    if (!organization.allowed) return organization;
    return store.consume(rateKey(`public:${operation}`, 'user', req.user.id), budget.user!);
  }
  return peer;
}
