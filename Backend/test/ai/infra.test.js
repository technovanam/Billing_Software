// Catalogue cache, permissions and rate limiting.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogCache } = require('../../ai/catalogCache');
const { resolveRole, canUseContext, canRunIntent, canManageAliases } = require('../../ai/permissions');
const { createUserRateLimiter } = require('../../ai/rateLimit');
const { rawCatalog } = require('./helpers');

function fakeSource() {
  const subs = new Map();
  return {
    subs,
    subscribe(businessId, handlers) {
      subs.set(businessId, handlers);
      queueMicrotask(() => {
        handlers.onProducts(rawCatalog.products);
        handlers.onCustomers(rawCatalog.customers);
      });
      return () => subs.delete(businessId);
    },
  };
}

describe('catalogue cache', () => {
  test('loads once and serves from memory', async () => {
    const source = fakeSource();
    let opened = 0;
    const wrapped = { subscribe: (...a) => { opened += 1; return source.subscribe(...a); } };
    const cache = createCatalogCache({ source: wrapped });
    await cache.get('biz1');
    await cache.get('biz1');
    assert.equal(opened, 1);
    cache.close();
  });

  test('a product created or edited anywhere replaces the cached list', async () => {
    const source = fakeSource();
    const cache = createCatalogCache({ source });
    const before = await cache.get('biz1');
    assert.equal(before.products.some((p) => p.name === 'Cement Premium'), false);

    // Simulates a Firestore change event (create from the preview panel, product edit, etc.)
    source.subs.get('biz1').onProducts([...rawCatalog.products, { id: 'p_new', name: 'Cement Premium', price: 500 }]);
    const after = await cache.get('biz1');
    assert.equal(after.products.some((p) => p.name === 'Cement Premium'), true);
    assert.ok(after.version > before.version);
    cache.close();
  });

  test('a customer edit replaces the cached list', async () => {
    const source = fakeSource();
    const cache = createCatalogCache({ source });
    await cache.get('biz1');
    source.subs.get('biz1').onCustomers([{ id: 'c_ravi', name: 'Ravi Traders Pvt Ltd' }]);
    const after = await cache.get('biz1');
    assert.deepEqual(after.customers.map((c) => c.name), ['Ravi Traders Pvt Ltd']);
    cache.close();
  });

  test('invalidate closes the listener and reloads on next use', async () => {
    const source = fakeSource();
    const cache = createCatalogCache({ source });
    await cache.get('biz1');
    cache.invalidate('biz1');
    assert.equal(source.subs.has('biz1'), false);
    await cache.get('biz1');
    assert.equal(source.subs.has('biz1'), true);
    cache.close();
  });

  test('idle businesses are dropped', async () => {
    let t = 0;
    const source = fakeSource();
    const cache = createCatalogCache({ source, idleMs: 1000, now: () => t });
    await cache.get('biz1');
    t = 5000;
    cache.sweep();
    assert.equal(cache.size(), 0);
    assert.equal(source.subs.has('biz1'), false);
    cache.close();
  });

  test('a listener error drops the entry so the next call retries', async () => {
    const source = {
      subscribe(_id, h) {
        queueMicrotask(() => h.onError(new Error('permission denied')));
        return () => {};
      },
    };
    const cache = createCatalogCache({ source });
    await assert.rejects(cache.get('biz1'), /permission denied/);
    assert.equal(cache.size(), 0);
    cache.close();
  });
});

describe('permissions', () => {
  test('role resolution', () => {
    assert.equal(resolveRole({ email: 'wh.demo@x.in', context: 'invoice' }), 'warehouse');
    assert.equal(resolveRole({ email: 'owner@x.in', context: 'pos' }), 'cashier');
    assert.equal(resolveRole({ email: 'owner@x.in', context: 'invoice' }), 'owner');
  });
  test('cashier can bill on POS but not open invoices or ask business questions', () => {
    assert.equal(canUseContext('cashier', 'pos'), true);
    assert.equal(canUseContext('cashier', 'invoice'), false);
    assert.equal(canRunIntent('cashier', 'create_pos_bill'), true);
    assert.equal(canRunIntent('cashier', 'query'), false);
    assert.equal(canRunIntent('cashier', 'create_invoice'), false);
  });
  test('warehouse cannot bill', () => {
    assert.equal(canUseContext('warehouse', 'pos'), false);
    assert.equal(canUseContext('warehouse', 'invoice'), false);
  });
  test('only owners manage aliases', () => {
    assert.equal(canManageAliases('owner'), true);
    assert.equal(canManageAliases('cashier'), false);
    assert.equal(canManageAliases('warehouse'), false);
  });
});

describe('per-user rate limit', () => {
  test('blocks after the limit and recovers after the window', () => {
    let t = 0;
    const rl = createUserRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    assert.equal(rl.check('u1').allowed, true);
    assert.equal(rl.check('u1').allowed, true);
    const blocked = rl.check('u1');
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSec >= 1);
    assert.equal(rl.check('u2').allowed, true, 'other users unaffected');
    t = 1500;
    assert.equal(rl.check('u1').allowed, true);
  });
});
