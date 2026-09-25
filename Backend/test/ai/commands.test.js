// Runs every sample command through the real schema, matcher and draft builder,
// with the LLM reply replaced by the recorded one in fixtures/commands.json.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ParsedCommandSchema } = require('../../ai/schema');
const { applyCommand } = require('../../ai/draftBuilder');
const { loadCatalog, fullReply, cases } = require('./helpers');

const catalog = loadCatalog();
const byId = new Map(cases.map((c) => [c.id, c]));
const results = new Map();

function run(caseDef) {
  if (results.has(caseDef.id)) return results.get(caseDef.id);
  const before = caseDef.after ? run(byId.get(caseDef.after)).draft : null;
  const parsed = ParsedCommandSchema.parse(fullReply(caseDef.llm));
  const out = applyCommand(parsed, before, catalog, { context: caseDef.context });
  results.set(caseDef.id, out);
  return out;
}

function checkExpectations(c, out) {
  const e = c.expect;
  if (e.intent) assert.equal(out.intent, e.intent, 'intent');

  if ('clarification' in e) {
    if (e.clarification === null) assert.equal(out.clarification, null, 'no clarification expected');
    else assert.match(out.clarification || '', new RegExp(e.clarification), 'clarification');
  }
  if (e.messages) assert.match(out.messages.join(' '), new RegExp(e.messages), 'messages');
  if ('dueInDays' in e) assert.equal(out.draft.dueInDays, e.dueInDays, 'dueInDays');
  if (e.paymentMode) assert.equal(out.draft.payment?.mode, e.paymentMode, 'payment mode');

  if (e.customer) {
    const got = out.draft.customer;
    assert.ok(got, 'customer expected');
    assert.equal(got.status, e.customer.status, 'customer status');
    if (e.customer.id) assert.equal(got.id, e.customer.id, 'customer id');
    if (e.customer.name) assert.equal(got.name, e.customer.name, 'customer name');
    if (e.customer.candidateIds) {
      assert.deepEqual(got.candidates.map((x) => x.id).sort(), [...e.customer.candidateIds].sort(), 'customer candidates');
    }
  }

  if (e.items) {
    const got = out.draft.items;
    assert.equal(got.length, e.items.length, `item count (got ${got.map((i) => i.product?.name || i.spokenName).join(', ')})`);
    e.items.forEach((want, i) => {
      const item = got[i];
      if ('id' in want) assert.equal(item.product?.id ?? null, want.id, `item ${i} product`);
      if (want.status) assert.equal(item.status, want.status, `item ${i} status`);
      if (want.source) assert.equal(item.source, want.source, `item ${i} source`);
      if ('qty' in want) assert.equal(item.qty, want.qty, `item ${i} qty`);
      if ('lineTotalPaise' in want) assert.equal(item.lineTotalPaise, want.lineTotalPaise, `item ${i} line total`);
      if (want.candidateIds) {
        assert.deepEqual(item.candidates.map((x) => x.id).sort(), [...want.candidateIds].sort(), `item ${i} candidates`);
      }
    });
  }
}

describe('sample commands (recorded LLM replies)', () => {
  test('has at least 30 cases across English, Tamil, Hindi and mixed speech', () => {
    assert.ok(cases.length >= 30);
    const langs = new Set(cases.map((c) => c.lang));
    for (const lang of ['english', 'tamil', 'hindi', 'tanglish', 'hinglish']) assert.ok(langs.has(lang), lang);
  });

  for (const c of cases) {
    test(`${c.id}: "${c.text}"`, () => {
      checkExpectations(c, run(c));
    });
  }
});

describe('prices never come from the client', () => {
  test('a tampered draft price is replaced by the catalogue price', () => {
    const first = run(byId.get('en-ravi-cement-nails')).draft;
    const tampered = JSON.parse(JSON.stringify(first));
    tampered.items[0].product.pricePaise = 1;
    tampered.items[0].lineTotalPaise = 10;
    const parsed = ParsedCommandSchema.parse(fullReply({ intent: 'query' }));
    const out = applyCommand(parsed, tampered, catalog, { context: 'invoice' });
    assert.equal(out.draft.items[0].product.pricePaise, 42000);
    assert.equal(out.draft.items[0].lineTotalPaise, 420000);
  });

  test('an item whose product was deleted becomes unmatched', () => {
    const first = run(byId.get('en-ravi-cement-nails')).draft;
    const smaller = { ...catalog, products: catalog.products.filter((p) => p.id !== 'p_nails') };
    const parsed = ParsedCommandSchema.parse(fullReply({ intent: 'query' }));
    const out = applyCommand(parsed, first, smaller, { context: 'invoice' });
    assert.equal(out.draft.items[1].status, 'unmatched');
    assert.equal(out.draft.items[1].product, null);
  });
});

describe('schema rejects bad LLM output', () => {
  test('unknown intent', () => {
    assert.equal(ParsedCommandSchema.safeParse(fullReply({ intent: 'delete_everything' })).success, false);
  });
  test('price field smuggled into an item is stripped', () => {
    const parsed = ParsedCommandSchema.parse(fullReply({ intent: 'add_item', items: [{ spoken_name: 'cement', qty: 1, unit: 'bag', price: 1 }] }));
    assert.equal('price' in parsed.items[0], false);
  });
  test('missing required fields', () => {
    assert.equal(ParsedCommandSchema.safeParse({ intent: 'add_item' }).success, false);
  });
});
