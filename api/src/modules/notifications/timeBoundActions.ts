import { AppError } from '../../errors';
import type { Execute } from '../catalog/paging';
import type { Actor } from '../../services/resourcePolicy';
import type { TradeAction } from '../tradeActions/types';
const has = (actor: Actor, permission: string) =>
  actor.permissions.includes('*') || actor.permissions.includes(permission);
function bounded(rows: Record<string, unknown>[]) {
  if (rows.length > 1000)
    throw new AppError(
      'Expiry/deadline reminders exceed the supported scope. Narrow the underlying records with the operator.',
      503,
      'TIMED_NOTICE_LIMIT',
    );
  return rows;
}
function expiry(row: Record<string, unknown>, kind: 'certificate' | 'document'): TradeAction {
  const expired = row.expired === true;
  const date = new Date(String(row.expires_at)).toISOString();
  return {
    id: `${kind}-expiry:${row.id}:${date}:${expired ? 'expired' : 'due_soon'}`,
    kind: 'documents',
    priority: expired ? 5 : 30,
    requiresAction: true,
    title: `${kind === 'certificate' ? 'Certificate' : 'Document'} ${expired ? 'expired' : 'renewal due'}`,
    description: `${kind === 'certificate' ? 'Certificate validity' : 'Uploader-recorded document expiry'} for ${row.id} ends ${date} (UTC). ${expired ? 'Review renewal or replacement now.' : 'Review renewal or replacement within the next 30 days.'} This reminder does not extend validity or approve evidence.`,
    actionLabel: kind === 'certificate' ? 'Review certificate' : 'Review document',
    actionPath: kind === 'certificate' ? `/certs?search=${row.id}` : `/evidence?search=${row.id}`,
  };
}
export async function loadExpiryActions(actor: Actor, execute: Execute): Promise<TradeAction[]> {
  const actions: TradeAction[] = [];
  if (has(actor, 'certificate.read')) {
    const rows = bounded(
      (
        await execute(
          `SELECT id,((valid_to+1)::timestamp AT TIME ZONE 'UTC')::text AS expires_at,
      ((valid_to+1)::timestamp AT TIME ZONE 'UTC')<=NOW() AS expired FROM organic_certificates
      WHERE (certifier_organization_id=$1 OR farmer_organization_id=$1) AND status IN ('active','expired')
        AND ((valid_to+1)::timestamp AT TIME ZONE 'UTC')<=NOW()+INTERVAL '30 days'
      ORDER BY valid_to,id LIMIT 1001`,
          [actor.organizationId],
        )
      ).rows,
    );
    actions.push(...rows.map((row) => expiry(row, 'certificate')));
  }
  if (has(actor, 'evidence.read')) {
    const rows = bounded(
      (
        await execute(
          `SELECT id,linked_entity_type,linked_entity_id,document_expires_at::text AS expires_at,
      document_expires_at<=NOW() AS expired FROM evidence_items
      WHERE uploader_organization_id=$1 AND document_expires_at<=NOW()+INTERVAL '30 days'
        AND superseded_by_evidence_id IS NULL AND review_status IS DISTINCT FROM 'rejected'
        AND validation_status='validated' AND malware_scan_status='clean'
      ORDER BY document_expires_at,id LIMIT 1001`,
          [actor.organizationId],
        )
      ).rows,
    );
    actions.push(...rows.map((row) => expiry(row, 'document')));
  }
  if (actions.length > 1000)
    throw new AppError('Expiry reminders exceed the supported scope', 503, 'TIMED_NOTICE_LIMIT');
  return actions;
}
export async function loadRecallDeadlineActions(
  actor: Actor,
  execute: Execute,
): Promise<TradeAction[]> {
  // All signed-in affected organizations can acknowledge; manager scope never grants unrelated participants.
  const manageAll =
    actor.permissions.includes('*') || actor.permissions.includes('recall.manage.all');
  const manageOwn = has(actor, 'recall.manage');
  const rows = bounded(
    (
      await execute(
        `SELECT n.id,n.acknowledgement_due_at::text AS due_at,
      n.acknowledgement_due_at<=NOW() AS overdue,
      p.organization_id,participant.name AS participant_name,p.organization_id=$1 AS own,
      (n.initiated_by_organization_id=$1 AND $2::boolean) OR $3::boolean AS manager
    FROM recall_notices n JOIN recall_participants p ON p.recall_id=n.id JOIN organizations participant ON participant.id=p.organization_id
    WHERE n.status='active' AND n.acknowledgement_due_at IS NOT NULL AND p.acknowledged_at IS NULL
      AND (p.organization_id=$1 OR (n.initiated_by_organization_id=$1 AND $2::boolean) OR $3::boolean)
    ORDER BY n.acknowledgement_due_at,n.id,p.organization_id LIMIT 1001`,
        [actor.organizationId, manageOwn, manageAll],
      )
    ).rows,
  );
  return rows.map((row) => {
    const overdue = row.overdue === true;
    const own = row.own === true;
    return {
      id: `recall-ack:${row.id}:${row.organization_id}:${row.due_at}:${overdue ? 'overdue' : 'pending'}`,
      kind: 'waiting',
      priority: overdue ? 1 : 15,
      requiresAction: true,
      title: overdue ? 'Recall acknowledgement overdue' : 'Recall acknowledgement due',
      description: `${own ? 'Your organization must acknowledge' : `Affected organization ${String(row.participant_name)} has not acknowledged`}. Deadline ${new Date(String(row.due_at)).toISOString()} (UTC). ${overdue ? 'Contact or escalate through a verified channel now.' : 'Review the recall instructions before the deadline.'} Reading this notice is not acknowledgement; safety holds stay in force.`,
      actionLabel: own ? 'Review and acknowledge recall' : 'Review recall contacts',
      actionPath: `/recalls?recallId=${row.id}`,
    };
  });
}
