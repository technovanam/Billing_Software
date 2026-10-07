// JSON headers carrying the signed-in user's Firebase ID token, for backend
// routes that require a login (e.g. /generate-pdf).
import { auth } from "./firebase/config";

export async function authJsonHeaders() {
  await auth.authStateReady();
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
