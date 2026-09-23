import React, { useState } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { Shield, Plus, Key, Lock, CheckCircle2, UserCheck, X } from "lucide-react";

export default function AdminUsers() {
  const [admins, setAdmins] = useState(() => superAdminService.getAdminUsers());
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Support Admin");

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    superAdminService.addAdminUser({
      name: name.trim(),
      email: email.trim(),
      role,
      twoFactorEnabled: true,
      ipAddress: "103.120.45.15",
    });

    setAdmins(superAdminService.getAdminUsers());
    setModalOpen(false);
    setName("");
    setEmail("");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Platform Admin Users</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Internal operators with role-based administrative control across the platform.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-sm flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Admin User</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="p-3.5 px-4">ADMIN NAME</th>
              <th className="p-3.5 px-4">EMAIL</th>
              <th className="p-3.5 px-4">ROLE</th>
              <th className="p-3.5 px-4">2FA STATUS</th>
              <th className="p-3.5 px-4">LAST LOGIN</th>
              <th className="p-3.5 px-4">ASSIGNED IP</th>
              <th className="p-3.5 px-4">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {admins.map((adm) => (
              <tr key={adm.id} className="text-sm transition-colors hover:bg-gray-50 group">
                <td className="p-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>{adm.name}</span>
                </td>
                <td className="p-3.5 px-4 font-mono text-gray-500">{adm.email}</td>
                <td className="p-3.5 px-4">
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-gray-700">
                    {adm.role}
                  </span>
                </td>
                <td className="p-3.5 px-4">
                  <span className={`font-bold ${adm.twoFactorEnabled ? "text-emerald-600" : "text-gray-400"}`}>
                    {adm.twoFactorEnabled ? "✓ Enforced" : "Optional"}
                  </span>
                </td>
                <td className="p-3.5 px-4 text-gray-500">{adm.lastLogin}</td>
                <td className="p-3.5 px-4 font-mono text-gray-400">{adm.ipAddress}</td>
                <td className="p-3.5 px-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {adm.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900">Invite Platform Admin</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sundar Ramanathan"
                  className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sundar@technovanam.com"
                  className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Platform Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Billing Admin">Billing Admin</option>
                  <option value="Support Admin">Support Admin</option>
                  <option value="Auditor">Auditor (Read-Only)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm">
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
