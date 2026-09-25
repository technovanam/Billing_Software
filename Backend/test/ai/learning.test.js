// Business learning: stats from bills, ranking, and the "usual product" auto-match.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildStats, applyNewBill, buildResolvers, emptyStats } = require('../../ai/learning/statsModel');
const { createRanking } = require('../../ai/learning/ranker');
const { toDocs, fromDocs } = require('../../ai/learning/statsStore');
const { createBillListener } = require('../../ai/learning/billListener');
const { applyCommand } = require('../../ai/draftBuilder');
const { ParsedCommandSchema } = require('../../ai/schema');
const { toProductRecord } = require('../../ai/matcher');
const { loadCatalog, fullReply, rawCatalog } = require('./helpers');

const NOW = new Date('2026-09-25T10:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const catalog = loadCatalog();

// Ravi (c_ravi) keeps buying Ponni rice; Basmati sells to others.
function sampleInvoices() {
  const bills = [];
  for (let i = 0; i < 4; i += 1) bills.push({ id: `r${i}`, clientId: 'c_ravi', createdAt: daysAgo(10 + i * 7), items: [{ productId: 'p_rice_ponni', quantity: 25 }, { description: 'Toor Dal', quantity: 5 }] });
  for (let i = 0; i < 6; i += 1) bills.push({ id: `b${i}`, customerName: 'Meena Textiles', createdAt: daysAgo(3 + i), items: [{ name: 'Basmati Rice', qty: 5 }] });
  bills.push({ id: 'draft1', clientId: 'c_ravi', status: 'Draft', createdAt: daysAgo(1), items: [{ productId: 'p_rice_basmati', quantity: 1 }] });
  return bills;
}

function stats() {
  return buildStats({ invoices: sampleInvoices(), products: catalog.products, customers: catalog.customers, now: NOW });
}

const riceCmd = (customer) =>
  ParsedCommandSchema.parse(fullReply({ intent: 'create_invoice', customer: customer ? { name: customer, phone: null } : null, items: [{ spoken_name: 'rice', qty: 10, unit: 'kg' }] }));

describe('stats from bills', () => {
  test('counts products, customers, pairs; skips drafts; resolves lines by name', () => {
    const s = stats();
    assert.equal(s.meta.bills, 10);
    assert.equal(s.products.p_rice_ponni.n, 4);
    assert.equal(s.products.p_rice_basmati.n, 6, 'Basmati resolved from line names; draft bill skipped');
    assert.equal(s.products.p_dal.n, 4, 'Toor Dal resolved from description');
    assert.equal(s.customers.c_meena.n, 6, 'POS bill customer resolved from customerName');
    assert.equal(s.customerProducts.c_ravi.p_rice_ponni.n, 4);
    assert.equal(s.pairs.p_rice_ponni.p_dal, 4);
    assert.equal(s.meta.watermark.at, daysAgo(1));
  });

  test('picks from aiLogs are counted', () => {
    const s = buildStats({
      invoices: [],
      logs: [
        { type: 'alias_saved', alias: 'chawal', productId: 'p_rice_basmati' },
        { type: 'command', corrections: [{ type: 'pick_product', spokenName: 'rice', to: 'p_rice_ponni' }] },
        { type: 'pick_signal', spokenName: 'rice', productId: 'p_rice_ponni' },
      ],
      products: catalog.products,
      customers: catalog.customers,
      now: NOW,
    });
    assert.deepEqual(s.picks, { chawal: { p_rice_basmati: 1 }, rice: { p_rice_ponni: 2 } });
  });

  test('incremental bills respect the watermark (no double counting)', () => {
    const s = stats();
    const resolvers = buildResolvers(catalog.products, catalog.customers);
    const newBill = { id: 'n1', clientId: 'c_ravi', createdAt: daysAgo(0), items: [{ productId: 'p_rice_ponni', quantity: 1 }] };
    assert.equal(applyNewBill(s, newBill, resolvers), true);
    assert.equal(applyNewBill(s, newBill, resolvers), false, 'same bill twice');
    assert.equal(applyNewBill(s, { ...newBill, id: 'old', createdAt: daysAgo(40) }, resolvers), false, 'older than watermark');
    assert.equal(s.customerProducts.c_ravi.p_rice_ponni.n, 5);
  });

  test('stats survive the Firestore document round trip', () => {
    const s = stats();
    const docs = toDocs(JSON.parse(JSON.stringify(s)));
    const back = fromDocs(Object.entries(docs).map(([id, data]) => ({ id, exists: true, data: () => data })));
    assert.deepEqual(back.products, s.products);
    assert.deepEqual(back.customerProducts, s.customerProducts);
    assert.deepEqual(back.pairs, s.pairs);
  });
});

describe('ranking prefers the usual product', () => {
  test("Ravi's ambiguous 'rice' auto-matches Ponni with a label", () => {
    const ranking = createRanking({ stats: stats(), now: NOW });
    const out = applyCommand(riceCmd('Ravi Traders'), null, catalog, { context: 'invoice', ranking });
    const line = out.draft.items[0];
    assert.equal(line.status, 'matched');
    assert.equal(line.source, 'learned');
    assert.equal(line.product.id, 'p_rice_ponni');
    assert.equal(line.learned.label, 'Usual for Ravi Traders');
    assert.equal(line.learned.count, 4);
  });

  test('without a customer it stays ambiguous, most popular first', () => {
    const ranking = createRanking({ stats: stats(), now: NOW });
    const line = applyCommand(riceCmd(null), null, catalog, { context: 'invoice', ranking }).draft.items[0];
    assert.equal(line.status, 'ambiguous');
    assert.equal(line.candidates[0].id, 'p_rice_basmati');
  });

  test('another customer gets their own favourite first but no auto-match below 3 buys', () => {
    const s = stats();
    s.customerProducts.c_selvam = { p_rice_basmati: { n: 2, last: daysAgo(2), recent: [daysAgo(2), daysAgo(5)] } };
    const ranking = createRanking({ stats: s, now: NOW });
    const line = applyCommand(riceCmd('Selvam Stores'), null, catalog, { context: 'invoice', ranking }).draft.items[0];
    assert.equal(line.status, 'ambiguous');
    assert.equal(line.candidates[0].id, 'p_rice_basmati');
  });

  test('purchases older than 90 days do not count', () => {
    const s = stats();
    s.customerProducts.c_ravi.p_rice_ponni.recent = [daysAgo(95), daysAgo(100), daysAgo(120), daysAgo(10)];
    const ranking = createRanking({ stats: s, now: NOW });
    const line = applyCommand(riceCmd('Ravi Traders'), null, catalog, { context: 'invoice', ranking }).draft.items[0];
    assert.equal(line.status, 'ambiguous');
    assert.equal(line.candidates[0].id, 'p_rice_ponni', 'still ranked first');
  });

  test('below 70% share there is no auto-match', () => {
    const s = stats();
    s.customerProducts.c_ravi.p_rice_basmati = { n: 3, last: daysAgo(5), recent: [daysAgo(5), daysAgo(6), daysAgo(7)] };
    const ranking = createRanking({ stats: s, now: NOW });
    const line = applyCommand(riceCmd('Ravi Traders'), null, catalog, { context: 'invoice', ranking }).draft.items[0];
    assert.equal(line.status, 'ambiguous');
  });

  test('an inactive product is never auto-matched', () => {
    const products = rawCatalog.products.map((p) => toProductRecord(p.id === 'p_rice_ponni' ? { ...p, active: false } : p));
    const ranking = createRanking({ stats: stats(), now: NOW });
    const line = applyCommand(riceCmd('Ravi Traders'), null, { ...catalog, products }, { context: 'invoice', ranking }).draft.items[0];
    assert.notEqual(line.product?.id, 'p_rice_ponni', 'the inactive usual product is not chosen');
    assert.notEqual(line.source, 'learned');
    assert.equal(line.candidates.some((c) => c.id === 'p_rice_ponni'), false, 'nor offered');
  });

  test('ranking never changes prices', () => {
    const ranking = createRanking({ stats: stats(), now: NOW });
    const line = applyCommand(riceCmd('Ravi Traders'), null, catalog, { context: 'invoice', ranking }).draft.items[0];
    assert.equal(line.product.pricePaise, 6200);
    assert.equal(line.lineTotalPaise, 62000);
  });

  test('frequent customer is listed first when names tie', () => {
    const s = stats();
    s.customers.c_kumar_r = { n: 9, last: daysAgo(1) };
    const ranking = createRanking({ stats: s, now: NOW });
    const cmd = ParsedCommandSchema.parse(fullReply({ intent: 'set_customer', customer: { name: 'Kumar', phone: null } }));
    const customer = applyCommand(cmd, null, catalog, { context: 'pos', ranking }).draft.customer;
    assert.equal(customer.status, 'ambiguous');
    assert.equal(customer.candidates[0].id, 'c_kumar_r');
  });
});

describe('bill listener', () => {
  function setup() {
    let t = 0;
    const subs = new Map();
    const store = { s: stats(), get: async () => store.s, mutate: async (_id, fn) => fn(store.s) };
    const source = {
      subscribe(id, since, onDocs) {
        subs.set(id, { since, onDocs });
        return () => subs.delete(id);
      },
    };
    const listener = createBillListener({ statsStore: store, getCatalog: async () => catalog, rebuild: async () => {}, source, idleMs: 30 * 60 * 1000, now: () => t });
    return { listener, subs, store, setT: (v) => (t = v) };
  }

  test('opens on a command, starts at the watermark, and applies new bills', async () => {
    const { listener, subs, store } = setup();
    await listener.touch('biz');
    assert.equal(subs.get('biz').since, daysAgo(1));
    subs.get('biz').onDocs([{ id: 'n1', clientId: 'c_ravi', createdAt: NOW.toISOString(), items: [{ productId: 'p_rice_ponni', quantity: 1 }] }]);
    await new Promise((r) => setImmediate(r));
    assert.equal(store.s.customerProducts.c_ravi.p_rice_ponni.n, 5);
    listener.closeAll();
  });

  test('closes after 30 minutes without commands and reopens on the next one', async () => {
    const { listener, subs, setT } = setup();
    await listener.touch('biz');
    setT(29 * 60 * 1000);
    listener.sweep();
    assert.equal(listener.isOpen('biz'), true);
    await listener.touch('biz'); // a command resets the idle timer
    setT(58 * 60 * 1000);
    listener.sweep();
    assert.equal(listener.isOpen('biz'), true);
    setT(90 * 60 * 1000);
    listener.sweep();
    assert.equal(listener.isOpen('biz'), false);
    assert.equal(subs.has('biz'), false);
    await listener.touch('biz');
    assert.equal(listener.isOpen('biz'), true);
    listener.closeAll();
  });

  test('a business with no stats is rebuilt before listening', async () => {
    let rebuilt = 0;
    const store = { s: emptyStats(), get: async () => store.s, mutate: async () => {} };
    const listener = createBillListener({
      statsStore: store,
      getCatalog: async () => catalog,
      rebuild: async () => {
        rebuilt += 1;
        store.s = stats();
      },
      source: { subscribe: () => () => {} },
    });
    await listener.touch('biz');
    assert.equal(rebuilt, 1);
    listener.closeAll();
  });
});
