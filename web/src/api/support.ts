import { api, type CatalogPage } from './http';
export const SUPPORT_CONTEXTS = [
  'home',
  'supply',
  'marketplace',
  'offers',
  'agreement',
  'shipment',
  'payment',
  'evidence',
  'recall',
  'account',
  'other',
] as const;
export type SupportContext = (typeof SUPPORT_CONTEXTS)[number];
export type SupportStatus = 'open' | 'in_review' | 'resolved';
export interface SupportRequest {
  id: string;
  reference: string;
  subject: string;
  description: string;
  context: SupportContext;
  entity_id: string | null;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  operator_note?: string | null;
  requester_user_id?: string;
  organization_id?: string;
}
export interface SupportDraft {
  idempotencyKey: string;
  subject: string;
  description: string;
  context: SupportContext;
  entityId?: string;
}
export function supportContext(value: string | null): SupportContext {
  return SUPPORT_CONTEXTS.includes(value as SupportContext) ? (value as SupportContext) : 'other';
}
export function supportEntity(value: string | null): string | undefined {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}
function record(value: unknown): SupportRequest {
  const v = value as SupportRequest;
  if (
    !v ||
    typeof v.id !== 'string' ||
    typeof v.reference !== 'string' ||
    typeof v.subject !== 'string' ||
    typeof v.description !== 'string' ||
    !SUPPORT_CONTEXTS.includes(v.context) ||
    !(v.entity_id === null || typeof v.entity_id === 'string') ||
    !['open', 'in_review', 'resolved'].includes(v.status) ||
    typeof v.created_at !== 'string'
  )
    throw new Error('Support response unavailable. Please retry.');
  return v;
}
async function page(admin: boolean, cursor?: string): Promise<CatalogPage<SupportRequest>> {
  const value = await api<unknown>(
    'GET',
    `${admin ? '/admin' : ''}/support/requests/page?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`,
  );
  const p = value as CatalogPage<unknown>;
  if (
    !p ||
    !Array.isArray(p.items) ||
    typeof p.hasMore !== 'boolean' ||
    !(p.nextCursor === null || typeof p.nextCursor === 'string') ||
    p.items.length > 20 ||
    (p.hasMore ? !p.nextCursor : p.nextCursor !== null)
  )
    throw new Error('Support history unavailable. Please retry.');
  return { ...p, items: p.items.map(record) };
}
export const support = {
  page,
  create: async (body: SupportDraft) => record(await api('POST', '/support/requests', body)),
  update: async (
    id: string,
    status: SupportStatus,
    expectedStatus: SupportStatus,
    reason: string,
  ) =>
    record(
      await api('PATCH', `/admin/support/requests/${encodeURIComponent(id)}`, {
        status,
        expectedStatus,
        reason,
      }),
    ),
};
