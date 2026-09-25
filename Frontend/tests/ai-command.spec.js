/* global process */
// AI command bar: command -> draft -> confirm, on the invoice form and the POS.
// The backend /api/ai/* endpoints are mocked, so no AI key or model call is needed.
// Signs in with the demo owner (Backend/DEMO_LOGINS.md): set E2E_OWNER_PASSWORD
// (and optionally E2E_OWNER_EMAIL); skipped without it. Needs the Vite dev server on :5173.
import { test, expect } from '@playwright/test';

const OWNER = {
    email: process.env.E2E_OWNER_EMAIL || 'owner.demo@technovanam.in',
    password: process.env.E2E_OWNER_PASSWORD,
};

const cement = { id: 'p_cement', name: 'Cement', brand: 'UltraTech', unit: 'bag', unitLabel: 'Bag', hsn: '2523', pricePaise: 42000 };
const nails2 = { id: 'p_nails2', name: 'Nails 2 inch', brand: 'Tata', unit: 'kg', unitLabel: 'Kg', hsn: '7317', pricePaise: 11050 };
const nails3 = { id: 'p_nails3', name: 'Nails 3 inch', brand: 'Tata', unit: 'kg', unitLabel: 'Kg', hsn: '7317', pricePaise: 12000 };

const invoiceDraft = {
    logId: 'log_1',
    intent: 'create_invoice',
    clarification: null,
    messages: [],
    draft: {
        customer: { spokenName: 'Ravi Traders', status: 'matched', id: 'c_ravi', name: 'Ravi Traders', candidates: [] },
        items: [
            { key: 'k1', spokenName: 'cement', spokenUnit: 'bag', qty: 10, status: 'matched', source: 'exact', product: cement, candidates: [{ ...cement, score: 1 }], lineTotalPaise: 420000 },
            { key: 'k2', spokenName: 'nails', spokenUnit: 'kg', qty: 5, status: 'ambiguous', source: 'fuzzy', product: null, candidates: [{ ...nails2, score: 0.9 }, { ...nails3, score: 0.88 }], lineTotalPaise: null },
            { key: 'k3', spokenName: 'saffron', spokenUnit: 'kg', qty: 1, status: 'unmatched', source: 'none', product: null, candidates: [], lineTotalPaise: null },
        ],
        dueInDays: 15,
        payment: null,
        notes: null,
    },
};

// The listener attaches right after the button renders; retry the key until the bar opens.
async function openWithShortcut(page, key) {
    await expect(page.getByTestId('ai-command-open')).toBeVisible();
    await expect(async () => {
        if (!(await page.getByTestId('ai-command-bar').isVisible())) await page.keyboard.press(key);
        await expect(page.getByTestId('ai-command-bar')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
}

async function signIn(page) {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email Address or Cashier ID/i).fill(OWNER.email);
    await page.getByLabel(/Password or 4-digit PIN/i).fill(OWNER.password);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

// Records every AI request so tests can assert what the frontend sent.
async function mockAiBackend(page, parseReplies) {
    const calls = { parse: [], aliases: [], logs: [] };
    let i = 0;
    await page.route('**/api/ai/parse-command', async (route) => {
        calls.parse.push(route.request().postDataJSON());
        const reply = parseReplies[Math.min(i, parseReplies.length - 1)];
        i += 1;
        await route.fulfill({ json: reply });
    });
    await page.route('**/api/ai/aliases', async (route) => {
        calls.aliases.push({ method: route.request().method(), body: route.request().postDataJSON() });
        await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/api/ai/logs/update', async (route) => {
        calls.logs.push(route.request().postDataJSON());
        await route.fulfill({ json: { ok: true, updated: 1 } });
    });
    return calls;
}

async function inputValues(page) {
    return page.locator('input').evaluateAll((els) => els.map((el) => el.value));
}

test.describe('AI command bar', () => {
    test.skip(!OWNER.password, 'Set E2E_OWNER_PASSWORD to the demo owner password to run these tests.');

    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('invoice: command -> draft -> resolve -> confirm fills the form', async ({ page }) => {
        const calls = await mockAiBackend(page, [invoiceDraft]);
        await page.goto('/invoices/create');
        await openWithShortcut(page, 'F2');
        await expect(page.getByTestId('ai-command-bar')).toBeVisible();

        await page.getByTestId('ai-command-input').fill('Ravi Traders ku 10 bag cement, 5 kg nails, 1 kg saffron, 15 days credit');
        await page.getByTestId('ai-command-send').click();

        const items = page.getByTestId('ai-draft-item');
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toHaveAttribute('data-status', 'matched');
        await expect(items.nth(1)).toHaveAttribute('data-status', 'ambiguous');
        await expect(items.nth(2)).toHaveAttribute('data-status', 'unmatched');
        await expect(page.getByTestId('ai-confirm')).toBeDisabled();

        // Resolve the ambiguous item; the spoken phrase is saved as an alias.
        await items.nth(1).getByTestId('ai-candidate-select').selectOption('p_nails2');
        await expect(items.nth(1)).toHaveAttribute('data-status', 'matched');
        await expect.poll(() => calls.aliases.length).toBe(1);
        expect(calls.aliases[0].body).toMatchObject({ productId: 'p_nails2', alias: 'nails', source: 'invoice', commandLogId: 'log_1' });

        // Drop the unknown product instead of creating it.
        await items.nth(2).getByRole('button', { name: /Remove saffron/ }).click();
        await expect(items).toHaveCount(2);
        await expect(page.getByTestId('ai-draft-totals')).toContainText('Draft total');

        await page.getByTestId('ai-confirm').click();
        await expect(page.getByTestId('ai-command-bar')).toBeHidden();

        const values = await inputValues(page);
        expect(values).toContain('Cement');
        expect(values).toContain('Nails 2 inch');
        expect(values).toContain('2523');
        expect(values).toContain('420');
        expect(values).toContain('110.5');

        await expect.poll(() => calls.logs.length).toBe(1);
        expect(calls.logs[0]).toMatchObject({ context: 'invoice', logIds: ['log_1'], status: 'confirmed' });
        expect(calls.logs[0].corrections.map((c) => c.type)).toEqual(['pick_product', 'remove_item']);
    });

    test('follow-up commands send the current draft', async ({ page }) => {
        const afterRemove = {
            ...invoiceDraft,
            logId: 'log_2',
            intent: 'remove_item',
            draft: { ...invoiceDraft.draft, items: [invoiceDraft.draft.items[0]] },
        };
        const calls = await mockAiBackend(page, [invoiceDraft, afterRemove]);
        await page.goto('/invoices/create');
        await page.getByTestId('ai-command-open').click();

        await page.getByTestId('ai-command-input').fill('Ravi Traders ku 10 bag cement, 5 kg nails');
        await page.getByTestId('ai-command-send').click();
        await expect(page.getByTestId('ai-draft-item')).toHaveCount(3);

        await page.getByTestId('ai-command-input').fill('remove nails');
        await page.getByTestId('ai-command-send').click();
        await expect(page.getByTestId('ai-draft-item')).toHaveCount(1);

        expect(calls.parse).toHaveLength(2);
        expect(calls.parse[0].currentDraft.items).toHaveLength(0);
        expect(calls.parse[1].currentDraft.items.map((it) => it.key)).toEqual(['k1', 'k2', 'k3']);
        expect(calls.parse[1].sessionId).toBe(calls.parse[0].sessionId);
        expect(calls.parse[1].context).toBe('invoice');
    });

    test('clarification question is shown and nothing is added', async ({ page }) => {
        await mockAiBackend(page, [{ logId: 'log_c', intent: 'create_invoice', clarification: 'How many cement?', messages: [], draft: { customer: null, items: [], dueInDays: null, payment: null, notes: null } }]);
        await page.goto('/invoices/create');
        await openWithShortcut(page, 'F2');
        await page.getByTestId('ai-command-input').fill('Ravi Traders ku cement');
        await page.getByTestId('ai-command-send').click();
        await expect(page.getByTestId('ai-clarification')).toHaveText(/How many cement\?/);
        await expect(page.getByTestId('ai-draft-item')).toHaveCount(0);
    });

    test('POS: Ctrl+K draft -> confirm fills the cart and F9 still prints', async ({ page }) => {
        const posDraft = {
            logId: 'log_pos',
            intent: 'create_pos_bill',
            clarification: null,
            messages: [],
            draft: {
                customer: { spokenName: 'Arun', status: 'new', id: null, name: 'Arun', candidates: [] },
                items: [{ key: 'p1', spokenName: 'cement', spokenUnit: 'bag', qty: 2, status: 'matched', source: 'exact', product: cement, candidates: [], lineTotalPaise: 84000 }],
                dueInDays: null,
                payment: { mode: 'upi', amountPaise: null },
                notes: null,
            },
        };
        const calls = await mockAiBackend(page, [posDraft]);
        await page.goto('/pos/billing');
        await openWithShortcut(page, 'Control+k');
        await expect(page.getByTestId('ai-command-bar')).toBeVisible();

        await page.getByTestId('ai-command-input').fill('Arun ku 2 bag cement, UPI');
        await page.getByTestId('ai-command-send').click();
        await expect(page.getByTestId('ai-draft-customer')).toHaveAttribute('data-status', 'new');
        expect(calls.parse[0].context).toBe('pos');

        await page.getByTestId('ai-confirm').click();
        await expect(page.getByTestId('ai-command-bar')).toBeHidden();
        await expect(page.getByText('Cement', { exact: true }).first()).toBeVisible();
        expect(await inputValues(page)).toContain('Arun');

        await page.keyboard.press('F9');
        await expect(page.getByText('TAX INVOICE').first()).toBeVisible();
    });

    test('offline hides the command bar', async ({ page, context }) => {
        await mockAiBackend(page, [invoiceDraft]);
        await page.goto('/invoices/create');
        await expect(page.getByTestId('ai-command-open')).toBeVisible();
        await context.setOffline(true);
        await expect(page.getByTestId('ai-command-open')).toBeHidden();
        await page.keyboard.press('F2');
        await expect(page.getByTestId('ai-command-bar')).toBeHidden();
        await context.setOffline(false);
        await expect(page.getByTestId('ai-command-open')).toBeVisible();
    });
});
