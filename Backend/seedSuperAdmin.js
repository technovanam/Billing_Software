const admin = require('firebase-admin');
const path = require('path');
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
}
const db = admin.firestore();
const auth = admin.auth();

async function seedSuperAdmin() {
  const email = "admin@technovanam.com";
  const password = process.env.SUPER_ADMIN_SEED_PASSWORD;
  if (!password) {
    throw new Error("Set SUPER_ADMIN_SEED_PASSWORD environment variable before running this seed script.");
  }
  let uid = "";

  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    await auth.updateUser(uid, { password });
    console.log(`Updated existing user password for ${email}`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const user = await auth.createUser({
        email,
        password,
        displayName: "Chief Platform Admin"
      });
      uid = user.uid;
      console.log(`Created new Firebase Auth user for ${email}`);
    } else {
      throw error;
    }
  }

  // Create adminUsers document
  await db.collection("adminUsers").doc(uid).set({
    email,
    name: "Chief Platform Admin",
    role: "Super Admin",
    permissions: ["all"],
    twoFactorEnabled: false
  });

  console.log("Successfully seeded Super Admin data in Firestore and Auth!");
  process.exit(0);
}

seedSuperAdmin().catch(console.error);
