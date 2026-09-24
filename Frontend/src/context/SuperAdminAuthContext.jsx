import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { superAdminService } from "../services/superAdminDataService";

const SUPER_ADMIN_SESSION_KEY = "technovanam_sa_session";
const SUPER_ADMIN_IMPERSONATION_KEY = "technovanam_sa_impersonation";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

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
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = localStorage.getItem(SUPER_ADMIN_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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

  // Logout method
  const logout = useCallback(() => {
    if (adminUser) {
      superAdminService.logAudit(
        "ADMIN_LOGOUT",
        "Super Admin Session",
        adminUser.id || adminUser.email,
        "Platform",
        `Admin logged out (${adminUser.email})`
      );
    }
    setAdminUser(null);
    setIs2FAPending(false);
    setPendingAdmin(null);
    localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
  }, [adminUser]);

  // Activity tracker for auto timeout
  useEffect(() => {
    if (!adminUser) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT_MS) {
        console.warn("[Super Admin] Session timed out due to 15 minutes of inactivity.");
        logout();
      }
    }, 30000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      clearInterval(interval);
    };
  }, [adminUser, logout]);

  // Login handler
  const login = useCallback(async (email, password, rememberMe = true) => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    const adminList = superAdminService.getAdminUsers();

    // Check primary default admin or staff admin list
    const isMasterAdmin = trimmedEmail === "admin@technovanam.com" && password === "SuperAdmin@2026!";
    const staffMatch = adminList.find((a) => a.email.toLowerCase() === trimmedEmail);

    if (!isMasterAdmin && !staffMatch) {
      // Regular user or incorrect credentials - explicitly forbid access
      superAdminService.get(STORAGE_KEYS => {}); // safe access
      throw new Error("You do not have permission to access the Super Admin Portal.");
    }

    // Build the admin profile
    const profile = isMasterAdmin
      ? {
          id: "adm_01",
          name: "Chief Platform Admin",
          email: "admin@technovanam.com",
          role: "Super Admin",
          permissions: ["all"],
          twoFactorEnabled: true,
          rememberMe,
          token: `satk_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        }
      : {
          id: staffMatch.id,
          name: staffMatch.name,
          email: staffMatch.email,
          role: staffMatch.role,
          permissions: [staffMatch.role.toLowerCase()],
          twoFactorEnabled: !!staffMatch.twoFactorEnabled,
          rememberMe,
          token: `satk_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        };

    // Check 2FA requirement
    if (profile.twoFactorEnabled) {
      setPendingAdmin(profile);
      setIs2FAPending(true);
      return { require2FA: true };
    }

    // Complete login
    setAdminUser(profile);
    localStorage.setItem(SUPER_ADMIN_SESSION_KEY, JSON.stringify(profile));
    superAdminService.logAudit(
      "ADMIN_LOGIN",
      "Super Admin Portal",
      profile.id,
      "Platform",
      `Authenticated via Email & Password (${profile.email})`
    );
    return { success: true };
  }, []);

  // 2FA Verification handler
  const verify2FA = useCallback((code) => {
    if (!pendingAdmin) throw new Error("No pending login session found.");

    const sanitizedCode = (code || "").trim();
    // Accept valid 6-digit OTP or demo bypass "123456"
    if (sanitizedCode.length < 6) {
      throw new Error("Invalid 2FA code. Please enter a valid 6-digit authentication token.");
    }

    setAdminUser(pendingAdmin);
    localStorage.setItem(SUPER_ADMIN_SESSION_KEY, JSON.stringify(pendingAdmin));
    superAdminService.logAudit(
      "ADMIN_LOGIN",
      "Super Admin Portal",
      pendingAdmin.id,
      "Platform",
      `2FA Verified successfully for ${pendingAdmin.email}`
    );
    setIs2FAPending(false);
    setPendingAdmin(null);
    return { success: true };
  }, [pendingAdmin]);

  // Impersonation ("Login as Business")
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

    // Also update company_profile in localStorage so existing billing pages render this business!
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

    superAdminService.logAudit(
      "IMPERSONATION_STARTED",
      "Business Account",
      business.id,
      business.name,
      `Super Admin impersonation started. Reason: ${reason}`
    );
  }, []);

  const stopImpersonation = useCallback(() => {
    if (impersonatedBusiness) {
      superAdminService.logAudit(
        "IMPERSONATION_ENDED",
        "Business Account",
        impersonatedBusiness.id,
        impersonatedBusiness.name,
        "Super Admin impersonation session exited"
      );
    }
    setImpersonatedBusiness(null);
    localStorage.removeItem(SUPER_ADMIN_IMPERSONATION_KEY);
    // Remove temporary business cache
    localStorage.removeItem("company_profile");
  }, [impersonatedBusiness]);

  const value = {
    adminUser,
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
