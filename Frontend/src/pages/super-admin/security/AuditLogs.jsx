import React, { useState, useMemo } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { FileText, Search, Download, ShieldCheck, Laptop, Clock, Filter, Eye, X } from "lucide-react";

export default function AuditLogs() {
  const [logs] = useState(() => superAdminService.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [selectedLog, setSelectedLog] = useState(null);

  const actionList = [
    "All",
    "ADMIN_LOGIN",
    "ADMIN_LOGOUT",
    "IMPERSONATION_STARTED",
    "IMPERSONATION_ENDED",
    "BUSINESS_SUSPENDED",
    "BUSINESS_ACTIVATED",
    "PLAN_CHANGED",
    "PAYMENT_REFUNDED",
    "SETTINGS_CHANGED",
  ];

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== "All" && l.action !== actionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.action.toLowerCase().includes(q) ||
          l.admin.toLowerCase().includes(q) ||
          l.business.toLowerCase().includes(q) ||
          (l.details || "").toLowerCase().includes(q) ||
          l.ip.includes(q)
        );
      }
      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  const handleExportCSV = () => {
    const headers = ["Timestamp,Admin,Action,Entity,EntityID,Business,IP,Result,Details\n"];
    const rows = filtered.map((l) =>
      [
        `"${l.timestamp}"`,
        l.admin,
        l.action,
        l.entity,
        l.entityId,
        `"${l.business}"`,
        l.ip,
        l.result,
        `"${(l.details || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const blob = new Blob([headers.join("") + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">System Audit Logs</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Immutable, tamper-evident chronological event trail for every administrative action.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold flex items-center gap-2 transition shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Trail</span>
        </button>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, admin, IP, or tenant…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none w-full sm:w-auto cursor-pointer"
        >
          {actionList.map((act) => (
            <option key={act} value={act}>{act}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">TIMESTAMP</th>
                <th className="p-3.5 px-4">ADMIN OPERATOR</th>
                <th className="p-3.5 px-4">ACTION CODE</th>
                <th className="p-3.5 px-4">TARGET ENTITY</th>
                <th className="p-3.5 px-4">BUSINESS / TENANT</th>
                <th className="p-3.5 px-4">ORIGIN IP</th>
                <th className="p-3.5 px-4">RESULT</th>
                <th className="p-3.5 px-4 text-right">INSPECT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((log) => (
                <tr key={log.id} className="text-sm transition-colors hover:bg-gray-50 group">
                  <td className="p-3.5 px-4 font-mono text-gray-500">{log.timestamp}</td>
                  <td className="p-3.5 px-4 font-medium text-gray-800">{log.admin}</td>
                  <td className="p-3.5 px-4 font-mono font-bold text-blue-600">{log.action}</td>
                  <td className="p-3.5 px-4 text-gray-600">{log.entity}</td>
                  <td className="p-3.5 px-4 text-gray-900 font-medium">{log.business}</td>
                  <td className="p-3.5 px-4 font-mono text-gray-400">{log.ip}</td>
                  <td className="p-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {log.result}
                    </span>
                  </td>
                  <td className="p-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-500 hover:text-gray-900 border border-slate-200 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900">Audit Event Forensics: {selectedLog.id}</h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Timestamp:</span>
                <span className="font-mono text-gray-900">{selectedLog.timestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Action:</span>
                <strong className="text-blue-600 font-mono">{selectedLog.action}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Admin:</span>
                <span className="text-gray-900">{selectedLog.admin}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Origin IP:</span>
                <span className="font-mono text-gray-900">{selectedLog.ip}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Device Fingerprint:</span>
                <span className="text-gray-900">{selectedLog.device}</span>
              </div>
              <div className="py-2">
                <span className="text-gray-400 block mb-1">Details & Justification:</span>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-gray-800">
                  {selectedLog.details || "No secondary parameters logged."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
