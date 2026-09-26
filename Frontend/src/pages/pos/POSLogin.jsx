import React, { useState, useContext, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Store,
  User,
  ArrowRight,
  ArrowLeft,
  Lock,
  MonitorSmartphone,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth } from "../../lib/firebase/config";
import { AuthContext } from "../../context/AuthContext";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { cashierLogin, getRegisteredDevice, registerThisDevice } from "../../services/posService";

// Cashier sign-in on a registered POS device: cashier ID + 4-digit PIN,
// checked by the backend (5 wrong PINs lock the ID for 15 minutes).
export default function POSLogin() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { success: toastSuccess, error: toastError } = useToast();

  const [device, setDevice] = useState(getRegisteredDevice());
  const [cashierId, setCashierId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Owner quick registration modal/form state
  const [showOwnerRegister, setShowOwnerRegister] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("owner.demo@technovanam.in");
  const [ownerPassword, setOwnerPassword] = useState("Owner@123");
  const [terminalName, setTerminalName] = useState("Main Counter Terminal");
  const [counterNumber, setCounterNumber] = useState("Counter 01");
  const [registeringDevice, setRegisteringDevice] = useState(false);

  useEffect(() => {
    setDevice(getRegisteredDevice());
  }, []);

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

  const handleRegisterTerminal = async (e) => {
    e.preventDefault();
    setError(null);
    if (!ownerEmail.trim() || !ownerPassword) {
      setError("Please provide the store owner email and password.");
      return;
    }
    setRegisteringDevice(true);
    try {
      // 1. Authenticate as owner if needed
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, ownerEmail.trim(), ownerPassword);

      // 2. Register this device on backend
      const registered = await registerThisDevice({
        name: terminalName.trim() || "Counter Terminal",
        counter: counterNumber.trim() || "Counter 01",
      });

      setDevice(registered);
      setShowOwnerRegister(false);
      toastSuccess(`Terminal successfully registered as "${registered.name}"! You can now log in.`);
    } catch (err) {
      console.error("Device registration error:", err);
      setError(err.message || "Failed to register this device. Check owner credentials.");
    } finally {
      setRegisteringDevice(false);
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
            <div className="space-y-4" data-testid="device-not-registered">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <MonitorSmartphone className="h-6 w-6" />
                </div>
                <p className="text-base font-bold text-slate-900">This device is not registered for POS</p>
                <p className="text-xs text-slate-600">
                  Counter devices must be registered once by the Store Owner before cashiers can log in with their PIN.
                </p>
              </div>

              {!showOwnerRegister ? (
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOwnerRegister(true)}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm active:scale-[0.99] transition"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Register This Device (Owner Auth)
                  </button>

                  <Link
                    to="/signin"
                    className="w-full flex justify-center items-center gap-1 py-2 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    Sign In to Store Admin Portal <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleRegisterTerminal} className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Store Owner Authentication
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOwnerRegister(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Store Owner Email
                    </label>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner.demo@technovanam.in"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Store Owner Password
                    </label>
                    <input
                      type="password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Owner@123"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Terminal Name
                      </label>
                      <input
                        type="text"
                        value={terminalName}
                        onChange={(e) => setTerminalName(e.target.value)}
                        placeholder="Counter 01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Counter Label
                      </label>
                      <input
                        type="text"
                        value={counterNumber}
                        onChange={(e) => setCounterNumber(e.target.value)}
                        placeholder="Counter 01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
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
                    disabled={registeringDevice}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition"
                  >
                    {registeringDevice ? "Registering Device..." : "Register & Enable Terminal"}
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200/80 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {device.name} {device.counter ? `(${device.counter})` : ""}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-100/60 px-1.5 py-0.5 rounded">
                  Registered
                </span>
              </div>

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
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {isLoading ? "Signing in..." : "Start billing"} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => navigate("/signin")}
              className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>

            {device && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("pos_device");
                  setDevice(null);
                }}
                className="text-[11px] text-slate-400 hover:text-red-600 transition"
              >
                Switch Device
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
