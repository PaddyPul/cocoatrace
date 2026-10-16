import { createHash } from 'node:crypto';
import { AppError } from '../../errors';
export const ROSTER_LIMIT = 500;
export const STALE_DAYS = 90;
export function assertCompleteRoster(rows: unknown[]): void {
  if (rows.length > ROSTER_LIMIT)
    throw new AppError(
      'Privileged roster exceeds the review limit; a complete review cannot be recorded',
      409,
      'ACCESS_REVIEW_LIMIT_EXCEEDED',
    );
}
export function activityFinding(
  lastSeen: string | null,
  now: Date,
): 'unknown' | 'stale_retained_evidence' | 'recent_retained_evidence' {
  if (
    !lastSeen ||
    !Number.isFinite(new Date(lastSeen).getTime()) ||
    new Date(lastSeen).getTime() > now.getTime()
  )
    return 'unknown';
  return now.getTime() - new Date(lastSeen).getTime() >= STALE_DAYS * 86400000
    ? 'stale_retained_evidence'
    : 'recent_retained_evidence';
}
export function snapshotHash(snapshot: unknown): string {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
