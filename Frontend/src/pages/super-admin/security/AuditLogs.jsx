import React, { useState, useMemo } from "react";
import { useAuditLogs } from "../../../hooks/useSuperAdminFirestore";
import { FileText, Search, Download, ShieldCheck, Laptop, Clock, Filter, Eye, X, Loader2 } from "lucide-react";

export default function AuditLogs() {
  const { auditLogs: logs, loading } = useAuditLogs();
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
      const action = l.action || "UNKNOWN";
      if (actionFilter !== "All" && action !== actionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          action.toLowerCase().includes(q) ||
          (l.admin || "").toLowerCase().includes(q) ||
          (l.business || "").toLowerCase().includes(q) ||
          (l.details || "").toLowerCase().includes(q) ||
          (l.ip || "").includes(q)
        );
      }
      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  const handleExportCSV = () => {
    if (filtered.length === 0) return alert("No logs to export.");
    const headers = ["Timestamp,Admin,Action,Entity,EntityID,Business,IP,Result,Details\n"];
    const rows = filtered.map((l) =>
      [
        `"${l.timestamp || l.createdAt}"`,
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
          disabled={loading || filtered.length === 0}
          className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-xs font-semibold flex items-center gap-2 transition shadow-sm"
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
          {actionList.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Loading audit logs from Firebase...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No audit logs found</h3>
            <p className="text-sm text-gray-500">There are no administrative events matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="p-3.5 px-4">TIMESTAMP</th>
                  <th className="p-3.5 px-4">ADMIN ACTOR</th>
                  <th className="p-3.5 px-4">ACTION</th>
                  <th className="p-3.5 px-4">TARGET BUSINESS</th>
                  <th className="p-3.5 px-4">IP TRACE</th>
                  <th className="p-3.5 px-4">STATUS</th>
                  <th className="p-3.5 px-4 text-right">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="text-sm transition-colors hover:bg-gray-50 group">
                    <td className="p-3.5 px-4 font-mono text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {l.timestamp || l.createdAt || "Unknown Date"}
                      </div>
                    </td>
                    <td className="p-3.5 px-4 font-bold text-gray-900">{l.admin || "System"}</td>
                    <td className="p-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-gray-700">
                        {l.action || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="p-3.5 px-4 font-medium text-gray-800">{l.business || "Global"}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-400">{l.ip || "N/A"}</td>
                    <td className="p-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          l.result === "Success"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : "bg-rose-50 text-rose-700 border-rose-200/60"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            l.result === "Success" ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        {l.result || "Success"}
                      </span>
                    </td>
                    <td className="p-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(l)}
                        className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition shadow-sm"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Audit Log Details
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Timestamp</label>
                  <p className="font-mono text-gray-900">{selectedLog.timestamp || selectedLog.createdAt || "Unknown"}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Actor</label>
                  <p className="font-medium text-gray-900">{selectedLog.admin || "System"}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Action Type</label>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-bold text-gray-700">
                    {selectedLog.action || "UNKNOWN"}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Status Result</label>
                  <span className={`font-bold ${selectedLog.result === "Success" ? "text-emerald-600" : "text-rose-600"}`}>
                    {selectedLog.result || "Success"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-500 block mb-1">Target Entity Path</label>
                <p className="font-mono text-gray-800 bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                  {selectedLog.entity || "Global"} / {selectedLog.entityId || "N/A"}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-500 block mb-1">Payload / Details</label>
                <div className="font-mono text-gray-700 bg-slate-900 text-green-400 p-3 rounded-xl overflow-x-auto text-[11px] whitespace-pre-wrap">
                  {selectedLog.details || "{ \"status\": \"Executed with no additional details\" }"}
                </div>
              </div>
            </div>

            <div className="pt-6 mt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition"
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
