import { AppError } from '../errors';
import { config } from '../config/env';
import { Execute, withCatalogRead } from '../modules/catalog/paging';
import { evidenceStorage } from './evidenceStorage';

const fields = [
  'id',
  'storage_key',
  'storage_provider',
  'sha256_hash',
  'file_size_bytes',
  'linked_entity_type',
  'linked_entity_id',
  'uploader_organization_id',
  'type',
  'validation_status',
  'malware_scan_status',
  'review_status',
  'malware_scanned_at',
];
export function evidenceAvailabilityProjection(alias = ''): string {
  const key = alias ? `${alias}.storage_key` : 'evidence_items.storage_key';
  return (
    fields.map((field) => (alias ? `${alias}.${field}` : field)).join(',') +
    `,COALESCE((SELECT cleanup.state FROM evidence_object_cleanup cleanup WHERE cleanup.object_key=${key}),'legacy') AS cleanup_state`
  );
}
export function evidenceAvailabilityUsableSql(alias = ''): string {
  const key = alias ? `${alias}.storage_key` : 'evidence_items.storage_key';
  return `NOT EXISTS(SELECT 1 FROM evidence_object_cleanup cleanup WHERE cleanup.object_key=${key} AND cleanup.state<>'retained')`;
}
export function evidenceAvailabilityFingerprint(row: Record<string, unknown>): string {
  return JSON.stringify([...fields, 'cleanup_state'].map((field) => row[field] ?? null));
}
export const MAX_WORKFLOW_EVIDENCE = 64;
export function assertWorkflowEvidenceLimit(rows: unknown[]): void {
  if (rows.length > MAX_WORKFLOW_EVIDENCE)
    throw new AppError(
      'Too many candidate evidence documents. Contact the platform operator to narrow this record.',
      422,
      'WORKFLOW_EVIDENCE_LIMIT',
    );
}
export interface EvidenceAvailability {
  available(row: Record<string, unknown>): boolean;
}
// The metadata snapshot is committed before any provider request. Provider errors
// are deferred until a current locked row needs the proof, preserving retries of
// actions that were already committed while the provider is temporarily down.
export async function preflightEvidence(
  load: (execute: Execute) => Promise<Record<string, unknown>[]>,
): Promise<EvidenceAvailability> {
  const rows = await withCatalogRead(load);
  const snapshots = new Map<unknown, { fingerprint: string; present: boolean; error?: unknown }>();
  let limitError: unknown;
  try {
    assertWorkflowEvidenceLimit(rows);
  } catch (error) {
    limitError = error;
  }
  if (!limitError && rows.length) {
    let next = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const probe = async () => {
      while (!stopped && next < rows.length) {
        const row = rows[next++];
        if (
          typeof row.storage_key !== 'string' ||
          !row.storage_key ||
          !['legacy', 'retained'].includes(String(row.cleanup_state))
        )
          continue;
        const fingerprint = evidenceAvailabilityFingerprint(row);
        try {
          snapshots.set(row.id, {
            fingerprint,
            present: await evidenceStorage().exists(row.storage_key),
          });
        } catch (error) {
          snapshots.set(row.id, {
            fingerprint,
            present: false,
            error:
              error instanceof AppError
                ? error
                : new AppError(
                    'Private evidence availability is unavailable. Retry later.',
                    503,
                    'EVIDENCE_STORAGE_UNAVAILABLE',
                  ),
          });
        }
      }
    };
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        stopped = true;
        reject(
          new AppError(
            'Evidence availability checks timed out. Retry later.',
            503,
            'WORKFLOW_EVIDENCE_TIMEOUT',
          ),
        );
      }, config.evidenceStorageTimeoutMs);
    });
    try {
      await Promise.race([
        Promise.all(Array.from({ length: Math.min(4, rows.length) }, probe)),
        timeout,
      ]);
    } catch (error) {
      limitError = error;
      stopped = true;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    available(row) {
      if (limitError) throw limitError;
      const snapshot = snapshots.get(row.id);
      if (!snapshot || snapshot.fingerprint !== evidenceAvailabilityFingerprint(row)) return false;
      if (snapshot.error) throw snapshot.error;
      return snapshot.present;
    },
  };
}
