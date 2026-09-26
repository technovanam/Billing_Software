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
import { cashierLogin } from "../../services/posService";

// Cashier PINs are never cached in the browser.
const stripPins = (list) => list.map(({ pin, ...c }) => c);

// Find cashier from local cache by Cashier ID, email, or phone
function findCachedCashier(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const searchInList = (list) => {
    if (!Array.isArray(list)) return null;
    return list.find((c) => {
      if ((c.cashierId || "").trim().toLowerCase() === q) return true;
      if ((c.email || "").trim().toLowerCase() === q) return true;
      if (digits.length >= 10 && (c.phone || "").replace(/\D/g, "").endsWith(digits.slice(-10))) return true;
      return false;
    });
  };

  try {
    const primary = JSON.parse(localStorage.getItem("registered_cashiers_list") || "[]");
    const found = searchInList(primary);
    if (found) return found;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("store_cashiers_")) {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        const match = searchInList(list);
        if (match) return match;
      }
    }
  } catch (_) {}
  return null;
}

export default function SignIn() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const { success: toastSuccess, error: toastError } = useToast();
  const { login: superAdminLogin } = useSuperAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const trimmedEmail = email.trim();
  const cachedCashier = findCachedCashier(trimmedEmail);
  const isCashierCandidate = Boolean(cachedCashier) || (trimmedEmail.length > 0 && !trimmedEmail.includes("@"));

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
      // 1. Super Admin Portal — identified by email only; Firebase verifies the password.
      if (trimmedEmail.toLowerCase() === "admin@technovanam.com") {
        try {
          const res = await superAdminLogin(trimmedEmail, password, true);
          if (res?.require2FA) {
            navigate("/super-admin/2fa", { replace: true });
          } else {
            navigate("/super-admin/dashboard", { replace: true });
          }
          setLoading(false);
          return;
        } catch (saErr) {
          toastError(saErr.message || "Failed to sign into Super Admin Portal.");
          setLoading(false);
          return;
        }
      }

      const is4DigitPin = /^\d{4}$/.test(password.trim());

      // 2. Recognized Cashier (by Cashier ID, cached email, or phone)
      if (isCashierCandidate) {
        try {
          const cashierIdentifier = cachedCashier?.cashierId || trimmedEmail;
          const session = await cashierLogin({ cashierId: cashierIdentifier, pin: password.trim() });
          toastSuccess(`Welcome ${session.cashierName} (${session.cashierId})! Opening POS terminal...`);
          navigate("/pos", { replace: true });
          setLoading(false);
          return;
        } catch (cashierErr) {
          if (cashierErr.code === "DEVICE_NOT_REGISTERED") {
            toastError("This device is not registered for POS. Ask the store owner to register it in Cashier Management first.");
          } else {
            toastError(cashierErr.message || "Cashier sign in failed.");
          }
          setLoading(false);
          return;
        }
      }

      // 3. Standard Firebase login for owner / warehouse accounts.
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
                localStorage.setItem("registered_cashiers_list", JSON.stringify(stripPins(raw)));
                localStorage.setItem(`store_cashiers_${loggedUser.uid}`, JSON.stringify(stripPins(raw)));
              }
            }
          } catch (syncErr) {
            console.warn("Cashier cache sync warning:", syncErr);
          }
        }

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
        // Fallback: If Firebase failed and password is a 4-digit PIN, attempt Cashier login via backend
        if (is4DigitPin) {
          try {
            const session = await cashierLogin({ cashierId: trimmedEmail, pin: password.trim() });
            toastSuccess(`Welcome ${session.cashierName} (${session.cashierId})! Opening POS terminal...`);
            navigate("/pos", { replace: true });
            setLoading(false);
            return;
          } catch (cashierFallbackErr) {
            if (cashierFallbackErr.code === "DEVICE_NOT_REGISTERED") {
              toastError("This device is not registered for POS. Ask the store owner to register it in Cashier Management.");
              setLoading(false);
              return;
            } else if (cashierFallbackErr.code && cashierFallbackErr.code !== "BAD_CREDENTIALS") {
              toastError(cashierFallbackErr.message || "Cashier sign in failed.");
              setLoading(false);
              return;
            }
          }
        }

        console.error("Firebase sign in error:", fbErr);
        toastError(
          fbErr.code === "auth/invalid-credential" || fbErr.code === "auth/user-not-found"
            ? "Invalid credentials. If you are a cashier, enter your Cashier ID (e.g. CSH-001) and 4-digit PIN on a registered device."
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
              ) : isCashierCandidate ? (
                `Sign In as ${cachedCashier?.name || "Cashier"} to POS →`
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
