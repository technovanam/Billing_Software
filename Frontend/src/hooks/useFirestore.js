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
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase/config";
import { AuthContext } from "../context/AuthContext";

// SECURITY: uid must only ever come from AuthContext (server-verified token). Never from URL, localStorage, or props.
function useUserId() {
  const { user } = useContext(AuthContext);
  return user?.uid ?? null;
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
      const snap = await getDocs(collection(db, "users", uid, "customers"));
      const list = snapshotToItems(snap);
      setAll(list);
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
      if (!uid) return { success: false };
      const nextSerialNumber = String(all.length + 1).padStart(2, "0");
      const data = { serialNumber: nextSerialNumber, ...payload };
      const ref = await addDoc(collection(db, "users", uid, "customers"), data);
      setAll((prev) => [...prev, { id: ref.id, ...data }]);
      return { success: true, id: ref.id };
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
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invError, setInvError] = useState(null);

  const refetch = useCallback(async () => {
    if (!uid) {
      setAll([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setInvError(null);
    try {
      const snap = await getDocs(collection(db, "users", uid, "invoices"));
      setAll(snapshotToItems(snap));
    } catch (err) {
      setInvError(err.message);
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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
        if (status === "Paid") return s === "paid";
        if (status === "Draft") return s === "draft";
        if (status === "Partial") return s === "partial";
        if (status === "Overdue") {
          const dueDate = inv.dueDate ? (inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate)) : null;
          if (dueDate) dueDate.setHours(0, 0, 0, 0);
          return s !== "paid" && s !== "partial" && s !== "draft" && dueDate && today > dueDate;
        }
        if (status === "Unpaid") {
          const dueDate = inv.dueDate ? (inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate)) : null;
          if (dueDate) dueDate.setHours(0, 0, 0, 0);
          const isOverdue = dueDate && today > dueDate;
          return s !== "paid" && s !== "partial" && s !== "draft" && !isOverdue;
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

  const addInvoice = useCallback(
    async (payload) => {
      if (!uid) return { success: false };
      const data = sanitizeForFirestore(payload);
      const ref = await addDoc(collection(db, "users", uid, "invoices"), { ...data, createdAt: serverTimestamp() });
      setAll((prev) => [{ id: ref.id, ...payload }, ...prev]);
      return { success: true, id: ref.id };
    },
    [uid]
  );

  const editInvoice = useCallback(
    async (id, patch) => {
      if (!uid) return { success: false };
      const data = sanitizeForFirestore(patch);
      await updateDoc(doc(db, "users", uid, "invoices", id), data);
      setAll((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      return { success: true };
    },
    [uid]
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
export const useProducts = (options = {}) => {
  const uid = useUserId();
  const [all, setAll] = useState([]);
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
      const nextSerialNumber = String(all.length + 1).padStart(2, "0");
      const data = { serialNumber: nextSerialNumber, ...payload };
      const ref = await addDoc(collection(db, "users", uid, "products"), data);
      setAll((prev) => [...prev, { id: ref.id, ...data }]);
      return { success: true, id: ref.id };
    },
    [uid, all.length]
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

  const removeProduct = useCallback(
    async (id) => {
      if (!uid) return { success: false };
      await deleteDoc(doc(db, "users", uid, "products", id));
      const filtered = all.filter((p) => p.id !== id);
      const renumbered = filtered.map((p, index) => ({
        ...p,
        serialNumber: String(index + 1).padStart(2, "0"),
      }));
      for (let i = 0; i < renumbered.length; i++) {
        await updateDoc(doc(db, "users", uid, "products", renumbered[i].id), {
          serialNumber: renumbered[i].serialNumber,
        });
      }
      setAll(renumbered);
      return { success: true };
    },
    [uid, all]
  );

  return { products: view, allProducts: all, loading, error: prodError, pagination: pageInfo, addProduct, editProduct, removeProduct, refetch };
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

