import type {Page} from '@playwright/test';
import {test,expect} from './support/fixtures';
import {accountPassword,createWorkspace,signIn} from './support/identity';
import {emailLink} from './support/inbox';

async function expectRestrictedSupplier(page:Page){
  const response=await page.request.get('/api/holdings');
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe('MFA_REQUIRED');
}
async function expectVerifiedSupplier(page:Page){
  expect((await (await page.request.get('/api/me')).json()).mfa).toMatchObject({required:true,enrolled:true,verified:true});
  expect((await page.request.get('/api/holdings')).status()).toBe(200);
  const forbidden=await page.request.get('/api/organizations');
  expect(forbidden.status()).toBe(403);
  expect((await forbidden.json()).error).toBe('Permission required: organization.admin');
}

test('real passkey: enrollment, restricted password session, signed sign-in and password-reset preservation',async({page,browser})=>{
  test.setTimeout(180_000);
  const identity=await createWorkspace(page,browser,'supplier');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await page.goto('/account/passkeys');
  await page.getByLabel('Passkey name').fill('Browser regression key');
  await page.getByLabel('Current password',{exact:true}).fill(accountPassword);
  await page.getByRole('button',{name:'Enroll passkey',exact:true}).click();
  await expect(page).toHaveURL(/\/home/);
  expect((await (await page.request.get('/api/me')).json()).mfa).toMatchObject({enrolled:true,verified:true});
  await page.goto('/account/passkeys');
  await page.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Keep at least one key');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page,identity.email,accountPassword);
  await expect(page.getByRole('heading',{name:'Protect your account with a passkey'})).toBeVisible();
  await expectRestrictedSupplier(page);
  await page.getByRole('button',{name:'Verify passkey and continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Protect your account with a passkey'})).toHaveCount(0);
  await expectVerifiedSupplier(page);
  await page.goto('/account/passkeys');await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/forgot-password');await page.getByLabel('Work email').fill(identity.email);
  await page.getByRole('button',{name:'Send reset instructions',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Check your email',exact:true})).toBeVisible();
  const mail=await emailLink(identity.email,'reset');await page.goto(mail.link);
  const changed='ChangedPasskeyPassword456!';
  await page.getByLabel('New password',{exact:true}).fill(changed);await page.getByLabel('Confirm new password',{exact:true}).fill(changed);
  const resetCompleted=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/api/auth/password/reset')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Set new password',exact:true}).click();
  const resetResponse=await resetCompleted;
  expect(resetResponse.status(),'Passkey journey password reset must complete before signing in').toBe(204);
  await expect(page.getByRole('heading',{name:'Password updated',exact:true})).toBeVisible();
  await signIn(page,identity.email,changed);
  await expect(page.getByRole('heading',{name:'Protect your account with a passkey'})).toBeVisible();
  await expectRestrictedSupplier(page);
  await page.getByRole('button',{name:'Verify passkey and continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Protect your account with a passkey'})).toHaveCount(0);
  await expectVerifiedSupplier(page);
});
