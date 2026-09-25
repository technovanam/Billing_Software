/**
 * One-time migration: hashes cashier PINs stored in plain text in
 * users/{uid}/settings/app (cashiers.value[].pin) into users/{uid}/cashierSecrets
 * and removes the plain-text PINs. Safe to run again.
 *
 *   node scripts/migrate-cashier-pins.js                 # dry run: report only
 *   node scripts/migrate-cashier-pins.js --apply         # write changes
 *   node scripts/migrate-cashier-pins.js --apply --business=<uid>
 *
 * Cashiers with no PIN (or an invalid one) are listed; they cannot log in
 * until the owner sets a PIN in Cashier Management.
 */
require('dotenv').config({ quiet: true });
const admin = require('firebase-admin');
const { initFirebaseAdmin } = require('../firebaseAdmin');
const { businessCollections } = require('../ai/businessRef');
const { planPinMigration } = require('../pos/migratePins');
const { hashPin } = require('../pos/pins');

const apply = process.argv.includes('--apply');
const only = process.argv.find((a) => a.startsWith('--business='))?.split('=')[1];

async function main() {
  initFirebaseAdmin();
  const db = admin.firestore();
  console.log(apply ? 'Mode: APPLY (writing changes)\n' : 'Mode: dry run (pass --apply to write)\n');
  const businesses = only ? [only] : (await db.collection('users').listDocuments()).map((r) => r.id);
  const totals = { hashed: 0, alreadyHashed: 0, noPin: 0, invalidPin: 0, businessesCleaned: 0 };

  for (const businessUid of businesses) {
    const appRef = businessCollections.settings(businessUid, db).doc('app');
    const appSnap = await appRef.get();
    const data = appSnap.exists ? appSnap.data() : null;
    const list = data?.cashiers?.value || (Array.isArray(data?.cashiers) ? data.cashiers : null);
    if (!Array.isArray(list) || !list.length) continue;

    const secretsCol = businessCollections.cashierSecrets(businessUid, db);
    const secretSnaps = await secretsCol.get();
    const secrets = Object.fromEntries(secretSnaps.docs.map((d) => [d.id, d.data()]));
    const plan = planPinMigration(list, secrets);

    totals.hashed += plan.toHash.length;
    totals.alreadyHashed += plan.alreadyHashed.length;
    totals.noPin += plan.noPin.length;
    totals.invalidPin += plan.invalidPin.length;
    console.log(
      `${businessUid}: hash ${plan.toHash.length}, already hashed ${plan.alreadyHashed.length}` +
        (plan.noPin.length ? `, NO PIN: ${plan.noPin.join(', ')}` : '') +
        (plan.invalidPin.length ? `, INVALID PIN (not 4 digits): ${plan.invalidPin.join(', ')}` : '')
    );

    if (!apply) continue;
    for (const { cashierId, pin } of plan.toHash) {
      await secretsCol.doc(cashierId).set({ pinHash: await hashPin(pin), pinSetAt: new Date().toISOString(), migrated: true }, { merge: true });
    }
    if (plan.listHasPins) {
      const cashiers = data?.cashiers?.value ? { ...data.cashiers, value: plan.cleanedList, updatedAt: new Date().toISOString() } : plan.cleanedList;
      await appRef.set({ cashiers }, { merge: true });
      totals.businessesCleaned += 1;
    }
  }

  console.log('\nTotals');
  console.table(totals);
  console.log(apply ? 'Done. Plain-text PINs removed where hashed.' : 'Dry run only. Re-run with --apply to write.');
  if (totals.noPin || totals.invalidPin) console.log('Cashiers without a valid PIN cannot log in until the owner sets one in Cashier Management.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
