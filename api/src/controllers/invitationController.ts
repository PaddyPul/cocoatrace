import { Request, Response } from 'express';
import { config } from '../config/env';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getClient, query } from '../db';
import * as audit from '../services/audit';
import { createPendingInvitation } from '../services/invitationIssuance';
import { deliverInvitation } from '../services/invitationDelivery';
const exposeRawLinks = config.environment === 'demo' || config.environment === 'test';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function createInvitation(req: Request, res: Response): Promise<void> {
  const isAdmin = (req.user!.permissions || []).includes('*');
  const organizationId = isAdmin && req.body.organizationId ? req.body.organizationId : req.user!.organizationId;
  const org = (await query('SELECT id, name, type FROM organizations WHERE id=$1', [organizationId])).rows[0];
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
  const roleName = isAdmin && req.body.role ? req.body.role : org.type === 'cooperative' ? 'farmer' : org.type;
  const role = (await query('SELECT id, name FROM roles WHERE name=$1', [roleName])).rows[0];
  if (!role) { res.status(400).json({ error: `No workspace role is configured for ${roleName}` }); return; }
  const existing = await query('SELECT id FROM users WHERE email=$1', [req.body.email]);
  if (existing.rows[0]) { res.status(409).json({ error: 'A user with this email already exists' }); return; }

  const token = crypto.randomBytes(32).toString('base64url');
  const invitation = await createPendingInvitation({
    organizationId, email: req.body.email, roleId: role.id,
    tokenHash: hashToken(token), actorId: req.user!.id,
  });
  const inviteUrl = `${config.publicWebUrl}/accept-invite/${token}`;
  const delivery = await deliverInvitation({ id: invitation.id, token, to: req.body.email, invitationUrl: inviteUrl, organizationName: org.name });
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'member.invite', entityType: 'user_invitation', entityId: invitation.id, metadata: { invitedOrganizationId: organizationId, role: role.name } });
  res.status(201).json({ ...invitation, organizationName: org.name, role: role.name, emailDelivery: delivery.status, ...(exposeRawLinks ? { inviteUrl } : {}) });
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  const rows = await query(
    `SELECT i.id,i.email,i.expires_at,i.accepted_at,i.revoked_at,i.created_at,i.email_delivery_status,i.email_attempted_at,o.name AS organization_name,r.name AS role
     FROM user_invitations i JOIN organizations o ON o.id=i.organization_id JOIN roles r ON r.id=i.role_id
     WHERE ($1::boolean OR i.organization_id=$2) ORDER BY i.created_at DESC LIMIT 100`,
    [(req.user!.permissions || []).includes('*'), req.user!.organizationId]
  );
  res.json(rows.rows);
}

export async function invitationDetails(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT i.email,i.expires_at,i.accepted_at,o.name AS organization_name,o.type AS organization_type,r.name AS role
     FROM user_invitations i JOIN organizations o ON o.id=i.organization_id JOIN roles r ON r.id=i.role_id
     WHERE i.token_hash=$1 AND i.revoked_at IS NULL`, [hashToken(req.params.token)]
  );
  const invitation = result.rows[0];
  if (!invitation || invitation.accepted_at || new Date(invitation.expires_at) <= new Date()) { res.status(410).json({ error: 'This invitation is invalid or has expired' }); return; }
  res.json(invitation);
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const invitationResult = await client.query(
      `SELECT * FROM user_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE`,
      [hashToken(req.params.token)]
    );
    const invitation = invitationResult.rows[0];
    if (!invitation) { await client.query('ROLLBACK'); res.status(410).json({ error: 'This invitation is invalid or has expired' }); return; }
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const userResult = await client.query(
      'INSERT INTO users (organization_id,email,password_hash,name) VALUES ($1,$2,$3,$4) RETURNING id,email,name',
      [invitation.organization_id, invitation.email, passwordHash, req.body.name]
    );
    await client.query('INSERT INTO user_roles (user_id,role_id) VALUES ($1,$2)', [userResult.rows[0].id, invitation.role_id]);
    await client.query('UPDATE user_invitations SET accepted_at=NOW() WHERE id=$1', [invitation.id]);
    await client.query('COMMIT');
    res.status(201).json({ ...userResult.rows[0], message: 'Account created. Sign in to set up your workspace.' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') { res.status(409).json({ error: 'An account with this email already exists' }); return; }
    throw error;
  } finally { client.release(); }
}

export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  const isPlatformAdmin = (req.user!.permissions || []).includes('*');
  const result = await query(
    `UPDATE user_invitations
        SET revoked_at=COALESCE(revoked_at,NOW())
      WHERE id=$1
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND ($2::boolean OR organization_id=$3)
      RETURNING id`,
    [req.params.id, isPlatformAdmin, req.user!.organizationId],
  );
  if (!result.rows[0]) { res.status(404).json({ error: 'Active invitation not found' }); return; }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'member.invitation_revoked', entityType: 'user_invitation', entityId: req.params.id });
  res.status(204).send();
}

export async function resendInvitation(req: Request, res: Response): Promise<void> {
  const isPlatformAdmin = (req.user!.permissions || []).includes('*');
  const token = crypto.randomBytes(32).toString('base64url');
  const result = await query(
    `UPDATE user_invitations i
        SET token_hash=$1, expires_at=NOW()+INTERVAL '7 days', email_delivery_status='pending'
      WHERE i.id=$2
        AND i.accepted_at IS NULL AND i.revoked_at IS NULL
        AND ($3::boolean OR i.organization_id=$4)
      RETURNING i.id,i.email,i.expires_at,i.organization_id,
        (SELECT o.name FROM organizations o WHERE o.id=i.organization_id) AS organization_name`,
    [hashToken(token), req.params.id, isPlatformAdmin, req.user!.organizationId],
  );
  const invitation = result.rows[0];
  if (!invitation) { res.status(404).json({ error: 'Invitation not found' }); return; }
  const delivery = await deliverInvitation({
    id: invitation.id, token, to: invitation.email,
    invitationUrl: `${config.publicWebUrl}/accept-invite/${token}`,
    organizationName: invitation.organization_name,
  });
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'member.invitation_resent', entityType: 'user_invitation', entityId: invitation.id });
  res.json({ id: invitation.id, email: invitation.email, expires_at: invitation.expires_at, emailDelivery: delivery.status, ...(exposeRawLinks ? { inviteUrl: `${config.publicWebUrl}/accept-invite/${token}` } : {}) });
}
