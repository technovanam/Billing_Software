import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { UserCheck, Shield, ChevronDown, Plus, X, Users, RefreshCw } from "lucide-react";
import axios from "axios";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const BACKEND = "http://localhost:5000";
const STORAGE_KEY_OPERATOR = "wh_operatorName";
const STORAGE_KEY_ROLE = "wh_userRole";

export const ROLES = {
  ADMIN: "Admin",
  STAFF: "Warehouse Staff",
  MANAGER: "Manager",
};

export const OperatorContext = createContext(null);

export const useOperator = () => {
  const context = useContext(OperatorContext);
  if (!context) {
    throw new Error("useOperator must be used within an OperatorProvider");
  }
  return context;
};

export const OperatorProvider = ({ children }) => {
  const [operatorName, setOperatorNameState] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY_OPERATOR) || "Warehouse Staff";
  });

  const [role, setRoleState] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY_ROLE) || ROLES.ADMIN;
  });

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [customName, setCustomName] = useState("");
  const [saveToStaff, setSaveToStaff] = useState(false);

  // Helper: get Firebase ID token for authenticated backend calls
  const getAuthHeader = useCallback(async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        return { Authorization: `Bearer ${token}` };
      }
    } catch (_) {}
    return {};
  }, []);

  // Fetch staff list from backend
  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${BACKEND}/warehouse/staff`, { headers });
      if (res.data?.success) {
        setStaffList(res.data.data || []);
      }
    } catch {
      // Backend unconfigured or network issue — graceful fallback
      setStaffList([]);
    } finally {
      setLoadingStaff(false);
    }
  }, [getAuthHeader]);

  // Staff endpoint requires a Firebase token, so wait until a user is signed in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      if (user) fetchStaff();
      else setStaffList([]);
    });
    return unsubscribe;
  }, [fetchStaff]);

  const setOperatorName = useCallback((name) => {
    const trimmed = (name || "").trim();
    setOperatorNameState(trimmed);
    if (trimmed) {
      sessionStorage.setItem(STORAGE_KEY_OPERATOR, trimmed);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_OPERATOR);
    }
  }, []);

  const setRole = useCallback((newRole) => {
    if (Object.values(ROLES).includes(newRole)) {
      setRoleState(newRole);
      sessionStorage.setItem(STORAGE_KEY_ROLE, newRole);
    }
  }, []);

  // Soft UI guardrails (Decision #4)
  const hasPermission = useCallback((feature) => {
    switch (feature) {
      case "scan":
      case "stock_in":
      case "stock_out":
        return role === ROLES.ADMIN || role === ROLES.STAFF;
      case "transfer":
        return role === ROLES.ADMIN || role === ROLES.MANAGER || role === ROLES.STAFF;
      case "manage_godowns":
      case "manage_staff":
        return role === ROLES.ADMIN;
      case "manage_products":
        return role === ROLES.ADMIN;
      case "view_dashboard":
      case "view_reports":
      case "view_movements":
        return true;
      default:
        return true;
    }
  }, [role]);

  const openPicker = () => {
    setCustomName("");
    setSaveToStaff(false);
    fetchStaff();
    setIsPickerOpen(true);
  };

  const closePicker = () => setIsPickerOpen(false);

  const selectOperator = async (name) => {
    const finalName = name.trim();
    if (!finalName) return;
    setOperatorName(finalName);

    if (saveToStaff && !staffList.some((s) => s.name?.toLowerCase() === finalName.toLowerCase())) {
      try {
        const headers = await getAuthHeader();
        await axios.post(`${BACKEND}/warehouse/staff`, { name: finalName }, { headers });
        fetchStaff();
      } catch (_) {}
    }

    setIsPickerOpen(false);
  };

  return (
    <OperatorContext.Provider
      value={{
        operatorName,
        setOperatorName,
        role,
        setRole,
        hasPermission,
        openPicker,
        openRoleModal: () => setIsRoleModalOpen(true),
        staffList,
        fetchStaff,
      }}
    >
      {children}

      {/* Operator Selection Modal ("Who's scanning?") */}
      {isPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closePicker}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Who&apos;s Scanning?</h3>
                  <p className="text-xs text-slate-500">Stamp your name on warehouse stock movements</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Existing staff quick selection */}
              {staffList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Select Staff Member
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {staffList.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectOperator(s.name)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          operatorName === s.name
                            ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                            {s.name[0]?.toUpperCase()}
                          </div>
                          <span>{s.name}</span>
                        </div>
                        {operatorName === s.name && (
                          <span className="text-xs font-bold text-blue-600">Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Or type a new name */}
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Or Enter Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customName.trim()) {
                        selectOperator(customName);
                      }
                    }}
                    placeholder="e.g. Ravi, Priya, Anil"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all text-slate-900"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => selectOperator(customName)}
                    disabled={!customName.trim()}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    Set
                  </button>
                </div>

                <label className="mt-2.5 flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={saveToStaff}
                    onChange={(e) => setSaveToStaff(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Save to staff list for future sessions
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Selection Modal */}
      {isRoleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsRoleModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Switch Session Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Soft UI guardrail only. Adjusts buttons and navigation visibility for this browser session.
            </p>

            <div className="mt-4 space-y-2">
              {Object.values(ROLES).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r);
                    setIsRoleModalOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                    role === r
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span>{r}</span>
                  {role === r && <span className="text-xs font-semibold text-blue-600">Selected</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </OperatorContext.Provider>
  );
};

OperatorProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Operator banner disabled per user request
export const OperatorBanner = () => null;
