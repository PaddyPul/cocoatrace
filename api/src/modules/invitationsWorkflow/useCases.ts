import type { Actor } from '../../services/resourcePolicy';
import * as repository from './repository';
import { lockInvitationAuthority, lockInvitationTarget } from './authority';
import { withCatalogRead } from '../catalog/paging';
import { invitationPage, invitationSummary, legacyInvitations } from '../catalog/invitationRecords';
import { config } from '../../config/env';
import { allowIdentityLinkPreview } from '../../services/identityLinkPolicy';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { recordAudit } from '../../services/auditWriter';
import { createPendingInvitation } from '../../services/invitationIssuance';
import { enqueueInvitationDelivery, cancelInvitationDelivery } from '../invitationDelivery/outbox';
import { deliverInvitation } from '../../services/invitationDelivery';
export type InvitationActor = Actor & { id: string; sessionId?: string };
export interface InvitationDraft {
  organizationId?: string;
  role?: string;
  email: string;
}
export interface AccountDraft {
  name: string;
  password: string;
}
export type Outcome =
  | { kind: 'success'; value: unknown }
  | {
      kind:
        | 'organization_missing'
        | 'role_missing'
        | 'account_exists'
        | 'invalid_invitation'
        | 'active_invitation_missing'
        | 'invitation_missing';
      message: string;
    };

const exposeRawLinks = allowIdentityLinkPreview(config);

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function createInvitation(
  actor: InvitationActor,
  draft: InvitationDraft,
): Promise<Outcome> {
  const isAdmin = (actor.permissions || []).includes('*');
  const organizationId =
    isAdmin && draft.organizationId ? draft.organizationId : actor.organizationId;
  const org = (await repository.findOrganization([organizationId])).rows[0];
  if (!org) {
    return { kind: 'organization_missing', message: 'Organization not found' };
  }
  const roleName =
    isAdmin && draft.role ? draft.role : org.type === 'cooperative' ? 'farmer' : org.type;
  const role = (await repository.findRole([roleName])).rows[0];
  if (!role) {
    return { kind: 'role_missing', message: `No workspace role is configured for ${roleName}` };
  }
  const existing = await repository.findExistingUser([draft.email]);
  if (existing.rows[0]) {
    return { kind: 'account_exists', message: 'A user with this email already exists' };
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const invitation: { id: string; email: string; expires_at: Date; created_at: Date } =
    await createPendingInvitation({
      organizationId,
      email: draft.email,
      roleId: role.id,
      tokenHash: hashToken(token),
      token,
      actorId: actor.id,
      actorOrganizationId: actor.organizationId,
      actorSessionId: actor.sessionId,
    });
  const inviteUrl = `${config.publicWebUrl}/accept-invite/${token}`;
  const delivery = await deliverInvitation({
    id: invitation.id,
    token,
    to: draft.email,
    invitationUrl: inviteUrl,
    organizationName: org.name,
  });
  return {
    kind: 'success',
    value: {
      ...invitation,
      organizationName: org.name,
      role: role.name,
      emailDelivery: delivery.status,
      ...(exposeRawLinks ? { inviteUrl } : {}),
    },
  };
}

export async function listInvitations(actor: InvitationActor): Promise<Outcome> {
  return {
    kind: 'success',
    value: await withCatalogRead((execute) => legacyInvitations(execute, actor)),
  };
}
export async function listInvitationPage(
  actor: InvitationActor,
  parameters: Record<string, unknown>,
): Promise<Outcome> {
  return {
    kind: 'success',
    value: await withCatalogRead((execute) => invitationPage(execute, actor, parameters)),
  };
}
export async function summarizeInvitations(actor: InvitationActor): Promise<Outcome> {
  return {
    kind: 'success',
    value: await withCatalogRead((execute) => invitationSummary(execute, actor)),
  };
}

export async function invitationDetails(token: string): Promise<Outcome> {
  const result = await repository.findDetails([hashToken(token)]);
  const invitation = result.rows[0];
  if (!invitation || invitation.accepted_at || new Date(invitation.expires_at) <= new Date()) {
    return { kind: 'invalid_invitation', message: 'This invitation is invalid or has expired' };
  }
  return { kind: 'success', value: invitation };
}

export async function acceptInvitation(token: string, draft: AccountDraft): Promise<Outcome> {
  const client = await repository.getClient();
  try {
    await repository.begin(client);
    const candidate = (await repository.findCandidate(client, [hashToken(token)])).rows[0];
    if (!candidate) {
      await repository.rollback(client);
      return { kind: 'invalid_invitation', message: 'This invitation is invalid or has expired' };
    }
    const organization = (await repository.lockOrganization(client, [candidate.organization_id]))
      .rows[0];
    const invitation = (await repository.lockInvitation(client, [hashToken(token)])).rows[0];
    if (!invitation || !organization || organization.access_suspended_at) {
      await repository.rollback(client);
      return { kind: 'invalid_invitation', message: 'This invitation is invalid or has expired' };
    }
    const passwordHash = await bcrypt.hash(draft.password, 12);
    const userResult = await repository.insertUser(client, [
      invitation.organization_id,
      invitation.email,
      passwordHash,
      draft.name,
    ]);
    await repository.assignRole(client, [userResult.rows[0].id, invitation.role_id]);
    await repository.markAccepted(client, [invitation.id]);
    await cancelInvitationDelivery(client, invitation.id);
    await recordAudit(
      client,
      { id: userResult.rows[0].id, organizationId: invitation.organization_id },
      'member.invitation_accepted',
      'user_invitation',
      invitation.id,
    );
    await repository.commit(client);
    return {
      kind: 'success',
      value: {
        ...userResult.rows[0],
        message: 'Account created. Sign in to set up your workspace.',
      },
    };
  } catch (error: unknown) {
    await repository.rollback(client);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return { kind: 'account_exists', message: 'An account with this email already exists' };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeInvitation(
  actor: InvitationActor,
  invitationId: string,
): Promise<Outcome> {
  const client = await repository.getClient();
  try {
    await repository.begin(client);
    const { isPlatformAdmin } = await lockInvitationAuthority(client, actor);
    if (
      !(await lockInvitationTarget(client, invitationId, actor.organizationId, isPlatformAdmin))
    ) {
      await repository.rollback(client);
      return { kind: 'active_invitation_missing', message: 'Active invitation not found' };
    }
    const result = await repository.revoke(client, [
      invitationId,
      isPlatformAdmin,
      actor.organizationId,
    ]);
    if (!result.rows[0]) {
      await repository.rollback(client);
      return { kind: 'active_invitation_missing', message: 'Active invitation not found' };
    }
    await cancelInvitationDelivery(client, invitationId);
    await recordAudit(client, actor, 'member.invitation_revoked', 'user_invitation', invitationId);
    await repository.commit(client);
  } catch (error) {
    await repository.rollback(client);
    throw error;
  } finally {
    client.release();
  }
  return { kind: 'success', value: undefined };
}

export async function resendInvitation(
  actor: InvitationActor,
  invitationId: string,
): Promise<Outcome> {
  const token = crypto.randomBytes(32).toString('base64url');
  const client = await repository.getClient();
  let invitation;
  try {
    await repository.begin(client);
    const { isPlatformAdmin } = await lockInvitationAuthority(client, actor);
    if (
      !(await lockInvitationTarget(client, invitationId, actor.organizationId, isPlatformAdmin))
    ) {
      await repository.rollback(client);
      return { kind: 'invitation_missing', message: 'Invitation not found' };
    }
    const result = await repository.rotate(client, [
      hashToken(token),
      invitationId,
      isPlatformAdmin,
      actor.organizationId,
    ]);
    invitation = result.rows[0];
    if (!invitation) {
      await repository.rollback(client);
      return { kind: 'invitation_missing', message: 'Invitation not found' };
    }
    await enqueueInvitationDelivery(client, actor, invitation.id, token);
    await recordAudit(client, actor, 'member.invitation_resent', 'user_invitation', invitation.id);
    await repository.commit(client);
  } catch (error) {
    await repository.rollback(client);
    throw error;
  } finally {
    client.release();
  }
  const delivery = await deliverInvitation({
    id: invitation.id,
    token,
    to: invitation.email,
    invitationUrl: `${config.publicWebUrl}/accept-invite/${token}`,
    organizationName: invitation.organization_name,
  });
  return {
    kind: 'success',
    value: {
      id: invitation.id,
      email: invitation.email,
      expires_at: invitation.expires_at,
      emailDelivery: delivery.status,
      ...(exposeRawLinks ? { inviteUrl: `${config.publicWebUrl}/accept-invite/${token}` } : {}),
    },
  };
}
