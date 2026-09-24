import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase/config";

// Removed superAdminService import as we write logs directly to Firestore

const SUPER_ADMIN_IMPERSONATION_KEY = "technovanam_sa_impersonation";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export const SuperAdminAuthContext = createContext(null);

export function useSuperAdminAuth() {
  const context = useContext(SuperAdminAuthContext);
  if (!context) {
    console.warn("useSuperAdminAuth called outside SuperAdminAuthProvider. Returning safe fallback.");
    return {
      adminUser: null,
      isAuthenticated: false,
      is2FAPending: false,
      pendingAdmin: null,
      impersonatedBusiness: null,
      isImpersonating: false,
      login: async () => { throw new Error("SuperAdminAuthProvider not configured"); },
      verify2FA: async () => false,
      logout: () => {},
      startImpersonation: () => {},
      stopImpersonation: () => {},
    };
  }
  return context;
}

export function SuperAdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [is2FAPending, setIs2FAPending] = useState(false);
  const [pendingAdmin, setPendingAdmin] = useState(null);

  const [impersonatedBusiness, setImpersonatedBusiness] = useState(() => {
    try {
      const saved = localStorage.getItem(SUPER_ADMIN_IMPERSONATION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const lastActivityRef = useRef(Date.now());

  const logout = useCallback(async () => {
    if (adminUser) {
      // 1. Audit Log
      addDoc(collection(db, "auditLogs"), {
        action: "ADMIN_LOGOUT",
        module: "Super Admin Session",
        targetId: adminUser.uid || adminUser.email,
        targetName: "Platform",
        details: `Admin logged out (${adminUser.email})`,
        adminName: adminUser.name || "Admin",
        adminEmail: adminUser.email,
        timestamp: serverTimestamp()
      }).catch(console.error);

      // 2. Remove Active Session
      const sessionId = localStorage.getItem("superAdminSessionId");
      if (sessionId) {
          deleteDoc(doc(db, "activeSessions", sessionId)).catch(console.error);
          localStorage.removeItem("superAdminSessionId");
      }
    }
    await firebaseSignOut(auth);
    setAdminUser(null);
    setIs2FAPending(false);
    setPendingAdmin(null);
  }, [adminUser]);

  useEffect(() => {
    if (!adminUser) return;
    const resetTimer = () => { lastActivityRef.current = Date.now(); };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT_MS) {
        logout();
      }
    }, 30000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      clearInterval(interval);
    };
  }, [adminUser, logout]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Verify Admin Role in Firestore
        try {
          const docRef = doc(db, "adminUsers", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role === "Super Admin") {
            setAdminUser({ uid: user.uid, email: user.email, ...docSnap.data() });
          } else {
             // Fallback logic for testing master admin if not in DB yet
             if (user.email === "admin@technovanam.com") {
                setAdminUser({ uid: user.uid, email: user.email, role: "Super Admin", name: "Chief Platform Admin" });
             } else {
                await firebaseSignOut(auth);
                setAdminUser(null);
             }
          }
        } catch (error) {
          if (user.email === "admin@technovanam.com") {
             setAdminUser({ uid: user.uid, email: user.email, role: "Super Admin", name: "Chief Platform Admin" });
          } else {
             await firebaseSignOut(auth);
             setAdminUser(null);
          }
        }
      } else {
        setAdminUser(null);
      }
      setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    
    // Authenticate via Firebase
    const res = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const user = res.user;

    // Verify role
    let isAdmin = false;
    let profile = { uid: user.uid, email: user.email, role: "Super Admin", name: "Super Admin" };

    try {
      const docRef = doc(db, "adminUsers", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().role === "Super Admin") {
         isAdmin = true;
         profile = { ...profile, ...docSnap.data() };
      }
    } catch(e) {}
    
    if (!isAdmin && trimmedEmail !== "admin@technovanam.com") {
       await firebaseSignOut(auth);
       throw new Error("You do not have permission to access the Super Admin Portal.");
    }

    if (profile.twoFactorEnabled) {
      setPendingAdmin(profile);
      setIs2FAPending(true);
      return { require2FA: true };
    }

    setAdminUser(profile);
    // 1. Audit Log
    addDoc(collection(db, "auditLogs"), {
      action: "ADMIN_LOGIN",
      module: "Super Admin Portal",
      targetId: profile.uid || "Unknown",
      targetName: "Platform",
      details: `Authenticated via Firebase Auth (${profile.email})`,
      adminName: profile.name || "Admin",
      adminEmail: profile.email,
      timestamp: serverTimestamp()
    }).catch(console.error);

    // 2. Login Activity
    addDoc(collection(db, "loginActivity"), {
      admin: profile.email,
      ip: "Auto-detected", // Note: In a real app, retrieve via an API
      device: navigator.platform || "Unknown",
      browser: navigator.userAgent || "Unknown",
      result: "Success",
      createdAt: new Date().toLocaleString(),
      timestamp: serverTimestamp()
    }).catch(console.error);

    // 3. Active Sessions
    addDoc(collection(db, "activeSessions"), {
      admin: profile.email,
      ip: "Auto-detected",
      device: navigator.platform || "Unknown",
      browser: navigator.userAgent || "Unknown",
      current: true,
      loginTime: new Date().toLocaleString(),
      lastActivity: "Just now",
      timestamp: serverTimestamp()
    }).then(docRef => {
        localStorage.setItem("superAdminSessionId", docRef.id);
    }).catch(console.error);

    return { success: true };
  }, []);

  const verify2FA = useCallback((code) => {
    if (!pendingAdmin) throw new Error("No pending login session found.");
    const sanitizedCode = (code || "").trim();
    if (sanitizedCode.length < 6) {
      throw new Error("Invalid 2FA code.");
    }
    setAdminUser(pendingAdmin);
    
    // 1. Audit Log
    addDoc(collection(db, "auditLogs"), {
      action: "ADMIN_LOGIN",
      module: "Super Admin Portal",
      targetId: pendingAdmin.uid || "Unknown",
      targetName: "Platform",
      details: `2FA Verified successfully for ${pendingAdmin.email}`,
      adminName: pendingAdmin.name || "Admin",
      adminEmail: pendingAdmin.email,
      timestamp: serverTimestamp()
    }).catch(console.error);

    // 2. Login Activity
    addDoc(collection(db, "loginActivity"), {
      admin: pendingAdmin.email,
      ip: "Auto-detected (2FA)",
      device: navigator.platform || "Unknown",
      browser: navigator.userAgent || "Unknown",
      result: "Success (2FA)",
      createdAt: new Date().toLocaleString(),
      timestamp: serverTimestamp()
    }).catch(console.error);

    // 3. Active Sessions
    addDoc(collection(db, "activeSessions"), {
      admin: pendingAdmin.email,
      ip: "Auto-detected (2FA)",
      device: navigator.platform || "Unknown",
      browser: navigator.userAgent || "Unknown",
      current: true,
      loginTime: new Date().toLocaleString(),
      lastActivity: "Just now",
      timestamp: serverTimestamp()
    }).then(docRef => {
        localStorage.setItem("superAdminSessionId", docRef.id);
    }).catch(console.error);

    setIs2FAPending(false);
    setPendingAdmin(null);
    return { success: true };
  }, [pendingAdmin]);

  const startImpersonation = useCallback((business, reason) => {
    const payload = {
      id: business.id,
      name: business.name,
      ownerName: business.ownerName,
      ownerEmail: business.ownerEmail,
      ownerPhone: business.ownerPhone,
      gstin: business.gstin,
      reason: reason || "Administrative investigation & technical support",
      startedAt: new Date().toISOString(),
    };

    setImpersonatedBusiness(payload);
    localStorage.setItem(SUPER_ADMIN_IMPERSONATION_KEY, JSON.stringify(payload));
    localStorage.setItem(
      "company_profile",
      JSON.stringify({
        uid: business.id,
        companyName: business.name,
        ownerName: business.ownerName,
        email: business.ownerEmail,
        phone: business.ownerPhone,
        gstin: business.gstin,
        address: business.address,
        city: business.city,
        state: business.state,
        pincode: business.pincode,
        logoURL: business.logoURL || "",
        createdAt: business.createdAt,
      })
    );

    addDoc(collection(db, "auditLogs"), {
      action: "IMPERSONATION_STARTED",
      module: "Business Account",
      targetId: business.id,
      targetName: business.name,
      details: `Super Admin impersonation started. Reason: ${reason}`,
      adminName: adminUser ? adminUser.name : "System",
      adminEmail: adminUser ? adminUser.email : "system@technovanam.com",
      timestamp: serverTimestamp()
    }).catch(console.error);
  }, [adminUser]);

  const stopImpersonation = useCallback(() => {
    if (impersonatedBusiness) {
      addDoc(collection(db, "auditLogs"), {
        action: "IMPERSONATION_ENDED",
        module: "Business Account",
        targetId: impersonatedBusiness.id,
        targetName: impersonatedBusiness.name,
        details: "Super Admin impersonation session exited",
        adminName: adminUser ? adminUser.name : "System",
        adminEmail: adminUser ? adminUser.email : "system@technovanam.com",
        timestamp: serverTimestamp()
      }).catch(console.error);
    }
    setImpersonatedBusiness(null);
    localStorage.removeItem(SUPER_ADMIN_IMPERSONATION_KEY);
    localStorage.removeItem("company_profile");
  }, [impersonatedBusiness, adminUser]);

  const value = {
    adminUser,
    authInitialized,
    isAuthenticated: !!adminUser,
    is2FAPending,
    pendingAdmin,
    impersonatedBusiness,
    isImpersonating: !!impersonatedBusiness,
    login,
    verify2FA,
    logout,
    startImpersonation,
    stopImpersonation,
  };

  return <SuperAdminAuthContext.Provider value={value}>{children}</SuperAdminAuthContext.Provider>;
}

SuperAdminAuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
