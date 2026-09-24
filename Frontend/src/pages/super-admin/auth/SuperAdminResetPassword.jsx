import React, { useState, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ShieldCheck, Lock, Check, X, Eye, EyeOff } from "lucide-react";
import AuthCollage from "../../../components/AuthCollage";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "../../../lib/firebase/config";

export default function SuperAdminResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  // Requirements checks
  const rules = useMemo(() => {
    return [
      { label: "At least 8 characters", met: newPassword.length >= 8 },
      { label: "Contains uppercase letter (A-Z)", met: /[A-Z]/.test(newPassword) },
      { label: "Contains lowercase letter (a-z)", met: /[a-z]/.test(newPassword) },
      { label: "Contains a number (0-9)", met: /[0-9]/.test(newPassword) },
      { label: "Contains a special character (!@#$…)", met: /[^A-Za-z0-9]/.test(newPassword) },
    ];
  }, [newPassword]);

  const metCount = rules.filter((r) => r.met).length;
  const strength = metCount <= 2 ? "Weak" : metCount <= 4 ? "Moderate" : "Strong";
  const strengthColor =
    strength === "Weak" ? "bg-rose-500" : strength === "Moderate" ? "bg-amber-500" : "bg-emerald-500";

  const handleReset = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!oobCode) {
      setError("Invalid or missing password reset code.");
      return;
    }
    if (metCount < 5) {
      setError("Please ensure all password complexity requirements are fulfilled.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter identical credentials.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate("/super-admin/login", { replace: true });
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to reset password. The link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Collage */}
      <AuthCollage />

      {/* Right — Reset Password Form */}
      <div className="w-full lg:w-[45%] min-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 py-6 flex-shrink-0 bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4">
          <Link
            to="/super-admin/login"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
          >
            ← Back to Login
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Super Admin Security
            </span>
          </div>
        </div>

        {/* Center Card */}
        <div className="w-full max-w-sm mx-auto my-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Reset <span className="text-blue-600">Password</span>
            </h1>
            <p className="text-sm text-gray-500">
              Create a strong, new password for your administrative account.
            </p>
          </div>

          {success ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <strong className="text-base font-bold block mb-1 text-emerald-950">Password updated successfully.</strong>
              <p className="text-xs text-emerald-700">Redirecting to Super Admin login…</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Strength Meter */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Strength:</span>
                    <span className={`font-bold ${strength === "Strong" ? "text-emerald-600" : strength === "Moderate" ? "text-amber-600" : "text-rose-600"}`}>
                      {strength}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex gap-1">
                    <div className={`h-full flex-1 ${metCount >= 1 ? strengthColor : "bg-gray-200"}`} />
                    <div className={`h-full flex-1 ${metCount >= 3 ? strengthColor : "bg-gray-200"}`} />
                    <div className={`h-full flex-1 ${metCount >= 5 ? strengthColor : "bg-gray-200"}`} />
                  </div>
                </div>
              )}

              {/* Rules checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                {rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {rule.met ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={rule.met ? "text-gray-800 font-medium" : "text-gray-400"}>{rule.label}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || metCount < 5}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                {loading ? "Updating Password…" : "Reset Password"}
              </button>
            </form>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}

