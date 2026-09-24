import React, { useState, useEffect } from "react";
import { useMaintenanceMode } from "../../../hooks/useSuperAdminFirestore";
import { AlertOctagon, Power, Save, CheckCircle2, ShieldAlert, Clock, Bell, Loader2 } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/config";

export default function MaintenanceMode() {
  const { maintenance: dbMaintenance, loading } = useMaintenanceMode();
  
  const [maintenance, setMaintenance] = useState({
    enabled: false,
    bannerMessage: "The platform is currently down for scheduled maintenance. Services will resume shortly.",
    scheduledStart: "",
    scheduledEnd: "",
    allowSuperAdminBypass: true
  });
  
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (dbMaintenance) {
      setMaintenance(prev => ({
        ...prev,
        ...dbMaintenance
      }));
    }
  }, [dbMaintenance]);

  const handleToggle = async () => {
    const nextEnabled = !maintenance.enabled;
    setIsToggling(true);
    try {
      await setDoc(doc(db, "system", "maintenance"), {
        ...maintenance,
        enabled: nextEnabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error(err);
      alert("Failed to toggle maintenance mode.");
    } finally {
      setIsToggling(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, "system", "maintenance"), {
        ...maintenance,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to update maintenance settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Maintenance Mode</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Suspend customer write operations during major architectural migrations or schema upgrades.
          </p>
        </div>

        {saved && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Maintenance Schedule Updated</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Loading maintenance state from Firebase...</p>
        </div>
      ) : (
        <>
          {/* Main Switch Card */}
          <div
            className={`p-6 rounded-2xl border transition shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
              maintenance.enabled
                ? "bg-rose-50/70 border-rose-200 ring-2 ring-rose-500/20"
                : "bg-white border-slate-100"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    maintenance.enabled ? "bg-rose-600 text-white shadow-md shadow-rose-500/30" : "bg-slate-100 text-gray-500"
                  }`}
                >
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">Live Platform Maintenance Mode</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        maintenance.enabled
                          ? "bg-rose-600 text-white border-rose-500 animate-pulse"
                          : "bg-slate-100 text-gray-600 border-slate-200"
                      }`}
                    >
                      {maintenance.enabled ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
                    When activated, non-admin users will see a polite service notice. Offline POS caching will remain active
                    so store cashiers can continue printing local receipts uninterrupted.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggle}
                disabled={isToggling}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50 ${
                  maintenance.enabled
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                <span>{maintenance.enabled ? "Disable Maintenance Mode" : "Activate Maintenance Mode"}</span>
              </button>
            </div>
          </div>

          {/* Maintenance Customization Form */}
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Advance Notice & Tenant Broadcast Window</h3>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Customer Dashboard Banner Message</label>
                <textarea
                  rows={3}
                  value={maintenance.bannerMessage}
                  onChange={(e) => setMaintenance({ ...maintenance, bannerMessage: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Scheduled Window Start</label>
                  <input
                    type="datetime-local"
                    value={maintenance.scheduledStart}
                    onChange={(e) => setMaintenance({ ...maintenance, scheduledStart: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Scheduled Window End</label>
                  <input
                    type="datetime-local"
                    value={maintenance.scheduledEnd}
                    onChange={(e) => setMaintenance({ ...maintenance, scheduledEnd: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={maintenance.allowSuperAdminBypass}
                    onChange={(e) => setMaintenance({ ...maintenance, allowSuperAdminBypass: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0"
                  />
                  <span>Allow Super Admin and staff bypass during maintenance window</span>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-bold text-white flex items-center gap-2 shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? "Saving..." : "Update Window Settings"}</span>
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
