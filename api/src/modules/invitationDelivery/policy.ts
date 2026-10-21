/** Unknown credential failures require investigation/new consent, never blind retries. */
export const retryableInvitationErrors = ['SMTP_SUBMISSION_FAILED', 'FINAL_LEASE_EXPIRED'] as const;
