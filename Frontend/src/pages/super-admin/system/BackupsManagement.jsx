import React, { useState } from "react";
import { useBackups } from "../../../hooks/useSuperAdminFirestore";
import { createBackup, getBackupDownloadUrl } from "../../../services/superAdminApi";
import { Database, Plus, Download, Loader2 } from "lucide-react";

const STATUS_STYLES = {
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  Running: "bg-blue-50 text-blue-700 border-blue-200/60",
  Failed: "bg-rose-50 text-rose-700 border-rose-200/60",
};

// Backups are real Firestore exports made by the backend and stored in Cloud Storage.
export default function BackupsManagement() {
  const { backups: rawBackups, loading, error } = useBackups();
  const [creating, setCreating] = useState(false);
  const backups = [...rawBackups].sort((a, b) => String(b.createdDate || "").localeCompare(String(a.createdDate || "")));

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const result = await createBackup();
      alert(`Backup complete: ${result.documents} documents exported.`);
    } catch (err) {
      alert(`Backup failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (bak) => {
    try {
      const { url } = await getBackupDownloadUrl(bak.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Database Backups & Snapshots</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Full Firestore exports (gzipped JSON) stored in Cloud Storage.
          </p>
        </div>

        <button
          type="button"
          disabled={creating || loading}
          onClick={handleCreateBackup}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-sm flex items-center gap-2 transition disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>{creating ? "Generating Snapshot…" : "Create On-Demand Backup"}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Loading backups from Firebase...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-rose-700 bg-rose-50">Could not load backups: {error}</div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Database className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No backups found</h3>
            <p className="text-sm text-gray-500">There are no snapshots available in the system yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="p-3.5 px-4">BACKUP IMAGE FILE</th>
                  <th className="p-3.5 px-4">COMPRESSED SIZE</th>
                  <th className="p-3.5 px-4">TARGET VAULT</th>
                  <th className="p-3.5 px-4">CREATED DATE</th>
                  <th className="p-3.5 px-4">STATUS</th>
                  <th className="p-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map((bak) => (
                  <tr key={bak.id} className="text-sm transition-colors hover:bg-gray-50 group">
                    <td className="p-3.5 px-4 font-mono font-bold text-blue-600 flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-gray-400" />
                      <span>{bak.filename}</span>
                    </td>
                    <td className="p-3.5 px-4 font-mono text-gray-700">{bak.size || "-"}{bak.documents ? ` · ${bak.documents} docs` : ""}</td>
                    <td className="p-3.5 px-4 text-gray-500">{bak.storage}</td>
                    <td className="p-3.5 px-4 text-gray-600 font-mono">
                      {bak.createdDate ? new Date(bak.createdDate).toLocaleString() : (bak.createdAt ? new Date(bak.createdAt).toLocaleString() : "Unknown")}
                    </td>
                    <td className="p-3.5 px-4">
                      <span
                        title={bak.error || ""}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[bak.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                      >
                        {bak.status || "Unknown"}
                      </span>
                    </td>
                    <td className="p-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={bak.status !== "Completed"}
                          onClick={() => handleDownload(bak)}
                          title="Download backup file"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-gray-500 hover:text-gray-900 border border-slate-200 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
