import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Store, Mail, Lock, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";
import { auth } from "../../lib/firebase/config";

// Email sign-in for the POS app. Owners manage cashiers, register POS devices,
// bill at the counter and run the warehouse; "wh." accounts open the warehouse.
// Uses the same Firebase accounts as the billing website, but this app has no
// access to the website's features.
export default function OwnerSignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const isWarehouse = email.trim().toLowerCase().startsWith("wh.");
      navigate(isWarehouse ? "/warehouse" : "/cashiers", { replace: true });
    } catch (err) {
      setError(err.code === "auth/invalid-credential" ? "Wrong email or password." : err.message || "Sign in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
          <Store className="h-3.5 w-3.5" /> Owner &amp; Warehouse Sign In
        </span>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl sm:px-10 border border-slate-200 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Email</label>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Password</label>
            <div className="mt-1 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <p className="flex gap-1.5 rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"} <ArrowRight className="h-4 w-4" />
          </button>

          <Link to="/pos/login" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Cashier sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
