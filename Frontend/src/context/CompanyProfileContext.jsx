import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase/config";
import { AuthContext } from "./AuthContext";
import PropTypes from "prop-types";

const COMPANY_PROFILE_KEY = "company_profile";

// Business details editable from Settings and printed on every bill.
export const PROFILE_FIELDS = ["companyName", "ownerName", "phone", "gstin", "address", "city", "state", "pincode"];
export const BANK_FIELDS = ["bankName", "accountName", "accountNumber", "ifsc", "branch", "upiId"];

export const CompanyProfileContext = createContext(null);

export function useCompanyProfile() {
  const context = useContext(CompanyProfileContext);
  if (!context) {
    throw new Error("useCompanyProfile must be used within CompanyProfileProvider");
  }
  return context;
}

function toProfile(uid, email, data, fallbackCreatedAt) {
  const bank = data.bank || {};
  return {
    uid,
    companyName: data.companyName || "",
    ownerName: data.ownerName || "",
    email,
    phone: data.phone || "",
    gstin: data.gstin || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    pincode: data.pincode || "",
    logoURL: data.logoURL || "",
    bank: Object.fromEntries(BANK_FIELDS.map((k) => [k, bank[k] || ""])),
    createdAt: data.createdAt?.toMillis?.()
      ? new Date(data.createdAt.toMillis()).toISOString()
      : fallbackCreatedAt || new Date().toISOString(),
  };
}

export function CompanyProfileProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const store = (next) => {
    setProfile(next);
    if (next) localStorage.setItem(COMPANY_PROFILE_KEY, JSON.stringify(next));
    else localStorage.removeItem(COMPANY_PROFILE_KEY);
  };

  const loadProfile = useCallback(async (uid, userEmail) => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Show the cached profile straight away, then refresh it from Firestore.
    let cachedCreatedAt;
    try {
      const parsed = JSON.parse(localStorage.getItem(COMPANY_PROFILE_KEY) || "null");
      if (parsed?.uid === uid) {
        setProfile({ ...parsed, bank: parsed.bank || {}, email: parsed.email || userEmail });
        cachedCreatedAt = parsed.createdAt;
        setLoading(false);
      }
    } catch (_) {
      /* ignore invalid cache */
    }

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) store(toProfile(uid, userEmail, snap.data(), cachedCreatedAt));
      else if (!cachedCreatedAt) store(null);
    } catch (err) {
      // Offline: keep whatever the cache gave us.
      console.warn("Company profile load notice (offline or network error):", err.message || err);
      if (!cachedCreatedAt) setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      store(null);
      setLoading(false);
      return;
    }
    loadProfile(user.businessUid || user.uid, user.email || "");
  }, [user?.uid, user?.email, loadProfile]);

  const refetch = useCallback(() => {
    if (user) loadProfile(user.businessUid || user.uid, user.email || "");
  }, [user, loadProfile]);

  // Save business and/or bank details. `patch` may contain PROFILE_FIELDS and a `bank` object.
  const updateProfile = useCallback(
    async (patch) => {
      const uid = user?.businessUid || user?.uid;
      if (!uid) throw new Error("Not signed in");
      const clean = {};
      for (const k of PROFILE_FIELDS) {
        if (patch[k] !== undefined) clean[k] = String(patch[k] ?? "").trim();
      }
      if (clean.gstin) clean.gstin = clean.gstin.toUpperCase();
      if (patch.bank) {
        clean.bank = Object.fromEntries(BANK_FIELDS.map((k) => [k, String(patch.bank[k] ?? "").trim()]));
        if (clean.bank.ifsc) clean.bank.ifsc = clean.bank.ifsc.toUpperCase();
      }
      const before = profile ? { ...profile } : null;
      await updateDoc(doc(db, "users", uid), clean);
      // Edit log for business / bank detail changes.
      addDoc(collection(db, "users", uid, "auditTrail"), {
        at: serverTimestamp(),
        clientAt: new Date().toISOString(),
        by: user?.uid || uid,
        byEmail: user?.email || "",
        action: "update",
        collection: "businessProfile",
        docId: uid,
        summary: clean.companyName || before?.companyName || "Business details",
        before: JSON.parse(JSON.stringify(before || {})),
        after: JSON.parse(JSON.stringify({ ...(before || {}), ...clean })),
      }).catch(() => {});
      store({ ...profile, ...clean, bank: clean.bank || profile?.bank || {} });
    },
    [user, profile]
  );

  const value = React.useMemo(
    () => ({ companyProfile: profile, loading, refetch, updateProfile }),
    [profile, loading, refetch, updateProfile]
  );

  return <CompanyProfileContext.Provider value={value}>{children}</CompanyProfileContext.Provider>;
}

CompanyProfileProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
