// The local parser must reproduce the recorded LLM parse for every sample
// command, and handle the extra local-only cases.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseLocal } = require('../../ai/localParser');
const { ParsedCommandSchema } = require('../../ai/schema');
const { applyCommand } = require('../../ai/draftBuilder');
const { cases, fullReply, loadCatalog } = require('./helpers');
const { compareParse } = require('./compareParse');

const extra = require(path.join(__dirname, 'fixtures', 'local-extra.json')).cases;
const catalog = loadCatalog();
const byId = new Map(cases.map((c) => [c.id, c]));
const drafts = new Map();

// Draft names before a follow-up command, built from the recorded replies.
function draftNamesBefore(c) {
  if (!c.after) return [];
  const chain = [];
  for (let cur = c; cur.after; cur = byId.get(cur.after)) chain.unshift(byId.get(cur.after));
  let draft = null;
  for (const step of chain) {
    if (!drafts.has(step.id)) drafts.set(step.id, applyCommand(fullReply(step.llm), draft, catalog, { context: step.context }).draft);
    draft = drafts.get(step.id);
  }
  return draft.items.map((it) => it.product?.name || it.spokenName);
}

describe('local parser: every sample command', () => {
  for (const c of cases) {
    test(`${c.id}: "${c.text}"`, () => {
      const { parsed, confidence } = parseLocal({ text: c.text, context: c.context, draftItemNames: draftNamesBefore(c) });
      assert.equal(ParsedCommandSchema.safeParse(parsed).success, true, 'matches the LLM schema');
      assert.deepEqual(compareParse(fullReply(c.llm), parsed, c.context), []);
      assert.ok(confidence.overall >= 0 && confidence.overall <= 1);
    });
  }
});

describe('local parser: extra cases', () => {
  for (const c of extra) {
    test(`${c.id}: "${c.text}"`, () => {
      const { parsed, confidence } = parseLocal({ text: c.text, context: c.context, draftItemNames: c.draft || [] });
      assert.equal(ParsedCommandSchema.safeParse(parsed).success, true, 'matches the LLM schema');
      assert.deepEqual(compareParse(fullReply(c.expect), parsed, c.context), []);
      if (c.lowConfidence) assert.ok(confidence.overall < 0.85, `expected low confidence, got ${confidence.overall}`);
      else assert.ok(confidence.overall >= 0.85, `expected confident parse, got ${confidence.overall}`);
    });
  }
});

describe('local parser: details', () => {
  test('per-field confidences are reported', () => {
    const { confidence } = parseLocal({ text: 'Ravi Traders ku 10 bag cement, pathu kg nails, UPI', context: 'invoice' });
    assert.equal(confidence.items.length, 2);
    assert.ok(confidence.items[0] > confidence.items[1], 'digits score higher than number words');
    assert.ok(confidence.customer > 0.9);
    assert.ok(confidence.payment > 0.9);
    assert.equal(confidence.overall, Math.min(confidence.intent, confidence.customer, confidence.payment, ...confidence.items));
  });
  test('"do" is two only when it counts something', () => {
    assert.equal(parseLocal({ text: 'Kumar ko do Lux soap', context: 'pos' }).parsed.items[0].qty, 2);
    assert.equal(parseLocal({ text: 'Lux soap de do', context: 'pos' }).parsed.items[0].qty, null);
  });
  test('update without the item on the bill becomes an add', () => {
    const r = parseLocal({ text: 'cement 12 bags pannunga', context: 'invoice', draftItemNames: [] });
    assert.equal(r.parsed.intent, 'create_invoice');
    assert.equal(r.parsed.items[0].qty, 12);
  });
  test('numbers inside product names are kept', () => {
    const r = parseLocal({ text: '5 kg nails 2 inch', context: 'invoice' });
    assert.deepEqual(r.parsed.items[0], { spoken_name: 'nails 2 inch', qty: 5, unit: 'kg' });
  });
  test('the parser never produces prices, GST or HSN', () => {
    const r = parseLocal({ text: 'Ravi ku 10 bag cement at 420 rupees with 18% GST hsn 2523', context: 'invoice' });
    const json = JSON.stringify(r.parsed);
    for (const key of ['price', 'gst', 'hsn', 'rate', 'total']) assert.equal(new RegExp(`"${key}"`, 'i').test(json), false, key);
  });
  test('empty input is unknown with low confidence', () => {
    const r = parseLocal({ text: '   ', context: 'pos' });
    assert.equal(r.parsed.intent, 'unknown');
    assert.ok(r.confidence.overall < 0.5);
  });
});
