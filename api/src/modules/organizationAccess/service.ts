import crypto from 'crypto';
import logger from '../../logger';
import { AppError, ConflictError } from '../../errors';
import { requirePlatformAccessReviewer } from './policy';
import { OrganizationAccessRepository } from './repository';
import {
  AccessReviewActor,
  OrganizationAccessApplication,
  OrganizationAccessEmailPort,
  RequestOrganizationAccess,
} from './types';

const verificationLifetimeMs = 24 * 60 * 60 * 1000;
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function createToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class OrganizationAccessService {
  constructor(
    private readonly repository: OrganizationAccessRepository,
    private readonly email: OrganizationAccessEmailPort,
    private readonly publicWebUrl: string,
    private readonly exposeRawLinks: boolean,
  ) {}

  async requestAccess(input: RequestOrganizationAccess): Promise<{
    application: OrganizationAccessApplication;
    verificationUrl?: string;
    emailDelivery: 'sent' | 'suppressed' | 'failed';
  }> {
    const token = createToken();
    const verificationExpiresAt = new Date(Date.now() + verificationLifetimeMs);
    const application = await this.repository.create({
      ...input,
      verificationTokenHash: hashToken(token),
      verificationExpiresAt,
    });
    const verificationUrl = `${this.publicWebUrl}/verify-access?token=${encodeURIComponent(token)}`;
    let emailDelivery: 'sent' | 'suppressed' | 'failed';
    try {
      const delivery = await this.email.sendAccessVerification({
        recipientEmail: input.adminEmail,
        recipientName: input.adminName,
        organizationName: input.organizationName,
        verificationUrl,
        expiresAt: verificationExpiresAt,
      });
      emailDelivery = delivery.status;
    } catch {
      logger.error({ applicationId: application.id }, 'Verification email submission failed; application retained for retry');
      emailDelivery = 'failed';
    }
    return {
      application,
      emailDelivery,
      ...(this.exposeRawLinks ? { verificationUrl } : {}),
    };
  }

  async verifyEmail(token: string): Promise<OrganizationAccessApplication> {
    const application = await this.repository.verifyEmail(hashToken(token));
    if (!application) throw new AppError('This verification link is invalid or has expired', 410, 'ACCESS_VERIFICATION_INVALID');
    return application;
  }

  async list(actor: AccessReviewActor): Promise<OrganizationAccessApplication[]> {
    requirePlatformAccessReviewer(actor);
    return this.repository.list();
  }

  async get(actor: AccessReviewActor, id: string): Promise<OrganizationAccessApplication> {
    requirePlatformAccessReviewer(actor);
    const application = await this.repository.get(id);
    if (!application) throw new AppError('Access application not found', 404, 'NOT_FOUND');
    return application;
  }

  async approve(actor: AccessReviewActor, id: string, reason?: string) {
    requirePlatformAccessReviewer(actor);
    const invitationToken = createToken();
    const result = await this.repository.approve({
      id,
      actor,
      reason,
      invitationTokenHash: hashToken(invitationToken),
      invitationExpiresAt: new Date(Date.now() + invitationLifetimeMs),
    });
    const inviteUrl = `${this.publicWebUrl}/accept-invite/${encodeURIComponent(invitationToken)}`;
    const delivery = await this.email.sendFirstAdminInvitation({
      invitationId: result.invitationId, token: invitationToken,
      recipientEmail: result.application.adminEmail,
      recipientName: result.application.adminName,
      organizationName: result.application.organizationName, invitationUrl: inviteUrl,
    });
    return {
      ...result,
      emailDelivery: delivery.status,
      ...(this.exposeRawLinks ? { inviteUrl } : {}),
    };
  }

  async reject(actor: AccessReviewActor, id: string, reason?: string): Promise<OrganizationAccessApplication> {
    requirePlatformAccessReviewer(actor);
    if (reason !== undefined && !reason.trim()) throw new ConflictError('Review reason cannot be blank');
    return this.repository.reject(id, actor, reason?.trim());
  }
}
