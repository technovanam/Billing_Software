import React, { useState } from "react";
import { KeyRound, Shield, Check, X, Save } from "lucide-react";

export default function RolesAndPermissions() {
  const roles = [
    "Super Admin",
    "Platform Admin",
    "Finance Admin",
    "Support Admin",
    "Operations Admin",
    "Read Only Admin",
  ];

  const [selectedRole, setSelectedRole] = useState("Platform Admin");

  const permissionMatrix = {
    Businesses: ["View Businesses", "Create Business", "Edit Business", "Suspend Business", "Activate Business", "Delete Business"],
    Subscriptions: ["View Subscriptions", "Change Plan", "Cancel Plan", "Extend Terms"],
    Payments: ["View Payments", "Process Refund"],
    "Platform Users": ["View Users", "Suspend User", "Reset Password"],
    Analytics: ["View Analytics", "Export CSV"],
    "System Settings": ["View Settings", "Edit Gateway & SMTP"],
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Roles & Permissions Matrix</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Configure granular capability matrices and least-privilege security boundaries.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert("Role capability matrix successfully updated and deployed to auth edge.")}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-sm flex items-center gap-2 transition"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Role Picker Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/60 overflow-x-auto w-fit">
        {roles.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRole(r)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              selectedRole === r
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Permissions Matrix Grid */}
      <div className="space-y-4">
        {Object.entries(permissionMatrix).map(([category, perms]) => (
          <div key={category} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>{category} Entitlements</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {perms.map((perm, idx) => {
                const isSuper = selectedRole === "Super Admin";
                const isReadOnly = selectedRole === "Read Only Admin" && perm.startsWith("View");
                const isFinance = selectedRole === "Finance Admin" && (category === "Subscriptions" || category === "Payments" || perm.startsWith("View"));
                const isSupport = selectedRole === "Support Admin" && (category === "Platform Users" || perm.includes("View"));
                const isPlatform = selectedRole === "Platform Admin" && !perm.includes("Delete");
                const allowed = isSuper || isPlatform || isFinance || isSupport || isReadOnly;

                return (
                  <label
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition"
                  >
                    <span className="text-xs text-gray-800 font-medium">{perm}</span>
                    <input
                      type="checkbox"
                      defaultChecked={allowed}
                      disabled={isSuper}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
