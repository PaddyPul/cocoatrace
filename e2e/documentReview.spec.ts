import { test, expect } from '@playwright/test';
const record = {
  id: 'proof',
  type: 'other',
  file_name: 'retained-proof.pdf',
  sha256_hash: 'a'.repeat(64),
  linked_entity_type: 'batch',
  linked_entity_id: 'batch',
  uploader_organization_id: 'supplier',
  review_status: 'pending',
  review_revision: 0,
  fingerprint: 'fingerprint-1',
  created_at: '2026-10-17',
};
test('document decisions bind the reviewed fingerprint and retain reason through conflict and refresh', async ({
  page,
}) => {
  const user = {
    id: 'reviewer',
    name: 'Reviewer',
    email: 'reviewer@example.test',
    organizationId: 'platform',
    orgName: 'Platform',
    orgType: 'admin',
    permissions: ['*'],
    roles: [],
  };
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  let posted: unknown;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/me')
      body = { ...user, organization_id: 'platform', org_name: 'Platform', org_type: 'admin' };
    if (path === '/api/onboarding') body = { status: 'completed' };
    if (path === '/api/evidence/review/page')
      body = { items: [record], hasMore: false, nextCursor: null };
    if (path === '/api/evidence/proof/review') {
      if (route.request().method() === 'POST') {
        posted = route.request().postDataJSON();
        await route.fulfill({
          status: 409,
          json: { error: 'Document changed; refresh and review the latest hash.' },
        });
        return;
      }
      body = { evidence: record, fingerprint: record.fingerprint, history: [], replacements: [] };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/evidence/review');
  await page.getByRole('button', { name: 'Review retained-proof.pdf', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Document review history', exact: true });
  await panel
    .getByLabel('Document review reason', { exact: true })
    .fill('Verified the actual retained file; document only.');
  await panel.getByLabel('I reviewed this exact file and hash.', { exact: true }).check();
  await panel.getByRole('button', { name: 'Record document decision', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Document changed');
  expect(posted).toMatchObject({
    expectedFingerprint: record.fingerprint,
    reason: 'Verified the actual retained file; document only.',
    decision: 'approved',
  });
  await panel.getByRole('button', { name: 'Refresh document review', exact: true }).click();
  await expect(panel.getByLabel('Document review reason', { exact: true })).toHaveValue(
    'Verified the actual retained file; document only.',
  );
  await expect(
    panel.getByLabel('I reviewed this exact file and hash.', { exact: true }),
  ).not.toBeChecked();
  await expect(panel).toContainText('does not certify organic status');
});
test('malformed review queue remains explicitly unavailable', async ({ page }) => {
  const user = {
    id: 'reviewer',
    name: 'Reviewer',
    email: 'reviewer@example.test',
    organizationId: 'platform',
    orgType: 'admin',
    permissions: ['*'],
    roles: [],
  };
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === '/api/me'
          ? { ...user, organization_id: 'platform' }
          : path === '/api/onboarding'
            ? { status: 'completed' }
            : {},
    });
  });
  await page.goto('/evidence/review');
  await expect(page.getByRole('alert')).toContainText('Document review queue unavailable');
  await expect(
    page.getByText('No documents match this review status on this page.', { exact: true }),
  ).toHaveCount(0);
});

test('replacement retry links one uploaded record and preserves the retained decision', async ({
  page,
}) => {
  const user = {
    id: 'reviewer',
    name: 'Reviewer',
    email: 'reviewer@example.test',
    organizationId: 'platform',
    orgName: 'Platform',
    orgType: 'admin',
    permissions: ['*'],
    roles: [],
  };
  await page.addInitScript((value) => localStorage.setItem('ct_user', JSON.stringify(value)), user);
  let uploads = 0,
    links = 0;
  const old = { ...record, uploader_organization_id: 'platform', review_status: 'rejected' };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/me')
      body = { ...user, organization_id: 'platform', org_name: 'Platform', org_type: 'admin' };
    if (path === '/api/onboarding') body = { status: 'completed' };
    if (path === '/api/evidence/review/page')
      body = { items: [old], nextCursor: null, hasMore: false };
    if (path === '/api/evidence/proof/review')
      body = {
        evidence: old,
        fingerprint: old.fingerprint,
        replacements: [],
        history: [
          {
            id: 'decision',
            decision: 'rejected',
            reason: 'A signed replacement is needed.',
            source_hash: old.sha256_hash,
            actor_user_id: 'reviewer',
            actor_organization_id: 'platform',
            created_at: '2026-10-17',
          },
        ],
      };
    if (path === '/api/evidence/upload-intents')
      body = { uploadUrl: '/evidence/upload-content/test' };
    if (path === '/api/evidence/upload-content/test') {
      uploads++;
      body = { id: 'replacement' };
    }
    if (path === '/api/evidence/proof/replacement') {
      links++;
      expect(route.request().postDataJSON()).toMatchObject({
        replacementEvidenceId: 'replacement',
        expectedFingerprint: old.fingerprint,
      });
      if (links === 1) {
        await route.fulfill({ status: 409, json: { error: 'Refresh review before linking.' } });
        return;
      }
      body = { changed: true };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/evidence/review');
  await page.getByRole('button', { name: 'Review retained-proof.pdf', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Document review history', exact: true });
  await panel.getByLabel('Replacement file', { exact: true }).setInputFiles({
    name: 'replacement.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 replacement fixture'),
  });
  await panel
    .getByLabel('Replacement claim explanation', { exact: true })
    .fill('Corrected signed document.');
  await panel.getByRole('button', { name: 'Upload and link replacement', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Refresh review');
  await panel.getByRole('button', { name: 'Refresh document review', exact: true }).click();
  await expect(panel.getByLabel('Replacement claim explanation', { exact: true })).toHaveValue(
    'Corrected signed document.',
  );
  await panel.getByRole('button', { name: 'Upload and link replacement', exact: true }).click();
  await expect(
    panel.getByText(
      'Replacement linked as a separate pending record. The original file and review remain retained.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(uploads).toBe(1);
  expect(links).toBe(2);
  await expect(panel.getByText('A signed replacement is needed.', { exact: true })).toBeVisible();
});
