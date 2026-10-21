import type { Request, Response } from 'express';
import * as invitations from '../modules/invitationsWorkflow/useCases';

const failureStatus = {
  organization_missing: 404,
  role_missing: 400,
  account_exists: 409,
  invalid_invitation: 410,
  active_invitation_missing: 404,
  invitation_missing: 404,
};

function respond(res: Response, outcome: invitations.Outcome, successStatus = 200): void {
  if (outcome.kind !== 'success') {
    res.status(failureStatus[outcome.kind]).json({ error: outcome.message });
    return;
  }
  if (successStatus !== 200) res.status(successStatus);
  if (successStatus === 204) res.send();
  else res.json(outcome.value);
}

export async function createInvitation(req: Request, res: Response): Promise<void> {
  respond(
    res,
    await invitations.createInvitation(req.user!, {
      organizationId: req.body.organizationId,
      role: req.body.role,
      email: req.body.email,
    }),
    201,
  );
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store');
  respond(res, await invitations.listInvitations(req.user!));
}

export async function listInvitationPage(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store');
  respond(res, await invitations.listInvitationPage(req.user!, req.query));
}

export async function summarizeInvitations(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store');
  respond(res, await invitations.summarizeInvitations(req.user!));
}

export async function invitationDetails(req: Request, res: Response): Promise<void> {
  respond(res, await invitations.invitationDetails(req.params.token));
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  respond(
    res,
    await invitations.acceptInvitation(req.params.token, {
      name: req.body.name,
      password: req.body.password,
    }),
    201,
  );
}

export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  respond(res, await invitations.revokeInvitation(req.user!, req.params.id), 204);
}

export async function resendInvitation(req: Request, res: Response): Promise<void> {
  respond(res, await invitations.resendInvitation(req.user!, req.params.id));
}
