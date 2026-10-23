import { chromium, expect } from '@playwright/test';

// This check enrolls a disposable virtual key. Never run against an existing
// founder rehearsal: CI explicitly resets the fixed synthetic project first.
if (process.env.CI_SYNTHETIC_PREVIEW_CHECK !== 'true') {
  throw new Error('Passkey rehearsal regression is restricted to the disposable CI preview');
}
const baseURL = 'http://localhost:14000';
const browser = await chromium.launch({ headless: true });
try {
  for (const email of ['newbuyer@cocoatrace.io', 'newsupplier@cocoatrace.io']) {
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    try {
      const response = await context.request.post('/api/auth/login', {
        data: { email, password: 'Password123!' },
      });
      if (response.status() !== 200) throw new Error('Synthetic workspace sign-in failed');
      const trades = await context.request.get('/api/trade-actions');
      const body = await trades.json();
      if (!trades.ok() || !Array.isArray(body) || body.length !== 0)
        throw new Error(
          'Fresh synthetic workspace contains inherited trades or unreadable trade state',
        );
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Rehearse buyer setup' })).toBeVisible();
    await expect(
      page.getByText('Restart setup in the shared buyer demo. Previous trades are retained.'),
    ).toBeVisible();
    async function signIn() {
      await page.goto('/login');
      await page.getByLabel('Email address', { exact: true }).fill('admin@cocoatrace.io');
      await page.getByLabel('Password', { exact: true }).fill('Password123!');
      const response = page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      if ((await response).status() !== 200)
        throw new Error('Synthetic administrator sign-in failed');
      await expect(page).not.toHaveURL(/\/login$/);
    }
    await signIn();
    await page.goto('/account/passkeys');
    const keys = await context.request.get('/api/auth/mfa/keys');
    const keyList = (await keys.json()).keys;
    if (
      !keys.ok() ||
      !Array.isArray(keyList) ||
      keyList.length !== 0 ||
      (await context.request.get('/api/me')).status() !== 200
    )
      throw new Error('Synthetic administrator must start without enrolled keys in disposable CI');
    await page.getByLabel('Passkey name').fill('Disposable CI rehearsal key');
    await page.getByLabel('Current password', { exact: true }).fill('Password123!');
    const options = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/auth/mfa/registration/options',
    );
    await page.getByRole('button', { name: 'Enroll passkey', exact: true }).click();
    const payload = await (await options).json();
    if (payload.rp?.id !== 'localhost') throw new Error('Local passkey RP must be localhost');
    await expect(page).toHaveURL(/\/home/);
    const enrolled = await (await context.request.get('/api/me')).json();
    if (!enrolled.mfa?.enrolled || !enrolled.mfa?.verified || !enrolled.mfa?.fresh)
      throw new Error('Passkey enrollment did not establish fresh administrator assurance');
    await page.goto('/account/passkeys');
    const signedOut = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/auth/logout' && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    const logoutResponse = await signedOut;
    if (logoutResponse.status() !== 204 || (await logoutResponse.finished()))
      throw new Error('Synthetic administrator sign-out did not complete');
    await signIn();
    await expect(
      page.getByRole('button', { name: 'Verify passkey and continue', exact: true }),
    ).toBeVisible();
    // /home already renders the MFA gate after password sign-in. Its URL is
    // not evidence that the asynchronous WebAuthn ceremony has completed.
    const authenticated = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/auth/mfa/authentication/verify' &&
        r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Verify passkey and continue', exact: true }).click();
    const authenticationResponse = await authenticated;
    if (authenticationResponse.status() !== 200 || (await authenticationResponse.finished()))
      throw new Error('Synthetic administrator passkey verification did not complete');
    await expect(page).toHaveURL(/\/home/);
    const verified = await (await context.request.get('/api/me')).json();
    if (!verified.mfa?.verified || !verified.mfa?.fresh)
      throw new Error('Passkey sign-in did not restore fresh administrator assurance');
  } finally {
    await context.close();
  }
  console.log(
    'PASS: clean buyer/supplier trade state and real localhost WebAuthn administrator enrollment/sign-in with fresh assurance',
  );
} finally {
  await browser.close();
}
