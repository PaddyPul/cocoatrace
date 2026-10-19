import { test, expect } from './support/fixtures';
import { createWorkspace, platformReviewerContext } from './support/identity';
import type { Page } from '@playwright/test';
import { emptyPdfFixture } from './support/pdfFixture';

async function openProof(page: Page) {
  const button = page.getByRole('button', {
    name: 'Review document-review-journey.pdf',
    exact: true,
  });
  for (let index = 0; index < 100; index++) {
    await expect(
      page.getByRole('region', { name: 'Document review queue', exact: true }).getByRole('table'),
    ).toBeVisible();
    if (await button.count()) {
      await button.click();
      return;
    }
    const next = page.getByRole('button', { name: 'Next review queue', exact: true });
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  await expect(button).toBeVisible();
}

test('retained supplier document receives a real rejected review with a visible reason after reload', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await createWorkspace(page, browser, 'supplier');
  const created = await page.request.post('/api/inventory/direct', {
    data: {
      commodity: 'peanut',
      quantityKg: 10,
      inventoryDate: new Date().toISOString().slice(0, 10),
      sourceCountry: 'GH',
      sourceName: 'Review journey inventory',
    },
  });
  expect(created.status()).toBe(201);
  const batch = await created.json();
  await page.goto(`/evidence/contribute?entityType=batch&entityId=${batch.id}`);
  await page.getByLabel('Document purpose', { exact: true }).selectOption('weighing_ticket');
  await page
    .getByLabel('Evidence explanation', { exact: true })
    .fill('Measured physical inventory document awaiting review.');
  await page.getByLabel('Evidence file', { exact: true }).setInputFiles({
    name: 'document-review-journey.pdf',
    mimeType: 'application/pdf',
    buffer: emptyPdfFixture(),
  });
  await page.getByRole('button', { name: 'Attach evidence', exact: true }).click();
  await expect(page.getByText(/Evidence attached to/)).toBeVisible();
  const list = await page.request.get(`/api/evidence?entityType=batch&entityId=${batch.id}`);
  expect(list.status()).toBe(200);
  const rows = await list.json();
  const proof = rows.find(
    (row: { file_name: string }) => row.file_name === 'document-review-journey.pdf',
  );
  expect(proof).toBeTruthy();
  const context = await platformReviewerContext(browser);
  try {
    const reviewer = await context.newPage();
    await reviewer.goto(`/evidence/review?id=${proof.id}`);
    await openProof(reviewer);
    const panel = reviewer.getByRole('region', { name: 'Document review history', exact: true });
    await panel
      .getByRole('combobox', { name: 'Document decision', exact: true })
      .selectOption('rejected');
    await panel
      .getByLabel('Document review reason', { exact: true })
      .fill('Please provide the signed weighing record.');
    await panel.getByLabel('I reviewed this exact file and hash.', { exact: true }).check();
    const savedDecision = reviewer.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/evidence/${proof.id}/review` &&
      response.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: 'Record document decision', exact: true }).click();
    const decisionResponse = await savedDecision;
    expect(decisionResponse.status(), await decisionResponse.text()).toBe(200);
    await expect(
      panel.getByText('Please provide the signed weighing record.', { exact: true }),
    ).toBeVisible();
    const ownerHistory = await page.request.get(`/api/evidence/${proof.id}/review`);
    expect(ownerHistory.status()).toBe(200);
    expect((await ownerHistory.json()).history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: 'rejected',
          reason: 'Please provide the signed weighing record.',
        }),
      ]),
    );
    await reviewer.reload();
    await reviewer.getByLabel('Review status filter', { exact: true }).selectOption('rejected');
    await openProof(reviewer);
    await expect(
      reviewer.getByRole('region', { name: 'Document review history', exact: true }),
    ).toContainText('Please provide the signed weighing record.');
  } finally {
    await context.close();
  }
});
