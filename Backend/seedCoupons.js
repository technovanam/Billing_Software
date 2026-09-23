const admin = require('firebase-admin');
const path = require('path');
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
}
const db = admin.firestore();

const coupons = [
  {
    code: "WELCOME50",
    discountPercentage: 50,
    fixedDiscount: 0,
    maxDiscount: 2000,
    usageLimit: 500,
    usedCount: 142,
    expiry: "2026-12-31",
    applicablePlans: ["plan_professional", "plan_business", "plan_enterprise"],
    status: "Active",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    code: "START1000",
    discountPercentage: 0,
    fixedDiscount: 1000,
    maxDiscount: 1000,
    usageLimit: 100,
    usedCount: 98,
    expiry: "2026-10-31",
    applicablePlans: ["plan_starter", "plan_professional"],
    status: "Active",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    code: "DIWALI2026",
    discountPercentage: 30,
    fixedDiscount: 0,
    maxDiscount: 5000,
    usageLimit: 1000,
    usedCount: 0,
    expiry: "2026-11-15",
    applicablePlans: ["plan_business", "plan_enterprise"],
    status: "Active",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    code: "EARLYBIRD",
    discountPercentage: 20,
    fixedDiscount: 0,
    maxDiscount: 1500,
    usageLimit: 50,
    usedCount: 50,
    expiry: "2026-06-30",
    applicablePlans: ["plan_starter"],
    status: "Expired",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function seed() {
  console.log("Seeding coupons via Admin SDK...");
  
  for (const c of coupons) {
    await db.collection("coupons").add(c);
    console.log(`Created coupon: ${c.code}`);
  }

  console.log("Coupons seeding completed successfully!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
