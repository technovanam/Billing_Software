/**
 * One-time backfill: adds productId to existing invoice and POS bill lines
 * whose name matches exactly one product. Safe to run again (lines that
 * already have a valid productId are left alone).
 *
 *   node scripts/backfill-product-ids.js --dry-run              # report only (default)
 *   node scripts/backfill-product-ids.js --apply                # write changes
 *   node scripts/backfill-product-ids.js --apply --business=<uid>
 */
require('dotenv').config();
const path = require('path');
const admin = require('firebase-admin');
const { businessCollections } = require('../ai/businessRef');
const { planBackfill } = require('../ai/maintenance/backfillProductIds');

const apply = process.argv.includes('--apply');
const business = process.argv.find((a) => a.startsWith('--business='))?.split('=')[1];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '..', 'serviceAccountKey.json'))) });
}

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

async function main() {
  console.log(apply ? 'Mode: APPLY (writing changes)\n' : 'Mode: dry run (no changes written; pass --apply to write)\n');
  const businesses = business ? [business] : (await admin.firestore().collection('users').listDocuments()).map((r) => r.id);
  const totals = { invoicesScanned: 0, invoicesToUpdate: 0, linesMatched: 0, linesAlreadyLinked: 0, skippedNoName: 0, skippedNoMatch: 0, skippedAmbiguous: 0 };

  for (const businessId of businesses) {
    const [products, invoices] = await Promise.all([businessCollections.products(businessId).get(), businessCollections.invoices(businessId).get()]);
    if (invoices.empty) continue;
    const { updates, counts } = planBackfill({ invoices: docsOf(invoices), products: docsOf(products) });
    for (const k of Object.keys(totals)) totals[k] += counts[k];
    console.log(`${businessId}: ${counts.linesMatched} lines matched in ${counts.invoicesToUpdate} bills; skipped ${counts.skippedNoMatch} no match, ${counts.skippedAmbiguous} ambiguous, ${counts.skippedNoName} no name; ${counts.linesAlreadyLinked} already linked`);

    if (apply && updates.length) {
      const col = businessCollections.invoices(businessId);
      for (let i = 0; i < updates.length; i += 400) {
        const batch = admin.firestore().batch();
        for (const u of updates.slice(i, i + 400)) batch.update(col.doc(u.id), { [u.field]: u.lines });
        await batch.commit();
      }
    }
  }

  console.log('\nTotals');
  console.table(totals);
  console.log(apply ? 'Changes written.' : 'Dry run only. Re-run with --apply to write these changes.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
