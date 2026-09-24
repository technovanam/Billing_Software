import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase/config";
import { AuthContext } from "../../context/AuthContext";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import AuthCollage from "../../components/AuthCollage";
import { useToast } from "../../context/ToastContext";
import { useSuperAdminAuth } from "../../context/SuperAdminAuthContext";
import { enterPOSFullscreen } from "../../hooks/usePOSFullscreen";

export default function SignIn() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const { success: toastSuccess, error: toastError } = useToast();
  const { login: superAdminLogin } = useSuperAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);


  const handlePasswordKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin(e);
    }
  };

  const handleEmailKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!password) {
        document.getElementById("password")?.focus();
      } else {
        handleLogin(e);
      }
    }
  };

  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toastError("Please enter your email address or Cashier ID.");
      return;
    }
    if (!password) {
      toastError("Please enter your password or 4-digit PIN.");
      return;
    }

    setLoading(true);

    try {
      // 1. Check if user is logging into Super Admin Portal
      if (trimmedEmail.toLowerCase() === "admin@technovanam.com" && password === "SuperAdmin@2026!") {
        try {
          const res = await superAdminLogin(trimmedEmail, password, true);
          if (res?.require2FA) {
            navigate("/super-admin/2fa", { replace: true });
          } else {
            navigate("/super-admin/dashboard", { replace: true });
          }
          return;
        } catch (saErr) {
          toastError(saErr.message || "Failed to sign into Super Admin Portal.");
          setLoading(false);
          return;
        }
      }

      // 2. Check if the entered identifier matches any registered Cashier
      let allCashiers = [];
      try {
        const rawGlobal = localStorage.getItem("registered_cashiers_list");
        if (rawGlobal) allCashiers = JSON.parse(rawGlobal);
        if (!allCashiers.length) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("store_cashiers_")) {
              const list = JSON.parse(localStorage.getItem(key) || "[]");
              if (Array.isArray(list)) allCashiers.push(...list);
            }
          }
        }
      } catch (cacheErr) {
        console.warn("Cashier cache lookup warning:", cacheErr);
      }

      const matchedCashier = allCashiers.find(
        (c) =>
          (c.email && c.email.trim().toLowerCase() === trimmedEmail.toLowerCase()) ||
          (c.cashierId && c.cashierId.trim().toUpperCase() === trimmedEmail.toUpperCase()) ||
          (c.phone && trimmedEmail.length >= 10 && c.phone.replace(/\D/g, "") === trimmedEmail.replace(/\D/g, ""))
      );

      let matchedOwnerUid = "";
      if (matchedCashier) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("store_cashiers_")) {
            try {
              const list = JSON.parse(localStorage.getItem(key) || "[]");
              if (
                Array.isArray(list) &&
                list.some(
                  (c) =>
                    (c.cashierId && c.cashierId === matchedCashier.cashierId) ||
                    (c.email && c.email === matchedCashier.email)
                )
              ) {
                matchedOwnerUid = key.replace("store_cashiers_", "");
                break;
              }
            } catch (_) {}
          }
        }

        // Verify 4-digit PIN and redirect to POS
        if (matchedCashier.pin && matchedCashier.pin.trim() !== password.trim()) {
          toastError(`Incorrect 4-digit PIN for Cashier "${matchedCashier.name || matchedCashier.cashierId}".`);
          setLoading(false);
          return;
        }

        if ((matchedCashier.status || "Active") === "Inactive") {
          toastError(`Cashier account "${matchedCashier.cashierId}" has been deactivated. Please contact Admin.`);
          setLoading(false);
          return;
        }

        const cashierSession = {
          cashierId: matchedCashier.cashierId || "CSH-001",
          cashierName: matchedCashier.name || "Cashier",
          counterNumber: matchedCashier.counter || "Counter 01",
          shiftStartTime: new Date().toISOString(),
          ownerUid: matchedOwnerUid || matchedCashier.ownerUid || "",
        };
        localStorage.setItem("pos_cashier_session", JSON.stringify(cashierSession));
        sessionStorage.removeItem("pos_fullscreen_opt_out");
        enterPOSFullscreen();

        toastSuccess(`Welcome ${cashierSession.cashierName} (${cashierSession.cashierId})! Opening POS terminal...`);
        navigate("/pos", { replace: true });
        setLoading(false);
        return;
      }

      // 3. Check for Default Admin Credentials
      const isDefaultAdmin =
        (trimmedEmail.toLowerCase() === "admin@technovanam.com" ||
          trimmedEmail.toLowerCase() === "admin@gmail.com" ||
          trimmedEmail.toLowerCase() === "admin") &&
        (password === "admin123" || password === "admin" || password === "password");

      if (isDefaultAdmin) {
        await setPersistence(auth, browserSessionPersistence);
        let fbUser = null;
        try {
          const res = await signInWithEmailAndPassword(auth, "admin@technovanam.com", "admin123");
          fbUser = res.user;
        } catch (adminFbErr) {
          try {
            const res2 = await signInWithEmailAndPassword(auth, "admin@gmail.com", "admin123");
            fbUser = res2.user;
          } catch (_) {
            try {
              const { createUserWithEmailAndPassword } = await import("firebase/auth");
              const res3 = await createUserWithEmailAndPassword(auth, "admin@technovanam.com", "admin123");
              fbUser = res3.user;
            } catch (createErr) {
              console.warn("Firebase default admin creation note:", createErr);
            }
          }
        }

        const effectiveUid = fbUser?.uid || "admin_default_master";
        const defaultAdminUser = {
          uid: effectiveUid,
          email: "admin@technovanam.com",
          displayName: "Admin Master",
          emailVerified: true,
        };

        localStorage.setItem("admin_auth_user", JSON.stringify(defaultAdminUser));
        localStorage.removeItem("pos_cashier_session");
        if (typeof setUser === "function") {
          setUser(fbUser || defaultAdminUser);
        }
        toastSuccess("Welcome Admin! Signed in successfully.");
        navigate("/dashboard", { replace: true });
        setLoading(false);
        return;
      }

      // 4. Authenticate with Firebase for other custom admin / warehouse accounts
      try {
        await setPersistence(auth, browserSessionPersistence);
        const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const loggedUser = userCred.user;
        const userEmail = (loggedUser?.email || trimmedEmail).toLowerCase();
        const isWarehouseUser = userEmail === "wh.demo@technovanam.in" || userEmail.startsWith("wh.");

        // Sync registered cashiers into cache for subsequent cashier logins
        if (loggedUser?.uid) {
          try {
            const appSnap = await getDoc(doc(db, "users", loggedUser.uid, "settings", "app"));
            if (appSnap.exists()) {
              const raw = appSnap.data()?.cashiers?.value || appSnap.data()?.cashiers;
              if (Array.isArray(raw)) {
                localStorage.setItem("registered_cashiers_list", JSON.stringify(raw));
                localStorage.setItem(`store_cashiers_${loggedUser.uid}`, JSON.stringify(raw));
              }
            }
          } catch (syncErr) {
            console.warn("Cashier cache sync warning:", syncErr);
          }
        }

        const adminObj = {
          uid: loggedUser.uid,
          email: loggedUser.email,
          displayName: loggedUser.displayName || (isWarehouseUser ? "Warehouse User" : "Admin"),
        };
        localStorage.setItem("admin_auth_user", JSON.stringify(adminObj));
        localStorage.removeItem("pos_cashier_session");
        if (typeof setUser === "function") {
          setUser(loggedUser);
        }

        if (isWarehouseUser) {
          toastSuccess("Warehouse operator signed in successfully!");
          navigate("/warehouse", { replace: true });
        } else {
          toastSuccess("Admin signed in successfully!");
          navigate("/dashboard", { replace: true });
        }
      } catch (fbErr) {
        console.error("Firebase sign in error:", fbErr);
        toastError(
          fbErr.code === "auth/invalid-credential" || fbErr.code === "auth/user-not-found"
            ? "Invalid email or password. Please check your credentials."
            : fbErr.message || "Sign in failed."
        );
      }
    } catch (err) {
      console.error("Sign in error:", err);
      toastError(err.message || "Sign in failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Collage */}
      <AuthCollage />

      {/* Right — Sign In Form */}
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 py-6 flex-shrink-0">
        {/* Top bar — Navigation & Sign Up */}
        <div className="flex items-center justify-between pb-4">
          <Link
            to="/"
            className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            ← Back to Home
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            Don&apos;t have an account?
            <Link
              to="/signup"
              className="font-semibold text-slate-900 border border-slate-300 px-3.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm mx-auto my-auto py-4">
          {/* Logo + heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Sign in to{" "}
              <span className="text-blue-600">Techno Vanam</span>
            </h1>
            <p className="text-sm text-gray-500">
              Welcome back, please enter your details below to sign in.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1"
              >
                Email Address or Cashier ID
              </label>
              <input
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                type="text"
                autoComplete="username"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 transition-colors"
                placeholder="name@company.com or CSH-001"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1"
              >
                Password or 4-digit PIN
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm placeholder:text-gray-400 focus:border-blue-500 transition-colors"
                  placeholder="Password or 4-digit PIN"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <button
                type="button"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot the password?
              </button>
            </div>

            {/* Login button */}
            <button
              id="login-button"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white inline-block mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in…</span>
                </>
              ) : email.trim().toLowerCase().startsWith("wh.") ? (
                "Sign In to Warehouse Portal →"
              ) : (
                "Sign In to Admin Dashboard →"
              )}
            </button>
          </form>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
