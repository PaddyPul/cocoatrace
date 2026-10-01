import type { EmailDeliveryResult } from '../../services/emailSender';
import { JwtPayload } from '../../middleware/auth';

export type OrganizationAccessType = 'buyer' | 'supplier';
export type OrganizationAccessStatus = 'pending_email_verification' | 'pending_review' | 'approved' | 'rejected';
export type AccessReviewActor = Pick<JwtPayload, 'id' | 'organizationId' | 'permissions'>;

export type RequestOrganizationAccess = {
  organizationName: string;
  organizationType: OrganizationAccessType;
  jurisdiction: string;
  legalRegistrationNumber?: string;
  adminName: string;
  adminEmail: string;
};

export type OrganizationAccessApplication = RequestOrganizationAccess & {
  id: string;
  status: OrganizationAccessStatus;
  verificationExpiresAt: Date;
  emailVerifiedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewReason: string | null;
  approvedOrganizationId: string | null;
  firstAdminInvitationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApprovedOrganizationAccess = {
  application: OrganizationAccessApplication;
  organizationId: string;
  invitationId: string;
  invitationExpiresAt: Date;
};

export type AccessVerificationMessage = {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  verificationUrl: string;
  expiresAt: Date;
};

/**
 * Transactional email adapters must resolve only after the provider accepts
 * the message, reject on delivery submission failure, and never log the URL
 * because it contains a bearer verification credential.
 */
export interface OrganizationAccessEmailPort {
  sendAccessVerification(message: AccessVerificationMessage): Promise<EmailDeliveryResult>;
  sendFirstAdminInvitation(input: {
    invitationId: string; token: string; recipientEmail: string;
    recipientName: string; organizationName: string; invitationUrl: string;
  }): Promise<{ status: 'sent' | 'suppressed' | 'failed' }>;
}
