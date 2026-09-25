import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSuperAdminAuth } from "../../../context/SuperAdminAuthContext";
import { Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import AuthCollage from "../../../components/AuthCollage";

export default function SuperAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { login } = useSuperAdminAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your Super Admin email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await login(cleanEmail, password, true);
      if (res?.require2FA) {
        navigate("/super-admin/2fa", { replace: true });
      } else {
        navigate("/super-admin/dashboard", { replace: true });
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to authenticate. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!password) {
        document.getElementById("sa-password")?.focus();
      } else {
        handleLogin(e);
      }
    }
  };

  const handlePasswordKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin(e);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Collage (Exact same as Billing Login) */}
      <AuthCollage />

      {/* Right — Sign In Form */}
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 py-6 flex-shrink-0 bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4">
          <Link
            to="/signin"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Super Admin Portal
            </span>
          </div>
        </div>

        {/* Center Form */}
        <div className="w-full max-w-sm mx-auto my-auto py-4">
          {/* Logo + heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Sign in to <span className="text-blue-600">Techno Vanam</span>
            </h1>
            <p className="text-sm text-gray-500">
              Welcome back, please enter your login details below to access the app.
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <input
                id="sa-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                type="email"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Email Address"
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <input
                id="sa-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handlePasswordKeyDown}
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <Link
                to="/super-admin/forgot-password"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot the password?
              </Link>
            </div>

            {/* Login button */}
            <button
              id="sa-login-button"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}

