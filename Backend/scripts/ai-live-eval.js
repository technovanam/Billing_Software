/**
 * Measures the local-first pipeline on the sample commands
 * (test/ai/fixtures/commands.json + local-extra.json):
 *   - how many commands the local parser handles at AI_LOCAL_CONFIDENCE
 *   - local accuracy, and how many CONFIDENT local results were wrong
 *   - fallback accuracy (Anthropic or Ollama) and accuracy after routing
 *   - response times per path, plus a threshold sweep for tuning
 *
 *   node scripts/ai-live-eval.js                       # local only (free, offline)
 *   node scripts/ai-live-eval.js --fallback=anthropic  # also call the model (needs AI_API_KEY)
 *   node scripts/ai-live-eval.js --fallback=ollama     # needs AI_OLLAMA_URL, AI_OLLAMA_MODEL
 *   node scripts/ai-live-eval.js ta- x-                # only ids starting with these
 *   node scripts/ai-live-eval.js --from=exports/training-20261001.jsonl
 *        # measure on real confirmed commands exported from aiLogs (the honest test:
 *        # the sample commands are the set the parser was built against)
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { buildProvider } = require('../ai/llm');
const { runCommand, localThreshold } = require('../ai/pipeline');
const { applyCommand } = require('../ai/draftBuilder');
const { fullReply, cases: sampleCases, loadCatalog } = require('../test/ai/helpers');
const { compareParse } = require('../test/ai/compareParse');

const extraCases = require(path.join(__dirname, '..', 'test', 'ai', 'fixtures', 'local-extra.json')).cases;
const catalog = loadCatalog();
const threshold = localThreshold();

const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const prefixes = process.argv.slice(2).filter((a) => !a.startsWith('--'));

function pct(n, d) {
  return d ? `${((100 * n) / d).toFixed(1)}%` : '—';
}
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

const STAND_IN_CUSTOMER = 'Zedco Traders';

// Real commands from export-training-data.js. Their output already has the
// user's corrections; product_name is resolution info, not part of the parse.
function loadExported(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, i) => {
      // "<CUSTOMER>" would read as the word "customer"; use a neutral stand-in name.
      const ex = JSON.parse(line.replace(/<CUSTOMER>/g, STAND_IN_CUSTOMER));
      const truth = fullReply({ ...ex.output, items: (ex.output.items || []).map(({ product_name, ...it }) => it) });
      const draft = ex.draft_items?.length
        ? applyCommand(fullReply({ intent: 'add_item', items: ex.draft_items.map((n) => ({ spoken_name: n, qty: 1, unit: null })) }), null, catalog, { context: ex.context }).draft
        : null;
      return { id: `real-${i + 1}`, text: ex.input, context: ex.context, truth, currentDraft: draft };
    });
}

// Every case as { id, text, context, truth, currentDraft }.
function loadCases() {
  if (flag('from')) return loadExported(path.resolve(flag('from')));
  const byId = new Map(sampleCases.map((c) => [c.id, c]));
  const drafts = new Map();
  const draftFor = (c) => {
    if (!c.after) return null;
    if (!drafts.has(c.after)) {
      const base = byId.get(c.after);
      drafts.set(c.after, applyCommand(fullReply(base.llm), draftFor(base), catalog, { context: base.context }).draft);
    }
    return drafts.get(c.after);
  };
  const fromNames = (names, context) =>
    names?.length ? applyCommand(fullReply({ intent: 'add_item', items: names.map((n) => ({ spoken_name: n, qty: 1, unit: null })) }), null, catalog, { context }).draft : null;

  const all = [
    ...sampleCases.map((c) => ({ id: c.id, text: c.text, context: c.context, truth: fullReply(c.llm), currentDraft: draftFor(c) })),
    ...extraCases.map((c) => ({ id: c.id, text: c.text, context: c.context, truth: fullReply(c.expect), currentDraft: fromNames(c.draft, c.context) })),
  ];
  return prefixes.length ? all.filter((c) => prefixes.some((p) => c.id.startsWith(p))) : all;
}

async function main() {
  const fallbackName = (flag('fallback') || process.env.AI_FALLBACK || 'none').toLowerCase();
  const fallback = buildProvider(fallbackName, process.env);
  const cases = loadCases();
  console.log(`${cases.length} commands · local threshold ${threshold} · fallback ${fallback ? `${fallback.name} (${fallback.model})` : 'none'}\n`);

  const rows = [];
  for (const c of cases) {
    const t0 = process.hrtime.bigint();
    const local = await runCommand({ text: c.text, context: c.context, currentDraft: c.currentDraft, catalog, fallback: null, threshold });
    const localMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const localProblems = compareParse(c.truth, local.parsed, c.context);
    const row = { id: c.id, text: c.text, confidence: local.localConfidence.overall, confident: !local.lowConfidence, localOk: !localProblems.length, localProblems, localMs };

    if (fallback) {
      const t1 = Date.now();
      try {
        const reply = await fallback.parseCommand({ text: c.text, context: c.context, draftItemNames: local.draftItemNames });
        row.fallbackMs = Date.now() - t1;
        row.fallbackProblems = compareParse(c.truth, reply.parsed, c.context);
        row.fallbackOk = !row.fallbackProblems.length;
        row.tokens = (reply.usage?.inputTokens || 0) + (reply.usage?.outputTokens || 0);
      } catch (err) {
        row.fallbackMs = Date.now() - t1;
        row.fallbackOk = false;
        row.fallbackProblems = [`error: ${err.message}`];
      }
    }
    row.routedOk = row.confident || !fallback ? row.localOk : row.fallbackOk;
    rows.push(row);
  }

  const n = rows.length;
  const confident = rows.filter((r) => r.confident);
  const unsure = rows.filter((r) => !r.confident);
  const confidentWrong = confident.filter((r) => !r.localOk);

  console.log('Routing');
  console.log(`  handled locally (confidence >= ${threshold}): ${confident.length}/${n} (${pct(confident.length, n)})`);
  console.log(`  sent to fallback / marked for review:       ${unsure.length}/${n} (${pct(unsure.length, n)})`);
  console.log('\nLocal parser accuracy');
  console.log(`  all commands:        ${rows.filter((r) => r.localOk).length}/${n} (${pct(rows.filter((r) => r.localOk).length, n)})`);
  console.log(`  confident results:   ${confident.length - confidentWrong.length}/${confident.length} (${pct(confident.length - confidentWrong.length, confident.length)})`);
  console.log(`  low-confidence ones: ${unsure.filter((r) => r.localOk).length}/${unsure.length}`);
  console.log(`  CONFIDENT BUT WRONG: ${confidentWrong.length}`);
  for (const r of confidentWrong) console.log(`    ${r.id} (${r.confidence.toFixed(2)}) "${r.text}"\n      ${r.localProblems.join('\n      ')}`);

  if (fallback) {
    const fbOk = rows.filter((r) => r.fallbackOk).length;
    console.log(`\n${fallback.name} accuracy`);
    console.log(`  all commands:        ${fbOk}/${n} (${pct(fbOk, n)})`);
    console.log(`  low-confidence ones: ${unsure.filter((r) => r.fallbackOk).length}/${unsure.length}`);
    for (const r of rows.filter((x) => !x.fallbackOk)) console.log(`    ${r.id}: ${r.fallbackProblems.join('; ')}`);
  }
  const routedOk = rows.filter((r) => r.routedOk).length;
  console.log(`\nAfter routing: ${routedOk}/${n} correct (${pct(routedOk, n)})`);

  console.log('\nResponse time');
  const localMs = rows.map((r) => r.localMs);
  console.log(`  local:     p50 ${percentile(localMs, 0.5).toFixed(1)} ms, p95 ${percentile(localMs, 0.95).toFixed(1)} ms`);
  if (fallback) {
    const fbMs = rows.map((r) => r.fallbackMs).filter((v) => typeof v === 'number');
    const tokens = rows.reduce((s, r) => s + (r.tokens || 0), 0);
    console.log(`  ${fallback.name}: p50 ${percentile(fbMs, 0.5)} ms, p95 ${percentile(fbMs, 0.95)} ms · ${tokens} tokens total`);
  }

  console.log('\nThreshold sweep (local parser)');
  console.log('  threshold  handled-locally  confident-but-wrong');
  for (const t of [0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
    const conf = rows.filter((r) => r.confidence >= t);
    const wrong = conf.filter((r) => !r.localOk).length;
    console.log(`  ${t.toFixed(2).padEnd(9)}  ${`${conf.length}/${n} (${pct(conf.length, n)})`.padEnd(15)}  ${wrong}`);
  }

  const failures = rows.filter((r) => !r.localOk && !r.confident);
  if (failures.length) {
    console.log('\nLow-confidence local misses (these go to the fallback or are marked for review):');
    for (const r of failures) console.log(`  ${r.id} (${r.confidence.toFixed(2)}): ${r.localProblems.join('; ')}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
