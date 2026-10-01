import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ForbiddenError } from '../../errors';
import { OrganizationAccessRepository } from './repository';
import { OrganizationAccessService } from './service';
import { OrganizationAccessApplication, OrganizationAccessEmailPort } from './types';

const application: OrganizationAccessApplication = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  organizationName: 'Serious Materials Ltd',
  organizationType: 'supplier',
  jurisdiction: 'GH',
  adminName: 'Ama Admin',
  adminEmail: 'ama@example.com',
  status: 'pending_email_verification',
  verificationExpiresAt: new Date('2026-10-02T00:00:00Z'),
  emailVerifiedAt: null,
  reviewedByUserId: null,
  reviewedAt: null,
  reviewReason: null,
  approvedOrganizationId: null,
  firstAdminInvitationId: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};

const input = {
  organizationName: application.organizationName,
  organizationType: application.organizationType,
  jurisdiction: application.jurisdiction,
  adminName: application.adminName,
  adminEmail: application.adminEmail,
};

function dependencies(exposeRawLinks = false) {
  const repository = {
    create: vi.fn().mockResolvedValue(application),
    removeUnverified: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn(),
    list: vi.fn().mockResolvedValue([application]),
    get: vi.fn().mockResolvedValue(application),
    approve: vi.fn(),
    reject: vi.fn(),
  } as unknown as OrganizationAccessRepository;
  const email = { sendAccessVerification: vi.fn().mockResolvedValue(undefined) } as OrganizationAccessEmailPort;
  return { repository, email, service: new OrganizationAccessService(repository, email, 'https://app.example.com', exposeRawLinks) };
}

describe('organization access service', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('stores only the token hash, sends the raw verification URL and does not expose it outside demo/test', async () => {
    const { repository, email, service } = dependencies(false);
    const result = await service.requestAccess(input);

    const stored = vi.mocked(repository.create).mock.calls[0][0];
    const message = vi.mocked(email.sendAccessVerification).mock.calls[0][0];
    expect(stored.verificationTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(message.verificationUrl).toContain('https://app.example.com/verify-access?token=');
    expect(message.verificationUrl).not.toContain(stored.verificationTokenHash);
    expect(result).not.toHaveProperty('verificationUrl');
  });

  it('returns the verification URL only when explicitly configured for demo/test', async () => {
    const { service } = dependencies(true);
    await expect(service.requestAccess(input)).resolves.toHaveProperty('verificationUrl');
  });

  it('removes a new unverified application when email submission fails', async () => {
    const { repository, email, service } = dependencies();
    vi.mocked(email.sendAccessVerification).mockRejectedValueOnce(new AppError('Email unavailable', 503, 'EMAIL_UNAVAILABLE'));

    await expect(service.requestAccess(input)).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
    expect(repository.removeUnverified).toHaveBeenCalledWith(application.id);
  });

  it('consumes the hashed verification token and rejects invalid or reused tokens', async () => {
    const { repository, service } = dependencies();
    vi.mocked(repository.verifyEmail).mockResolvedValueOnce({ ...application, status: 'pending_review', emailVerifiedAt: new Date() });
    await service.verifyEmail('raw-verification-token');
    expect(repository.verifyEmail).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/));

    vi.mocked(repository.verifyEmail).mockResolvedValueOnce(null);
    await expect(service.verifyEmail('reused-token')).rejects.toMatchObject({ statusCode: 410 });
  });

  it('allows only a platform wildcard actor to review applications', async () => {
    const { repository, service } = dependencies();
    const ordinaryActor = { id: 'user', organizationId: 'org', permissions: ['organization.admin'] };
    await expect(service.list(ordinaryActor)).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.list).not.toHaveBeenCalled();
  });
});
