import type { QueryResultRow } from 'pg';
import { AppError, ValidationError } from '../../errors';
import { requirePlatformAccessReviewer } from '../organizationAccess/policy';
import type { AccessReviewActor, OrganizationAccessApplication } from '../organizationAccess/types';
import { Execute, literal, pageResult, parsePage, text } from './paging';

export const applicationColumns = `id,organization_name,organization_type,jurisdiction,legal_registration_number,
  admin_name,admin_email,status,verification_expires_at,email_verified_at,reviewed_by_user_id,
  reviewed_at,review_reason,approved_organization_id,first_admin_invitation_id,created_at,updated_at`;

export function mapApplication(row: QueryResultRow): OrganizationAccessApplication {
  return {
    id: row.id,
    organizationName: row.organization_name,
    organizationType: row.organization_type,
    jurisdiction: row.jurisdiction,
    legalRegistrationNumber: row.legal_registration_number || undefined,
    adminName: row.admin_name,
    adminEmail: row.admin_email,
    status: row.status,
    verificationExpiresAt: row.verification_expires_at,
    emailVerifiedAt: row.email_verified_at,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    reviewReason: row.review_reason,
    approvedOrganizationId: row.approved_organization_id,
    firstAdminInvitationId: row.first_admin_invitation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function status(parameters: Record<string, unknown>) {
  const value = text(parameters.status, 'access application status', 32) || 'all';
  if (
    !['all', 'pending_email_verification', 'pending_review', 'approved', 'rejected'].includes(value)
  )
    throw new ValidationError('Invalid access application status');
  return value;
}
export async function accessApplicationSummary(execute: Execute, actor: AccessReviewActor) {
  requirePlatformAccessReviewer(actor);
  return (
    await execute(`SELECT COUNT(*)::int AS count,
    COUNT(*) FILTER(WHERE status='pending_email_verification')::int AS pending_email_verification_count,
    COUNT(*) FILTER(WHERE status='pending_review')::int AS pending_review_count,
    COUNT(*) FILTER(WHERE status='approved')::int AS approved_count,
    COUNT(*) FILTER(WHERE status='rejected')::int AS rejected_count
    FROM organization_access_applications`)
  ).rows[0];
}
export async function accessApplicationPage(
  execute: Execute,
  actor: AccessReviewActor,
  parameters: Record<string, unknown> = {},
) {
  requirePlatformAccessReviewer(actor);
  const filter = status(parameters);
  const input = parsePage(
    parameters,
    ['access-applications', actor.organizationId, [...actor.permissions].sort(), filter],
    ['status'],
  );
  const ids = (
    await execute(
      `SELECT id FROM organization_access_applications WHERE ($1::text='all' OR status=$1::text)
    AND ($2::uuid IS NULL OR id<$2::uuid)
    AND ($3::text='' OR concat_ws(' ',organization_name,organization_type,jurisdiction,admin_name,admin_email) ILIKE $4::text ESCAPE '\\') ORDER BY id DESC LIMIT $5::int`,
      [filter, input.cursor?.id || null, input.search, literal(input.search), input.limit + 1],
    )
  ).rows;
  const result = pageResult(ids, input);
  const items = result.items.length
    ? (
        await execute(
          `SELECT ${applicationColumns} FROM organization_access_applications WHERE id=ANY($1::uuid[]) ORDER BY id DESC`,
          [result.items.map((row) => row.id)],
        )
      ).rows.map(mapApplication)
    : [];
  const count = (
    await execute(
      "SELECT COUNT(*)::int AS count FROM organization_access_applications WHERE ($1::text='all' OR status=$1::text)",
      [filter],
    )
  ).rows[0].count;
  return { ...result, items, count };
}
// The service authorizes legacy callers before invoking the repository. This
// helper is also usable by the repository without manufacturing an actor.
export async function legacyAccessApplications(execute: Execute) {
  const ids = (
    await execute('SELECT id FROM organization_access_applications ORDER BY id DESC LIMIT 1001')
  ).rows;
  if (ids.length > 1000)
    throw new AppError(
      'Access application history exceeds the complete list limit. Use paged search.',
      422,
      'CATALOG_READ_LIMIT',
    );
  if (!ids.length) return [];
  return (
    await execute(
      `SELECT ${applicationColumns} FROM organization_access_applications WHERE id=ANY($1::uuid[]) ORDER BY created_at DESC,id DESC`,
      [ids.map((row) => row.id)],
    )
  ).rows.map(mapApplication);
}
