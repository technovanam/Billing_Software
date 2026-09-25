// Calls the backend AI endpoints. The AI key never reaches the browser; every
// request carries the signed-in user's Firebase ID token.
import axios from "axios";
import { auth } from "../lib/firebase/config";

const BACKEND = "http://localhost:5000";

async function authHeaders() {
  // After a reload Firebase restores the session asynchronously; wait for it
  // so currentUser is not briefly null.
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to use the AI command bar.");
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

function toError(err) {
  const message = err?.response?.data?.error || err?.message || "AI request failed.";
  const wrapped = new Error(message);
  wrapped.status = err?.response?.status;
  return wrapped;
}

async function call(method, path, data) {
  try {
    const res = await axios({ method, url: `${BACKEND}${path}`, data, headers: await authHeaders(), timeout: 20000 });
    return res.data;
  } catch (err) {
    throw toError(err);
  }
}

export const parseCommand = ({ text, context, currentDraft, sessionId }) =>
  call("post", "/api/ai/parse-command", { text, context, currentDraft, sessionId });

export const saveProductAlias = ({ productId, alias, source, commandLogId, customerId }) =>
  call("post", "/api/ai/aliases", { productId, alias, source, commandLogId, customerId });

export const removeProductAlias = ({ productId, alias }) =>
  call("delete", "/api/ai/aliases", { productId, alias });

export const updateAiLogs = ({ context, logIds, corrections, finalInvoiceId, status, finalDraft }) =>
  call("post", "/api/ai/logs/update", { context, logIds, corrections, finalInvoiceId, status, finalDraft });
