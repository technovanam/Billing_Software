import React, { useState, useMemo } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { GitBranch, Search, MapPin, Building, Smartphone, Warehouse, Users } from "lucide-react";

export default function BranchesList() {
  const [branches] = useState(() => superAdminService.getBranches());
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.businessName.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        b.manager.toLowerCase().includes(q)
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
                    <span>{b.name}</span>
                  </td>
                  <td className="p-3.5 px-4 text-gray-800 font-medium">{b.businessName}</td>
                  <td className="p-3.5 px-4 text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>{b.location}</span>
                  </td>
                  <td className="p-3.5 px-4 text-gray-700">{b.manager}</td>
                  <td className="p-3.5 px-4 font-mono text-gray-600">{b.usersCount}</td>
                  <td className="p-3.5 px-4 font-mono text-gray-600">{b.godownsCount}</td>
                  <td className="p-3.5 px-4 font-mono text-gray-600">{b.terminalsCount}</td>
                  <td className="p-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {b.status}
                    </span>
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
