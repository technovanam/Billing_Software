import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, addDoc, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPBe8NvcAKWW9vvCvcdiWtmyQ2e0zkyiw",
  authDomain: "billing-software-19d79.firebaseapp.com",
  projectId: "billing-software-19d79",
  storageBucket: "billing-software-19d79.firebasestorage.app",
  messagingSenderId: "787511897342",
  appId: "1:787511897342:web:782860a6dbb945696d09af",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad"];
const PLANS = ["Free Trial", "Starter", "Professional", "Business", "Enterprise"];
const STATUSES = ["Active", "Trial", "Suspended"];

async function seed() {
  console.log("Starting seeding process...");
  
  for (let i = 1; i <= 15; i++) {
    const uid = `mock_tenant_${Date.now()}_${i}`;
    const status = getRandomItem(STATUSES);
    const planName = getRandomItem(PLANS);
    
    // Create Business
    await setDoc(doc(db, "users", uid), {
      companyName: `Global Tech Solutions ${i}`,
      ownerName: `Owner ${i}`,
      email: `owner${i}@example.com`,
      phone: `+91 98${randomInt(10000000, 99999999)}`,
      city: getRandomItem(CITIES),
      planName: planName,
      branchesCount: randomInt(1, 10),
      usersCount: randomInt(2, 50),
      status: status,
      subscriptionExpiry: new Date(Date.now() + randomInt(10, 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalSales: randomInt(50000, 5000000),
      gstin: `27AAAAA0000A1Z${i}`,
      createdAt: new Date()
    });

    console.log(`Created business: Global Tech Solutions ${i}`);

    // Create 10 Invoices
    for (let j = 1; j <= 10; j++) {
      await addDoc(collection(db, "users", uid, "invoices"), {
        invoiceNo: `INV-2026-${randomInt(1000, 9999)}`,
        customerName: `Customer ${randomInt(1, 100)}`,
        amount: randomInt(1000, 50000),
        total: randomInt(1000, 50000),
        status: getRandomItem(["Paid", "Unpaid", "Overdue"]),
        date: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000)
      });
    }

    // Create 10 Payments
    for (let k = 1; k <= 10; k++) {
      await addDoc(collection(db, "users", uid, "payments"), {
        businessName: `Global Tech Solutions ${i}`,
        invoiceNo: `INV-2026-${randomInt(1000, 9999)}`,
        amount: randomInt(1000, 20000),
        gateway: getRandomItem(["Razorpay", "Stripe", "Cash", "Bank Transfer"]),
        paymentMethod: getRandomItem(["Credit Card", "UPI", "Net Banking"]),
        transactionId: `TXN${Date.now()}${randomInt(1000, 9999)}`,
        status: getRandomItem(["Successful", "Failed", "Pending", "Refunded"]),
        date: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000)
      });
    }

    // Create 10 Customers
    for (let m = 1; m <= 10; m++) {
      await addDoc(collection(db, "users", uid, "customers"), {
        name: `Client Company ${m}`,
        email: `client${m}@example.com`,
        phone: `+91 90${randomInt(10000000, 99999999)}`,
        totalBilled: randomInt(10000, 100000),
        status: "Active"
      });
    }
  }

  console.log("Seeding completed successfully!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
