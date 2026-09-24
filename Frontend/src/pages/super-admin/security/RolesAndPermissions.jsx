import React, { useState, useEffect } from "react";
import { KeyRound, Shield, Check, X, Save, Loader2 } from "lucide-react";
import { useAdminRoles } from "../../../hooks/useSuperAdminFirestore";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/config";

export default function RolesAndPermissions() {
  const { roles, loading } = useAdminRoles();
  const [selectedRole, setSelectedRole] = useState("Platform Admin");
  const [rolePermissions, setRolePermissions] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const defaultRoles = [
    "Super Admin",
    "Platform Admin",
    "Finance Admin",
    "Support Admin",
    "Operations Admin",
    "Read Only Admin",
  ];

  const displayRoles = roles.length > 0 ? roles.map((r) => r.id) : defaultRoles;

  const permissionMatrix = {
    Businesses: ["View Businesses", "Create Business", "Edit Business", "Suspend Business", "Activate Business", "Delete Business"],
    Subscriptions: ["View Subscriptions", "Change Plan", "Cancel Plan", "Extend Terms"],
    Payments: ["View Payments", "Process Refund"],
    "Platform Users": ["View Users", "Suspend User", "Reset Password"],
    Analytics: ["View Analytics", "Export CSV"],
    "System Settings": ["View Settings", "Edit Gateway & SMTP"],
  };

  useEffect(() => {
    if (!loading && roles.length > 0) {
      const roleData = roles.find((r) => r.id === selectedRole);
      if (roleData && roleData.permissions) {
        setRolePermissions(roleData.permissions);
      } else {
        // Build default mapping
        const mapping = {};
        Object.entries(permissionMatrix).forEach(([category, perms]) => {
          perms.forEach((perm) => {
            const isSuper = selectedRole === "Super Admin";
            const isReadOnly = selectedRole === "Read Only Admin" && perm.startsWith("View");
            const isFinance = selectedRole === "Finance Admin" && (category === "Subscriptions" || category === "Payments" || perm.startsWith("View"));
            const isSupport = selectedRole === "Support Admin" && (category === "Platform Users" || perm.includes("View"));
            const isPlatform = selectedRole === "Platform Admin" && !perm.includes("Delete");
            mapping[perm] = isSuper || isPlatform || isFinance || isSupport || isReadOnly;
          });
        });
        setRolePermissions(mapping);
      }
    } else if (!loading) {
        // Apply defaults if no roles in DB
        const mapping = {};
        Object.entries(permissionMatrix).forEach(([category, perms]) => {
          perms.forEach((perm) => {
            const isSuper = selectedRole === "Super Admin";
            const isReadOnly = selectedRole === "Read Only Admin" && perm.startsWith("View");
            const isFinance = selectedRole === "Finance Admin" && (category === "Subscriptions" || category === "Payments" || perm.startsWith("View"));
            const isSupport = selectedRole === "Support Admin" && (category === "Platform Users" || perm.includes("View"));
            const isPlatform = selectedRole === "Platform Admin" && !perm.includes("Delete");
            mapping[perm] = isSuper || isPlatform || isFinance || isSupport || isReadOnly;
          });
        });
        setRolePermissions(mapping);
    }
  }, [selectedRole, roles, loading]);

  const handleTogglePermission = (perm) => {
    if (selectedRole === "Super Admin") return;
    setRolePermissions(prev => ({
      ...prev,
      [perm]: !prev[perm]
    }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "adminRoles", selectedRole), {
        permissions: rolePermissions,
        updatedAt: new Date().toISOString()
      });
      alert(`Role capability matrix for ${selectedRole} successfully saved to Firebase.`);
    } catch (err) {
      console.error(err);
      alert("Failed to save permissions.");
    } finally {
      setIsSaving(false);
    }
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
          disabled={isSaving || loading}
          onClick={handleSaveChanges}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-bold text-xs text-white shadow-sm flex items-center gap-2 transition"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Role Picker Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/60 overflow-x-auto w-fit">
            {displayRoles.map((r) => (
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
                    const allowed = rolePermissions[perm] || false;

                    return (
                      <label
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${isSuper ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                      >
                        <span className="text-xs text-gray-800 font-medium">{perm}</span>
                        <input
                          type="checkbox"
                          checked={allowed}
                          disabled={isSuper}
                          onChange={() => handleTogglePermission(perm)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
