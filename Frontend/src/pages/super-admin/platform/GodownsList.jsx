import React, { useState, useMemo } from "react";
import { usePlatformGodowns } from "../../../hooks/useSuperAdminFirestore";
import { Warehouse, Search, Package, IndianRupee, Loader2 } from "lucide-react";

export default function GodownsList() {
  const { godowns, loading } = usePlatformGodowns();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return godowns;
    const q = searchQuery.toLowerCase();
    return godowns.filter(
      (g) =>
        (g.name || g.godownName || "").toLowerCase().includes(q) ||
        (g.businessName || "").toLowerCase().includes(q) ||
        (g.branch || g.branchName || "").toLowerCase().includes(q) ||
        (g.manager || g.managerName || "").toLowerCase().includes(q)
    );
  }, [godowns, searchQuery]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Godowns / Warehouses</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Super Admin administration and stock telemetry across tenant warehouses and buffer depots.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search warehouse, business, or manager…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Loading godowns from Firebase...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Warehouse className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No godowns found</h3>
            <p className="text-sm text-gray-500">There are no godowns matching your criteria or existing in the database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="p-3.5 px-4">GODOWN NAME</th>
                  <th className="p-3.5 px-4">BUSINESS</th>
                  <th className="p-3.5 px-4">ASSIGNED BRANCH</th>
                  <th className="p-3.5 px-4">MANAGER</th>
                  <th className="p-3.5 px-4">SKU COUNT</th>
                  <th className="p-3.5 px-4">STOCK QUANTITY</th>
                  <th className="p-3.5 px-4">STOCK VALUATION</th>
                  <th className="p-3.5 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((g) => (
                  <tr key={g.id} className="text-sm transition-colors hover:bg-gray-50 group">
                    <td className="p-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-indigo-600" />
                      <span>{g.name || g.godownName || "Unnamed Godown"}</span>
                    </td>
                    <td className="p-3.5 px-4 text-gray-800 font-medium">{g.businessName || "Unknown"}</td>
                    <td className="p-3.5 px-4 text-gray-500">{g.branch || g.branchName || "N/A"}</td>
                    <td className="p-3.5 px-4 text-gray-700">{g.manager || g.managerName || "Not Assigned"}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-600">{g.productCount || 0} SKUs</td>
                    <td className="p-3.5 px-4 font-mono text-gray-800 font-medium">{(g.stockQuantity || 0).toLocaleString()} units</td>
                    <td className="p-3.5 px-4 font-mono font-bold text-emerald-600">
                      ₹{((g.stockValue || 0) / 100000).toFixed(2)} Lakhs
                    </td>
                    <td className="p-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {g.status || "Active"}
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
