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
