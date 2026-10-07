import test from 'node:test';
import assert from 'node:assert/strict';

// Set up localStorage mock in node environment
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

// Import queue functions
const { enqueueBill, getPendingBills, dequeueBill } = await import('./posBillQueue.js');

test.describe('posBillQueue Unit Tests', () => {
  test.beforeEach(() => {
    localStorage.clear();
  });

  test('getPendingBills returns empty array initially', () => {
    const bills = getPendingBills();
    assert.deepEqual(bills, []);
  });

  test('enqueueBill adds a bill to queue with metadata and returns localId', () => {
    const payload = {
      customerName: 'Test Customer',
      amount: 500,
      paymentMode: 'Cash',
    };
    const localId = enqueueBill(payload);

    assert.ok(localId.startsWith('inv_'), 'localId should start with inv_');
    const queue = getPendingBills();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].localId, localId);
    assert.equal(queue[0].payload.customerName, 'Test Customer');
    assert.equal(queue[0].retries, 0);
    assert.ok(queue[0].queuedAt);
  });

  test('enqueueBill is idempotent for identical localId', () => {
    const localId = 'inv_fixed_id_123';
    enqueueBill({ localId, customerName: 'Alice' });
    enqueueBill({ localId, customerName: 'Alice' });

    const queue = getPendingBills();
    assert.equal(queue.length, 1);
  });

  test('dequeueBill removes bill by localId', () => {
    const id1 = enqueueBill({ customerName: 'Customer 1' });
    const id2 = enqueueBill({ customerName: 'Customer 2' });

    assert.equal(getPendingBills().length, 2);

    dequeueBill(id1);
    const queue = getPendingBills();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].localId, id2);
  });

  test('queue persists across simulated reloads', () => {
    enqueueBill({ customerName: 'Persistent Bill', amount: 100 });
    const raw = localStorage.getItem('pos_pending_bills');
    assert.ok(raw, 'pos_pending_bills should exist in localStorage');

    const parsed = JSON.parse(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].payload.customerName, 'Persistent Bill');
  });
});
