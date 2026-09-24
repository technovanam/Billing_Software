import React, { useState, useMemo } from "react";
import { usePlatformTerminals } from "../../../hooks/useSuperAdminFirestore";
import { Smartphone, Search, Power, RotateCw, LogOut, CheckCircle, AlertTriangle, XOctagon, Loader2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/config";

export default function POSTerminalsList() {
  const { terminals, loading } = usePlatformTerminals();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const handleToggleTerminal = async (id, currentStatus, path) => {
    if (!path) return alert("Firebase path is missing for this terminal.");
    const next = currentStatus === "Online" || currentStatus === "Offline" ? "Blocked" : "Online";
    try {
      await updateDoc(doc(db, path), { status: next });
    } catch (e) {
      console.error(e);
      alert("Failed to update terminal status.");
    }
  };

  const handleResetTerminal = (id) => {
    alert(`Remote hardware flush & session reset dispatched to terminal ${id}. (Mock action, requires backend integration)`);
  };

  const filtered = useMemo(() => {
    return terminals.filter((t) => {
      const status = t.status || "Offline";
      if (statusFilter !== "All" && status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          (t.businessName || "").toLowerCase().includes(q) ||
          (t.device || t.deviceName || "").toLowerCase().includes(q) ||
          (t.assignedCashier || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [terminals, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">POS Terminals Management</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Monitor connected Android POS, iPads, and Windows billing counters across all merchant lanes.
        </p>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terminal ID, device, business…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none w-full sm:w-auto cursor-pointer"
        >
          <option value="All">All Terminal Statuses</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Blocked">Blocked</option>
          <option value="Maintenance">Maintenance</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Loading POS terminals from Firebase...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No terminals found</h3>
            <p className="text-sm text-gray-500">There are no POS terminals matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="p-3.5 px-4">TERMINAL ID</th>
                  <th className="p-3.5 px-4">BUSINESS</th>
                  <th className="p-3.5 px-4">BRANCH</th>
                  <th className="p-3.5 px-4">HARDWARE / DEVICE</th>
                  <th className="p-3.5 px-4">CASHIER</th>
                  <th className="p-3.5 px-4">LAST PING</th>
                  <th className="p-3.5 px-4">APP VERSION</th>
                  <th className="p-3.5 px-4">STATUS</th>
                  <th className="p-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const status = t.status || "Offline";
                  return (
                    <tr key={t.id} className="text-sm transition-colors hover:bg-gray-50 group">
                      <td className="p-3.5 px-4 font-mono font-bold text-blue-600 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-gray-400" />
                        <span>{t.id.substring(0, 8)}</span>
                      </td>
                      <td className="p-3.5 px-4 text-gray-800 font-medium">{t.businessName || "Unknown"}</td>
                      <td className="p-3.5 px-4 text-gray-500">{t.branch || "N/A"}</td>
                      <td className="p-3.5 px-4 text-gray-700">{t.device || t.deviceName || "Unknown Device"}</td>
                      <td className="p-3.5 px-4 font-medium text-gray-800">{t.assignedCashier || "N/A"}</td>
                      <td className="p-3.5 px-4 text-gray-500">{t.lastActive || "Never"}</td>
                      <td className="p-3.5 px-4 font-mono text-[11px] text-gray-600">{t.appVersion || "1.0.0"}</td>
                      <td className="p-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            status === "Online"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                              : status === "Offline"
                              ? "bg-gray-100 text-gray-600 border-gray-200"
                              : "bg-rose-50 text-rose-700 border-rose-200/60"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === "Online"
                                ? "bg-emerald-500"
                                : status === "Offline"
                                ? "bg-gray-400"
                                : "bg-rose-500"
                            }`}
                          />
                          {status}
                        </span>
                      </td>
                      <td className="p-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleResetTerminal(t.id)}
                            title="Remote Terminal Reset"
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-500 hover:text-gray-900 border border-slate-200 transition"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTerminal(t.id, status, t.path)}
                            title={status === "Blocked" ? "Unblock Terminal" : "Block Terminal"}
                            className={`p-1.5 rounded-lg border transition ${
                              status === "Blocked"
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
