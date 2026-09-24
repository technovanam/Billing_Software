import React, { useState } from "react";
import { useLoginActivity } from "../../../hooks/useSuperAdminFirestore";
import { Clock, ShieldCheck, XCircle, Search, Laptop, Loader2 } from "lucide-react";

export default function LoginActivity() {
  const { loginActivity: activities, loading } = useLoginActivity();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = activities.filter((a) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (a.admin || "").toLowerCase().includes(q) ||
        (a.ip || "").includes(q) ||
        (a.device || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Admin Login Activity</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Historical log of all Super Admin and staff sign-in attempts, geolocations, and 2FA outcomes.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by admin email, IP, or browser…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Loading login activity from Firebase...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Laptop className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No login activity found</h3>
            <p className="text-sm text-gray-500">There are no administrative login records matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="p-3.5 px-4">ADMIN OPERATOR</th>
                  <th className="p-3.5 px-4">IP ADDRESS</th>
                  <th className="p-3.5 px-4">HARDWARE / DEVICE</th>
                  <th className="p-3.5 px-4">BROWSER CLIENT</th>
                  <th className="p-3.5 px-4">LOGIN TIME</th>
                  <th className="p-3.5 px-4">LOGOUT TIME</th>
                  <th className="p-3.5 px-4">RESULT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((act) => (
                  <tr key={act.id} className="text-sm transition-colors hover:bg-gray-50 group">
                    <td className="p-3.5 px-4 font-bold text-gray-900">{act.admin || "Unknown"}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-500">{act.ip || "N/A"}</td>
                    <td className="p-3.5 px-4 text-gray-700">{act.device || "Unknown Device"}</td>
                    <td className="p-3.5 px-4 text-gray-500">{act.browser || "Unknown Browser"}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-700">{act.loginTime || act.createdAt || "N/A"}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-500">{act.logoutTime || "Active"}</td>
                    <td className="p-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          act.result === "Successful" || act.result === "Success"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : "bg-rose-50 text-rose-700 border-rose-200/60"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${act.result === "Successful" || act.result === "Success" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {act.result || "Success"}
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
