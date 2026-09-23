/**
 * seedWarehouseUser.js
 * ─────────────────────────────────────────────────────────────
 * Seeds a warehouse test user in Firebase Auth + Firestore.
 *
 * Usage (from Backend directory):
 *   node seedWarehouseUser.js
 *
 * Prerequisites:
 *   - serviceAccountKey.json must exist in the Backend directory
 *   - npm install must have been run
 *
 * What it creates:
 *   1. Firebase Auth user  → warehouse@demo.com / Warehouse@123
 *   2. users/{uid}/godowns/mainGodown  → "Main Godown"
 *   3. Sample products with barcodes + barcodeIndex entries
 *   4. Initial stock in Main Godown
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ─── Init ──────────────────────────────────────────────────────────────────
const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('\n❌  serviceAccountKey.json not found in Backend/');
  console.error('    Download it from Firebase Console → Project Settings → Service Accounts\n');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

const db = admin.firestore();
const auth = admin.auth();

// ─── Config ────────────────────────────────────────────────────────────────
const DEMO_EMAIL    = 'wh.demo@technovanam.in';
const DEMO_PASSWORD = 'Warehouse@123';

// Optional: pass --adminUid=<uid> to link warehouse to an admin's product catalog
// e.g.  node seedWarehouseUser.js --adminUid=abc123xyz
const ADMIN_UID = (() => {
  const arg = process.argv.find(a => a.startsWith('--adminUid='));
  return arg ? arg.split('=')[1].trim() : null;
})();

const SAMPLE_PRODUCTS = [
  {
    barcode: '8901234567890',
    name: 'Aashirvaad Atta 5kg',
    brand: 'Aashirvaad',
    category: 'Flour & Grains',
    hsn: '1101',
    unit: 'Bag',
    price: '275',
    purchasePrice: '240',
    minStockLevel: '10',
    initialStock: 50,
  },
  {
    barcode: '8906007452001',
    name: 'Parle-G Biscuits 800g',
    brand: 'Parle',
    category: 'Biscuits & Snacks',
    hsn: '1905',
    unit: 'Pack',
    price: '45',
    purchasePrice: '38',
    minStockLevel: '20',
    initialStock: 120,
  },
  {
    barcode: '8901030869166',
    name: 'Surf Excel Easy Wash 1kg',
    brand: 'Surf Excel',
    category: 'Detergents',
    hsn: '3402',
    unit: 'Pack',
    price: '110',
    purchasePrice: '95',
    minStockLevel: '15',
    initialStock: 75,
  },
  {
    barcode: '8904187400018',
    name: 'Dairy Milk Silk 60g',
    brand: 'Cadbury',
    category: 'Chocolates',
    hsn: '1806',
    unit: 'Piece',
    price: '99',
    purchasePrice: '82',
    minStockLevel: '30',
    initialStock: 8,   // intentionally low → shows in low-stock alert
  },
  {
    barcode: '4902430723770',
    name: 'Colgate Strong Teeth 200g',
    brand: 'Colgate',
    category: 'Oral Care',
    hsn: '3306',
    unit: 'Tube',
    price: '78',
    purchasePrice: '65',
    minStockLevel: '25',
    initialStock: 0,   // out of stock → shows in OOS alert
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
async function getOrCreateUser() {
  try {
    const existing = await auth.getUserByEmail(DEMO_EMAIL);
    console.log(`ℹ️  User already exists: ${DEMO_EMAIL} (uid: ${existing.uid})`);
    return existing.uid;
  } catch {
    const user = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: 'Warehouse Demo User',
      emailVerified: true,
    });
    console.log(`✅  Created Auth user: ${DEMO_EMAIL} (uid: ${user.uid})`);
    return user.uid;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  Warehouse Seed Script');
  console.log('─'.repeat(50));

  const uid = await getOrCreateUser();

  // 1. Create Main Godown
  const godownRef = db.doc(`users/${uid}/godowns/mainGodown`);
  await godownRef.set({
    name: 'Main Godown',
    notes: 'Default warehouse godown — seeded by script',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✅  Godown: "Main Godown" created');

  // 1b. Store linkedAdminUid if provided
  if (ADMIN_UID) {
    await db.doc(`users/${uid}/settings/profile`).set({
      linkedAdminUid: ADMIN_UID,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`✅  Linked to admin UID: ${ADMIN_UID}`);
  } else {
    console.log('ℹ️  No --adminUid provided. Products will be read from warehouse user\'s own namespace.');
    console.log('   To link: node seedWarehouseUser.js --adminUid=<your-admin-uid>');
  }

  // 2. Seed products, barcodeIndex, and initial stock
  for (let i = 0; i < SAMPLE_PRODUCTS.length; i++) {
    const p = SAMPLE_PRODUCTS[i];
    const productId = `demo_product_${i + 1}`;
    const stockDocId = `${productId}_mainGodown`;

    // Product doc
    await db.doc(`users/${uid}/products/${productId}`).set({
      serialNumber: String(i + 1).padStart(2, '0'),
      name: p.name,
      barcode: p.barcode,
      brand: p.brand,
      category: p.category,
      hsn: p.hsn,
      unit: p.unit,
      price: p.price,
      purchasePrice: p.purchasePrice,
      minStockLevel: p.minStockLevel,
      description: '',
      sku: '',
      imageUrl: '',
      priceHistory: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Barcode index (barcode IS the doc ID)
    await db.doc(`users/${uid}/barcodeIndex/${p.barcode}`).set({
      productId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Stock in Main Godown
    await db.doc(`users/${uid}/stock/${stockDocId}`).set({
      productId,
      barcode: p.barcode,
      productName: p.name,
      godownId: 'mainGodown',
      godownName: 'Main Godown',
      quantity: p.initialStock,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Stock movement — opening stock
    if (p.initialStock > 0) {
      await db.collection(`users/${uid}/stockMovements`).add({
        productId,
        barcode: p.barcode,
        productName: p.name,
        godownId: 'mainGodown',
        godownName: 'Main Godown',
        quantity: p.initialStock,
        type: 'IN',
        userId: uid,
        userEmail: DEMO_EMAIL,
        referenceNo: 'SEED-001',
        remarks: 'Opening stock — seeded by script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const stockLabel = p.initialStock === 0 ? '⚠️  OUT OF STOCK' : `qty: ${p.initialStock}`;
    console.log(`✅  Product [${i + 1}/${SAMPLE_PRODUCTS.length}]: ${p.name} · barcode: ${p.barcode} · ${stockLabel}`);
  }

  console.log('\n' + '─'.repeat(50));
  console.log('🎉  Seed complete!\n');
  console.log('   Login credentials:');
  console.log(`     Email   : ${DEMO_EMAIL}`);
  console.log(`     Password: ${DEMO_PASSWORD}`);
  if (ADMIN_UID) {
    console.log(`     Linked admin UID: ${ADMIN_UID}`);
  }
  console.log('\n   Go to: http://localhost:5173/signin');
  console.log('   Then navigate to: /warehouse\n');
  console.log('\n   To link this warehouse user to an admin\'s products, run:');
  console.log('   node seedWarehouseUser.js --adminUid=<admin-firebase-uid>\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
