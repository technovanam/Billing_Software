const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { matchProduct, matchCustomer, normalizeText, normalizeUnit, convertQty } = require('../../ai/matcher');
const { rupeesToPaise } = require('../../ai/money');
const { loadCatalog } = require('./helpers');

const { products, customers } = loadCatalog();

describe('normalisation', () => {
  test('text', () => {
    assert.equal(normalizeText('  Parle-G  Biscuit! '), 'parle g biscuit');
  });
  test('units', () => {
    assert.equal(normalizeUnit('Kilogram'), 'kg');
    assert.equal(normalizeUnit('gms'), 'gram');
    assert.equal(normalizeUnit('Ltr'), 'litre');
    assert.equal(normalizeUnit('Nos'), 'piece');
    assert.equal(normalizeUnit(null), null);
  });
  test('quantity conversion only within the same kind of unit', () => {
    assert.equal(convertQty(250, 'gram', 'kg'), 0.25);
    assert.equal(convertQty(2, 'dozen', 'piece'), 24);
    assert.equal(convertQty(3, 'bag', 'kg'), 3);
    assert.equal(convertQty(null, 'kg', 'gram'), null);
  });
  test('rupees to paise', () => {
    assert.equal(rupeesToPaise(110.5), 11050);
    assert.equal(rupeesToPaise('1,250.50'), 125050);
    assert.equal(rupeesToPaise('₹0.1'), 10);
    assert.equal(rupeesToPaise(undefined), 0);
    assert.equal(rupeesToPaise('abc'), 0);
  });
});

describe('product matching', () => {
  test('exact name is a match with full confidence', () => {
    const r = matchProduct('Cement', null, products);
    assert.equal(r.status, 'matched');
    assert.equal(r.source, 'exact');
    assert.equal(r.best.score, 1);
  });
  test('brand + name counts as exact', () => {
    assert.equal(matchProduct('UltraTech Cement', null, products).best.product.id, 'p_cement');
  });
  test('saved alias beats fuzzy', () => {
    const r = matchProduct('Arhar Dal', 'kg', products);
    assert.equal(r.source, 'alias');
    assert.equal(r.best.product.id, 'p_dal');
  });
  test('two similar products are ambiguous with both as candidates', () => {
    const r = matchProduct('rice', 'kg', products);
    assert.equal(r.status, 'ambiguous');
    assert.ok(r.candidates.length >= 2 && r.candidates.length <= 3);
  });
  test('unknown product is unmatched', () => {
    assert.equal(matchProduct('saffron', 'kg', products).status, 'unmatched');
  });
  test('candidates are capped at 3 and scored 0-1', () => {
    const r = matchProduct('oil soap milk', null, products);
    assert.ok(r.candidates.length <= 3);
    for (const c of r.candidates) assert.ok(c.score >= 0 && c.score <= 1);
  });
  test('an unrelated unit lowers confidence', () => {
    const sameUnit = matchProduct('suger', 'kg', products).candidates[0].score;
    const otherUnit = matchProduct('suger', 'litre', products).candidates[0].score;
    assert.ok(sameUnit > otherUnit);
  });
  test('empty name is unmatched', () => {
    assert.equal(matchProduct('  ', null, products).status, 'unmatched');
  });
});

describe('customer matching', () => {
  test('two customers with the same name are ambiguous', () => {
    const r = matchCustomer('Kumar', customers);
    assert.equal(r.status, 'ambiguous');
    assert.deepEqual(r.candidates.map((c) => c.customer.id).sort(), ['c_kumar_r', 'c_kumar_s']);
  });
  test('company name matches', () => {
    assert.equal(matchCustomer('selvam stores', customers).best.customer.id, 'c_selvam');
  });
  test('small typo still matches', () => {
    assert.equal(matchCustomer('Ravi Trader', customers).best.customer.id, 'c_ravi');
  });
  test('unknown customer is unmatched', () => {
    assert.equal(matchCustomer('Zebra Enterprises', customers).status, 'unmatched');
  });
});

describe('inactive products', () => {
  test('are never matched or offered as candidates', () => {
    const { toProductRecord } = require('../../ai/matcher');
    const { rawCatalog } = require('./helpers');
    const products = rawCatalog.products.map((p) => toProductRecord(p.id === 'p_sugar' ? { ...p, isActive: false } : p));
    const exact = matchProduct('Sugar', 'kg', products);
    assert.equal(exact.status, 'unmatched');
    assert.equal(exact.candidates.some((c) => c.product.id === 'p_sugar'), false);
    assert.equal(matchProduct('Cement', null, products).best.product.id, 'p_cement', 'active products still match');
  });
});
