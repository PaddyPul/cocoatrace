import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { baseURL } from './support/environment';
import { createWorkspace } from './support/identity';
import { emptyPdfFixture } from './support/pdfFixture';
import { tradeSnapshot } from './support/tradeDatabase';

const inspection = (page: Page) =>
  page.getByRole('region', { name: 'Delivery acceptance', exact: true });
async function post(page: Page, path: string, data: object, status = 200) {
  const response = await page.request.post(`/api${path}`, { data });
  expect(response.status(), `${path}: ${JSON.stringify(await response.json())}`).toBe(status);
  return response;
}

// Real identities, application API setup and real browser decisions; no intercepted
// requests or database writes. This adds damaged full-quantity goods and deferred
// payment to the shortage/prepayment recovery already covered by tradeJourney.
test('damaged delivery stays committed through supplier resolution and buyer approval until inspected acceptance and verified final payment', async ({
  page: supplier,
  browser,
}) => {
  test.setTimeout(240_000);
  const seller = await createWorkspace(supplier, browser, 'supplier');
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  try {
    const buyer = await context.newPage();
    await createWorkspace(buyer, browser, 'buyer');
    const inventory = await (
      await post(
        supplier,
        '/inventory/direct',
        {
          commodity: 'peanut',
          quantityKg: 4,
          inventoryDate: new Date().toISOString().slice(0, 10),
          sourceCountry: 'GH',
          sourceName: seller.organization,
        },
        201,
      )
    ).json();
    const listing = await (
      await post(
        supplier,
        '/listings',
        {
          holdingId: inventory.holding_id,
          availableQuantityKg: 4,
          pricePerKg: 5,
          currency: 'EUR',
          incoterm: 'FOB',
          originLocation: 'Tema',
          destinationLocation: 'Rotterdam',
        },
        201,
      )
    ).json();
    const offer = await (
      await post(
        buyer,
        `/listings/${listing.id}/offers`,
        { quantityKg: 4, offeredPricePerKg: 5, currency: 'EUR' },
        201,
      )
    ).json();
    const { contract, shipment } = await (
      await post(supplier, `/offers/${offer.id}/accept`, {})
    ).json();
    const terms = await supplier.request.patch(`/api/contracts/${contract.id}/payment-terms`, {
      data: {
        paymentPlan: 'pay_after_delivery',
        depositPercentage: 20,
        creditDays: 0,
        paymentEvidenceRequired: false,
      },
    });
    expect(terms.status(), JSON.stringify(await terms.json())).toBe(200);
    await post(buyer, `/contracts/${contract.id}/payment-terms/confirm`, {});
    await post(supplier, `/shipments/${shipment.id}/milestones`, { milestone: 'loaded' });
    await post(buyer, `/shipments/${shipment.id}/milestones`, { milestone: 'delivered' });
    const held = async () => {
      const snapshot = await tradeSnapshot(contract.id);
      expect(snapshot.contract.status).toBe('delivered');
      expect(snapshot.transfers).toHaveLength(0);
      expect(snapshot.holdings.find((row) => row.id === contract.holding_id)?.status).toBe(
        'committed',
      );
      return snapshot;
    };
    await held();
    await buyer.goto(`/deal-room/${contract.id}`);
    const buyerInspection = inspection(buyer);
    await buyerInspection.getByLabel('Discrepancy type', { exact: true }).selectOption('damage');
    await buyerInspection.getByLabel('Actual received quantity (kg)', { exact: true }).fill('4');
    await buyerInspection
      .getByLabel('Explain the discrepancy', { exact: true })
      .fill('All four kilograms arrived but packaging and goods were damaged');
    await buyerInspection
      .getByLabel('Delivery evidence (PDF, JPEG or PNG)', { exact: true })
      .setInputFiles({
        name: 'damaged-delivery.pdf',
        mimeType: 'application/pdf',
        buffer: emptyPdfFixture(),
      });
    await expect(
      buyerInspection.getByText('Delivery evidence attached.', { exact: true }),
    ).toBeVisible();
    await buyerInspection
      .getByRole('button', { name: 'Report delivery discrepancy', exact: true })
      .click();
    await expect(
      buyerInspection.getByText('Delivery discrepancy hold', { exact: true }),
    ).toBeVisible();
    await expect(
      buyerInspection.getByRole('button', { name: 'Accept full delivery', exact: true }),
    ).toHaveCount(0);
    await expect(
      buyerInspection.getByRole('button', { name: 'Propose delivery resolution', exact: true }),
    ).toHaveCount(0);
    await buyer.reload();
    await expect(
      inspection(buyer).getByText(
        'All four kilograms arrived but packaging and goods were damaged',
        { exact: true },
      ),
    ).toBeVisible();
    await held();

    await supplier.goto(`/deal-room/${contract.id}`);
    const supplierInspection = inspection(supplier);
    await expect(
      supplierInspection.getByRole('button', { name: 'Approve delivery resolution', exact: true }),
    ).toHaveCount(0);
    await expect(
      supplierInspection.getByRole('button', { name: 'Accept full delivery', exact: true }),
    ).toHaveCount(0);
    await supplierInspection
      .getByLabel('Supplier resolution explanation', { exact: true })
      .fill(
        'Damaged goods replaced externally; buyer must inspect the replacement before accepting',
      );
    await supplierInspection
      .getByRole('button', { name: 'Propose delivery resolution', exact: true })
      .click();
    await expect(
      supplierInspection.getByText('Resolution proposed; awaiting buyer approval.', {
        exact: true,
      }),
    ).toBeVisible();
    await held();
    await buyer.reload();
    await inspection(buyer)
      .getByRole('button', { name: 'Approve delivery resolution', exact: true })
      .click();
    await expect(
      inspection(buyer).getByText('Delivery discrepancy resolved', { exact: true }),
    ).toBeVisible();
    await held();
    await buyer.reload();
    await expect(
      inspection(buyer).getByText('Delivery discrepancy resolved', { exact: true }),
    ).toBeVisible();
    await inspection(buyer)
      .getByLabel('Inspected quantity received (kg)', { exact: true })
      .fill('4');
    // A matching quantity and checkbox alone must explain the missing note.
    await inspection(buyer)
      .getByLabel('I inspected the full contract quantity and accept its condition.', {
        exact: true,
      })
      .check();
    await expect(
      inspection(buyer).getByRole('button', { name: 'Accept full delivery', exact: true }),
    ).toBeDisabled();
    await expect(
      inspection(buyer)
        .getByRole('form', { name: 'Accept inspected delivery', exact: true })
        .getByRole('status'),
    ).toContainText('Add an inspection note of at least 10 characters');
    await inspection(buyer).getByLabel('Inspection note', { exact: true }).fill('  checked  ');
    await expect(
      inspection(buyer).getByRole('button', { name: 'Accept full delivery', exact: true }),
    ).toBeDisabled();
    await inspection(buyer)
      .getByLabel('Inspection note', { exact: true })
      .fill('Replacement goods inspected and full quantity accepted in good condition');
    await expect(
      inspection(buyer).getByRole('button', { name: 'Accept full delivery', exact: true }),
    ).toBeEnabled();
    await inspection(buyer)
      .getByLabel('I inspected the full contract quantity and accept its condition.', {
        exact: true,
      })
      .check();
    await inspection(buyer)
      .getByRole('button', { name: 'Accept full delivery', exact: true })
      .click();
    await expect(
      inspection(buyer).getByText('Buyer accepted delivery', { exact: true }),
    ).toBeVisible();
    await held();
    await buyer
      .getByPlaceholder('Bank transaction reference')
      .fill('BROWSER-DAMAGE-RECOVERY-20-EUR');
    await buyer.getByRole('button', { name: 'Submit payment', exact: true }).click();
    await expect(buyer.getByRole('button', { name: 'Submit payment', exact: true })).toHaveCount(0);
    await held();
    await supplier.reload();
    await supplier.getByRole('button', { name: 'Confirm funds received', exact: true }).click();
    await expect(supplier.getByText('Trade completed', { exact: true })).toBeVisible();
    const complete = await tradeSnapshot(contract.id);
    expect(complete.contract.status).toBe('settled');
    expect(complete.transfers).toHaveLength(1);
    expect(complete.fees).toHaveLength(1);
    expect(Number(complete.payment.amount_confirmed)).toBe(20);
    await buyer.reload();
    await expect(buyer.getByText('Trade completed', { exact: true })).toBeVisible();
    await expect(
      inspection(buyer).getByRole('button', { name: 'Accept full delivery', exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
