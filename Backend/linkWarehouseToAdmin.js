/**
 * linkWarehouseToAdmin.js
 * ──────────────────────────────────────────────────────────────────
 * One-shot script: finds the admin user by email and writes
 * linkedAdminUid into the warehouse user's settings/profile.
 *
 * Usage (from Backend directory):
 *   node linkWarehouseToAdmin.js --adminEmail=your@email.com
 *
 * Or with explicit UID:
 *   node linkWarehouseToAdmin.js --adminUid=abc123xyz
 *
 * Prerequisites:
 *   - serviceAccountKey.json must exist in the Backend directory
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('\n❌  serviceAccountKey.json not found in Backend/');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();
const auth = admin.auth();

const WH_EMAIL = 'wh.demo@technovanam.in';

async function run() {
  // Resolve admin UID
  let adminUid = null;

  const uidArg = process.argv.find(a => a.startsWith('--adminUid='));
  const emailArg = process.argv.find(a => a.startsWith('--adminEmail='));

  if (uidArg) {
    adminUid = uidArg.split('=')[1].trim();
    console.log(`ℹ️  Using admin UID directly: ${adminUid}`);
  } else if (emailArg) {
    const adminEmail = emailArg.split('=')[1].trim();
    const adminUser = await auth.getUserByEmail(adminEmail);
    adminUid = adminUser.uid;
    console.log(`✅  Resolved admin email "${adminEmail}" → UID: ${adminUid}`);
  } else {
    // Auto-detect: list all users and pick the non-warehouse one
    console.log('ℹ️  No --adminEmail or --adminUid provided.');
    console.log('   Attempting to auto-detect admin user...\n');
    const listResult = await auth.listUsers(100);
    const candidates = listResult.users.filter(
      u => u.email && !u.email.startsWith('wh.') && u.email !== WH_EMAIL
    );
    if (candidates.length === 0) {
      console.error('❌  No admin user found. Please provide --adminEmail=your@email.com');
      process.exit(1);
    }
    if (candidates.length === 1) {
      adminUid = candidates[0].uid;
      console.log(`✅  Auto-detected admin: ${candidates[0].email} → UID: ${adminUid}`);
    } else {
      console.log('   Multiple admin candidates found. Please specify one with --adminEmail=:');
      candidates.forEach(u => console.log(`     ${u.email}  (uid: ${u.uid})`));
      process.exit(1);
    }
  }

  // Get warehouse user UID
  const whUser = await auth.getUserByEmail(WH_EMAIL);
  const whUid = whUser.uid;
  console.log(`ℹ️  Warehouse user: ${WH_EMAIL} → UID: ${whUid}`);

  // Write linkedAdminUid
  await db.doc(`users/${whUid}/settings/profile`).set({
    linkedAdminUid: adminUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`\n✅  Done! Warehouse user is now linked to admin UID: ${adminUid}`);
  console.log('   The warehouse dashboard will now show ALL products from the admin catalog.');
  console.log('\n   Refresh the warehouse dashboard to see the changes.\n');

  process.exit(0);
}

run().catch(err => {
  console.error('\n❌  Failed:', err.message);
  process.exit(1);
});
