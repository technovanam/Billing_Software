import React, { useState, useMemo } from "react";
import { usePlatformBranches } from "../../../hooks/useSuperAdminFirestore";
import { GitBranch, Search, MapPin, Building, Smartphone, Warehouse, Users, Loader2 } from "lucide-react";

export default function BranchesList() {
  const { branches, loading } = usePlatformBranches();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase();
    return branches.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(q) ||
        (b.businessName || "").toLowerCase().includes(q) ||
        (b.location || b.city || "").toLowerCase().includes(q) ||
        (b.manager || b.managerName || "").toLowerCase().includes(q)
    );
  }, [branches, searchQuery]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Branches Management</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Monitor operating outlets, managers, and attached POS lanes across all active merchants.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branch, business, or city…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Loading branches from Firebase...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No branches found</h3>
            <p className="text-sm text-gray-500">There are no branches matching your criteria or existing in the database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="p-3.5 px-4">BRANCH NAME</th>
                  <th className="p-3.5 px-4">BUSINESS</th>
                  <th className="p-3.5 px-4">LOCATION</th>
                  <th className="p-3.5 px-4">MANAGER</th>
                  <th className="p-3.5 px-4">USERS</th>
                  <th className="p-3.5 px-4">GODOWNS</th>
                  <th className="p-3.5 px-4">POS TERMINALS</th>
                  <th className="p-3.5 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((b) => (
                  <tr key={b.id} className="text-sm transition-colors hover:bg-gray-50 group">
                    <td className="p-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-blue-600" />
                      <span>{b.name || b.branchName || "Unnamed Branch"}</span>
                    </td>
                    <td className="p-3.5 px-4 text-gray-800 font-medium">{b.businessName || "Unknown"}</td>
                    <td className="p-3.5 px-4 text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{b.location || b.city || "N/A"}</span>
                    </td>
                    <td className="p-3.5 px-4 text-gray-700">{b.manager || b.managerName || "Not Assigned"}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-600">{b.usersCount || 0}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-600">{b.godownsCount || 0}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-600">{b.terminalsCount || 0}</td>
                    <td className="p-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {b.status || "Active"}
                      </span>
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
