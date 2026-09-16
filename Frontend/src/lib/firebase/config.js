import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

function validateFirebaseConfig() {
  const missing = requiredEnvVars.filter((key) => !import.meta.env[key]?.trim());
  if (missing.length > 0) {
    if (import.meta.env.PROD) {
      throw new Error(`Firebase config incomplete. Missing: ${missing.join(", ")}. Set in .env.`);
    }
    console.warn("[Firebase] Missing env (ok in dev):", missing.join(", "));
  }
}

validateFirebaseConfig();

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCPBe8NvcAKWW9vvCvcdiWtmyQ2e0zkyiw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "billing-software-19d79.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "billing-software-19d79",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "billing-software-19d79.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "787511897342",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:787511897342:web:782860a6dbb945696d09af",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Force session persistence safely without blocking module import
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.warn("Firebase persistence error (non-fatal):", error);
});

// Export auth, app, and db
export { auth, app, db, storage };
export default { auth, app, db, storage };


