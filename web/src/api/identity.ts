import { api } from './http';
import type { CatalogPage } from './http';

export const auth = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: any }>('POST', '/auth/login', { email, password }),
  me: () => api<any>('GET', '/me'),
  logout: () => api<void>('POST', '/auth/logout'),
  requestAccess: (data: {
    organizationName: string;
    organizationType: 'buyer' | 'supplier';
    jurisdiction: string;
    legalRegistrationNumber?: string;
    adminName: string;
    adminEmail: string;
  }) =>
    api<{
      application: AccessApplication;
      emailDelivery: 'sent' | 'suppressed' | 'failed';
      verificationUrl?: string;
    }>('POST', '/auth/request-access', data),
  verifyAccessRequest: (verificationToken: string) =>
    api<{ id: string; status: 'pending_review'; emailVerifiedAt: string }>(
      'POST',
      '/auth/request-access/verify',
      { token: verificationToken },
    ),
  forgotPassword: (email: string) =>
    api<{ message: string }>('POST', '/auth/password/forgot', { email }),
  resetPassword: (resetToken: string, password: string) =>
    api<void>('POST', '/auth/password/reset', { token: resetToken, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('POST', '/auth/password/change', { currentPassword, newPassword }),
  invitation: (token: string) => api<any>('GET', `/auth/invitations/${token}`),
  acceptInvitation: (token: string, data: { name: string; password: string }) =>
    api<any>('POST', `/auth/invitations/${token}/accept`, data),
};

export interface AccessApplication {
  id: string;
  status: 'pending_email_verification' | 'pending_review' | 'approved' | 'rejected' | string;
  organizationName: string;
  organizationType: 'buyer' | 'supplier';
  jurisdiction: string;
  legalRegistrationNumber?: string | null;
  adminName: string;
  adminEmail: string;
  verificationExpiresAt?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  approvedOrganizationId?: string | null;
  firstAdminInvitationId?: string | null;
}

export interface AccessApplicationSummary {
  count: number;
  pending_email_verification_count: number;
  pending_review_count: number;
  approved_count: number;
  rejected_count: number;
}

export const accessApplications = {
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<AccessApplication> & { count: number }>(
      'GET',
      `/access-applications/page?${new URLSearchParams(parameters)}`,
    ),
  summary: () => api<AccessApplicationSummary>('GET', '/access-applications/summary'),
  list: () => api<AccessApplication[]>('GET', '/access-applications'),
  get: (id: string) => api<AccessApplication>('GET', `/access-applications/${id}`),
  approve: (id: string, reason?: string) =>
    api<{
      application: AccessApplication;
      organizationId: string;
      invitationId: string;
      invitationExpiresAt: string;
      emailDelivery: 'sent' | 'suppressed' | 'failed' | 'pending';
      inviteUrl?: string;
    }>('POST', `/access-applications/${id}/approve`, reason ? { reason } : {}),
  reject: (id: string, reason?: string) =>
    api<AccessApplication>('POST', `/access-applications/${id}/reject`, reason ? { reason } : {}),
};

export interface InvitationRecord {
  id: string;
  email: string;
  organization_name: string;
  role: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  email_delivery_status?: string | null;
}

export interface InvitationSummary {
  count: number;
  pending_count: number;
  accepted_count: number;
  revoked_count: number;
  expired_count: number;
}

export interface InvitationResult {
  inviteUrl?: string;
  emailDelivery?: string;
}

export const invitations = {
  page: (parameters: Record<string, string>) =>
    api<CatalogPage<InvitationRecord> & { count: number }>(
      'GET',
      `/invitations/page?${new URLSearchParams(parameters)}`,
    ),
  summary: () => api<InvitationSummary>('GET', '/invitations/summary'),
  list: () => api<any[]>('GET', '/invitations'),
  create: (data: { email: string; organizationId?: string; role?: string }) =>
    api<InvitationResult>('POST', '/invitations', data),
  resend: (id: string) => api<InvitationResult>('POST', `/invitations/${id}/resend`),
  revoke: (id: string) => api<void>('POST', `/invitations/${id}/revoke`),
};
