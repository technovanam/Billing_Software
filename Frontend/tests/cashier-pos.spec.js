/* global process */
// Cashier logins end to end, against a real backend and Firebase project
// (custom tokens can't be mocked). Needs:
//   - the backend from this branch on :5000 and the Vite dev server on :5173
//   - Firestore rules deployed, and cashier PINs migrated/seeded (hashed)
//   - E2E_OWNER_PASSWORD (demo owner), E2E_CASHIER_PIN; optional
//     E2E_OWNER_EMAIL, E2E_CASHIER_ID (default CSH-001)
// Skipped when the passwords are not set.
import { test, expect } from '@playwright/test';

const OWNER = {
    email: process.env.E2E_OWNER_EMAIL || 'owner.demo@technovanam.in',
    password: process.env.E2E_OWNER_PASSWORD,
};
const CASHIER = { id: process.env.E2E_CASHIER_ID || 'CSH-001', pin: process.env.E2E_CASHIER_PIN };
const PRODUCT = 'E2E Test Soap';

test.describe.configure({ mode: 'serial' });
test.skip(!OWNER.password || !CASHIER.pin, 'Set E2E_OWNER_PASSWORD and E2E_CASHIER_PIN to run the cashier login tests.');

let posDevice = null; // this test run's registered device (as stored in localStorage)

async function signInOwner(page) {
    await page.goto('/signin');
    await page.getByLabel(/Email Address or Cashier ID/i).fill(OWNER.email);
    await page.getByLabel(/Password or 4-digit PIN/i).fill(OWNER.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

// A fresh browser that only knows this device's registration (no other cache).
async function cashierContext(browser) {
    const context = await browser.newContext();
    await context.addInitScript((device) => localStorage.setItem('pos_device', device), posDevice);
    return context;
}

async function cashierLogin(page, pin = CASHIER.pin) {
    await page.goto('/pos/login');
    await page.getByLabel('Cashier ID').fill(CASHIER.id);
    await page.getByLabel('4-Digit PIN').fill(pin);
    await page.getByRole('button', { name: /Start billing/i }).click();
}

test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInOwner(page);

    // Register this browser as a POS device (owner-only).
    await page.goto('/cashiers');
    const panel = page.getByTestId('pos-devices-panel');
    await expect(panel).toBeVisible();
    if (await page.getByTestId('register-device').isVisible()) {
        await page.getByTestId('register-device').click();
        await page.getByTestId('device-name').fill(`E2E device ${Date.now()}`);
        await page.getByTestId('device-save').click();
        await expect(panel.getByText('This device is registered')).toBeVisible();
    }
    posDevice = await page.evaluate(() => localStorage.getItem('pos_device'));
    expect(posDevice).toBeTruthy();

    // Make sure there is a product to bill.
    await page.goto('/products');
    await page.getByLabel('Search products').fill(PRODUCT);
    if (!(await page.getByTestId('product-row').filter({ hasText: PRODUCT }).count())) {
        await page.getByRole('button', { name: /Add Product/i }).first().click();
        await page.locator('#productName').fill(PRODUCT);
        await page.locator('#hsnCode').fill('3401');
        await page.locator('#price').fill('25');
        await page.getByRole('button', { name: /^Add Product$/ }).last().click();
    }
    await context.close();
});

test('cashier signs in with ID and PIN; a wrong PIN is refused', async ({ browser }) => {
    const context = await cashierContext(browser);
    const page = await context.newPage();

    await cashierLogin(page, CASHIER.pin === '0000' ? '1111' : '0000');
    await expect(page.getByTestId('pos-login-error')).toContainText(/Wrong cashier ID or PIN/);
    await expect(page).toHaveURL(/\/pos\/login/);

    await cashierLogin(page); // the correct PIN resets the failure count
    await page.waitForURL(/\/pos\/billing/, { timeout: 30000 });
    await context.close();
});

test('cashier bills at the POS and the bill is saved in Firestore', async ({ browser }) => {
    const customer = `E2E Walk-in ${Date.now()}`;
    let context = await cashierContext(browser);
    let page = await context.newPage();
    await cashierLogin(page);
    await page.waitForURL(/\/pos\/billing/, { timeout: 30000 });

    await page.getByPlaceholder(/Scan product barcode or search/).fill(PRODUCT);
    await page.getByText(PRODUCT, { exact: true }).first().click();
    await page.getByPlaceholder('Search existing customer by name...').fill(customer);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: /Save Bill/ }).click();
    await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible();
    await context.close();

    // The POS reports "saved" even when a write fails (offline fallback), so
    // check from a fresh browser with no cache: the bill must come from Firestore.
    context = await cashierContext(browser);
    page = await context.newPage();
    await cashierLogin(page);
    await page.waitForURL(/\/pos\/billing/, { timeout: 30000 });
    await page.goto('/pos/customers');
    await expect(page.getByText(customer).first()).toBeVisible({ timeout: 20000 });
    await context.close();
});

test('a cashier is kept out of admin and warehouse pages', async ({ browser }) => {
    const context = await cashierContext(browser);
    const page = await context.newPage();
    await cashierLogin(page);
    await page.waitForURL(/\/pos\/billing/, { timeout: 30000 });

    for (const path of ['/dashboard', '/reports', '/expenses', '/cashiers', '/products', '/warehouse']) {
        await page.goto(path);
        await expect(page, `${path} should redirect to POS`).toHaveURL(/\/pos\/billing/);
    }
    // No owner data on the POS screens either: the AI assistant widget isn't loaded.
    await expect(page.getByText(/AI Assistant/i)).toHaveCount(0);
    await context.close();
});
