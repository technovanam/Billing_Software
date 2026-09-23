import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth } from "../../lib/firebase/config";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import AuthCollage from "../../components/AuthCollage";
import { useToast } from "../../context/ToastContext";

export default function SignIn() {
  const [email, setEmail] = useState("wh.demo@technovanam.in");
  const [password, setPassword] = useState("Warehouse@123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { error: toastError } = useToast();

  const handleLogin = async (e) => {
    e?.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toastError("Please enter your email address.");
      return;
    }
    if (!password) {
      toastError("Please enter your password.");
      return;
    }
    setLoading(true);
    try {
      await setPersistence(auth, browserSessionPersistence);
      const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const userEmail = (userCred.user?.email || trimmedEmail).toLowerCase();
      const isWarehouseUser = userEmail === "wh.demo@technovanam.in" || userEmail.startsWith("wh.");

      if (isWarehouseUser) {
        navigate("/warehouse", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        toastError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        toastError("Please enter a valid email address.");
      } else if (err.code === "auth/too-many-requests") {
        toastError("Too many failed attempts. Please try again later or reset your password.");
      } else if (err.code === "auth/network-request-failed") {
        toastError("Network error. Please check your internet connection.");
      } else {
        toastError(err.message || "Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("wh.demo@technovanam.in");
    setPassword("Warehouse@123");
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Collage */}
      <AuthCollage />

      {/* Right — Sign In Form */}
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 py-6 flex-shrink-0">
        {/* Top bar — Sign up link */}
        <div className="flex items-center justify-between pb-4">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            Don&apos;t have an account?
            <Link
              to="/signup"
              className="font-semibold text-gray-900 border border-gray-300 px-3.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
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

          {/* Quick Demo Access Box */}
          <div className="mb-5 p-3.5 rounded-xl bg-blue-50/80 border border-blue-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                Warehouse Demo Login
              </span>
              <button
                type="button"
                onClick={fillDemo}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Reset Demo
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-600 bg-white/70 p-2 rounded-lg border border-blue-50">
              <div>
                <span className="text-[10px] uppercase font-sans text-slate-400 block font-semibold">Email</span>
                <span className="truncate block">wh.demo@technovanam.in</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-sans text-slate-400 block font-semibold">Password</span>
                <span>Warehouse@123</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Email Address"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-11 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <button type="button" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Forgot the password?
              </button>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
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
