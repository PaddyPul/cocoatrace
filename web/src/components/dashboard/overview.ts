import type { WorkspaceOverview } from '../../api';
const counts: Record<string, string[]> = {
  batches: ['count', 'reviewed_count'],
  products: ['count', 'published_count', 'held_count'],
  lots: ['count'],
  recalls: ['count', 'active_count'],
  evidence: ['count'],
  shipments: ['count', 'active_count', 'delivered_count', 'cancelled_count'],
  farms: ['count', 'owned_count'],
  listings: ['count', 'own_count'],
  contracts: ['count', 'active_count', 'settled_count', 'cancelled_count'],
  offers: ['received_count', 'sent_count', 'received_pending', 'sent_pending'],
  payments: ['count', 'open_count', 'settled_count', 'cancelled_count'],
};
export function validateOverview(input: unknown): WorkspaceOverview {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid workspace totals.');
  const data = input as Record<string, unknown>;
  for (const [group, keys] of Object.entries(counts)) {
    const row = data[group];
    if (row === null && group !== 'recalls') continue;
    if (!row || typeof row !== 'object' || Array.isArray(row))
      throw new Error('Invalid workspace totals.');
    const values = row as Record<string, unknown>;
    if (!keys.every((key) => Number.isSafeInteger(values[key]) && Number(values[key]) >= 0))
      throw new Error('Invalid workspace totals.');
    if (
      group === 'lots' &&
      (typeof values.source_kg !== 'string' ||
        !/^\d+(\.\d+)?$/.test(values.source_kg) ||
        !Number.isFinite(Number(values.source_kg)))
    )
      throw new Error('Invalid source quantity.');
  }
  return input as WorkspaceOverview;
}
