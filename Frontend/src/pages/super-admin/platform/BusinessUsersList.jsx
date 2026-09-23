import React, { useState, useMemo } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { Users, Search, Filter, ShieldCheck, XCircle, CheckCircle2, RotateCcw, LogOut, Download } from "lucide-react";

export default function BusinessUsersList() {
  const [users, setUsers] = useState(() => superAdminService.getUsers());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");

  const handleToggleStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === "Active" ? "Suspended" : "Active";
    superAdminService.toggleUserStatus(id, nextStatus);
    setUsers(superAdminService.getUsers());
  };

  const handleForceLogout = (id, name) => {
    superAdminService.logAudit("FORCE_LOGOUT", "User", id, "Platform", `Forced logout for user ${name}`);
    alert(`Successfully invalidated all active sessions for ${name}.`);
  };

  const handleResetPassword = (email) => {
    alert(`Temporary password reset token dispatched to ${email}.`);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== "All" && u.status !== statusFilter) return false;
      if (roleFilter !== "All" && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.businessName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, statusFilter, roleFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Business Users Directory</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Directory of all owners, managers, and cashiers across platform tenants.
          </p>
        </div>
      </div>

      {/* Filters (White Card) */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or business…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none cursor-pointer"
          >
            <option value="All">All Roles</option>
            <option value="Business Owner">Business Owner</option>
            <option value="Cashier">Cashier</option>
            <option value="Store Manager">Store Manager</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">NAME</th>
                <th className="p-3.5 px-4">EMAIL</th>
                <th className="p-3.5 px-4">BUSINESS</th>
                <th className="p-3.5 px-4">ROLE</th>
                <th className="p-3.5 px-4">BRANCH</th>
                <th className="p-3.5 px-4">STATUS</th>
                <th className="p-3.5 px-4">LAST LOGIN</th>
                <th className="p-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">No users found.</td></tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="text-sm transition-colors hover:bg-gray-50 group">
                    <td className="p-3.5 px-4 font-bold text-gray-900">{u.name}</td>
                    <td className="p-3.5 px-4 text-gray-500">{u.email}</td>
                    <td className="p-3.5 px-4 font-medium text-gray-800">{u.businessName}</td>
                    <td className="p-3.5 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-medium text-gray-700">{u.role}</span></td>
                    <td className="p-3.5 px-4 text-gray-600">{u.branch}</td>
                    <td className="p-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : "bg-rose-50 text-rose-700 border-rose-200/60"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 px-4 text-gray-500 font-mono text-[11px]">{u.lastLogin}</td>
                    <td className="p-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          title={u.status === "Active" ? "Suspend User" : "Activate User"}
                          className={`p-1.5 rounded-lg border text-xs transition ${
                            u.status === "Active"
                              ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                              : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {u.status === "Active" ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u.email)}
                          title="Reset Password"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-slate-200 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleForceLogout(u.id, u.name)}
                          title="Force Logout"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-gray-600 hover:text-rose-600 border border-slate-200 transition"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
