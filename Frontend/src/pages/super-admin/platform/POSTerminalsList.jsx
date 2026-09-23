import React, { useState, useMemo } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { Smartphone, Search, Power, RotateCw, LogOut, CheckCircle, AlertTriangle, XOctagon } from "lucide-react";

export default function POSTerminalsList() {
  const [terminals, setTerminals] = useState(() => superAdminService.getTerminals());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const handleToggleTerminal = (id, currentStatus) => {
    const next = currentStatus === "Online" || currentStatus === "Offline" ? "Blocked" : "Online";
    superAdminService.updateTerminalStatus(id, next);
    setTerminals(superAdminService.getTerminals());
  };

  const handleResetTerminal = (id) => {
    superAdminService.logAudit("TERMINAL_RESET", "POS Terminal", id, "Platform", `Triggered cache flush and restart on terminal ${id}`);
    alert(`Remote hardware flush & session reset dispatched to terminal ${id}.`);
  };

  const filtered = useMemo(() => {
    return terminals.filter((t) => {
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.businessName.toLowerCase().includes(q) ||
          t.device.toLowerCase().includes(q) ||
          t.assignedCashier.toLowerCase().includes(q)
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
              {filtered.map((t) => (
                <tr key={t.id} className="text-sm transition-colors hover:bg-gray-50 group">
                  <td className="p-3.5 px-4 font-mono font-bold text-blue-600 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-gray-400" />
                    <span>{t.id}</span>
                  </td>
                  <td className="p-3.5 px-4 text-gray-800 font-medium">{t.businessName}</td>
                  <td className="p-3.5 px-4 text-gray-500">{t.branch}</td>
                  <td className="p-3.5 px-4 text-gray-700">{t.device}</td>
                  <td className="p-3.5 px-4 font-medium text-gray-800">{t.assignedCashier}</td>
                  <td className="p-3.5 px-4 text-gray-500">{t.lastActive}</td>
                  <td className="p-3.5 px-4 font-mono text-[11px] text-gray-600">{t.appVersion}</td>
                  <td className="p-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.status === "Online"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : t.status === "Offline"
                          ? "bg-gray-100 text-gray-600 border-gray-200"
                          : "bg-rose-50 text-rose-700 border-rose-200/60"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          t.status === "Online"
                            ? "bg-emerald-500"
                            : t.status === "Offline"
                            ? "bg-gray-400"
                            : "bg-rose-500"
                        }`}
                      />
                      {t.status}
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
                        onClick={() => handleToggleTerminal(t.id, t.status)}
                        title={t.status === "Blocked" ? "Unblock Terminal" : "Block Terminal"}
                        className={`p-1.5 rounded-lg border transition ${
                          t.status === "Blocked"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
