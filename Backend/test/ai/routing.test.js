// Local-first routing, the Ollama adapter, fallback config, the training
// export and the productId backfill.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { runCommand } = require('../../ai/pipeline');
const { createOllamaProvider } = require('../../ai/llm/ollama');
const { buildProvider } = require('../../ai/llm');
const { buildTrainingExamples, redactText } = require('../../ai/training/exportTraining');
const { planBackfill } = require('../../ai/maintenance/backfillProductIds');
const { loadCatalog, fullReply, rawCatalog } = require('./helpers');

const catalog = loadCatalog();

function fakeFallback(reply, { fail = false } = {}) {
  const calls = [];
  return {
    name: 'anthropic',
    model: 'test-model',
    calls,
    async parseCommand(args) {
      calls.push(args);
      if (fail) throw Object.assign(new Error('down'), { code: 'AI_UNAVAILABLE' });
      return { parsed: fullReply(reply), usage: { inputTokens: 10, outputTokens: 5 } };
    },
  };
}

describe('routing', () => {
  test('a confident local parse never calls the fallback', async () => {
    const fb = fakeFallback({ intent: 'unknown' });
    const run = await runCommand({ text: 'Ravi Traders ku 10 bag cement, 5 kg nails', context: 'invoice', catalog, fallback: fb, threshold: 0.85 });
    assert.equal(run.path, 'local');
    assert.equal(fb.calls.length, 0);
    assert.equal(run.result.draft.items.length, 2);
    assert.ok(run.localConfidence.overall >= 0.85);
  });

  test('a low-confidence parse goes to the fallback and is logged with its path', async () => {
    const fb = fakeFallback({ intent: 'create_pos_bill', items: [{ spoken_name: 'Lux soap', qty: 2, unit: null }] });
    const run = await runCommand({ text: 'Lux soap de do yaar', context: 'pos', catalog, fallback: fb, threshold: 0.85 });
    assert.equal(run.path, 'anthropic');
    assert.equal(fb.calls.length, 1);
    assert.deepEqual(Object.keys(fb.calls[0]).sort(), ['context', 'draftItemNames', 'text'], 'only text, context and item names go out');
    assert.equal(run.result.draft.items[0].product.id, 'p_soap');
    assert.ok(run.localConfidence.overall < 0.85);
  });

  test('a name that matches no product lowers confidence (catalogue-aware)', async () => {
    const run = await runCommand({ text: '5 kg saffron', context: 'pos', catalog, threshold: 0.85 });
    assert.ok(run.localConfidence.items[0] <= 0.7);
    assert.equal(run.lowConfidence, true);
  });

  test('with no fallback, the local result comes back with unsure parts marked', async () => {
    const run = await runCommand({ text: '5 kg saffron and 2 kg sugar', context: 'pos', catalog, fallback: null, threshold: 0.85 });
    assert.equal(run.path, 'local');
    assert.equal(run.lowConfidence, true);
    const [saffron, sugar] = run.result.draft.items;
    assert.equal(saffron.uncertain, true);
    assert.equal(sugar.uncertain, undefined, 'the confident line is not flagged');
    assert.match(run.result.messages.join(' '), /Please check/);
  });

  test('if the fallback fails, the local result is used and the error recorded', async () => {
    const fb = fakeFallback({}, { fail: true });
    const run = await runCommand({ text: 'Lux soap', context: 'pos', catalog, fallback: fb, threshold: 0.85 });
    assert.equal(run.path, 'local');
    assert.equal(run.fallbackError, 'AI_UNAVAILABLE');
    assert.equal(run.lowConfidence, true);
  });

  test('invalid fallback output is rejected and the local result used', async () => {
    const bad = { name: 'ollama', model: 'm', parseCommand: async () => ({ parsed: { intent: 'drop_tables' } }) };
    const run = await runCommand({ text: 'Lux soap', context: 'pos', catalog, fallback: bad, threshold: 0.85 });
    assert.equal(run.path, 'local');
    assert.equal(run.fallbackError, 'AI_BAD_OUTPUT');
  });

  test('the threshold is respected', async () => {
    const fb = fakeFallback({ intent: 'create_pos_bill', items: [{ spoken_name: 'sugar', qty: 2, unit: 'kg' }] });
    const run = await runCommand({ text: '2 kg sugar', context: 'pos', catalog, fallback: fb, threshold: 0.99 });
    assert.equal(run.path, 'anthropic', 'a stricter threshold sends even good parses to the fallback');
  });
});

describe('fallback configuration', () => {
  test('default is none', () => {
    assert.equal(buildProvider('none', {}), null);
  });
  test('missing settings are reported, not silently ignored', () => {
    assert.throws(() => buildProvider('anthropic', {}), /AI_API_KEY/);
    assert.throws(() => buildProvider('ollama', { AI_OLLAMA_URL: 'http://x' }), /AI_OLLAMA_MODEL/);
    assert.throws(() => buildProvider('openai', {}), /Unsupported/);
  });
});

describe('ollama adapter', () => {
  const reply = { intent: 'create_pos_bill', customer: null, items: [{ spoken_name: 'sugar', qty: 2, unit: 'kg' }], discount: null, payment: null, due_in_days: null, notes: null, clarification_needed: null };
  const okFetch = (content, captured = {}) => async (url, init) => {
    captured.url = url;
    captured.body = JSON.parse(init.body);
    captured.headers = init.headers;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 50, completion_tokens: 20 } }) };
  };

  test('calls the OpenAI-compatible endpoint with a JSON schema and validates the reply', async () => {
    const captured = {};
    const p = createOllamaProvider({ baseUrl: 'http://gpu-box:11434/', model: 'qwen2.5:7b', apiKey: 'k', fetchImpl: okFetch(JSON.stringify(reply), captured) });
    const out = await p.parseCommand({ text: '2 kg sugar', context: 'pos', draftItemNames: [] });
    assert.equal(captured.url, 'http://gpu-box:11434/v1/chat/completions');
    assert.equal(captured.body.model, 'qwen2.5:7b');
    assert.equal(captured.body.response_format.type, 'json_schema');
    assert.equal(captured.headers.authorization, 'Bearer k');
    assert.deepEqual(out.parsed.items, reply.items);
    assert.deepEqual(out.usage, { inputTokens: 50, outputTokens: 20 });
  });

  test('accepts JSON wrapped in a code fence', async () => {
    const p = createOllamaProvider({ baseUrl: 'http://x', model: 'm', fetchImpl: okFetch('```json\n' + JSON.stringify(reply) + '\n```') });
    assert.equal((await p.parseCommand({ text: 't', context: 'pos', draftItemNames: [] })).parsed.intent, 'create_pos_bill');
  });

  test('rejects output that fails the schema', async () => {
    const p = createOllamaProvider({ baseUrl: 'http://x', model: 'm', fetchImpl: okFetch(JSON.stringify({ ...reply, intent: 'rm -rf' })) });
    await assert.rejects(p.parseCommand({ text: 't', context: 'pos', draftItemNames: [] }), (e) => e.code === 'AI_BAD_OUTPUT');
  });

  test('server errors are reported as unavailable', async () => {
    const p = createOllamaProvider({ baseUrl: 'http://x', model: 'm', fetchImpl: async () => ({ ok: false, status: 503 }) });
    await assert.rejects(p.parseCommand({ text: 't', context: 'pos', draftItemNames: [] }), (e) => e.code === 'AI_UNAVAILABLE');
  });
});

describe('training export', () => {
  const baseLog = {
    type: 'command',
    sessionId: 's1',
    context: 'invoice',
    status: 'confirmed',
    transcript: 'Ravi Traders ku 10 bag cement, 5 kg nails, call 98765 43210, GST 33ABCDE1234F1Z5',
    draftItemNames: [],
    parsed: fullReply({ intent: 'create_invoice', customer: { name: 'Ravi Traders', phone: '9876543210' }, items: [{ spoken_name: 'cement', qty: 10, unit: 'bag' }, { spoken_name: 'nails', qty: 5, unit: 'kg' }] }),
    itemKeys: ['k1', 'k2'],
    corrections: [{ type: 'change_qty', itemKey: 'k1', from: 10, to: 12 }],
    finalDraft: { customerId: 'c_ravi', customerName: 'Ravi Traders', items: [{ key: 'k1', productId: 'p_cement', productName: 'Cement', qty: 12 }] },
    createdAt: '2026-09-25T10:00:00Z',
  };

  test('customer names become <CUSTOMER>, phones and GSTINs are removed, corrections applied', () => {
    const [ex] = buildTrainingExamples([baseLog]);
    assert.equal(ex.input, '<CUSTOMER> ku 10 bag cement, 5 kg nails, call <PHONE>, GST <GSTIN>');
    assert.deepEqual(ex.output.customer, { name: '<CUSTOMER>', phone: null });
    assert.equal(ex.output.items.length, 1, 'nails was removed by the user');
    assert.deepEqual(ex.output.items[0], { spoken_name: 'cement', qty: 12, unit: null, product_name: 'Cement' });
    assert.equal(JSON.stringify(ex).includes('9876543210'), false);
    assert.equal(JSON.stringify(ex).includes('Ravi'), false);
  });

  test('only confirmed sessions are exported', () => {
    assert.equal(buildTrainingExamples([{ ...baseLog, status: 'parsed' }]).length, 0);
    assert.equal(buildTrainingExamples([{ ...baseLog, status: 'discarded' }]).length, 0);
    assert.equal(buildTrainingExamples([{ ...baseLog, status: 'saved' }]).length, 1);
  });

  test('follow-up commands in a confirmed session are exported with the previous item names', () => {
    const follow = { ...baseLog, status: 'parsed', finalDraft: null, transcript: 'remove nails', draftItemNames: ['Cement', 'Nails 2 inch'], parsed: fullReply({ intent: 'remove_item', items: [{ spoken_name: 'nails', qty: null, unit: null }] }), itemKeys: [null], corrections: [], createdAt: '2026-09-25T10:01:00Z' };
    const out = buildTrainingExamples([follow, baseLog]);
    assert.equal(out.length, 2);
    assert.equal(out[1].input, 'remove nails');
    assert.deepEqual(out[1].draft_items, ['Cement', 'Nails 2 inch']);
  });

  test('redaction keeps the rest of the sentence', () => {
    assert.equal(redactText('Kumar ki 3 dozen eggs, +91 91234 56789', ['Kumar']), '<CUSTOMER> ki 3 dozen eggs, <PHONE>');
    assert.equal(redactText('Kumaran ku rice', ['Kumar']), 'Kumaran ku rice', 'only whole names');
  });
});

describe('productId backfill', () => {
  const products = rawCatalog.products.concat([{ id: 'p_cement2', name: 'Cement', brand: 'Ramco' }]);
  const invoices = [
    { id: 'i1', items: [{ description: 'Sugar', quantity: 2 }, { description: 'Cement', quantity: 1 }, { description: 'Mystery', quantity: 1 }, { description: '', quantity: 1 }] },
    { id: 'i2', items: [{ description: 'Toor Dal', productId: 'p_dal', quantity: 1 }] },
    { id: 'i3', products: [{ name: 'Ramco Cement', qty: 3 }] },
  ];

  test('links lines that match exactly one product and reports skips', () => {
    const { updates, counts } = planBackfill({ invoices, products });
    assert.deepEqual(counts, { invoicesScanned: 3, invoicesToUpdate: 2, linesMatched: 2, linesAlreadyLinked: 1, skippedNoName: 1, skippedNoMatch: 1, skippedAmbiguous: 1 });
    assert.equal(updates[0].lines[0].productId, 'p_sugar');
    assert.equal(updates[0].lines[1].productId, undefined, 'two products are called Cement');
    assert.equal(updates[1].field, 'products');
    assert.equal(updates[1].lines[0].productId, 'p_cement2', 'brand + name is unique');
  });

  test('running it twice changes nothing the second time', () => {
    const first = planBackfill({ invoices, products });
    const applied = invoices.map((inv) => {
      const u = first.updates.find((x) => x.id === inv.id);
      return u ? { ...inv, [u.field]: u.lines } : inv;
    });
    const second = planBackfill({ invoices: applied, products });
    assert.equal(second.updates.length, 0);
    assert.equal(second.counts.linesMatched, 0);
    assert.equal(second.counts.linesAlreadyLinked, 3);
  });
});
