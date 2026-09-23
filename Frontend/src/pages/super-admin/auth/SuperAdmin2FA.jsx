import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSuperAdminAuth } from "../../../context/SuperAdminAuthContext";
import { ShieldCheck, Smartphone, Mail, Key, ArrowRight, Lock, AlertCircle } from "lucide-react";
import AuthCollage from "../../../components/AuthCollage";

export default function SuperAdmin2FA() {
  const [method, setMethod] = useState("authenticator"); // 'authenticator' | 'email' | 'backup'
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { verify2FA, pendingAdmin } = useSuperAdminAuth();
  const navigate = useNavigate();

  const handleVerify = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!code.trim()) {
      setError("Please enter the 6-digit verification token.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      verify2FA(code);
      navigate("/super-admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid authentication code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVerify(e);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Collage */}
      <AuthCollage />

      {/* Right — 2FA Form */}
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 py-6 flex-shrink-0 bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4">
          <Link
            to="/super-admin/login"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← Back to Login
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Super Admin 2FA
            </span>
          </div>
        </div>

        {/* Center Card */}
        <div className="w-full max-w-sm mx-auto my-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Two-Factor <span className="text-blue-600">Verification</span>
            </h1>
            <p className="text-sm text-gray-500">
              Step 2: Authenticate your identity to access the administrative control center.
            </p>
          </div>

          {/* User Account Pill */}
          <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <span className="text-gray-500">Admin Account:</span>
            <span className="font-mono text-blue-600 font-semibold truncate max-w-[200px]">
              {pendingAdmin?.email || "admin@technovanam.com"}
            </span>
          </div>

          {/* 2FA Method Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 mb-5 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMethod("authenticator");
                setCode("");
                setError("");
              }}
              className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition ${
                method === "authenticator" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>App (TOTP)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("email");
                setCode("");
                setError("");
              }}
              className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition ${
                method === "email" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Email OTP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("backup");
                setCode("");
                setError("");
              }}
              className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition ${
                method === "backup" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Backup Code</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="twofa-code" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {method === "authenticator" && "Enter 6-Digit App Code"}
                  {method === "email" && "Enter 6-Digit Email OTP"}
                  {method === "backup" && "Enter Backup Code"}
                </label>
                <button
                  type="button"
                  onClick={() => setCode(method === "backup" ? "BACKUP-PASS" : "123456")}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  Fill Code ({method === "backup" ? "BACKUP" : "123456"})
                </button>
              </div>
              <input
                id="twofa-code"
                type="text"
                required
                maxLength={method === "backup" ? 12 : 6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={method === "backup" ? "ABCD-1234" : "123456"}
                autoFocus
                className="w-full text-center tracking-widest font-mono text-xl py-3 rounded-xl bg-white border border-gray-300 text-gray-900 placeholder:text-gray-300 focus:border-blue-500 focus:outline-none transition shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
            >
              {loading ? "Validating Token…" : "Verify & Continue"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Session securely bound to device fingerprint</span>
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}

