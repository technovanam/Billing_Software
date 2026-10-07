import { useState, useEffect, useCallback, useMemo, useContext } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase/config";
import { AuthContext } from "../context/AuthContext";
import { cacheKeyFor, readCache, writeCache } from "../lib/dataCache";
import { DATED_COLLECTIONS, lockViolation } from "../utils/yearEnd.js";

// Signed-in business owner's UID, or null when no real session exists.
// Never falls back to localStorage-guessed UIDs.
function useUserId() {
  const { user } = useContext(AuthContext);
  // The business whose books are open: your own, or one you work on as a team member.
  return user?.businessUid || user?.uid || null;
}

// Firestore doc snapshot -> plain object with id; convert Timestamps to string dates for UI consistency
function docToItem(d) {
  if (!d?.exists?.()) return null;
  const data = d.data();
  const converted = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === "function") {
      const dVal = v.toDate();
      if (["invoiceDate", "dueDate", "poDate", "dcDate", "challanDate", "expenseDate", "startOn", "endsOn", "nextRunDate", "lastRunDate", "voucherDate", "linkedDate", "supplierBillDate", "paidDate"].includes(k)) {
        const year = dVal.getFullYear();
        const month = String(dVal.getMonth() + 1).padStart(2, "0");
        const day = String(dVal.getDate()).padStart(2, "0");
        converted[k] = `${year}-${month}-${day}`;
      } else {
        converted[k] = dVal;
      }
    } else {
      converted[k] = v;
    }
  }
  return { id: d.id, ...converted };
}
function snapshotToItems(snapshot) {
  if (!snapshot?.docs) return [];
  return snapshot.docs.map((d) => docToItem(d)).filter(Boolean);
}

// ── Audit trail (edit log) ───────────────────────────────────────────────
// Every create / update / delete made through these hooks is appended to
// users/{uid}/auditTrail (append-only in Firestore rules), with who, when and
// the before/after values — the edit log required for company books since
// April 2023. Logging never blocks or fails the actual save.
const AUDIT_COLLECTION = "auditTrail";

function auditSafe(value) {
  if (value == null) return null;
  const json = JSON.stringify(value, (k, v) => {
    if (v && typeof v === "object" && typeof v.toDate === "function") return v.toDate().toISOString();
    if (v && typeof v === "object" && v._methodName) return "(server time)";
    if (v === undefined) return null;
    return v;
  });
  // Keep log entries small; very large documents keep their field names only.
  if (json.length > 200000) return { _truncated: true, fields: Object.keys(value) };
  return JSON.parse(json);
}

function auditSummary(data) {
  if (!data) return "";
  return String(data.invoiceNumber || data.voucherNumber || data.challanNumber || data.profileName || data.name || data.title || data.category || data.companyName || "").slice(0, 120);
}

async function writeAudit(uid, action, collectionName, docId, { before = null, after = null } = {}) {
  if (!uid || collectionName === AUDIT_COLLECTION) return;
  try {
    const actor = auth.currentUser;
    await addDoc(collection(db, "users", uid, AUDIT_COLLECTION), {
      at: serverTimestamp(),
      clientAt: new Date().toISOString(),
      by: actor?.uid || uid,
      byEmail: actor?.email || "",
      action,
      collection: collectionName,
      docId: String(docId || ""),
      summary: auditSummary(after || before),
      before: auditSafe(before),
      after: auditSafe(after),
    });
  } catch (err) {
    console.warn("Audit log entry skipped:", err.message || err);
  }
}

async function readForAudit(uid, collectionName, id) {
  try {
    const snap = await getDoc(doc(db, "users", uid, collectionName, id));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// Year-end lock (settings/booksLock.lockedUpTo): vouchers dated in a closed
// year can't be added, changed or deleted until the year is reopened.
const LOCK_DOC = "booksLock";
const lockCache = new Map();
async function lockedUpTo(uid) {
  const hit = lockCache.get(uid);
  if (hit && Date.now() - hit.at < 30000) return hit.value;
  let value = "";
  try {
    const snap = await getDoc(doc(db, "users", uid, "settings", LOCK_DOC));
    value = snap.exists() ? snap.data().lockedUpTo || "" : "";
  } catch {
    value = hit?.value || "";
  }
  lockCache.set(uid, { at: Date.now(), value });
  return value;
}
async function guardLock(uid, collectionName, change) {
  if (!DATED_COLLECTIONS.has(collectionName)) return;
  const why = lockViolation(await lockedUpTo(uid), collectionName, change);
  if (why) throw new Error(why);
}

async function addDocA(uid, collectionName, data) {
  await guardLock(uid, collectionName, { after: data });
  const ref = await addDoc(collection(db, "users", uid, collectionName), data);
  writeAudit(uid, "create", collectionName, ref.id, { after: data });
  return ref;
}

async function updateDocA(uid, collectionName, id, patch) {
  const before = await readForAudit(uid, collectionName, id);
  await guardLock(uid, collectionName, { before, patch });
  await updateDoc(doc(db, "users", uid, collectionName, id), patch);
  writeAudit(uid, "update", collectionName, id, { before, after: { ...(before || {}), ...patch } });
}

async function deleteDocA(uid, collectionName, id) {
  const before = await readForAudit(uid, collectionName, id);
  await guardLock(uid, collectionName, { before });
  await deleteDoc(doc(db, "users", uid, collectionName, id));
  writeAudit(uid, "delete", collectionName, id, { before });
}

async function setDocA(uid, collectionName, id, data) {
  const before = await readForAudit(uid, collectionName, id);
  await guardLock(uid, collectionName, { before, after: data });
  await setDoc(doc(db, "users", uid, collectionName, id), data);
  writeAudit(uid, before ? "update" : "create", collectionName, id, { before, after: data });
}

// Optional: convert date-like fields to Firestore Timestamp when writing (store as-is for simplicity)
function sanitizeForFirestore(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (typeof obj === "object" && obj.toDate) return obj; // already Timestamp
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v instanceof Date) out[k] = Timestamp.fromDate(v);
      else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && !isNaN(Date.parse(v))) out[k] = Timestamp.fromDate(new Date(v));
      else out[k] = sanitizeForFirestore(v);
    }
    return out;
  }
  return obj;
}

// Shared list view helper (filter/search/paginate basic)
const applyListView = (items, { search = "", page = 1, limit = 20, sortBy, sortDirection = "asc" }) => {
  let data = Array.isArray(items) ? [...items] : [];
  if (search) {
    const s = search.toLowerCase();
    data = data.filter((it) => JSON.stringify(it).toLowerCase().includes(s));
  }
  if (sortBy) {
    data.sort((a, b) => {
      let av = a?.[sortBy];
      let bv = b?.[sortBy];

      // Special handling for serialNumber - convert to number for proper sorting
      if (sortBy === 'serialNumber') {
        av = av ? parseInt(av, 10) : 0;
        bv = bv ? parseInt(bv, 10) : 0;
      }

      // Special handling for invoiceNumber - extract numeric part for proper sorting
      if (sortBy === 'invoiceNumber') {
        const matchA = av ? av.match(/(\d+)\/\d{4}-\d{2}$/) : null;
        const matchB = bv ? bv.match(/(\d+)\/\d{4}-\d{2}$/) : null;
        av = matchA ? parseInt(matchA[1], 10) : 0;
        bv = matchB ? parseInt(matchB[1], 10) : 0;
      }

      if (av === bv) return 0;
      if (av == null) return sortDirection === "asc" ? -1 : 1;
      if (bv == null) return sortDirection === "asc" ? 1 : -1;
      if (sortDirection === "asc") {
        return av > bv ? 1 : -1;
      }
      return av < bv ? 1 : -1;
    });
  }
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / (limit || 20)));
  const start = (Math.max(1, page) - 1) * (limit || 20);
  const end = start + (limit || 20);
  const pageData = data.slice(start, end);
  return {
    data: pageData,
    pagination: { total, page, limit, totalPages },
  };
};

// Financial Year Helper
const isInCurrentFY = (dateInput) => {
  if (!dateInput) return true;

  // Handle Firestore timestamp or string
  let date;
  if (dateInput && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      date = new Date(Number(y), Number(m) - 1, Number(d));
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('-');
      date = new Date(Number(y), Number(m) - 1, Number(d));
    } else {
      date = new Date(trimmed);
    }
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return true;

  // Dynamically compute the current financial year (April 1 – March 31)
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(fyYear, 3, 1, 0, 0, 0);
  const end = new Date(fyYear + 1, 2, 31, 23, 59, 59);

  return date >= start && date <= end;
};

// Dashboard (no DB). Keep minimal safe structure
export const useDashboard = () => {
  const [stats] = useState({});
  const refetch = useCallback(() => {}, []);
  return { stats, error: null, refetch };
};

// Live list of users/{uid}/{name}. Every hook instance sees writes made
// anywhere in the app (another page, the chat) without a reload. With
// { cache: true } the list is also kept in a per-user localStorage cache so it
// shows instantly on reload. An empty snapshot is a real answer and replaces
// the cache (e.g. after deleting the last item).
function useLiveCollection(name, { cache = false } = {}) {
  const uid = useUserId();
  const key = cache ? cacheKeyFor(name, uid) : null;
  const [all, setAll] = useState(() => readCache(key));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) {
      setAll([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = snapshotToItems(await getDocs(collection(db, "users", uid, name)));
      setAll(list);
      writeCache(key, list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, name, key]);

  useEffect(() => {
    // Account switched: drop whatever the previous account had on screen.
    setAll(readCache(key));
    if (!uid) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "users", uid, name),
      (snapshot) => {
        const list = snapshotToItems(snapshot);
        setAll(list);
        writeCache(key, list);
        setLoading(false);
      },
      (err) => {
        console.warn(`Real-time ${name} listener warning:`, err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid, name, key]);

  return { uid, all, setAll, loading, error, refetch };
}

// Customers — stored in users/{uid}/customers (separate "db" per user)
export const useCustomers = (options = {}) => {
  const { uid, all, setAll, loading, error, refetch } = useLiveCollection("customers", { cache: true });

  const { data, pagination } = applyListView(all, options);
  const [view, setView] = useState(data);
  const [pageInfo, setPageInfo] = useState(pagination);

  useEffect(() => {
    const res = applyListView(all, options);
    setView(res.data);
    setPageInfo(res.pagination);
  }, [all, options.search, options.page, options.limit, options.sortBy, options.sortDirection, options.status]);

  // Reports failure instead of pretending the customer was saved.
  const addCustomer = useCallback(
    async (payload) => {
      if (!uid) return { success: false, error: "You are signed out. Please sign in again." };
      const nextSerialNumber = String(all.length + 1).padStart(2, "0");
      try {
        const ref = await addDocA(uid, "customers", {
          serialNumber: nextSerialNumber,
          ...sanitizeForFirestore(payload),
          createdAt: serverTimestamp(),
        });
        return { success: true, id: ref.id };
      } catch (err) {
        console.error("addCustomer failed:", err);
        return { success: false, error: err.message };
      }
    },
    [uid, all.length]
  );

  const editCustomer = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      await updateDocA(uid, "customers", id, patch);
      setAll((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return { success: true };
    },
    [uid, setAll]
  );

  // Delete and renumber in one atomic batch, so a failure leaves nothing half done.
  const removeCustomer = useCallback(
    async (id) => {
      if (!uid) return { success: false };
      const renumbered = all
        .filter((c) => c.id !== id)
        .map((c, index) => ({ ...c, serialNumber: String(index + 1).padStart(2, "0") }));
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", uid, "customers", id));
      writeAudit(uid, "delete", "customers", id, { before: (all || []).find((c) => c.id === id) || null });
      renumbered.forEach((c) => {
        batch.update(doc(db, "users", uid, "customers", c.id), { serialNumber: c.serialNumber });
      });
      await batch.commit();
      setAll(renumbered);
      return { success: true };
    },
    [uid, all, setAll]
  );

  return { customers: view, allCustomers: all, loading, error, pagination: pageInfo, addCustomer, editCustomer, removeCustomer, refetch };
};

// Invoices — users/{uid}/invoices
export const useInvoices = (options = {}) => {
  const { uid, all, setAll, loading, error: invError, refetch } = useLiveCollection("invoices", { cache: true });

  const fyInvoices = useMemo(() => {
    return all.filter((inv) => isInCurrentFY(inv.invoiceDate || inv.createdAt));
  }, [all]);

  const filtered = useMemo(() => {
    let res = fyInvoices;
    if (options.status) {
      const status = options.status;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      res = res.filter((inv) => {
        const s = (inv.status || "").toLowerCase();
        const received = Number(inv.paidAmount || inv.received || 0);
        const total = Number(inv.total || inv.amount || 0);
        const tds = Number(inv.tdsAmount || 0);
        const isPartial = s === "partial" || (received > 0 && received + tds < total);

        if (status === "Paid") return s === "paid" || (received + tds >= total && total > 0);
        if (status === "Draft") return s === "draft";
        if (status === "Partial") return isPartial;
        if (status === "Overdue") {
          const dueDate = inv.dueDate ? (inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate)) : null;
          if (dueDate) dueDate.setHours(0, 0, 0, 0);
          return s !== "paid" && !isPartial && s !== "draft" && dueDate && today > dueDate;
        }
        if (status === "Unpaid") {
          const dueDate = inv.dueDate ? (inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate)) : null;
          if (dueDate) dueDate.setHours(0, 0, 0, 0);
          const isOverdue = dueDate && today > dueDate;
          return s !== "paid" && !isPartial && s !== "draft" && !isOverdue;
        }
        return s === status.toLowerCase();
      });
    }
    if (options.customerId) {
      res = res.filter((inv) => inv.clientId === options.customerId || (inv.client && inv.client.id === options.customerId));
    }
    return res;
  }, [fyInvoices, options.status, options.customerId]);

  const { data, pagination } = applyListView(filtered, options);
  const [view, setView] = useState(data);
  const [pageInfo, setPageInfo] = useState(pagination);

  useEffect(() => {
    const res = applyListView(filtered, options);
    setView(res.data);
    setPageInfo(res.pagination);
  }, [filtered, options.search, options.page, options.limit, options.sortBy, options.sortDirection]);

  const generateToken = () => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  // Never writes to a placeholder store; reports failure to the caller.
  const addInvoice = useCallback(
    async (payload) => {
      if (!uid) return { success: false, error: "You are signed out. Please sign in again." };
      const token = payload.paymentToken || generateToken();
      try {
        const ref = await addDocA(uid, "invoices", {
          ...sanitizeForFirestore({ ...payload, userId: uid, paymentToken: token }),
          createdAt: serverTimestamp(),
        });
        return { success: true, id: ref.id };
      } catch (err) {
        console.error("addInvoice failed:", err);
        return { success: false, error: err.message };
      }
    },
    [uid]
  );

  const editInvoice = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      const existing = all.find((i) => i.id === id);
      const token = patch.paymentToken || existing?.paymentToken || generateToken();
      const patchWithMeta = { ...patch, userId: uid, paymentToken: token };
      const data = sanitizeForFirestore(patchWithMeta);
      await updateDocA(uid, "invoices", id, data);
      setAll((prev) => prev.map((i) => (i.id === id ? { ...i, ...patchWithMeta } : i)));
      return { success: true };
    },
    [uid, all, setAll]
  );

  const removeInvoice = useCallback(
    async (id) => {
      if (!uid) return { success: false };
      await deleteDocA(uid, "invoices", id);
      setAll((prev) => prev.filter((i) => i.id !== id));
      return { success: true };
    },
    [uid, setAll]
  );

  return { invoices: view, allInvoices: all, loading, error: invError, pagination: pageInfo, addInvoice, editInvoice, removeInvoice, refetch };
};

// Delivery Challans — users/{uid}/deliveryChallans
export const useChallans = (options = {}) => {
  const uid = useUserId();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) {
      setAll([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "users", uid, "deliveryChallans"));
      setAll(snapshotToItems(snap));
    } catch (err) {
      setError(err.message);
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const fyChallans = useMemo(() => {
    return all.filter((dc) => isInCurrentFY(dc.challanDate || dc.createdAt));
  }, [all]);

  const filtered = useMemo(() => {
    let res = fyChallans;
    if (options.status) {
      res = res.filter((dc) => (dc.status || "").toLowerCase() === options.status.toLowerCase());
    }
    if (options.customerId) {
      res = res.filter((dc) => dc.clientId === options.customerId || (dc.client && dc.client.id === options.customerId));
    }
    return res;
  }, [fyChallans, options.status, options.customerId]);

  const { data, pagination } = applyListView(filtered, options);
  const [view, setView] = useState(data);
  const [pageInfo, setPageInfo] = useState(pagination);

  useEffect(() => {
    const res = applyListView(filtered, options);
    setView(res.data);
    setPageInfo(res.pagination);
  }, [filtered, options.search, options.page, options.limit, options.sortBy, options.sortDirection]);

  const addChallan = useCallback(
    async (payload) => {
      if (!uid) return { success: false };
      const data = sanitizeForFirestore(payload);
      const ref = await addDocA(uid, "deliveryChallans", { ...data, createdAt: serverTimestamp() });
      setAll((prev) => [{ id: ref.id, ...payload }, ...prev]);
      return { success: true, id: ref.id };
    },
    [uid]
  );

  const editChallan = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      const data = sanitizeForFirestore(patch);
      await updateDocA(uid, "deliveryChallans", id, data);
      setAll((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return { success: true };
    },
    [uid]
  );

  const removeChallan = useCallback(
    async (id) => {
      if (!uid) return { success: false };
      await deleteDocA(uid, "deliveryChallans", id);
      setAll((prev) => prev.filter((c) => c.id !== id));
      return { success: true };
    },
    [uid]
  );

  return { challans: view, allChallans: all, loading, error, pagination: pageInfo, addChallan, editChallan, removeChallan, refetch };
};

// Payments — users/{uid}/payments (live)
export const usePayments = (invoiceId) => {
  const { uid, all, refetch } = useLiveCollection("payments");
  const payments = useMemo(() => (invoiceId ? all.filter((p) => p.invoiceId === invoiceId) : all), [all, invoiceId]);

  const addPayment = useCallback(
    async (payload) => {
      if (!uid) return { success: false };
      const data = sanitizeForFirestore(payload);
      const ref = await addDocA(uid, "payments", { ...data, createdAt: serverTimestamp() });
      return { success: true, id: ref.id };
    },
    [uid]
  );

  return { payments, error: null, addPayment, refetch };
};

// Current financial year's payments (live).
export const useAllPayments = () => {
  const { all, refetch } = useLiveCollection("payments");
  const payments = useMemo(() => all.filter((p) => isInCurrentFY(p.paymentDate || p.createdAt)), [all]);
  return { payments, error: null, refetch };
};

// Expenses - users/{uid}/expenses (live)
// Current financial year only, unless { allYears: true } (the chatbot compares years).
export const useExpenses = (options = {}) => {
  const { uid, all, loading, error, refetch } = useLiveCollection("expenses");
  const expenses = useMemo(
    () => (options.allYears ? all : all.filter((expense) => isInCurrentFY(expense.expenseDate || expense.createdAt))),
    [all, options.allYears]
  );

  const addExpense = useCallback(async (payload) => {
    if (!uid) return { success: false };
    const data = sanitizeForFirestore(payload);
    const ref = await addDocA(uid, "expenses", { ...data, createdAt: serverTimestamp() });
    return { success: true, id: ref.id };
  }, [uid]);

  const editExpense = useCallback(async (id, patch) => {
    if (!uid) return { success: false };
    await updateDocA(uid, "expenses", id, sanitizeForFirestore(patch));
    return { success: true };
  }, [uid]);

  const removeExpense = useCallback(async (id) => {
    if (!uid) return { success: false };
    await deleteDocA(uid, "expenses", id);
    return { success: true };
  }, [uid]);

  return { expenses, loading, error, addExpense, editExpense, removeExpense, refetch };
};

// GST vouchers (credit notes, purchases, debit notes), journals and
// suppliers — users/{uid}/{collectionName}, live. See utils/vouchers.js.
// Patch a document in any of the user's collections (e.g. mark an order converted).
export const usePatchDoc = () => {
  const uid = useUserId();
  return useCallback(
    async (collectionName, id, patch) => {
      if (!uid || !collectionName || !id) return { success: false, error: "Nothing to update" };
      try {
        await updateDocA(uid, collectionName, id, { ...sanitizeForFirestore(patch), updatedAt: serverTimestamp() });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [uid]
  );
};

export const useVouchers = (collectionName) => {
  const { uid, all, loading, error, refetch } = useLiveCollection(collectionName);

  const addVoucher = useCallback(async (payload) => {
    if (!uid) return { success: false, error: "Not signed in" };
    try {
      const ref = await addDocA(uid, collectionName, {
        ...sanitizeForFirestore(payload),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, id: ref.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [uid, collectionName]);

  const editVoucher = useCallback(async (id, patch) => {
    if (!uid) return { success: false, error: "Not signed in" };
    try {
      await updateDocA(uid, collectionName, id, { ...sanitizeForFirestore(patch), updatedAt: serverTimestamp() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [uid, collectionName]);

  const removeVoucher = useCallback(async (id) => {
    if (!uid) return { success: false, error: "Not signed in" };
    try {
      await deleteDocA(uid, collectionName, id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [uid, collectionName]);

  return { vouchers: all, loading, error, addVoucher, editVoucher, removeVoucher, refetch };
};

// Everything the books (Day Book, ledgers, Trial Balance, P&L, Balance Sheet)
// and GST returns are built from — all years, live.
export const useBooksData = () => {
  const invoices = useLiveCollection("invoices");
  const payments = useLiveCollection("payments");
  const expenses = useLiveCollection("expenses");
  const creditNotes = useLiveCollection("creditNotes");
  const purchases = useLiveCollection("purchases");
  const debitNotes = useLiveCollection("debitNotes");
  const journals = useLiveCollection("journals");
  const customers = useLiveCollection("customers");
  const suppliers = useLiveCollection("suppliers");
  const products = useLiveCollection("products");
  const stockJournals = useLiveCollection("stockJournals");
  const payrollRuns = useLiveCollection("payrollRuns");
  const ledgers = useLiveCollection("ledgers");
  const advances = useLiveCollection("advanceReceipts");
  const parts = [ledgers, advances, invoices, payments, expenses, creditNotes, purchases, debitNotes, journals, customers, suppliers, products, stockJournals, payrollRuns];
  return {
    invoices: invoices.all,
    payments: payments.all,
    expenses: expenses.all,
    creditNotes: creditNotes.all,
    purchases: purchases.all,
    debitNotes: debitNotes.all,
    journals: journals.all,
    customers: customers.all,
    suppliers: suppliers.all,
    products: products.all,
    stockJournals: stockJournals.all,
    payrollRuns: payrollRuns.all,
    accounts: ledgers.all.filter((l) => l.kind === "account"),
    advances: advances.all,
    loading: parts.some((p) => p.loading),
  };
};

// Godowns (stock locations). "Main Location" always exists.
// Chart of accounts: ledger masters with group and opening balance
// (users/{uid}/ledgers, kind "account"). `moneyAccounts` are bank / cash ledgers.
export const useAccounts = () => {
  const { vouchers, addVoucher, editVoucher, removeVoucher, ...rest } = useVouchers("ledgers");
  const accounts = useMemo(() => vouchers.filter((v) => v.kind === "account").sort((a, b) => String(a.name).localeCompare(String(b.name))), [vouchers]);
  const moneyAccounts = useMemo(() => accounts.filter((a) => a.group === "Bank Accounts" || a.group === "Cash-in-Hand").map((a) => a.name), [accounts]);
  return { accounts, moneyAccounts, addAccount: (d) => addVoucher({ ...d, kind: "account" }), editAccount: editVoucher, removeAccount: removeVoucher, ...rest };
};

// Price lists (price levels): { name, discountPct, rates: { productId: rate } }.
export const usePriceLists = () => {
  const { vouchers, addVoucher, editVoucher, removeVoucher, ...rest } = useVouchers("priceLists");
  const priceLists = useMemo(() => [...vouchers].sort((a, b) => String(a.name).localeCompare(String(b.name))), [vouchers]);
  return { priceLists, addPriceList: addVoucher, editPriceList: editVoucher, removePriceList: removeVoucher, ...rest };
};

export const useGodowns = () => {
  const { vouchers, addVoucher, removeVoucher, ...rest } = useVouchers("godowns");
  const names = useMemo(() => ["Main Location", ...vouchers.map((g) => g.name).filter((x) => x && x !== "Main Location").sort((a, b) => a.localeCompare(b))], [vouchers]);
  return { godowns: vouchers, names, addGodown: addVoucher, removeGodown: removeVoucher, ...rest };
};

export const useCostCentres = () => {
  const { vouchers, addVoucher, removeVoucher, ...rest } = useVouchers("costCentres");
  const names = useMemo(() => vouchers.map((c) => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b)), [vouchers]);
  return { costCentres: vouchers, names, addCostCentre: addVoucher, removeCostCentre: removeVoucher, ...rest };
};

export const useSuppliers = () => {
  const { vouchers, addVoucher, editVoucher, removeVoucher, ...rest } = useVouchers("suppliers");
  return { suppliers: vouchers, addSupplier: addVoucher, editSupplier: editVoucher, removeSupplier: removeVoucher, ...rest };
};

// Recurring invoices - users/{uid}/recurringInvoices
export const useRecurringInvoices = () => {
  const uid = useUserId();
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) { setRecurringInvoices([]); setLoading(false); return; }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", uid, "recurringInvoices"));
      setRecurringInvoices(snapshotToItems(snap));
      setError(null);
    } catch (err) { setError(err.message); setRecurringInvoices([]); }
    finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { refetch(); }, [refetch]);

  const addRecurringInvoice = useCallback(async (payload) => {
    if (!uid) return { success: false };
    const data = sanitizeForFirestore(payload);
    const ref = await addDocA(uid, "recurringInvoices", { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setRecurringInvoices((prev) => [{ id: ref.id, ...payload }, ...prev]);
    return { success: true, id: ref.id };
  }, [uid]);

  const editRecurringInvoice = useCallback(async (id, patch) => {
    if (!uid) return { success: false };
    await updateDocA(uid, "recurringInvoices", id, { ...sanitizeForFirestore(patch), updatedAt: serverTimestamp() });
    setRecurringInvoices((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
    return { success: true };
  }, [uid]);

  const removeRecurringInvoice = useCallback(async (id) => {
    if (!uid) return { success: false };
    await deleteDocA(uid, "recurringInvoices", id);
    setRecurringInvoices((prev) => prev.filter((item) => item.id !== id));
    return { success: true };
  }, [uid]);

  return { recurringInvoices, loading, error, addRecurringInvoice, editRecurringInvoice, removeRecurringInvoice, refetch };
};

// Products — users/{uid}/products
// Products are deactivated, never deleted (old bills keep their names).
// isActive missing counts as active.
export const isProductActive = (p) => p?.isActive !== false;

// Pickers get active products only; pass { includeInactive: true } for the
// admin product list.
export const useProducts = (options = {}) => {
  const { uid, all: everything, setAll, loading, error: prodError, refetch } = useLiveCollection("products");
  const all = useMemo(
    () => (options.includeInactive ? everything : everything.filter(isProductActive)),
    [everything, options.includeInactive]
  );

  const { data, pagination } = applyListView(all, options);
  const [view, setView] = useState(data);
  const [pageInfo, setPageInfo] = useState(pagination);

  useEffect(() => {
    const res = applyListView(all, options);
    setView(res.data);
    setPageInfo(res.pagination);
  }, [all, options.search, options.page, options.limit, options.sortBy, options.sortDirection]);

  const addProduct = useCallback(
    async (payload) => {
      if (!uid) return { success: false };
      const nextSerialNumber = String(everything.length + 1).padStart(2, "0");
      const data = { serialNumber: nextSerialNumber, isActive: true, ...payload };
      const ref = await addDocA(uid, "products", data);
      return { success: true, id: ref.id };
    },
    [uid, everything.length]
  );

  const editProduct = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      await updateDocA(uid, "products", id, patch);
      setAll((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      return { success: true };
    },
    [uid, setAll]
  );

  // Deactivate / reactivate instead of deleting; serial numbers stay as they are.
  const setProductActive = useCallback(
    async (id, active) => {
      if (!uid) return { success: false };
      const patch = { isActive: Boolean(active), ...(active ? { reactivatedAt: new Date().toISOString() } : { deactivatedAt: new Date().toISOString() }) };
      await updateDocA(uid, "products", id, patch);
      setAll((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      return { success: true };
    },
    [uid, setAll]
  );
  const deactivateProduct = useCallback((id) => setProductActive(id, false), [setProductActive]);
  const reactivateProduct = useCallback((id) => setProductActive(id, true), [setProductActive]);

  return { products: view, allProducts: all, loading, error: prodError, pagination: pageInfo, addProduct, editProduct, deactivateProduct, reactivateProduct, refetch };
};

// Settings — single doc users/{uid}/settings/app
const SETTINGS_DOC_ID = "app";

// Year-end closing: { lockedUpTo, closedYears: [{ fy, closedAt, netProfit, closingStock }] }.
export const useBooksLock = () => {
  const uid = useUserId();
  const [lock, setLock] = useState({ lockedUpTo: "", closedYears: [] });
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      doc(db, "users", uid, "settings", LOCK_DOC),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const next = { lockedUpTo: data.lockedUpTo || "", closedYears: data.closedYears || [] };
        lockCache.set(uid, { at: Date.now(), value: next.lockedUpTo });
        setLock(next);
      },
      () => setLock({ lockedUpTo: "", closedYears: [] })
    );
  }, [uid]);
  const save = useCallback(
    async (next) => {
      if (!uid) return { success: false, error: "Not signed in" };
      try {
        await setDocA(uid, "settings", LOCK_DOC, next);
        lockCache.set(uid, { at: Date.now(), value: next.lockedUpTo || "" });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [uid]
  );
  return { lock, saveLock: save };
};

export const useSettings = () => {
  const uid = useUserId();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!uid) {
      setSettings({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", uid, "settings", SETTINGS_DOC_ID));
      setSettings(snap.exists() ? snap.data() : {});
    } catch {
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const updateSettings = useCallback(
    async (key, value, description) => {
      if (!uid) return { success: false };
      const next = { ...settings, [key]: { value, description } };
      await setDocA(uid, "settings", SETTINGS_DOC_ID, next);
      setSettings(next);
      return { success: true };
    },
    [uid, settings]
  );

  return { settings, error: null, updateSettings, refetch };
};

// Stock on hand — users/{uid}/stock (one doc per product per godown, written by
// the POS / warehouse app). Read-only here.
export const useStockLevels = () => {
  const { all, loading, error } = useLiveCollection("stock");
  return { stock: all, loading, error };
};
