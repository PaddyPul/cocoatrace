import type { Knex } from 'knex';

const PLACEHOLDER_IDS = [
  'ffffffff-ffff-ffff-ffff-fffffffffff1',
  'ffffffff-ffff-ffff-ffff-fffffffffff2',
  'ffffffff-ffff-ffff-ffff-fffffffffff3',
];

const PLACEHOLDER_PATHS = [
  'evidence/2026/cert-ready.pdf',
  'evidence/2026/weight-ready.pdf',
  'evidence/2026/bol-0942.pdf',
];

export async function up(knex: Knex): Promise<void> {
  // These deterministic demo rows predated private object storage. They have
  // fabricated hashes and paths, and no corresponding bytes could ever be
  // scanned or downloaded. Match both ID and path so no user evidence can be
  // removed by this reconciliation.
  await knex('evidence_items')
    .whereIn('id', PLACEHOLDER_IDS)
    .whereIn('storage_path', PLACEHOLDER_PATHS)
    .whereNull('storage_key')
    .delete();
}

export async function down(): Promise<void> {
  // Intentionally irreversible: restoring metadata for nonexistent evidence
  // would recreate an unsafe and misleading state.
}
