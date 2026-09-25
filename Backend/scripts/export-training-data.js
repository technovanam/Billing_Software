/**
 * Exports confirmed AI commands from aiLogs as JSONL for fine-tuning.
 * Each line: { input, context, draft_items, output } with customer names
 * replaced by <CUSTOMER> and phone numbers / GSTINs removed.
 *
 *   node scripts/export-training-data.js                      # all businesses
 *   node scripts/export-training-data.js --business=<uid>     # one business
 *   node scripts/export-training-data.js --since=2026-09-01 --out=exports/sep.jsonl
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { businessCollections } = require('../ai/businessRef');
const { buildTrainingExamples } = require('../ai/training/exportTraining');

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '..', 'serviceAccountKey.json'))) });
}

async function main() {
  const since = arg('since') ? admin.firestore.Timestamp.fromDate(new Date(arg('since'))) : null;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const out = path.resolve(arg('out') || path.join(__dirname, '..', 'exports', `training-${stamp}.jsonl`));
  const businesses = arg('business') ? [arg('business')] : (await admin.firestore().collection('users').listDocuments()).map((r) => r.id);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const stream = fs.createWriteStream(out);
  let total = 0;
  for (const businessId of businesses) {
    let q = businessCollections.aiLogs(businessId).where('type', '==', 'command');
    if (since) q = q.where('createdAt', '>=', since);
    const snap = await q.get();
    if (snap.empty) continue;
    const examples = buildTrainingExamples(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    for (const ex of examples) stream.write(`${JSON.stringify(ex)}\n`);
    total += examples.length;
    if (examples.length) console.log(`${businessId}: ${examples.length} examples`);
  }
  await new Promise((resolve) => stream.end(resolve));
  console.log(`\nWrote ${total} examples to ${out}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
