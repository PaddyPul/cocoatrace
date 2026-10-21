import { query } from '../db';
import logger from '../logger';
import { invitationTokenHash } from '../modules/invitationDelivery/outbox';
import { processInvitationEmails } from '../modules/invitationDelivery/worker';

export type InvitationDelivery = { status: 'sent' | 'suppressed' | 'failed' | 'pending' };
/** Best-effort immediate drain of already committed work. Recovery never needs this caller's token. */
export async function deliverInvitation(input: {
  id: string;
  token: string;
  to: string;
  invitationUrl: string;
  recipientName?: string;
  organizationName?: string;
}): Promise<InvitationDelivery> {
  try {
    await processInvitationEmails(undefined, 1, input.id);
    const row = (
      await query<{ status: string }>(
        `SELECT status FROM invitation_email_outbox
      WHERE invitation_id=$1 AND token_hash=$2`,
        [input.id, invitationTokenHash(input.token)],
      )
    ).rows[0];
    const status = row?.status;
    if (status === 'sent' || status === 'suppressed') return { status };
    if (status === 'failed' || status === 'failed_terminal') return { status: 'failed' };
    return { status: 'pending' };
  } catch {
    logger.error(
      { invitationId: input.id },
      'Invitation immediate delivery deferred; committed outbox retained',
    );
    return { status: 'pending' };
  }
}
