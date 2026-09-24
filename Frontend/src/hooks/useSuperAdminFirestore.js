import { useState, useEffect } from "react";
import { collection, collectionGroup, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase/config";

// Helper to safely parse dates from Firestore timestamps
const parseDate = (val) => {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

export const usePlatformBusinesses = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.companyName || "Unknown Business",
          ownerName: data.ownerName || "Unknown Owner",
          ownerEmail: data.email || data.ownerEmail || "N/A",
          phone: data.phone || "N/A",
          city: data.city || "Unknown City",
          planName: data.planName || "Free Trial",
          branchesCount: data.branchesCount || 1,
          usersCount: data.usersCount || 1,
          status: data.status || "Active",
          subscriptionExpiry: data.subscriptionExpiry || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
          totalSales: data.totalSales || 0,
          gstin: data.gstin || "N/A",
          createdAt: parseDate(data.createdAt)
        };
      });
      setBusinesses(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching businesses:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { businesses, loading };
};

export const usePlatformInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "invoices"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
      setInvoices(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching platform invoices:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { invoices, loading };
};

export const usePlatformPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "payments"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
      setPayments(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching platform payments:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { payments, loading };
};

export const usePlatformCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "customers"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
      setCustomers(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching platform customers:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { customers, loading };
};

export const usePlatformCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "coupons"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCoupons(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching coupons:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { coupons, loading };
};

// Platform Resources (Branches, Godowns, Terminals, Users)
export const usePlatformBranches = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "branches"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
      setBranches(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching branches:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { branches, loading };
};

export const usePlatformGodowns = () => {
  const [godowns, setGodowns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "godowns"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
      setGodowns(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching godowns:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { godowns, loading };
};

export const usePlatformTerminals = () => {
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "terminals"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
      setTerminals(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching terminals:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { terminals, loading };
};

export const usePlatformBusinessUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check both cashiers and general sub-users if needed, for now standard "cashiers" or "staff"
    const unsub = onSnapshot(collectionGroup(db, "cashiers"), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
      setUsers(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching business users:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { users, loading };
};

export const useAdminUsers = () => {
  const [adminUsers, setAdminUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'adminUsers'), (snap) => {
      setAdminUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { adminUsers, loading };
};

export const useAdminRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'adminRoles'), (snap) => {
      setRoles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { roles, loading };
};

export const useAuditLogs = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { auditLogs, loading };
};

export const useLoginActivity = () => {
  const [loginActivity, setLoginActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'loginActivity'), (snap) => {
      setLoginActivity(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { loginActivity, loading };
};

export const useActiveSessions = () => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'activeSessions'), (snap) => {
      setActiveSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { activeSessions, loading };
};



export const useTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'supportTickets'), (snap) => {
      setTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { tickets, loading };
};

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { announcements, loading };
};



export const useSystemSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ id: docSnap.id, ...docSnap.data() });
      } else {
        setSettings(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { settings, loading };
};

export const useMaintenanceMode = () => {
  const [maintenance, setMaintenance] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'maintenance'), (docSnap) => {
      if (docSnap.exists()) {
        setMaintenance({ id: docSnap.id, ...docSnap.data() });
      } else {
        setMaintenance(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { maintenance, loading };
};

export const useBackups = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'systemBackups'), (snap) => {
      setBackups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { backups, loading };
};

export const useSystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'health'), (docSnap) => {
      if (docSnap.exists()) {
        setHealth({ id: docSnap.id, ...docSnap.data() });
      } else {
        setHealth(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { health, loading };
};



export const usePlatformAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'analytics', 'platform'), (docSnap) => {
      if (docSnap.exists()) {
        setAnalytics({ id: docSnap.id, ...docSnap.data() });
      } else {
        setAnalytics(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { analytics, loading };
};



export const useSubscriptionPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subscriptionPlans'), (snap) => {
      setPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { plans, loading };
};
