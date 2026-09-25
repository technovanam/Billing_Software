/**
 * seedPortalLogins.js
 * Creates (or resets) one demo login for every portal so the app can be tested end to end.
 * Safe to re-run: existing accounts get their password reset, nothing is duplicated.
 *
 *   node seedPortalLogins.js
 *
 * Requires Backend/serviceAccountKey.json and the DEMO_* passwords in Backend/.env
 * (see .env.example). Passwords are never stored in this repository.
 */
require('dotenv').config({ quiet: true });
const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
}
const db = admin.firestore();
const auth = admin.auth();

const REQUIRED = ['DEMO_SUPER_ADMIN_PASSWORD', 'DEMO_OWNER_PASSWORD', 'DEMO_WAREHOUSE_PASSWORD', 'DEMO_CASHIER1_PIN', 'DEMO_CASHIER2_PIN'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Set these in Backend/.env first: ${missing.join(', ')}`);
  process.exit(1);
}

const SUPER_ADMIN = { email: 'admin@technovanam.com', password: process.env.DEMO_SUPER_ADMIN_PASSWORD, name: 'Chief Platform Admin' };
const OWNER = { email: 'owner.demo@technovanam.in', password: process.env.DEMO_OWNER_PASSWORD, name: 'Demo Store Owner', company: 'Demo Retail Store' };
const WAREHOUSE = { email: 'wh.demo@technovanam.in', password: process.env.DEMO_WAREHOUSE_PASSWORD, name: 'Demo Warehouse Operator' };
const CASHIERS = [
  { cashierId: 'CSH-001', name: 'Demo Cashier One', email: 'cashier1.demo@technovanam.in', phone: '9000000001', pin: process.env.DEMO_CASHIER1_PIN, counter: 'Counter 01' },
  { cashierId: 'CSH-002', name: 'Demo Cashier Two', email: 'cashier2.demo@technovanam.in', phone: '9000000002', pin: process.env.DEMO_CASHIER2_PIN, counter: 'Counter 02' },
];

// Create the Firebase Auth user, or reset the password if it already exists
async function upsertAuthUser({ email, password, name }) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName: name, emailVerified: true, disabled: false });
    console.log(`  updated  ${email}`);
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({ email, password, displayName: name, emailVerified: true });
    console.log(`  created  ${email}`);
    return created.uid;
  }
}

async function main() {
  const now = new Date().toISOString();

  console.log('Super Admin');
  const superUid = await upsertAuthUser(SUPER_ADMIN);
  await db.collection('adminUsers').doc(superUid).set({
    email: SUPER_ADMIN.email,
    name: SUPER_ADMIN.name,
    role: 'Super Admin',
    permissions: ['all'],
    twoFactorEnabled: false,
  }, { merge: true });

  console.log('Business Owner');
  const ownerUid = await upsertAuthUser(OWNER);
  await db.doc(`users/${ownerUid}`).set({
    companyName: OWNER.company,
    ownerName: OWNER.name,
    email: OWNER.email,
    phone: '9000000000',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    status: 'Active',
    planName: 'Professional',
    createdAt: now,
  }, { merge: true });

  console.log('Warehouse');
  const whUid = await upsertAuthUser(WAREHOUSE);
  await db.doc(`users/${whUid}/settings/profile`).set({
    companyName: `${OWNER.company} - Warehouse`,
    ownerName: WAREHOUSE.name,
    email: WAREHOUSE.email,
    linkedAdminUid: ownerUid,
    updatedAt: now,
  }, { merge: true });

  console.log('POS Cashiers');
  const cashiers = CASHIERS.map((c) => ({ ...c, status: 'Active', ownerUid, createdAt: now }));
  await db.doc(`users/${ownerUid}/settings/app`).set({
    cashiers: { value: cashiers, description: 'Staff cashier terminals list', updatedAt: now },
  }, { merge: true });
  cashiers.forEach((c) => console.log(`  saved    ${c.cashierId}`));

  console.log('\nDone. Logins (passwords are the DEMO_* values in Backend/.env):');
  console.table([
    { portal: 'Super Admin', login: SUPER_ADMIN.email, password: 'DEMO_SUPER_ADMIN_PASSWORD' },
    { portal: 'Business Owner', login: OWNER.email, password: 'DEMO_OWNER_PASSWORD' },
    { portal: 'Warehouse', login: WAREHOUSE.email, password: 'DEMO_WAREHOUSE_PASSWORD' },
    ...CASHIERS.map((c, i) => ({ portal: 'POS Cashier', login: c.cashierId, password: `DEMO_CASHIER${i + 1}_PIN` })),
  ]);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
