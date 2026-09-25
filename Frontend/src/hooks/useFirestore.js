import { useState, useEffect, useCallback, useMemo, useContext } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase/config";
import { AuthContext } from "../context/AuthContext";
import { listCashierStatus, setCashierPin, setCashierActive, removeCashierAccess } from "../services/posService";

// Cashier PINs live only as hashes on the backend; never store them here.
const stripPins = (list) => (Array.isArray(list) ? list.map(({ pin, ...c }) => c) : []);

// Get store owner UID: from Firebase Auth user, or from cashier's businessUid token claim.
// Returns null when no real session exists. Never falls back to localStorage-guessed UIDs.
function useUserId() {
  const { user } = useContext(AuthContext);
  // Cashiers act on their business's data, not their own uid.
  if (user?.role === "cashier" && user.businessUid) return user.businessUid;
  if (user?.uid) return user.uid;

  // Cashier session written by posService.cashierLogin() — safe, tied to a real device token.
  try {
    const sessionStr = localStorage.getItem("pos_cashier_session");
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session?.ownerUid) return session.ownerUid;
    }
  } catch (err) {
    console.warn("useUserId cashier session read error:", err);
  }

  // No authenticated session — return null so callers guard correctly.
  return null;
}

// Firestore doc snapshot -> plain object with id; convert Timestamps to string dates for UI consistency
function docToItem(d) {
  if (!d?.exists?.()) return null;
  const data = d.data();
  const converted = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === "function") {
      const dVal = v.toDate();
      if (["invoiceDate", "dueDate", "poDate", "dcDate", "startOn", "endsOn", "nextRunDate", "lastRunDate"].includes(k)) {
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

// Customers — stored in users/{uid}/customers (separate "db" per user)
export const useCustomers = (options = {}) => {
  const uid = useUserId();
  // Live listeners need a real Firebase login; Firestore rules reject cached/fallback uids
  const isSignedIn = Boolean(useContext(AuthContext).user?.uid);
  const [all, setAll] = useState(() => {
    try {
      const cached = localStorage.getItem("store_customers_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "users", uid, "customers"));
      const list = snapshotToItems(snap);
      if (list.length > 0) {
        setAll(list);
        localStorage.setItem("store_customers_cache", JSON.stringify(list));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Real-time live synchronization for Customers
  useEffect(() => {
    // Listen for local custom customer update events
    const handleLocalUpdate = (e) => {
      try {
        const cached = localStorage.getItem("store_customers_cache");
        if (cached) {
          setAll(JSON.parse(cached));
        } else if (e.detail?.customer) {
          setAll((prev) => {
            if (prev.some((c) => c.id === e.detail.customer.id)) return prev;
            return [...prev, e.detail.customer];
          });
        }
      } catch (_) {}
    };
    window.addEventListener("store_customer_added", handleLocalUpdate);
    window.addEventListener("storage", handleLocalUpdate);

    if (!uid || !isSignedIn) {
      setLoading(false);
      return () => {
        window.removeEventListener("store_customer_added", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      };
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "users", uid, "customers"),
      (snapshot) => {
        const list = snapshotToItems(snapshot);
        if (list.length > 0) {
          setAll(list);
          localStorage.setItem("store_customers_cache", JSON.stringify(list));
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Real-time customers listener warning:", err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => {
      unsubscribe();
      window.removeEventListener("store_customer_added", handleLocalUpdate);
      window.removeEventListener("storage", handleLocalUpdate);
    };
  }, [uid, isSignedIn]);

  const { data, pagination } = applyListView(all, options);
  const [view, setView] = useState(data);
  const [pageInfo, setPageInfo] = useState(pagination);

  useEffect(() => {
    const res = applyListView(all, options);
    setView(res.data);
    setPageInfo(res.pagination);
  }, [all, options.search, options.page, options.limit, options.sortBy, options.sortDirection, options.status]);

  const addCustomer = useCallback(
    async (payload) => {
      const nextSerialNumber = String(all.length + 1).padStart(2, "0");
      const cleanPayload = sanitizeForFirestore(payload);
      const newCustObj = {
        id: `cust_${Date.now()}`,
        serialNumber: nextSerialNumber,
        ...payload,
        createdAt: new Date().toISOString(),
      };

      // Always update local cache & state first for immediate UI reactivity
      setAll((prev) => {
        const updated = [...prev, newCustObj];
        try {
          localStorage.setItem("store_customers_cache", JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });

      // Dispatch custom event across app
      window.dispatchEvent(
        new CustomEvent("store_customer_added", { detail: { customer: newCustObj } })
      );

      if (!uid) return { success: true, id: newCustObj.id };

      try {
        const data = {
          serialNumber: nextSerialNumber,
          ...cleanPayload,
          createdAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, "users", uid, "customers"), data);
        setAll((prev) =>
          prev.map((c) => (c.id === newCustObj.id ? { ...c, id: ref.id } : c))
        );
        return { success: true, id: ref.id };
      } catch (err) {
        console.warn("useFirestore addCustomer online error (cached locally):", err);
        return { success: true, id: newCustObj.id, offline: true };
      }
    },
    [uid, all.length]
  );

  const editCustomer = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      await updateDoc(doc(db, "users", uid, "customers", id), patch);
      setAll((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return { success: true };
    },
    [uid]
  );

  const removeCustomer = useCallback(
    async (id) => {
      if (!uid) return { success: false };
      await deleteDoc(doc(db, "users", uid, "customers", id));
      const filtered = all.filter((c) => c.id !== id);
      const renumbered = filtered.map((c, index) => ({
        ...c,
        serialNumber: String(index + 1).padStart(2, "0"),
      }));
      for (let i = 0; i < renumbered.length; i++) {
        await updateDoc(doc(db, "users", uid, "customers", renumbered[i].id), {
          serialNumber: renumbered[i].serialNumber,
        });
      }
      setAll(renumbered);
      return { success: true };
    },
    [uid, all]
  );

  return { customers: view, allCustomers: all, loading, error, pagination: pageInfo, addCustomer, editCustomer, removeCustomer, refetch };
};

// Invoices — users/{uid}/invoices
export const useInvoices = (options = {}) => {
  const uid = useUserId();
  // Live listeners need a real Firebase login; Firestore rules reject cached/fallback uids
  const authUser = useContext(AuthContext).user;
  const isSignedIn = Boolean(authUser?.uid);
  // Cashiers may read POS bills only (Firestore rules); query and cache accordingly.
  const isCashier = authUser?.role === "cashier";
  const cacheKey = isCashier ? "store_invoices_cache_pos" : "store_invoices_cache";
  const invoicesSource = (id) =>
    isCashier
      ? query(collection(db, "users", id, "invoices"), where("source", "==", "POS Counter Terminal"))
      : collection(db, "users", id, "invoices");
  const [all, setAll] = useState(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [invError, setInvError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setInvError(null);
    try {
      const snap = await getDocs(invoicesSource(uid));
      const list = snapshotToItems(snap);
      if (list.length > 0) {
        setAll(list);
        localStorage.setItem(cacheKey, JSON.stringify(list));
      }
    } catch (err) {
      setInvError(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Real-time live synchronization for Invoices
  useEffect(() => {
    const handleLocalInvUpdate = (e) => {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setAll(JSON.parse(cached));
        } else if (e.detail?.invoice) {
          setAll((prev) => {
            if (prev.some((i) => i.id === e.detail.invoice.id)) return prev;
            return [e.detail.invoice, ...prev];
          });
        }
      } catch (_) {}
    };
    window.addEventListener("store_invoice_added", handleLocalInvUpdate);
    window.addEventListener("storage", handleLocalInvUpdate);

    if (!uid || !isSignedIn) {
      setLoading(false);
      return () => {
        window.removeEventListener("store_invoice_added", handleLocalInvUpdate);
        window.removeEventListener("storage", handleLocalInvUpdate);
      };
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      invoicesSource(uid),
      (snapshot) => {
        const list = snapshotToItems(snapshot);
        if (list.length > 0) {
          setAll(list);
          localStorage.setItem(cacheKey, JSON.stringify(list));
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Real-time invoices listener warning:", err);
        setInvError(err.message);
        setLoading(false);
      }
    );
    return () => {
      unsubscribe();
      window.removeEventListener("store_invoice_added", handleLocalInvUpdate);
      window.removeEventListener("storage", handleLocalInvUpdate);
    };
  }, [uid, isSignedIn, isCashier]);

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

  const addInvoice = useCallback(
    async (payload) => {
      const targetUid = uid || "default_store";
      const token = payload.paymentToken || generateToken();
      const payloadWithMeta = { ...payload, userId: targetUid, paymentToken: token };
      const cleanPayload = sanitizeForFirestore(payloadWithMeta);
      const newInvObj = {
        id: `inv_${Date.now()}`,
        ...payloadWithMeta,
        createdAt: new Date().toISOString(),
      };

      // 1. Immediately update state and storage for instant reactivity
      setAll((prev) => {
        const updated = [newInvObj, ...prev];
        try {
          localStorage.setItem(cacheKey, JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });

      // 2. Dispatch event across app
      window.dispatchEvent(
        new CustomEvent("store_invoice_added", { detail: { invoice: newInvObj } })
      );

      // 3. Save to Firestore — throws on failure so the caller can queue it
      const data = {
        ...cleanPayload,
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "users", targetUid, "invoices"), data);
      setAll((prev) =>
        prev.map((i) => (i.id === newInvObj.id ? { ...i, id: ref.id } : i))
      );
      return { success: true, id: ref.id };
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
      await updateDoc(doc(db, "users", uid, "invoices", id), data);
      setAll((prev) => prev.map((i) => (i.id === id ? { ...i, ...patchWithMeta } : i)));
      return { success: true };
    },
    [uid, all]
  );

  const removeInvoice = useCallback(
    async (id) => {
      if (!uid) return { success: false };
      await deleteDoc(doc(db, "users", uid, "invoices", id));
      setAll((prev) => prev.filter((i) => i.id !== id));
      return { success: true };
    },
    [uid]
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
      const ref = await addDoc(collection(db, "users", uid, "deliveryChallans"), { ...data, createdAt: serverTimestamp() });
      setAll((prev) => [{ id: ref.id, ...payload }, ...prev]);
      return { success: true, id: ref.id };
    },
    [uid]
  );

  const editChallan = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      const data = sanitizeForFirestore(patch);
      await updateDoc(doc(db, "users", uid, "deliveryChallans", id), data);
      setAll((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return { success: true };
    },
    [uid]
  );

  const removeChallan = useCallback(
    async (id) => {
      if (!uid) return { success: false };
      await deleteDoc(doc(db, "users", uid, "deliveryChallans", id));
      setAll((prev) => prev.filter((c) => c.id !== id));
      return { success: true };
    },
    [uid]
  );

  return { challans: view, allChallans: all, loading, error, pagination: pageInfo, addChallan, editChallan, removeChallan, refetch };
};

// Payments — users/{uid}/payments
export const usePayments = (invoiceId) => {
  const uid = useUserId();
  const [all, setAll] = useState([]);
  const [payments, setPayments] = useState([]);

  const refetch = useCallback(async () => {
    if (!uid) {
      setAll([]);
      setPayments([]);
      return;
    }
    try {
      const snap = await getDocs(collection(db, "users", uid, "payments"));
      const list = snapshotToItems(snap);
      setAll(list);
      setPayments(invoiceId ? list.filter((p) => p.invoiceId === invoiceId) : list);
    } catch {
      setAll([]);
      setPayments([]);
    }
  }, [uid, invoiceId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addPayment = useCallback(
    async (payload) => {
      if (!uid) return { success: false };
      const data = sanitizeForFirestore(payload);
      const ref = await addDoc(collection(db, "users", uid, "payments"), { ...data, createdAt: serverTimestamp() });
      const item = { id: ref.id, ...payload };
      setAll((prev) => [item, ...prev]);
      if (!invoiceId || payload.invoiceId === invoiceId) setPayments((prev) => [item, ...prev]);
      return { success: true, id: ref.id };
    },
    [uid, invoiceId]
  );

  return { payments, error: null, addPayment, refetch };
};

export const useAllPayments = () => {
  const uid = useUserId();
  const [payments, setPayments] = useState([]);

  const refetch = useCallback(async () => {
    if (!uid) {
      setPayments([]);
      return;
    }
    try {
      const snap = await getDocs(collection(db, "users", uid, "payments"));
      const list = snapshotToItems(snap);
      setPayments(list.filter((p) => isInCurrentFY(p.paymentDate || p.createdAt)));
    } catch {
      setPayments([]);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { payments, error: null, refetch };
};

// Expenses - users/{uid}/expenses
export const useExpenses = () => {
  const uid = useUserId();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "users", uid, "expenses"));
      setExpenses(snapshotToItems(snap).filter((expense) => isInCurrentFY(expense.expenseDate || expense.createdAt)));
    } catch (err) {
      setError(err.message);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addExpense = useCallback(async (payload) => {
    if (!uid) return { success: false };
    const data = sanitizeForFirestore(payload);
    const ref = await addDoc(collection(db, "users", uid, "expenses"), { ...data, createdAt: serverTimestamp() });
    setExpenses((prev) => [{ id: ref.id, ...payload }, ...prev]);
    return { success: true, id: ref.id };
  }, [uid]);

  const editExpense = useCallback(async (id, patch) => {
    if (!uid) return { success: false };
    await updateDoc(doc(db, "users", uid, "expenses", id), sanitizeForFirestore(patch));
    setExpenses((prev) => prev.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)));
    return { success: true };
  }, [uid]);

  const removeExpense = useCallback(async (id) => {
    if (!uid) return { success: false };
    await deleteDoc(doc(db, "users", uid, "expenses", id));
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    return { success: true };
  }, [uid]);

  return { expenses, loading, error, addExpense, editExpense, removeExpense, refetch };
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
    const ref = await addDoc(collection(db, "users", uid, "recurringInvoices"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setRecurringInvoices((prev) => [{ id: ref.id, ...payload }, ...prev]);
    return { success: true, id: ref.id };
  }, [uid]);

  const editRecurringInvoice = useCallback(async (id, patch) => {
    if (!uid) return { success: false };
    await updateDoc(doc(db, "users", uid, "recurringInvoices", id), { ...sanitizeForFirestore(patch), updatedAt: serverTimestamp() });
    setRecurringInvoices((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
    return { success: true };
  }, [uid]);

  const removeRecurringInvoice = useCallback(async (id) => {
    if (!uid) return { success: false };
    await deleteDoc(doc(db, "users", uid, "recurringInvoices", id));
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
  const uid = useUserId();
  const [everything, setAll] = useState([]);
  const all = useMemo(
    () => (options.includeInactive ? everything : everything.filter(isProductActive)),
    [everything, options.includeInactive]
  );
  const [loading, setLoading] = useState(true);
  const [prodError, setProdError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) {
      setAll([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setProdError(null);
    try {
      const snap = await getDocs(collection(db, "users", uid, "products"));
      setAll(snapshotToItems(snap));
    } catch (err) {
      setProdError(err.message);
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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
      const ref = await addDoc(collection(db, "users", uid, "products"), data);
      setAll((prev) => [...prev, { id: ref.id, ...data }]);
      return { success: true, id: ref.id };
    },
    [uid, everything.length]
  );

  const editProduct = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      await updateDoc(doc(db, "users", uid, "products", id), patch);
      setAll((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      return { success: true };
    },
    [uid]
  );

  // Deactivate / reactivate instead of deleting; serial numbers stay as they are.
  const setProductActive = useCallback(
    async (id, active) => {
      if (!uid) return { success: false };
      const patch = { isActive: Boolean(active), ...(active ? { reactivatedAt: new Date().toISOString() } : { deactivatedAt: new Date().toISOString() }) };
      await updateDoc(doc(db, "users", uid, "products", id), patch);
      setAll((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      return { success: true };
    },
    [uid]
  );
  const deactivateProduct = useCallback((id) => setProductActive(id, false), [setProductActive]);
  const reactivateProduct = useCallback((id) => setProductActive(id, true), [setProductActive]);

  return { products: view, allProducts: all, loading, error: prodError, pagination: pageInfo, addProduct, editProduct, deactivateProduct, reactivateProduct, refetch };
};

// Settings — single doc users/{uid}/settings/app
const SETTINGS_DOC_ID = "app";

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
      await setDoc(doc(db, "users", uid, "settings", SETTINGS_DOC_ID), next);
      setSettings(next);
      return { success: true };
    },
    [uid, settings]
  );

  return { settings, error: null, updateSettings, refetch };
};

// Cashiers — stored inside users/{uid}/settings/app under 'cashiers' key (active in Firestore rules)
export const useCashiers = (options = {}) => {
  const uid = useUserId();
  const cashierAuthUser = useContext(AuthContext).user;
  const [pinStatus, setPinStatus] = useState({});
  const refreshPinStatus = useCallback(() => {
    if (cashierAuthUser?.role !== "owner" || !cashierAuthUser?.uid) return;
    listCashierStatus()
      .then((list) => setPinStatus(Object.fromEntries(list.map((c) => [c.cashierId, c]))))
      .catch((err) => console.warn("Cashier PIN status unavailable:", err.message));
  }, [cashierAuthUser?.role, cashierAuthUser?.uid]);
  useEffect(() => {
    refreshPinStatus();
  }, [refreshPinStatus]);
  const [all, setAll] = useState(() => {
    try {
      const local = uid ? localStorage.getItem(`store_cashiers_${uid}`) : null;
      if (local) return JSON.parse(local);
      const global = localStorage.getItem("registered_cashiers_list");
      if (global) return JSON.parse(global);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("store_cashiers_")) {
          const list = JSON.parse(localStorage.getItem(k) || "[]");
          if (Array.isArray(list) && list.length > 0) return list;
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [cashierError, setCashierError] = useState(null);

  const refetch = useCallback(async () => {
    const currentUid = uid || auth.currentUser?.uid;
    setLoading(true);
    setCashierError(null);
    try {
      if (currentUid) {
        const snap = await getDoc(doc(db, "users", currentUid, "settings", "app"));
        if (snap.exists()) {
          const appData = snap.data() || {};
          const raw = appData.cashiers?.value || appData.cashiers;
          const list = Array.isArray(raw) ? raw : [];
          setAll(list);
          localStorage.setItem(`store_cashiers_${currentUid}`, JSON.stringify(list));
          localStorage.setItem("registered_cashiers_list", JSON.stringify(list));
          setLoading(false);
          return;
        }
      }
      const local =
        (currentUid ? localStorage.getItem(`store_cashiers_${currentUid}`) : null) ||
        localStorage.getItem("registered_cashiers_list");
      if (local) {
        setAll(JSON.parse(local));
      } else {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("store_cashiers_")) {
            const list = JSON.parse(localStorage.getItem(k) || "[]");
            if (Array.isArray(list) && list.length > 0) {
              setAll(list);
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn("useCashiers load warning:", err);
      const local =
        (currentUid ? localStorage.getItem(`store_cashiers_${currentUid}`) : null) ||
        localStorage.getItem("registered_cashiers_list");
      if (local) setAll(JSON.parse(local));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const filtered = useMemo(() => {
    let res = Array.isArray(all) ? [...all] : [];
    if (options.status && options.status !== "All") {
      res = res.filter((c) => (c.status || "Active").toLowerCase() === options.status.toLowerCase());
    }
    return res;
  }, [all, options.status]);

  const { data, pagination } = applyListView(filtered, options);
  const [view, setView] = useState(data);
  const [pageInfo, setPageInfo] = useState(pagination);

  useEffect(() => {
    const res = applyListView(filtered, options);
    setView(res.data);
    setPageInfo(res.pagination);
  }, [filtered, options.search, options.page, options.limit, options.sortBy, options.sortDirection]);

  const persistCashiers = async (currentUid, items) => {
    const newItems = stripPins(items);
    localStorage.setItem(`store_cashiers_${currentUid}`, JSON.stringify(newItems));
    localStorage.setItem("registered_cashiers_list", JSON.stringify(newItems));
    setAll(newItems);
    try {
      const appRef = doc(db, "users", currentUid, "settings", "app");
      const snap = await getDoc(appRef);
      const currentData = snap.exists() ? snap.data() : {};
      const updated = {
        ...currentData,
        cashiers: {
          value: newItems,
          description: "Staff cashier terminals list",
          updatedAt: new Date().toISOString(),
        },
      };
      await setDoc(appRef, updated, { merge: true });
    } catch (err) {
      console.warn("Firestore save cashiers warning:", err);
    }
  };

  const addCashier = useCallback(
    async (payload) => {
      const currentUid = uid || auth.currentUser?.uid;
      if (!currentUid) {
        throw new Error("You must be signed in as store admin to add cashiers.");
      }
      const newId = `csh_${Date.now()}`;
      const nextSerialNumber = String(all.length + 1).padStart(2, "0");
      const newCashier = {
        id: newId,
        serialNumber: nextSerialNumber,
        cashierId: payload.cashierId || `CSH-${String(all.length + 1).padStart(3, "0")}`,
        name: payload.name || "Cashier Staff",
        phone: payload.phone || "",
        email: payload.email || "",
        counter: payload.counter || "Counter 01",
        status: payload.status || "Active",
        createdAt: new Date().toISOString(),
      };
      const newItems = [...all, newCashier];
      await persistCashiers(currentUid, newItems);
      // PIN goes to the backend (hashed there); no default PIN.
      if (payload.pin) await setCashierPin(newCashier.cashierId, payload.pin);
      if (newCashier.status === "Inactive") await setCashierActive(newCashier.cashierId, false);
      refreshPinStatus();
      return { success: true, id: newId };
    },
    [uid, all]
  );

  const editCashier = useCallback(
    async (id, patch) => {
      const currentUid = uid || auth.currentUser?.uid;
      if (!currentUid) throw new Error("Authentication required.");
      const { pin, ...rest } = patch || {};
      const before = all.find((c) => c.id === id);
      const newItems = all.map((c) => (c.id === id ? { ...c, ...rest } : c));
      await persistCashiers(currentUid, newItems);
      const cashierId = rest.cashierId || before?.cashierId;
      // PIN changes and deactivation also sign the cashier out (backend revokes).
      if (pin) await setCashierPin(cashierId, pin);
      if (before && rest.status && rest.status !== (before.status || "Active")) await setCashierActive(cashierId, rest.status !== "Inactive");
      refreshPinStatus();
      return { success: true };
    },
    [uid, all]
  );

  const removeCashier = useCallback(
    async (id) => {
      const currentUid = uid || auth.currentUser?.uid;
      if (!currentUid) throw new Error("Authentication required.");
      const target = all.find((c) => c.id === id);
      const newItems = all.filter((c) => c.id !== id);
      await persistCashiers(currentUid, newItems);
      if (target?.cashierId) await removeCashierAccess(target.cashierId).catch((err) => console.warn("Cashier access removal:", err.message));
      refreshPinStatus();
      return { success: true };
    },
    [uid, all]
  );

  const toggleStatus = useCallback(
    async (id) => {
      const currentUid = uid || auth.currentUser?.uid;
      if (!currentUid) throw new Error("Authentication required.");
      const target = all.find((c) => c.id === id);
      if (!target) return { success: false };
      const nextStatus = target.status === "Inactive" ? "Active" : "Inactive";
      const newItems = all.map((c) => (c.id === id ? { ...c, status: nextStatus } : c));
      await persistCashiers(currentUid, newItems);
      await setCashierActive(target.cashierId, nextStatus === "Active");
      refreshPinStatus();
      return { success: true, status: nextStatus };
    },
    [uid, all]
  );

  return {
    pinStatus,
    refreshPinStatus,
    cashiers: view,
    allCashiers: all,
    loading,
    error: cashierError,
    pagination: pageInfo,
    addCashier,
    editCashier,
    removeCashier,
    toggleStatus,
    refetch,
  };
};

