import { useState, useEffect } from "react";
import { collection, collectionGroup, doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase/config";

// Every hook shows only what is in Firestore. When a read fails the list is
// empty and `error` says why; there is no demo data to hide a failure.

// Helper to safely parse dates from Firestore timestamps
const parseDate = (val) => {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

const withPath = (d) => ({ id: d.id, path: d.ref.path, ...d.data() });

// Live list for a collection or collection-group query.
function useLiveList(makeQuery, mapDoc = withPath) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      makeQuery(),
      (snap) => {
        setItems(snap.docs.map(mapDoc));
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn("Super admin Firestore read failed:", err.message);
        setItems([]);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
    // makeQuery/mapDoc are module-level constants at every call site.
  }, []);

  return { items, loading, error };
}

// Live single document; `fallback` is used only while the doc does not exist yet.
function useLiveDoc(path, fallback) {
  const [value, setValue] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, ...path),
      (snap) => {
        setValue(snap.exists() ? { id: snap.id, ...snap.data() } : fallback);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn(`Super admin read of ${path.join("/")} failed:`, err.message);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { value, loading, error };
}

const toBusiness = (d) => {
  const data = d.data();
  return {
    id: d.id,
    name: data.companyName || "Unknown Business",
    ownerName: data.ownerName || "Unknown Owner",
    ownerEmail: data.email || data.ownerEmail || "N/A",
    phone: data.phone || "N/A",
    city: data.city || "Unknown City",
    planName: data.planName || "Free Trial",
    branchesCount: data.branchesCount || 1,
    usersCount: data.usersCount || 1,
    status: data.status || "Active",
    subscriptionExpiry: data.subscriptionExpiry || "",
    totalSales: data.totalSales || 0,
    gstin: data.gstin || "N/A",
    createdAt: parseDate(data.createdAt),
  };
};

export const usePlatformBusinesses = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "users"), toBusiness);
  return { businesses: items, loading, error };
};

export const usePlatformInvoices = () => {
  const { items, loading, error } = useLiveList(() => collectionGroup(db, "invoices"));
  return { invoices: items, loading, error };
};

export const usePlatformPayments = () => {
  const { items, loading, error } = useLiveList(() => collectionGroup(db, "payments"));
  return { payments: items, loading, error };
};

export const usePlatformCustomers = () => {
  const { items, loading, error } = useLiveList(() => collectionGroup(db, "customers"));
  return { customers: items, loading, error };
};

export const usePlatformCoupons = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "coupons"));
  return { coupons: items, loading, error };
};

// Platform Resources (Branches, Users)
export const usePlatformBranches = () => {
  const { items, loading, error } = useLiveList(() => collectionGroup(db, "branches"));
  return { branches: items, loading, error };
};

export const usePlatformBusinessUsers = () => {
  const { items, loading, error } = useLiveList(() => collectionGroup(db, "staff"));
  return { users: items, loading, error };
};

export const useAdminUsers = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "adminUsers"));
  return { adminUsers: items, loading, error };
};

export const useAdminRoles = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "adminRoles"));
  return { roles: items, loading, error };
};

export const useAuditLogs = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "auditLogs"));
  return { auditLogs: items, logs: items, loading, error };
};

export const useLoginActivity = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "loginActivity"));
  return { loginActivity: items, loading, error };
};

export const useActiveSessions = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "activeSessions"));
  return { activeSessions: items, loading, error };
};

export const useTickets = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "supportTickets"));
  return { tickets: items, loading, error };
};

export const useAnnouncements = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "announcements"));
  return { announcements: items, loading, error };
};

export const useSystemSettings = () => {
  const { value, loading, error } = useLiveDoc(["system", "settings"], {});
  return { settings: value, loading, error };
};

export const useMaintenanceMode = () => {
  const { value, loading, error } = useLiveDoc(["system", "maintenance"], { enabled: false });
  return { maintenance: value, loading, error };
};

export const useBackups = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "systemBackups"));
  return { backups: items, loading, error };
};

export const usePlatformAnalytics = () => {
  const { value, loading, error } = useLiveDoc(["analytics", "platform"], null);
  return { analytics: value, loading, error };
};

export const useSubscriptionPlans = () => {
  const { items, loading, error } = useLiveList(() => collection(db, "subscriptionPlans"));
  return { plans: items, loading, error };
};
