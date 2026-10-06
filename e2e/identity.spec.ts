import { baseURL } from './support/environment';
import { test, expect } from './support/fixtures';
import { accountPassword, acceptInvitation, createWorkspace, freshIdentity, requestAccess, signIn } from './support/identity';
import { emailLink } from './support/inbox';
import { expireVerification } from './support/database';

for (const role of ['buyer', 'supplier'] as const) {
  test(`${role}: request access, read verification and approval emails, accept invitation, onboard and sign out`, async ({ page, browser }) => {
    const identity = await createWorkspace(page, browser, role);
    await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/auth/logout') && response.status() === 204), page.getByRole('button', { name: 'Sign out', exact: true }).click()]);
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/account/security');
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page, identity.email, accountPassword);
    await page.goto('/account/security');
    await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  });
}

test('team invitations: create, resend, reject old link, revoke, reject revoked link and join', async ({ page, browser }) => {
  await createWorkspace(page, browser);
  await page.goto('/pilot');
  const email = freshIdentity().email;
  await page.getByLabel('Work email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
  const first = await emailLink(page.request, email, 'invitation');
  const row = page.locator('div.rounded-2xl').filter({ has: page.getByText(email, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Resend', exact: true }) });
  await row.getByRole('button', { name: 'Resend', exact: true }).click();
  const resent = await emailLink(page.request, email, 'invitation', first.id);
  const guest = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL });
  try {
    const invited = await guest.newPage();
    await invited.goto(first.link);
    await expect(invited.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
    await invited.goto(resent.link);
    await expect(invited.getByRole('heading', { name: 'Create your workspace' })).toBeVisible();
    await row.getByRole('button', { name: 'Revoke', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Resend', exact: true })).toHaveCount(0);
    await invited.reload();
    await expect(invited.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
    const joinedEmail = freshIdentity().email;
    await page.getByLabel('Work email', { exact: true }).fill(joinedEmail);
    await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
    const joined = await emailLink(page.request, joinedEmail, 'invitation');
    await acceptInvitation(invited, joined.link, 'Browser Team Member');
    await signIn(invited, joinedEmail, accountPassword);
    await expect(invited).toHaveURL(/\/(home|onboarding)/);
  } finally { await guest.close(); }
});

test('password reset: real captured email, token single use, old password fails, new password signs in', async ({ page, browser }) => {
  const identity = await createWorkspace(page, browser);
  const session = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL });
  try {
    const recovery = await session.newPage();
    await recovery.goto('/forgot-password');
    await recovery.getByLabel('Work email').fill(identity.email);
    await recovery.getByRole('button', { name: 'Send reset instructions' }).click();
    await expect(recovery.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    const reset = await emailLink(recovery.request, identity.email, 'reset');
    await recovery.goto(reset.link);
    await recovery.getByLabel('New password', { exact: true }).fill('BrowserResetPassword456!');
    await recovery.getByLabel('Confirm new password', { exact: true }).fill('BrowserResetPassword456!');
    await recovery.getByRole('button', { name: 'Set new password' }).click();
    await expect(recovery.getByRole('heading', { name: 'Password updated' })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await recovery.goto(reset.link);
    await recovery.getByLabel('New password', { exact: true }).fill('BrowserAnotherPassword789!');
    await recovery.getByLabel('Confirm new password', { exact: true }).fill('BrowserAnotherPassword789!');
    await recovery.getByRole('button', { name: 'Set new password' }).click();
    await expect(recovery.getByRole('alert')).toContainText(/invalid|expired/i);
    await recovery.goto('/login');
    await recovery.getByLabel('Email address', { exact: true }).fill(identity.email);
    await recovery.getByLabel('Password', { exact: true }).fill(accountPassword);
    await recovery.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(recovery.getByText('Invalid credentials', { exact: true })).toBeVisible();
    await signIn(recovery, identity.email, 'BrowserResetPassword456!');
  } finally { await session.close(); }
});

test('password change preserves this browser session and revokes another browser session', async ({ page, browser }) => {
  const identity = await createWorkspace(page, browser);
  const otherContext = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL });
  try {
    const other = await otherContext.newPage();
    await signIn(other, identity.email, accountPassword);
    await other.goto('/account/security');
    await page.goto('/account/security');
    await page.getByLabel('Current password').fill(accountPassword);
    await page.getByLabel('New password', { exact: true }).fill('BrowserChangedPassword456!');
    await page.getByLabel('Confirm new password').fill('BrowserChangedPassword456!');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.getByText('Password changed. Other sessions have been revoked.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
    await other.reload();
    await expect(other).toHaveURL(/\/login$/);
  } finally { await otherContext.close(); }
});

test('expired verification fails, retry rotates the link and only the newest email can verify', async ({ page, browser }) => {
  const identity = freshIdentity();
  await requestAccess(page, identity);
  const first = await emailLink(page.request, identity.email, 'verification');
  await expireVerification(identity.email);
  const guest = await browser.newContext({ extraHTTPHeaders: { Origin: baseURL }, baseURL });
  try {
    const verificationPage = await guest.newPage();
    await verificationPage.goto(first.link);
    await expect(verificationPage.getByRole('heading', { name: 'Verification unavailable' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry verification email with these details' }).click();
    await page.getByRole('button', { name: 'Submit access request' }).click();
    const latest = await emailLink(page.request, identity.email, 'verification', first.id);
    await verificationPage.goto(first.link);
    await expect(verificationPage.getByRole('heading', { name: 'Verification unavailable' })).toBeVisible();
    await verificationPage.goto(latest.link);
    await expect(verificationPage.getByRole('heading', { name: 'Email address verified' })).toBeVisible();
    await verificationPage.reload();
    await expect(verificationPage.getByRole('heading', { name: 'Verification unavailable' })).toBeVisible();
  } finally { await guest.close(); }
});
