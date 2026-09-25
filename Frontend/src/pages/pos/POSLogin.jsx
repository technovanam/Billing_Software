import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Store, User, ArrowRight, ArrowLeft, Lock, MonitorSmartphone, AlertTriangle } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { cashierLogin, getRegisteredDevice } from "../../services/posService";

// Cashier sign-in on a registered POS device: cashier ID + 4-digit PIN,
// checked by the backend (5 wrong PINs lock the ID for 15 minutes).
export default function POSLogin() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { success: toastSuccess } = useToast();
  const device = getRegisteredDevice();

  const [cashierId, setCashierId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const companyName = companyProfile?.companyName || "Techno Vanam";
  const companyLogo = companyProfile?.logoURL || "/Icon@4x-8.png";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    if (!cashierId.trim() || !/^\d{4}$/.test(pin)) {
      setError("Enter your cashier ID and 4-digit PIN.");
      return;
    }
    setIsLoading(true);
    try {
      const session = await cashierLogin({ cashierId: cashierId.trim(), pin });
      toastSuccess(`Welcome ${session.cashierName}! Opening the billing terminal...`);
      navigate("/pos/billing", { replace: true });
    } catch (err) {
      setError(err.message || "Sign in failed.");
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-white shadow-md border border-slate-200 p-2">
            <img src={companyLogo} alt="Logo" className="h-full w-full object-contain" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">{companyName}</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            <Store className="h-3.5 w-3.5" /> Cashier POS Portal
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl sm:px-10 border border-slate-200">
          {!device ? (
            <div className="space-y-3 text-center" data-testid="device-not-registered">
              <MonitorSmartphone className="mx-auto h-10 w-10 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">This device is not registered for POS</p>
              <p className="text-xs text-slate-600">
                The owner must register it once: sign in as the owner, open <strong>Cashier Management</strong>, and choose{" "}
                <strong>Register this device for POS</strong>.
              </p>
              {user?.role === "owner" && (
                <Link to="/cashiers" className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                  Open Cashier Management <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleLogin}>
              <p className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                <MonitorSmartphone className="h-3.5 w-3.5" /> {device.name}
                {device.counter ? ` · ${device.counter}` : ""}
              </p>

              <div>
                <label htmlFor="cashierId" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Cashier ID
                </label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="cashierId"
                    type="text"
                    autoComplete="username"
                    value={cashierId}
                    onChange={(e) => setCashierId(e.target.value.toUpperCase())}
                    placeholder="e.g. CSH-001"
                    className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pin" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  4-Digit PIN
                </label>
                <div className="mt-1 relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {error && (
                <p className="flex gap-1.5 rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert" data-testid="pos-login-error">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Start billing"} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
          <button type="button" onClick={() => navigate("/signin")} className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}
