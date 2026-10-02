import { baseURL } from './environment';
import crypto from 'node:crypto';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { emailLink } from './inbox';

// In-memory, per-browser fixture state only: no credential-bearing file artifacts.
// Each workspace still has an isolated reviewer context, but does not consume a
// fresh login from the same administrator's production rate-limit bucket.
const reviewerSessions = new WeakMap<Browser, Awaited<ReturnType<BrowserContext['storageState']>>>();

export const accountPassword = 'BrowserCustomerPassword123!';
export function freshIdentity(role: 'buyer' | 'supplier' = 'supplier') {
  const suffix = crypto.randomUUID();
  return { organization: `Browser ${role} ${suffix}`, email: `customer-${suffix}@browser.test`, name: 'Browser Customer', role };
}

export async function requestAccess(page: Page, identity: ReturnType<typeof freshIdentity>): Promise<void> {
  await page.goto('/request-access');
  await page.getByLabel('Organization name', { exact: true }).fill(identity.organization);
  await page.getByLabel('Organization role').selectOption(identity.role);
  await page.getByLabel('Full name', { exact: true }).fill(identity.name);
  await page.getByLabel('Work email', { exact: true }).fill(identity.email);
  await page.getByRole('button', { name: 'Submit access request' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email address', exact: true })).toBeVisible();
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const loginEvent = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const login = await loginEvent;
  expect(login.status(), 'Fixture sign-in must return HTTP 200; HTTP 429 indicates an exhausted login bucket').toBe(200);
  await expect(page).toHaveURL(/\/(home|onboarding)(\?|$)/);
}

export async function completeOnboarding(page: Page, role: 'buyer' | 'supplier'): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Show me how it works' }).click();
  await page.getByRole('button', { name: role === 'buyer' ? /Buy verified supply/ : /Sell verified supply/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Enter my workspace' }).click();
  await expect(page).toHaveURL(/\/home/);
}

export async function acceptInvitation(page: Page, link: string, name: string): Promise<void> {
  await page.goto(link);
  await page.getByLabel('Full name', { exact: true }).fill(name);
  await page.getByLabel('Password', { exact: true }).fill(accountPassword);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();
}

export async function createWorkspace(page: Page, browser: Browser, role: 'buyer' | 'supplier' = 'supplier') {
  const identity = freshIdentity(role);
  await requestAccess(page, identity);
  const verification = await emailLink(page.request, identity.email, 'verification');
  await page.goto(verification.link);
  await expect(page.getByRole('heading', { name: 'Email address verified', exact: true })).toBeVisible();
  // Full reload ensures a reused link is tested against the server, not the
  // verification page's in-memory React StrictMode request cache.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Verification unavailable' })).toBeVisible();
  const reviewer = await browser.newContext({ baseURL, storageState: reviewerSessions.get(browser) });
  try {
    const reviewPage = await reviewer.newPage();
    const session = await reviewer.request.get('/api/me');
    if (session.status() === 401) {
      await signIn(reviewPage, 'platform-admin@browser.test', 'BrowserAdminPassword123!');
      reviewerSessions.set(browser, await reviewer.storageState());
    } else {
      expect(session.status(), 'Cached reviewer session must remain valid').toBe(200);
    }
    await reviewPage.goto('/access-applications');
    await reviewPage.locator('article').filter({ hasText: identity.organization }).getByRole('button', { name: 'Review', exact: true }).click();
    await reviewPage.getByLabel('Review reason or note').fill('Browser regression fixture approval');
    await reviewPage.getByRole('button', { name: 'Approve and invite' }).click();
    await expect(reviewPage.getByText('Organization approved; invitation submitted to email provider', { exact: true })).toBeVisible();
  } finally { await reviewer.close(); }
  const invitation = await emailLink(page.request, identity.email, 'invitation');
  await acceptInvitation(page, invitation.link, identity.name);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
  await signIn(page, identity.email, accountPassword);
  await completeOnboarding(page, role);
  return identity;
}
