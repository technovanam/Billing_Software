import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Store, User, ArrowRight, ArrowLeft, Lock, Mail, CheckCircle2 } from "lucide-react";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth } from "../../lib/firebase/config";
import { AuthContext } from "../../context/AuthContext";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { useCashiers } from "../../hooks/useFirestore";

export default function POSLogin() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { success: toastSuccess, error: toastError } = useToast();
  const { allCashiers } = useCashiers();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [pin, setPin] = useState("");
  const [counterNumber, setCounterNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const companyName = companyProfile?.companyName || "Techno Vanam";
  const companyLogo = companyProfile?.logoURL || "/Icon@4x-8.png";

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!cashierId.trim()) {
      toastError("Please enter a valid Cashier ID");
      return;
    }

    setIsLoading(true);

    try {
      // If user is not signed in to Firebase yet, authenticate with Firebase
      if (!user) {
        if (!email.trim() || !password) {
          toastError("Please enter your Store Email & Password to initialize the terminal.");
          setIsLoading(false);
          return;
        }
        await setPersistence(auth, browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      // Save active cashier shift session in localStorage
      const session = {
        cashierId: cashierId.trim().toUpperCase(),
        counterNumber,
        shiftStartTime: new Date().toISOString(),
      };
      localStorage.setItem("pos_cashier_session", JSON.stringify(session));

      toastSuccess(`Cashier ${session.cashierId} signed in successfully!`);
      navigate("/pos");
    } catch (err) {
      console.error("POS Login Error:", err);
      toastError(err.message || "Failed to sign in. Please verify store credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Company Logo & Branding */}
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-white shadow-md border border-slate-200 p-2">
            <img src={companyLogo} alt="Logo" className="h-full w-full object-contain" />
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          {companyName}
        </h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            <Store className="h-3.5 w-3.5" /> Cashier POS Portal
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl sm:px-10 border border-slate-200">
          <form className="space-y-4" onSubmit={handleLogin}>
            {/* If not signed in to Firebase, require store credentials */}
            {!user ? (
              <div className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  1. Store Account Credentials
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Store Email Address
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="store@example.com"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Store Password
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="truncate">Store Account Connected ({user.email})</span>
              </div>
            )}

            {/* Cashier ID */}
            <div>
              <label htmlFor="cashierId" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Cashier ID / Terminal ID
              </label>
              <div className="mt-1 relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="cashierId"
                  type="text"
                  required
                  value={cashierId}
                  onChange={(e) => setCashierId(e.target.value)}
                  placeholder="e.g. BAL/086430"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>
            </div>

            {/* Counter Selection */}
            <div>
              <label htmlFor="counter" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Billing Counter
              </label>
              <select
                id="counter"
                value={counterNumber}
                onChange={(e) => setCounterNumber(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 bg-white rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="Counter 01">Counter 01 (Main Billing Desk)</option>
                <option value="Counter 02">Counter 02 (Express Checkout)</option>
                <option value="Counter 03">Counter 03</option>
              </select>
            </div>

            {/* Quick Select Cashier Pills (real cashiers only) */}
            {allCashiers && allCashiers.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Quick Select Cashier:
                </p>
                <div className="flex flex-wrap gap-2">
                  {allCashiers
                    .filter((c) => (c.status || "Active") === "Active")
                    .slice(0, 4)
                    .map((c) => (
                      <button
                        key={c.id || c.cashierId}
                        type="button"
                        onClick={() => {
                          setCashierId(c.cashierId || "");
                          if (c.counter) setCounterNumber(c.counter);
                        }}
                        className={`flex-1 min-w-[90px] py-1.5 px-2 rounded-lg text-xs font-bold transition border ${
                          cashierId === c.cashierId
                            ? "bg-blue-50 border-blue-300 text-blue-700 shadow-2xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span>{c.cashierId}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition cursor-pointer"
              >
                <span>{isLoading ? "Starting Shift..." : "Sign In & Open POS Terminal"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* Return to Admin Link */}
          <div className="mt-5 border-t border-slate-100 pt-3 text-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Admin Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
