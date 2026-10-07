// Smoke check: every public page loads without uncaught errors or console
// errors, and every app page redirects a signed-out visitor to sign in.
import { test, expect } from '@playwright/test';

const PUBLIC = ['/', '/features', '/solutions', '/integrations', '/pricing', '/signin', '/signup', '/payment/success', '/pay/invoice/latest'];
const APP = ['/dashboard', '/invoices', '/invoices/create', '/clients', '/products', '/payments', '/expenses', '/challans', '/recurring-invoices', '/credit-notes', '/purchases', '/debit-notes', '/suppliers', '/accounts', '/gst-returns', '/payroll', '/reports', '/settings', '/quotations', '/sales-orders', '/purchase-orders', '/advance-receipts', '/cheques', '/price-lists', '/manufacturing'];
// Network noise from third parties (fonts, analytics, Firebase long-polling) isn't an app error.
const IGNORE = /favicon|ERR_BLOCKED_BY_CLIENT|net::ERR_|Failed to load resource|firestore\.googleapis|identitytoolkit|DevTools|Download the React DevTools/i;

for (const path of PUBLIC) {
    test(`public page ${path} loads cleanly`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(`console: ${m.text()}`));
        await page.goto(path, { waitUntil: 'networkidle' }).catch(() => page.goto(path, { waitUntil: 'load' }));
        await page.waitForTimeout(800);
        await expect(page.locator('body')).not.toBeEmpty();
        await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
        expect(errors, errors.join('\n')).toEqual([]);
    });
}

for (const path of APP) {
    test(`app page ${path} asks a signed-out visitor to sign in`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(/\/signin/, { timeout: 30000 });
        expect(errors, errors.join('\n')).toEqual([]);
    });
}
