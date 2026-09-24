import { useState, useEffect } from "react";
import { collection, collectionGroup, doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase/config";
import { superAdminService } from "../services/superAdminDataService";

// Helper to safely parse dates from Firestore timestamps
const parseDate = (val) => {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

export const usePlatformBusinesses = () => {
  const [businesses, setBusinesses] = useState(() => superAdminService?.getBusinesses?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, "users"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
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
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching businesses, using fallback dataset:", error.message);
        setBusinesses(superAdminService?.getBusinesses?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      console.warn("Exception in usePlatformBusinesses:", e);
      setLoading(false);
    }
  }, []);

  return { businesses, loading };
};

export const usePlatformInvoices = () => {
  const [invoices, setInvoices] = useState(() => superAdminService?.getInvoices?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collectionGroup(db, "invoices"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
          setInvoices(list);
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching platform invoices, using fallback dataset:", error.message);
        setInvoices(superAdminService?.getInvoices?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { invoices, loading };
};

export const usePlatformPayments = () => {
  const [payments, setPayments] = useState(() => superAdminService?.getPayments?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collectionGroup(db, "payments"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
          setPayments(list);
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching platform payments, using fallback dataset:", error.message);
        setPayments(superAdminService?.getPayments?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { payments, loading };
};

export const usePlatformCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collectionGroup(db, "customers"), (snap) => {
        if (!mounted) return;
        const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
        setCustomers(list);
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching platform customers:", error.message);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { customers, loading };
};

export const usePlatformCoupons = () => {
  const [coupons, setCoupons] = useState(() => superAdminService?.getCoupons?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, "coupons"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCoupons(list);
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching coupons, using fallback dataset:", error.message);
        setCoupons(superAdminService?.getCoupons?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { coupons, loading };
};

// Platform Resources (Branches, Godowns, Terminals, Users)
export const usePlatformBranches = () => {
  const [branches, setBranches] = useState(() => superAdminService?.getBranches?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collectionGroup(db, "branches"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
          setBranches(list);
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching branches, using fallback dataset:", error.message);
        setBranches(superAdminService?.getBranches?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { branches, loading };
};

export const usePlatformGodowns = () => {
  const [godowns, setGodowns] = useState(() => superAdminService?.getGodowns?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collectionGroup(db, "godowns"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
          setGodowns(list);
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching godowns, using fallback dataset:", error.message);
        setGodowns(superAdminService?.getGodowns?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { godowns, loading };
};

export const usePlatformTerminals = () => {
  const [terminals, setTerminals] = useState(() => superAdminService?.getTerminals?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collectionGroup(db, "terminals"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
          setTerminals(list);
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching terminals, using fallback dataset:", error.message);
        setTerminals(superAdminService?.getTerminals?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { terminals, loading };
};

export const usePlatformBusinessUsers = () => {
  const [users, setUsers] = useState(() => superAdminService?.getUsers?.() || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collectionGroup(db, "cashiers"), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
          setUsers(list);
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching business users, using fallback dataset:", error.message);
        setUsers(superAdminService?.getUsers?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return { users, loading };
};

export const useAdminUsers = () => {
  const [adminUsers, setAdminUsers] = useState(() => superAdminService?.getAdminUsers?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'adminUsers'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setAdminUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching adminUsers, using fallback:", error.message);
        setAdminUsers(superAdminService?.getAdminUsers?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { adminUsers, loading };
};

export const useAdminRoles = () => {
  const [roles, setRoles] = useState(() => superAdminService?.getRoles?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'adminRoles'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setRoles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching adminRoles, using fallback:", error.message);
        setRoles(superAdminService?.getRoles?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { roles, loading };
};

export const useAuditLogs = () => {
  const [auditLogs, setAuditLogs] = useState(() => superAdminService?.getAuditLogs?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'auditLogs'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching auditLogs, using fallback:", error.message);
        setAuditLogs(superAdminService?.getAuditLogs?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { auditLogs, logs: auditLogs, loading };
};

export const useLoginActivity = () => {
  const [loginActivity, setLoginActivity] = useState(() => superAdminService?.getLoginActivity?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'loginActivity'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setLoginActivity(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching loginActivity, using fallback:", error.message);
        setLoginActivity(superAdminService?.getLoginActivity?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { loginActivity, loading };
};

export const useActiveSessions = () => {
  const [activeSessions, setActiveSessions] = useState(() => superAdminService?.getSessions?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'activeSessions'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setActiveSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching activeSessions, using fallback:", error.message);
        setActiveSessions(superAdminService?.getSessions?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { activeSessions, loading };
};

export const useTickets = () => {
  const [tickets, setTickets] = useState(() => superAdminService?.getTickets?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'supportTickets'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching supportTickets, using fallback:", error.message);
        setTickets(superAdminService?.getTickets?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { tickets, loading };
};

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState(() => superAdminService?.getAnnouncements?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching announcements, using fallback:", error.message);
        setAnnouncements(superAdminService?.getAnnouncements?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { announcements, loading };
};

export const useSystemSettings = () => {
  const [settings, setSettings] = useState(() => superAdminService?.getSettings?.() || {});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
        if (!mounted) return;
        if (docSnap.exists()) {
          setSettings({ id: docSnap.id, ...docSnap.data() });
        } else {
          setSettings(superAdminService?.getSettings?.() || {});
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching system settings, using fallback:", error.message);
        setSettings(superAdminService?.getSettings?.() || {});
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { settings, loading };
};

export const useMaintenanceMode = () => {
  const [maintenance, setMaintenance] = useState(() => superAdminService?.getMaintenance?.() || { enabled: false });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(doc(db, 'system', 'maintenance'), (docSnap) => {
        if (!mounted) return;
        if (docSnap.exists()) {
          setMaintenance({ id: docSnap.id, ...docSnap.data() });
        } else {
          setMaintenance(superAdminService?.getMaintenance?.() || { enabled: false });
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching maintenance mode, using fallback:", error.message);
        setMaintenance(superAdminService?.getMaintenance?.() || { enabled: false });
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { maintenance, loading };
};

export const useBackups = () => {
  const [backups, setBackups] = useState(() => superAdminService?.getBackups?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'systemBackups'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setBackups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching systemBackups, using fallback:", error.message);
        setBackups(superAdminService?.getBackups?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { backups, loading };
};

export const useSystemHealth = () => {
  const [health, setHealth] = useState({
    status: "Healthy",
    uptime: "99.98%",
    apiLatency: "48ms",
    firestoreStatus: "Connected",
    nodeMemory: "128MB / 512MB",
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(doc(db, 'system', 'health'), (docSnap) => {
        if (!mounted) return;
        if (docSnap.exists()) {
          setHealth({ id: docSnap.id, ...docSnap.data() });
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching system health, using fallback:", error.message);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { health, loading };
};

export const usePlatformAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(doc(db, 'analytics', 'platform'), (docSnap) => {
        if (!mounted) return;
        if (docSnap.exists()) {
          setAnalytics({ id: docSnap.id, ...docSnap.data() });
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching platform analytics, using fallback:", error.message);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { analytics, loading };
};

export const useSubscriptionPlans = () => {
  const [plans, setPlans] = useState(() => superAdminService?.getPlans?.() || []);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    try {
      const unsub = onSnapshot(collection(db, 'subscriptionPlans'), (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.warn("Firestore error fetching subscriptionPlans, using fallback:", error.message);
        setPlans(superAdminService?.getPlans?.() || []);
        setLoading(false);
      });
      return () => {
        mounted = false;
        unsub();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);
  return { plans, loading };
};