import React, { useState } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { Database, Plus, Download, RotateCcw, Trash2, CheckCircle2, ShieldAlert } from "lucide-react";

export default function BackupsManagement() {
  const [backups, setBackups] = useState(() => superAdminService.getBackups());
  const [creating, setCreating] = useState(false);

  const handleCreateBackup = () => {
    setCreating(true);
    setTimeout(() => {
      superAdminService.createBackup();
      setBackups(superAdminService.getBackups());
      setCreating(false);
      alert("Point-in-time encrypted platform snapshot generated successfully.");
    }, 1200);
  };

  const handleRestore = (filename) => {
    if (confirm(`CRITICAL SECURITY ACTION: Are you sure you want to restore snapshot '${filename}'? Current data will be replaced.`)) {
      superAdminService.logAudit("BACKUP_RESTORED", "Database Snapshot", filename, "Platform", "Triggered emergency snapshot restoration");
      alert("Restoration initialized. Service health checks running.");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Database Backups & Snapshots</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Coldline multi-region snapshots, cryptographic verification, and disaster restoration drills.
          </p>
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={handleCreateBackup}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-sm flex items-center gap-2 transition disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          <span>{creating ? "Generating Snapshot…" : "Create On-Demand Backup"}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="p-3.5 px-4">BACKUP IMAGE FILE</th>
              <th className="p-3.5 px-4">COMPRESSED SIZE</th>
              <th className="p-3.5 px-4">TARGET VAULT</th>
              <th className="p-3.5 px-4">CREATED DATE</th>
              <th className="p-3.5 px-4">INTEGRITY STATUS</th>
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
                <td className="p-3.5 px-4 font-mono text-gray-700">{bak.size}</td>
                <td className="p-3.5 px-4 text-gray-500">{bak.storage}</td>
                <td className="p-3.5 px-4 text-gray-600 font-mono">{bak.createdDate}</td>
                <td className="p-3.5 px-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {bak.status}
                  </span>
                </td>
                <td className="p-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => alert(`Downloading signed encrypted snapshot URL for ${bak.filename}`)}
                      title="Download Encrypted Image"
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-500 hover:text-gray-900 border border-slate-200 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(bak.filename)}
                      title="Restore from Snapshot"
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 text-amber-600 border border-slate-200 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
