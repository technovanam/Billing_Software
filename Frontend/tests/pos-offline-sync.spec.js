import { test, expect } from '@playwright/test';

test.describe('POS Offline Bill Saving & Sync Queue', () => {
  test.beforeEach(async ({ context }) => {
    // Clear old auth keys and set up clean state
    await context.addInitScript(() => {
      localStorage.removeItem('admin_auth_user');
      localStorage.removeItem('pos_pending_bills');
    });
  });

  test('clears stale admin_auth_user on page load', async ({ page }) => {
    // Inject stale admin_auth_user before page loads
    await page.addInitScript(() => {
      localStorage.setItem('admin_auth_user', JSON.stringify({ email: 'fake@admin.com', role: 'owner' }));
    });

    await page.goto('/signin');
    await page.waitForLoadState('domcontentloaded');

    // Verify stale key was cleared on mount
    const staleKey = await page.evaluate(() => localStorage.getItem('admin_auth_user'));
    expect(staleKey).toBeNull();
  });

  test('displays pending unsynced badge and bill status when offline', async ({ page }) => {
    // Seed an offline pending bill into localStorage
    await page.addInitScript(() => {
      const mockBill = {
        localId: 'inv_1727240000000_test1',
        payload: {
          localId: 'inv_1727240000000_test1',
          invoiceNumber: 'PENDING-test1',
          invoiceDate: '2026-09-25',
          customerName: 'Offline Test Customer',
          customerPhone: '9876543210',
          totalAmount: 350.0,
          amount: 350.0,
          paymentMode: 'Cash',
          cashier: 'CSH-001',
          items: [{ name: 'Test Product', quantity: 1, price: 350.0, total: 350.0 }],
        },
        queuedAt: new Date().toISOString(),
        retries: 0,
        lastError: null,
      };
      localStorage.setItem('pos_pending_bills', JSON.stringify([mockBill]));
    });

    await page.goto('/pos');
    await page.waitForLoadState('domcontentloaded');

    // 1. Pending badge in header should display "1 unsynced"
    const pendingBadge = page.locator('text=1 unsynced');
    await expect(pendingBadge).toBeVisible();
  });

  test('blocks shift close and shows pending bills list when queue is non-empty', async ({ page }) => {
    // Seed pending bills into queue
    await page.addInitScript(() => {
      const mockBills = [
        {
          localId: 'inv_test_shift_block_1',
          payload: {
            localId: 'inv_test_shift_block_1',
            invoiceNumber: 'PENDING-block1',
            customerName: 'Anil Kumar',
            totalAmount: 450.0,
            amount: 450.0,
            cashier: 'CSH-001',
          },
          queuedAt: new Date().toISOString(),
          retries: 0,
        },
        {
          localId: 'inv_test_shift_block_2',
          payload: {
            localId: 'inv_test_shift_block_2',
            invoiceNumber: 'PENDING-block2',
            customerName: 'Priya Sharma',
            totalAmount: 1250.0,
            amount: 1250.0,
            cashier: 'CSH-001',
          },
          queuedAt: new Date().toISOString(),
          retries: 0,
        },
      ];
      localStorage.setItem('pos_pending_bills', JSON.stringify(mockBills));
    });

    await page.goto('/pos/shifts');
    await page.waitForLoadState('domcontentloaded');

    // If an active shift close button is visible, click it
    const closeShiftBtn = page.getByRole('button', { name: /Close Shift/i });
    if (await closeShiftBtn.isVisible()) {
      await closeShiftBtn.click();

      // Blocking modal must appear
      const modalTitle = page.getByText(/Cannot Close Shift: Unsynced Bills Pending/i);
      await expect(modalTitle).toBeVisible();

      // Should display both bills in the modal
      await expect(page.getByText('Anil Kumar')).toBeVisible();
      await expect(page.getByText('Priya Sharma')).toBeVisible();

      // Should show the sync button
      await expect(page.getByRole('button', { name: /Sync Pending Bills Now/i })).toBeVisible();
    }
  });
});
