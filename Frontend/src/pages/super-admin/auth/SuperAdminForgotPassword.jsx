import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import AuthCollage from "../../../components/AuthCollage";

export default function SuperAdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left — Collage */}
      <AuthCollage />

      {/* Right — Password Recovery Form */}
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
              Super Admin Recovery
            </span>
          </div>
        </div>

        {/* Center Card */}
        <div className="w-full max-w-sm mx-auto my-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Forgot <span className="text-blue-600">Password?</span>
            </h1>
            <p className="text-sm text-gray-500">
              Enter your Super Admin email address to receive secure credential restoration instructions.
            </p>
          </div>

          {submitted ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-1 text-emerald-950">Recovery Link Dispatched</strong>
                  <p className="text-xs leading-relaxed text-emerald-700">
                    If an account exists with this email, a password reset link has been sent. Please check your inbox.
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-emerald-200/60 text-center">
                <Link
                  to="/super-admin/login"
                  className="w-full text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-xl transition inline-flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? "Sending link…" : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}

