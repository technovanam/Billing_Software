/* global process, Buffer */
// End-to-end checks for the Tally-parity flows: orders → invoice, price lists,
// advance receipts (GST on advances), cheques / PDCs, year end, team access,
// and Tally / Excel import + backup.
//
// Signed-in tests use a test owner account: set
// E2E_OWNER_PASSWORD (and optionally E2E_OWNER_EMAIL); they are skipped without
// it. Every record a test creates is deleted again at the end of that test, and
// imports stop at the preview step, so the demo books are left as they were.
// Run: npx playwright test tests/books-flows.spec.js --project=chromium
import { test, expect } from '@playwright/test';

const OWNER = {
    email: process.env.E2E_OWNER_EMAIL || 'owner.demo@technovanam.in',
    password: process.env.E2E_OWNER_PASSWORD,
};
const RUN = Date.now().toString().slice(-6);

async function signIn(page) {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email Address/i).fill(OWNER.email);
    await page.getByLabel(/^Password$/i).fill(OWNER.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

// Pick the first real option of a <select> (index 0 is the "Select…" prompt).
async function pickFirst(select) {
    await expect(select.locator('option').nth(1)).toBeAttached({ timeout: 15000 });
    const value = await select.locator('option').nth(1).getAttribute('value');
    await select.selectOption(value || { index: 1 });
}

// Accept window.confirm dialogs raised by delete buttons.
function acceptDialogs(page) {
    page.on('dialog', (d) => d.accept());
}

test.describe('new pages need a signed-in user', () => {
    for (const path of ['/quotations', '/sales-orders', '/purchase-orders', '/advance-receipts', '/cheques', '/price-lists', '/manufacturing', '/accounts']) {
        test(`${path} redirects to sign in`, async ({ page }) => {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            await page.waitForURL(/\/(signin|login)/, { timeout: 30000 });
            await expect(page).toHaveURL(/\/signin/);
        });
    }
});

test.describe('books flows (signed in)', () => {
    test.skip(!OWNER.password, 'Set E2E_OWNER_PASSWORD to run signed-in flows');
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        acceptDialogs(page);
        await signIn(page);
    });

    test('quotation converts into a pre-filled invoice', async ({ page }) => {
        await page.goto('/quotations');
        await page.getByRole('button', { name: /New Quotation/i }).click();
        await pickFirst(page.getByLabel(/^Customer \*/));
        await page.getByRole('button', { name: /Add Item/i }).click();
        const row = page.locator('tbody tr').first();
        await row.getByPlaceholder(/Item description/i).fill(`E2E widget ${RUN}`);
        await row.locator('input[type="number"]').nth(0).fill('2');
        await row.locator('input[type="number"]').nth(1).fill('100');
        await page.getByRole('button', { name: /Save Quotation/i }).click();

        const listed = page.locator('tr', { hasText: 'QT-' }).filter({ has: page.getByRole('button', { name: /Invoice/ }) }).first();
        await expect(listed).toBeVisible();
        const number = (await listed.locator('td').first().innerText()).trim();
        await expect(listed.getByText('Open')).toBeVisible();

        await listed.getByRole('button', { name: /Invoice/ }).click();
        await page.waitForURL(/\/invoices\/create/);
        await expect(page.locator(`input[value="E2E widget ${RUN}"]`)).toBeVisible();

        // Clean up: the quotation (the invoice was never saved).
        await page.goto('/quotations');
        const again = page.locator('tr', { hasText: number });
        await again.getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('tr', { hasText: number })).toHaveCount(0);
    });

    test('price list: special rate and discount', async ({ page }) => {
        await page.goto('/price-lists');
        const name = `E2E List ${RUN}`;
        await page.getByPlaceholder(/New list/i).fill(name);
        await page.getByRole('button', { name: /Add price list/i }).click();
        await expect(page.getByRole('heading', { name })).toBeVisible();
        await page.getByLabel(/Discount on standard price/i).fill('10');
        await page.getByRole('button', { name: /^Save$/ }).click();
        await expect(page.getByText(`${name} saved.`)).toBeVisible();
        await page.getByRole('button', { name: /Delete price list/i }).click();
        await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
    });

    test('advance receipt splits GST and can be deleted while open', async ({ page }) => {
        await page.goto('/advance-receipts');
        await page.getByRole('button', { name: /New receipt voucher/i }).click();
        await pickFirst(page.getByLabel(/^Customer \*/));
        await page.getByLabel(/Amount received/i).fill('11800');
        await page.getByLabel(/GST rate of the supply/i).selectOption('18');
        await expect(page.getByText('Value of advance')).toBeVisible();
        await expect(page.getByText('₹10,000.00')).toBeVisible();
        await page.getByRole('button', { name: /Save receipt voucher/i }).click();

        const row = page.locator('tr', { hasText: '11,800.00' }).filter({ hasText: 'Open' }).first();
        await expect(row).toBeVisible();
        await expect(row).toContainText('1,800.00');
        await row.getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByText(/deleted/i)).toBeVisible();
    });

    test('post-dated cheque is tracked and prints on a CTS leaf', async ({ page, context }) => {
        await page.goto('/cheques');
        await page.getByRole('button', { name: /^Issued$/ }).click();
        await page.getByRole('button', { name: /Cheque issued/i }).click();
        const chequeNo = RUN;
        await page.getByLabel(/Cheque no/i).fill(chequeNo);
        const future = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
        await page.getByLabel(/Cheque date/i).fill(future);
        await expect(page.getByText(/Post-dated — recorded in the books only when it clears/)).toBeVisible();
        await pickFirst(page.getByLabel(/^Supplier \*/));
        await page.getByLabel(/Amount/i).first().fill('2500');
        await page.getByRole('button', { name: /Save cheque/i }).click();

        const row = page.locator('tr', { hasText: chequeNo });
        await expect(row.getByText('Post-dated')).toBeVisible();
        // Post-dated: can't be cleared yet.
        await expect(row.getByRole('button', { name: /Cleared/ })).toHaveCount(0);

        const popupPromise = context.waitForEvent('page');
        await row.getByRole('button', { name: /Print cheque/i }).click();
        const popup = await popupPromise;
        await popup.waitForLoadState('domcontentloaded');
        await expect(popup.locator('body')).toContainText('Two Thousand Five Hundred Rupees Only');
        await popup.close();

        await row.getByRole('button', { name: /Delete cheque/i }).click();
        await expect(page.locator('tr', { hasText: chequeNo })).toHaveCount(0);
    });

    test('year end shows carry-forward balances', async ({ page }) => {
        await page.goto('/accounts');
        await page.getByRole('button', { name: 'Year End', exact: true }).click();
        await expect(page.getByText(/Opening Dr \(next year\)/)).toBeVisible();
        await expect(page.getByText(/Closing stock → next year/)).toBeVisible();
        await expect(page.getByRole('button', { name: /Close year|Reopen year/ })).toBeVisible();
    });

    test('GSTR-1 summary lists advances (11A / 11B)', async ({ page }) => {
        await page.goto('/gst-returns');
        await expect(page.getByText('11A · Advances received')).toBeVisible();
        await expect(page.getByText('11B · Advances adjusted')).toBeVisible();
    });

    test('Tally masters import previews without writing', async ({ page }) => {
        await page.goto('/settings');
        await page.getByRole('button', { name: 'Data', exact: true }).click();
        const xml = `<ENVELOPE><TALLYMESSAGE><LEDGER NAME="E2E Tally Party ${RUN}"><PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>-500</OPENINGBALANCE></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE><STOCKITEM NAME="E2E Tally Item ${RUN}"><BASEUNITS>Nos</BASEUNITS></STOCKITEM></TALLYMESSAGE></ENVELOPE>`;
        await page.locator('input[type="file"][accept=".xml,.txt"]').setInputFiles({ name: 'masters.xml', mimeType: 'text/xml', buffer: Buffer.from(xml) });
        const preview = page.locator('section', { hasText: 'Ready to import' });
        await expect(preview).toBeVisible();
        await expect(preview.locator('tr', { hasText: 'Customers' })).toContainText('1');
        await expect(preview.locator('tr', { hasText: 'Products' })).toContainText('1');
        await preview.getByRole('button', { name: 'Cancel' }).click();
        await expect(preview).toHaveCount(0);
    });

    test('Excel template downloads', async ({ page }) => {
        await page.goto('/settings');
        await page.getByRole('button', { name: 'Data', exact: true }).click();
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: /Template/i }).click();
        expect((await download).suggestedFilename()).toBe('kanakku-customers-template.xlsx');
    });

    test('team access validates the email before saving', async ({ page }) => {
        await page.goto('/settings');
        await page.getByRole('button', { name: 'Team', exact: true }).click();
        await page.getByLabel(/^Email$/).fill('not-an-email');
        await page.getByRole('button', { name: /Add member/i }).click();
        await expect(page.getByText(/Enter a valid email address/i)).toBeVisible();
    });

    test('manufacturing and batch reports render', async ({ page }) => {
        await page.goto('/manufacturing');
        await expect(page.getByRole('heading', { name: /Bill of materials/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Record production/i })).toBeVisible();
        await page.goto('/accounts');
        await page.getByRole('button', { name: 'Batches & Expiry', exact: true }).click();
        await expect(page.getByText(/Batch-wise stock as on/)).toBeVisible();
    });
});
