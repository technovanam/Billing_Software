// Calls the backend super admin endpoints (admin accounts, refunds, backups,
// health). Each request carries the signed-in admin's Firebase ID token.
import axios from "axios";
import { auth } from "../lib/firebase/config";

import { BACKEND_URL } from "../lib/backend";

const BACKEND = BACKEND_URL;

async function call(method, path, data, timeout = 30000) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  try {
    const res = await axios({
      method,
      url: `${BACKEND}/api/super-admin${path}`,
      data,
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      timeout,
    });
    return res.data;
  } catch (err) {
    const message = err?.response?.data?.error
      || (err?.code === "ERR_NETWORK" ? "Cannot reach the backend server. Is it running on port 5000?" : err?.message);
    throw new Error(message || "Request failed.");
  }
}

export const createAdminUser = (payload) => call("post", "/admin-users", payload);
export const refundPayment = (paymentPath, reason) => call("post", "/refunds", { paymentPath, reason });
export const createBackup = () => call("post", "/backups", {}, 10 * 60 * 1000);
export const getBackupDownloadUrl = (id) => call("get", `/backups/${encodeURIComponent(id)}/download`);
export const fetchHealth = () => call("get", "/health");
