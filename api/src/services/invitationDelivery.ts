import crypto from 'node:crypto';
import { query } from '../db';
import logger from '../logger';
import { sendInvitationEmail } from './emailSender';

export type InvitationDelivery = { status: 'sent' | 'suppressed' | 'failed' };

// Never persist or log bearer links. A token hash condition prevents a slow
// earlier send from overwriting the delivery status of a newer resend.
export async function deliverInvitation(input: {
  id: string; token: string; to: string; invitationUrl: string;
  recipientName?: string; organizationName?: string;
}): Promise<InvitationDelivery> {
  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
  let status: InvitationDelivery['status'];
  try {
    status = (await sendInvitationEmail(input)).status;
  } catch {
    status = 'failed';
    logger.error({ invitationId: input.id }, 'Invitation email submission failed; resend is available');
  }
  await query(`UPDATE user_invitations
    SET email_delivery_status=$1, email_attempted_at=NOW()
    WHERE id=$2 AND token_hash=$3`, [status, input.id, tokenHash]);
  return { status };
}
